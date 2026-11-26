import { createInventoryToast } from '../../Inventory_Shared/inventory-save-toast/inventory-save-toast.component';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { forkJoin } from 'rxjs';
import { InventoryScreenShell } from '../../Inventory_Shared/inventory-screen-shell/inventory-screen-shell';
import { LeaseDateComponent } from '../lease-dialogs';
import { meterReadingConfig } from '../lease-screen-configs';
import { LeaseContract, LeaseMeter, LeaseMeterService, MeterReading } from '../lease-meter.service';

const TYPE_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'estimated', label: 'Estimated' },
  { value: 'usage', label: 'Usage quantity (no counter)' },
  { value: 'reset', label: 'Meter reset (restarted)' },
  { value: 'replacement', label: 'Meter replaced' }
];

/** One row of the entry grid = one meter item of the contract. */
interface ReadingRow {
  meter: LeaseMeter;
  value: number | null;
  type: string;
  baseline: number | null;
  remarks: string;
  /** Set while the meter's latest saved reading is being corrected. */
  editId?: number;
}

function today(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

@Component({
  selector: 'app-inventory-meter-readings',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule, LeaseDateComponent, InventoryScreenShell],
  host: { class: 'd-block' },
  template: `
@if (embedded) {
  <ng-container *ngTemplateOutlet="entry"></ng-container>
} @else {
  <div class="module-page inventory-page">
    <div class="inventory-shell">
      <app-inventory-screen-shell [config]="config"></app-inventory-screen-shell>
      <ng-container *ngTemplateOutlet="entry"></ng-container>
      <ng-container *ngTemplateOutlet="history"></ng-container>
    </div>
  </div>
}

<ng-template #entry>
    <section class="inventory-section">
      <div class="inventory-transaction-header">
        <div class="erp-form-group inventory-header-col-6">
          <label class="erp-label">Contract <span class="text-danger">*</span></label>
          <ng-select class="erp-ng-select inventory-ng-select" appendTo="body" [items]="contractOptions()" bindLabel="label" bindValue="id"
            [searchable]="true" [clearable]="true" [ngModel]="contractId()" (ngModelChange)="selectContract($event)" placeholder="Search contract or customer"></ng-select>
        </div>
        <div class="erp-form-group">
          <label class="erp-label">Reading Date <span class="text-danger">*</span></label>
          <app-lease-date [value]="date" (valueChange)="date = $event || date" [maxDate]="maxDate" />
        </div>
      </div>

      <div class="inventory-section-title">
        <div><h3>Meter Readings</h3>
          <p>{{ contractId() ? 'Every meter item of the contract is listed. Enter the counter now showing for each one and save.' : 'Select a contract to load its meter items.' }}</p></div>
      </div>
      <div class="tbl-wrap">
        <table class="erp-table compact">
          <thead><tr><th class="text-center">Actions</th><th class="text-center">S.No</th><th>Meter item</th><th>Unit</th><th>Previous</th><th style="width:150px">New Reading</th><th>Usage</th><th style="width:190px">Type</th><th>Remarks</th></tr></thead>
          <tbody>
            @for (r of rows(); track r.meter.id; let i = $index) {
              <tr [class.sel]="!!r.editId">
                <td class="text-center">
                  <div class="inventory-row-actions">
                    @if (r.editId) {
                      <button type="button" class="erp-btn btn-white btn-icon btn-sm" title="Cancel correction" (click)="cancelEdit(r)"><i class="pi pi-times"></i></button>
                    } @else {
                      <button type="button" class="erp-btn btn-white btn-icon btn-sm" title="Correct the last reading" [disabled]="!editableOf(r.meter)" (click)="editLast(r)"><i class="pi pi-pencil"></i></button>
                    }
                  </div>
                </td>
                <td class="text-center">{{ i + 1 }}</td>
                <td><strong>{{ meterName(r.meter) }}</strong>
                  @if (r.meter.asset_ref) { <br><small class="text-muted">{{ r.meter.asset_ref }}</small> }</td>
                <td>{{ r.meter.unit_name }}</td>
                <td>{{ r.type === 'usage' ? '-' : previousOf(r.meter, r.editId) }}</td>
                <td>
                  <input class="erp-input" type="number" min="0" [(ngModel)]="r.value" [attr.aria-label]="'Reading for ' + meterName(r.meter)" />
                  @if (r.type === 'reset' || r.type === 'replacement') {
                    <input class="erp-input mt-1" type="number" min="0" [(ngModel)]="r.baseline" placeholder="New meter started at" />
                  }
                </td>
                <td><strong>{{ usageOf(r) }}</strong></td>
                <td><ng-select class="erp-ng-select inventory-ng-select" appendTo="body" [items]="typeOptions" bindLabel="label" bindValue="value"
                  [searchable]="false" [clearable]="false" [(ngModel)]="r.type"></ng-select></td>
                <td><input class="erp-input" type="text" [(ngModel)]="r.remarks" /></td>
              </tr>
            } @empty {
              <tr><td colspan="9" class="text-center">{{ contractId() ? 'This contract has no meter items.' : 'No contract selected.' }}</td></tr>
            }
          </tbody>
        </table>
      </div>

      <div class="inventory-form-actions">
        <button type="button" class="erp-btn btn-white" (click)="resetRows()"><i class="pi pi-times"></i> Clear</button>
        @if (!embedded) {
          <button type="button" class="erp-btn btn-white" (click)="goBilling()"><i class="pi pi-file"></i> Go to Lease Billing</button>
        }
        <button type="button" class="erp-btn btn-primary" [disabled]="busy() || !rows().length" (click)="save()">
          <i [class]="busy() ? 'pi pi-spin pi-spinner' : 'pi pi-save'"></i> Save Readings
        </button>
      </div>
    </section>
</ng-template>

<ng-template #history>
    <section class="inventory-section">
      <div class="inventory-section-title">
        <div><h3>Reading History</h3><p>Saved readings are verified automatically and are ready for billing. Use the pencil to correct the latest reading of a meter that is not billed yet.</p></div>
      </div>
      <div class="tbl-wrap">
        <table class="erp-table compact">
          <thead><tr><th class="text-center">Actions</th><th>Date</th><th>Meter</th><th>Previous</th><th>Reading</th><th>Usage</th><th>Type</th><th>Status</th></tr></thead>
          <tbody>
            @for (r of readings(); track r.id) {
              <tr [style.opacity]="r.status === 'void' ? 0.5 : 1">
                <td class="text-center">
                  <div class="inventory-row-actions">
                    <button type="button" class="erp-btn btn-white btn-icon btn-sm" title="Edit" [disabled]="!canEditReading(r)" (click)="editReading(r)"><i class="pi pi-pencil"></i></button>
                    @if (r.status === 'draft') {
                      <button type="button" class="erp-btn btn-white btn-icon btn-sm" title="Verify" (click)="verifyOne(r)"><i class="pi pi-check-circle"></i></button>
                    }
                  </div>
                </td>
                <td>{{ r.reading_date }}</td><td>{{ r.meter_label }} ({{ r.unit_name }})</td>
                <td>{{ r.previous_value }}</td><td>{{ r.reading_value }}</td><td><strong>{{ r.usage_qty }}</strong></td>
                <td>{{ r.reading_type }}</td><td>{{ r.status }}</td>
              </tr>
            } @empty {
              <tr><td colspan="8" class="text-center">No readings.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>
</ng-template>`
})
export class InventoryMeterReadingsComponent implements OnInit {
  readonly config = meterReadingConfig;
  private readonly api = inject(LeaseMeterService);
  private readonly router = inject(Router);

  /** Shown inside Lease Billing: no page frame, no guide, no history grid. */
  @Input() embedded = false;
  /** Embedded only: the contracts offered are those of this customer. */
  @Input() set customerId(value: number | null | undefined) {
    const next = value ?? null;
    if (next === this.customerFilter()) return;
    this.customerFilter.set(next);
    this.selectContract(null);
    this.autoSelect();
  }
  /** Raised after readings are saved, so the host can refresh what is ready to invoice. */
  @Output() saved = new EventEmitter<void>();

  private readonly customerFilter = signal<number | null>(null);

  readonly typeOptions = TYPE_OPTIONS;
  readonly maxDate = new Date();
  readonly contracts = signal<LeaseContract[]>([]);
  readonly contractId = signal<number | null>(null);
  readonly rows = signal<ReadingRow[]>([]);
  readonly readings = signal<MeterReading[]>([]);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');

  // Messages are raised as the shared bottom-right toast (timed, with an X) and kept in the signals.
  private readonly pageToast = createInventoryToast();
  private pageFail(m: string): void { this.error.set(m); this.pageToast.error(m); }
  private pageNote(m: string): void { this.message.set(m); this.pageToast.success(m); }

  readonly contractOptions = computed(() => {
    const customer = this.customerFilter();
    const list = this.embedded && customer ? this.contracts().filter(c => c.customer_id === customer) : this.contracts();
    return list.map(c => ({
      id: c.id, label: `${c.contract_no} - ${c.customer_name}${c.lease_items ? ' - ' + c.lease_items : ''}`
    }));
  });

  date = today();

  ngOnInit(): void {
    this.api.getContracts().subscribe({
      next: res => {
        this.contracts.set((res.data ?? []).filter(c => c.status === 'active' || c.status === 'suspended' || c.status === 'draft'));
        this.autoSelect();
      },
      error: err => this.pageFail(LeaseMeterService.errorMessage(err))
    });
  }

  /** Inside billing a customer with a single contract needs no picking. */
  private autoSelect(): void {
    if (!this.embedded || !this.customerFilter() || this.contractId()) return;
    const options = this.contractOptions();
    if (options.length === 1) this.selectContract(options[0].id ?? null);
  }

  /** Opens a contract's meters in the entry grid (used by the host screen). */
  openContract(id: number): void { this.selectContract(id); }

  meterName(m: LeaseMeter): string {
    const base = m.meter_label || m.meter_name || m.charge_product_name || 'Meter';
    const extra = [m.variant_name, m.attribute_value].filter(x => !!x && !base.includes(String(x)));
    return extra.length ? `${base} - ${extra.join(' / ')}` : base;
  }

  /** Counter value this meter continues from: the latest non-void reading, else its opening reading.
   *  A reading being corrected is left out, so the correction continues from the one before it. */
  previousOf(m: LeaseMeter, excludeId?: number): number {
    const list = this.readings().filter(r => r.lease_meter_id === m.id && r.status !== 'void' && r.reading_type !== 'usage' && r.id !== excludeId);
    if (!list.length) return Number(m.opening_reading ?? 0);
    const last = list.reduce((a, b) => (String(a.reading_date) >= String(b.reading_date) ? a : b));
    return Number(last.reading_value);
  }

  /** A meter whose last entry was a usage quantity keeps asking for a usage quantity. */
  defaultTypeOf(m: LeaseMeter): string {
    const list = this.readings().filter(r => r.lease_meter_id === m.id && r.status !== 'void');
    if (!list.length) return 'normal';
    const last = list.reduce((a, b) => (String(a.reading_date) >= String(b.reading_date) ? a : b));
    return last.reading_type === 'usage' ? 'usage' : 'normal';
  }

  /** Live usage for a normal / estimated reading; a reset or replaced meter is worked out on save. */
  usageOf(r: ReadingRow): string {
    if (r.value === null || r.value === undefined || (r.value as any) === '') return '';
    if (r.type === 'usage') return String(Number(r.value));
    if (r.type === 'reset' || r.type === 'replacement') return 'on save';
    const u = Number(r.value) - this.previousOf(r.meter, r.editId);
    return u < 0 ? 'lower than previous' : String(u);
  }

  // ── correcting the latest reading (instead of voiding it) ─────────────────
  /** The meter's latest live reading, when it can still be corrected (not billed). */
  private latestEditable(meterId: number | undefined): MeterReading | null {
    const live = this.readings().filter(r => r.lease_meter_id === meterId && r.status !== 'void');
    if (!live.length) return null;
    const last = live.reduce((a, b) => (String(a.reading_date) >= String(b.reading_date) ? a : b));
    return last.status === 'draft' || last.status === 'verified' ? last : null;
  }
  editableOf(m: LeaseMeter): boolean { return !!this.latestEditable(m.id); }
  canEditReading(r: MeterReading): boolean { return this.latestEditable(r.lease_meter_id)?.id === r.id; }

  editLast(row: ReadingRow): void {
    const reading = this.latestEditable(row.meter.id);
    if (!reading) return;
    this.rows.update(list => list.map(r => r === row
      ? { ...r, editId: reading.id, value: Number(reading.reading_value), type: reading.reading_type, baseline: reading.baseline_value ?? null, remarks: reading.remarks ?? '' }
      : r));
    this.date = String(reading.reading_date).slice(0, 10);
  }

  cancelEdit(row: ReadingRow): void {
    this.rows.update(list => list.map(r => r === row
      ? { ...r, editId: undefined, value: null, type: this.defaultTypeOf(r.meter), baseline: null, remarks: '' }
      : r));
    this.date = today();
  }

  /** From the history grid: load that reading into its meter's row above. */
  editReading(reading: MeterReading): void {
    const row = this.rows().find(r => r.meter.id === reading.lease_meter_id);
    if (!row || !this.canEditReading(reading)) return;
    this.editLast(row);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  selectContract(id: number | null): void {
    this.contractId.set(id);
    this.rows.set([]); this.readings.set([]);
    this.error.set(''); this.message.set('');
    this.date = today();
    if (!id) return;
    this.api.getContract(id).subscribe({
      next: res => this.rows.set((res.data?.meters ?? []).filter(m => m.status !== 'inactive')
        .map(m => ({ meter: m, value: null, type: this.defaultTypeOf(m), baseline: null, remarks: '' }))),
      error: err => this.pageFail(LeaseMeterService.errorMessage(err))
    });
    this.loadReadings();
  }

  loadReadings(): void {
    const id = this.contractId();
    if (!id) return;
    this.api.getReadings({ contractId: id }).subscribe({
      next: res => {
        this.readings.set(res.data ?? []);
        this.rows.update(list => list.map(r => (r.value === null || r.value === undefined) ? { ...r, type: this.defaultTypeOf(r.meter) } : r));
      },
      error: err => this.pageFail(LeaseMeterService.errorMessage(err))
    });
  }

  resetRows(): void {
    this.rows.update(list => list.map(r => ({ ...r, editId: undefined, value: null, type: this.defaultTypeOf(r.meter), baseline: null, remarks: '' })));
    this.error.set(''); this.message.set(''); this.date = today();
  }

  /** Saves every row that has a reading, verifies new ones so they are billable, and refreshes the grid. */
  save(): void {
    this.error.set(''); this.message.set('');
    const filled = this.rows().filter(r => r.value !== null && r.value !== undefined && (r.value as any) !== '');
    if (!filled.length) { this.pageFail('Enter at least one meter reading.'); return; }
    for (const r of filled) {
      const prev = this.previousOf(r.meter, r.editId);
      if ((r.type === 'normal' || r.type === 'estimated') && Number(r.value) < prev) {
        this.pageFail(`${this.meterName(r.meter)}: the reading ${r.value} is lower than the previous ${prev}. Choose "Meter reset" or "Meter replaced" if the counter restarted.`);
        return;
      }
    }
    this.busy.set(true);
    forkJoin(filled.map(r => this.api.saveReading({
      id: r.editId, lease_meter_id: r.meter.id, reading_date: this.date, reading_value: Number(r.value), reading_type: r.type,
      baseline_value: r.type === 'reset' || r.type === 'replacement' ? (r.baseline ?? 0) : undefined,
      remarks: r.remarks.trim() || undefined
    }))).subscribe({
      next: results => {
        // a corrected reading that was already verified stays verified; everything else is verified now
        const toVerify = results.filter(x => !!x.data?.id && x.data?.status !== 'verified').map(x => x.data!.id);
        const done = () => {
          this.busy.set(false);
          this.resetRows();
          this.pageNote(`${results.length} reading(s) saved and verified. They are ready for billing.`);
          this.loadReadings();
          this.saved.emit();
        };
        if (!toVerify.length) { done(); return; }
        this.api.verifyReadings(toVerify).subscribe({
          next: () => done(),
          error: err => { this.busy.set(false); this.pageFail('Saved, but verification failed: ' + LeaseMeterService.errorMessage(err)); this.loadReadings(); }
        });
      },
      error: err => { this.busy.set(false); this.pageFail(LeaseMeterService.errorMessage(err)); this.loadReadings(); }
    });
  }

  goBilling(): void { this.router.navigate(['/dashboard/inventory/lease/billing']); }

  verifyOne(r: MeterReading): void {
    this.error.set(''); this.message.set('');
    this.busy.set(true);
    this.api.verifyReadings([r.id]).subscribe({
      next: () => { this.busy.set(false); this.pageNote('Reading verified.'); this.loadReadings(); this.saved.emit(); },
      error: err => { this.busy.set(false); this.pageFail(LeaseMeterService.errorMessage(err)); }
    });
  }
}
