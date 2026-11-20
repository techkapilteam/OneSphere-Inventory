import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { InventoryScreenShell } from '../../Inventory_Shared/inventory-screen-shell/inventory-screen-shell';
import { LeaseDateComponent } from '../lease-dialogs';
import { leaseReportConfig } from '../lease-screen-configs';
import { LeaseMeterService } from '../lease-meter.service';

interface ReportDef { key: string; label: string; hint: string; columns: { key: string; label: string }[]; }

const REPORTS: ReportDef[] = [
  {
    key: 'position', label: 'Asset position', hint: 'Each leasable asset: in hand, or on lease to which customer.',
    columns: [
      { key: 'product_name', label: 'Asset' }, { key: 'asset_ref', label: 'Reference' }, { key: 'qty', label: 'Qty' },
      { key: 'asset_position', label: 'Position' }, { key: 'customer_name', label: 'Customer' }, { key: 'site_name', label: 'Site / Location' },
      { key: 'contract_no', label: 'Contract' }, { key: 'handover_date', label: 'Handed over' }, { key: 'location_name', label: 'Stored at' }
    ]
  },
  {
    key: 'on_lease', label: 'Assets on lease', hint: 'Every asset currently with a customer (or under repair).',
    columns: [
      { key: 'product_name', label: 'Asset' }, { key: 'asset_ref', label: 'Reference' }, { key: 'customer_name', label: 'Customer' },
      { key: 'site_name', label: 'Site' }, { key: 'contract_no', label: 'Contract' }, { key: 'handover_date', label: 'Handed over' }, { key: 'status', label: 'Status' }
    ]
  },
  {
    key: 'history', label: 'Lease history', hint: 'All handovers and returns, newest first.',
    columns: [
      { key: 'product_name', label: 'Asset' }, { key: 'asset_ref', label: 'Reference' }, { key: 'customer_name', label: 'Customer' },
      { key: 'contract_no', label: 'Contract' }, { key: 'handover_date', label: 'Handed over' }, { key: 'return_date', label: 'Returned' }, { key: 'status', label: 'Status' }
    ]
  },
  {
    key: 'expiring', label: 'Contracts expiring soon', hint: 'Active contracts ending within the chosen number of days.',
    columns: [
      { key: 'contract_no', label: 'Contract' }, { key: 'customer_name', label: 'Customer' }, { key: 'site_name', label: 'Site' },
      { key: 'end_date', label: 'Ends' }, { key: 'days_left', label: 'Days left' }, { key: 'asset_count', label: 'Assets out' }
    ]
  },
  {
    key: 'unbilled', label: 'Unbilled readings', hint: 'Draft or verified readings not yet on a bill.',
    columns: [
      { key: 'contract_no', label: 'Contract' }, { key: 'customer_name', label: 'Customer' }, { key: 'meter', label: 'Meter' },
      { key: 'reading_date', label: 'Date' }, { key: 'reading_value', label: 'Reading' }, { key: 'usage_qty', label: 'Usage' }, { key: 'status', label: 'Status' }
    ]
  },
  {
    key: 'revenue', label: 'Lease revenue by contract', hint: 'Billed rent and usage per contract (cancelled bills excluded).',
    columns: [
      { key: 'contract_no', label: 'Contract' }, { key: 'customer_name', label: 'Customer' }, { key: 'bills', label: 'Bills' }, { key: 'total_amount', label: 'Billed (before GST)' }
    ]
  }
];

@Component({
  selector: 'app-inventory-lease-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule, LeaseDateComponent, InventoryScreenShell],
  template: `
<div class="module-page inventory-page">
  <div class="inventory-shell">
    <app-inventory-screen-shell [config]="config"></app-inventory-screen-shell>

    <section class="inventory-section">
      <div class="inventory-transaction-header">
        <div class="erp-form-group inventory-header-col-6">
          <label class="erp-label">Report</label>
          <ng-select class="erp-ng-select inventory-ng-select" appendTo="body" [items]="reports" bindLabel="label" bindValue="key"
            [searchable]="false" [clearable]="false" [ngModel]="reportKey()" (ngModelChange)="reportKey.set($event); run()"></ng-select>
        </div>
        @if (reportKey() === 'expiring') {
          <div class="erp-form-group"><label class="erp-label">Within (days)</label><input class="erp-input" type="number" min="1" [(ngModel)]="days" (change)="run()" /></div>
        }
        @if (reportKey() === 'revenue') {
          <div class="erp-form-group"><label class="erp-label">From</label>
            <app-lease-date [value]="fromDate" (valueChange)="fromDate = $event || fromDate; run()" /></div>
          <div class="erp-form-group"><label class="erp-label">To</label>
            <app-lease-date [value]="toDate" (valueChange)="toDate = $event || toDate; run()" /></div>
        }
      </div>
      <div class="inventory-form-actions">
        <button type="button" class="erp-btn btn-white" (click)="run()"><i class="pi pi-refresh"></i> Refresh</button>
      </div>
      @if (error()) {
        <div class="inventory-save-error"><span>{{ error() }}</span>
          <button type="button" class="inventory-alert-close" (click)="error.set('')" aria-label="Dismiss"><i class="pi pi-times"></i></button></div>
      }
      @if (!rows().length) {
        <div class="inventory-empty-state">No records.</div>
      } @else {
        <div class="tbl-wrap"><table class="erp-table compact">
          <thead><tr>@for (c of def().columns; track c.key) { <th>{{ c.label }}</th> }</tr></thead>
          <tbody>
            @for (r of rows(); track $index) {
              <tr>@for (c of def().columns; track c.key) { <td>{{ r[c.key] }}</td> }</tr>
            }
          </tbody>
        </table></div>
      }
    </section>
  </div>
</div>`
})
export class InventoryLeaseReportsComponent implements OnInit {
  readonly config = leaseReportConfig;
  private readonly api = inject(LeaseMeterService);

  readonly reports = REPORTS;
  readonly reportKey = signal('position');
  readonly rows = signal<any[]>([]);
  readonly error = signal('');

  days = 30;
  fromDate = '';
  toDate = '';

  def(): ReportDef { return REPORTS.find(r => r.key === this.reportKey()) ?? REPORTS[0]; }

  ngOnInit(): void { this.run(); }

  run(): void {
    this.error.set('');
    const extra: Record<string, any> = {};
    if (this.reportKey() === 'expiring') extra['days'] = this.days;
    if (this.reportKey() === 'revenue') { extra['fromDate'] = this.fromDate; extra['toDate'] = this.toDate; }
    this.api.getReport(this.reportKey(), extra).subscribe({
      next: res => this.rows.set(res.data ?? []),
      error: err => { this.rows.set([]); this.error.set(LeaseMeterService.errorMessage(err)); }
    });
  }
}
