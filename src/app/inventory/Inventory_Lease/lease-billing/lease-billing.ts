import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { InventoryQuickAddModalComponent } from '../../Inventory_Shared/inventory-quick-add-modal/inventory-quick-add-modal.component';
import { InventoryScreenShell } from '../../Inventory_Shared/inventory-screen-shell/inventory-screen-shell';
import { LeaseDateComponent } from '../lease-dialogs';
import { BillingCandidate, BillingPreview, LeaseMeterService } from '../lease-meter.service';
import { leaseBillingConfig } from '../lease-screen-configs';

/* Pick the customer, see the customer's running contracts with the period each one bills next (worked out from
   the contract's billing cycle) and generate the bill from the grid. Everything this screen adds to the shared
   shell is prefixed "bill". */

function isoDate(d: Date): string {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

interface BillRow {
  c: BillingCandidate;
  billTo: string;
  preview: BillingPreview | null;
  info: string;
  busy: boolean;
  open: boolean;
  qty: Record<number, number | null>;
}

@Component({
  selector: 'app-inventory-lease-billing',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NgSelectModule, InventoryScreenShell, InventoryQuickAddModalComponent, LeaseDateComponent],
  template: `
<div class="module-page inventory-page">
  <div class="inventory-shell">
    <app-inventory-screen-shell [config]="config"></app-inventory-screen-shell>

    <section class="inventory-section">
      <div class="inventory-transaction-header">
        @if (bodyFieldByKey('customer'); as field) {
          <div class="erp-form-group inventory-header-col-6">
            <label class="erp-label">{{ field.label }}</label>
            <div class="inventory-field-with-add">
              <ng-select class="erp-ng-select inventory-ng-select" appendTo="body"
                [items]="field.options || []" [searchable]="true" [clearable]="true"
                [ngModel]="billCustomerValue()"
                (ngModelChange)="billPickCustomer($event)"
                placeholder="Search name or phone">
              </ng-select>
              @if (field.addMaster) {
                <button type="button" class="erp-btn btn-white btn-icon" [title]="'Add ' + field.addMaster" (click)="openFieldAddMaster(field)">
                  <i class="pi pi-plus"></i>
                </button>
              }
            </div>
          </div>
        }
        <div class="erp-form-group"><label class="erp-label">Invoice Date</label>
          <app-lease-date [value]="billInvoiceDate" (valueChange)="billInvoiceDate = $event || billInvoiceDate" /></div>
        <div class="erp-form-group"><label class="erp-label">Place of Supply <span class="erp-label-hint">optional</span></label>
          <input class="erp-input" type="text" [(ngModel)]="billPlaceOfSupply" placeholder="Blank = customer's state" /></div>
        <div class="erp-form-group inventory-header-col-6"><label class="erp-label">Note on invoice</label>
          <input class="erp-input" type="text" [(ngModel)]="billRemarks" /></div>
      </div>

      @if (billError()) {
        <div class="inventory-save-error"><span>{{ billError() }}</span>
          <button type="button" class="inventory-alert-close" (click)="billError.set('')" aria-label="Dismiss"><i class="pi pi-times"></i></button></div>
      }
      @if (billMessage()) {
        <div class="inventory-save-msg"><span>{{ billMessage() }}
          @if (billCreated()) { <a routerLink="/dashboard/inventory/transactions/sales-invoice">Open Sales Invoice</a> }</span>
          <button type="button" class="inventory-alert-close" (click)="billMessage.set('')" aria-label="Dismiss"><i class="pi pi-times"></i></button></div>
      }

      <div class="inventory-line-items grn-grid-compact">
        <div class="inventory-line-title">
          <div>
            <strong>Running Contracts</strong>
            <span>The period of each contract comes from its billing cycle. To bill part-way through a cycle, set "Bill up to" to an earlier date (not after today).</span>
          </div>
        </div>
        <div class="tbl-wrap">
          <table class="erp-table compact">
            <thead>
              <tr><th class="text-center">Actions</th><th class="text-center">S.No</th><th>Contract</th><th>Site / Location</th><th>Cycle</th><th>Last billed to</th><th>Bill from</th><th>Bill up to</th><th class="text-end">Amount (before GST)</th><th>Status</th></tr>
            </thead>
            <tbody>
              @for (r of billRows(); track r.c.contract_id; let i = $index) {
                <tr>
                  <td class="text-center">
                    <div class="inventory-row-actions">
                      <button type="button" class="erp-btn btn-primary btn-sm" [disabled]="!billCanGenerate(r)" (click)="billGenerate(r)">
                        <i [class]="r.busy ? 'pi pi-spin pi-spinner' : 'pi pi-file-export'"></i> Generate Bill
                      </button>
                      <button type="button" class="erp-btn btn-white btn-icon btn-sm" title="Details" (click)="r.open = !r.open"><i [class]="r.open ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"></i></button>
                    </div>
                  </td>
                  <td class="text-center">{{ i + 1 }}</td>
                  <td>{{ r.c.contract_no }}</td>
                  <td>{{ r.c.site_name }}</td>
                  <td>{{ r.c.billing_cycle }} / {{ r.c.billing_mode }}</td>
                  <td>{{ r.c.last_billed_to || '-' }}</td>
                  <td>{{ r.c.period_from }}</td>
                  <td style="min-width:150px">
                    <app-lease-date [value]="r.billTo" [minDate]="billParse(r.c.period_from)" (valueChange)="billSetTo(r, $event)" />
                  </td>
                  <td class="text-end">{{ r.preview ? (r.preview.total | number:'1.2-2') : '' }}</td>
                  <td>{{ billStatus(r) }}</td>
                </tr>
                @if (r.open || billNeedsInput(r)) {
                  <tr>
                    <td></td>
                    <td colspan="9">
                      @for (w of (r.preview?.warnings ?? []); track $index) { <div class="inventory-duplicate-advice"><strong>Check</strong><span>{{ w }}</span></div> }
                      @if (r.info) { <div class="inventory-duplicate-advice"><strong>Info</strong><span>{{ r.info }}</span></div> }
                      @for (inp of (r.preview?.rent_inputs ?? []); track inp.asset_id) {
                        <div class="d-flex gap-2 align-items-center mb-1">
                          <span>{{ inp.label }} — rent per {{ inp.unit }} @ {{ inp.rate }}:</span>
                          <input class="erp-input" type="number" min="0" style="width:8rem" placeholder="Quantity"
                            [ngModel]="r.qty[inp.asset_id]" (ngModelChange)="billSetQty(r, inp.asset_id, $event)" />
                        </div>
                      }
                      @if (r.open && r.preview?.lines?.length) {
                        <table class="erp-table compact">
                          <thead><tr><th>Charge</th><th>Description</th><th class="text-end">Qty</th><th class="text-end">Rate</th><th class="text-end">Amount</th></tr></thead>
                          <tbody>
                            @for (l of r.preview!.lines; track $index) {
                              <tr><td>{{ l.product_name }}</td><td>{{ l.description }}</td><td class="text-end">{{ l.qty }}</td><td class="text-end">{{ l.rate | number:'1.2-4' }}</td><td class="text-end">{{ l.amount | number:'1.2-2' }}</td></tr>
                            }
                          </tbody>
                        </table>
                      }
                    </td>
                  </tr>
                }
              } @empty {
                <tr><td colspan="10" class="text-center">{{ billCustomerId() ? 'No running contracts for this customer.' : 'Select a customer to see their running contracts.' }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="inventory-section">
      <div class="inventory-section-title">
        <div><h3>Billing History</h3><p>{{ billCustomerId() ? 'Bills of the selected customer.' : 'All lease bills.' }}</p></div>
        <button type="button" class="erp-btn btn-white" (click)="billLoadBills()"><i class="pi pi-refresh"></i> Refresh</button>
      </div>
      <div class="tbl-wrap">
        <table class="erp-table compact">
          <thead><tr><th>Contract</th><th>Customer</th><th>Period</th><th class="text-end">Amount</th><th>Invoice</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            @for (b of billHistory(); track b.id) {
              <tr>
                <td>{{ b.contract_no }}</td><td>{{ b.customer_name }}</td><td>{{ b.period_from }} → {{ b.period_to }}</td>
                <td class="text-end">{{ b.total_amount | number:'1.2-2' }}</td>
                <td>{{ b.invoice_number || '-' }} {{ b.invoice_status ? '(' + b.invoice_status + ')' : '' }}</td>
                <td>{{ b.status }}</td>
                <td>@if (b.status !== 'cancelled') { <button type="button" class="erp-btn btn-white btn-sm" (click)="billRelease(b)">Release</button> }</td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="text-center">No bills yet.</td></tr>
            }
          </tbody>
        </table>
      </div>
      <div class="inventory-optional-hint">Release is available only after the linked invoice is cancelled; it frees the readings and the period so they can be billed again.</div>
    </section>
  </div>
</div>

<app-inventory-quick-add-modal [host]="quickAddHost"></app-inventory-quick-add-modal>`
})
export class InventoryLeaseBillingComponent extends InventoryScreenShell implements OnInit {
  override readonly config = leaseBillingConfig;

  private readonly billApi = inject(LeaseMeterService);

  readonly billRows = signal<BillRow[]>([]);
  readonly billBills = signal<any[]>([]);
  readonly billError = signal('');
  readonly billMessage = signal('');
  readonly billCreated = signal(false);
  readonly billCustomerId = signal<number | null>(null);
  private readonly billCustomerName = signal('');
  readonly billHistory = computed(() => {
    const id = this.billCustomerId();
    const all = this.billBills();
    return id ? all.filter(b => b.customer_name === this.billCustomerName()) : all;
  });

  billInvoiceDate = isoDate(new Date());
  billPlaceOfSupply = '';
  billRemarks = '';

  override ngOnInit(): void {
    super.ngOnInit();
    this.billLoadBills();
  }

  billParse(v: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v ?? '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }

  // ── customer: same picker as the Sales screens ─────────────────────────
  billCustomerValue(): string | null {
    const v = this.formValues()['customer'];
    return v ? String(v) : null;
  }

  billPickCustomer(value: string | null): void {
    this.collectFormField('customer', value ?? '');
    const customer = value ? this.findCustomerBySelection(value) : null;
    this.billCustomerId.set(customer?.id ?? null);
    this.billCustomerName.set(customer?.customer_name ?? '');
    this.billMessage.set(''); this.billError.set('');
    this.billRows.set([]);
    if (customer?.id) this.billLoadCandidates(customer.id);
  }

  // ── contracts of the customer ──────────────────────────────────────────
  private billLoadCandidates(customerId: number): void {
    this.billApi.getBillingCandidates(customerId).subscribe({
      next: res => {
        const rows: BillRow[] = (res.data ?? []).map(c => ({
          c: { ...c, period_from: String(c.period_from).slice(0, 10), cycle_to: String(c.cycle_to).slice(0, 10), max_to: String(c.max_to).slice(0, 10) },
          billTo: String(c.cycle_to).slice(0, 10), preview: null, info: '', busy: false, open: false, qty: {}
        }));
        this.billRows.set(rows);
        rows.forEach(r => this.billPreview(r));
      },
      error: err => this.billError.set(LeaseMeterService.errorMessage(err))
    });
  }

  billSetTo(r: BillRow, to: string | null): void {
    if (!to) return;
    r.billTo = to;
    this.billPreview(r);
  }

  billSetQty(r: BillRow, assetId: number, value: any): void {
    r.qty[assetId] = value === '' || value === null ? null : Number(value);
    this.billPreview(r);
  }

  private billQtyPayload(r: BillRow): Record<number, number> {
    const out: Record<number, number> = {};
    for (const [k, v] of Object.entries(r.qty)) if (v !== null && v !== undefined && Number(v) > 0) out[+k] = Number(v);
    return out;
  }

  /** The bill of this row for its period (shown as the amount); a period that is not due yet gets an explanation instead. */
  billPreview(r: BillRow): void {
    r.preview = null; r.info = '';
    if (r.billTo < r.c.period_from) { r.info = 'The "Bill up to" date is before the start of the period.'; return; }
    if (r.billTo > r.c.max_to) {
      r.info = `This cycle ends on ${r.c.cycle_to} and bills in arrears. Set "Bill up to" on or before ${r.c.max_to} to bill part of the cycle now.`;
      return;
    }
    r.busy = true;
    this.billApi.previewBilling(r.c.contract_id, r.c.period_from, r.billTo, this.billQtyPayload(r)).subscribe({
      next: res => { r.busy = false; r.preview = res.data ?? null; },
      error: err => { r.busy = false; r.info = LeaseMeterService.errorMessage(err); }
    });
  }

  billNeedsInput(r: BillRow): boolean {
    return !!r.preview?.rent_inputs?.some(i => !(Number(r.qty[i.asset_id]) > 0)) || !!r.info;
  }

  billStatus(r: BillRow): string {
    if (r.busy) return 'Checking...';
    if (!r.preview) return r.info ? (r.billTo > r.c.max_to ? `Not due until ${r.c.cycle_to}` : 'Cannot bill') : '';
    if (r.preview.rent_inputs?.some(i => !(Number(r.qty[i.asset_id]) > 0))) return 'Enter quantity';
    if (!r.preview.lines.length) return 'Nothing to bill';
    return r.billTo < r.c.cycle_to ? 'Part of cycle' : 'Ready';
  }

  billCanGenerate(r: BillRow): boolean {
    return !r.busy && !!r.preview && r.preview.lines.length > 0 && !r.preview.rent_inputs?.some(i => !(Number(r.qty[i.asset_id]) > 0));
  }

  billGenerate(r: BillRow): void {
    const p = r.preview;
    if (!p || !this.billCanGenerate(r)) return;
    if (!confirm(`Create the bill for ${p.contract_no} (${p.period_from} to ${p.period_to}) totalling ${p.total.toFixed(2)} and a draft invoice?`)) return;
    this.billError.set(''); this.billMessage.set(''); this.billCreated.set(false);
    r.busy = true;
    this.billApi.generateBill({
      contractId: p.contract_id, periodFrom: p.period_from, periodTo: p.period_to, expectedTotal: p.total,
      rentQuantities: this.billQtyPayload(r), invoiceDate: this.billInvoiceDate,
      placeOfSupply: this.billPlaceOfSupply.trim() || undefined, remarks: this.billRemarks.trim() || undefined
    }).subscribe({
      next: res => {
        r.busy = false;
        this.billCreated.set(true);
        this.billMessage.set(`Bill created for ${p.contract_no}. Draft invoice ${res.data?.invoice_number ?? ''} is ready for review.`);
        this.billLoadBills();
        const id = this.billCustomerId();
        if (id) this.billLoadCandidates(id);
      },
      error: err => { r.busy = false; this.billError.set(LeaseMeterService.errorMessage(err)); }
    });
  }

  // ── history ────────────────────────────────────────────────────────────
  billLoadBills(): void {
    this.billApi.getBills().subscribe({ next: res => this.billBills.set(res.data ?? []), error: () => {} });
  }

  billRelease(b: any): void {
    if (!confirm(`Release the bill for ${b.contract_no} (${b.period_from} to ${b.period_to})?`)) return;
    this.billError.set(''); this.billMessage.set(''); this.billCreated.set(false);
    this.billApi.releaseBill(b.id).subscribe({
      next: () => {
        this.billMessage.set('Bill released. The readings and the period can be billed again.');
        this.billLoadBills();
        const id = this.billCustomerId();
        if (id) this.billLoadCandidates(id);
      },
      error: err => this.billError.set(LeaseMeterService.errorMessage(err))
    });
  }
}
