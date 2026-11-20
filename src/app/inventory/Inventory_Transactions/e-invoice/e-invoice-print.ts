import { CommonModule } from '@angular/common';
import {
  Component, DestroyRef, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild,
  ViewEncapsulation, inject, signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { toDataURL } from 'qrcode';
import { EInvoicePrint, InventoryTransactionsService } from '../../Inventory_Shared/inventory-transactions.service';

// One stylesheet for the on-screen preview and the print window, so both look the
// same. Classes are prefixed einvp- because encapsulation is off (the print window
// gets the sheet's plain HTML, without Angular's scoped attributes).
const EINVOICE_PRINT_CSS = `
.einvp-modal { width: 96vw; max-width: 960px; }
.einvp-scroll { max-height: 74vh; overflow: auto; padding: 8px 4px; }
.einvp-actions { display: flex; gap: 8px; align-items: center; }
.einvp-state { padding: 32px 12px; }
.einvp-sheet { font-family: Verdana, Arial, sans-serif; font-size: 11px; color: #000; background: #fff;
  width: 100%; max-width: 860px; margin: 0 auto; border: 1px solid #000; box-sizing: border-box; }
.einvp-sheet * { box-sizing: border-box; }
.einvp-sheet table { width: 100%; border-collapse: collapse; }
.einvp-head { display: flex; align-items: stretch; border-bottom: 1px solid #000; }
.einvp-logo { width: 110px; padding: 8px; display: flex; align-items: flex-start; justify-content: center; }
.einvp-logo img { max-width: 90px; max-height: 80px; }
.einvp-company { flex: 1; text-align: center; padding: 8px 6px; }
.einvp-company h1 { font-size: 15px; margin: 0 0 8px; font-weight: bold; }
.einvp-company div { margin-top: 4px; }
.einvp-qr { width: 190px; padding: 4px; display: flex; align-items: center; justify-content: center; }
.einvp-qr img { width: 180px; height: 180px; }
.einvp-bar { background: #c8c8c8; font-weight: bold; padding: 3px 6px; border-bottom: 1px solid #000; }
.einvp-bar--center { text-align: center; border-top: 1px solid #000; }
.einvp-pad { padding: 4px 6px; }
.einvp-kv td { padding: 2px 6px; vertical-align: top; }
.einvp-kv .k { font-weight: bold; white-space: nowrap; width: 120px; }
.einvp-kv .c { width: 14px; font-weight: bold; }
.einvp-irn { word-break: break-all; }
.einvp-items { border-top: 1px solid #000; }
.einvp-items th, .einvp-items td { border: 1px solid #000; padding: 3px 4px; }
.einvp-items th { font-size: 10px; text-align: center; }
.einvp-items td.n { text-align: right; white-space: nowrap; }
.einvp-items td.c { text-align: center; }
.einvp-items tr.einvp-total td { font-weight: bold; }
.einvp-items tr.einvp-total td.einvp-total-label { background: #c8c8c8; text-align: center; }
.einvp-items tr:first-child th, .einvp-items tr:first-child td { border-top: 0; }
.einvp-items tr th:first-child, .einvp-items tr td:first-child { border-left: 0; }
.einvp-items tr th:last-child, .einvp-items tr td:last-child { border-right: 0; }
.einvp-bottom { display: flex; border-top: 1px solid #000; }
.einvp-words { flex: 1; border-right: 1px solid #000; }
.einvp-words p { text-align: center; margin: 12px 6px; }
.einvp-sums { width: 340px; }
.einvp-sums td { border-bottom: 1px solid #000; padding: 4px 6px; font-weight: bold; font-size: 10px; }
.einvp-sums td.n { text-align: right; border-left: 1px solid #000; width: 90px; }
.einvp-cert { font-size: 9px; font-weight: bold; padding: 4px 6px; border-bottom: 1px solid #000; }
.einvp-for { font-weight: bold; font-size: 12px; padding: 10px 6px 40px; }
.einvp-note { max-width: 860px; margin: 8px auto 0; font-size: 10px; }
@media print {
  @page { size: A4; margin: 10mm; }
  body { margin: 0; }
  .einvp-sheet { max-width: none; }
  .einvp-bar, .einvp-items tr.einvp-total td.einvp-total-label {
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

/**
 * Printable e-invoice (Sales > E-Invoice > Old > invoice no / View): company header with
 * logo and the signed QR, IRN / Ack block, customer, items with the CGST/SGST/IGST split,
 * totals and amount in words. Loads GET sales/e-invoices/{id}/print.
 */
@Component({
  selector: 'app-inventory-e-invoice-print',
  standalone: true,
  imports: [CommonModule],
  encapsulation: ViewEncapsulation.None,
  styles: [EINVOICE_PRINT_CSS],
  template: `
<div class="inventory-modal-backdrop" (click)="close()">
  <div class="inventory-modal inventory-modal--wide einvp-modal" (click)="$event.stopPropagation()">
    <div class="inventory-modal-header">
      <h3>E-Invoice · {{ invoiceNo }}</h3>
      <div class="einvp-actions">
        <button type="button" class="erp-btn btn-primary btn-sm" [disabled]="!data() || !qrReady()" (click)="print()">
          <i class="pi pi-print"></i> Print
        </button>
        <button title="Close" type="button" class="erp-btn btn-white btn-icon btn-sm" (click)="close()">
          <i class="pi pi-times"></i>
        </button>
      </div>
    </div>

    @if (loading()) {
      <div class="text-center einvp-state"><i class="pi pi-spin pi-spinner"></i> Loading e-invoice…</div>
    } @else if (error()) {
      <div class="text-center text-danger einvp-state"><i class="pi pi-exclamation-triangle"></i> {{ error() }}</div>
    } @else if (data(); as d) {
      <div class="einvp-scroll">
        <div #sheet>
          <div class="einvp-sheet">
            <div class="einvp-head">
              <div class="einvp-logo">
                @if (logoSrc(d); as logo) { <img [src]="logo" alt="Logo" /> }
              </div>
              <div class="einvp-company">
                <h1>{{ d.sellerName }}</h1>
                <div>{{ d.sellerAddress }}</div>
                <div>Phone : {{ d.sellerPhone }}, Email : {{ d.sellerEmail }}</div>
                <div>
                  @if (d.sellerCin) { CIN :{{ d.sellerCin }}&nbsp; }
                  GSTIN : {{ d.sellerGstin }}
                </div>
              </div>
              <div class="einvp-qr">
                @if (qrSrc()) { <img [src]="qrSrc()" alt="E-invoice QR code" /> }
              </div>
            </div>

            <div class="einvp-bar">E-Invoice Details</div>
            <table class="einvp-kv">
              <tr>
                <td class="k">IRN</td><td class="c">:</td><td class="einvp-irn">{{ d.irn }}</td>
                <td class="k">Ack.No</td><td class="c">:</td><td>{{ d.ackNo }}</td>
              </tr>
              <tr>
                <td></td><td></td><td></td>
                <td class="k">Ack.Date</td><td class="c">:</td><td>{{ ackDate(d.ackDate) }}</td>
              </tr>
            </table>

            <div class="einvp-bar einvp-bar--center">Tax Invoice</div>
            <table class="einvp-kv">
              <tr><td class="k">Invoice No.</td><td class="c">:</td><td>{{ d.invoiceNo }}</td></tr>
              <tr><td class="k">Invoice Date</td><td class="c">:</td><td>{{ invoiceDate(d.invoiceDate) }}</td></tr>
              <tr><td class="k">State</td><td class="c">:</td><td>{{ state(d.sellerState, d.sellerStateCode) }}</td></tr>
            </table>

            <div class="einvp-bar einvp-bar--center">Customer Details</div>
            <table class="einvp-kv">
              <tr>
                <td class="k">Name</td><td class="c">:</td><td>{{ d.customerName }}</td>
                <td class="k">Address</td><td class="c">:</td><td>{{ d.customerAddress }}</td>
              </tr>
              <tr><td class="k">GSTIN</td><td class="c">:</td><td>{{ d.customerGstin }}</td><td colspan="3"></td></tr>
              <tr><td class="k">State</td><td class="c">:</td><td>{{ state(d.customerState, d.customerStateCode) }}</td><td colspan="3"></td></tr>
              <tr>
                <td class="k">Contact Person Name :</td><td class="c"></td><td>{{ d.contactPersonName }}</td>
                <td class="k">Mobile No :</td><td class="c"></td><td>{{ d.contactMobile }}</td>
              </tr>
            </table>

            <table class="einvp-items">
              <tr>
                <th rowspan="2">Product Name</th>
                <th rowspan="2">HSN Code</th>
                <th rowspan="2">Qty</th>
                <th rowspan="2">Cost/<br />Item</th>
                <th rowspan="2">Amount</th>
                <th colspan="2">CGST</th>
                <th colspan="2">SGST</th>
                <th colspan="2">IGST</th>
                <th rowspan="2">Total</th>
              </tr>
              <tr>
                <th>Rate</th><th>Amount</th>
                <th>Rate</th><th>Amount</th>
                <th>Rate</th><th>Amount</th>
              </tr>
              @for (item of d.items; track $index) {
                <tr>
                  <td>{{ item.productName }}</td>
                  <td class="c">{{ item.hsnCode }}</td>
                  <td class="c">{{ item.qty }}</td>
                  <td class="n">{{ amt(item.costPerItem) }}</td>
                  <td class="n">{{ amt(item.amount) }}</td>
                  <td class="n">{{ amt(item.cgstRate) }}</td>
                  <td class="n">{{ amt(item.cgstAmount) }}</td>
                  <td class="n">{{ amt(item.sgstRate) }}</td>
                  <td class="n">{{ amt(item.sgstAmount) }}</td>
                  <td class="n">{{ amt(item.igstRate) }}</td>
                  <td class="n">{{ amt(item.igstAmount) }}</td>
                  <td class="n">{{ amt(item.total) }}</td>
                </tr>
              }
              <tr class="einvp-total">
                <td colspan="4" class="einvp-total-label">Total</td>
                <td class="n">{{ amt(d.taxableAmount) }}</td>
                <td></td><td class="n">{{ amt(d.cgstAmount) }}</td>
                <td></td><td class="n">{{ amt(d.sgstAmount) }}</td>
                <td></td><td class="n">{{ amt(d.igstAmount) }}</td>
                <td class="n">{{ amt(d.grandTotal - d.roundOff) }}</td>
              </tr>
            </table>

            <div class="einvp-bottom">
              <div class="einvp-words">
                <div class="einvp-bar einvp-bar--center" style="border-top:0">Total Invoice Amount in Words</div>
                <p>{{ d.amountInWords }}</p>
              </div>
              <div class="einvp-sums">
                <table>
                  <tr><td>Total Amount before Tax</td><td class="n">{{ amt(d.taxableAmount) }}</td></tr>
                  <tr><td>Add: CGST</td><td class="n">{{ amt(d.cgstAmount) }}</td></tr>
                  <tr><td>Add: SGST</td><td class="n">{{ amt(d.sgstAmount) }}</td></tr>
                  <tr><td>Add: IGST</td><td class="n">{{ amt(d.igstAmount) }}</td></tr>
                  <tr><td>Total Tax Amount</td><td class="n">{{ amt(d.taxAmount) }}</td></tr>
                  <tr><td>Total Amount after Tax:</td><td class="n">{{ amt(d.totalAfterTax) }}</td></tr>
                  <tr><td>Sale Discount</td><td class="n">{{ amt(d.discount) }}</td></tr>
                  <tr><td>Round Off</td><td class="n">{{ amt(d.roundOff) }}</td></tr>
                  <tr><td>Grand Total</td><td class="n">{{ amt(d.grandTotal) }}</td></tr>
                </table>
                <div class="einvp-cert">Certified that the particulars given above are true and correct</div>
                <div class="einvp-for">For {{ d.sellerName }}</div>
              </div>
            </div>
          </div>
          <div class="einvp-note">** THIS IS SYSTEM GENERATED E-INVOICE DOES NOT REQUIRED SIGNATURE.</div>
        </div>
      </div>
    }
  </div>
</div>
`
})
export class InventoryEInvoicePrintComponent implements OnInit {
  private readonly transactions = inject(InventoryTransactionsService);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) invoiceId!: number;
  @Input() invoiceNo = '';
  @Output() closed = new EventEmitter<void>();

  @ViewChild('sheet') sheetRef?: ElementRef<HTMLElement>;

  readonly data = signal<EInvoicePrint | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly qrSrc = signal('');
  readonly qrReady = signal(false);

  ngOnInit(): void {
    this.transactions.getEInvoicePrint(this.invoiceId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          const d = res.data ?? null;
          this.data.set(d);
          this.loading.set(false);
          if (!d) { this.error.set(res.message || 'E-invoice not found.'); return; }
          this.buildQr(d.signedQrCode);
        },
        error: err => {
          this.loading.set(false);
          this.error.set(err?.error?.message || 'Unable to load the e-invoice.');
        }
      });
  }

  close(): void {
    this.closed.emit();
  }

  /** Prints only the invoice: its HTML + the same stylesheet in a new window. */
  print(): void {
    const sheet = this.sheetRef?.nativeElement;
    if (!sheet) return;
    const win = window.open('', '_blank', 'width=1000,height=900');
    if (!win) {
      this.error.set('Allow pop-ups for this site to print the e-invoice.');
      return;
    }
    const title = `E-Invoice ${this.data()?.invoiceNo ?? ''}`.replace(/[<>&"]/g, '');
    win.document.open();
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>`
      + `<style>body{margin:12px;background:#fff}${EINVOICE_PRINT_CSS}</style></head>`
      + `<body>${sheet.innerHTML}</body></html>`);
    win.document.close();
    const run = () => { win.focus(); win.print(); };
    // Logo / QR are data URLs, but give the window a moment to lay them out.
    if (win.document.readyState === 'complete') setTimeout(run, 300);
    else win.addEventListener('load', () => setTimeout(run, 300));
  }

  private buildQr(text: string | null): void {
    if (!text) { this.qrReady.set(true); return; }
    toDataURL(text, { errorCorrectionLevel: 'L', margin: 1, width: 360 })
      .then(url => this.qrSrc.set(url))
      .catch(() => this.qrSrc.set(''))
      .finally(() => this.qrReady.set(true));
  }

  // ── Formatting ─────────────────────────────────────────────────────────────

  logoSrc(d: EInvoicePrint): string {
    const logo = (d.sellerLogo || '').trim();
    if (!logo) return '';
    if (/^(data:|https?:|\/|assets\/)/i.test(logo)) return logo;
    return `data:image/png;base64,${logo}`;
  }

  amt(value: number | null | undefined): string {
    return Number(value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  state(name: string | null, code: string | null): string {
    const n = (name || '').trim().toUpperCase();
    return code ? `${n} (${code})`.trim() : n;
  }

  /** 2026-11-10 → 10-Nov-2026 */
  invoiceDate(value: string | null): string {
    const d = this.parse(value);
    if (!d) return value || '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${String(d.day).padStart(2, '0')}-${months[d.month - 1]}-${d.year}`;
  }

  /** 2026-11-10 → 10-11-2026 */
  ackDate(value: string | null): string {
    const d = this.parse(value);
    return d ? `${String(d.day).padStart(2, '0')}-${String(d.month).padStart(2, '0')}-${d.year}` : (value || '');
  }

  private parse(value: string | null): { year: number; month: number; day: number } | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
    return m ? { year: +m[1], month: +m[2], day: +m[3] } : null;
  }
}
