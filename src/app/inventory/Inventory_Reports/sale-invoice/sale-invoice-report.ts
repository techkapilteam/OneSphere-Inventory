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
import { SALE_INVOICE_REPORT } from '../shared/inventory-report.registry';
import { InventoryReportsService } from '../shared/inventory-reports.service';

// Sale Invoice - the client's old "Sales Report" (2026-11-28), the sales twin of
// Purchase Invoice (purchase-invoice-report.ts).
//
// Same screen as the Sale Invoice Register: it extends the Register's page
// (InventoryReportPageComponent) and uses its template - same filters, Generate / Reset,
// search, column chooser, export icons, paging. Same endpoint too
// (GET /api/reports/sales-invoice-register, 321_sales_report_line_items.sql), which now
// also returns items[] per invoice, summary.returns[] and summary.taxSummary[].
//
// Grid: one row per item line, grouped SALES / SALE RETURN / CANCEL like the old print.
// SALES = every invoice in the period (oldest first); SALE RETURN = posted sales returns;
// CANCEL = the cancelled invoices again. On screen the Sale Return / Cancel amounts are
// negative, so the Grand Total row = Net Sales (Sales - Cancels - Returns).
// PDF / Excel / Print keep the client layout: CGST / SGST / IGST grouped heads, each
// section with its heading and total line (positive amounts), Date / Invoice / Customer
// on a document's first line only, then the GST-rate summary (Sales / Sales Cancels /
// Sales Returns / Net Sales) and the Grand Total box (= net).

type Section = 'SALES' | 'SALE RETURN' | 'CANCEL';
const SECTIONS: Section[] = ['SALES', 'SALE RETURN', 'CANCEL'];

interface SalesReportItem {
  product: string;
  variant: string | null;
  qty: number;
  price: number;
  amount: number;
  deduction: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

interface SalesReportDoc {
  date: string | null;
  docNo: string;
  customer: string;
  customerLabel: string;
  status: string;
  otherCharges: number;
  otherDeductions: number;
  roundOff: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  netAmount: number;
  items: SalesReportItem[];
}

interface SalesReportTaxRow {
  gstRate: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  sales: number; salesCgst: number; salesSgst: number; salesIgst: number;
  cancel: number; cancelCgst: number; cancelSgst: number; cancelIgst: number;
  returns: number; returnCgst: number; returnSgst: number; returnIgst: number;
  net: number; netCgst: number; netSgst: number; netIgst: number;
}

@Component({
  selector: 'app-sale-invoice-report',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NgSelectModule, DatePickerModule, StatCardComponent],
  templateUrl: '../report-page/inventory-report-page.html'
})
export class SaleInvoiceReportComponent extends InventoryReportPageComponent implements OnInit {
  // Own names: the parent's injected services are private.
  private readonly siReportsService = inject(InventoryReportsService);
  private readonly siExportService = inject(InventoryExportService);

  /** GST-rate summary from 321 (PDF / Excel only). */
  private readonly taxSummary = signal<SalesReportTaxRow[]>([]);

  override ngOnInit(): void {
    this.setReport(SALE_INVOICE_REPORT);
    this.generateReport(false);
  }

  override generateReport(resetPage = true): void {
    if (resetPage) this.page.set(1);

    this.loading.set(true);
    this.errorMessage.set('');
    this.infoMessage.set('');

    this.siReportsService.getReport(this.report(), this.apiFilters(), this.page(), this.pageSize()).subscribe({
      next: response => {
        const raw = response.data as unknown as Array<Record<string, any>>;
        const summary = (response.summary ?? {}) as unknown as { returns?: Array<Record<string, any>>; taxSummary?: SalesReportTaxRow[] };

        // The register lists newest first; the old Sales Report prints oldest first.
        // Previous: const invoices = raw.map(inv => this.invoiceDoc(inv)).reverse();
        // Posted invoices only - drafts are left out (user 2026-11-28). Cancelled ones stay
        // (SALES + CANCEL sections, like the old print). The register still lists drafts.
        const invoices = raw.map(inv => this.invoiceDoc(inv))
          .filter(inv => inv.status.toLowerCase() !== 'draft')
          .reverse();
        const returns = (Array.isArray(summary.returns) ? summary.returns : []).map(r => this.returnDoc(r));
        const cancelled = invoices.filter(inv => inv.status.toLowerCase() === 'cancelled');

        const rows = [
          ...invoices.flatMap((d, i) => this.linesOf(d, 'SALES', i)),
          ...returns.flatMap((d, i) => this.linesOf(d, 'SALE RETURN', i)),
          ...cancelled.flatMap((d, i) => this.linesOf(d, 'CANCEL', i))
        ];

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

  private invoiceDoc(inv: Record<string, any>): SalesReportDoc {
    const n = (value: unknown) => Number(value) || 0;
    return {
      date: inv['invoiceDate'] ?? null,
      docNo: String(inv['invoiceNo'] ?? ''),
      customer: String(inv['customer'] ?? ''),
      customerLabel: String(inv['customerLabel'] ?? '') || String(inv['customer'] ?? ''),
      status: String(inv['status'] ?? ''),
      otherCharges: n(inv['otherCharges']),
      otherDeductions: n(inv['otherDeductions']),
      roundOff: n(inv['roundOff']),
      taxableAmount: n(inv['taxableAmount']),
      cgst: n(inv['cgst']),
      sgst: n(inv['sgst']),
      igst: n(inv['igst']),
      netAmount: n(inv['netAmount']),
      items: Array.isArray(inv['items']) ? inv['items'] : []
    };
  }

  private returnDoc(r: Record<string, any>): SalesReportDoc {
    const n = (value: unknown) => Number(value) || 0;
    const items: SalesReportItem[] = Array.isArray(r['items']) ? r['items'] : [];
    const sum = (key: keyof SalesReportItem) => items.reduce((acc, item) => acc + n(item[key]), 0);
    return {
      date: r['returnDate'] ?? null,
      docNo: String(r['returnNo'] ?? ''),
      customer: String(r['customer'] ?? ''),
      customerLabel: String(r['customerLabel'] ?? '') || String(r['customer'] ?? ''),
      status: String(r['status'] ?? ''),
      otherCharges: 0,
      otherDeductions: 0,
      roundOff: 0,
      taxableAmount: sum('amount'),
      cgst: sum('cgst'),
      sgst: sum('sgst'),
      igst: sum('igst'),
      netAmount: n(r['totalAmount']) || sum('total'),
      items
    };
  }

  /** One grid row per item line (+ a round-off line). Sale Return / Cancel rows carry
   *  sign -1 so their amounts show negative on screen; the export multiplies back. */
  private linesOf(d: SalesReportDoc, section: Section, index: number): InventoryReportRow[] {
    const n = (value: unknown) => Number(value) || 0;
    const sign = section === 'SALES' ? 1 : -1;
    const s = (value: number) => value * sign;
    const head: InventoryReportRow = {
      docKey: `${section}-${d.docNo}-${index}`,
      section,
      sign,
      invoiceDate: d.date,
      invoiceNo: d.docNo,
      // customer = name only, for the Customer filter; customerLabel = "Name-GSTIN" as printed.
      customer: d.customer,
      customerLabel: d.customerLabel,
      status: d.status
    };
    const blank = { qty: null, price: null, cgstRate: null, sgstRate: null, igstRate: null, product: '' };

    const lines: InventoryReportRow[] = d.items.map(item => ({
      ...head,
      product: String(item.product ?? ''),
      itemDescription: [item.product, item.variant].map(v => String(v ?? '').trim()).filter(Boolean).join(' - '),
      qty: n(item.qty),
      price: n(item.price),
      amount: s(n(item.amount)),
      cgstRate: n(item.cgstRate),
      cgst: s(n(item.cgst)),
      sgstRate: n(item.sgstRate),
      sgst: s(n(item.sgst)),
      igstRate: n(item.igstRate),
      igst: s(n(item.igst)),
      otherCharges: 0,
      otherDeductions: s(n(item.deduction)),
      totalAmount: s(n(item.total))
    }));

    if (d.otherCharges || d.otherDeductions) {
      lines.push({
        ...head,
        ...blank,
        itemDescription: 'Round Off',
        amount: null, cgst: null, sgst: null, igst: null,
        otherCharges: s(d.otherCharges),
        otherDeductions: s(d.otherDeductions),
        totalAmount: s(d.otherCharges - d.otherDeductions)
      });
    }

    if (!lines.length) {
      // Document without item lines: one row carrying its totals.
      lines.push({
        ...head, ...blank, itemDescription: '',
        amount: s(d.taxableAmount), cgst: s(d.cgst), sgst: s(d.sgst), igst: s(d.igst),
        otherCharges: 0, otherDeductions: 0, totalAmount: s(d.netAmount)
      });
    }
    return lines;
  }

  // ------------------------------------------------------------------ export

  override exportExcel(): void {
    const doc = this.saleInvoiceDocument();
    if (doc) this.siExportService.excel(doc);
  }

  override exportPdf(): void {
    const doc = this.saleInvoiceDocument();
    if (doc) this.siExportService.pdf(doc, 'Pdf');
  }

  override printReport(): void {
    const doc = this.saleInvoiceDocument();
    if (doc) this.siExportService.pdf(doc, 'Print');
  }

  /** Client "Sales Report" layout from the rows on screen (search / filters applied). */
  private saleInvoiceDocument(): InventoryExportDocument | null {
    const all = this.sortedRows();
    if (!all.length) return null;

    const n = (value: unknown) => Number(value) || 0;
    const rows: string[][] = [];
    const groupRowIndexes: number[] = [];
    const width = 16;

    for (const section of SECTIONS) {
      const lines = all.filter(l => l['section'] === section);
      if (!lines.length) continue;

      groupRowIndexes.push(rows.length);
      rows.push([section, ...Array(width - 1).fill('')]);

      const t = { amount: 0, cgst: 0, sgst: 0, igst: 0, otherCharges: 0, otherDeductions: 0, total: 0 };
      let previousKey: unknown = null;
      for (const l of lines) {
        const sign = n(l['sign']) || 1;
        const v = (key: string) => (l[key] === null || l[key] === undefined || l[key] === '') ? null : n(l[key]) * sign;
        const first = l['docKey'] !== previousKey;
        previousKey = l['docKey'];
        rows.push([
          first ? this.pdfDate(l['invoiceDate']) : '',
          first ? String(l['invoiceNo'] ?? '') : '',
          first ? String(l['customerLabel'] ?? '') : '',
          String(l['itemDescription'] ?? ''),
          this.num(l['qty']),
          this.amt(l['price']),
          this.amt(v('amount')),
          this.num(l['cgstRate']), this.amt(v('cgst')),
          this.num(l['sgstRate']), this.amt(v('sgst')),
          this.num(l['igstRate']), this.amt(v('igst')),
          this.amt(v('otherCharges'), true),
          this.amt(v('otherDeductions'), true),
          this.amt(v('totalAmount'))
        ]);
        t.amount += v('amount') ?? 0;
        t.cgst += v('cgst') ?? 0;
        t.sgst += v('sgst') ?? 0;
        t.igst += v('igst') ?? 0;
        t.otherCharges += v('otherCharges') ?? 0;
        t.otherDeductions += v('otherDeductions') ?? 0;
        t.total += v('totalAmount') ?? 0;
      }

      groupRowIndexes.push(rows.length);
      rows.push(['Total', '', '', '', '', '', this.amt(t.amount), '', this.amt(t.cgst), '', this.amt(t.sgst), '', this.amt(t.igst),
        this.amt(t.otherCharges, true), this.amt(t.otherDeductions, true), this.amt(t.total)]);
    }

    const tax = this.taxSummary();
    const g = { sales: 0, cgst: 0, sgst: 0, igst: 0 };
    for (const r of tax) {
      g.sales += n(r.net);
      g.cgst += n(r.netCgst);
      g.sgst += n(r.netSgst);
      g.igst += n(r.netIgst);
    }

    const from = this.filterDateValue('fromDate');
    const to = this.filterDateValue('toDate');
    const pdfDay = (value: Date) => formatDate(value, 'dd-MMM-yyyy', 'en-US');
    const periodText = from && to ? `From : ${pdfDay(from)}    To : ${pdfDay(to)}` : to ? `As on : ${pdfDay(to)}` : '';
    const title = this.report().title;

    return {
      title,
      columns: ['Date', 'Invoice', 'Dealer/Customer Name', 'Item Description', 'Qty.', 'Price', 'Amount',
        'Rate %', 'Amount', 'Rate %', 'Amount', 'Rate %', 'Amount', 'Other Charges', 'Other Deductions', 'Total Amount'],
      columnGroups: [['Date', 1], ['Invoice', 1], ['Dealer/Customer Name', 1], ['Item Description', 1], ['Qty.', 1], ['Price', 1], ['Amount', 1],
        ['CGST', 2], ['SGST', 2], ['IGST', 2], ['Other Charges', 1], ['Other Deductions', 1], ['Total Amount', 1]],
      rows,
      groupRowIndexes,
      trailingTables: tax.length ? [
        {
          columns: ['CGST TAX', 'SGST TAX', 'IGST TAX',
            'SALES TOTAL', 'SALES CGST', 'SALES SGST', 'SALES IGST',
            'TOTAL', 'CGST', 'SGST', 'IGST',
            'TOTAL', 'CGST', 'SGST', 'IGST',
            'NET SALES', 'NET CGST', 'NET SGST', 'NET IGST'],
          columnGroups: [['TAX PERCENTAGE', 3], ['SALES', 4], ['SALES CANCELS', 4], ['SALES RETURNS', 4], ['NET SALES', 4]],
          rows: tax.map(r => [
            this.amt(r.cgstRate), this.amt(r.sgstRate), this.amt(r.igstRate),
            this.amt(r.sales), this.amt(r.salesCgst), this.amt(r.salesSgst), this.amt(r.salesIgst),
            this.amt(r.cancel), this.amt(r.cancelCgst), this.amt(r.cancelSgst), this.amt(r.cancelIgst),
            this.amt(r.returns), this.amt(r.returnCgst), this.amt(r.returnSgst), this.amt(r.returnIgst),
            this.amt(r.net), this.amt(r.netCgst), this.amt(r.netSgst), this.amt(r.netIgst)
          ])
        },
        {
          columns: ['', 'SALES', 'CGST', 'SGST', 'IGST'],
          rows: [['GRAND TOTAL :', this.amt(g.sales), this.amt(g.cgst), this.amt(g.sgst), this.amt(g.igst)]],
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
