import { CommonModule, formatDate } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { DatePickerModule } from 'primeng/datepicker';

import { InventoryExportDocument, InventoryExportService } from '../../Inventory_Shared/inventory-export.service';
import { StatCardComponent } from '../../Inventory_Shared/stat-card/stat-card.component';
import { InventoryReportPageComponent } from '../report-page/inventory-report-page';
import { InventoryReportRow } from '../shared/inventory-report.models';
import { PURCHASE_INVOICE_REPORT } from '../shared/inventory-report.registry';
import {
  InventoryReportsService,
  PurchaseReportInvoice,
  PurchaseReportTaxRow
} from '../shared/inventory-reports.service';

// Purchase Invoice - the client's old "Purchase Report" (2026-11-28).
//
// Previous: a separate page with its own header (From / To + Generate only), its own
// grouped-head table and an on-screen GST summary. User 2026-11-28: it must look and
// work exactly like the Purchase Invoice Register - same filters, Generate / Reset,
// search, column chooser, export icons, paging - only the grid columns differ.
// So it now extends the Register's page (InventoryReportPageComponent) and uses its
// template; the definition is PURCHASE_INVOICE_REPORT (same filters and endpoint as
// the Register, 320).
//
// Grid: one row per item line - Date | Invoice | Vendor-GSTIN | Item Description |
// Qty. | Price | Amount | CGST / SGST / IGST Rate % + Amount | Other Charges |
// Other Deductions | Total Amount. Transport charges and the invoice round off are an
// extra line of that invoice, so an invoice's lines add up to its invoice total.
// PDF / Excel / Print keep the client layout: CGST / SGST / IGST grouped heads,
// Date / Invoice / Vendor on an invoice's first line only, Total row, then the GST-rate
// summary (Purchase / Cancels / Returns / Net) and the Grand Total box.

@Component({
  selector: 'app-purchase-invoice-report',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NgSelectModule, DatePickerModule, StatCardComponent],
  templateUrl: '../report-page/inventory-report-page.html'
})
export class PurchaseInvoiceReportComponent extends InventoryReportPageComponent implements OnInit {
  // Own names: the parent's injected services are private.
  private readonly piReportsService = inject(InventoryReportsService);
  private readonly piExportService = inject(InventoryExportService);

  /** GST-rate summary from 320 (PDF / Excel only). */
  private readonly taxSummary = signal<PurchaseReportTaxRow[]>([]);

  override ngOnInit(): void {
    this.setReport(PURCHASE_INVOICE_REPORT);
    this.generateReport(false);
  }

  override generateReport(resetPage = true): void {
    if (resetPage) this.page.set(1);

    this.loading.set(true);
    this.errorMessage.set('');
    this.infoMessage.set('');

    this.piReportsService.getReport(this.report(), this.apiFilters(), this.page(), this.pageSize()).subscribe({
      next: response => {
        const invoices = response.data as unknown as PurchaseReportInvoice[];
        const rows = invoices.flatMap((invoice, index) => this.linesOf(invoice, index));
        const summary = (response.summary ?? {}) as unknown as { taxSummary?: PurchaseReportTaxRow[] };
        this.rows.set(rows);
        this.summary.set({});
        this.taxSummary.set(Array.isArray(summary.taxSummary) ? summary.taxSummary : []);
        this.totalRecords.set(rows.length);
        this.loadedFromApi.set(true);
        this.infoMessage.set(response.message || 'Report generated from API data.');
        this.loading.set(false);
      },
      error: () => {
        this.rows.set([]);
        this.summary.set({});
        this.taxSummary.set([]);
        this.totalRecords.set(0);
        this.loadedFromApi.set(false);
        this.infoMessage.set('');
        this.errorMessage.set("We couldn't load this report right now. Please try again in a moment.");
        this.loading.set(false);
      }
    });
  }

  // ------------------------------------------------------------------ rows

  /** One grid row per item line (+ a charges line); invoiceKey ties an invoice's lines together. */
  private linesOf(inv: PurchaseReportInvoice, index: number): InventoryReportRow[] {
    const n = (value: unknown) => Number(value) || 0;
    const invoiceNo = String(inv.supplierInvoiceNo ?? '').trim() || inv.invoiceNo;
    const head: InventoryReportRow = {
      invoiceKey: `${inv.invoiceNo}-${index}`,
      invoiceDate: inv.invoiceDate,
      invoiceNo,
      piNo: inv.invoiceNo,
      // supplier = name only, for the Supplier filter; vendor = "Name-GSTIN" as printed.
      supplier: inv.supplier,
      vendor: [inv.supplier, inv.vendorGstin].map(v => String(v ?? '').trim()).filter(Boolean).join('-'),
      status: inv.status
    };
    const blank = { qty: null, price: null, cgstRate: null, sgstRate: null, igstRate: null };

    const lines: InventoryReportRow[] = (inv.items || []).map(item => ({
      ...head,
      itemDescription: [item.product, item.variant].map(v => String(v ?? '').trim()).filter(Boolean).join(' - '),
      qty: n(item.qty),
      price: n(item.price),
      amount: n(item.amount),
      cgstRate: n(item.cgstRate),
      cgst: n(item.cgst),
      sgstRate: n(item.sgstRate),
      sgst: n(item.sgst),
      igstRate: n(item.igstRate),
      igst: n(item.igst),
      otherCharges: 0,
      otherDeductions: n(item.deduction),
      totalAmount: n(item.total)
    }));

    const charges = n(inv.otherCharges);
    const deductions = n(inv.otherDeductions);
    if (charges || deductions) {
      lines.push({
        ...head,
        ...blank,
        itemDescription: [n(inv.transportCharges) ? 'Transport Charges' : '', n(inv.roundOff) ? 'Round Off' : '']
          .filter(Boolean).join(' / ') || 'Other Charges',
        amount: null, cgst: null, sgst: null, igst: null,
        otherCharges: charges,
        otherDeductions: deductions,
        totalAmount: charges - deductions
      });
    }

    if (!lines.length) {
      // Invoice without item lines: one row carrying its totals.
      lines.push({
        ...head, ...blank, itemDescription: '',
        amount: n(inv.taxableAmount), cgst: n(inv.cgst), sgst: n(inv.sgst), igst: n(inv.igst),
        otherCharges: 0, otherDeductions: 0, totalAmount: n(inv.netAmount)
      });
    }
    return lines;
  }

  // ------------------------------------------------------------------ export

  override exportExcel(): void {
    const doc = this.purchaseInvoiceDocument();
    if (doc) this.piExportService.excel(doc);
  }

  override exportPdf(): void {
    const doc = this.purchaseInvoiceDocument();
    if (doc) this.piExportService.pdf(doc, 'Pdf');
  }

  override printReport(): void {
    const doc = this.purchaseInvoiceDocument();
    if (doc) this.piExportService.pdf(doc, 'Print');
  }

  /** Client "Purchase Report" layout from the rows on screen (search / filters / sort applied). */
  private purchaseInvoiceDocument(): InventoryExportDocument | null {
    const lines = this.sortedRows();
    if (!lines.length) return null;

    const n = (value: unknown) => Number(value) || 0;
    const t = { amount: 0, cgst: 0, sgst: 0, igst: 0, otherCharges: 0, otherDeductions: 0, total: 0 };
    const rows: string[][] = [];
    let previousKey: unknown = null;
    for (const l of lines) {
      const first = l['invoiceKey'] !== previousKey;
      previousKey = l['invoiceKey'];
      const invoiceNo = String(l['invoiceNo'] ?? '');
      const piNo = String(l['piNo'] ?? '');
      rows.push([
        first ? this.pdfDate(l['invoiceDate']) : '',
        first ? (piNo && piNo !== invoiceNo ? `${invoiceNo}\n(${piNo})` : invoiceNo) : '',
        first ? String(l['vendor'] ?? '') : '',
        String(l['itemDescription'] ?? ''),
        this.num(l['qty']),
        this.amt(l['price']),
        this.amt(l['amount']),
        this.num(l['cgstRate']), this.amt(l['cgst']),
        this.num(l['sgstRate']), this.amt(l['sgst']),
        this.num(l['igstRate']), this.amt(l['igst']),
        this.amt(l['otherCharges'], true),
        this.amt(l['otherDeductions'], true),
        this.amt(l['totalAmount'])
      ]);
      t.amount += n(l['amount']);
      t.cgst += n(l['cgst']);
      t.sgst += n(l['sgst']);
      t.igst += n(l['igst']);
      t.otherCharges += n(l['otherCharges']);
      t.otherDeductions += n(l['otherDeductions']);
      t.total += n(l['totalAmount']);
    }

    const tax = this.taxSummary();
    const g = { purchase: 0, cgst: 0, sgst: 0, igst: 0 };
    for (const r of tax) {
      g.purchase += n(r.purchase);
      g.cgst += n(r.purchaseCgst);
      g.sgst += n(r.purchaseSgst);
      g.igst += n(r.purchaseIgst);
    }

    const from = this.filterDateValue('fromDate');
    const to = this.filterDateValue('toDate');
    const pdfDay = (value: Date) => formatDate(value, 'dd-MMM-yyyy', 'en-US');
    const periodText = from && to ? `From : ${pdfDay(from)}    To : ${pdfDay(to)}` : to ? `As on : ${pdfDay(to)}` : '';
    const title = this.report().title;

    return {
      title,
      columns: ['Date', 'Invoice', 'Vendor/Direct Sale', 'Item Description', 'Qty.', 'Price', 'Amount',
        'Rate %', 'Amount', 'Rate %', 'Amount', 'Rate %', 'Amount', 'Other Charges', 'Other Deductions', 'Total Amount'],
      columnGroups: [['Date', 1], ['Invoice', 1], ['Vendor/Direct Sale', 1], ['Item Description', 1], ['Qty.', 1], ['Price', 1], ['Amount', 1],
        ['CGST', 2], ['SGST', 2], ['IGST', 2], ['Other Charges', 1], ['Other Deductions', 1], ['Total Amount', 1]],
      rows,
      totalRow: ['Total', '', '', '', '', '', this.amt(t.amount), '', this.amt(t.cgst), '', this.amt(t.sgst), '', this.amt(t.igst),
        this.amt(t.otherCharges, true), this.amt(t.otherDeductions, true), this.amt(t.total)],
      trailingTables: tax.length ? [
        {
          columns: ['CGST', 'SGST', 'IGST',
            'TOTAL', 'CGST', 'SGST', 'IGST',
            'TOTAL', 'CGST', 'SGST', 'IGST',
            'TOTAL', 'CGST', 'SGST', 'IGST',
            'NET PURCHASE', 'NET CGST', 'NET SGST', 'NET IGST'],
          columnGroups: [['TAX PERCENTAGE', 3], ['PURCHASE', 4], ['PURCHASE CANCELS', 4], ['PURCHASE RETURNS', 4], ['NET PURCHASE', 4]],
          rows: tax.map(r => [
            this.amt(r.cgstRate), this.amt(r.sgstRate), this.amt(r.igstRate),
            this.amt(r.purchase), this.amt(r.purchaseCgst), this.amt(r.purchaseSgst), this.amt(r.purchaseIgst),
            this.amt(r.cancel), this.amt(r.cancelCgst), this.amt(r.cancelSgst), this.amt(r.cancelIgst),
            this.amt(r.returns), this.amt(r.returnCgst), this.amt(r.returnSgst), this.amt(r.returnIgst),
            this.amt(r.net), this.amt(r.netCgst), this.amt(r.netSgst), this.amt(r.netIgst)
          ])
        },
        {
          columns: ['', 'PURCHASE', 'CGST', 'SGST', 'IGST'],
          rows: [['GRAND TOTAL :', this.amt(g.purchase), this.amt(g.cgst), this.amt(g.sgst), this.amt(g.igst)]],
          pdfWidth: 160,
          boldColumns: [0]
        }
      ] : [],
      periodText,
      orientation: 'landscape',
      // Usual Inventory report colours: #0b4093 heading, white text.
      pdfBlueHead: true,
      pdfHeadFontSize: 7,
      // "Rate %", "Other Charges", "Other Deductions", "Total Amount" on one line each.
      pdfOneLinePercentHead: true,
      pdfOneLineHeads: ['Other Charges', 'Other Deductions', 'Total Amount'],
      pdfColumnWidths: { 0: 16, 1: 20, 2: 25, 3: 29, 4: 10, 5: 15, 6: 18, 7: 9.5, 9: 9.5, 11: 9.5, 13: 18, 14: 22, 15: 20 },
      fileName: title
    };
  }

  // ------------------------------------------------------------- formatting

  /** 1,23,456.00 (Indian grouping), no currency symbol; blank for nil. */
  private amt(value: unknown, blankZero = false): string {
    if (value === null || value === undefined || value === '') return '';
    const v = Math.round((Number(value) || 0) * 100) / 100;
    if (!v && blankZero) return '';
    return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /** Rate % / quantity without trailing zeros (9, 2.5, 18, 100). */
  private num(value: unknown): string {
    if (value === null || value === undefined || value === '') return '';
    return String(Math.round((Number(value) || 0) * 1000) / 1000);
  }

  private pdfDate(value: unknown): string {
    if (!value) return '';
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
    const d = iso ? new Date(+iso[1], +iso[2] - 1, +iso[3]) : new Date(String(value));
    return isNaN(d.getTime()) ? String(value) : formatDate(d, 'dd-MMM-yyyy', 'en-US');
  }
}
