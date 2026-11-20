import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { InventoryScreenShell } from '../../Inventory_Shared/inventory-screen-shell/inventory-screen-shell';
import { LeaseDateComponent } from '../lease-dialogs';
import { meterReadingConfig } from '../lease-screen-configs';
import { LeaseContract, LeaseMeter, LeaseMeterService, MeterReading } from '../lease-meter.service';

const TYPE_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'estimated', label: 'Estimated' },
  { value: 'reset', label: 'Meter reset (restarted)' },
  { value: 'replacement', label: 'Meter replaced' }
];

function today(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

@Component({
  selector: 'app-inventory-meter-readings',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule, LeaseDateComponent, InventoryScreenShell],
  template: `
<div class="module-page inventory-page">
  <div class="inventory-shell">
    <app-inventory-screen-shell [config]="config"></app-inventory-screen-shell>

    <section class="inventory-section">
      <div class="inventory-transaction-header">
        <div class="erp-form-group inventory-header-col-6">
          <label class="erp-label">Contract <span class="text-danger">*</span></label>
          <ng-select class="erp-ng-select inventory-ng-select" appendTo="body" [items]="contractOptions()" bindLabel="label" bindValue="id"
            [searchable]="true" [clearable]="true" [ngModel]="contractId()" (ngModelChange)="selectContract($event)" placeholder="Search contract or customer"></ng-select>
        </div>
        <div class="erp-form-group inventory-header-col-6">
          <label class="erp-label">Meter <span class="text-danger">*</span></label>
          <ng-select class="erp-ng-select inventory-ng-select" appendTo="body" [items]="meterOptions()" bindLabel="label" bindValue="id"
            [searchable]="true" [clearable]="false" [(ngModel)]="meterId" [disabled]="!!editId || !contractId()" placeholder="Select meter"></ng-select>
          @if (lastReading(); as l) { <small class="inventory-field-hint">Last reading: <strong>{{ l.reading_value }}</strong> on {{ l.reading_date }}</small> }
          @else if (meterId) { <small class="inventory-field-hint">No reading yet - usage starts from the opening reading.</small> }
        </div>
        <div class="erp-form-group">
          <label class="erp-label">Reading Date <span class="text-danger">*</span></label>
          <app-lease-date [value]="date" (valueChange)="date = $event || date" [maxDate]="maxDate" />
        </div>
        <div class="erp-form-group">
          <label class="erp-label">Meter Reading <span class="text-danger">*</span></label>
          <input class="erp-input" type="number" min="0" [(ngModel)]="value" />
        </div>
        <div class="erp-form-group">
          <label class="erp-label">Type</label>
          <ng-select class="erp-ng-select inventory-ng-select" appendTo="body" [items]="typeOptions" bindLabel="label" bindValue="value"
            [searchable]="false" [clearable]="false" [(ngModel)]="type"></ng-select>
        </div>
        @if (type === 'reset' || type === 'replacement') {
          <div class="erp-form-group">
            <label class="erp-label">New meter started at</label>
            <input class="erp-input" type="number" min="0" [(ngModel)]="baseline" placeholder="0" />
          </div>
        }
        <div class="erp-form-group inventory-header-col-6">
          <label class="erp-label">Remarks</label>
          <input class="erp-input" type="text" [(ngModel)]="remarks" />
        </div>
      </div>

      @if (error()) {
        <div class="inventory-save-error"><span>{{ error() }}</span>
          <button type="button" class="inventory-alert-close" (click)="error.set('')" aria-label="Dismiss"><i class="pi pi-times"></i></button></div>
      }
      @if (message()) {
        <div class="inventory-save-msg"><span>{{ message() }}</span>
          <button type="button" class="inventory-alert-close" (click)="message.set('')" aria-label="Dismiss"><i class="pi pi-times"></i></button></div>
      }

      <div class="inventory-form-actions">
        <button type="button" class="erp-btn btn-white" (click)="clearForm()"><i class="pi pi-times"></i> Clear</button>
        <button type="button" class="erp-btn btn-primary" [disabled]="busy() || !contractId()" (click)="save()">
          <i [class]="busy() ? 'pi pi-spin pi-spinner' : 'pi pi-save'"></i> {{ editId ? 'Update Reading' : 'Save Reading' }}
        </button>
      </div>
    </section>

    <section class="inventory-section">
      <div class="inventory-section-title">
        <div><h3>Readings</h3><p>{{ contractId() ? 'Readings of the selected contract. Verify draft readings so they can be billed.' : 'Select a contract to see its readings.' }}</p></div>
        <button type="button" class="erp-btn btn-primary" [disabled]="!selectedIds().length || busy()" (click)="verify()"><i class="pi pi-check-circle"></i> Verify selected ({{ selectedIds().length }})</button>
      </div>
      <div class="tbl-wrap">
        <table class="erp-table compact">
          <thead><tr><th></th><th>Date</th><th>Meter</th><th>Previous</th><th>Reading</th><th>Usage</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            @for (r of readings(); track r.id) {
              <tr [style.opacity]="r.status === 'void' ? 0.5 : 1">
                <td>@if (r.status === 'draft') { <input type="checkbox" [checked]="isSelected(r.id)" (change)="toggle(r.id)" /> }</td>
                <td>{{ r.reading_date }}</td><td>{{ r.meter_label }} ({{ r.unit_name }})</td>
                <td>{{ r.previous_value }}</td><td>{{ r.reading_value }}</td><td><strong>{{ r.usage_qty }}</strong></td>
                <td>{{ r.reading_type }}</td><td>{{ r.status }}</td>
                <td class="d-flex gap-1">
                  @if (r.status === 'draft') { <button type="button" class="erp-btn btn-white btn-sm" (click)="edit(r)"><i class="pi pi-pencil"></i> Edit</button> }
                  @if (r.status === 'draft' || r.status === 'verified') { <button type="button" class="erp-btn btn-white btn-sm" (click)="voidReading(r)">Void</button> }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="9" class="text-center">No readings.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  </div>
</div>`
})
export class InventoryMeterReadingsComponent implements OnInit {
  readonly config = meterReadingConfig;
  private readonly api = inject(LeaseMeterService);

  readonly typeOptions = TYPE_OPTIONS;
  readonly maxDate = new Date();
  readonly contracts = signal<LeaseContract[]>([]);
  readonly contractId = signal<number | null>(null);
  readonly meters = signal<LeaseMeter[]>([]);
  readonly readings = signal<MeterReading[]>([]);
  readonly selectedIds = signal<number[]>([]);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');

  readonly contractOptions = computed(() => this.contracts().map(c => ({
    id: c.id, label: `${c.contract_no} - ${c.customer_name}${c.site_name ? ' (' + c.site_name + ')' : ''}`
  })));
  readonly meterOptions = computed(() => this.meters().map(m => ({ id: m.id, label: this.meterName(m) })));

  editId: number | null = null;
  meterId: number | null = null;
  date = today();
  value: number | null = null;
  type = 'normal';
  baseline: number | null = null;
  remarks = '';

  ngOnInit(): void {
    this.api.getContracts().subscribe({
      next: res => this.contracts.set((res.data ?? []).filter(c => c.status === 'active' || c.status === 'suspended' || c.status === 'draft')),
      error: err => this.error.set(LeaseMeterService.errorMessage(err))
    });
  }

  meterName(m: LeaseMeter): string { return `${m.meter_label || m.meter_name} (${m.unit_name})`; }

  /** Latest non-void reading of the selected meter, so the user sees what to continue from. */
  lastReading(): MeterReading | null {
    if (!this.meterId) return null;
    const list = this.readings().filter(r => r.lease_meter_id === this.meterId && r.status !== 'void' && r.id !== this.editId);
    return list.length ? list.reduce((a, b) => (String(a.reading_date) >= String(b.reading_date) ? a : b)) : null;
  }

  selectContract(id: number | null): void {
    this.contractId.set(id);
    this.meters.set([]); this.readings.set([]); this.selectedIds.set([]);
    this.meterId = null;
    this.clearForm();
    if (!id) return;
    this.api.getContract(id).subscribe({
      next: res => {
        const list = (res.data?.meters ?? []).filter(m => m.status !== 'inactive');
        this.meters.set(list);
        if (list.length === 1) this.meterId = list[0].id ?? null;
      },
      error: err => this.error.set(LeaseMeterService.errorMessage(err))
    });
    this.loadReadings();
  }

  loadReadings(): void {
    const id = this.contractId();
    if (!id) return;
    this.api.getReadings({ contractId: id }).subscribe({
      next: res => this.readings.set(res.data ?? []),
      error: err => this.error.set(LeaseMeterService.errorMessage(err))
    });
  }

  clearForm(): void {
    this.editId = null; this.value = null; this.type = 'normal'; this.baseline = null; this.remarks = ''; this.date = today();
    this.error.set(''); this.message.set('');
  }

  edit(r: MeterReading): void {
    this.editId = r.id; this.meterId = r.lease_meter_id; this.date = String(r.reading_date).slice(0, 10);
    this.value = r.reading_value; this.type = r.reading_type; this.baseline = r.baseline_value ?? null; this.remarks = r.remarks ?? '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  save(): void {
    this.error.set(''); this.message.set('');
    if (!this.meterId || this.value === null || this.value === undefined) { this.error.set('Select a meter and enter the reading.'); return; }
    this.busy.set(true);
    this.api.saveReading({
      id: this.editId ?? undefined, lease_meter_id: this.meterId, reading_date: this.date, reading_value: Number(this.value),
      reading_type: this.type, baseline_value: this.type === 'reset' || this.type === 'replacement' ? (this.baseline ?? 0) : undefined,
      remarks: this.remarks.trim() || undefined
    }).subscribe({
      next: res => {
        this.busy.set(false);
        const keepMeter = this.meterId;
        this.clearForm();
        this.meterId = keepMeter;
        this.message.set(`Reading saved: usage ${res.data?.usage_qty ?? ''}.`);
        this.loadReadings();
      },
      error: err => { this.busy.set(false); this.error.set(LeaseMeterService.errorMessage(err)); }
    });
  }

  isSelected(id: number): boolean { return this.selectedIds().includes(id); }
  toggle(id: number): void {
    this.selectedIds.update(list => list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
  }

  verify(): void {
    this.error.set(''); this.message.set('');
    this.busy.set(true);
    this.api.verifyReadings(this.selectedIds()).subscribe({
      next: res => { this.busy.set(false); this.message.set(`${res.data?.verified ?? 0} reading(s) verified.`); this.selectedIds.set([]); this.loadReadings(); },
      error: err => { this.busy.set(false); this.error.set(LeaseMeterService.errorMessage(err)); }
    });
  }

  voidReading(r: MeterReading): void {
    if (!confirm(`Void the reading of ${r.reading_value} dated ${r.reading_date}?`)) return;
    this.error.set(''); this.message.set('');
    this.api.voidReading(r.id).subscribe({
      next: () => { this.message.set('Reading voided.'); this.loadReadings(); },
      error: err => this.error.set(LeaseMeterService.errorMessage(err))
    });
  }
}
