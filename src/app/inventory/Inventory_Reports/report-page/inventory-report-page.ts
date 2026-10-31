import { CommonModule, formatDate } from '@angular/common';
import { Component, OnInit, OnDestroy, computed, inject, signal, DestroyRef, ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { NgSelectModule } from '@ng-select/ng-select';
import { DatePickerModule } from 'primeng/datepicker';
import {
  INVENTORY_COMMON_REPORT_FILTERS,
  INVENTORY_REPORT_PRIMARY_FILTERS,
  InventoryReportColumn,
  InventoryReportDefinition,
  InventoryReportFilterDefinition,
  InventoryReportFilterKey,
  InventoryReportFilterValue,
  InventoryReportFilters,
  InventoryReportRow
} from '../shared/inventory-report.models';
import {
  INVENTORY_REPORTS,
  findInventoryReport,
  inventoryReportGroupIcon,
  inventoryReportGroupTitle
} from '../shared/inventory-report.registry';
import { InventoryReportsService } from '../shared/inventory-reports.service';
import { InventoryConfigService } from '../../Inventory_Shared/inventory-config.service';
import { InventoryExportDocument, InventoryExportService } from '../../Inventory_Shared/inventory-export.service';
import { StatCardComponent } from '../../Inventory_Shared/stat-card/stat-card.component';

interface BranchWarehouseOption {
  label: string;
  key: 'branchId' | 'warehouseId';
  group: string;
}

interface MasterReportOption {
  label: string;
  id?: number | null;
}

interface ReportLocationScope {
  isCompanyAdmin: boolean;
  branchId: number | null;
  branchName: string;
  warehouseId: number | null;
  warehouseName: string;
}

@Component({
  selector: 'app-inventory-report-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NgSelectModule, DatePickerModule, StatCardComponent],
  templateUrl: './inventory-report-page.html'
})
export class InventoryReportPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly reportsService = inject(InventoryReportsService);
  private readonly configService = inject(InventoryConfigService);
  private readonly exportService = inject(InventoryExportService);
  private readonly destroyRef = inject(DestroyRef);

  readonly pageSizes = [10, 25, 50, 100];
  readonly pageSizeOptions = this.pageSizes.map(size => ({ label: `${size} rows`, value: size }));
  readonly report = signal<InventoryReportDefinition>(INVENTORY_REPORTS[0]);
  readonly filters = signal<InventoryReportFilters>({});
  readonly rows = signal<InventoryReportRow[]>([]);
  readonly summary = signal<Record<string, string | number>>({});
  readonly totalRecords = signal(0);
  readonly page = signal(1);
  readonly pageSize = signal(25);
  readonly searchText = signal('');
  readonly loading = signal(false);
  readonly loadedFromApi = signal(false);
  readonly errorMessage = signal('');
  readonly infoMessage = signal('');
  readonly activeRow = signal<InventoryReportRow | null>(null);
  readonly sortColumn = signal('');
  readonly sortDirection = signal<'asc' | 'desc'>('asc');
  readonly groupBy = signal('');
  readonly showAdvancedFilters = signal(false);
  readonly showColumnChooser = signal(false);
  readonly visibleColumnKeys = signal<string[]>([]);
  readonly searchExpanded = signal(false);

  @ViewChild('searchInput') private searchInputRef?: ElementRef<HTMLInputElement>;

  // Real signed-in company (authCompany, set at login) — shown as a
  // read-only badge instead of the old Company filter, which only ever
  // offered a hardcoded list of demo companies unrelated to who's signed in.
  readonly currentCompanyName = signal(this.readCurrentCompanyName());
  readonly reportLocationScope = signal<ReportLocationScope>(this.readReportLocationScope());

  private readCurrentCompanyName(): string {
    try {
      const raw = sessionStorage.getItem('authCompany');
      if (!raw) return '';
      const company = JSON.parse(raw);
      return company?.companyName || '';
    } catch {
      return '';
    }
  }

  private readReportLocationScope(): ReportLocationScope {
    const user = this.readStorageObject<{ isSuperAdmin?: boolean }>('authUser', {});
    const roles = this.readStorageObject<Array<{ roleType?: string }>>('authRoles', []);
    const companyDetails = this.readStorageObject<{ branchName?: string }>('CompanyDetails', {});
    const branches = this.readStorageObject<Array<{ id?: number; branchName?: string }>>('authBranches', []);
    const branchId = this.positiveNumber(sessionStorage.getItem('branchId'));
    const warehouseId = this.positiveNumber(sessionStorage.getItem('warehouseId'));
    const branchName = companyDetails.branchName ||
      branches.find(branch => Number(branch.id || 0) === branchId)?.branchName ||
      '';

    return {
      isCompanyAdmin: user.isSuperAdmin === true ||
        roles.some(role => String(role.roleType ?? '').toLowerCase() === 'company_admin'),
      branchId,
      branchName,
      warehouseId,
      warehouseName: sessionStorage.getItem('warehouseName') || ''
    };
  }

  private readStorageObject<T>(key: string, fallback: T): T {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) as T : fallback;
    } catch {
      return fallback;
    }
  }

  private positiveNumber(value: string | null): number | null {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  // Real, company-scoped master data (branches/segments/warehouses/etc. that
  // actually belong to the signed-in company) to replace the static demo
  // name lists in INVENTORY_COMMON_REPORT_FILTERS, which mixed in branches
  // and segments from unrelated sample tenants (hotel, restaurant, real
  // estate...). Populated once; filterDefinitions() overrides options with
  // these when available.
  readonly masterOptions = signal<Partial<Record<InventoryReportFilterKey, string[]>>>({});
  private readonly masterOptionIds = signal<Partial<Record<InventoryReportFilterKey, Record<string, number>>>>({});

  constructor() {
    this.loadMasterOptions();
  }

  private loadMasterOptions(): void {
    const set = (key: InventoryReportFilterKey, options: MasterReportOption[]): void => {
      const byLabel = new Map<string, MasterReportOption>();
      options.forEach(option => {
        const label = option.label?.trim();
        if (!label || byLabel.has(label)) return;
        byLabel.set(label, { ...option, label });
      });

      const unique = Array.from(byLabel.values()).sort((a, b) => a.label.localeCompare(b.label));
      const labels = unique.map(option => option.label);
      const ids = unique.reduce<Record<string, number>>((acc, option) => {
        if (typeof option.id === 'number' && Number.isFinite(option.id)) acc[option.label] = option.id;
        return acc;
      }, {});

      this.masterOptions.update(current => ({ ...current, [key]: labels }));
      this.masterOptionIds.update(current => ({ ...current, [key]: ids }));
      if (key === 'segmentId') this.applySingleSegmentDefault(labels);
    };

    const load = <T>(
      key: InventoryReportFilterKey,
      source: Observable<{ data?: T[] }>,
      pickLabel: (item: T) => string | undefined,
      pickId: (item: T) => number | null | undefined
    ): void => {
      source.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: res => set(key, (res.data ?? []).map(item => ({ label: pickLabel(item) ?? '', id: pickId(item) }))),
        error: () => set(key, [])
      });
    };

    load('branchId', this.configService.getBranchesInv(), item => item.branch_name, item => item.branch_id ?? item.id);
    load('segmentId', this.configService.getSegments(), item => item.segment_name, item => item.id);
    load('warehouseId', this.configService.getWarehouses(), item => item.warehouse_name, item => item.id);
    load('productId', this.configService.getProducts(), item => item.product_name, item => item.id);
    load('productCategory', this.configService.getCategories(), item => item.category_name, item => item.id);
    load('brand', this.configService.getBrands(), item => item.brand_name, item => item.id);
    load('hsnSac', this.configService.getHsnSac(), item => item.code, item => item.id);
    load('customerId', this.configService.getCustomers(), item => item.customer_name, item => item.id);
    load('supplierId', this.configService.getVendors(), item => item.vendor_name, item => item.id);
    load('uom', this.configService.getUoms(), item => item.uom_symbol || item.uom_name, item => item.id);
  }

  readonly groupTitle = computed(() => inventoryReportGroupTitle(this.report().groupId));
  readonly groupIcon = computed(() => inventoryReportGroupIcon(this.report().groupId));
  readonly groupByOptions = computed(() => [
    { label: 'No group', value: '' },
    ...this.report().columns.map(column => ({ label: `Group by ${column.label}`, value: column.key }))
  ]);

  readonly filterDefinitions = computed(() => {
    const allowed = new Set<InventoryReportFilterKey>(this.report().filters);
    const dynamic = this.masterOptions();
    return INVENTORY_COMMON_REPORT_FILTERS.filter(filter => allowed.has(filter.key))
      .map(filter => dynamic[filter.key] ? { ...filter, options: dynamic[filter.key] } : filter);
  });

  // Stable computed so ng-select gets the same array reference between CD cycles — prevents NG0103 infinite loop
  readonly filterMultiValues = computed<Record<InventoryReportFilterKey, string[]>>(() => {
    const filters = this.filters();
    return INVENTORY_COMMON_REPORT_FILTERS.reduce<Record<InventoryReportFilterKey, string[]>>(
      (acc, { key }) => {
        const value = filters[key];
        acc[key] = Array.isArray(value)
          ? value
          : !value || value instanceof Date
          ? []
          : String(value).split(',').map(s => s.trim()).filter(Boolean);
        return acc;
      },
      {} as Record<InventoryReportFilterKey, string[]>
    );
  });

  readonly primaryFilterDefinitions = computed(() => {
    const primary = new Set<InventoryReportFilterKey>(INVENTORY_REPORT_PRIMARY_FILTERS);
    return this.filterDefinitions().filter(filter => primary.has(filter.key));
  });

  readonly advancedFilterDefinitions = computed(() => {
    const primary = new Set<InventoryReportFilterKey>(INVENTORY_REPORT_PRIMARY_FILTERS);
    return this.filterDefinitions().filter(filter => !primary.has(filter.key));
  });

  // Segment / Financial Year live in the page header now (alongside the
  // company/phase badges) instead of the filter row, per redesign.
  readonly headerFilterDefinitions = computed(() =>
    this.filterDefinitions().filter(filter => filter.key === 'segmentId' || filter.key === 'financialYear')
  );

  readonly segmentFilterDefinition = computed(() =>
    this.filterDefinitions().find(filter => filter.key === 'segmentId') ?? null
  );

  readonly segmentOptions = computed(() => this.segmentFilterDefinition()?.options ?? []);

  readonly singleSegmentName = computed(() => {
    const options = this.segmentOptions();
    return options.length === 1 ? options[0] : '';
  });

  // Branch/Warehouse collapse into one combined field and From/To collapse
  // into one date-range field (both rendered separately below), so they're
  // excluded from the generic primary-filter loop.
  private static readonly EMBEDDED_FILTER_KEYS = new Set<InventoryReportFilterKey>([
    'segmentId', 'financialYear', 'branchId', 'warehouseId', 'fromDate', 'toDate'
  ]);

  readonly bandFilterDefinitions = computed(() =>
    this.primaryFilterDefinitions().filter(filter => !InventoryReportPageComponent.EMBEDDED_FILTER_KEYS.has(filter.key))
  );

  // All primary filters live in the header now (title col-6 / filters col-6,
  // wrapped into two rows) — segment + financial year plus every other
  // primary filter this report declares, so nothing spills into a second
  // filter row below the header. Branch/Warehouse and the date range are
  // still rendered as their own combined fields (see showBranchWarehouseField/
  // showDateRangeField below), so they're not duplicated here.
  readonly inlineFilterDefinitions = computed(() => [
    ...this.headerFilterDefinitions(),
    ...this.bandFilterDefinitions()
  ]);

  readonly inlineFilterDefinitionsAfterSegment = computed(() =>
    this.inlineFilterDefinitions().filter(filter => filter.key !== 'segmentId')
  );

  readonly showBranchWarehouseField = computed(() => {
    const allowed = new Set(this.report().filters);
    return allowed.has('branchId') || allowed.has('warehouseId');
  });

  readonly showDateRangeField = computed(() => {
    const allowed = new Set(this.report().filters);
    return allowed.has('fromDate') || allowed.has('toDate');
  });

  // Stock Summary shows From Date / To Date as two separate pickers instead of
  // the single range picker; both still write the same fromDate/toDate filters.
  readonly separateFromToDates = computed(() => this.report().key === 'stockSummary');

  // Stock Summary's location filter is "Branch" only — no warehouses listed.
  readonly branchOnlyLocation = computed(() => this.report().key === 'stockSummary');

  // Upper limit for the To Date picker (no future dates).
  readonly todayDate = new Date();

  readonly activeLocationOption = computed<BranchWarehouseOption | null>(() => {
    const scope = this.reportLocationScope();
    if (scope.warehouseId) {
      return {
        label: scope.warehouseName || `Warehouse ${scope.warehouseId}`,
        key: 'warehouseId',
        group: 'Warehouse'
      };
    }
    if (scope.branchId) {
      return {
        label: scope.branchName || `Branch ${scope.branchId}`,
        key: 'branchId',
        group: 'Branch'
      };
    }
    return null;
  });

  readonly branchWarehouseLocked = computed(() => !this.reportLocationScope().isCompanyAdmin && !!this.activeLocationOption());
  readonly branchWarehousePlaceholder = computed(() =>
    // Previous: this.branchWarehouseLocked() ? 'Current branch / warehouse' : 'All branches / warehouses'
    this.branchOnlyLocation()
      ? (this.branchWarehouseLocked() ? 'Current branch' : 'All branches')
      : (this.branchWarehouseLocked() ? 'Current branch / warehouse' : 'All branches / warehouses')
  );

  readonly branchWarehouseCaption = computed(() => {
    const active = this.activeLocationOption();
    if (this.branchWarehouseLocked() && active) return `${active.group}: ${active.label}`;
    const selected = this.branchWarehouseSelected().length;
    // Previous: return selected ? `${selected} selected` : 'All branches and warehouses';
    return selected ? `${selected} selected` : (this.branchOnlyLocation() ? 'All branches' : 'All branches and warehouses');
  });

  // Branch and Warehouse are both "where" filters, so they're offered as one
  // grouped multiselect instead of two separate dropdowns — pick branches,
  // warehouses, or both, individually.
  readonly branchWarehouseOptions = computed<BranchWarehouseOption[]>(() => {
    const dynamic = this.masterOptions();
    const branches = (dynamic.branchId ?? []).map(label => ({ label, key: 'branchId' as const, group: 'Branch' }));
    const warehouses = (dynamic.warehouseId ?? []).map(label => ({ label, key: 'warehouseId' as const, group: 'Warehouse' }));
    // Previous: const options = [...branches, ...warehouses];
    const options = this.branchOnlyLocation() ? branches : [...branches, ...warehouses];
    const active = this.activeLocationOption();
    // Previous: if (active && !options.some(option => option.key === active.key && option.label === active.label)) {
    if (active && !(this.branchOnlyLocation() && active.key === 'warehouseId')
        && !options.some(option => option.key === active.key && option.label === active.label)) {
      return [active, ...options];
    }
    return options;
  });

  readonly branchWarehouseSelected = computed<BranchWarehouseOption[]>(() => {
    const active = this.activeLocationOption();
    if (this.branchWarehouseLocked() && active) return [active];

    const values = this.filterMultiValues();
    const branchSet = new Set(values.branchId ?? []);
    const warehouseSet = new Set(values.warehouseId ?? []);
    return this.branchWarehouseOptions().filter(option =>
      (option.key === 'branchId' && branchSet.has(option.label)) ||
      (option.key === 'warehouseId' && warehouseSet.has(option.label))
    );
  });

  readonly dateRangeValue = computed<Date[] | null>(() => {
    const from = this.filterDateValue('fromDate');
    const to = this.filterDateValue('toDate');
    return from || to ? [from as Date, to as Date] : null;
  });

  readonly dateRangeSummary = computed(() => {
    const from = this.filterDateValue('fromDate');
    const to = this.filterDateValue('toDate');
    if (from && to) return `${this.shortDate(from)} to ${this.shortDate(to)}`;
    if (from) return `From ${this.shortDate(from)}`;
    if (to) return `Until ${this.shortDate(to)}`;
    return 'All dates';
  });

  readonly visibleColumns = computed(() => {
    const selected = this.visibleColumnKeys();
    return this.report().columns.filter(column => selected.includes(column.key));
  });

  readonly filteredRows = computed(() => this.rows().filter(row => this.matchesActiveFilters(row)));

  readonly searchableRows = computed(() => {
    const search = this.searchText().trim().toLowerCase();
    const rows = this.filteredRows();
    if (!search) return rows;
    return rows.filter(row =>
      Object.values(row).some(value => String(value ?? '').toLowerCase().includes(search))
    );
  });

  readonly sortedRows = computed(() => {
    const rows = [...this.searchableRows()];
    const columnKey = this.sortColumn();
    if (!columnKey) return rows;

    const column = this.report().columns.find(item => item.key === columnKey);
    const direction = this.sortDirection();

    return rows.sort((left, right) => {
      const leftValue = this.sortValue(left[columnKey], column);
      const rightValue = this.sortValue(right[columnKey], column);

      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        return direction === 'asc' ? leftValue - rightValue : rightValue - leftValue;
      }

      const result = String(leftValue).localeCompare(String(rightValue), undefined, {
        numeric: true,
        sensitivity: 'base'
      });
      return direction === 'asc' ? result : -result;
    });
  });

  readonly groupedRows = computed(() => {
    const groupKey = this.groupBy();
    const rows = this.sortedRows();
    if (!groupKey) return [{ label: '', rows }];

    const groups = new Map<string, InventoryReportRow[]>();
    rows.forEach(row => {
      const label = String(row[groupKey] ?? 'Not specified');
      groups.set(label, [...(groups.get(label) ?? []), row]);
    });

    return Array.from(groups.entries()).map(([label, groupRows]) => ({ label, rows: groupRows }));
  });

  readonly summaryCards = computed(() => {
    const summary = this.summary();
    return (this.report().summaryCards ?? []).map(card => ({
      ...card,
      value: this.formatSummaryValue(summary[card.valueKey], card.fallback)
    }));
  });

  readonly totals = computed(() => {
    const totals: Record<string, string> = {};
    this.visibleColumns().forEach(column => {
      if (!column.total) return;
      const total = this.sortedRows().reduce((sum, row) => sum + this.numberValue(row[column.key]), 0);
      totals[column.key] = this.formatCell(total, column);
    });
    return totals;
  });

  readonly rowStart = computed(() => {
    if (!this.totalRecords()) return 0;
    return ((this.page() - 1) * this.pageSize()) + 1;
  });

  readonly rowEnd = computed(() => Math.min(this.page() * this.pageSize(), this.totalRecords()));
  readonly canMovePrevious = computed(() => this.page() > 1);
  readonly canMoveNext = computed(() => this.page() * this.pageSize() < this.totalRecords());

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const reportKey = params.get('reportKey');
        if (!reportKey) {
          // Use first report as default if no reportKey is provided
          this.setReport(INVENTORY_REPORTS[0]);
        } else {
          const definition = findInventoryReport(reportKey);
          this.setReport(definition);
        }
        this.generateReport(false);
      });
  }

  filterValue(key: InventoryReportFilterKey): InventoryReportFilterValue {
    return this.filters()[key] ?? '';
  }

  filterTextValue(key: InventoryReportFilterKey): string {
    const value = this.filterValue(key);
    return Array.isArray(value) ? value.join(', ') : value instanceof Date ? this.toDateInput(value) : String(value ?? '');
  }

  filterMultiValue(key: InventoryReportFilterKey): string[] {
    const value = this.filterValue(key);
    if (Array.isArray(value)) return value;
    if (value instanceof Date || value === null || value === undefined || value === '') return [];
    return String(value).split(',').map(item => item.trim()).filter(Boolean);
  }

  filterDateValue(key: InventoryReportFilterKey): Date | null {
    const value = this.filterValue(key);
    if (value instanceof Date) return value;
    if (Array.isArray(value) || !value) return null;

    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  updateFilter(key: InventoryReportFilterKey, value: InventoryReportFilterValue): void {
    this.filters.update(filters => ({ ...filters, [key]: value ?? '' }));
  }

  updateBranchWarehouse(selected: BranchWarehouseOption[] | null): void {
    if (this.branchWarehouseLocked()) return;

    const items = selected ?? [];
    const branchNames = items.filter(item => item.key === 'branchId').map(item => item.label);
    const warehouseNames = items.filter(item => item.key === 'warehouseId').map(item => item.label);
    this.filters.update(filters => ({ ...filters, branchId: branchNames, warehouseId: warehouseNames }));
  }

  updateDateRange(value: Date[] | null): void {
    const [from, to] = value ?? [null, null];
    this.filters.update(filters => ({ ...filters, fromDate: from ?? '', toDate: to ?? '' }));
  }

  resetFilters(generate = true): void {
    this.filters.set(this.defaultFilters());
    this.searchText.set('');
    this.page.set(1);
    if (generate) this.generateReport(false);
  }

  toggleAdvancedFilters(): void {
    this.showAdvancedFilters.update(value => !value);
  }

  toggleColumnChooser(): void {
    this.showColumnChooser.update(value => !value);
  }

  expandSearch(): void {
    this.searchExpanded.set(true);
    setTimeout(() => this.searchInputRef?.nativeElement.focus());
  }

  collapseSearchIfEmpty(): void {
    if (!this.searchText().trim()) this.searchExpanded.set(false);
  }

  isColumnVisible(columnKey: string): boolean {
    return this.visibleColumnKeys().includes(columnKey);
  }

  toggleColumn(columnKey: string, checked: boolean): void {
    this.visibleColumnKeys.update(keys => {
      if (checked && !keys.includes(columnKey)) return [...keys, columnKey];
      if (!checked) return keys.filter(key => key !== columnKey);
      return keys;
    });
  }

  generateReport(resetPage = true): void {
    if (resetPage) this.page.set(1);

    this.loading.set(true);
    this.errorMessage.set('');
    this.infoMessage.set('');

    this.reportsService.getReport(this.report(), this.apiFilters(), this.page(), this.pageSize()).subscribe({
      next: response => {
        this.rows.set(response.data);
        this.summary.set(response.summary ?? {});
        this.totalRecords.set(response.totalRecords || response.data.length);
        this.loadedFromApi.set(true);
        this.infoMessage.set(response.message || 'Report generated from API data.');
        this.loading.set(false);
      },
      error: () => {
        // A genuine load failure gets one plain, non-technical message and
        // an honest empty table -- not fabricated sample rows dressed up as
        // a real result. Silently swapping in sampleRows here (as this used
        // to) risked an end user reading fake numbers as this report's real
        // business data, especially now that the header no longer carries
        // an "API data / Preview data" badge to flag the difference. Raw
        // backend detail (endpoint paths, "API"/"backend" wording) has no
        // business being shown to an end user either way.
        this.rows.set([]);
        this.summary.set({});
        this.totalRecords.set(0);
        this.loadedFromApi.set(false);
        this.infoMessage.set('');
        this.errorMessage.set("We couldn't load this report right now. Please try again in a moment.");
        this.loading.set(false);
      }
    });
  }

  changePage(delta: number): void {
    const nextPage = this.page() + delta;
    if (nextPage < 1) return;
    if (delta > 0 && !this.canMoveNext()) return;
    this.page.set(nextPage);
    this.generateReport(false);
  }

  changePageSize(value: string | number): void {
    const size = Number(value);
    this.pageSize.set(Number.isFinite(size) && size > 0 ? size : 25);
    this.page.set(1);
    this.generateReport(false);
  }

  setSort(columnKey: string): void {
    if (this.sortColumn() === columnKey) {
      this.sortDirection.update(direction => direction === 'asc' ? 'desc' : 'asc');
      return;
    }
    this.sortColumn.set(columnKey);
    this.sortDirection.set('asc');
  }

  sortIcon(columnKey: string): string {
    if (this.sortColumn() !== columnKey) return 'pi pi-sort-alt';
    return this.sortDirection() === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down';
  }

  openRow(row: InventoryReportRow): void {
    this.activeRow.set(row);
  }

  closeRow(): void {
    this.activeRow.set(null);
  }

  rowEntries(row: InventoryReportRow): Array<{ label: string; value: string }> {
    return this.visibleColumns().map(column => ({
      label: column.label,
      value: this.formatCell(row[column.key], column)
    }));
  }

  // Print / PDF / Excel use the same Accounts-style output as every other
  // Inventory screen (company letterhead, #0b4093 grid, printed-on footer).
  exportExcel(): void {
    this.exportService.excel(this.exportDocument());
  }

  exportPdf(): void {
    this.exportService.pdf(this.exportDocument(), 'Pdf');
  }

  printReport(): void {
    this.exportService.pdf(this.exportDocument(), 'Print');
  }

  // private exportDocument(): InventoryExportDocument {
  //   const columns = this.visibleColumns();
  //   const from = this.filterDateValue('fromDate');
  //   const to = this.filterDateValue('toDate');
  //   const pdfDate = (value: Date) => formatDate(value, 'dd-MMM-yyyy', 'en-US');
  //   const periodText = from && to
  //     ? `Between: ${pdfDate(from)} And ${pdfDate(to)}`
  //     : from ? `From: ${pdfDate(from)}` : to ? `As on: ${pdfDate(to)}` : '';
  //   return {
  //     title: this.report().title,
  //     columns: columns.map(column => column.label),
  //     rows: this.sortedRows().map(row => columns.map(column => this.formatCell(row[column.key], column))),
  //     periodText,
  //     fileName: this.report().title
  //   };
  // }

    private exportDocument(): InventoryExportDocument {
    const columns = this.visibleColumns();
    const from = this.filterDateValue('fromDate');
    const to = this.filterDateValue('toDate');
    const pdfDate = (value: Date) => formatDate(value, 'dd-MMM-yyyy', 'en-US');
    const periodText = from && to
      ? `Between: ${pdfDate(from)} And ${pdfDate(to)}`
      : from ? `From: ${pdfDate(from)}` : to ? `As on: ${pdfDate(to)}` : '';

    // Previous: rows: this.sortedRows().map(row => columns.map(column => this.formatCell(row[column.key], column))),
    // The export follows the screen's "Group by": a header line per group, its rows,
    // then a subtotal line (columns marked total), like the on-screen grouping.
    const rows: string[][] = [];
    const groupRowIndexes: number[] = [];
    const groupKey = this.groupBy();
    const toCells = (row: InventoryReportRow) => columns.map(column => this.formatCell(row[column.key], column));

    if (!groupKey) {
      this.sortedRows().forEach(row => rows.push(toCells(row)));
    } else {
      const groupColumn = this.report().columns.find(column => column.key === groupKey);
      this.groupedRows().forEach(group => {
        groupRowIndexes.push(rows.length);
        rows.push(columns.map((_, index) => index === 0
          ? `${groupColumn?.label ? groupColumn.label + ': ' : ''}${group.label} (${group.rows.length} rows)`
          : ''));
        group.rows.forEach(row => rows.push(toCells(row)));
        if (columns.some(column => column.total)) {
          groupRowIndexes.push(rows.length);
          rows.push(columns.map((column, index) => {
            if (index === 0) return `Subtotal: ${group.label}`;
            const sumOf = (key: string) => group.rows.reduce((acc, row) => acc + this.numberValue(row[key]), 0);
            // Stock Ledger subtotal: Balance Qty = Inward Qty - Outward Qty (user request).
            if (this.report().key === 'stockLedger' && column.key === 'balanceQty') {
              return this.formatCell(sumOf('inwardQty') - sumOf('outwardQty'), column);
            }
            // Stock Ledger subtotal: Total = Debit - Credit (user request).
            if (this.report().key === 'stockLedger' && column.key === 'totalValue') {
              return this.formatCell(sumOf('debitValue') - sumOf('creditValue'), column);
            }
            if (!column.total) return '';
            const sum = sumOf(column.key);
            return this.formatCell(sum, column);
          }));
        }
      });
    }

    // Dues List: Grand Total line after the last group (Total / Received / Due),
    // same figures as the on-screen footer (user request).
    if (this.report().key === 'duesList' && rows.length && columns.some(column => column.total)) {
      const totals = this.totals();
      groupRowIndexes.push(rows.length);
      rows.push(columns.map((column, index) => index === 0 ? 'Grand Total' : (column.total ? totals[column.key] ?? '' : '')));
    }

    return {
      title: this.report().title,
      columns: columns.map(column => column.label),
      rows,
      groupRowIndexes,
      periodText,
      fileName: this.report().title
    };
  }

  formatCell(value: InventoryReportRow[string], column: InventoryReportColumn): string {
    if (value === null || value === undefined || value === '') return '-';
    if (column.type === 'currency') return this.formatCurrency(this.numberValue(value));
    if (column.type === 'number') return this.numberValue(value).toLocaleString('en-IN');
    if (column.type === 'percent') return `${this.numberValue(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`;
    return String(value);
  }

  filterTrack(_: number, filter: InventoryReportFilterDefinition): InventoryReportFilterKey {
    return filter.key;
  }

  filterPlaceholder(filter: InventoryReportFilterDefinition): string {
    return filter.placeholder ?? filter.label;
  }

  // Icon-only filter labels — was a full text label stacked above every
  // filter, which ate a full row per filter and made a report with 8-10
  // filters sprawl across many rows. The icon + title tooltip keeps the
  // meaning without the label row.
  private static readonly FILTER_ICONS: Partial<Record<InventoryReportFilterKey, string>> = {
    branchId: 'pi pi-sitemap',
    segmentId: 'pi pi-briefcase',
    financialYear: 'pi pi-calendar',
    warehouseId: 'pi pi-building',
    fromDate: 'pi pi-calendar-plus',
    toDate: 'pi pi-calendar-minus',
    productId: 'pi pi-box',
    productCategory: 'pi pi-tags',
    brand: 'pi pi-star',
    hsnSac: 'pi pi-hashtag',
    customerId: 'pi pi-user',
    supplierId: 'pi pi-truck',
    batchNo: 'pi pi-th-large',
    serialNo: 'pi pi-qrcode',
    uom: 'pi pi-percentage',
    status: 'pi pi-flag',
    project: 'pi pi-folder',
    department: 'pi pi-users',
    createdBy: 'pi pi-user-edit',
    approvedBy: 'pi pi-verified'
  };

  filterIcon(key: InventoryReportFilterKey): string {
    return InventoryReportPageComponent.FILTER_ICONS[key] ?? 'pi pi-filter';
  }

  private setReport(definition: InventoryReportDefinition): void {
    this.report.set(definition);
    this.groupBy.set(definition.defaultGroupBy ?? '');
    this.sortColumn.set('');
    this.sortDirection.set('asc');
    this.showAdvancedFilters.set(false);
    this.showColumnChooser.set(false);
    this.visibleColumnKeys.set(definition.columns.filter(column => column.defaultVisible !== false).map(column => column.key));
    this.filters.set(this.defaultFilters());
    this.page.set(1);
    this.loadPreview('Preview rows are shown until the API responds.');
  }

  private defaultFilters(): InventoryReportFilters {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const context = this.reportsService.contextDefaults();
    const segmentOptions = this.masterOptions().segmentId ?? [];
    const singleSegment = segmentOptions.length === 1 ? segmentOptions[0] : '';
    return {
      branchId: [],
      segmentId: singleSegment ? [singleSegment] : [],
      financialYear: [String(context.financialYear || this.currentFinancialYear())],
      fromDate: start,
      toDate: today,
      status: []
    };
  }

  private apiFilters(): InventoryReportFilters {
    const filters: InventoryReportFilters = { ...this.filters() };
    const idKeys: InventoryReportFilterKey[] = ['segmentId', 'branchId', 'warehouseId', 'productId', 'customerId', 'supplierId'];
    const whereSelectionCount = this.filterValues(filters.branchId).length + this.filterValues(filters.warehouseId).length;

    idKeys.forEach(key => {
      if ((key === 'branchId' || key === 'warehouseId') && whereSelectionCount > 1) {
        filters[key] = '';
        return;
      }
      filters[key] = this.singleApiIdValue(key, filters[key]);
    });

    this.applyLockedLocationScope(filters);
    return filters;
  }

  private applyLockedLocationScope(filters: InventoryReportFilters): void {
    const scope = this.reportLocationScope();
    if (scope.isCompanyAdmin) return;

    if (scope.warehouseId) {
      filters.warehouseId = String(scope.warehouseId);
      filters.branchId = '';
      return;
    }

    if (scope.branchId) {
      filters.branchId = String(scope.branchId);
      filters.warehouseId = '';
    }
  }

  private singleApiIdValue(key: InventoryReportFilterKey, value: InventoryReportFilterValue): string {
    const values = this.filterValues(value);
    if (values.length !== 1) return '';

    const [label] = values;
    const mappedId = this.masterOptionIds()[key]?.[label];
    if (typeof mappedId === 'number' && Number.isFinite(mappedId)) return String(mappedId);

    return /^\d+$/.test(label) ? label : '';
  }

  private applySingleSegmentDefault(segmentOptions: string[]): void {
    if (segmentOptions.length !== 1) return;
    const [segment] = segmentOptions;
    this.filters.update(filters => {
      const currentSegments = this.filterValues(filters.segmentId ?? []);
      if (currentSegments.length) return filters;
      return { ...filters, segmentId: [segment] };
    });
  }

  private loadPreview(message: string): void {
    this.rows.set(this.report().sampleRows);
    this.summary.set({});
    this.totalRecords.set(this.report().sampleRows.length);
    this.loadedFromApi.set(false);
    this.infoMessage.set(message);
  }

  private sortValue(value: InventoryReportRow[string], column: InventoryReportColumn | undefined): string | number {
    if (column?.type === 'number' || column?.type === 'currency' || column?.type === 'percent') {
      return this.numberValue(value);
    }
    return String(value ?? '');
  }

  private numberValue(value: InventoryReportRow[string]): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean' || value === null || value === undefined) return 0;
    const normalized = String(value).replace(/[^0-9.-]/g, '');
    const result = Number(normalized);
    return Number.isFinite(result) ? result : 0;
  }

  private formatCurrency(value: number): string {
    const amount = value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
    // Stock Ledger shows plain amounts, no "Rs." prefix (user request).
    if (this.report().key === 'stockLedger') return amount;
    return `Rs. ${amount}`;
  }

  private formatSummaryValue(value: string | number | undefined, fallback: string): string {
    if (value === null || value === undefined || value === '') return fallback;
    return typeof value === 'number' ? value.toLocaleString('en-IN') : String(value);
  }

  private toDateInput(value: Date): string {
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${value.getFullYear()}-${month}-${day}`;
  }

  private shortDate(value: Date): string {
    return value.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private matchesActiveFilters(row: InventoryReportRow): boolean {
    const filters = this.filters();
    return Object.entries(filters).every(([key, value]) => {
      if (key === 'fromDate' || key === 'toDate') return this.matchesDateFilter(row, key as InventoryReportFilterKey, value);
      return this.matchesValueFilter(row, key as InventoryReportFilterKey, value);
    });
  }

  private matchesValueFilter(row: InventoryReportRow, key: InventoryReportFilterKey, value: InventoryReportFilterValue): boolean {
    const values = this.filterValues(value);
    if (!values.length) return true;

    const fields = this.rowFieldsForFilter(key);
    if (!fields.length) return true;

    const haystack = fields
      .map(field => String(row[field] ?? '').toLowerCase())
      .filter(Boolean);

    if (!haystack.length) return true;

    return values.some(valueText => haystack.some(rowText => rowText.includes(valueText.toLowerCase())));
  }

  private matchesDateFilter(row: InventoryReportRow, key: InventoryReportFilterKey, value: InventoryReportFilterValue): boolean {
    const date = value instanceof Date ? value : value ? new Date(String(value)) : null;
    if (!date || Number.isNaN(date.getTime())) return true;

    const rowDate = this.firstRowDate(row);
    if (!rowDate) return true;

    const rowTime = this.startOfDay(rowDate).getTime();
    const filterTime = this.startOfDay(date).getTime();
    return key === 'fromDate' ? rowTime >= filterTime : rowTime <= filterTime;
  }

  private filterValues(value: InventoryReportFilterValue): string[] {
    if (Array.isArray(value)) {
      return value.map(item => String(item ?? '').trim()).filter(item => item && item !== 'All');
    }

    if (value instanceof Date || value === null || value === undefined) return [];

    const text = String(value).trim();
    return text && text !== 'All' ? [text] : [];
  }

  private rowFieldsForFilter(key: InventoryReportFilterKey): string[] {
    const fields: Record<InventoryReportFilterKey, string[]> = {
      companyId: [],
      // Branch and Warehouse share one combined multiselect (see
      // branchWarehouseOptions), but this map is what actually filters the
      // rows — and an empty list means matchesValueFilter() short-circuits to
      // true, so picking a Branch used to match every row instead of filtering
      // anything. Mirrors the warehouseId entry below with the row field names
      // branch data actually arrives under: 'branch' is what the stock reports
      // now return (Warehouse-wise Stock, Low Stock Alert, Stock Ledger),
      // 'fromBranch'/'toBranch' are the transfer legs.
      branchId: ['branch', 'branchName', 'fromBranch', 'toBranch'],
      segmentId: ['segment'],
      financialYear: [],
      warehouseId: ['warehouse', 'location', 'fromWarehouse', 'toWarehouse', 'store'],
      fromDate: [],
      toDate: [],
      productId: ['product', 'productName', 'productCode', 'indicator'],
      productCategory: ['category', 'indicatorGroup'],
      brand: ['brand'],
      hsnSac: ['hsnSac', 'hsnSacCode', 'description'],
      customerId: ['customer', 'party'],
      supplierId: ['supplier', 'party'],
      batchNo: ['batchNo', 'batch', 'lotNo'],
      serialNo: ['serialNo', 'serial'],
      uom: ['uom', 'billingUOM'],
      status: ['status', 'risk'],
      project: ['project', 'location'],
      department: ['department'],
      createdBy: ['createdBy'],
      approvedBy: ['approvedBy']
    };

    return fields[key] ?? [];
  }

  private firstRowDate(row: InventoryReportRow): Date | null {
    const dateColumns = this.report().columns.filter(column => column.type === 'date').map(column => column.key);
    const candidates = [
      ...dateColumns,
      'transactionDate',
      'documentDate',
      'invoiceDate',
      'poDate',
      'grnDate',
      'soDate',
      'dcDate'
    ];

    for (const key of candidates) {
      const value = row[key];
      if (!value) continue;
      const date = new Date(String(value));
      if (!Number.isNaN(date.getTime())) return date;
    }

    return null;
  }

  private startOfDay(value: Date): Date {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  private currentFinancialYear(): string {
    const today = new Date();
    const startYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
    return `${startYear}-${startYear + 1}`;
  }
}
