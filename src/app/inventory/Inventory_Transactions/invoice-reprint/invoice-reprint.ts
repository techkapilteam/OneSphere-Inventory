import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { InventoryScreenShell } from '../../Inventory_Shared/inventory-screen-shell/inventory-screen-shell';
import { purchaseInvoiceConfig, salesInvoiceConfig } from '../../Inventory_Shared/inventory-screen.model';
import { InventoryExportDocument } from '../../Inventory_Shared/inventory-export.service';

const NUMERIC_CELL = /^-?(rs\.?\s*|₹\s*)?-?[\d,]+(\.\d+)?\s*%?$/i;

// Accounts > Re-Print, Transaction Type "Sales Invoice" / "Purchase Invoice".
// Accounts opens this page in a new tab (top-level route invoice-reprint/:id,
// id = btoa("<invoice no>,<Sales Invoice|Purchase Invoice>,Reprint"), the
// same id format as the Journal Voucher reprint). It shows only the invoice,
// laid out like Accounts' Journal Voucher reprint page (letterhead + branch
// box, title banner with a DUPLICATE badge, bordered tables), with Print / PDF
// buttons that give the regular invoice PDF titled "Tax Invoice (DUPLICATE)".
// Extends InventoryScreenShell only to reuse its invoice document builders.
// Previous: the page embedded the generated PDF in an <iframe> (browser PDF viewer).
@Component({
  selector: 'app-inventory-invoice-reprint',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './invoice-reprint.html'
})
export class InventoryInvoiceReprintComponent extends InventoryScreenShell implements OnInit {
  private readonly reprintRoute = inject(ActivatedRoute);

  private readonly reprintKind: 'salesInvoice' | 'purchaseInvoice';
  readonly reprintNo: string;
  readonly reprintLabel: string;

  // Set before the shell's ngOnInit, which loads the lookups for this config.
  override config = salesInvoiceConfig;

  readonly reprintDoc = signal<InventoryExportDocument | null>(null);
  readonly reprintError = signal('');
  readonly company = signal<any>({});
  readonly printedOn = new Date();

  /** Banner title without the "(DUPLICATE)" the PDF carries — the badge shows it. */
  readonly bannerTitle = computed(() =>
    String(this.reprintDoc()?.title || this.reprintLabel).replace(/\s*\(DUPLICATE\)\s*$/i, ''));
  readonly boxedLabels = computed(() => new Set(this.reprintDoc()?.boxedFieldLabels || []));
  readonly boldLabels = computed(() => new Set(this.reprintDoc()?.boldFieldLabels || []));
  readonly plainFields = computed(() =>
    (this.reprintDoc()?.fields || []).filter(([label, value]) => !this.boxedLabels().has(label) && String(value ?? '').trim() !== ''));
  readonly boxedFields = computed(() =>
    (this.reprintDoc()?.fields || []).filter(([label]) => this.boxedLabels().has(label)));
  readonly cinGst = computed(() => {
    const c = this.company();
    return [
      c?.cinNumber ? ['CIN', c.cinNumber] : null,
      c?.gstNumber ? ['GST NO', c.gstNumber] : null,
      c?.panNumber ? ['PAN', c.panNumber] : null
    ].filter(Boolean) as Array<[string, string]>;
  });

  constructor() {
    super();
    let parts: string[] = [];
    try {
      parts = atob(this.reprintRoute.snapshot.paramMap.get('id') || '').split(',');
    } catch {
      parts = [];
    }
    this.reprintNo = String(parts[0] || '').trim().toUpperCase();
    this.reprintKind = /purchase/i.test(parts[1] || '') ? 'purchaseInvoice' : 'salesInvoice';
    this.reprintLabel = this.reprintKind === 'purchaseInvoice' ? 'Purchase Invoice' : 'Sales Invoice';
    this.config = this.reprintKind === 'purchaseInvoice' ? purchaseInvoiceConfig : salesInvoiceConfig;
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.company.set(this.invoiceCompanyDetails() || {});
    this.loadInvoiceReprintDocument(this.reprintKind, this.reprintNo, result => {
      if (!result.doc) {
        this.reprintError.set(result.error || `${this.reprintLabel} could not be loaded.`);
        return;
      }
      this.reprintDoc.set(result.doc);
    });
  }

  /** Print / PDF give the regular invoice PDF ("Tax Invoice (DUPLICATE)"). */
  download(mode: 'Pdf' | 'Print'): void {
    const doc = this.reprintDoc();
    if (doc) this.outputInvoiceDocument(doc, mode);
  }

  isNumeric(value: any): boolean {
    return NUMERIC_CELL.test(String(value ?? '').trim());
  }

  /** Header cells for the GST group row: a span-1 group covers both header rows. */
  groupedHeader(): Array<{ title: string; span: number; rowspan: number }> {
    return (this.reprintDoc()?.columnGroups || []).map(([title, span]) => ({ title, span, rowspan: span === 1 ? 2 : 1 }));
  }

  /** Second header row: only the columns under a multi-column group. */
  subHeaderColumns(): string[] {
    const doc = this.reprintDoc();
    if (!doc?.columnGroups?.length) return doc?.columns || [];
    const out: string[] = [];
    let index = 0;
    doc.columnGroups.forEach(([, span]) => {
      if (span > 1) out.push(...doc.columns.slice(index, index + span));
      index += span;
    });
    return out;
  }

  /** Total row: blank cells after the first merge into it (like the PDF). */
  totalRowCells(): Array<{ value: string; span: number }> {
    const row = this.reprintDoc()?.totalRow || [];
    const cells: Array<{ value: string; span: number }> = [];
    row.forEach((value, index) => {
      if (index > 0 && !String(value ?? '').trim() && cells.length === 1) {
        cells[0].span++;
      } else {
        cells.push({ value: String(value ?? ''), span: 1 });
      }
    });
    return cells;
  }
}
