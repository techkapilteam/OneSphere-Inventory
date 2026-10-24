import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { inventoryDashboardConfig } from '../Inventory_Shared/inventory-screen.model';
import { InventoryScreenShell } from '../Inventory_Shared/inventory-screen-shell/inventory-screen-shell';
import { InventoryExportService } from '../Inventory_Shared/inventory-export.service';
import {
  DashboardDrilldownRow,
  DashboardStockRow,
  DashboardSummary,
  DashboardTransactionRow,
  DcPendingInvoiceLineRow,
  InventoryDashboardService,
  LossSaleFlagRow,
  SalesPiPendingFlagRow
} from '../Inventory_Shared/inventory-dashboard.service';
import {
  InventoryTransactionsService,
  MaterialIssueProduction,
  ProductionEntry,
  ProductionPlan,
  ProductionReturn,
  StockTransfer
} from '../Inventory_Shared/inventory-transactions.service';
import { StatCardComponent, StatCardTone } from '../Inventory_Shared/stat-card/stat-card.component';
import { BarChartComponent, ChartSeries } from '../Inventory_Shared/charts/bar-chart.component';
import { LineChartComponent } from '../Inventory_Shared/charts/line-chart.component';
import { DonutChartComponent, DonutSlice } from '../Inventory_Shared/charts/donut-chart.component';

const SECTION_LAYOUT_KEY = 'inv-dashboard-section-layout-v4';
const WIDTH_OPTIONS = [4, 6, 8, 12] as const;

interface SectionLayoutItem {
  id: string;
  width: number; // one of WIDTH_OPTIONS — columns out of 12
  hidden?: boolean;
}

// Default order + width (out of 12 columns). Widths are just a starting
// point — every widget, including the KPI tiles, can be resized/reordered
// by the user; the result is saved to localStorage.
const DEFAULT_SECTION_LAYOUT: SectionLayoutItem[] = [
  { id: 'kpis', width: 12 },
  { id: 'financials', width: 12 },
  { id: 'documents', width: 12 },
  { id: 'operations', width: 12 },
  { id: 'ageing', width: 12 },
  { id: 'movement', width: 8 },
  { id: 'warehouseStock', width: 4 },
  { id: 'stockTransferFlow', width: 6 },
  { id: 'manufacturingFlow', width: 6 },
  { id: 'salesReturnsTrend', width: 8 },
  { id: 'payablesReceivablesDonut', width: 4 },
  { id: 'topReturnedProducts', width: 12 },
  { id: 'productSalesFunnel', width: 6 },
  { id: 'procurementSalesFunnel', width: 6 },
  { id: 'stockByProduct', width: 12 },
  { id: 'recentTransactions', width: 12 }
];

const SECTION_TITLES: Record<string, { title: string; subtitle: string }> = {
  kpis: { title: 'Key Metrics', subtitle: 'Stock value, pending documents, and today’s activity.' },
  financials: { title: 'Payables & Receivables', subtitle: 'Outstanding balances (today) and cash movement.' },
  documents: { title: 'Purchase, Sales & Returns', subtitle: 'Posted documents for the selected period.' },
  operations: { title: 'Stock Transfer & Manufacturing', subtitle: 'Current-period transfer movement and production execution.' },
  ageing: { title: 'Ageing', subtitle: 'Outstanding balances as of today, by invoice age.' },
  movement: { title: 'Movement', subtitle: 'Inward (GRN accepted qty) vs. outward (Sales Invoice qty), by day.' },
  warehouseStock: { title: 'Warehouse Stock', subtitle: 'Real qty and value per warehouse.' },
  stockTransferFlow: { title: 'Stock Transfer Flow', subtitle: 'Transfer routes and posted/draft split for the selected period.' },
  manufacturingFlow: { title: 'Manufacturing Flow', subtitle: 'Raw material issued, finished output, wastage, and returns.' },
  salesReturnsTrend: { title: 'Sales & Returns', subtitle: 'Posted Sales Invoices vs. Sales Returns, by day.' },
  payablesReceivablesDonut: { title: 'Payables vs Receivables', subtitle: 'Share of total outstanding, as of today.' },
  topReturnedProducts: { title: 'Top Selling & Returned Products', subtitle: 'Ranked by value, for the selected period.' },
  productSalesFunnel: { title: 'Product Sales Funnel', subtitle: 'Top products by sales value, widest first.' },
  procurementSalesFunnel: { title: 'Procurement vs Sales Funnel', subtitle: 'Document count at each pipeline stage, this period.' },
  stockByProduct: { title: 'Stock by Product', subtitle: 'Every product currently tracked, with real qty and value.' },
  recentTransactions: { title: 'Recent Transactions', subtitle: 'Latest documents across purchase and sales, newest first.' }
};

type DashboardPeriod = 'today' | 'week' | 'month' | 'quarter';

interface FunnelStage {
  label: string;
  short: string;
  count: number;
  value: number;
  valueLabel: string;
  widthPct: number;
  conversionPct: number;
}

interface ProductFunnelStage {
  label: string;
  amount: number;
  qty: number;
  widthPct: number;
}

interface KpiTile {
  label: string;
  value: string;
  note: string;
  icon: string;
  tone: StatCardTone;
  key: string;
}

interface GridPayload {
  title: string;
  headers: string[];
  rows: string[][];
}

@Component({
  selector: 'app-inventory-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, InventoryScreenShell, StatCardComponent, BarChartComponent, LineChartComponent, DonutChartComponent],
  templateUrl: './inventory-dashboard.html',
  styleUrl: './inventory-dashboard.scss'
})
export class InventoryDashboard {
  private readonly dashboardService = inject(InventoryDashboardService);
  private readonly transactionsService = inject(InventoryTransactionsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly exportService = inject(InventoryExportService);

  readonly selectedPeriod = signal<DashboardPeriod>('week');
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly summary = signal<DashboardSummary | null>(null);
  readonly stockTransfers = signal<StockTransfer[]>([]);
  readonly productionPlans = signal<ProductionPlan[]>([]);
  readonly materialIssues = signal<MaterialIssueProduction[]>([]);
  readonly productionEntries = signal<ProductionEntry[]>([]);
  readonly productionReturns = signal<ProductionReturn[]>([]);
  readonly salesPiPendingFlags = signal<SalesPiPendingFlagRow[]>([]);
  readonly dcPendingInvoiceLines = signal<DcPendingInvoiceLineRow[]>([]);
  readonly lossSalesFlags = signal<LossSaleFlagRow[]>([]);
  readonly dashboardTime = signal(this.nowLabel());
  readonly activeModal = signal<GridPayload | null>(null);
  readonly inventoryDashboardConfig = inventoryDashboardConfig;

  readonly sectionLayout = signal<SectionLayoutItem[]>(this.loadSectionLayout());
  readonly dragOverId = signal<string | null>(null);
  readonly widthOptions = WIDTH_OPTIONS;
  private draggedId: string | null = null;

  readonly visibleSections = computed(() => this.sectionLayout().filter(item => !item.hidden));
  readonly hiddenSections = computed(() => this.sectionLayout().filter(item => item.hidden));

  readonly kpiTiles = computed<KpiTile[]>(() => {
    const k = this.summary()?.kpis;
    if (!k) return [];
    return [
      { label: 'Stock Value', value: this.fmt(k.stock_value), note: 'Qty on hand × cost price, all warehouses', icon: 'pi pi-chart-bar', tone: 'blue', key: 'stock_value' },
      { label: 'Out of Stock', value: String(k.out_of_stock_count), note: 'Products with zero qty on hand', icon: 'pi pi-exclamation-triangle', tone: 'rose', key: 'out_of_stock' },
      { label: 'Pending Purchase Orders', value: String(k.pending_purchase_orders), note: 'Not yet closed or cancelled', icon: 'pi pi-shopping-cart', tone: 'amber', key: 'pending_purchase_orders' },
      { label: 'Pending Sales Orders', value: String(k.pending_sales_orders), note: 'Not yet closed or cancelled', icon: 'pi pi-file', tone: 'amber', key: 'pending_sales_orders' },
      { label: 'Pending Dispatch', value: String(k.pending_dispatch), note: 'Delivery Challans posted, not yet invoiced', icon: 'pi pi-truck', tone: 'blue', key: 'pending_dispatch' },
      { label: "Today's Purchases", value: this.fmt(k.today_purchase_value), note: 'GRNs dated today', icon: 'pi pi-arrow-circle-down', tone: 'green', key: 'today_purchase_value' },
      { label: "Today's Sales", value: this.fmt(k.today_sales_value), note: 'Sales invoices dated today', icon: 'pi pi-arrow-circle-up', tone: 'green', key: 'today_sales_value' },
      { label: 'Sales Without PI', value: String(this.salesPiPendingFlags().length), note: 'Sold from GRN stock not yet vendor-invoiced', icon: 'pi pi-flag', tone: 'amber', key: 'sales_without_pi' },
      { label: 'Dispatched Without SI', value: String(this.dcPendingInvoiceLines().length), note: 'Delivery Challan stock deducted, not yet sales-invoiced', icon: 'pi pi-truck', tone: 'amber', key: 'dc_pending_invoice' },
      { label: 'Loss Sales', value: String(this.lossSalesFlags().length), note: 'Sold below current product cost, most recent lines', icon: 'pi pi-arrow-down', tone: 'rose', key: 'loss_sales' }
    ];
  });

  readonly financialCards = computed<KpiTile[]>(() => {
    const s = this.summary();
    if (!s) return [];
    const period = this.selectedPeriod();
    return [
      { label: 'Payables', value: this.fmt(s.payables.total), note: 'Outstanding to vendors, as of today', icon: 'pi pi-wallet', tone: 'rose', key: 'payables' },
      { label: 'Receivables', value: this.fmt(s.receivables.total), note: 'Outstanding from customers, as of today', icon: 'pi pi-inbox', tone: 'blue', key: 'receivables' },
      { label: 'Paid', value: this.fmt(s.cash_flow.paid), note: `${period}, posted Vendor Payments`, icon: 'pi pi-arrow-circle-up', tone: 'amber', key: 'paid' },
      { label: 'Received', value: this.fmt(s.cash_flow.received), note: `${period}, posted Customer Receipts`, icon: 'pi pi-arrow-circle-down', tone: 'green', key: 'received' }
    ];
  });

  readonly documentCards = computed<KpiTile[]>(() => {
    const k = this.summary()?.kpis;
    if (!k) return [];
    const period = this.selectedPeriod();
    return [
      { label: 'Purchases', value: this.fmt(k.purchases), note: `${period}, posted Purchase Invoices`, icon: 'pi pi-arrow-circle-down', tone: 'blue', key: 'purchases' },
      { label: 'Sales', value: this.fmt(k.sales), note: `${period}, posted Sales Invoices`, icon: 'pi pi-arrow-circle-up', tone: 'green', key: 'sales' },
      { label: 'Purchase Returns', value: this.fmt(k.purchase_returns), note: `${period}, posted Purchase Returns`, icon: 'pi pi-replay', tone: 'rose', key: 'purchase_returns' },
      { label: 'Sales Returns', value: this.fmt(k.sales_returns), note: `${period}, posted Sales Returns`, icon: 'pi pi-replay', tone: 'amber', key: 'sales_returns' }
    ];
  });

  readonly periodStockTransfers = computed(() =>
    this.stockTransfers().filter(row => this.inSelectedPeriod(row.transfer_date))
  );
  readonly periodProductionPlans = computed(() =>
    this.productionPlans().filter(row => this.inSelectedPeriod(row.plan_date))
  );
  readonly periodMaterialIssues = computed(() =>
    this.materialIssues().filter(row => this.inSelectedPeriod(row.issue_date))
  );
  readonly periodProductionEntries = computed(() =>
    this.productionEntries().filter(row => this.inSelectedPeriod(row.production_date))
  );
  readonly periodProductionReturns = computed(() =>
    this.productionReturns().filter(row => this.inSelectedPeriod(row.return_date))
  );

  readonly operationsCards = computed<KpiTile[]>(() => {
    const period = this.selectedPeriod();
    const transfers = this.periodStockTransfers();
    const plans = this.periodProductionPlans();
    const issues = this.periodMaterialIssues();
    const entries = this.periodProductionEntries();
    const returns = this.periodProductionReturns();
    return [
      { label: 'Stock Transfers', value: String(transfers.length), note: `${period}, all statuses`, icon: 'pi pi-sync', tone: 'blue', key: 'stock_transfers' },
      { label: 'Transferred Qty', value: this.fmtQty(this.totalTransferQty(transfers)), note: `${period}, moved between locations`, icon: 'pi pi-truck', tone: 'green', key: 'stock_transfer_qty' },
      { label: 'Production Plans', value: String(plans.length), note: `${period}, planned finished output`, icon: 'pi pi-calendar-plus', tone: 'blue', key: 'production_plans' },
      { label: 'Raw Issued', value: this.fmtQty(this.sumBy(issues, row => row.total_qty)), note: `${period}, material issued to production`, icon: 'pi pi-arrow-circle-up', tone: 'amber', key: 'material_issued' },
      { label: 'Finished Produced', value: this.fmtQty(this.sumBy(entries, row => row.produced_qty)), note: `${period}, physical stock added`, icon: 'pi pi-check-circle', tone: 'green', key: 'finished_production' },
      { label: 'Manufacturing Cost', value: this.fmt(this.sumBy(entries, row => row.production_cost)), note: `${period}, posted production cost`, icon: 'pi pi-wallet', tone: 'rose', key: 'manufacturing_cost' }
    ];
  });

  readonly payablesAgeing = computed(() => this.summary()?.payables?.ageing ?? []);
  readonly receivablesAgeing = computed(() => this.summary()?.receivables?.ageing ?? []);

  readonly payablesAgeingChart = computed<ChartSeries[]>(() => [{ label: 'Payables', data: this.payablesAgeing().map(a => a.amount) }]);
  readonly payablesAgeingLabels = computed(() => this.payablesAgeing().map(a => `${a.bucket}d`));
  readonly receivablesAgeingChart = computed<ChartSeries[]>(() => [{ label: 'Receivables', data: this.receivablesAgeing().map(a => a.amount) }]);
  readonly receivablesAgeingLabels = computed(() => this.receivablesAgeing().map(a => `${a.bucket}d`));

  readonly movementChartLabels = computed(() => (this.summary()?.daily_movement ?? []).map(p => this.fmtDate(p.date)));
  readonly movementChartSeries = computed<ChartSeries[]>(() => {
    const rows = this.summary()?.daily_movement ?? [];
    return [
      { label: 'Inward (GRN)', data: rows.map(r => r.inward) },
      { label: 'Outward (Sales)', data: rows.map(r => r.outward) }
    ];
  });

  readonly salesReturnsTrend = computed(() => this.summary()?.sales_returns_trend ?? []);
  readonly salesTrendChartLabels = computed(() => this.salesReturnsTrend().map(p => this.fmtDate(p.date)));
  readonly salesTrendChartSeries = computed<ChartSeries[]>(() => {
    const rows = this.salesReturnsTrend();
    return [
      { label: 'Sales', data: rows.map(r => r.sales_amount) },
      { label: 'Sales Returns', data: rows.map(r => r.sales_return_amount) }
    ];
  });

  readonly topSellingProducts = computed(() => this.summary()?.top_selling_products ?? []);
  readonly topSellingChartLabels = computed(() => this.topSellingProducts().map(p => p.product_name));
  readonly topSellingChartSeries = computed<ChartSeries[]>(() => [{ label: 'Sales Value', data: this.topSellingProducts().map(p => p.amount) }]);

  readonly returnedProducts = computed(() => this.summary()?.returned_products ?? []);
  readonly returnedChartLabels = computed(() => this.returnedProducts().map(p => p.product_name));
  readonly returnedChartSeries = computed<ChartSeries[]>(() => [{ label: 'Return Value', data: this.returnedProducts().map(p => p.return_amount) }]);

  readonly productSalesFunnel = computed<ProductFunnelStage[]>(() => {
    const rows = this.topSellingProducts().slice(0, 6);
    const max = Math.max(1, ...rows.map(r => r.amount));
    return rows.map(r => ({
      label: r.product_name,
      amount: r.amount,
      qty: r.qty,
      widthPct: Math.max(18, Math.round((r.amount / max) * 100))
    }));
  });

  readonly procurementFunnelStages = computed<FunnelStage[]>(() => {
    const f = this.summary()?.pipeline_funnel?.procurement;
    const base = Math.max(1, f?.po_count ?? 0);
    const raw: Array<Omit<FunnelStage, 'widthPct' | 'conversionPct' | 'valueLabel'>> = [
      { label: 'Purchase Orders', short: 'PO', count: f?.po_count ?? 0, value: f?.po_value ?? 0 },
      { label: 'Goods Receipts', short: 'GRN', count: f?.grn_count ?? 0, value: f?.grn_value ?? 0 },
      { label: 'Purchase Invoices', short: 'PI', count: f?.pi_count ?? 0, value: f?.pi_value ?? 0 }
    ];
    return raw.map(s => {
      const pct = Math.round((s.count / base) * 100);
      return { ...s, widthPct: Math.max(18, pct), conversionPct: pct, valueLabel: s.value > 0 ? ' · ' + this.fmt(s.value) : '' };
    });
  });

  readonly salesFunnelStages = computed<FunnelStage[]>(() => {
    const f = this.summary()?.pipeline_funnel?.sales;
    const base = Math.max(1, f?.so_count ?? 0);
    const raw: Array<Omit<FunnelStage, 'widthPct' | 'conversionPct' | 'valueLabel'>> = [
      { label: 'Sales Orders', short: 'SO', count: f?.so_count ?? 0, value: 0 },
      { label: 'Delivery Challans', short: 'DC', count: f?.dc_count ?? 0, value: 0 },
      { label: 'Sales Invoices', short: 'SI', count: f?.si_count ?? 0, value: f?.si_value ?? 0 }
    ];
    return raw.map(s => {
      const pct = Math.round((s.count / base) * 100);
      return { ...s, widthPct: Math.max(18, pct), conversionPct: pct, valueLabel: s.value > 0 ? ' · ' + this.fmt(s.value) : '' };
    });
  });

  readonly payablesReceivablesTotal = computed(() => (this.summary()?.payables?.total ?? 0) + (this.summary()?.receivables?.total ?? 0));
  readonly payablesReceivablesSlices = computed<DonutSlice[]>(() => [
    { label: 'Payables', value: this.summary()?.payables?.total ?? 0 },
    { label: 'Receivables', value: this.summary()?.receivables?.total ?? 0 }
  ]);

  readonly transferRouteRows = computed(() => {
    const routes = new Map<string, number>();
    this.periodStockTransfers().forEach(row => {
      const label = `${this.transferLocation(row, 'from')} to ${this.transferLocation(row, 'to')}`;
      routes.set(label, (routes.get(label) ?? 0) + this.stockTransferQty(row));
    });
    return Array.from(routes.entries())
      .map(([label, qty]) => ({ label, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 6);
  });
  readonly transferRouteLabels = computed(() => this.transferRouteRows().map(row => row.label));
  readonly transferRouteSeries = computed<ChartSeries[]>(() => [{ label: 'Qty', data: this.transferRouteRows().map(row => row.qty) }]);
  readonly transferStatusSlices = computed<DonutSlice[]>(() => this.statusSlices(this.periodStockTransfers()));
  readonly transferStatusTotal = computed(() => this.periodStockTransfers().length);
  readonly transferQtyTotal = computed(() => this.totalTransferQty(this.periodStockTransfers()));
  readonly transferStatusTotalText = computed(() => String(this.transferStatusTotal()));

  readonly manufacturingQuantityLabels = computed(() => ['Planned', 'Raw Issued', 'Finished', 'Rejected', 'Wastage', 'Returned']);
  readonly manufacturingQuantitySeries = computed<ChartSeries[]>(() => [{
    label: 'Qty',
    data: [
      this.sumBy(this.periodProductionPlans(), row => row.planned_qty),
      this.sumBy(this.periodMaterialIssues(), row => row.total_qty),
      this.sumBy(this.periodProductionEntries(), row => row.produced_qty),
      this.sumBy(this.periodProductionEntries(), row => row.rejected_qty),
      this.sumBy(this.periodProductionEntries(), row => row.wastage_qty),
      this.sumBy(this.periodProductionReturns(), row => row.total_qty)
    ]
  }]);
  readonly manufacturingDocSlices = computed<DonutSlice[]>(() => [
    { label: 'Plans', value: this.periodProductionPlans().length },
    { label: 'Issues', value: this.periodMaterialIssues().length },
    { label: 'Entries', value: this.periodProductionEntries().length },
    { label: 'Returns', value: this.periodProductionReturns().length }
  ]);
  readonly manufacturingDocTotal = computed(() =>
    this.periodProductionPlans().length +
    this.periodMaterialIssues().length +
    this.periodProductionEntries().length +
    this.periodProductionReturns().length
  );
  readonly finishedProducedTotal = computed(() => this.sumBy(this.periodProductionEntries(), row => row.produced_qty));
  readonly manufacturingDocTotalText = computed(() => String(this.manufacturingDocTotal()));

  readonly filteredStockRows = computed<DashboardStockRow[]>(() => this.summary()?.stock_by_product ?? []);

  readonly filteredTransactions = computed<DashboardTransactionRow[]>(() => this.summary()?.recent_transactions ?? []);

  constructor() {
    this.loadSummary();
    this.loadOperationalRows();
    this.loadSalesPiPendingFlags();
    this.loadDcPendingInvoiceLines();
    this.loadLossSalesFlags();
  }

  selectPeriod(period: DashboardPeriod): void {
    this.selectedPeriod.set(period);
    this.loadSummary();
  }

  refresh(): void {
    this.dashboardTime.set(this.nowLabel());
    this.loadSummary();
    this.loadOperationalRows();
    this.loadSalesPiPendingFlags();
    this.loadDcPendingInvoiceLines();
    this.loadLossSalesFlags();
  }

  sectionTitle(id: string): string {
    return SECTION_TITLES[id]?.title ?? id;
  }

  sectionSubtitle(id: string): string {
    return SECTION_TITLES[id]?.subtitle ?? '';
  }

  resetSectionOrder(): void {
    const layout = DEFAULT_SECTION_LAYOUT.map(item => ({ ...item }));
    this.sectionLayout.set(layout);
    this.persistSectionLayout(layout);
  }

  setWidth(id: string, width: number): void {
    const layout = this.sectionLayout().map(item => item.id === id ? { ...item, width } : item);
    this.sectionLayout.set(layout);
    this.persistSectionLayout(layout);
  }

  hideSection(id: string): void {
    const layout = this.sectionLayout().map(item => item.id === id ? { ...item, hidden: true } : item);
    this.sectionLayout.set(layout);
    this.persistSectionLayout(layout);
  }

  showSection(id: string): void {
    const layout = this.sectionLayout().map(item => item.id === id ? { ...item, hidden: false } : item);
    this.sectionLayout.set(layout);
    this.persistSectionLayout(layout);
  }

  onSectionDragStart(id: string, ev: DragEvent): void {
    this.draggedId = id;
    ev.dataTransfer?.setData('text/plain', id);
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move';
  }

  onSectionDragEnter(id: string, ev: DragEvent): void {
    ev.preventDefault();
    if (this.draggedId && this.draggedId !== id) this.dragOverId.set(id);
  }

  onSectionDragOver(ev: DragEvent): void {
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
  }

  onSectionDrop(targetId: string, ev: DragEvent): void {
    ev.preventDefault();
    const draggedId = this.draggedId;
    this.dragOverId.set(null);
    this.draggedId = null;
    if (!draggedId || draggedId === targetId) return;

    const layout = [...this.sectionLayout()];
    const from = layout.findIndex(item => item.id === draggedId);
    const to = layout.findIndex(item => item.id === targetId);
    if (from === -1 || to === -1) return;

    const [moved] = layout.splice(from, 1);
    layout.splice(to, 0, moved);
    this.sectionLayout.set(layout);
    this.persistSectionLayout(layout);
  }

  onSectionDragEnd(): void {
    this.draggedId = null;
    this.dragOverId.set(null);
  }

  private loadSectionLayout(): SectionLayoutItem[] {
    try {
      const raw = localStorage.getItem(SECTION_LAYOUT_KEY);
      if (!raw) return DEFAULT_SECTION_LAYOUT.map(item => ({ ...item }));

      const saved: SectionLayoutItem[] = JSON.parse(raw);
      const defaultsById = new Map(DEFAULT_SECTION_LAYOUT.map(item => [item.id, item]));
      const merged: SectionLayoutItem[] = saved
        .filter(item => defaultsById.has(item.id))
        .map(item => ({
          id: item.id,
          width: (WIDTH_OPTIONS as readonly number[]).includes(item.width) ? item.width : defaultsById.get(item.id)!.width,
          hidden: !!item.hidden
        }));

      const seen = new Set(merged.map(item => item.id));
      for (const item of DEFAULT_SECTION_LAYOUT) {
        if (!seen.has(item.id)) merged.push({ ...item });
      }
      return merged;
    } catch {
      return DEFAULT_SECTION_LAYOUT.map(item => ({ ...item }));
    }
  }

  private persistSectionLayout(layout: SectionLayoutItem[]): void {
    try { localStorage.setItem(SECTION_LAYOUT_KEY, JSON.stringify(layout)); } catch { /* storage unavailable/full — layout just won't persist */ }
  }

  // Excel exports use the Accounts-style .xlsx (company letterhead rows,
  // bold headers, bordered cells) shared by every Inventory screen.
  exportStockCsv(): void {
    const rows = this.filteredStockRows();
    this.exportService.excel({
      title: 'Stock By Product',
      columns: ['Product', 'Category', 'Warehouse', 'Qty On Hand', 'Qty Reserved', 'Value'],
      rows: rows.map(r => [r.product_name, r.category, r.warehouse, r.qty_on_hand, r.qty_reserved, r.value].map(v => String(v ?? ''))),
      fileName: 'Stock By Product'
    });
  }

  openCard(card: KpiTile): void {
    this.activeModal.set(this.buildPayload(card));
  }

  closeModal(): void {
    this.activeModal.set(null);
  }

  exportModalCsv(): void {
    const payload = this.activeModal();
    if (!payload) return;
    this.exportService.excel({
      title: payload.title,
      columns: payload.headers.map(header => String(header)),
      rows: payload.rows.map(row => row.map(cell => String(cell ?? ''))),
      fileName: payload.title
    });
  }

  fmt(n: number | undefined): string {
    return '₹ ' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  fmtQty(n: number | undefined): string {
    return Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }

  fmtDate(d?: string): string {
    return d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—';
  }

  private buildPayload(card: KpiTile): GridPayload {
    // Stock Value / Out of Stock are derived client-side from the already-fetched
    // stock_by_product list — no dedicated backend drilldown needed for these two.
    if (card.key === 'stock_value' || card.key === 'out_of_stock') {
      const rows = this.summary()?.stock_by_product ?? [];
      const filtered = card.key === 'out_of_stock' ? rows.filter(r => r.qty_on_hand <= 0) : rows;
      return {
        title: card.label,
        headers: ['Product', 'Category', 'Warehouse', 'Qty On Hand', 'Reserved', 'Value'],
        rows: filtered.map(r => [r.product_name, r.category, r.warehouse, String(r.qty_on_hand), String(r.qty_reserved), this.fmt(r.value)])
      };
    }

    if (card.key === 'sales_without_pi') {
      const rows = this.salesPiPendingFlags();
      return {
        title: card.label,
        headers: ['Sales Invoice', 'Product', 'Warehouse', 'Qty Sold', 'Pending PI Qty', 'Flagged'],
        rows: rows.map(r => [
          r.doc_number || '—', r.product_name || '—', r.warehouse_name || '—',
          String(r.qty_sold), String(r.pending_pi_qty), this.fmtDate(r.flagged_at)
        ])
      };
    }

    if (card.key === 'dc_pending_invoice') {
      const rows = this.dcPendingInvoiceLines();
      return {
        title: card.label,
        headers: ['Delivery Challan', 'Date', 'Customer', 'Product', 'Warehouse', 'Dispatched', 'Invoiced', 'Pending'],
        rows: rows.map(r => [
          r.dc_number || '—', this.fmtDate(r.dc_date), r.customer_name || '—', r.product_name || '—', r.warehouse_name || '—',
          String(r.dispatch_qty), String(r.invoiced_qty), String(r.pending_qty)
        ])
      };
    }

    if (card.key === 'loss_sales') {
      const rows = this.lossSalesFlags();
      return {
        title: card.label,
        headers: ['Sales Invoice', 'Date', 'Customer', 'Product', 'Qty', 'Rate', 'Cost', 'Loss Amount', 'Loss %'],
        rows: rows.map(r => [
          r.doc_number || '—', this.fmtDate(r.doc_date), r.customer_name || '—', r.product_name || '—',
          String(r.qty), this.fmt(r.rate), this.fmt(r.cost_price), this.fmt(r.loss_amount), `${r.loss_percent}%`
        ])
      };
    }

    if (card.key === 'stock_transfers' || card.key === 'stock_transfer_qty') {
      const rows = this.periodStockTransfers();
      return {
        title: card.label,
        headers: ['Transfer No', 'Date', 'From', 'To', 'Qty', 'Status'],
        rows: rows.map(r => [
          r.transfer_number || '—',
          this.fmtDate(r.transfer_date),
          this.transferLocation(r, 'from'),
          this.transferLocation(r, 'to'),
          this.fmtQty(this.stockTransferQty(r)),
          r.status || '—'
        ])
      };
    }

    if (card.key === 'production_plans') {
      const rows = this.periodProductionPlans();
      return {
        title: card.label,
        headers: ['Plan No', 'Date', 'Finished Product', 'Planned Qty', 'Location', 'Status'],
        rows: rows.map(r => [
          r.plan_number || '—',
          this.fmtDate(r.plan_date),
          r.finished_product_name || '—',
          this.fmtQty(r.planned_qty),
          r.warehouse_name || r.branch_name || '—',
          r.status || '—'
        ])
      };
    }

    if (card.key === 'material_issued') {
      const rows = this.periodMaterialIssues();
      return {
        title: card.label,
        headers: ['Issue No', 'Date', 'Plan', 'From', 'Issued Qty', 'Status'],
        rows: rows.map(r => [
          r.issue_number || '—',
          this.fmtDate(r.issue_date),
          r.production_plan_number || '—',
          r.from_warehouse_name || r.from_branch_name || '—',
          this.fmtQty(r.total_qty),
          r.status || '—'
        ])
      };
    }

    if (card.key === 'finished_production' || card.key === 'manufacturing_cost') {
      const rows = this.periodProductionEntries();
      return {
        title: card.label,
        headers: ['Production No', 'Date', 'Finished Product', 'Produced', 'Rejected', 'Wastage', 'Cost', 'To', 'Status'],
        rows: rows.map(r => [
          r.production_number || '—',
          this.fmtDate(r.production_date),
          r.finished_product_name || '—',
          this.fmtQty(r.produced_qty),
          this.fmtQty(r.rejected_qty),
          this.fmtQty(r.wastage_qty),
          this.fmt(r.production_cost),
          r.to_warehouse_name || r.to_branch_name || '—',
          r.status || '—'
        ])
      };
    }

    const isOutstanding = card.key === 'payables' || card.key === 'receivables';
    const drillRows: DashboardDrilldownRow[] = this.summary()?.drilldowns?.[card.key] ?? [];
    return {
      title: card.label,
      headers: isOutstanding
        ? ['Document', 'Date', 'Party', 'Outstanding', 'Age']
        : ['Document', 'Date', 'Party', 'Amount', 'Status'],
      rows: drillRows.map(r => [r.doc_number || '—', this.fmtDate(r.date), r.party || '—', this.fmt(r.amount), r.status || '—'])
    };
  }

  private loadSummary(): void {
    const { from, to } = this.dateRangeFor(this.selectedPeriod());
    this.loading.set(true);
    this.loadError.set('');
    this.dashboardService.getDashboardSummary(from, to)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.loading.set(false);
          if (res.success && res.data) this.summary.set(res.data);
          else this.loadError.set(res.message || 'Unable to load dashboard.');
        },
        error: err => {
          this.loading.set(false);
          this.loadError.set(err?.error?.message || 'Unable to load dashboard.');
        }
      });
  }

  // Not period-scoped (most-recent flags, regardless of the KPI date filter)
  // so this is fetched once, not re-fetched on selectPeriod().
  private loadSalesPiPendingFlags(): void {
    this.dashboardService.getSalesPiPendingFlags()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => { if (res.success && res.data) this.salesPiPendingFlags.set(res.data); },
        error: () => {}
      });
  }

  // Live/derived (not a snapshot), so re-fetched on the same cadence as
  // loadSalesPiPendingFlags() rather than only once — see 103_dc_pending_
  // invoice_dashboard.sql.
  private loadDcPendingInvoiceLines(): void {
    this.dashboardService.getDcPendingInvoiceLines()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => { if (res.success && res.data) this.dcPendingInvoiceLines.set(res.data); },
        error: () => {}
      });
  }

  // Live/derived (not a snapshot -- current cost_price joined against
  // historical rate on every call), so re-fetched on the same cadence as
  // loadDcPendingInvoiceLines() rather than only once — see
  // 155_loss_sales_report.sql.
  private loadLossSalesFlags(): void {
    this.dashboardService.getLossSalesFlags()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => { if (res.success && res.data) this.lossSalesFlags.set(res.data); },
        error: () => {}
      });
  }

  private loadOperationalRows(): void {
    this.transactionsService.getStockTransfers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => { if (res.success && res.data) this.stockTransfers.set(res.data); },
        error: () => {}
      });

    this.transactionsService.getProductionPlans()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => { if (res.success && res.data) this.productionPlans.set(res.data); },
        error: () => {}
      });

    this.transactionsService.getMaterialIssueProductions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => { if (res.success && res.data) this.materialIssues.set(res.data); },
        error: () => {}
      });

    this.transactionsService.getProductionEntries()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => { if (res.success && res.data) this.productionEntries.set(res.data); },
        error: () => {}
      });

    this.transactionsService.getProductionReturns()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => { if (res.success && res.data) this.productionReturns.set(res.data); },
        error: () => {}
      });
  }

  private dateRangeFor(period: DashboardPeriod): { from: string; to: string } {
    const to = new Date();
    const from = new Date();
    if (period === 'week') from.setDate(to.getDate() - 6);
    else if (period === 'month') from.setDate(to.getDate() - 29);
    else if (period === 'quarter') from.setDate(to.getDate() - 89);
    return { from: this.isoDate(from), to: this.isoDate(to) };
  }

  private isoDate(d: Date): string { return d.toISOString().slice(0, 10); }

  private inSelectedPeriod(value?: string): boolean {
    if (!value) return false;
    const docTime = new Date(value).getTime();
    if (Number.isNaN(docTime)) return false;
    const { from, to } = this.dateRangeFor(this.selectedPeriod());
    const fromTime = new Date(`${from}T00:00:00`).getTime();
    const toTime = new Date(`${to}T23:59:59`).getTime();
    return docTime >= fromTime && docTime <= toTime;
  }

  private sumBy<T>(rows: T[], pick: (row: T) => number | null | undefined): number {
    return rows.reduce((sum, row) => sum + Number(pick(row) || 0), 0);
  }

  private totalTransferQty(rows: StockTransfer[]): number {
    return this.sumBy(rows, row => this.stockTransferQty(row));
  }

  private stockTransferQty(row: StockTransfer): number {
    const headerQty = Number(row.total_qty || 0);
    if (headerQty > 0) return headerQty;
    return this.sumBy(row.items ?? [], item => item.qty);
  }

  private transferLocation(row: StockTransfer, side: 'from' | 'to'): string {
    if (side === 'from') return row.from_warehouse_name || row.from_branch_name || 'Unassigned';
    return row.to_warehouse_name || row.to_branch_name || 'Unassigned';
  }

  private statusSlices(rows: Array<{ status?: string }>): DonutSlice[] {
    const map = new Map<string, number>();
    rows.forEach(row => {
      const label = this.titleCase(row.status || 'draft');
      map.set(label, (map.get(label) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
  }

  private titleCase(value: string): string {
    return value
      .replace(/[_-]+/g, ' ')
      .trim()
      .replace(/\w\S*/g, part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()) || 'Draft';
  }

  private nowLabel(): string {
    return new Date().toLocaleString('en-IN', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }
}
