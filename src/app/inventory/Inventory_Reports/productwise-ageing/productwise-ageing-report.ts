import { CommonModule, formatDate } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgSelectModule } from '@ng-select/ng-select';
import { DatePickerModule } from 'primeng/datepicker';

import { InventoryExportDocument, InventoryExportService } from '../../Inventory_Shared/inventory-export.service';
import { InventoryConfigService, ProductItem } from '../../Inventory_Shared/inventory-config.service';
import {
  InventoryReportsService,
  ProductwiseAgeingReport,
  ProductwiseAgeingRow
} from '../shared/inventory-reports.service';

// Product-wise Ageing (314_productwise_ageing_report.sql, GET /api/reports/productwise-ageing).
//
// Stock ageing: each product's closing stock as on the date - the same qty and
// value as the Stock Summary for that date - split into the company's ageing
// columns by how long it has been lying. Stock goes out oldest first (FIFO),
// so what is still in hand is the latest inwards; each piece is aged from the
// date it came in. The columns are the company's ageing slabs
// (inventory.inv_ageing_slabs, same as the Ageing Analysis report).
//
// Filters: As on Date + optional Product, then Generate.
// Layout: one row per product - Closing Qty, value in each age column, Stock
// Value - and a Grand Total (= Stock Summary stock value).

interface ProductLine extends ProductwiseAgeingRow {
  serial: number;
}

@Component({
  selector: 'app-productwise-ageing-report',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule, DatePickerModule],
  templateUrl: './productwise-ageing-report.html',
  styleUrl: './productwise-ageing-report.scss'
})
export class ProductwiseAgeingReportComponent {
  /** Id of the "All" item in the Product dropdown. */
  static readonly ALL_PRODUCTS = 0;

  private readonly reportsService = inject(InventoryReportsService);
  private readonly configService = inject(InventoryConfigService);
  private readonly exportService = inject(InventoryExportService);
  private readonly destroyRef = inject(DestroyRef);

  readonly todayDate = new Date();
  /** S.No + Code + Product + UOM + Closing Qty in front of the age columns. */
  readonly leadColumns = 5;

  // ── Filters ────────────────────────────────────────────────
  readonly asOnDate = signal<Date>(new Date(this.todayDate.getFullYear(), this.todayDate.getMonth(), this.todayDate.getDate()));
  /** Selected ids; empty (the default) or [ALL_PRODUCTS] = every product. */
  readonly selectedProductIds = signal<number[]>([]);
  readonly products = signal<ProductItem[]>([]);
  /** Dropdown items: "All" first, then the products (built once per load - no new array per change detection). */
  readonly productOptions = computed<Array<{ id: number; name: string }>>(() => [
    { id: ProductwiseAgeingReportComponent.ALL_PRODUCTS, name: 'All' },
    ...this.products().map(p => ({ id: p.id, name: p.product_name || '' }))
  ]);
  readonly productsLoading = signal(false);
  readonly search = signal('');

  // ── Data ───────────────────────────────────────────────────
  readonly report = signal<ProductwiseAgeingReport | null>(null);
  readonly loading = signal(false);
  readonly errorMessage = signal('');

  readonly companyName = signal(this.readCompanyName());
  readonly branchName = signal(this.readBranchName());

  readonly columns = computed(() => this.report()?.columns ?? []);

  readonly lines = computed<ProductLine[]>(() =>
    (this.report()?.rows ?? []).map((r, i) => ({ ...r, serial: i + 1 })));

  readonly filteredLines = computed<ProductLine[]>(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.lines();
    return this.lines().filter(l =>
      (l.product || '').toLowerCase().includes(q) ||
      (l.productCode || '').toLowerCase().includes(q) ||
      (l.category || '').toLowerCase().includes(q));
  });

  readonly totals = computed(() => {
    const t = { values: this.columns().map(() => 0), stockValue: 0 };
    for (const l of this.filteredLines()) {
      l.value.forEach((v, i) => { if (i < t.values.length) t.values[i] += v; });
      t.stockValue += l.stockValue;
    }
    return t;
  });

  readonly hasData = computed(() => this.lines().length > 0);
  readonly reportTitle = 'PRODUCT-WISE AGEING';

  constructor() {
    this.loadProducts();
  }

  private loadProducts(): void {
    this.productsLoading.set(true);
    this.configService.getProducts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.products.set(res.data ?? []);
          this.productsLoading.set(false);
        },
        error: () => {
          this.products.set([]);
          this.productsLoading.set(false);
        }
      });
  }

  setAsOnDate(value: Date | null): void {
    if (value) this.asOnDate.set(value);
  }

  // "All" and individual products don't mix: picking All clears the products,
  // picking a product drops All. Removing everything (x) leaves it empty, which
  // Generate also treats as all products.
  setProducts(value: number[] | null): void {
    const all = ProductwiseAgeingReportComponent.ALL_PRODUCTS;
    const prev = this.selectedProductIds();
    let next = [...(value ?? [])];
    if (next.includes(all) && !prev.includes(all)) next = [all];
    else if (next.length > 1) next = next.filter(id => id !== all);
    this.selectedProductIds.set(next);
  }

  /** Text in the Product box: the name when one is picked, else a count. */
  multiLabel(items: Array<{ id: number; name: string }> | null): string {
    const list = items ?? [];
    if (list.length === 1) return list[0].name;
    return `${list.length} Products selected`;
  }

  /** Hover text: every picked product. */
  multiLabelTitle(items: Array<{ id: number; name: string }> | null): string {
    return (items ?? []).map(i => i.name).join(', ');
  }

  generate(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    const ids = this.selectedProductIds().filter(id => id !== ProductwiseAgeingReportComponent.ALL_PRODUCTS);
    this.reportsService.getProductwiseAgeing(this.asOnDate(), ids)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.report.set(result);
          this.search.set('');
          this.loading.set(false);
        },
        error: () => {
          this.report.set(null);
          this.loading.set(false);
          this.errorMessage.set("We couldn't load this report right now. Please try again in a moment.");
        }
      });
  }

  // ---------------------------------------------------------------- formatting

  /** 1,23,456.00; '-' for nil. No currency symbol. */
  amt(value: number | null | undefined): string {
    const v = Math.round((+(value ?? 0)) * 100) / 100;
    if (!v) return '-';
    return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  qty(value: number | null | undefined): string {
    const v = Math.round((+(value ?? 0)) * 1000) / 1000;
    return v.toLocaleString('en-IN', { maximumFractionDigits: 3 });
  }

  /** Qty in a column, shown under its value; empty when nil. */
  colQty(line: ProductLine, index: number): string {
    const q = line.qty[index] ?? 0;
    return q ? `${this.qty(q)} ${line.uom || ''}`.trim() : '';
  }

  date(value: string | null): string {
    if (!value) return '';
    const d = new Date(`${value}T00:00:00`);
    return isNaN(d.getTime()) ? value : formatDate(d, 'dd-MMM-yyyy', 'en-US');
  }

  periodText(): string {
    const asOn = this.report()?.asOnDate;
    return asOn ? `As on: ${this.date(asOn)}` : '';
  }

  // ------------------------------------------------------------------- export

  exportPdf(): void {
    const doc = this.exportDocument();
    if (doc) this.exportService.pdf(doc, 'Pdf');
  }

  printReport(): void {
    const doc = this.exportDocument();
    if (doc) this.exportService.pdf(doc, 'Print');
  }

  exportExcel(): void {
    const doc = this.exportDocument();
    if (doc) this.exportService.excel(doc);
  }

  private exportDocument(): InventoryExportDocument | null {
    if (!this.hasData()) return null;
    const cols = this.columns();
    const rows = this.filteredLines().map(l => [
      String(l.serial), l.productCode, l.product, l.uom, this.qty(l.closingQty),
      ...cols.map(c => this.amt(l.value[c.index])), this.amt(l.stockValue)
    ]);
    const t = this.totals();
    return {
      title: `${this.reportTitle}${this.branchName() ? ' - ' + this.branchName() : ''}`,
      columns: ['S.No', 'Code', 'Product', 'UOM', 'Closing Qty', ...cols.map(c => c.label), 'Stock Value'],
      rows,
      totalRow: ['', '', 'Grand Total', '', '', ...t.values.map(v => this.amt(v)), this.amt(t.stockValue)],
      periodText: this.periodText(),
      orientation: cols.length > 3 ? 'landscape' : 'portrait',
      pdfHeadFontSize: 8,
      pdfColumnWidths: { 0: 10, 1: 22, 2: 50, 3: 12, 4: 18 },
      fileName: 'Product-wise Ageing'
    };
  }

  private readCompanyName(): string {
    try {
      const raw = sessionStorage.getItem('authCompany');
      return raw ? JSON.parse(raw)?.companyName || '' : '';
    } catch {
      return '';
    }
  }

  private readBranchName(): string {
    try {
      const details = JSON.parse(sessionStorage.getItem('CompanyDetails') || '{}');
      return details?.branchName || sessionStorage.getItem('warehouseName') || '';
    } catch {
      return '';
    }
  }
}
