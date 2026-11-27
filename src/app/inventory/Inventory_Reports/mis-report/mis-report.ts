import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthService } from '../../../core/host/host-bridge';
import { StatCardComponent } from '../../Inventory_Shared/stat-card/stat-card.component';
import { BarChartComponent, ChartSeries } from '../../Inventory_Shared/charts/bar-chart.component';
import { DonutChartComponent, DonutSlice } from '../../Inventory_Shared/charts/donut-chart.component';
import { InventoryReportsService, MisReport } from '../shared/inventory-reports.service';

// Item: MIS Report (screen code INV_R_MIS, 153_mis_report.sql /
// 154_mis_report_screen.sql). Admin-only per the business owner's explicit
// request -- combines the company-wide snapshot AND the segment-wise
// breakdown into ONE report, graphical/professional, not the flat-table
// shape the generic report-page shell renders. Bespoke route like
// StockValuationComparisonComponent, for the same reason.
//
// screenPermissionGuard (see inventory_routs.ts) is non-blocking by design
// across this whole app -- it warns via toast but always lets the route
// load. This component is the one place in Inventory that adds its own
// EXPLICIT, blocking check on top of that (canView(), below) so an
// Admin-only report doesn't quietly render for a non-Admin who has a screen
// permission gap. The backend endpoint has no extra gate beyond normal
// tenant scoping -- a user without the permission simply never reaches the
// code path that calls it.
@Component({
  selector: 'app-mis-report',
  standalone: true,
  imports: [CommonModule, FormsModule, StatCardComponent, BarChartComponent, DonutChartComponent],
  templateUrl: './mis-report.html',
  styleUrl: './mis-report.scss'
})
export class MisReportComponent {
  private readonly reportsService = inject(InventoryReportsService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly canView = computed(() => this.authService.can('INV_R_MIS', 'view'));

  readonly dateFrom = signal('');
  // Previous: readonly dateTo = signal('');
  // To Date binds today's date by default, like every other inventory report (user 2026-11-27).
  readonly dateTo = signal(MisReportComponent.todayIso());

  private static todayIso(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  readonly report = signal<MisReport | null>(null);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly errorMessage = signal('');

  readonly hasResult = computed(() => this.loaded() && !!this.report() && !this.errorMessage());

  readonly companyWide = computed(() => this.report()?.companyWide ?? null);
  readonly segments = computed(() => this.report()?.segments ?? []);

  readonly payablesAgeingLabels = computed(() => (this.companyWide()?.payablesAgeing ?? []).map(a => a.bucket));
  readonly payablesAgeingChart = computed<ChartSeries[]>(() => [
    { label: 'Payables', data: (this.companyWide()?.payablesAgeing ?? []).map(a => a.amount) }
  ]);

  readonly receivablesAgeingLabels = computed(() => (this.companyWide()?.receivablesAgeing ?? []).map(a => a.bucket));
  readonly receivablesAgeingChart = computed<ChartSeries[]>(() => [
    { label: 'Receivables', data: (this.companyWide()?.receivablesAgeing ?? []).map(a => a.amount) }
  ]);

  readonly payablesReceivablesSlices = computed<DonutSlice[]>(() => [
    { label: 'Payables', value: this.companyWide()?.payables ?? 0 },
    { label: 'Receivables', value: this.companyWide()?.receivables ?? 0 }
  ]);

  readonly topProductsLabels = computed(() => (this.companyWide()?.topSellingProducts ?? []).map(p => p.productName));
  readonly topProductsChart = computed<ChartSeries[]>(() => [
    { label: 'Sales Value', data: (this.companyWide()?.topSellingProducts ?? []).map(p => p.amount) }
  ]);

  readonly segmentChartLabels = computed(() => this.segments().map(s => s.segmentName || 'Unassigned'));
  readonly segmentChartSeries = computed<ChartSeries[]>(() => [
    { label: 'Sales', data: this.segments().map(s => s.sales) },
    { label: 'Purchases', data: this.segments().map(s => s.purchases) }
  ]);

  constructor() {
    if (this.canView()) this.generate();
  }

  onDateFromChange(value: string): void {
    this.dateFrom.set(value ?? '');
  }

  onDateToChange(value: string): void {
    this.dateTo.set(value ?? '');
  }

  generate(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    this.reportsService.getMisReport(this.dateFrom() || undefined, this.dateTo() || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.report.set(result);
          this.loaded.set(true);
          this.loading.set(false);
        },
        error: err => {
          this.report.set(null);
          this.loaded.set(true);
          this.errorMessage.set(err?.error?.message || 'Unable to load the MIS report.');
          this.loading.set(false);
        }
      });
  }

  formatCurrency(value: number | undefined | null): string {
    return `Rs. ${Number(value ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  }

  formatDate(value: string | undefined | null): string {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
