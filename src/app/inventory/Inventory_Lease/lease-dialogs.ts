import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { DatePickerModule } from 'primeng/datepicker';
import { LeaseRate } from './lease-meter.service';

/* Popups used by the lease screens: pick an asset / service item, edit rates & slabs, return an asset.
   Same modal markup/classes as the Inventory transaction screens. Adding a customer, UOM or any other
   master goes through the shared quick-add modal; adding a product goes through the same Product Master
   trip the transaction line pickers use. */

function iso(d: Date | null): string | null {
  if (!d) return null;
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}
function parse(v: string | null | undefined): Date | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

// ── date field (same date picker as the transaction headers) ────────────────
@Component({
  selector: 'app-lease-date',
  standalone: true,
  imports: [FormsModule, DatePickerModule],
  template: `
<div class="inventory-date-wrap">
  <p-datepicker [ngModel]="date" (ngModelChange)="onChange($event)" [ngModelOptions]="{ standalone: true }"
    [minDate]="minDate" [maxDate]="maxDate" dateFormat="dd-M-yy" placeholder="DD-MMM-YYYY"
    [readonlyInput]="true" [showIcon]="false" appendTo="body" [disabled]="disabled"
    styleClass="w-100" inputStyleClass="erp-input inventory-date-input w-100">
  </p-datepicker>
  <i class="pi pi-calendar inventory-date-icon"></i>
</div>`
})
export class LeaseDateComponent {
  @Input() set value(v: string | null | undefined) {
    if (v !== this.cachedIso) { this.cachedIso = v ?? null; this.date = parse(v); }
  }
  @Input() minDate: Date | null = null;
  @Input() maxDate: Date | null = null;
  @Input() disabled = false;
  @Output() valueChange = new EventEmitter<string | null>();
  date: Date | null = null;
  private cachedIso: string | null = null;
  onChange(d: Date | null): void {
    this.date = d;
    this.cachedIso = iso(d);
    this.valueChange.emit(this.cachedIso);
  }
}

// ── picker popup: pick an asset or a service item ───────────────────────────
export interface LeasePickRow { key: string | number; code?: string; name: string; sub?: string; uom?: string; }

@Component({
  selector: 'app-lease-picker-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="inventory-modal-backdrop" (click)="closed.emit()">
  <div class="inventory-modal inventory-modal--wide" (click)="$event.stopPropagation()">
    <div class="inventory-modal-header">
      <div><h3>{{ title }}</h3><p>{{ subtitle }}</p></div>
      <button title="Close" type="button" class="erp-btn btn-white btn-icon" (click)="closed.emit()"><i class="pi pi-times"></i></button>
    </div>
    <div class="erp-form-group" style="margin-bottom:10px;">
      <input class="erp-input" type="text" [ngModel]="search()" (ngModelChange)="search.set($event)" [placeholder]="'Search ' + noun" autofocus />
    </div>
    <div class="tbl-wrap">
      <table class="erp-table compact">
        <thead><tr>@if (multi) { <th></th> }<th>Code</th><th>{{ nounLabel }}</th>@if (showUom) { <th>UOM</th> }<th>Details</th><th></th></tr></thead>
        <tbody>
          @for (r of filtered(); track r.key) {
            <tr>
              @if (multi) { <td><input type="checkbox" [checked]="chosen().includes(r.key)" (change)="toggle(r.key)" /></td> }
              <td>{{ r.code }}</td><td>{{ r.name }}</td>@if (showUom) { <td>{{ r.uom }}</td> }<td>{{ r.sub }}</td>
              <td>@if (!multi) { <button type="button" class="erp-btn btn-white btn-sm" (click)="picked.emit(r.key)">Select</button> }</td>
            </tr>
          } @empty {
            <tr><td [attr.colspan]="(showUom ? 5 : 4) + (multi ? 1 : 0)" class="text-center">No {{ noun }} found. Use "New" to add one.</td></tr>
          }
        </tbody>
      </table>
    </div>
    <div class="inventory-form-actions">
      <button type="button" class="erp-btn btn-white" (click)="closed.emit()"><i class="pi pi-times"></i> Cancel</button>
      @if (multi) { <button type="button" class="erp-btn btn-primary" [disabled]="!chosen().length" (click)="pickedMany.emit(chosen())"><i class="pi pi-check"></i> Add selected ({{ chosen().length }})</button> }
      @if (allowAdd) { <button type="button" class="erp-btn btn-white" (click)="addNew.emit(search().trim())"><i class="pi pi-plus"></i> New {{ noun }}</button> }
    </div>
  </div>
</div>`
})
export class LeasePickerModalComponent {
  @Input() title = 'Pick';
  @Input() subtitle = '';
  @Input() noun = 'item';
  @Input() showUom = false;
  @Input() allowAdd = true;
  /** Tick several rows (for example each serial number of an asset) and add them together. */
  @Input() multi = false;
  @Input() set rows(v: LeasePickRow[]) { this.all.set(v ?? []); }
  @Output() picked = new EventEmitter<string | number>();
  @Output() pickedMany = new EventEmitter<(string | number)[]>();
  @Output() addNew = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();
  get nounLabel(): string { return this.noun ? this.noun.charAt(0).toUpperCase() + this.noun.slice(1) : ''; }
  readonly all = signal<LeasePickRow[]>([]);
  readonly search = signal('');
  readonly chosen = signal<(string | number)[]>([]);
  toggle(key: string | number): void {
    this.chosen.update(list => list.includes(key) ? list.filter(k => k !== key) : [...list, key]);
  }
  filtered(): LeasePickRow[] {
    const q = this.search().trim().toLowerCase();
    return q ? this.all().filter(r => `${r.code ?? ''} ${r.name} ${r.sub ?? ''}`.toLowerCase().includes(q)) : this.all();
  }
}

// ── rates & slabs popup for one meter ───────────────────────────────────────
@Component({
  selector: 'app-lease-rates-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, LeaseDateComponent],
  template: `
<div class="inventory-modal-backdrop" (click)="closed.emit()">
  <div class="inventory-modal inventory-modal--wide" (click)="$event.stopPropagation()">
    <div class="inventory-modal-header">
      <div>
        <h3>Rates &amp; Slabs — {{ title }}</h3>
        <p>Each rate applies from its date. Use slabs when the price per {{ unit }} changes with volume (after the free {{ unit }}).</p>
      </div>
      <button title="Close" type="button" class="erp-btn btn-white btn-icon" (click)="closed.emit()"><i class="pi pi-times"></i></button>
    </div>
    <div class="tbl-wrap">
      <table class="erp-table compact">
        <thead><tr><th class="text-center">Actions</th><th>Effective From</th><th>Rate / {{ unit }}</th><th>Free {{ unit }}</th><th>Minimum charge</th><th>Slab pricing</th></tr></thead>
        <tbody>
          @for (r of rates; track $index; let ri = $index) {
            <tr>
              <td class="text-center"><button type="button" class="erp-btn btn-white btn-icon btn-sm" title="Remove rate" [disabled]="rates.length === 1" (click)="rates.splice(ri, 1)"><i class="pi pi-trash"></i></button></td>
              <td style="min-width:150px"><app-lease-date [value]="r.effective_from" (valueChange)="r.effective_from = $event || r.effective_from" /></td>
              <td><input class="erp-input" type="number" min="0" step="0.0001" [(ngModel)]="r.rate" [disabled]="hasSlabs(r)" /></td>
              <td><input class="erp-input" type="number" min="0" [(ngModel)]="r.free_qty" /></td>
              <td><input class="erp-input" type="number" min="0" [(ngModel)]="r.min_charge" /></td>
              <td><label class="inventory-labeled-switch yes-no">
                <input type="checkbox" [checked]="hasSlabs(r)" (change)="toggleSlabs(r, $any($event.target).checked)" />
                <span class="inventory-switch-track"><span class="switch-text switch-on">Yes</span><span class="switch-text switch-off">No</span></span>
              </label></td>
            </tr>
            @if (hasSlabs(r)) {
              <tr><td></td><td colspan="5">
                <strong>Slabs</strong> — price per {{ unit }} for each band of billable usage. Leave "to" blank for no upper limit.
                @for (s of r.slabs; track $index; let si = $index) {
                  <div class="d-flex gap-1 mt-1">
                    <input class="erp-input" type="number" min="0" placeholder="from" [(ngModel)]="s.from_qty" style="width:7rem" />
                    <input class="erp-input" type="number" min="0" placeholder="to (blank = no limit)" [(ngModel)]="s.to_qty" style="width:11rem" />
                    <input class="erp-input" type="number" min="0" step="0.0001" placeholder="rate" [(ngModel)]="s.slab_rate" style="width:7rem" />
                    <button type="button" class="erp-btn btn-white btn-icon btn-sm" title="Remove slab" (click)="removeSlab(r, si)"><i class="pi pi-times"></i></button>
                  </div>
                }
                <button type="button" class="erp-btn btn-white btn-sm mt-1" (click)="addSlab(r)"><i class="pi pi-plus"></i> Add slab</button>
              </td></tr>
            }
          }
        </tbody>
      </table>
    </div>
    <div class="inventory-form-actions">
      <button type="button" class="erp-btn btn-white" (click)="addRate()"><i class="pi pi-plus"></i> New rate from a later date</button>
      <button type="button" class="erp-btn btn-primary" (click)="done.emit(rates)"><i class="pi pi-check"></i> Done</button>
    </div>
  </div>
</div>`
})
export class LeaseRatesModalComponent {
  @Input() title = '';
  @Input() unit = 'unit';
  @Input() startDate = '';
  @Input() set value(v: LeaseRate[]) {
    this.rates = (v ?? []).map(r => ({ ...r, slabs: (r.slabs ?? []).map(s => ({ ...s })), _slabs: (r.slabs ?? []).length > 0 }));
    if (!this.rates.length) this.addRate();
  }
  @Output() done = new EventEmitter<LeaseRate[]>();
  @Output() closed = new EventEmitter<void>();
  rates: LeaseRate[] = [];
  hasSlabs(r: LeaseRate): boolean { return !!r._slabs || r.slabs.length > 0; }
  toggleSlabs(r: LeaseRate, on: boolean): void {
    r._slabs = on;
    if (on && !r.slabs.length) r.slabs.push({ from_qty: 0, to_qty: null, slab_rate: null });
    if (!on) r.slabs = [];
  }
  addSlab(r: LeaseRate): void {
    const last = r.slabs[r.slabs.length - 1];
    r.slabs.push({ from_qty: last?.to_qty ?? null, to_qty: null, slab_rate: null });
  }
  removeSlab(r: LeaseRate, i: number): void { r.slabs.splice(i, 1); if (!r.slabs.length) r._slabs = false; }
  addRate(): void {
    this.rates.push({ effective_from: this.startDate || iso(new Date())!, rate: null, free_qty: 0, min_charge: 0, slabs: [] });
  }
}

// ── return an asset popup ───────────────────────────────────────────────────
@Component({
  selector: 'app-lease-return-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule, LeaseDateComponent],
  template: `
<div class="inventory-modal-backdrop" (click)="closed.emit()">
  <div class="inventory-modal" (click)="$event.stopPropagation()">
    <div class="inventory-modal-header">
      <div><h3>Return Asset</h3><p>{{ assetName }}</p></div>
      <button title="Close" type="button" class="erp-btn btn-white btn-icon" (click)="closed.emit()"><i class="pi pi-times"></i></button>
    </div>
    <div class="inventory-form-grid inventory-config-grid">
      <div class="erp-form-group"><label class="erp-label">Return Date <span class="text-danger">*</span></label>
        <app-lease-date [value]="date" (valueChange)="date = $event || date" [disabled]="underRepair" /></div>
      <div class="erp-form-group"><label class="erp-label">Asset Now</label>
        <ng-select class="erp-ng-select inventory-ng-select" appendTo="body" [items]="outcomes" bindLabel="label" bindValue="value"
          [clearable]="false" [searchable]="false" [(ngModel)]="outcome"></ng-select></div>
      <div class="erp-form-group span-2"><label class="erp-label">Condition on Return</label><input class="erp-input" type="text" [(ngModel)]="condition" /></div>
    </div>
    <div class="inventory-form-actions">
      <button type="button" class="erp-btn btn-white" (click)="closed.emit()"><i class="pi pi-times"></i> Cancel</button>
      <button type="button" class="erp-btn btn-primary" (click)="done.emit({ return_date: date, return_condition: condition.trim() || undefined, new_status: outcome })"><i class="pi pi-check"></i> Confirm</button>
    </div>
  </div>
</div>`
})
export class LeaseReturnModalComponent {
  @Input() assetName = '';
  @Input() underRepair = false;
  @Output() done = new EventEmitter<{ return_date: string; return_condition?: string; new_status: 'returned' | 'under_repair' }>();
  @Output() closed = new EventEmitter<void>();
  date = iso(new Date())!;
  condition = '';
  outcome: 'returned' | 'under_repair' = 'returned';
  get outcomes() {
    return this.underRepair
      ? [{ value: 'returned', label: 'Returned - available again' }]
      : [{ value: 'returned', label: 'Returned - available again' }, { value: 'under_repair', label: 'Returned - under repair' }];
  }
}
