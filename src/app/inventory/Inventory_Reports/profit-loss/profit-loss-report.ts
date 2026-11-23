import { CommonModule, formatDate } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgSelectModule } from '@ng-select/ng-select';
import { DatePickerModule } from 'primeng/datepicker';

import { InventoryExportDocument, InventoryExportService } from '../../Inventory_Shared/inventory-export.service';
import {
  InventoryReportsService,
  ProfitLossColumn,
  ProfitLossLine,
  ProfitLossReport,
  ProfitLossReportType,
  ProfitLossSection
} from '../shared/inventory-reports.service';

// Profit & Loss report (311_profit_loss_report.sql, GET /api/reports/profit-loss).
// Everything comes from accounts total transactions (every project's postings)
// for the login company + branch:
//   Income & Expenses   -> Trading Account + Profit & Loss Account, two-sided
//                          (Expenses | Income), one column per month From..To,
//                          like the old "TRADING ACCOUNT AND PROFIT & LOSS ACCOUNT" print.
//   Assets & Liabilities -> Balance Sheet (Liabilities | Assets) as on To Date.
// Gross Profit, group subtotals, % of sales, Net Profit and the totals are
// worked out here from the ledger lines the procedure returns.

// Groups follow Schedule TB: Group (bold heading) -> Sub Group (sub heading)
// -> ledgers, in the order the procedure returns them (Schedule sort orders).
type CellKind = 'line' | 'group' | 'subgroup' | 'subtotal' | 'percent' | 'total' | 'bold' | 'blank';

interface SideRow {
  label: string;
  kind: CellKind;
  amounts: Record<string, number | null>;
}

interface GridRow {
  left: SideRow;
  right: SideRow;
}

interface GridBlock {
  leftTitle: string;
  rightTitle: string;
  rows: GridRow[];
}

const BLANK: SideRow = { label: '', kind: 'blank', amounts: {} };

@Component({
  selector: 'app-profit-loss-report',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule, DatePickerModule],
  templateUrl: './profit-loss-report.html',
  styleUrl: './profit-loss-report.scss'
})
export class ProfitLossReportComponent {
  private readonly reportsService = inject(InventoryReportsService);
  private readonly exportService = inject(InventoryExportService);
  private readonly destroyRef = inject(DestroyRef);

  readonly reportTypeOptions: Array<{ label: string; value: ProfitLossReportType }> = [
    { label: 'Income & Expenses', value: 'IE' },
    { label: 'Assets & Liabilities', value: 'AL' }
  ];

  readonly todayDate = new Date();
  readonly fromDate = signal<Date>(new Date(this.todayDate.getFullYear(), this.todayDate.getMonth(), 1));
  readonly toDate = signal<Date>(new Date(this.todayDate.getFullYear(), this.todayDate.getMonth(), this.todayDate.getDate()));
  readonly reportType = signal<ProfitLossReportType>('IE');

  readonly report = signal<ProfitLossReport | null>(null);
  // Dates the shown report was generated with (PDF heading uses these, not the
  // pickers, so a date changed without re-generating can't mislabel the figures).
  private readonly generatedFrom = signal<Date | null>(null);
  private readonly generatedTo = signal<Date | null>(null);
  readonly loading = signal(false);
  readonly errorMessage = signal('');

  readonly companyName = signal(this.readCompanyName());
  readonly branchName = signal(this.readBranchName());

  readonly columns = computed<ProfitLossColumn[]>(() => this.report()?.columns ?? []);
  readonly isBalanceSheet = computed(() => this.report()?.reportType === 'AL');
  readonly reportTitle = computed(() => this.isBalanceSheet()
    ? 'BALANCE SHEET'
    : 'TRADING ACCOUNT AND PROFIT & LOSS ACCOUNT');
  readonly unmapped = computed(() => this.report()?.unmapped ?? []);

  readonly blocks = computed<GridBlock[]>(() => {
    const report = this.report();
    if (!report) return [];
    return report.reportType === 'AL' ? this.balanceSheetBlocks(report) : this.profitLossBlocks(report);
  });

  readonly hasData = computed(() => (this.report()?.lines.length ?? 0) > 0);

  constructor() {
    this.generate();
  }

  setReportType(value: ProfitLossReportType | null): void {
    this.reportType.set(value ?? 'IE');
  }

  setFromDate(value: Date | null): void {
    if (value) this.fromDate.set(value);
  }

  setToDate(value: Date | null): void {
    if (value) this.toDate.set(value);
  }

  generate(): void {
    const from = this.fromDate();
    const to = this.toDate();
    if (from > to) {
      this.errorMessage.set('From Date cannot be after To Date.');
      return;
    }
    this.loading.set(true);
    this.errorMessage.set('');
    this.reportsService.getProfitLoss(this.reportType(), from, to)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.generatedFrom.set(from);
          this.generatedTo.set(to);
          this.report.set(result);
          this.loading.set(false);
        },
        error: () => {
          this.report.set(null);
          this.loading.set(false);
          this.errorMessage.set("We couldn't load this report right now. Please try again in a moment.");
        }
      });
  }

  resetFilters(): void {
    this.fromDate.set(new Date(this.todayDate.getFullYear(), this.todayDate.getMonth(), 1));
    this.toDate.set(new Date(this.todayDate.getFullYear(), this.todayDate.getMonth(), this.todayDate.getDate()));
    this.reportType.set('IE');
    this.generate();
  }

  // ---------------------------------------------------------------- formatting

  formatAmount(row: SideRow, key: string): string {
    if (row.kind === 'blank' || row.kind === 'group' || row.kind === 'subgroup') return '';
    const value = row.amounts[key];
    if (value === null || value === undefined) return '';
    if (row.kind === 'percent') {
      return `${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
    }
    const rounded = Math.round(value);
    if (rounded === 0) return '-';
    return rounded.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  formatUnmapped(value: number): string {
    return value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  periodText(): string {
    const report = this.report();
    if (!report) return '';
    const d = (value: Date) => formatDate(value, 'dd-MMM-yyyy', 'en-US');
    const from = this.generatedFrom() ?? this.fromDate();
    const to = this.generatedTo() ?? this.toDate();
    // Assets & Liabilities = balances as on To Date (From Date is not used).
    return report.reportType === 'AL'
      ? `As on: ${d(to)}`
      : `Between: ${d(from)} And ${d(to)}`;
  }

  // ------------------------------------------------------------------- export

  exportPdf(): void {
    const doc = this.exportDocument();
    if (doc) this.exportService.pdf(doc, 'Pdf');
  }

  printReport(): void {
    const doc = this.exportDocument();
    if (doc) this.exportService.pdf(doc, 'Print');
  }

  exportExcel(): void {
    const doc = this.exportDocument();
    if (doc) this.exportService.excel(doc);
  }

  private exportDocument(): InventoryExportDocument | null {
    const report = this.report();
    if (!report || !this.hasData()) return null;
    const cols = this.columns();
    const rows: string[][] = [];
    const boldIndexes: number[] = [];
    const isBold = (kind: CellKind) => ['group', 'subgroup', 'subtotal', 'total', 'bold'].includes(kind);

    this.blocks().forEach((block, blockIndex) => {
      if (blockIndex > 0) {
        boldIndexes.push(rows.length);
        rows.push([block.leftTitle, ...cols.map(c => c.label), block.rightTitle, ...cols.map(c => c.label)]);
      }
      block.rows.forEach(row => {
        if (isBold(row.left.kind) || isBold(row.right.kind)) boldIndexes.push(rows.length);
        rows.push([
          row.left.label, ...cols.map(c => this.formatAmount(row.left, c.key)),
          row.right.label, ...cols.map(c => this.formatAmount(row.right, c.key))
        ]);
      });
    });

    const first = this.blocks()[0];
    return {
      title: `${this.reportTitle()}${this.branchName() ? ' - ' + this.branchName() : ''}`,
      columns: [first?.leftTitle ?? '', ...cols.map(c => c.label), first?.rightTitle ?? '', ...cols.map(c => c.label)],
      rows,
      groupRowIndexes: boldIndexes,
      periodText: this.periodText(),
      orientation: cols.length > 1 ? 'landscape' : 'portrait',
      fileName: report.reportType === 'AL' ? 'Balance Sheet' : 'Profit and Loss'
    };
  }

  // ------------------------------------------------------- Income & Expenses

  private profitLossBlocks(report: ProfitLossReport): GridBlock[] {
    const keys = report.columns.map(c => c.key);
    const of = (section: ProfitLossSection) => report.lines.filter(line => line.section === section);
    const sum = (lines: ProfitLossLine[]) => this.sumBy(keys, key => lines.reduce((acc, line) => acc + (line.amounts[key] ?? 0), 0));
    const pct = (part: Record<string, number>, base: Record<string, number>) =>
      this.sumBy(keys, key => base[key] ? (part[key] / base[key]) * 100 : 0);
    const asLine = (line: ProfitLossLine, kind: CellKind = 'line'): SideRow => ({ label: line.head, kind, amounts: { ...line.amounts } });

    // Trading account
    const tradingExp = of('TRADING_EXP');
    const tradingInc = of('TRADING_INC');
    const sales = sum(tradingInc.filter(line => line.head !== 'CLOSING STOCK' && !line.head.startsWith('STOCK TRANSFER')));
    const tradingIncTotal = sum(tradingInc);
    const tradingExpTotal = sum(tradingExp);
    const grossProfit = this.sumBy(keys, key => tradingIncTotal[key] - tradingExpTotal[key]);

    const tradingLeft: SideRow[] = [
      ...tradingExp.map(line => asLine(line)),
      { label: 'GROSS PROFIT/(LOSS)', kind: 'line', amounts: grossProfit }
    ];
    const tradingRight: SideRow[] = tradingInc.map(line => asLine(line));
    const tradingRows = this.zip(tradingLeft, tradingRight);
    tradingRows.push({
      left: { label: 'TOTAL', kind: 'total', amounts: tradingIncTotal },
      right: { label: '', kind: 'total', amounts: tradingIncTotal }
    });
    tradingRows.push({
      left: { label: 'GROSS PROFIT %', kind: 'percent', amounts: pct(grossProfit, sales) },
      right: BLANK
    });

    // Profit & Loss account
    const plLeft: SideRow[] = [];
    const expenseGroups = this.groupLines(of('PL_EXP'));
    expenseGroups.forEach(group => {
      const total = sum(group.lines);
      this.pushGroupRows(plLeft, group);
      plLeft.push({ label: '', kind: 'subtotal', amounts: total });
      plLeft.push({ label: '', kind: 'percent', amounts: pct(total, sales) });
    });
    const totalExpenses = sum(of('PL_EXP'));

    const plRight: SideRow[] = [{ label: 'GROSS PROFIT/(LOSS)', kind: 'line', amounts: grossProfit }];
    const incomeGroups = this.groupLines(of('PL_INC'));
    incomeGroups.forEach(group => {
      this.pushGroupRows(plRight, group);
      plRight.push({ label: '', kind: 'subtotal', amounts: sum(group.lines) });
    });
    const otherIncome = sum(of('PL_INC'));
    const rightTotal = this.sumBy(keys, key => grossProfit[key] + otherIncome[key]);
    const netProfit = this.sumBy(keys, key => rightTotal[key] - totalExpenses[key]);

    plLeft.push({ label: 'TOTAL EXPENSES', kind: 'bold', amounts: totalExpenses });
    plLeft.push({ label: 'NET PROFIT/(LOSS)', kind: 'bold', amounts: netProfit });
    plLeft.push({ label: '%', kind: 'percent', amounts: pct(netProfit, sales) });

    const plRows = this.zip(plLeft, plRight);
    plRows.push({
      left: { label: 'TOTAL', kind: 'total', amounts: rightTotal },
      right: { label: 'TOTAL', kind: 'total', amounts: rightTotal }
    });

    return [
      { leftTitle: 'Expenses', rightTitle: 'Income', rows: tradingRows },
      { leftTitle: 'Expenses', rightTitle: 'Income', rows: plRows }
    ];
  }

  // ---------------------------------------------------- Assets & Liabilities

  private balanceSheetBlocks(report: ProfitLossReport): GridBlock[] {
    const keys = report.columns.map(c => c.key);
    const sum = (lines: ProfitLossLine[]) => this.sumBy(keys, key => lines.reduce((acc, line) => acc + (line.amounts[key] ?? 0), 0));
    const side = (section: ProfitLossSection): { rows: SideRow[]; total: Record<string, number> } => {
      const lines = report.lines.filter(line => line.section === section);
      const rows: SideRow[] = [];
      this.groupLines(lines).forEach(group => {
        this.pushGroupRows(rows, group);
        rows.push({ label: '', kind: 'subtotal', amounts: sum(group.lines) });
      });
      return { rows, total: sum(lines) };
    };

    const liabilities = side('LIAB');
    const assets = side('ASSET');
    const rows = this.zip(liabilities.rows, assets.rows);
    rows.push({
      left: { label: 'TOTAL', kind: 'total', amounts: liabilities.total },
      right: { label: 'TOTAL', kind: 'total', amounts: assets.total }
    });
    const difference = this.sumBy(keys, key => assets.total[key] - liabilities.total[key]);
    if (keys.some(key => Math.round(difference[key]) !== 0)) {
      rows.push({ left: { label: 'DIFFERENCE (Assets - Liabilities)', kind: 'bold', amounts: difference }, right: BLANK });
    }
    return [{ leftTitle: 'Liabilities', rightTitle: 'Assets', rows }];
  }

  // ----------------------------------------------------------------- helpers

  private groupLines(lines: ProfitLossLine[]): Array<{ name: string; lines: ProfitLossLine[] }> {
    const groups = new Map<string, ProfitLossLine[]>();
    lines.forEach(line => {
      const name = line.groupName || '';
      groups.set(name, [...(groups.get(name) ?? []), line]);
    });
    // PROFIT & LOSS A/C (Balance Sheet) always prints last on its side.
    return Array.from(groups.entries())
      .map(([name, groupLines]) => ({ name, lines: groupLines }))
      .sort((a, b) => Number(a.name === 'PROFIT & LOSS A/C') - Number(b.name === 'PROFIT & LOSS A/C'));
  }

  /** Group heading, then each Sub Group heading (when set) with its ledgers. */
  private pushGroupRows(rows: SideRow[], group: { name: string; lines: ProfitLossLine[] }): void {
    rows.push({ label: group.name, kind: 'group', amounts: {} });
    let currentSub: string | null = null;
    group.lines.forEach(line => {
      const sub = (line.subGroupName ?? '').trim();
      if (sub && sub !== currentSub) {
        rows.push({ label: sub, kind: 'subgroup', amounts: {} });
      }
      currentSub = sub;
      rows.push({ label: line.head, kind: 'line', amounts: { ...line.amounts } });
    });
  }

  private zip(left: SideRow[], right: SideRow[]): GridRow[] {
    const length = Math.max(left.length, right.length);
    return Array.from({ length }, (_, index) => ({ left: left[index] ?? BLANK, right: right[index] ?? BLANK }));
  }

  private sumBy(keys: string[], value: (key: string) => number): Record<string, number> {
    return keys.reduce<Record<string, number>>((acc, key) => {
      const result = value(key);
      acc[key] = Number.isFinite(result) ? result : 0;
      return acc;
    }, {});
  }

  private readCompanyName(): string {
    try {
      const raw = sessionStorage.getItem('authCompany');
      return raw ? JSON.parse(raw)?.companyName || '' : '';
    } catch {
      return '';
    }
  }

  private readBranchName(): string {
    try {
      const details = JSON.parse(sessionStorage.getItem('CompanyDetails') || '{}');
      return details?.branchName || sessionStorage.getItem('warehouseName') || '';
    } catch {
      return '';
    }
  }
}
