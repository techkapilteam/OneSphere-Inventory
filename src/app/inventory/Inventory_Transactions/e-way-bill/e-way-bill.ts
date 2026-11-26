import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { DatePickerModule } from 'primeng/datepicker';
import { attachInventorySaveToast } from '../../Inventory_Shared/inventory-save-toast/inventory-save-toast.component';
import {
  EWAY_BILL_THRESHOLD,
  EWayBillMockService,
  EWayBillRow,
  EWayBillTransport,
  TransportMode,
  VehicleType,
  canCancel
} from './e-way-bill.mock';

type EWayBillType = 'New' | 'Old';

const VEHICLE_NO_RE = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$|^TMP[A-Z0-9]{4,12}$/;
// GSTIN or TRANSIN: 15 characters, 2-digit state/88 prefix.
const GSTIN_RE = /^[0-9]{2}[0-9A-Z]{13}$/;

// Sales > E-Way Bill. Same layout as the E-Invoice screen:
//   - New: Sales Invoices without an e-way bill. Invoices above ₹50,000 can be
//     ticked; "Generate E-Way Bill" opens a dialog for the transport details
//     (Part-B) and the distance of each invoice, then generates them together.
//   - Old: e-way bills already generated (or cancelled), with EWB No, date,
//     Valid Upto and vehicle. View shows the full details; Cancel is offered
//     within 24 hours of generation.
// FRONT-END ONLY for now: data comes from EWayBillMockService (in memory).
@Component({
  selector: 'app-inventory-e-way-bill',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule, DatePickerModule],
  templateUrl: './e-way-bill.html',
  styleUrl: './e-way-bill.scss'
})
export class InventoryEWayBillComponent {
  private readonly ewb = inject(EWayBillMockService);
  private readonly destroyRef = inject(DestroyRef);

  readonly threshold = EWAY_BILL_THRESHOLD;
  readonly typeOptions = [
    { label: 'New (Pending)', value: 'New' as EWayBillType },
    { label: 'Old (Generated)', value: 'Old' as EWayBillType }
  ];
  readonly transportModes: TransportMode[] = ['Road', 'Rail', 'Air', 'Ship'];
  readonly vehicleTypes = [
    { label: 'Regular', value: 'Regular' as VehicleType },
    { label: 'Over Dimensional Cargo (ODC)', value: 'ODC' as VehicleType }
  ];
  readonly cancelReasons = ['Duplicate', 'Order Cancelled', 'Data Entry Mistake', 'Others'];
  readonly pageSizeOptions = [10, 20, 50];
  readonly maxDate = new Date();

  // Filters
  readonly ewbType = signal<EWayBillType>('New');
  readonly fromDate = signal<Date | null>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  readonly toDate = signal<Date | null>(new Date());
  readonly searchText = signal('');
  readonly filterError = signal('');

  // Grid
  readonly rows = signal<EWayBillRow[]>([]);
  readonly shownType = signal<EWayBillType>('New');
  readonly loaded = signal(false);
  readonly loading = signal(false);
  readonly selectedIds = signal<Set<number>>(new Set());
  readonly pageSize = signal(10);
  readonly page = signal(1);

  // Generate dialog
  readonly generateOpen = signal(false);
  readonly generating = signal(false);
  readonly generateError = signal('');
  readonly distances = signal<Record<number, number | null>>({});
  transport: EWayBillTransport = this.emptyTransport();
  transportDocDate: Date | null = null;

  // View / cancel dialogs
  readonly viewRow = signal<EWayBillRow | null>(null);
  readonly cancelRow = signal<EWayBillRow | null>(null);
  readonly cancelling = signal(false);
  readonly cancelError = signal('');
  cancelReason = '';
  cancelRemarks = '';

  // Toasts
  readonly saveMsg = signal('');
  readonly saveError = signal('');

  readonly isNew = computed(() => this.shownType() === 'New');

  readonly filteredRows = computed(() => {
    const term = this.searchText().trim().toLowerCase();
    if (!term) return this.rows();
    return this.rows().filter(r =>
      [r.invoice_no, r.customer_name, r.customer_gstin, r.ewb_no, r.vehicle_no, r.to_place]
        .some(v => String(v || '').toLowerCase().includes(term)));
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredRows().length / this.pageSize())));

  readonly pagedRows = computed(() => {
    const page = Math.min(this.page(), this.totalPages());
    const start = (page - 1) * this.pageSize();
    return this.filteredRows().slice(start, start + this.pageSize());
  });

  readonly selectableRows = computed(() => this.isNew() ? this.filteredRows().filter(r => this.canSelect(r)) : []);

  readonly allSelected = computed(() => {
    const selectable = this.selectableRows();
    const selected = this.selectedIds();
    return selectable.length > 0 && selectable.every(r => selected.has(r.invoice_id));
  });

  readonly selectedRows = computed(() => this.rows().filter(r => this.selectedIds().has(r.invoice_id)));
  readonly selectedTotal = computed(() => this.selectedRows().reduce((sum, r) => sum + r.total_amount, 0));

  constructor() {
    attachInventorySaveToast(this.saveMsg, this.saveError);
  }

  // ── Filters ────────────────────────────────────────────────────────────────

  onTypeChange(type: EWayBillType): void {
    this.ewbType.set(type || 'New');
    this.resetGrid();
  }

  onFromDateChange(date: Date | null): void {
    this.fromDate.set(date);
    const to = this.toDate();
    if (date && to && to < date) this.toDate.set(date);
    this.filterError.set('');
  }

  onToDateChange(date: Date | null): void {
    this.toDate.set(date);
    this.filterError.set('');
  }

  onSearchChange(value: string): void {
    this.searchText.set(value || '');
    this.page.set(1);
  }

  show(): void {
    const from = this.fromDate();
    const to = this.toDate();
    if (!from || !to) {
      this.filterError.set('Select both From Date and To Date.');
      return;
    }
    if (from > to) {
      this.filterError.set('From Date cannot be after To Date.');
      return;
    }
    this.filterError.set('');
    this.load(this.ewbType(), from, to);
  }

  private reload(): void {
    const from = this.fromDate();
    const to = this.toDate();
    if (from && to) this.load(this.shownType(), from, to);
  }

  private load(type: EWayBillType, from: Date, to: Date): void {
    this.loading.set(true);
    this.selectedIds.set(new Set());
    this.page.set(1);
    this.ewb.getEWayBills({ type, fromDate: this.apiDate(from), toDate: this.apiDate(to) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.rows.set(res.data ?? []);
          this.shownType.set(type);
          this.loaded.set(true);
          this.loading.set(false);
        },
        error: err => {
          this.rows.set([]);
          this.shownType.set(type);
          this.loaded.set(true);
          this.loading.set(false);
          this.raiseError(err?.error?.message || 'Unable to load e-way bills.');
        }
      });
  }

  private resetGrid(): void {
    this.rows.set([]);
    this.loaded.set(false);
    this.selectedIds.set(new Set());
    this.page.set(1);
  }

  // ── Selection ──────────────────────────────────────────────────────────────

  canSelect(row: EWayBillRow): boolean {
    return this.isNew() && row.invoice_id > 0 && !row.ewb_no && row.total_amount > this.threshold;
  }

  selectTitle(row: EWayBillRow): string {
    if (this.canSelect(row)) return 'Select';
    if (row.ewb_no) return 'E-way bill already generated';
    return 'E-way bill is required only above ₹50,000';
  }

  isSelected(row: EWayBillRow): boolean {
    return this.selectedIds().has(row.invoice_id);
  }

  toggleRow(row: EWayBillRow, checked: boolean): void {
    if (!this.canSelect(row)) return;
    const next = new Set(this.selectedIds());
    if (checked) next.add(row.invoice_id); else next.delete(row.invoice_id);
    this.selectedIds.set(next);
  }

  toggleAll(checked: boolean): void {
    this.selectedIds.set(checked ? new Set(this.selectableRows().map(r => r.invoice_id)) : new Set());
  }

  // ── Generate ───────────────────────────────────────────────────────────────

  openGenerate(): void {
    if (!this.selectedIds().size) {
      this.raiseError('Select at least one invoice to generate the e-way bill.');
      return;
    }
    const distances: Record<number, number | null> = {};
    for (const r of this.selectedRows()) distances[r.invoice_id] = r.distance_km || null;
    this.distances.set(distances);
    this.transport = this.emptyTransport();
    this.transportDocDate = null;
    this.generateError.set('');
    this.generateOpen.set(true);
  }

  closeGenerate(): void {
    if (this.generating()) return;
    this.generateOpen.set(false);
  }

  setDistance(invoiceId: number, value: number | null): void {
    this.distances.update(d => ({ ...d, [invoiceId]: value == null || (value as unknown) === '' ? null : Number(value) }));
  }

  onVehicleNoChange(value: string): void {
    this.transport.vehicle_no = (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  onTransporterIdChange(value: string): void {
    this.transport.transporter_id = (value || '').toUpperCase().trim();
  }

  isRoad(): boolean {
    return this.transport.transport_mode === 'Road';
  }

  generate(): void {
    const error = this.validateGenerate();
    if (error) {
      this.generateError.set(error);
      return;
    }
    this.generateError.set('');
    this.generating.set(true);

    const t = this.transport;
    const request = {
      invoices: this.selectedRows().map(r => ({ invoice_id: r.invoice_id, distance_km: Number(this.distances()[r.invoice_id]) })),
      transport: {
        ...t,
        vehicle_type: this.isRoad() ? t.vehicle_type : 'Regular' as VehicleType,
        vehicle_no: this.isRoad() ? t.vehicle_no : '',
        transporter_name: t.transporter_name.trim(),
        transport_doc_no: t.transport_doc_no.trim(),
        transport_doc_date: this.transportDocDate ? this.apiDate(this.transportDocDate) : null
      }
    };

    this.ewb.generateEWayBills(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.generating.set(false);
          this.generateOpen.set(false);
          const results = res.data ?? [];
          const failed = results.filter(r => r.status === 'failed');
          const generated = results.length - failed.length;
          if (failed.length) {
            const details = failed.slice(0, 3).map(r => `${r.invoice_no}: ${r.error_message || 'failed'}`).join('; ');
            this.raiseError(`${failed.length} invoice(s) failed. ${details}${failed.length > 3 ? ' …' : ''}`);
          }
          if (generated > 0) this.raiseMessage(res.message || `E-way bill generated for ${generated} invoice(s).`);
          if (!failed.length) {
            this.resetGrid();
            return;
          }
          this.reload();
        },
        error: err => {
          this.generating.set(false);
          this.generateError.set(err?.error?.message || 'E-way bill generation failed.');
        }
      });
  }

  private validateGenerate(): string {
    for (const r of this.selectedRows()) {
      const km = this.distances()[r.invoice_id];
      if (km == null || !Number.isFinite(km) || km < 1 || km > 4000) {
        return `Enter a distance between 1 and 4000 km for ${r.invoice_no}.`;
      }
    }
    const t = this.transport;
    if (t.transporter_id && !GSTIN_RE.test(t.transporter_id)) {
      return 'Transporter ID must be a valid 15-character GSTIN / TRANSIN.';
    }
    if (this.isRoad()) {
      if (!t.vehicle_no && !t.transporter_id) {
        return 'Enter the Vehicle No, or a Transporter ID so the transporter can add the vehicle later.';
      }
      if (t.vehicle_no && !VEHICLE_NO_RE.test(t.vehicle_no)) {
        return 'Vehicle No format is not valid (e.g. TS09UB4521).';
      }
    } else {
      if (!t.transport_doc_no.trim()) return `Transport Doc No is required for ${t.transport_mode}.`;
      if (!this.transportDocDate) return `Transport Doc Date is required for ${t.transport_mode}.`;
    }
    return '';
  }

  private emptyTransport(): EWayBillTransport {
    return {
      transport_mode: 'Road',
      vehicle_type: 'Regular',
      vehicle_no: '',
      transporter_id: '',
      transporter_name: '',
      transport_doc_no: '',
      transport_doc_date: null
    };
  }

  // ── View / Cancel (Old) ────────────────────────────────────────────────────

  openView(row: EWayBillRow): void {
    this.viewRow.set(row);
  }

  closeView(): void {
    this.viewRow.set(null);
  }

  canCancel(row: EWayBillRow): boolean {
    return canCancel(row);
  }

  openCancel(row: EWayBillRow): void {
    this.cancelReason = '';
    this.cancelRemarks = '';
    this.cancelError.set('');
    this.cancelRow.set(row);
  }

  closeCancel(): void {
    if (this.cancelling()) return;
    this.cancelRow.set(null);
  }

  confirmCancel(): void {
    const row = this.cancelRow();
    if (!row) return;
    if (!this.cancelReason) {
      this.cancelError.set('Select a reason for cancellation.');
      return;
    }
    if (this.cancelReason === 'Others' && !this.cancelRemarks.trim()) {
      this.cancelError.set('Enter remarks when the reason is Others.');
      return;
    }
    this.cancelling.set(true);
    this.ewb.cancelEWayBill(row.invoice_id, this.cancelReason, this.cancelRemarks.trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.cancelling.set(false);
          this.cancelRow.set(null);
          this.viewRow.set(null);
          this.raiseMessage(res.message);
          this.reload();
        },
        error: err => {
          this.cancelling.set(false);
          this.cancelError.set(err?.error?.message || 'Unable to cancel the e-way bill.');
        }
      });
  }

  // ── Paging ─────────────────────────────────────────────────────────────────

  setPageSize(size: number): void {
    this.pageSize.set(Number(size) || 10);
    this.page.set(1);
  }

  goToPage(page: number): void {
    this.page.set(Math.min(Math.max(1, page), this.totalPages()));
  }

  // ── Formatting ─────────────────────────────────────────────────────────────

  formatAmount(value: number | null | undefined): string {
    return `₹ ${Number(value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  /** EWB numbers are 12 digits; shown as 3214 5678 9057 for readability. */
  formatEwbNo(value: string | null | undefined): string {
    return value ? value.replace(/(\d{4})(?=\d)/g, '$1 ') : '-';
  }

  isExpired(row: EWayBillRow): boolean {
    return row.status === 'generated' && !!row.valid_upto && new Date(row.valid_upto).getTime() < Date.now();
  }

  statusLabel(row: EWayBillRow): string {
    if (row.status === 'generated') return this.isExpired(row) ? 'Expired' : 'Active';
    if (row.status === 'cancelled') return 'Cancelled';
    if (row.status === 'failed') return 'Failed';
    return row.total_amount > this.threshold ? 'Pending' : 'Not required';
  }

  statusClass(row: EWayBillRow): string {
    switch (this.statusLabel(row)) {
      case 'Active': return 'ewb-badge ewb-badge--ok';
      case 'Pending': return 'ewb-badge ewb-badge--pending';
      case 'Failed':
      case 'Cancelled': return 'ewb-badge ewb-badge--error';
      default: return 'ewb-badge';
    }
  }

  private apiDate(date: Date): string {
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${m}-${d}`;
  }

  private raiseMessage(message: string): void {
    this.saveMsg.set('');
    queueMicrotask(() => this.saveMsg.set(message));
  }

  private raiseError(message: string): void {
    this.saveError.set('');
    queueMicrotask(() => this.saveError.set(message));
  }
}
