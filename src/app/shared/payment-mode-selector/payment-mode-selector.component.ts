import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, computed, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { DatePickerModule } from 'primeng/datepicker';

// ── Item 19: "same to same" mode-of-payment UI as OneSphere-Accounts'
// General Receipt screen ──────────────────────────────────────────────────
// Source of truth this was cloned from (UX only, not code):
//   OneSphere-Accounts/src/app/features/accounts/Accounts_Transactions/
//   general-receipt-new/general-receipt-new.ts + .html
//   -- Paymenttype() / Banktype() / typeofPaymentChange(), the
//      bankshowhide/chequeshowhide/onlineshowhide/debitShowhide/
//      creditShowhide/showupi signals, and the Bankbuttondata /
//      Paymentbuttondata button arrays.
//
// This is a clean re-implementation of that UI/UX, not a copy of
// GeneralReceiptNew's reactive-form internals: no dependency on
// CommonService/AccountsTransactions/InventoryConfigService or either
// app's own directives, so the exact same file can be dropped into both
// OneSphere-Accounts/src/app/shared and OneSphere-Inventory/src/app/shared
// (same duplication precedent as shared/login and shared/main-layout) and
// wired into any screen via plain @Input/@Output.
//
// Two intentional departures from a byte-for-byte parity read of
// GeneralReceiptNew, both because they need data neither app currently
// exposes here -- flagged in the item 19 report, not silently invented:
//   1. "Bank Name" (Cheque/Online) and "Deposited Bank Name" render as an
//      ng-select ONLY when the caller supplies a `banks`/`depositBanks`
//      list; with none supplied (Inventory today has no bank-master API)
//      they fall back to a free-text input in the same label/position.
//   2. "Type Of Payment" (Online) defaults to a static NEFT/RTGS/IMPS/UPI
//      list instead of Accounts' DB-driven `modeoftransactionslist`,
//      overridable via `onlinePaymentTypes`.
//
// Also verified against the LIVE General Receipt screen (not just the
// code) that:
//   - The top toggle only ever renders Cash/Bank -- `Paymentbuttondata`
//     lists a third "Wallet" entry and there's a whole walletshowhide()
//     section wired up in the .ts/.html, but no radio button anywhere
//     reaches it (`pmodofreceipt` only has CASH/BANK values in the
//     template). Treated as unreachable/dead code in Accounts and NOT
//     replicated here.
//   - Cheque has no "Deposited Bank Name" field (only Online/Debit
//     Card/Credit Card do).
//   - "UPI" is a single dropdown/selection field (bound to pUpiname),
//     not two separate "UPI Name" + "UPI ID" fields -- the `pUpiid`
//     control exists on the form but nothing in the template ever
//     writes to it.

export type PaymentTopMode = 'CASH' | 'BANK';
export type PaymentBankSubType = 'CHEQUE' | 'ONLINE' | 'DEBIT_CARD' | 'CREDIT_CARD';

// Item 20: flat per-transaction cap on a single Cash-mode payment/receipt --
// distinct from the pre-existing Section 269ST *daily aggregate per contact*
// check in Accounts' General Receipt screen (general-receipt-new.ts,
// CASH_TRANSACTION_LIMIT = 199999 / GetCashRestrictAmountpercontact), which
// this does NOT replace or touch. Mirrored server-side in
// inventory.sp_save_payment_voucher (migration 148) since this component's
// own validation is only ever a UX convenience -- the save endpoints are
// unauthenticated in this codebase, so the real gate lives in the DB.
export const CASH_MODE_LIMIT = 20000;

export interface PaymentModeOption {
  id: any;
  label: string;
  branchName?: string;
  accountNumber?: string;
  /** Only used for the "Deposited Bank Name" list -- shows the Bank Book / Pass Book pills when present. */
  bankBookBalance?: number;
  passbookBalance?: number;
  /** Only used for the "Cheque No." list -- the cheque book the leaf belongs to. */
  bookId?: any;
  /** Bank lists only -- accounts.tbl_mst_bank_configuration.isprimary. The
   *  primary bank is auto-selected when the Bank tab is opened. */
  isPrimary?: boolean;
}

export interface PaymentModeSelectorValue {
  mode: PaymentTopMode;
  bankSubType: PaymentBankSubType | null;
  bankId: any | null;
  bankName: string;
  branchName: string;
  accountNumber: string;
  /** Cheque No. (Cheque) / Reference No. (Online, Debit Card, Credit Card). */
  refNumber: string;
  /** Cheque only: the cheque book `refNumber` was picked from, when it came from
   *  a configured cheque book rather than being typed in free-hand. */
  chequeBookId: any | null;
  /** Cheque Date (Cheque) / Transaction Date (Online) -- ISO yyyy-MM-dd. */
  refDate: string | null;
  cardNumber: string;
  /** "Bank / Financial Services" -- Debit Card (optional) / Credit Card (required). */
  bankFinancialServices: string;
  /** Online sub-type, e.g. NEFT / RTGS / IMPS / UPI. */
  typeOfPayment: string | null;
  upiId: string;
  depositBankId: any | null;
  depositBankName: string;
  /** Short storage key for the caller's own mode_key column/field. 'cash' is
   *  used verbatim by Inventory's ledger-posting logic to route to CASH ON
   *  HAND vs BANK -- keep it lowercase 'cash' if wiring this into that flow. */
  modeKey: string;
  /** Human-readable one-line summary, for read-only/list contexts. */
  summary: string;
  isValid: boolean;
}

export function defaultPaymentModeValue(): PaymentModeSelectorValue {
  return {
    mode: 'CASH',
    bankSubType: null,
    bankId: null,
    bankName: '',
    branchName: '',
    accountNumber: '',
    refNumber: '',
    chequeBookId: null,
    refDate: null,
    cardNumber: '',
    bankFinancialServices: '',
    typeOfPayment: null,
    upiId: '',
    depositBankId: null,
    depositBankName: '',
    modeKey: 'cash',
    summary: 'Cash',
    isValid: true
  };
}

const DEFAULT_ONLINE_TYPES: PaymentModeOption[] = [
  { id: 'NEFT', label: 'NEFT' },
  { id: 'RTGS', label: 'RTGS' },
  { id: 'IMPS', label: 'IMPS' },
  { id: 'UPI', label: 'UPI' }
];

const BANK_SUB_TYPES: { key: PaymentBankSubType; label: string }[] = [
  { key: 'CHEQUE', label: 'Cheque' },
  { key: 'ONLINE', label: 'Online' },
  { key: 'DEBIT_CARD', label: 'Debit Card' },
  { key: 'CREDIT_CARD', label: 'Credit Card' }
];

let instanceSeq = 0;

@Component({
  selector: 'app-payment-mode-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule, DatePickerModule],
  templateUrl: './payment-mode-selector.component.html',
  styleUrl: './payment-mode-selector.component.scss'
})
export class PaymentModeSelectorComponent {
  @Input() label = 'Payment'; // renders "Mode Of Payment" / "Mode Of Receipt"
  @Input() banks: PaymentModeOption[] = [];
  @Input() depositBanks: PaymentModeOption[] = [];
  /** Un-used cheque leaves of the selected bank's cheque book (Accounts >
   *  Config > Cheque Management). Supplied => "Cheque No." becomes a dropdown
   *  of those numbers; empty => it stays the free-text input it always was. */
  @Input() chequeNumbers: PaymentModeOption[] = [];
  /** Receipts only. On money coming IN the cheque is drawn on the CUSTOMER's
   *  bank, so "Bank Name" is free text — but our books still need to know which
   *  of our accounts it is banked into, which is what decides whether it reaches
   *  the Bank Book or waits in Cheque on Hand. Payments don't need it: the bank
   *  the cheque is drawn on is already ours. */
  @Input() depositBankOnCheque = false;
  @Input() onlinePaymentTypes: PaymentModeOption[] = DEFAULT_ONLINE_TYPES;
  @Input() upiOptions: PaymentModeOption[] = [];
  @Input() cashBalanceLabel = '';
  @Input() bankBalanceLabel = '';
  @Input() disabled = false;

  @Input()
  set cashLimit(v: number | null | undefined) {
    const n = Number(v);
    this.cashLimitValue.set(Number.isFinite(n) && n > 0 ? n : CASH_MODE_LIMIT);
  }
  get cashLimit(): number { return this.cashLimitValue(); }

  /** Item 20: the amount entered for this mode row, supplied by the host
   *  screen (this component has no amount field of its own -- amount is a
   *  sibling input per row, e.g. payment-receipt-voucher's `ModeRow.amount`).
   *  Only used to enforce the ₹20,000 Cash cap; ignored entirely for Bank. */
  @Input()
  set amount(v: number | null | undefined) {
    this.amountValue.set(typeof v === 'number' && !isNaN(v) ? v : 0);
  }

  @Input()
  set value(v: Partial<PaymentModeSelectorValue> | null | undefined) {
    if (!v) return;
    this.mode.set(v.mode ?? 'CASH');
    this.bankSubType.set(v.bankSubType ?? null);
    this.bankId.set(v.bankId ?? null);
    this.bankName.set(v.bankName ?? '');
    this.branchName.set(v.branchName ?? '');
    this.accountNumber.set(v.accountNumber ?? '');
    this.refNumber.set(v.refNumber ?? '');
    this.chequeBookId.set(v.chequeBookId ?? null);
    this.refDate.set(v.refDate ?? null);
    this.cardNumber.set(v.cardNumber ?? '');
    this.bankFinancialServices.set(v.bankFinancialServices ?? '');
    this.typeOfPayment.set(v.typeOfPayment ?? null);
    this.upiId.set(v.upiId ?? '');
    this.depositBankId.set(v.depositBankId ?? null);
    this.depositBankName.set(v.depositBankName ?? '');
  }

  @Output() valueChange = new EventEmitter<PaymentModeSelectorValue>();

  readonly instanceId = `pms-${++instanceSeq}`;
  readonly bankSubTypes = BANK_SUB_TYPES;

  readonly mode = signal<PaymentTopMode>('CASH');
  readonly bankSubType = signal<PaymentBankSubType | null>(null);
  readonly bankId = signal<any | null>(null);
  readonly bankName = signal('');
  readonly branchName = signal('');
  readonly accountNumber = signal('');
  readonly refNumber = signal('');
  readonly chequeBookId = signal<any | null>(null);
  readonly refDate = signal<string | null>(null);
  readonly cardNumber = signal('');
  readonly bankFinancialServices = signal('');
  readonly typeOfPayment = signal<string | null>(null);
  readonly upiId = signal('');
  readonly depositBankId = signal<any | null>(null);
  readonly depositBankName = signal('');
  readonly amountValue = signal<number>(0);
  readonly cashLimitValue = signal<number>(CASH_MODE_LIMIT);

  private readonly touchedFields = signal<ReadonlySet<string>>(new Set());
  private readonly forceShowErrors = signal(false);

  readonly showUpi = computed(() => this.bankSubType() === 'ONLINE' && (this.typeOfPayment() || '').toUpperCase() === 'UPI');
  // Previous date-only parsing used `new Date('YYYY-MM-DD')`, which parses as
  // UTC and can display the previous day in local time:
  // readonly refDateObj = computed(() => (this.refDate() ? new Date(this.refDate()!) : null));
  readonly refDateObj = computed(() => {
    const value = this.refDate();
    if (!value) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return new Date(value);

    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(year, month, day);
    return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day
      ? date
      : null;
  });
  readonly selectedDepositBank = computed(() => this.depositBanks.find(b => this.sameId(b.id, this.depositBankId())) ?? null);
  readonly chequeNoLabel = computed(() => (this.bankSubType() === 'CHEQUE' ? 'Cheque No.' : 'Reference No.'));

  get onlinePaymentTypeOptions(): PaymentModeOption[] {
    return this.onlinePaymentTypes?.length ? this.onlinePaymentTypes : DEFAULT_ONLINE_TYPES;
  }

  constructor() {
    // Auto-emits the current value whenever any tracked signal changes --
    // including on the initial application of the `value` input, which is
    // harmless/idempotent (parent already has that value; signals only
    // notify on an actual change so this settles after one round-trip).
    effect(() => this.valueChange.emit(this.buildValue()));
  }

  // ── Mode / sub-type switching ─────────────────────────────────────────
  setTopMode(next: PaymentTopMode): void {
    if (this.disabled || this.mode() === next) return;
    this.mode.set(next);
    this.resetBankFields();
    this.bankSubType.set(next === 'BANK' ? 'CHEQUE' : null);
    if (next === 'BANK') this.applyDefaultBanks();
  }

  setBankSubType(next: PaymentBankSubType): void {
    if (this.disabled || this.bankSubType() === next) return;
    this.resetBankFields();
    this.bankSubType.set(next);
    this.applyDefaultBanks();
  }

  /** Pre-selects the bank account configured in Accounts (Config > Bank
   *  Configuration) so its name/branch/account number are already filled in:
   *  the one flagged primary, or the only one there is. With several
   *  non-primary accounts nothing is guessed -- the user picks. */
  private applyDefaultBanks(): void {
    const pick = (options: PaymentModeOption[]): PaymentModeOption | null =>
      options.find(o => o.isPrimary) ?? (options.length === 1 ? options[0] : null);

    const bank = pick(this.banks);
    if (bank) this.setBankId(bank.id);

    const depositBank = pick(this.depositBanks);
    if (depositBank) this.setDepositBankId(depositBank.id);
  }

  private resetBankFields(): void {
    this.bankId.set(null);
    this.bankName.set('');
    this.branchName.set('');
    this.accountNumber.set('');
    this.refNumber.set('');
    this.chequeBookId.set(null);
    this.refDate.set(null);
    this.cardNumber.set('');
    this.bankFinancialServices.set('');
    this.typeOfPayment.set(null);
    this.upiId.set('');
    this.depositBankId.set(null);
    this.depositBankName.set('');
    this.touchedFields.set(new Set());
    this.forceShowErrors.set(false);
  }

  // ── Field setters ──────────────────────────────────────────────────────
  setBankId(id: any): void {
    const selectedId = this.valueId(id);
    const bank = this.findOption(this.banks, selectedId) ?? this.asPaymentOption(id);
    this.bankId.set(selectedId);
    this.bankName.set(bank?.label ?? '');
    if (bank?.branchName !== undefined) this.branchName.set(String(bank.branchName || '').slice(0, 30));
    if (bank?.accountNumber !== undefined) this.accountNumber.set(this.digitsOnly(String(bank.accountNumber)).slice(0, 20));
    // The cheque book belongs to the bank account, so a leaf picked for the
    // previous bank no longer applies. Only Cheque is affected -- a Reference
    // No. on the other tabs isn't drawn from the bank's book.
    if (this.bankSubType() === 'CHEQUE') {
      this.refNumber.set('');
      this.chequeBookId.set(null);
    }
  }
  setBankNameFree(v: string): void {
    this.bankId.set(null);
    this.bankName.set(v || '');
  }
  setBranchName(v: string): void { this.branchName.set(this.lettersOnly(v).slice(0, 30)); }
  setAccountNumber(v: string): void { this.accountNumber.set(this.digitsOnly(v).slice(0, 20)); }
  setRefNumber(v: string): void {
    const max = this.bankSubType() === 'CHEQUE' ? 6 : 25;
    this.refNumber.set(this.digitsOnly(v).slice(0, max));
    this.chequeBookId.set(null);
  }
  /** Cheque No. picked from the configured cheque book -- keeps the book id
   *  alongside the number so the saved voucher records which book it came from. */
  setChequeNumber(v: any): void {
    const selectedId = this.valueId(v);
    const leaf = this.findOption(this.chequeNumbers, selectedId) ?? this.asPaymentOption(v);
    this.refNumber.set(selectedId === null || selectedId === undefined ? '' : String(leaf?.label ?? selectedId));
    this.chequeBookId.set(leaf?.bookId ?? null);
  }
  setRefDate(d: Date | string | null): void { this.refDate.set(d ? this.toIsoDate(d) : null); }
  setCardNumber(v: string): void { this.cardNumber.set(this.digitsOnly(v).slice(0, 16)); }
  setBankFinancialServices(v: string): void {
    const max = this.bankSubType() === 'CREDIT_CARD' ? 40 : 25;
    this.bankFinancialServices.set(this.lettersOnly(v).slice(0, max));
  }
  setTypeOfPayment(v: any): void {
    const selectedId = this.valueId(v);
    const type = this.findOption(this.onlinePaymentTypeOptions, selectedId) ?? this.asPaymentOption(v);
    this.typeOfPayment.set(type?.label ?? (selectedId === null || selectedId === undefined ? null : String(selectedId)));
    this.upiId.set('');
  }
  setUpiId(v: any): void {
    const selectedId = this.valueId(v);
    const upi = this.findOption(this.upiOptions, selectedId) ?? this.asPaymentOption(v);
    this.upiId.set(upi?.label ?? (selectedId === null || selectedId === undefined ? '' : String(selectedId)));
  }
  setDepositBankId(id: any): void {
    const selectedId = this.valueId(id);
    const bank = this.findOption(this.depositBanks, selectedId) ?? this.asPaymentOption(id);
    this.depositBankId.set(selectedId);
    this.depositBankName.set(bank?.label ?? '');
  }
  setDepositBankNameFree(v: string): void {
    this.depositBankId.set(null);
    this.depositBankName.set(v || '');
  }

  // ── Touched / validation display ──────────────────────────────────────
  touch(field: string): void {
    if (this.touchedFields().has(field)) return;
    this.touchedFields.set(new Set([...this.touchedFields(), field]));
  }
  private showFieldError(field: string): boolean {
    return this.forceShowErrors() || this.touchedFields().has(field);
  }
  /** Public API for the host screen: reveal every required-field error at once (e.g. on a blocked Save). */
  markAllTouched(): void { this.forceShowErrors.set(true); }

  get bankNameError(): string {
    if (!this.showFieldError('bankName')) return '';
    return this.bankId() || this.bankName().trim() ? '' : 'Please Select Bank Name';
  }
  get branchNameError(): string {
    if (!this.showFieldError('branchName')) return '';
    return this.branchName().trim() ? '' : 'Please Enter Branch Name';
  }
  get accountNumberError(): string {
    if (!this.showFieldError('accountNumber')) return '';
    const v = this.accountNumber().trim();
    if (!v) return '';
    if (v.length < 6 || v.length > 20) return 'Account Number Must Be Between 6 And 20 Digits';
    return '';
  }
  get refNumberError(): string {
    if (!this.showFieldError('refNumber')) return '';
    return this.refNumber().trim() ? '' : `${this.chequeNoLabel().replace('.', '')} Is Required`;
  }
  get refDateError(): string {
    if (!this.showFieldError('refDate')) return '';
    return this.refDate() ? '' : 'Please Select Date';
  }
  get typeOfPaymentError(): string {
    if (!this.showFieldError('typeOfPayment')) return '';
    return this.typeOfPayment() ? '' : 'Please Select Type Of Payment';
  }
  get upiIdError(): string {
    if (!this.showFieldError('upiId')) return '';
    return this.upiId().trim() ? '' : 'Please Select UPI';
  }
  get cardNumberError(): string {
    if (!this.showFieldError('cardNumber')) return '';
    const v = this.cardNumber().trim();
    if (!v) return 'Card Number Is Required';
    if (v.length !== 16) return 'Card Number Must Be 16 Digits';
    return '';
  }
  get bankFinancialServicesError(): string {
    if (this.bankSubType() !== 'CREDIT_CARD' || !this.showFieldError('bankFinancialServices')) return '';
    return this.bankFinancialServices().trim() ? '' : 'Bank / Financial Services Is Required';
  }
  get depositBankError(): string {
    if (!this.showFieldError('depositBankName')) return '';
    return this.depositBankId() || this.depositBankName().trim() ? '' : 'Please Select Deposited Bank Name';
  }

  /** Item 20: shown unconditionally (not gated by touch/markAllTouched) --
   *  a cap violation isn't a "fill this in" field error, it's a hard block
   *  the user should see the instant the amount goes over, same as it
   *  reflects immediately in `isValid`. */
  get cashLimitError(): string {
    if (this.mode() !== 'CASH') return '';
    const limit = this.cashLimitValue();
    return this.amountValue() > limit
      ? `Cash ${this.label.toLowerCase()} cannot exceed Rs ${limit.toLocaleString('en-IN')} per transaction.`
      : '';
  }

  // ── Input guards ────────────────────────────────────────────────────────
  blockNonDigitKey(e: KeyboardEvent): void {
    const allowed = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (allowed.includes(e.key) || (e.ctrlKey || e.metaKey)) return;
    if (!/^[0-9]$/.test(e.key)) e.preventDefault();
  }
  blockNonLetterKey(e: KeyboardEvent): void {
    const allowed = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End', ' '];
    if (allowed.includes(e.key) || (e.ctrlKey || e.metaKey)) return;
    if (!/^[a-zA-Z]$/.test(e.key)) e.preventDefault();
  }

  // ── Value assembly ──────────────────────────────────────────────────────
  private computeValid(mode: PaymentTopMode, sub: PaymentBankSubType | null): boolean {
    if (mode === 'CASH') return this.amountValue() <= this.cashLimitValue();
    if (!sub) return false;
    const hasBankName = !!(this.bankId() || this.bankName().trim());
    const hasDepositBank = !!(this.depositBankId() || this.depositBankName().trim());
    const acct = this.accountNumber().trim();
    switch (sub) {
      case 'CHEQUE':
        return hasBankName
          && !!this.branchName().trim()
          && (!acct || (acct.length >= 6 && acct.length <= 20))
          && this.refNumber().trim().length > 0
          && !!this.refDate();
      case 'ONLINE': {
        const upiOk = this.showUpi() ? !!this.upiId().trim() : true;
        return hasBankName
          && !!this.typeOfPayment()
          && this.refNumber().trim().length > 0
          && !!this.refDate()
          && hasDepositBank
          && upiOk;
      }
      case 'DEBIT_CARD':
        return this.cardNumber().trim().length === 16
          && this.refNumber().trim().length > 0
          && hasDepositBank;
      case 'CREDIT_CARD':
        return this.cardNumber().trim().length === 16
          && !!this.bankFinancialServices().trim()
          && this.refNumber().trim().length > 0
          && hasDepositBank;
    }
  }

  private buildSummary(mode: PaymentTopMode, sub: PaymentBankSubType | null): string {
    if (mode === 'CASH') return 'Cash';
    if (!sub) return 'Bank';
    const bankLabel = this.bankName() || '—';
    switch (sub) {
      case 'CHEQUE': return `Cheque #${this.refNumber() || '—'} · ${bankLabel}`;
      case 'ONLINE': return `Online (${this.typeOfPayment() || '—'}) · Ref ${this.refNumber() || '—'}`;
      case 'DEBIT_CARD': return `Debit Card ****${this.cardNumber().slice(-4) || '----'}`;
      case 'CREDIT_CARD': return `Credit Card ****${this.cardNumber().slice(-4) || '----'} · ${this.bankFinancialServices() || '—'}`;
    }
  }

  private buildValue(): PaymentModeSelectorValue {
    const mode = this.mode();
    const bankSubType = mode === 'BANK' ? this.bankSubType() : null;
    const modeKey = mode === 'CASH'
      ? 'cash'
      : bankSubType === 'CHEQUE' ? 'cheque'
        : bankSubType === 'ONLINE' ? 'online'
          : bankSubType === 'DEBIT_CARD' ? 'debit_card'
            : bankSubType === 'CREDIT_CARD' ? 'credit_card'
              : 'bank';

    return {
      mode,
      bankSubType,
      bankId: this.bankId(),
      bankName: this.bankName(),
      branchName: this.branchName(),
      accountNumber: this.accountNumber(),
      refNumber: this.refNumber(),
      chequeBookId: bankSubType === 'CHEQUE' ? this.chequeBookId() : null,
      refDate: this.refDate(),
      cardNumber: this.cardNumber(),
      bankFinancialServices: this.bankFinancialServices(),
      typeOfPayment: this.typeOfPayment(),
      upiId: this.upiId(),
      depositBankId: this.depositBankId(),
      depositBankName: this.depositBankName(),
      modeKey,
      summary: this.buildSummary(mode, bankSubType),
      isValid: this.computeValid(mode, bankSubType)
    };
  }

  private digitsOnly(v: string): string { return (v || '').replace(/\D/g, ''); }
  private lettersOnly(v: string): string { return (v || '').replace(/[^a-zA-Z\s]/g, ''); }
  private sameId(a: any, b: any): boolean {
    return String(a ?? '') === String(b ?? '');
  }
  private valueId(v: any): any | null {
    if (v === null || v === undefined || v === '') return null;
    return typeof v === 'object'
      ? (v.id ?? v.pbankid ?? v.pBankId ?? v.pbankId ?? v.pdepositbankid ?? v.pDepositbankid ?? null)
      : v;
  }
  private findOption(options: PaymentModeOption[], id: any): PaymentModeOption | null {
    if (id === null || id === undefined) return null;
    return options.find(o => this.sameId(o.id, id)) ?? null;
  }
  private asPaymentOption(v: any): PaymentModeOption | null {
    if (!v || typeof v !== 'object') return null;
    const id = this.valueId(v);
    const label = v.label ?? v.pbankname ?? v.pBankName ?? v.pdepositbankname ?? v.pDepositbankname ?? v.ptypeofpayment ?? v.pTypeofpayment;
    return label ? {
      id,
      label,
      branchName: v.branchName ?? v.pbranchname ?? v.pBranchName,
      accountNumber: v.accountNumber ?? v.pbankaccountnumber ?? v.pBankaccountnumber
    } : null;
  }
  private toIsoDate(d: Date | string): string {
    // Previous conversion used UTC, which could serialize a local picker date
    // as the previous calendar day:
    // const date = typeof d === 'string' ? new Date(d) : d;
    // if (isNaN(date.getTime())) return '';
    // return date.toISOString().slice(0, 10);
    if (typeof d === 'string') {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
      if (match) {
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const date = new Date(year, month - 1, day);
        return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
          ? `${match[1]}-${match[2]}-${match[3]}`
          : '';
      }
    }

    const date = typeof d === 'string' ? new Date(d) : d;
    if (isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
