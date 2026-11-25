import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { DatePickerModule } from 'primeng/datepicker';
import { EInvoiceRow, InventoryTransactionsService } from '../../Inventory_Shared/inventory-transactions.service';
import { attachInventorySaveToast } from '../../Inventory_Shared/inventory-save-toast/inventory-save-toast.component';
import { InventoryEInvoicePrintComponent } from './e-invoice-print';

type EInvoiceType = 'New' | 'Old';

// Sales > E-Invoice. Ported from the legacy Accounts E-Invoice screen
// (E-Invoice Type / From Date / To Date / Show, then a checkbox grid with a
// Save button), rebuilt on Inventory's own building blocks instead of
// ngx-datatable + reactive forms:
//   - New: posted Sales Invoices in the date range that have no IRN yet. B2B
//     rows (customer has a GSTIN) can be ticked and sent to the IRP via
//     "Generate E-Invoice"; B2C rows are listed but not selectable, since
//     e-invoicing doesn't apply to them.
//   - Old: invoices that already have an IRN, with ACK No and a View action
//     that shows the IRN details.
// Standalone (not an InventoryScreenShell subclass) because it's a
// filter + list screen, like Stock Valuation Comparison, not a document form.
@Component({
  selector: 'app-inventory-e-invoice',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule, DatePickerModule, InventoryEInvoicePrintComponent],
  templateUrl: './e-invoice.html',
  styleUrl: './e-invoice.scss'
})
export class InventoryEInvoiceComponent {
  private readonly transactions = inject(InventoryTransactionsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly typeOptions = [
    { label: 'New (Pending)', value: 'New' as EInvoiceType },
    { label: 'Old (Generated)', value: 'Old' as EInvoiceType }
  ];
  readonly pageSizeOptions = [10, 20, 50];
  readonly maxDate = new Date();

  // Filters
  readonly einvoiceType = signal<EInvoiceType>('New');
  readonly fromDate = signal<Date | null>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  readonly toDate = signal<Date | null>(new Date());
  readonly searchText = signal('');
  readonly filterError = signal('');

  // Grid state. `shownType` is the type the current rows were loaded for, so
  // changing the dropdown doesn't relabel rows until Show is clicked again.
  readonly rows = signal<EInvoiceRow[]>([]);
  readonly shownType = signal<EInvoiceType>('New');
  readonly loaded = signal(false);
  readonly loading = signal(false);
  readonly generating = signal(false);
  readonly selectedIds = signal<Set<number>>(new Set());
  readonly pageSize = signal(10);
  readonly page = signal(1);
  readonly viewRow = signal<EInvoiceRow | null>(null);

  // Toast messages (same top-right toast as the shell-based screens).
  readonly saveMsg = signal('');
  readonly saveError = signal('');

  readonly isNew = computed(() => this.shownType() === 'New');

  readonly filteredRows = computed(() => {
    const term = this.searchText().trim().toLowerCase();
    if (!term) return this.rows();
    return this.rows().filter(r =>
      [r.invoice_no, r.customer_name, r.customer_gstin, r.ack_no, r.irn]
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

  onTypeChange(type: EInvoiceType): void {
    const next = type || 'New';
    this.einvoiceType.set(next);
    // Old lists every saved e-invoice: start from the financial year (1-Apr),
    // New keeps the current month. To Date stays today.
    this.fromDate.set(next === 'Old' ? this.financialYearStart() : this.monthStart());
    this.toDate.set(new Date());
    this.filterError.set('');
    this.resetGrid();
  }

  private monthStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  private financialYearStart(): Date {
    const now = new Date();
    return new Date(now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1, 3, 1);
  }

  onFromDateChange(date: Date | null): void {
    this.fromDate.set(date);
    // Keep To Date on/after From Date (the legacy screen's DateChange did the same).
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
    // A search typed for the previous list would hide rows of the new one.
    this.searchText.set('');
    this.load(this.einvoiceType(), from, to);
  }

  private load(type: EInvoiceType, from: Date, to: Date): void {
    this.loading.set(true);
    this.selectedIds.set(new Set());
    this.page.set(1);
    this.transactions.getEInvoices({ type, fromDate: this.apiDate(from), toDate: this.apiDate(to) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          const rows = res.data ?? [];
          // Old: latest e-invoice first (by Ack Date, then invoice date).
          if (type === 'Old') {
            rows.sort((a, b) =>
              String(b.ack_date || '').localeCompare(String(a.ack_date || '')) ||
              String(b.invoice_date || '').localeCompare(String(a.invoice_date || '')) ||
              b.invoice_id - a.invoice_id);
          }
          this.rows.set(rows);
          this.shownType.set(type);
          this.loaded.set(true);
          this.loading.set(false);
        },
        error: err => {
          this.rows.set([]);
          this.shownType.set(type);
          this.loaded.set(true);
          this.loading.set(false);
          this.raiseError(err?.error?.message || 'Unable to load e-invoices.');
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

  /** New list (LEFT JOIN) also returns invoices that already have an IRN; only pending B2B rows can be ticked. */
  canSelect(row: EInvoiceRow): boolean {
    // invoice_id > 0: selection is keyed by it, so rows without a real id
    // (e.g. API not returning invoiceId) would all tick together.
    return this.isNew() && row.invoice_id > 0 && row.supply_type === 'B2B' && !!row.customer_gstin && !row.irn;
  }

  selectTitle(row: EInvoiceRow): string {
    if (this.canSelect(row)) return 'Select';
    if (row.irn) return 'E-invoice already generated';
    return 'E-invoice applies only to B2B invoices (customer GSTIN required)';
  }

  isSelected(row: EInvoiceRow): boolean {
    return this.selectedIds().has(row.invoice_id);
  }

  toggleRow(row: EInvoiceRow, checked: boolean): void {
    if (!this.canSelect(row)) return;
    const next = new Set(this.selectedIds());
    if (checked) next.add(row.invoice_id); else next.delete(row.invoice_id);
    this.selectedIds.set(next);
  }

  /** Header checkbox: ticks every selectable row that matches the search, across all pages. */
  toggleAll(checked: boolean): void {
    this.selectedIds.set(checked ? new Set(this.selectableRows().map(r => r.invoice_id)) : new Set());
  }

  // ── Generate ───────────────────────────────────────────────────────────────

  generate(): void {
    const ids = [...this.selectedIds()];
    if (!ids.length) {
      this.raiseError('Select at least one invoice to generate the e-invoice.');
      return;
    }
    this.generating.set(true);
    this.transactions.generateEInvoices(ids)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.generating.set(false);
          const results = res.data ?? [];
          const failed = results.filter(r => r.einvoice_status === 'failed' || (!r.irn && r.error_message));
          const generated = results.length ? results.length - failed.length : ids.length;
          if (failed.length) {
            const details = failed.slice(0, 3).map(r => `${r.invoice_no}: ${r.error_message || 'failed'}`).join('; ');
            this.raiseError(`${failed.length} invoice(s) failed. ${details}${failed.length > 3 ? ' …' : ''}`);
          }
          if (generated > 0) this.raiseMessage(res.message || `E-invoice generated for ${generated} invoice(s).`);
          if (!failed.length) {
            // All saved: clear the grid and selection (filters stay); Show reloads.
            this.resetGrid();
            return;
          }
          // Some failed: reload so the generated ones drop out of the New list.
          const from = this.fromDate();
          const to = this.toDate();
          if (from && to) this.load(this.shownType(), from, to);
        },
        error: err => {
          // The API answers 500 when any invoice fails; its message lists each
          // invoice's error. Reload anyway: others in the batch may have succeeded.
          this.generating.set(false);
          this.raiseError(err?.error?.message || 'E-invoice generation failed.');
          const from = this.fromDate();
          const to = this.toDate();
          if (from && to) this.load(this.shownType(), from, to);
        }
      });
  }

  // ── View (Old) ─────────────────────────────────────────────────────────────

  openView(row: EInvoiceRow): void {
    this.viewRow.set(row);
  }

  closeView(): void {
    this.viewRow.set(null);
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

  statusLabel(row: EInvoiceRow): string {
    if (row.einvoice_status) return row.einvoice_status.charAt(0).toUpperCase() + row.einvoice_status.slice(1);
    if (row.irn) return 'Generated';
    return row.supply_type === 'B2B' ? 'Pending' : 'Not applicable';
  }

  statusClass(row: EInvoiceRow): string {
    const status = this.statusLabel(row).toLowerCase();
    if (status === 'generated') return 'einv-badge einv-badge--ok';
    if (status === 'failed' || status === 'cancelled') return 'einv-badge einv-badge--error';
    if (status === 'pending') return 'einv-badge einv-badge--pending';
    return 'einv-badge';
  }

  /** yyyy-MM-dd in local time (toISOString would shift the day for IST). */
  private apiDate(date: Date): string {
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${m}-${d}`;
  }

  // The toast effect only fires on a change, so clear first to repeat a message.
  private raiseMessage(message: string): void {
    this.saveMsg.set('');
    queueMicrotask(() => this.saveMsg.set(message));
  }

  private raiseError(message: string): void {
    this.saveError.set('');
    queueMicrotask(() => this.saveError.set(message));
  }
}
