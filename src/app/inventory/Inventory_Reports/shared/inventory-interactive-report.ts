import { CommonModule } from '@angular/common';
import { Component, Input, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { DatePickerModule } from 'primeng/datepicker';
import { InventoryScreenShell } from '../../Inventory_Shared/inventory-screen-shell/inventory-screen-shell';
import { INVENTORY_OPTIONS, InventoryScreenConfig } from '../../Inventory_Shared/inventory-screen.model';
import { InventoryExportDocument, InventoryExportService } from '../../Inventory_Shared/inventory-export.service';

type ReportSectionId = 'summary' | 'lookup' | 'drilldown' | 'actions';

interface ReportRow {
  segment: string;
  group: string;
  product: string;
  location: string;
  document: string;
  source: 'Master' | 'Transaction';
  screen: string;
  route: string;
  qty: string;
  value: string;
  status: string;
  risk: 'Good' | 'Watch' | 'Critical';
  updated: string;
}

interface ReportBlock {
  id: ReportSectionId;
  title: string;
  icon: string;
}

@Component({
  selector: 'app-inventory-interactive-report',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NgSelectModule, DatePickerModule, InventoryScreenShell],
  templateUrl: './inventory-interactive-report.html'
})
export class InventoryInteractiveReportComponent {
  @Input({ required: true }) config!: InventoryScreenConfig;
  private readonly exportService = inject(InventoryExportService);

  readonly segmentOptions = ['All Segments', ...INVENTORY_OPTIONS.segments];
  readonly sourceOptions = ['All Sources', 'Master', 'Transaction'];
  readonly statusOptions = ['All Status', 'Active', 'Posted', 'Approved', 'Pending', 'Draft', 'Low Stock', 'Mapped'];
  readonly selectedSegment = signal('All Segments');
  readonly selectedSource = signal('All Sources');
  readonly selectedStatus = signal('All Status');
  readonly searchText = signal('');
  readonly activeGroup = signal('All Groups');
  readonly activeRow = signal<ReportRow | null>(null);
  readonly sortColumn = signal<keyof ReportRow>('segment');
  readonly sortDirection = signal<'asc' | 'desc'>('asc');
  readonly draggedBlock = signal<ReportSectionId | null>(null);
  readonly reportBlocks = signal<ReportBlock[]>([
    { id: 'summary', title: 'Group summary', icon: 'pi pi-th-large' },
    { id: 'lookup', title: 'Masters and transactions lookup', icon: 'pi pi-search' },
    { id: 'drilldown', title: 'Interactive drill down', icon: 'pi pi-sitemap' },
    { id: 'actions', title: 'Critical actions', icon: 'pi pi-bolt' }
  ]);

  // No hardcoded demo rows -- only live data should ever be shown.
  readonly rows: ReportRow[] = [];

  readonly groupNames = computed(() => ['All Groups', ...Array.from(new Set(this.rows.map(row => row.group)))]);

  readonly filteredRows = computed(() => {
    const segment = this.selectedSegment();
    const source = this.selectedSource();
    const status = this.selectedStatus();
    const group = this.activeGroup();
    const search = this.searchText().trim().toLowerCase();
    const sortColumn = this.sortColumn();
    const direction = this.sortDirection();

    return this.rows
      .filter(row => segment === 'All Segments' || row.segment === segment)
      .filter(row => source === 'All Sources' || row.source === source)
      .filter(row => status === 'All Status' || row.status === status)
      .filter(row => group === 'All Groups' || row.group === group)
      .filter(row => !search || Object.values(row).some(value => String(value).toLowerCase().includes(search)))
      .sort((left, right) => {
        const result = String(left[sortColumn]).localeCompare(String(right[sortColumn]), undefined, { numeric: true, sensitivity: 'base' });
        return direction === 'asc' ? result : -result;
      });
  });

  readonly summaryCards = computed(() => {
    const rows = this.filteredRows();
    return Array.from(new Set(rows.map(row => row.group))).map(group => {
      const groupRows = rows.filter(row => row.group === group);
      return {
        group,
        records: groupRows.length,
        masters: groupRows.filter(row => row.source === 'Master').length,
        transactions: groupRows.filter(row => row.source === 'Transaction').length,
        critical: groupRows.filter(row => row.risk !== 'Good').length
      };
    });
  });

  readonly criticalRows = computed(() => this.filteredRows().filter(row => row.risk !== 'Good'));

  setSort(column: keyof ReportRow): void {
    if (this.sortColumn() === column) {
      this.sortDirection.update(direction => direction === 'asc' ? 'desc' : 'asc');
      return;
    }
    this.sortColumn.set(column);
    this.sortDirection.set('asc');
  }

  sortIcon(column: keyof ReportRow): string {
    if (this.sortColumn() !== column) return 'pi pi-sort-alt';
    return this.sortDirection() === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down';
  }

  resetFilters(): void {
    this.selectedSegment.set('All Segments');
    this.selectedSource.set('All Sources');
    this.selectedStatus.set('All Status');
    this.activeGroup.set('All Groups');
    this.searchText.set('');
  }

  openRow(row: ReportRow): void {
    this.activeRow.set(row);
  }

  closeRow(): void {
    this.activeRow.set(null);
  }

  // Accounts-style output (letterhead, #0b4093 grid, printed-on footer).
  exportExcel(): void {
    this.exportService.excel(this.exportDocument());
  }

  exportPdf(): void {
    this.exportService.pdf(this.exportDocument(), 'Pdf');
  }

  printReport(): void {
    this.exportService.pdf(this.exportDocument(), 'Print');
  }

  private exportDocument(): InventoryExportDocument {
    const headers: Array<[keyof ReportRow, string]> = [
      ['segment', 'Segment'], ['group', 'Group'], ['source', 'Source'], ['screen', 'Screen'],
      ['document', 'Document'], ['product', 'Product'], ['location', 'Location'], ['qty', 'Qty'],
      ['value', 'Value'], ['status', 'Status'], ['risk', 'Risk'], ['updated', 'Updated']
    ];
    return {
      title: this.config.title || 'Inventory Report',
      columns: headers.map(([, label]) => label),
      rows: this.filteredRows().map(row => headers.map(([key]) => String(row[key] ?? ''))),
      fileName: this.config.title || 'Inventory Report'
    };
  }

  dragStart(id: ReportSectionId): void {
    this.draggedBlock.set(id);
  }

  dropOn(targetId: ReportSectionId): void {
    const draggedId = this.draggedBlock();
    if (!draggedId || draggedId === targetId) return;

    this.reportBlocks.update(blocks => {
      const next = [...blocks];
      const fromIndex = next.findIndex(block => block.id === draggedId);
      const toIndex = next.findIndex(block => block.id === targetId);
      if (fromIndex < 0 || toIndex < 0) return blocks;
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    this.draggedBlock.set(null);
  }
}
