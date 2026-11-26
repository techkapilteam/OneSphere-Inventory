import { CommonModule, formatDate } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgSelectModule } from '@ng-select/ng-select';
import { DatePickerModule } from 'primeng/datepicker';

import { InventoryExportDocument, InventoryExportService } from '../../Inventory_Shared/inventory-export.service';
import {
  AgeingAnalysisReport,
  AgeingAnalysisRow,
  AgeingPartyType,
  InventoryReportsService
} from '../shared/inventory-reports.service';

// Ageing Analysis (312_ageing_analysis_report.sql, GET /api/reports/ageing-analysis).
//
// Filters: As on Date + Account Head (Sundry Debtors = customers, Sundry
// Creditors = vendors), then Generate. The procedure reads the head's party
// ledgers (accounts total transactions), sets receipts / payments against the
// OLDEST bills first and returns what is still open - so a party's lines add
// up to its ledger balance and the Grand Total equals the Trial Balance.
//
// The age columns are NOT defined here: they are the company's ageing slabs
// (inventory.inv_ageing_slabs; default 0-30 ... Above 360 Days when the company
// has none), and the procedure returns the columns plus the column each bill
// falls in.
//
// Layout (as the old print): party heading, its invoices with the due in its
// age column and a running balance, a Total per party, and a Grand Total.

interface BillLine extends AgeingAnalysisRow {
  runningBalance: number;
}

interface PartyAgeing {
  serial: number;
  accountId: number;
  party: string;
  buckets: number[];
  balance: number;
  bills: BillLine[];
}

@Component({
  selector: 'app-ageing-analysis-report',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule, DatePickerModule],
  templateUrl: './ageing-analysis-report.html',
  styleUrl: './ageing-analysis-report.scss'
})
export class AgeingAnalysisReportComponent {
  private readonly reportsService = inject(InventoryReportsService);
  private readonly exportService = inject(InventoryExportService);
  private readonly destroyRef = inject(DestroyRef);

  readonly todayDate = new Date();
  /** Invoice No + Invoice Date + Days in front of the age columns. */
  readonly leadColumns = 3;

  readonly accountHeadOptions: Array<{ label: string; value: AgeingPartyType }> = [
    { label: 'SUNDRY DEBTORS (Customers)', value: 'customer' },
    { label: 'SUNDRY CREDITORS (Vendors)', value: 'vendor' }
  ];

  // ── Filters ────────────────────────────────────────────────
  readonly asOnDate = signal<Date>(new Date(this.todayDate.getFullYear(), this.todayDate.getMonth(), this.todayDate.getDate()));
  readonly accountHead = signal<AgeingPartyType>('customer');
  readonly search = signal('');

  // ── Data ───────────────────────────────────────────────────
  readonly report = signal<AgeingAnalysisReport | null>(null);
  readonly loading = signal(false);
  readonly errorMessage = signal('');

  readonly companyName = signal(this.readCompanyName());
  readonly branchName = signal(this.readBranchName());

  readonly columns = computed(() => this.report()?.columns ?? []);

  readonly parties = computed<PartyAgeing[]>(() => {
    const columnCount = this.columns().length;
    const byParty = new Map<number, PartyAgeing>();

    for (const r of this.report()?.rows ?? []) {
      let p = byParty.get(r.accountId);
      if (!p) {
        p = { serial: 0, accountId: r.accountId, party: r.party || '', buckets: Array(columnCount).fill(0), balance: 0, bills: [] };
        byParty.set(r.accountId, p);
      }
      const amount = +r.dueAmount || 0;
      if (r.bucket >= 0 && r.bucket < columnCount) p.buckets[r.bucket] += amount;
      p.balance += amount;
      p.bills.push({ ...r, dueAmount: amount, runningBalance: p.balance });
    }

    const list = [...byParty.values()].sort((a, b) => a.party.localeCompare(b.party));
    list.forEach((p, i) => (p.serial = i + 1));
    return list;
  });

  readonly filteredParties = computed<PartyAgeing[]>(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.parties();
    return this.parties().filter(p =>
      p.party.toLowerCase().includes(q) ||
      p.bills.some(b => (b.invoiceNo || '').toLowerCase().includes(q)));
  });

  readonly totals = computed(() => {
    const t = { buckets: this.columns().map(() => 0), balance: 0 };
    for (const p of this.filteredParties()) {
      p.buckets.forEach((v, i) => (t.buckets[i] += v));
      t.balance += p.balance;
    }
    return t;
  });

  readonly hasData = computed(() => this.parties().length > 0);
  readonly headLabel = computed(() =>
    this.report()?.partyType === 'vendor' ? 'SUNDRY CREDITORS' : 'SUNDRY DEBTORS');
  readonly reportTitle = computed(() => `${this.headLabel()} AGEING ANALYSIS`);

  setAsOnDate(value: Date | null): void {
    if (value) this.asOnDate.set(value);
  }

  setAccountHead(value: AgeingPartyType | null): void {
    this.accountHead.set(value ?? 'customer');
  }

  generate(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.reportsService.getAgeingAnalysis(this.asOnDate(), this.accountHead())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.report.set(result);
          this.search.set('');
          this.loading.set(false);
        },
        error: () => {
          this.report.set(null);
          this.loading.set(false);
          this.errorMessage.set("We couldn't load this report right now. Please try again in a moment.");
        }
      });
  }

  // ---------------------------------------------------------------- formatting

  /** 1,23,456.00 (negative = advance); '-' for nil. No currency symbol. */
  amt(value: number | null | undefined): string {
    const v = Math.round((+(value ?? 0)) * 100) / 100;
    if (!v) return '-';
    return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  date(value: string | null): string {
    if (!value) return '';
    const d = new Date(`${value}T00:00:00`);
    return isNaN(d.getTime()) ? value : formatDate(d, 'dd-MMM-yyyy', 'en-US');
  }

  periodText(): string {
    const asOn = this.report()?.asOnDate;
    return asOn ? `As on: ${this.date(asOn)}` : '';
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

  // The party name prints in its own first column on the party's first bill
  // (the export grid has no full-width heading rows), with a shaded "Total"
  // line under each party - same content as the on-screen layout.
  private exportDocument(): InventoryExportDocument | null {
    if (!this.hasData()) return null;
    const cols = this.columns();
    const rows: string[][] = [];
    const groupRowIndexes: number[] = [];
    const amounts = (values: number[]) => values.map(v => this.amt(v));

    for (const p of this.filteredParties()) {
      p.bills.forEach((b, i) => {
        const cells = cols.map(c => (c.index === b.bucket ? b.dueAmount : 0));
        rows.push([
          i === 0 ? `${p.serial}. ${p.party}` : '',
          b.invoiceNo, this.date(b.invoiceDate), String(b.ageDays),
          ...amounts(cells), this.amt(b.runningBalance)
        ]);
      });
      groupRowIndexes.push(rows.length);
      rows.push(['', 'Total', '', '', ...amounts(p.buckets), this.amt(p.balance)]);
    }

    const t = this.totals();
    return {
      title: `${this.reportTitle()}${this.branchName() ? ' - ' + this.branchName() : ''}`,
      columns: [this.report()?.partyType === 'vendor' ? 'Vendor' : 'Customer', 'Trans. No', 'Trans. Date', 'Days', ...cols.map(c => c.label), 'Balance'],
      rows,
      totalRow: ['Grand Total', '', '', '', ...amounts(t.buckets), this.amt(t.balance)],
      groupRowIndexes,
      periodText: this.periodText(),
      orientation: cols.length > 4 ? 'landscape' : 'portrait',
      pdfHeadFontSize: 8,
      pdfColumnWidths: { 0: 42, 1: 24, 2: 20, 3: 10 },
      fileName: `${this.headLabel()} Ageing Analysis`
    };
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
