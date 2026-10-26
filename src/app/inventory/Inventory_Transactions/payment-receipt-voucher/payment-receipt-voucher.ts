import { CommonModule, formatDate } from '@angular/common';
import { Component, computed, effect, inject, signal, ViewChildren, QueryList } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { DatePickerModule } from 'primeng/datepicker';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { InventoryConfigService, VendorItem, CustomerItem } from '../../Inventory_Shared/inventory-config.service';
import { AvailableNote, OutstandingInvoice, PaymentVoucher, PaymentsService, TdsCode, VendorFyPurchaseSummary } from '../../Inventory_Shared/payments.service';
import { StickyFooterOffsetService } from '../../../core/services/Common/sticky-footer-offset.service';
import { customerReceiptConfig, vendorPaymentConfig } from '../../Inventory_Shared/inventory-screen.model';
import { InventoryScreenShell } from '../../Inventory_Shared/inventory-screen-shell/inventory-screen-shell';
import { InventoryExportDocument, InventoryExportService } from '../../Inventory_Shared/inventory-export.service';
import { PaymentModeOption, PaymentModeSelectorComponent, PaymentModeSelectorValue, defaultPaymentModeValue } from '../../../shared/payment-mode-selector/payment-mode-selector.component';

type VoucherMode = 'pay' | 'receipt';
// Item 19: mode-of-payment capture now lives in the shared
// <app-payment-mode-selector> (same Cash/Bank -> Cheque/Online/Debit
// Card/Credit Card UX as Accounts' General Receipt) -- this row just pairs
// its output with the amount split across this mode, same as before.
// partyId: which customer this mode pays for when Customer Receipt has more
// than one customer selected (one voucher is posted per customer).
type ModeRow = { details: PaymentModeSelectorValue; amount: number; partyId: number | null };

type PartySummary = { id: number; name: string; previousBalance: number; allocated: number; remainingDue: number; notes: number; reference: number; modeTotal: number; cashTotal: number; diff: number };

// Item 21: fallback only, used if the live taxation.tds_codes fetch (see
// tdsCodes signal) comes back empty — mirrors migration 149's seed values
// exactly so the fallback path still computes a correct amount, not just a
// section label. The real rates should always come from the server; this
// only covers the gap before that seed has ever run.
const TDS_SECTIONS_FALLBACK: { value: string; label: string; rate: number }[] = [
  { value: '194C',  label: '194C — Contractors/Sub-contractors (Individual/HUF)', rate: 1 },
  { value: '194H',  label: '194H — Commission/Brokerage', rate: 2 },
  { value: '194I',  label: '194I — Rent (Land/Building/Furniture)', rate: 10 },
  { value: '194J',  label: '194J — Professional/Technical Fees', rate: 10 },
  { value: '194JA', label: '194JA — Professional Fees (Individual/HUF)', rate: 2 },
  { value: '194R',  label: '194R — Benefits/Perquisites', rate: 10 },
];

const CASH_PAYMENT_LIMIT = 9999;
const CASH_RECEIPT_LIMIT = 199000;

const NO_BANK_OPTIONS: PaymentModeOption[] = [];

@Component({
  selector: 'app-payment-receipt-voucher',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NgSelectModule, DatePickerModule, ToastModule, InventoryScreenShell, PaymentModeSelectorComponent],
  providers: [MessageService],
  templateUrl: './payment-receipt-voucher.html',
  styleUrl: './payment-receipt-voucher.scss'
})
export class PaymentReceiptVoucherComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly inventoryConfigService = inject(InventoryConfigService);
  private readonly paymentsService = inject(PaymentsService);
  private readonly footerOffset = inject(StickyFooterOffsetService);
  private readonly messageService = inject(MessageService);
  private readonly exportService = inject(InventoryExportService);

  @ViewChildren(PaymentModeSelectorComponent) modeSelectors!: QueryList<PaymentModeSelectorComponent>;

  readonly Math = Math;

  // Item 21: live section/rate master, fetched once (mode-independent — TDS
  // codes aren't per-vendor/customer). Falls back to the hardcoded list only
  // if the server ever returns nothing (e.g. before 149's seed has run).
  //
  // Option `value` is a composite "sectionCode|deducteeType" key, not just
  // the section code — 194C alone has two different live rates (1% for
  // Individual/HUF, 2% for Company/Firm/Others), so section code alone
  // can't uniquely resolve a rate. `tdsSectionCode()` below strips the
  // composite back down to the plain code for the save payload/backend,
  // which only ever stored a bare section string.
  readonly tdsCodes = signal<TdsCode[]>([]);
  readonly tdsSectionOptions = computed(() => {
    const live = this.tdsCodes();
    if (live.length) {
      return live.map(c => ({
        value: `${c.section_code}|${c.deductee_type || ''}`,
        label: `${c.section_code} — ${c.description || ''}${c.deductee_type ? ` (${c.deductee_type})` : ''}`.trim()
      }));
    }
    return TDS_SECTIONS_FALLBACK.map(s => ({ value: s.value, label: s.label }));
  });

  readonly mode = signal<VoucherMode>('pay');
  readonly parties = signal<(VendorItem | CustomerItem)[]>([]);
  readonly loadingParties = signal(false);
  // Vendor Payment selects one vendor; Customer Receipt can select several
  // customers, and Save posts one receipt voucher per customer.
  readonly selectedPartyIds = signal<number[]>([]);
  // Which selected party each loaded invoice / note belongs to.
  private readonly invoicePartyIds = signal<Record<number, number>>({});
  private readonly notePartyIds = signal<Record<number, number>>({});
  // Bumped on every full reset so responses for an earlier selection are ignored.
  private partyLoadSeq = 0;
  private invoiceLoadsPending = 0;

  // Item 22: TCS — vendor-level FY-cumulative-purchases threshold, Vendor
  // Payment only. Unlike TDS's per-invoice Service gate, this is fetched
  // once per selected vendor (not per invoice) since it depends on the
  // vendor's whole-year purchase history, not what's on this voucher.
  readonly vendorFySummary = signal<VendorFyPurchaseSummary | null>(null);
  readonly tcsPercentageInput = signal<string>('');

  readonly outstandingInvoices = signal<OutstandingInvoice[]>([]);
  readonly loadingInvoices = signal(false);
  readonly selectedInvoiceIds = signal<Set<number>>(new Set());
  readonly allocAmounts = signal<Record<number, number>>({});
  readonly quickAmount = signal<number>(0);

  readonly availableNotes = signal<AvailableNote[]>([]);
  readonly selectedNoteIds = signal<Set<number>>(new Set());
  readonly noteApplyAmounts = signal<Record<number, number>>({});

  readonly modeRows = signal<ModeRow[]>([]);
  readonly accountBankOptions = signal<PaymentModeOption[]>([]);
  readonly accountDepositBankOptions = signal<PaymentModeOption[]>([]);
  readonly accountOnlinePaymentTypes = signal<PaymentModeOption[]>([]);
  // "Bank Name" means different things on the two sides, so it is fed
  // differently:
  //   Payment — the cheque is drawn on OUR account, so offer the banks
  //             configured in Accounts and let the primary one pre-select.
  //   Receipt — the customer pays from THEIR OWN bank, which is not one of our
  //             ledger accounts. Offering our configured banks here would stamp
  //             our account as the payer's, so the field is left as free text
  //             (bank name, branch and account number are all the customer's).
  //             Where the money lands is captured separately as the Deposited
  //             Bank, and that is what reaches our Bank Book.
  readonly bankOptionsForMode = computed<PaymentModeOption[]>(() =>
    this.mode() === 'pay' ? this.accountBankOptions() : NO_BANK_OPTIONS);

  // Cheque-book leaves / UPI handles per bank account, keyed by bank id and
  // fetched lazily the first time a row selects that bank (they are per-bank
  // master data, unlike the bank list itself which is per company/branch).
  readonly bankDetailsByBankId = signal<Record<string, { chequeNumbers: PaymentModeOption[]; upiNames: PaymentModeOption[] }>>({});
  private readonly bankDetailsRequested = new Set<string>();
  readonly narration = signal('');
  // Matches the Accounts payment voucher narration column (varchar(250)).
  readonly narrationMaxLength = 250;
  readonly tdsSection = signal<string>('');
  // Stored as a local-date 'YYYY-MM-DD' string (what the save API expects).
  // p-datepicker can't parse that string against dateFormat="dd-M-yy" and
  // rendered blank, so the template binds voucherDateValue() (a real Date)
  // and writes back through onVoucherDateChange(). toISOString() was also
  // avoided because it is UTC and gave yesterday's date before 05:30 IST.
  readonly voucherDate = signal<string>(this.toLocalIsoDate(new Date()));
  readonly voucherDateValue = computed<Date | null>(() => {
    const [y, m, d] = (this.voucherDate() || '').split('-').map(Number);
    return y && m && d ? new Date(y, m - 1, d) : null;
  });
  // Bug fix (2026-09-20): this screen renders its own Voucher Date picker
  // instead of going through the shared shell's transactionDateField()/
  // transactionDateValue()/maxTransactionDate machinery (it isn't a
  // config-driven field render at all -- see payment-receipt-voucher.html),
  // so it never picked up the "no future transaction dates" rule every other
  // Inventory transaction screen enforces via [maxDate]="maxTransactionDate".
  // Backdating stays unrestricted (no minDate), matching every other screen.
  readonly maxVoucherDate = new Date();

  readonly drawerInvoice = signal<OutstandingInvoice | null>(null);
  readonly drawerHistory = signal<{ voucherNumber: string; date?: string; amount: number }[]>([]);
  readonly drawerParty = computed(() => {
    const inv = this.drawerInvoice();
    const partyId = inv ? this.partyOfInvoice(inv.invoice_id) : null;
    return partyId == null ? null : this.parties().find(p => p.id === partyId) ?? null;
  });

  readonly vouchers = signal<PaymentVoucher[]>([]);
  readonly loadingVouchers = signal(false);

  readonly isSaving = signal(false);
  readonly saveMsg = signal('');
  readonly saveError = signal('');

  readonly partyType = computed<'vendor' | 'customer'>(() => this.mode() === 'pay' ? 'vendor' : 'customer');
  readonly partyLabel = computed(() => this.mode() === 'pay' ? 'Vendor' : 'Customer');
  readonly docLabel = computed(() => this.mode() === 'pay' ? 'Purchase Invoice' : 'Sales Invoice');
  readonly invoiceTypeKey = computed<'purchase_invoice' | 'sales_invoice'>(() => this.mode() === 'pay' ? 'purchase_invoice' : 'sales_invoice');
  readonly guideConfig = computed(() => this.mode() === 'pay' ? vendorPaymentConfig : customerReceiptConfig);
  readonly cashLimit = computed(() => this.mode() === 'pay' ? CASH_PAYMENT_LIMIT : CASH_RECEIPT_LIMIT);

  readonly multiPartySelect = computed(() => this.mode() === 'receipt');
  readonly partySelectModel = computed(() =>
    this.multiPartySelect() ? this.selectedPartyIds() : (this.selectedPartyIds()[0] ?? null));

  readonly selectedParties = computed(() => {
    const all = this.parties();
    return this.selectedPartyIds()
      .map(id => all.find(p => p.id === id))
      .filter((p): p is VendorItem | CustomerItem => !!p);
  });
  readonly hasParty = computed(() => this.selectedParties().length > 0);
  readonly isMultiParty = computed(() => this.selectedParties().length > 1);
  // The one selected party, or null when none / several are selected.
  readonly selectedParty = computed(() => this.selectedParties().length === 1 ? this.selectedParties()[0] : null);

  readonly partyName = (p: VendorItem | CustomerItem): string => (p as VendorItem).vendor_name ?? (p as CustomerItem).customer_name ?? '';

  readonly partyOptions = computed(() => this.parties().map(p => ({ id: p.id, name: this.partyName(p) })));
  readonly selectedPartyOptions = computed(() => this.selectedParties().map(p => ({ id: p.id, name: this.partyName(p) })));
  private readonly partyNameById = computed(() => new Map(this.parties().map(p => [p.id, this.partyName(p)])));

  readonly totalOutstanding = computed(() => this.outstandingInvoices().reduce((s, i) => s + i.outstanding, 0));
  readonly overdueTotal = computed(() => {
    const today = this.today();
    return this.outstandingInvoices()
      .filter(i => i.due_date && this.daysBetween(i.due_date, today) > 0)
      .reduce((s, i) => s + i.outstanding, 0);
  });

  readonly totalAllocated = computed(() => {
    const alloc = this.allocAmounts();
    let sum = 0;
    for (const id of this.selectedInvoiceIds()) sum += alloc[id] || 0;
    return sum;
  });

  // Balance that will still be outstanding for this party once this voucher is posted.
  readonly remainingOutstanding = computed(() => Math.max(0, this.totalOutstanding() - this.totalAllocated()));

  // GST embedded in the amount currently allocated to selected invoices,
  // split proportionally per invoice (an invoice's own tax_amount / total_amount ratio).
  readonly gstInAllocated = computed(() => {
    const alloc = this.allocAmounts();
    const ids = this.selectedInvoiceIds();
    let gst = 0;
    for (const inv of this.outstandingInvoices()) {
      if (!ids.has(inv.invoice_id) || !inv.tax_amount || !inv.total_amount) continue;
      gst += (alloc[inv.invoice_id] || 0) * (inv.tax_amount / inv.total_amount);
    }
    return gst;
  });
  readonly taxableInAllocated = computed(() => Math.max(0, this.totalAllocated() - this.gstInAllocated()));

  // Item 21: TDS only applies to a Vendor Payment (mode 'pay'), and only
  // when at least one selected invoice carries a Service line item —
  // sp_get_outstanding_invoices now returns has_service_item per invoice
  // for exactly this gate.
  readonly hasServiceAllocation = computed(() => {
    if (this.mode() !== 'pay') return false;
    const ids = this.selectedInvoiceIds();
    return this.outstandingInvoices().some(inv => ids.has(inv.invoice_id) && inv.has_service_item);
  });

  // Kept as its own name (rather than inlining hasServiceAllocation()
  // everywhere) since the template and save() already read it as
  // "is TDS applicable" — it's just no longer independently settable.
  readonly tdsApplicable = computed(() => this.hasServiceAllocation());

  // Real TDS base excludes GST (CBDT circular) — taxableInAllocated() is
  // exactly that once invoices are selected; before any invoice is picked
  // there's no GST split available yet, so quickAmount() is used as-is.
  readonly tdsBaseAmount = computed(() =>
    this.selectedInvoiceIds().size > 0 ? this.taxableInAllocated() : this.quickAmount()
  );

  readonly tdsSectionCode = computed(() => this.tdsSection().split('|')[0] || '');
  readonly tdsDeducteeType = computed(() => this.tdsSection().split('|')[1] || '');

  readonly tdsRate = computed(() => {
    const [code, deductee] = this.tdsSection().split('|');
    if (!code) return 0;
    const live = this.tdsCodes();
    if (live.length) {
      const match = live.find(c => c.section_code === code && (c.deductee_type || '') === (deductee || ''));
      return match?.rate ?? 0;
    }
    return TDS_SECTIONS_FALLBACK.find(s => s.value === code)?.rate ?? 0;
  });

  // Auto-computed, not manually typed — item 21's "shown automatically with
  // the percentage and amount" requirement. Zero unless TDS is applicable
  // AND a section has actually been picked (rate otherwise unknown).
  readonly tdsAmount = computed(() =>
    this.tdsApplicable() && this.tdsSection() && this.tdsRate() > 0
      // Whole rupees (Previous: Math.round(this.tdsBaseAmount() * this.tdsRate() / 100 * 100) / 100)
      ? Math.round(this.tdsBaseAmount() * this.tdsRate() / 100)
      : 0
  );

  // Item 22: TCS applicability is a Vendor Payment / Purchase-only, vendor-
  // level gate — "enabled" once this vendor's FY-cumulative posted Purchase
  // Invoice total has crossed ₹50L, independent of what's on THIS voucher
  // (unlike TDS's per-invoice Service check).
  readonly tcsThresholdCrossed = computed(() =>
    this.mode() === 'pay' && !!this.vendorFySummary()?.threshold_crossed
  );

  readonly tcsPercentage = computed(() => this.parseAmt(this.tcsPercentageInput()));

  // No rate master for TCS (per the user's own spec: "provide a small text
  // box to enter the percentage") — a manually-typed rate applied to the
  // same "amount of this payment" base referenceTotal() already represents
  // (GST-inclusive, unlike TDS's taxableInAllocated() base — no CBDT
  // GST-exclusion circular applies to TCS the way it does to TDS).
  readonly tcsAmount = computed(() =>
    this.tcsThresholdCrossed() && this.tcsPercentage() > 0
      // Whole rupees (Previous: Math.round(this.referenceTotal() * this.tcsPercentage() / 100 * 100) / 100)
      ? Math.round(this.referenceTotal() * this.tcsPercentage() / 100)
      : 0
  );

  // Debit/Credit Note value applied against this voucher — nets off the
  // invoice total, so cash/bank modes only need to cover what's left.
  readonly totalNotesApplied = computed(() => {
    const amounts = this.noteApplyAmounts();
    let sum = 0;
    for (const id of this.selectedNoteIds()) sum += amounts[id] || 0;
    return sum;
  });

  readonly modeTotal = computed(() => this.modeRows().reduce((s, r) => s + (r.amount || 0), 0));
  readonly cashModeTotal = computed(() => this.modeRows()
    .filter(r => r.details.modeKey === 'cash')
    .reduce((s, r) => s + (r.amount || 0), 0));
  // With several customers the cash limit applies to each customer's receipt.
  readonly cashLimitExceeded = computed(() => this.isMultiParty()
    ? this.partySummaries().some(s => s.cashTotal > this.cashLimit() + 0.005)
    : this.cashModeTotal() > this.cashLimit() + 0.005);
  readonly cashLimitMessage = computed(() =>
    `Total cash ${this.mode() === 'pay' ? 'payment against Purchase Invoice' : 'receipt against Sales Invoice'} cannot exceed ${this.fmt(this.cashLimit())}.`
  );

  readonly onAccountAmount = computed(() => Math.max(0, this.modeTotal() + this.totalNotesApplied() + this.tdsAmount() - this.tcsAmount() - this.totalAllocated()));
  readonly netAmount = computed(() => Math.max(0, this.modeTotal()));

  // What the mode-total should match: the selected invoices' allocated total
  // once any are ticked, otherwise the quick "amount to pay/receive" figure
  // typed at the top before any invoice is picked — minus whatever's been
  // netted off via an applied Debit/Credit Note.
  readonly referenceTotal = computed(() => Math.max(0,
    (this.selectedInvoiceIds().size > 0 ? this.totalAllocated() : this.quickAmount()) - this.totalNotesApplied()
  ));
  readonly modeDiff = computed(() => this.modeTotal() - (this.referenceTotal() - this.tdsAmount() + this.tcsAmount()));
  // A difference under 50 paise rounds to ₹ 0, so it counts as matched
  // (only older invoices still carry paise). Previous: this.modeDiff() < -0.005
  readonly modeShort = computed(() => this.modeDiff() <= -0.5);

  // Per-customer totals — each one becomes its own voucher on Save.
  readonly partySummaries = computed<PartySummary[]>(() => {
    const multi = this.isMultiParty();
    const alloc = this.allocAmounts();
    const invoiceIds = this.selectedInvoiceIds();
    const noteAmounts = this.noteApplyAmounts();
    const noteIds = this.selectedNoteIds();
    return this.selectedParties().map(p => {
      let allocated = 0;
      for (const id of invoiceIds) if (this.partyOfInvoice(id) === p.id) allocated += alloc[id] || 0;
      let notes = 0;
      for (const id of noteIds) if (this.partyOfNote(id) === p.id) notes += noteAmounts[id] || 0;
      const rows = this.modeRows().filter(r => this.rowParty(r) === p.id);
      const modeTotal = rows.reduce((s, r) => s + (r.amount || 0), 0);
      const cashTotal = rows.filter(r => r.details.modeKey === 'cash').reduce((s, r) => s + (r.amount || 0), 0);
      const previousBalance = this.outstandingInvoices()
        .filter(inv => this.partyOfInvoice(inv.invoice_id) === p.id)
        .reduce((s, inv) => s + inv.outstanding, 0);
      const remainingDue = Math.max(0, previousBalance - allocated);
      const reference = multi ? Math.max(0, allocated - notes) : this.referenceTotal();
      return { id: p.id, name: this.partyName(p), previousBalance, allocated, remainingDue, notes, reference, modeTotal, cashTotal, diff: modeTotal - reference };
    });
  });

  readonly canSave = computed(() =>
    this.hasParty() && (this.totalAllocated() > 0 || this.modeTotal() > 0 || this.totalNotesApplied() > 0) && !this.isSaving()
  );

  private singlePartyId(): number | null {
    const ids = this.selectedPartyIds();
    return ids.length === 1 ? ids[0] : null;
  }
  partyOfInvoice(invoiceId: number): number | null { return this.invoicePartyIds()[invoiceId] ?? this.singlePartyId(); }
  partyOfNote(noteId: number): number | null { return this.notePartyIds()[noteId] ?? this.singlePartyId(); }
  private rowParty(row: ModeRow): number | null { return this.isMultiParty() ? row.partyId : this.singlePartyId(); }
  partyNameOf(partyId: number | null): string { return partyId == null ? '' : this.partyNameById().get(partyId) ?? ''; }

  constructor() {
    this.route.data.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(data => {
      const initialMode = (data['mode'] === 'receipt' ? 'receipt' : 'pay') as VoucherMode;
      this.setMode(initialMode);
    });

    // Push the global SOS button up above this page's own sticky footer while it's visible.
    effect(() => this.footerOffset.set(this.hasParty() ? 100 : 0));
    this.destroyRef.onDestroy(() => this.footerOffset.clear());

    // Item 21: clear a stale section pick the moment the Service condition
    // that justified it stops holding (e.g. the user un-ticks the one
    // Service invoice) — tdsApplicable itself is now just an alias for
    // hasServiceAllocation() (see its getter below), no separate manual
    // toggle to keep in sync.
    effect(() => { if (!this.hasServiceAllocation()) this.tdsSection.set(''); });

    this.paymentsService.getTdsCodes().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => this.tdsCodes.set(res.data ?? []),
      error: () => this.tdsCodes.set([])
    });

    this.loadPaymentAccountSetup();
  }

  today(): string { return this.toLocalIsoDate(new Date()); }
  onVoucherDateChange(value: Date | null): void {
    this.voucherDate.set(value instanceof Date && !isNaN(value.getTime()) ? this.toLocalIsoDate(value) : '');
  }
  private toLocalIsoDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  daysBetween(a: string, b: string): number { return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000); }
  fmtDate(d?: string): string { return d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }
  // Amounts on this screen are whole rupees (231.8942 -> 232).
  // Previous: fmt(n: number | undefined): string { return '₹ ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  fmt(n: number | undefined): string { return '₹ ' + Math.round(Number(n || 0)).toLocaleString('en-IN'); }

  // Value shown in an amount input box: whole rupees, blank for 0.
  rupeeInput(n: number): string { return n ? String(Math.round(n)) : ''; }

  agingLabel(inv: OutstandingInvoice): { text: string; cls: string } {
    if (!inv.due_date) return { text: 'Not set', cls: 'badge-success' };
    const od = this.daysBetween(inv.due_date, this.today());
    const partPaid = inv.paid_amount > 0;
    if (od > 0) return { text: `Overdue ${od}d${partPaid ? ' · Part-paid' : ''}`, cls: 'badge-danger' };
    if (partPaid) return { text: 'Part-paid', cls: 'badge-info' };
    if (od > -7) return { text: `Due in ${-od}d`, cls: 'badge-warning' };
    return { text: 'Not set', cls: 'badge-success' };
  }

  setMode(mode: VoucherMode): void {
    this.mode.set(mode);
    this.selectedPartyIds.set([]);
    this.partyLoadSeq++;
    this.invoiceLoadsPending = 0;
    this.loadingInvoices.set(false);
    this.outstandingInvoices.set([]);
    this.invoicePartyIds.set({});
    this.selectedInvoiceIds.set(new Set());
    this.allocAmounts.set({});
    this.availableNotes.set([]);
    this.notePartyIds.set({});
    this.selectedNoteIds.set(new Set());
    this.noteApplyAmounts.set({});
    this.quickAmount.set(0);
    this.modeRows.set([]);
    this.narration.set('');
    this.tdsSection.set('');
    this.vendorFySummary.set(null);
    this.tcsPercentageInput.set('');
    this.saveMsg.set('');
    this.saveError.set('');
    this.loadParties();
    this.loadVouchers();
  }

  private loadParties(): void {
    this.loadingParties.set(true);
    const onNext = (res: { data?: (VendorItem | CustomerItem)[] }) => { this.parties.set(res.data ?? []); this.loadingParties.set(false); };
    const onError = () => { this.parties.set([]); this.loadingParties.set(false); };
    if (this.mode() === 'pay') {
      this.inventoryConfigService.getVendors(null, false).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: onNext, error: onError });
    } else {
      this.inventoryConfigService.getCustomers(null, false).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: onNext, error: onError });
    }
  }

  private loadVouchers(): void {
    this.loadingVouchers.set(true);
    this.paymentsService.getPaymentVouchers(this.mode() === 'pay' ? 'payment' : 'receipt')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => { this.vouchers.set(res.data ?? []); this.loadingVouchers.set(false); },
        error: () => { this.vouchers.set([]); this.loadingVouchers.set(false); }
      });
  }

  private loadPaymentAccountSetup(): void {
    this.paymentsService.getPaymentVoucherAccountSetup()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: setup => {
          this.accountBankOptions.set(setup.banks ?? []);
          this.accountDepositBankOptions.set(setup.depositBanks ?? []);
          this.accountOnlinePaymentTypes.set(setup.onlinePaymentTypes ?? []);
        },
        error: () => {
          this.accountBankOptions.set([]);
          this.accountDepositBankOptions.set([]);
          this.accountOnlinePaymentTypes.set([]);
        }
      });
  }

  // ng-select hands back a single id (Vendor Payment) or an id array
  // (Customer Receipt, multi-select).
  onPartyChange(value: number | number[] | null): void {
    const next = value == null ? [] : (Array.isArray(value) ? value : [value]);
    const prev = this.selectedPartyIds();
    this.selectedPartyIds.set(next);
    const kept = next.filter(id => prev.includes(id));
    if (!kept.length) {
      // A completely different selection: start over, same as before.
      this.resetPartyData();
      this.fetchPartyData(next);
      return;
    }
    // Customers added to / removed from the selection: keep what was already
    // ticked for the customers that stay.
    const removed = prev.filter(id => !next.includes(id));
    if (removed.length) this.dropPartyData(removed);
    this.fetchPartyData(next.filter(id => !prev.includes(id)));
  }

  private reloadSelectedParties(): void {
    this.resetPartyData();
    this.fetchPartyData(this.selectedPartyIds());
  }

  private resetPartyData(): void {
    this.partyLoadSeq++;
    this.invoiceLoadsPending = 0;
    this.loadingInvoices.set(false);
    // Drop the previous vendor's invoice numbers from the narration before
    // its invoice list is cleared.
    this.setSelectedInvoices(new Set());
    this.outstandingInvoices.set([]);
    this.invoicePartyIds.set({});
    this.allocAmounts.set({});
    this.availableNotes.set([]);
    this.notePartyIds.set({});
    this.selectedNoteIds.set(new Set());
    this.noteApplyAmounts.set({});
    this.quickAmount.set(0);
    this.modeRows.set([]);
    this.vendorFySummary.set(null);
    this.tcsPercentageInput.set('');
  }

  private dropPartyData(partyIds: number[]): void {
    const gone = new Set(partyIds);
    const invoiceParty = this.invoicePartyIds();
    const goneInvoices = new Set(this.outstandingInvoices().filter(i => gone.has(invoiceParty[i.invoice_id])).map(i => i.invoice_id));
    this.setSelectedInvoices(new Set([...this.selectedInvoiceIds()].filter(id => !goneInvoices.has(id))));
    this.outstandingInvoices.update(rows => rows.filter(i => !goneInvoices.has(i.invoice_id)));
    this.allocAmounts.update(a => Object.fromEntries(Object.entries(a).filter(([id]) => !goneInvoices.has(+id))));
    this.invoicePartyIds.update(m => Object.fromEntries(Object.entries(m).filter(([, p]) => !gone.has(p))));

    const noteParty = this.notePartyIds();
    const goneNotes = new Set(this.availableNotes().filter(n => gone.has(noteParty[n.note_id])).map(n => n.note_id));
    this.selectedNoteIds.update(ids => new Set([...ids].filter(id => !goneNotes.has(id))));
    this.availableNotes.update(rows => rows.filter(n => !goneNotes.has(n.note_id)));
    this.noteApplyAmounts.update(a => Object.fromEntries(Object.entries(a).filter(([id]) => !goneNotes.has(+id))));
    this.notePartyIds.update(m => Object.fromEntries(Object.entries(m).filter(([, p]) => !gone.has(p))));

    this.modeRows.update(rows => rows.filter(r => r.partyId == null || !gone.has(r.partyId)));
  }

  private fetchPartyData(partyIds: number[]): void {
    const seq = this.partyLoadSeq;
    const isCurrent = (partyId: number) => seq === this.partyLoadSeq && this.selectedPartyIds().includes(partyId);
    const loadDone = () => {
      if (seq !== this.partyLoadSeq) return;
      this.invoiceLoadsPending = Math.max(0, this.invoiceLoadsPending - 1);
      this.loadingInvoices.set(this.invoiceLoadsPending > 0);
    };
    for (const partyId of partyIds) {
      this.invoiceLoadsPending++;
      this.loadingInvoices.set(true);
      this.paymentsService.getOutstandingInvoices(this.partyType(), partyId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: res => { if (isCurrent(partyId)) this.appendInvoices(partyId, res.data ?? []); loadDone(); },
          error: () => loadDone()
        });
      this.paymentsService.getAvailableNotes(this.partyType(), partyId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: res => { if (isCurrent(partyId)) this.appendNotes(partyId, res.data ?? []); },
          error: () => {}
        });
      // Item 22: vendor-level FY threshold check, Vendor Payment only.
      if (this.mode() === 'pay') {
        this.paymentsService.getVendorFyPurchaseSummary(partyId)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: res => { if (isCurrent(partyId)) this.vendorFySummary.set(res.data ?? null); },
            error: () => { if (isCurrent(partyId)) this.vendorFySummary.set(null); }
          });
      }
    }
  }

  private appendInvoices(partyId: number, rows: OutstandingInvoice[]): void {
    const have = new Set(this.outstandingInvoices().map(i => i.invoice_id));
    const fresh = rows.filter(r => !have.has(r.invoice_id));
    this.outstandingInvoices.update(list => [...list, ...fresh]);
    this.invoicePartyIds.update(m => ({ ...m, ...Object.fromEntries(fresh.map(r => [r.invoice_id, partyId])) }));
  }

  private appendNotes(partyId: number, rows: AvailableNote[]): void {
    const have = new Set(this.availableNotes().map(n => n.note_id));
    const fresh = rows.filter(r => !have.has(r.note_id));
    this.availableNotes.update(list => [...list, ...fresh]);
    this.notePartyIds.update(m => ({ ...m, ...Object.fromEntries(fresh.map(r => [r.note_id, partyId])) }));
  }

  setTcsPercentage(value: string): void { this.tcsPercentageInput.set(value); }

  toggleInvoice(inv: OutstandingInvoice, checked: boolean): void {
    const ids = new Set(this.selectedInvoiceIds());
    const alloc = { ...this.allocAmounts() };
    if (checked) {
      ids.add(inv.invoice_id);
      if (!alloc[inv.invoice_id]) alloc[inv.invoice_id] = inv.outstanding;
    } else {
      ids.delete(inv.invoice_id);
      alloc[inv.invoice_id] = 0;
    }
    this.setSelectedInvoices(ids);
    this.allocAmounts.set(alloc);
  }

  // Vendor Payment: keep the selected Purchase Invoice numbers bound into
  // the narration — added on check, removed on uncheck — without touching
  // any text the user typed around them.
  private setSelectedInvoices(next: Set<number>): void {
    if (this.mode() === 'pay') {
      const prev = this.selectedInvoiceIds();
      const numberOf = new Map(this.outstandingInvoices().map(i => [i.invoice_id, i.invoice_number]));
      let text = this.narration();
      for (const id of prev) {
        const no = numberOf.get(id);
        if (no && !next.has(id)) text = this.removeNarrationToken(text, no);
      }
      let skipped = 0;
      for (const id of next) {
        const no = numberOf.get(id);
        if (!no || prev.has(id) || this.findNarrationToken(text, no)) continue;
        const candidate = text.trim() ? `${text.trim()}, ${no}` : no;
        // Accounts tbl_trans_payment_voucher.narration is varchar(250);
        // stop binding numbers once the narration would overflow it.
        if (candidate.length > this.narrationMaxLength) { skipped++; continue; }
        text = candidate;
      }
      this.narration.set(text);
      if (skipped > 0) {
        this.saveMsg.set(`Narration limit (${this.narrationMaxLength} characters) reached — ${skipped} invoice number(s) not added to narration.`);
      }
    }
    this.selectedInvoiceIds.set(next);
  }

  private narrationTokenRegex(no: string): RegExp {
    const esc = no.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|,\\s*)${esc}(?![\\w/-])`);
  }

  private findNarrationToken(text: string, no: string): boolean { return this.narrationTokenRegex(no).test(text); }

  private removeNarrationToken(text: string, no: string): string {
    return text.replace(this.narrationTokenRegex(no), '').replace(/^\s*,\s*/, '').trim();
  }

  isSelected(inv: OutstandingInvoice): boolean { return this.selectedInvoiceIds().has(inv.invoice_id); }
  allocFor(inv: OutstandingInvoice): number { return this.allocAmounts()[inv.invoice_id] || 0; }

  setAlloc(inv: OutstandingInvoice, value: string): void {
    // Previous: let v = this.parseAmt(value);
    let v = this.parseRupees(value);
    // Capped at the exact outstanding, so an older invoice with paise still
    // settles in full when its rounded figure is typed.
    if (v > inv.outstanding) v = inv.outstanding;
    this.allocAmounts.update(a => ({ ...a, [inv.invoice_id]: v }));
  }

  allocExceeds(inv: OutstandingInvoice): boolean { return this.allocFor(inv) > inv.outstanding + 0.005; }

  fullAlloc(inv: OutstandingInvoice): void {
    const ids = new Set(this.selectedInvoiceIds());
    ids.add(inv.invoice_id);
    this.setSelectedInvoices(ids);
    this.allocAmounts.update(a => ({ ...a, [inv.invoice_id]: inv.outstanding }));
  }

  selectAll(on: boolean): void {
    const ids = new Set<number>();
    const alloc: Record<number, number> = {};
    for (const inv of this.outstandingInvoices()) {
      if (on) { ids.add(inv.invoice_id); alloc[inv.invoice_id] = inv.outstanding; }
      else alloc[inv.invoice_id] = 0;
    }
    this.setSelectedInvoices(ids);
    this.allocAmounts.set(alloc);
  }

  allSelected(): boolean {
    const rows = this.outstandingInvoices();
    return rows.length > 0 && rows.every(r => this.isSelected(r));
  }

  toggleNote(note: AvailableNote, checked: boolean): void {
    const ids = new Set(this.selectedNoteIds());
    const amounts = { ...this.noteApplyAmounts() };
    if (checked) {
      ids.add(note.note_id);
      if (!amounts[note.note_id]) amounts[note.note_id] = note.outstanding;
    } else {
      ids.delete(note.note_id);
      amounts[note.note_id] = 0;
    }
    this.selectedNoteIds.set(ids);
    this.noteApplyAmounts.set(amounts);
  }

  isNoteSelected(note: AvailableNote): boolean { return this.selectedNoteIds().has(note.note_id); }
  noteApplyFor(note: AvailableNote): number { return this.noteApplyAmounts()[note.note_id] || 0; }

  setNoteApply(note: AvailableNote, value: string): void {
    // Previous: let v = this.parseAmt(value);
    let v = this.parseRupees(value);
    if (v > note.outstanding) v = note.outstanding;
    this.noteApplyAmounts.update(a => ({ ...a, [note.note_id]: v }));
  }

  noteApplyExceeds(note: AvailableNote): boolean { return this.noteApplyFor(note) > note.outstanding + 0.005; }

  clearAllocations(): void {
    this.setSelectedInvoices(new Set());
    this.allocAmounts.set({});
    this.selectedNoteIds.set(new Set());
    this.noteApplyAmounts.set({});
    this.quickAmount.set(0);
    this.modeRows.set([]);
    this.tdsSection.set('');
  }

  setTdsSection(value: string): void { this.tdsSection.set(value); }

  parseAmt(v: string): number {
    const n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
    return isNaN(n) ? 0 : n;
  }

  // Typed amounts are whole rupees; parseAmt() stays for percentages (TCS %).
  parseRupees(v: string): number { return Math.round(this.parseAmt(v)); }

  autoAllocate(): void {
    let amt = this.quickAmount();
    if (amt <= 0) { this.saveError.set('Enter an amount to auto-allocate.'); return; }
    const sorted = [...this.outstandingInvoices()].sort((a, b) =>
      new Date(a.due_date || a.invoice_date || '').getTime() - new Date(b.due_date || b.invoice_date || '').getTime());
    const ids = new Set<number>();
    const alloc: Record<number, number> = {};
    for (const inv of sorted) {
      if (amt <= 0) { alloc[inv.invoice_id] = 0; continue; }
      const take = Math.min(inv.outstanding, amt);
      ids.add(inv.invoice_id);
      alloc[inv.invoice_id] = take;
      amt -= take;
    }
    this.setSelectedInvoices(ids);
    this.allocAmounts.set(alloc);
    this.saveError.set('');
    if (amt > 0.005) this.saveMsg.set(`${this.fmt(amt)} left unallocated after auto-allocating.`);
  }

  addMode(): void {
    if (this.isMultiParty()) {
      // Default the new row to the first customer still short of receipts.
      const short = this.partySummaries().find(s => s.diff < -0.005);
      // Previous: amount: short ? -short.diff : 0
      this.modeRows.update(rows => [...rows, { details: defaultPaymentModeValue(), amount: short ? Math.round(-short.diff) : 0, partyId: short?.id ?? null }]);
      return;
    }
    // Previous: const remain = Math.max(0, this.referenceTotal() - this.modeTotal());
    const remain = Math.max(0, Math.round(this.referenceTotal() - this.modeTotal()));
    this.modeRows.update(rows => [...rows, { details: defaultPaymentModeValue(), amount: remain, partyId: this.singlePartyId() }]);
  }
  setModeParty(idx: number, partyId: number | null): void {
    this.modeRows.update(rows => rows.map((r, i) => i === idx ? { ...r, partyId } : r));
  }
  removeMode(idx: number): void { this.modeRows.update(rows => rows.filter((_, i) => i !== idx)); }
  setModeAmount(idx: number, value: string): void {
    // Previous: const v = this.parseAmt(value);
    const v = this.parseRupees(value);
    this.modeRows.update(rows => rows.map((r, i) => i === idx ? { ...r, amount: v } : r));
  }
  setModeDetails(idx: number, details: PaymentModeSelectorValue): void {
    this.modeRows.update(rows => rows.map((r, i) => i === idx ? { ...r, details } : r));
    this.loadBankDetails(details.bankId);
  }

  private loadBankDetails(bankId: any): void {
    const key = this.bankKey(bankId);
    if (!key || this.bankDetailsRequested.has(key)) return;
    this.bankDetailsRequested.add(key);
    this.paymentsService.getPaymentVoucherBankDetails(bankId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(details => this.bankDetailsByBankId.update(map => ({ ...map, [key]: details })));
  }

  private bankKey(bankId: any): string {
    return bankId === null || bankId === undefined ? '' : String(bankId);
  }

  // Both are called from the template, so they hand back a shared empty array
  // rather than a fresh [] per change-detection pass.
  chequeNumbersFor(row: ModeRow): PaymentModeOption[] {
    return this.bankDetailsByBankId()[this.bankKey(row.details.bankId)]?.chequeNumbers ?? NO_BANK_OPTIONS;
  }

  upiNamesFor(row: ModeRow): PaymentModeOption[] {
    return this.bankDetailsByBankId()[this.bankKey(row.details.bankId)]?.upiNames ?? NO_BANK_OPTIONS;
  }

  // Flattens the shared component's rich output into the flat string map
  // `inv_payment_voucher_modes.ref_json` (JSONB) already expects -- no
  // backend/schema changes needed, this just slots the same shape in.
  private buildRefJson(d: PaymentModeSelectorValue): Record<string, string> {
    const json: Record<string, string> = {};
    const put = (k: string, v: string | number | null | undefined) => { if (v !== null && v !== undefined && v !== '') json[k] = String(v); };
    if (d.mode === 'BANK') {
      put('bankSubType', d.bankSubType);
      put('bankId', d.bankId);
      put('bankName', d.bankName);
      put('branchName', d.branchName);
      put('accountNumber', d.accountNumber);
      put(d.bankSubType === 'CHEQUE' ? 'chequeNumber' : 'referenceNumber', d.refNumber);
      put('chequeBookId', d.chequeBookId);
      put(d.bankSubType === 'CHEQUE' ? 'chequeDate' : 'transactionDate', d.refDate);
      put('cardNumber', d.cardNumber);
      put('bankFinancialServices', d.bankFinancialServices);
      put('typeOfPayment', d.typeOfPayment);
      put('upiId', d.upiId);
      put('depositBankId', d.depositBankId);
      put('depositBankName', d.depositBankName);
    }
    put('summary', d.summary);
    return json;
  }

  openDrawer(inv: OutstandingInvoice): void {
    this.drawerInvoice.set(inv);
    const history: { voucherNumber: string; date?: string; amount: number }[] = [];
    for (const v of this.vouchers()) {
      if (v.status !== 'posted') continue;
      for (const a of v.allocations) {
        if (a.invoice_id === inv.invoice_id) history.push({ voucherNumber: v.voucher_number, date: v.voucher_date, amount: a.allocated_amount });
      }
    }
    this.drawerHistory.set(history);
  }
  closeDrawer(): void { this.drawerInvoice.set(null); }

  // Print / PDF / Excel — same Accounts-style output as every other screen.
  // The toolbar exports the saved-vouchers list; the row icons print one
  // voucher in the Accounts voucher layout (header block, S.No / Particulars /
  // Amount, narration, Approved / Verified / Posted By).
  exportVoucherList(action: 'Pdf' | 'Print' | 'Excel'): void {
    const list = this.vouchers();
    if (!list.length) { this.saveMsg.set('No rows available for this action.'); return; }
    const title = this.mode() === 'pay' ? 'Vendor Payments' : 'Customer Receipts';
    const exportDoc: InventoryExportDocument = {
      title,
      columns: ['Voucher No', 'Date', this.partyLabel(), 'Cheque No', 'Allocated', 'TDS', 'TCS', 'Net', 'Narration', 'Status'],
      rows: list.map(v => [
        v.voucher_number || '',
        this.pdfDate(v.voucher_date),
        v.party_name || '',
        this.chequeDetails(v).numbers || '-',
        this.pdfAmt(v.total_allocated),
        v.tds_amount ? this.pdfAmt(v.tds_amount) : '-',
        v.tcs_amount ? this.pdfAmt(v.tcs_amount) : '-',
        this.pdfAmt(v.net_amount),
        v.narration || '-',
        v.status ? v.status.charAt(0).toUpperCase() + v.status.slice(1) : ''
      ]),
      // 10 columns would otherwise auto-switch the export to landscape.
      orientation: 'portrait',
      // All 10 widths fixed (sum = 180mm usable A4 portrait) so no-space values
      // like PAY-SS-26-00005, dates, amounts and 'Cancelled' never break mid-word;
      // TDS / TCS only hold '-' or a short amount, so they give up the space.
      pdfColumnWidths: { 0: 27, 1: 18, 2: 28, 3: 14, 4: 19, 5: 10, 6: 10, 7: 19, 8: 20, 9: 15 },
      pdfHeadFontSize: 8,
      fileName: title
    };
    if (action === 'Excel') this.exportService.excel(exportDoc);
    else this.exportService.pdf(exportDoc, action);
  }

  printVoucher(v: PaymentVoucher, action: 'Pdf' | 'Print'): void {
    const isPay = v.voucher_type !== 'receipt';
    // Previous Balance / Remaining Due are stored on the voucher when it is
    // saved, so a reprint shows the balance as it was then. Vouchers saved
    // before the snapshot existed print without them.
    const hasBalance = v.previous_balance != null && v.remaining_due != null;
    const typeLabel: Record<string, string> = {
      purchase_invoice: 'Purchase Invoice', sales_invoice: 'Sales Invoice',
      debit_note: 'Debit Note', credit_note: 'Credit Note'
    };
    const rows = (v.allocations || []).map((a, i) => [
      String(i + 1),
      `${typeLabel[a.invoice_type] || 'Invoice'} ${a.invoice_number || ''}`.trim(),
      this.pdfAmt(a.allocated_amount)
    ]);
    if (!rows.length) rows.push(['1', 'On Account', this.pdfAmt(v.net_amount)]);
    const modes = (v.modes || [])
      .map(m => {
        const label = m.ref_json?.['summary'] || m.mode_key;
        // Customer Receipt prints the mode without its amount.
        return isPay ? `${label} (${this.pdfAmt(m.amount)})` : label;
      })
      .join(', ');
    const cheque = this.chequeDetails(v);
    const summary: Array<[string, string]> = [];
    if (hasBalance) summary.push(['Previous Balance', this.pdfAmt(v.previous_balance!)]);
    summary.push(['Total Allocated', this.pdfAmt(v.total_allocated)]);
    if (hasBalance) summary.push(['Remaining Due', this.pdfAmt(v.remaining_due!)]);
    if (v.tds_amount) summary.push(['TDS', this.pdfAmt(v.tds_amount)]);
    if (v.tcs_amount) summary.push([`TCS${v.tcs_percentage ? ` (${v.tcs_percentage}%)` : ''}`, this.pdfAmt(v.tcs_amount)]);
    summary.push(['Net Amount', this.pdfAmt(v.net_amount)]);
    const title = isPay ? 'Payment Voucher' : 'Customer Receipt';
    this.exportService.pdf({
      title,
      fields: [
        ['Voucher No', v.voucher_number || ''],
        ['Date', this.pdfDate(v.voucher_date)],
        [isPay ? 'Paid To' : 'Received From', v.party_name || ''],
        ['GSTIN', v.party_gstin || ''],
        ['Mode of Payment', modes],
        ['Cheque No', cheque.numbers],
        ['Cheque Date', cheque.dates],
        // Customer Receipt prints without the Status line.
        ...(isPay ? [['Status', v.status ? v.status.charAt(0).toUpperCase() + v.status.slice(1) : ''] as [string, string]] : [])
      ],
      columns: ['S.No.', 'Particulars', 'Amount'],
      rows,
      summary,
      amountInWords: this.exportService.amountInWords(v.net_amount),
      amountInWordsPosition: 'below',
      // Always print the Narration line, even when none was entered.
      notes: v.narration || '-',
      notesLabel: 'Narration',
      // Payment vouchers and customer receipts both get a receiver's signature
      // slot. It goes first because the export prints signedBy above the LAST
      // caption (Posted By).
      signatures: ["(Receiver's Signature)", '(Approved By)', '(Verified By)', '(Posted By)'],
      signedBy: this.exportService.userName(),
      orientation: 'portrait',
      fileName: `${title} ${v.voucher_number || ''}`.trim()
    }, action);
  }

  // Cheque no./date straight from the saved ref_json, so they print even when
  // the mode's summary text is missing (older vouchers).
  private chequeDetails(v: PaymentVoucher): { numbers: string; dates: string } {
    const cheques = (v.modes || []).filter(m => m.mode_key === 'cheque' || m.ref_json?.['bankSubType'] === 'CHEQUE');
    return {
      numbers: cheques.map(m => m.ref_json?.['chequeNumber'] || '').filter(Boolean).join(', '),
      dates: cheques.map(m => this.pdfDate(m.ref_json?.['chequeDate'])).filter(Boolean).join(', ')
    };
  }

  private pdfAmt(n: number | undefined): string {
    // Previous: return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return Math.round(Number(n || 0)).toLocaleString('en-IN');
  }

  private pdfDate(d?: string): string {
    if (!d) return '';
    const date = new Date(d);
    return isNaN(date.getTime()) ? d : formatDate(date, 'dd-MMM-yyyy', 'en-US');
  }

  save(): void {
    const parties = this.selectedParties();
    if (!parties.length) { this.saveError.set('Select a ' + this.partyLabel().toLowerCase() + ' first.'); return; }
    const multi = this.isMultiParty();
    const activeModeRows = this.modeRows().filter(r => r.amount > 0);
    if (this.cashLimitExceeded()) {
      const over = multi ? this.partySummaries().find(s => s.cashTotal > this.cashLimit() + 0.005) : undefined;
      this.saveError.set(over ? `${over.name}: ${this.cashLimitMessage()}` : this.cashLimitMessage());
      return;
    }
    const invalidRow = activeModeRows.find(r => !r.details.isValid);
    if (invalidRow) {
      this.saveError.set('Complete the required fields for each ' + (this.mode() === 'pay' ? 'payment' : 'receipt') + ' mode before saving.');
      this.modeSelectors?.forEach(c => c.markAllTouched());
      return;
    }
    if (multi && activeModeRows.some(r => r.partyId == null)) {
      this.saveError.set(`Select the ${this.partyLabel().toLowerCase()} for each ${this.mode() === 'pay' ? 'payment' : 'receipt'} mode.`);
      return;
    }

    // One voucher per selected party, carrying only that party's invoices,
    // notes and modes. Parties with nothing entered are skipped.
    const summaries = new Map(this.partySummaries().map(s => [s.id, s]));
    const drafts = parties.map(party => {
      const allocations = this.outstandingInvoices()
        .filter(inv => this.partyOfInvoice(inv.invoice_id) === party.id && this.isSelected(inv) && this.allocFor(inv) > 0)
        .map(inv => ({
          invoiceType: this.invoiceTypeKey(),
          invoiceId: inv.invoice_id,
          invoiceNumber: inv.invoice_number,
          allocatedAmount: this.allocFor(inv)
        }));
      const noteAllocations = this.availableNotes()
        .filter(n => this.partyOfNote(n.note_id) === party.id && this.isNoteSelected(n) && this.noteApplyFor(n) > 0)
        .map(n => ({
          invoiceType: n.note_type,
          invoiceId: n.note_id,
          invoiceNumber: n.note_number,
          allocatedAmount: this.noteApplyFor(n)
        }));
      const rows = activeModeRows.filter(r => this.rowParty(r) === party.id);
      const modes = rows.map(r => ({ modeKey: r.details.modeKey, amount: r.amount, refJson: this.buildRefJson(r.details) }));
      return { party, allocations, noteAllocations, modes, reference: summaries.get(party.id)?.reference ?? 0, modeTotal: rows.reduce((s, r) => s + r.amount, 0) };
    }).filter(d => d.allocations.length || d.noteAllocations.length || d.modes.length);

    if (!drafts.length) { this.saveError.set('Nothing to save — allocate an amount.'); return; }
    const noMode = drafts.find(d => d.modes.length === 0 && d.reference > 0.005);
    if (noMode) {
      this.saveError.set('Add at least one ' + (this.mode() === 'pay' ? 'payment' : 'receipt') + ' mode' + (multi ? ` for ${this.partyName(noMode.party)}.` : '.'));
      return;
    }
    if (this.mode() === 'pay' && this.tdsApplicable() && !this.tdsSection()) {
      this.saveError.set('This payment includes a Service invoice — select the applicable TDS section.');
      return;
    }
    if (this.narration().trim().length > this.narrationMaxLength) {
      this.saveError.set(`Narration cannot exceed ${this.narrationMaxLength} characters — shorten it before saving.`);
      return;
    }

    this.isSaving.set(true);
    this.saveMsg.set('');
    this.saveError.set('');
    this.postDrafts(drafts, 0, []);
  }

  // Posts the per-party vouchers one after another so voucher numbers come out
  // in order; stops at the first failure and reports what was already posted.
  private postDrafts(
    drafts: { party: VendorItem | CustomerItem; allocations: any[]; noteAllocations: any[]; modes: any[]; modeTotal: number }[],
    index: number,
    posted: string[]
  ): void {
    const draft = drafts[index];
    const party = draft.party;
    const fail = (msg: string) => {
      this.isSaving.set(false);
      const detail = posted.length ? `${msg} (${posted.join(', ')} already posted; the rest were not saved.)` : msg;
      this.saveError.set(detail);
      this.messageService.add({ severity: 'error', summary: 'Save failed', detail, life: 5000 });
      if (posted.length) {
        // Posted invoices are no longer outstanding — reload so they can't be posted twice.
        this.loadVouchers();
        this.reloadSelectedParties();
      }
    };
    this.paymentsService.savePaymentVoucher({
      voucherType: this.mode() === 'pay' ? 'payment' : 'receipt',
      voucherDate: this.voucherDate(),
      partyType: this.partyType(),
      partyId: party.id,
      partyName: this.partyName(party),
      partyGstin: (party as VendorItem).gstin,
      narration: this.narration(),
      tdsAmount: this.mode() === 'pay' ? this.tdsAmount() : 0,
      tdsSection: this.mode() === 'pay' ? this.tdsSectionCode() : undefined,
      tcsAmount: this.mode() === 'pay' ? this.tcsAmount() : 0,
      tcsPercentage: this.mode() === 'pay' && this.tcsPercentage() > 0 ? this.tcsPercentage() : null,
      allocations: [...draft.allocations, ...draft.noteAllocations],
      modes: draft.modes
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        if (!res.success) { fail(res.message || 'Save failed.'); return; }
        const voucherNo = res.data?.voucher_number || 'Voucher';
        posted.push(voucherNo);
        if (index + 1 < drafts.length) { this.postDrafts(drafts, index + 1, posted); return; }

        this.isSaving.set(false);
        this.saveMsg.set(`${posted.join(', ')} posted successfully.`);
        this.messageService.add({
          severity: 'success',
          summary: 'Posted',
          detail: drafts.length === 1
            ? `${voucherNo} for ${this.fmt(this.netAmount())} posted successfully against ${this.partyName(party)}.`
            : `${drafts.length} receipts posted successfully: ${drafts.map((d, i) => `${posted[i]} (${this.partyName(d.party)}, ${this.fmt(d.modeTotal)})`).join(', ')}.`,
          life: 4500
        });
        this.clearAllocations();
        // Re-fetch cheque lists so the leaf just used is no longer offered.
        this.bankDetailsRequested.clear();
        this.bankDetailsByBankId.set({});
        this.modeRows.update(rows => rows.map(r =>
          r.details.bankSubType === 'CHEQUE' ? { ...r, details: { ...r.details, refNumber: '' } } : r));
        this.modeRows().forEach(r => this.loadBankDetails(r.details.bankId));
        this.narration.set('');
        this.loadVouchers();
        if (this.hasParty()) this.reloadSelectedParties();
      },
      error: err => fail(err?.error?.message || 'Server error. Check connection and try again.')
    });
  }
}
