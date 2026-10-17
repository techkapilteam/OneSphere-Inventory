import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { ApiResponse } from './inventory-config.service';
import { currentAccessToken } from './inventory-auth-token.util';

export interface OutstandingInvoice {
  invoice_type: 'purchase_invoice' | 'sales_invoice';
  invoice_id: number;
  invoice_number: string;
  invoice_date?: string;
  due_date?: string;
  reference?: string;
  subtotal_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  outstanding: number;
  // Item 21: true when any line item on this invoice resolves to a
  // Service-natured product (inv_product_types.is_service) — the frontend
  // gates TDS visibility on this instead of guessing from the invoice as a whole.
  has_service_item: boolean;
}

// Item 21: taxation.tds_codes, read-only — replaces the previously
// hardcoded TDS_SECTIONS list in payment-receipt-voucher.ts as the source
// of truth for section/rate.
export interface TdsCode {
  id: number;
  section_code: string;
  description?: string;
  rate: number;
  deductee_type?: string;
  threshold_amount?: number;
}

// Item 22: vendor-level (not per-invoice) FY-cumulative-purchases check —
// TCS only ever becomes relevant once this crosses the ₹50L threshold.
export interface VendorFyPurchaseSummary {
  vendor_id: number;
  financial_year: string;
  cumulative_purchase_amount: number;
  threshold_amount: number;
  threshold_crossed: boolean;
}

export interface PaymentVoucherAllocation {
  invoice_type: 'purchase_invoice' | 'sales_invoice' | 'debit_note' | 'credit_note';
  invoice_id: number;
  invoice_number?: string;
  allocated_amount: number;
}

export interface AvailableNote {
  note_type: 'debit_note' | 'credit_note';
  note_id: number;
  note_number: string;
  note_date?: string;
  reason?: string;
  return_number?: string;
  total_amount: number;
  applied_amount: number;
  outstanding: number;
}

export interface PaymentVoucherMode {
  mode_key: string;
  amount: number;
  ref_json?: Record<string, string>;
}

export interface PaymentVoucherAccountOption {
  id: any;
  label: string;
  branchName?: string;
  accountNumber?: string;
  bankBookBalance?: number;
  passbookBalance?: number;
  /** Cheque options only: accounts.tbl_mst_cheque_management.cheque_book_id the leaf belongs to. */
  bookId?: any;
  /** Bank options only: accounts.tbl_mst_bank_configuration.isprimary — used to pre-select a default bank. */
  isPrimary?: boolean;
}

export interface PaymentVoucherAccountSetup {
  banks: PaymentVoucherAccountOption[];
  depositBanks: PaymentVoucherAccountOption[];
  onlinePaymentTypes: PaymentVoucherAccountOption[];
}

/** Per-bank master detail behind a selected bank account — the un-used cheque
 *  leaves of its cheque book(s) (Accounts > Config > Cheque Management) and its
 *  configured UPI handles. Same source the Accounts screens read. */
export interface PaymentVoucherBankDetails {
  chequeNumbers: PaymentVoucherAccountOption[];
  upiNames: PaymentVoucherAccountOption[];
}

/** Bank block printed at the foot of a Sales Invoice. */
export interface InvoiceBankDetails {
  bankName: string;
  branchName: string;
  accountNo: string;
  ifscCode: string;
}

export interface PaymentVoucher {
  id: number;
  voucher_number: string;
  voucher_type: 'payment' | 'receipt';
  voucher_date?: string;
  segment_id?: number;
  segment_name?: string;
  party_type: 'vendor' | 'customer';
  party_id?: number;
  party_name?: string;
  party_gstin?: string;
  total_allocated: number;
  tds_amount: number;
  tcs_amount: number;
  tcs_percentage?: number;
  net_amount: number;
  narration?: string;
  status: string;
  created_at?: string;
  allocations: PaymentVoucherAllocation[];
  modes: PaymentVoucherMode[];
}

@Injectable({ providedIn: 'root' })
export class PaymentsService {
  private readonly http = inject(HttpClient);

  private base(): string { return sessionStorage.getItem('apiURL') || ''; }
  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${currentAccessToken()}` });
  }
  private url(path: string): string { return `${this.base()}/inventory/payments/${path}`; }
  private accountsUrl(path: string): string { return `${this.base()}/Accounts/${path}`; }

  private accountsParams(): HttpParams {
    return new HttpParams()
      .set('BranchSchema', sessionStorage.getItem('accountsSchema') || sessionStorage.getItem('AccountsSchema') || 'accounts')
      .set('GlobalSchema', sessionStorage.getItem('globalSchema') || sessionStorage.getItem('GlobalSchema') || 'global')
      .set('CompanyCode', sessionStorage.getItem('companyCode') || '')
      .set('BranchCode', sessionStorage.getItem('branchCode') || '');
  }

  private readAny(r: any, keys: string[]): any {
    for (const key of keys) {
      if (r?.[key] !== undefined && r?.[key] !== null) return r[key];
    }
    return undefined;
  }

  private readString(r: any, keys: string[]): string {
    const value = this.readAny(r, keys);
    return value === undefined || value === null ? '' : String(value).trim();
  }

  private readNumber(r: any, keys: string[]): number | undefined {
    const value = this.readAny(r, keys);
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }

  private normBankOption(r: any): PaymentVoucherAccountOption | null {
    const id = this.readAny(r, ['id', 'pbankid', 'pbankId', 'pBankId', 'pdepositbankid', 'pdepositbankId', 'pDepositbankid']);
    const label = this.readString(r, ['label', 'pbankname', 'pbankName', 'pBankName', 'pdepositbankname', 'pDepositbankname']);
    if (id === undefined || id === null || !label) return null;
    return {
      id,
      label,
      branchName: this.readString(r, ['branchName', 'pbranchname', 'pBranchName']) || undefined,
      accountNumber: this.readString(r, ['accountNumber', 'pbankaccountnumber', 'pBankaccountnumber']) || undefined,
      bankBookBalance: this.readNumber(r, ['bankBookBalance', 'pbankbalance', 'pBankBalance']),
      passbookBalance: this.readNumber(r, ['passbookBalance', 'pbankpassbookbalance', 'pBankPassbookBalance']),
      isPrimary: this.readAny(r, ['isPrimary', 'pisprimary', 'pIsprimary']) === true
    };
  }

  private normChequeOptions(rows: any): PaymentVoucherAccountOption[] {
    const source = Array.isArray(rows) ? rows : [];
    const result: PaymentVoucherAccountOption[] = [];
    for (const row of source) {
      const number = this.readString(row, ['chequeNumber', 'pChequenumber', 'pchequenumber']);
      if (!number || number === '0') continue;
      result.push({ id: number, label: number, bookId: this.readAny(row, ['chequeBookId', 'pChqbookid', 'pchqbookid']) });
    }
    return result;
  }

  private normUpiOptions(rows: any): PaymentVoucherAccountOption[] {
    const source = Array.isArray(rows) ? rows : [];
    const byLabel = new Map<string, PaymentVoucherAccountOption>();
    for (const row of source) {
      const name = this.readString(row, ['upiName', 'pUpiname', 'pupiname']);
      if (!name) continue;
      const key = name.toUpperCase();
      if (!byLabel.has(key)) byLabel.set(key, { id: name, label: name });
    }
    return [...byLabel.values()];
  }

  private normBankOptions(rows: any): PaymentVoucherAccountOption[] {
    const source = Array.isArray(rows) ? rows : [];
    const result: PaymentVoucherAccountOption[] = [];
    for (const row of source) {
      const option = this.normBankOption(row);
      if (option) result.push(option);
    }
    return result;
  }

  private normOnlinePaymentTypes(rows: any): PaymentVoucherAccountOption[] {
    const source = Array.isArray(rows) ? rows : [];
    const byLabel = new Map<string, PaymentVoucherAccountOption>();
    for (const row of source) {
      const transType = this.readString(row, ['ptranstype', 'pTransType', 'transType']);
      const subType = this.readString(row, ['ptypeofpayment', 'pTypeofpayment', 'pTypeOfPayment', 'subTypeOfReceiptspayments']);
      if (!subType || (transType && transType.toUpperCase() === subType.toUpperCase())) continue;
      const key = subType.toUpperCase();
      if (!byLabel.has(key)) byLabel.set(key, { id: subType, label: subType });
    }
    return [...byLabel.values()];
  }

  private normOutstanding(r: any): OutstandingInvoice {
    return {
      invoice_type: r?.invoiceType ?? r?.invoice_type,
      invoice_id: r?.invoiceId ?? r?.invoice_id,
      invoice_number: r?.invoiceNumber ?? r?.invoice_number ?? '',
      invoice_date: r?.invoiceDate ?? r?.invoice_date,
      due_date: r?.dueDate ?? r?.due_date,
      reference: r?.reference,
      subtotal_amount: r?.subtotalAmount ?? r?.subtotal_amount ?? 0,
      tax_amount: r?.taxAmount ?? r?.tax_amount ?? 0,
      total_amount: r?.totalAmount ?? r?.total_amount ?? 0,
      paid_amount: r?.paidAmount ?? r?.paid_amount ?? 0,
      outstanding: r?.outstanding ?? 0,
      has_service_item: !!(r?.hasServiceItem ?? r?.has_service_item)
    };
  }

  private normTdsCode(r: any): TdsCode {
    return {
      id: r?.id,
      section_code: r?.sectionCode ?? r?.section_code ?? '',
      description: r?.description,
      rate: Number(r?.rate ?? 0),
      deductee_type: r?.deducteeType ?? r?.deductee_type,
      threshold_amount: r?.thresholdAmount ?? r?.threshold_amount
    };
  }

  private normNote(r: any): AvailableNote {
    return {
      note_type: r?.noteType ?? r?.note_type,
      note_id: r?.noteId ?? r?.note_id,
      note_number: r?.noteNumber ?? r?.note_number ?? '',
      note_date: r?.noteDate ?? r?.note_date,
      reason: r?.reason,
      return_number: r?.returnNumber ?? r?.return_number,
      total_amount: r?.totalAmount ?? r?.total_amount ?? 0,
      applied_amount: r?.appliedAmount ?? r?.applied_amount ?? 0,
      outstanding: r?.outstanding ?? 0
    };
  }

  private normVoucher(r: any): PaymentVoucher {
    return {
      id: r?.id,
      voucher_number: r?.voucherNumber ?? r?.voucher_number ?? '',
      voucher_type: r?.voucherType ?? r?.voucher_type,
      voucher_date: r?.voucherDate ?? r?.voucher_date,
      segment_id: r?.segmentId ?? r?.segment_id,
      segment_name: r?.segmentName ?? r?.segment_name,
      party_type: r?.partyType ?? r?.party_type,
      party_id: r?.partyId ?? r?.party_id,
      party_name: r?.partyName ?? r?.party_name,
      party_gstin: r?.partyGstin ?? r?.party_gstin,
      total_allocated: r?.totalAllocated ?? r?.total_allocated ?? 0,
      tds_amount: r?.tdsAmount ?? r?.tds_amount ?? 0,
      tcs_amount: r?.tcsAmount ?? r?.tcs_amount ?? 0,
      tcs_percentage: r?.tcsPercentage ?? r?.tcs_percentage,
      net_amount: r?.netAmount ?? r?.net_amount ?? 0,
      narration: r?.narration,
      status: r?.status || 'posted',
      created_at: r?.createdAt ?? r?.created_at,
      allocations: (r?.allocations || []).map((a: any) => ({
        invoice_type: a?.invoiceType ?? a?.invoice_type,
        invoice_id: a?.invoiceId ?? a?.invoice_id,
        invoice_number: a?.invoiceNumber ?? a?.invoice_number,
        allocated_amount: a?.allocatedAmount ?? a?.allocated_amount ?? 0
      })),
      modes: (r?.modes || []).map((m: any) => ({
        mode_key: m?.modeKey ?? m?.mode_key,
        amount: m?.amount ?? 0,
        ref_json: m?.refJson ?? m?.ref_json ?? {}
      }))
    };
  }

  getOutstandingInvoices(partyType: 'vendor' | 'customer', partyId: number): Observable<ApiResponse<OutstandingInvoice[]>> {
    const params = new HttpParams().set('partyType', partyType).set('partyId', String(partyId));
    return this.http.get<ApiResponse<any[]>>(this.url('outstanding-invoices'), { headers: this.headers(), params }).pipe(
      map(res => ({ ...res, data: (res.data ?? []).map(r => this.normOutstanding(r)) }))
    );
  }

  getTdsCodes(): Observable<ApiResponse<TdsCode[]>> {
    return this.http.get<ApiResponse<any[]>>(this.url('tds-codes'), { headers: this.headers() }).pipe(
      map(res => ({ ...res, data: (res.data ?? []).map(r => this.normTdsCode(r)) }))
    );
  }

  getVendorFyPurchaseSummary(vendorId: number): Observable<ApiResponse<VendorFyPurchaseSummary>> {
    const params = new HttpParams().set('vendorId', String(vendorId));
    return this.http.get<ApiResponse<any>>(this.url('vendor-fy-summary'), { headers: this.headers(), params }).pipe(
      map(res => ({
        ...res,
        data: res.data ? {
          vendor_id: res.data.vendorId ?? res.data.vendor_id,
          financial_year: res.data.financialYear ?? res.data.financial_year ?? '',
          cumulative_purchase_amount: res.data.cumulativePurchaseAmount ?? res.data.cumulative_purchase_amount ?? 0,
          threshold_amount: res.data.thresholdAmount ?? res.data.threshold_amount ?? 5000000,
          threshold_crossed: !!(res.data.thresholdCrossed ?? res.data.threshold_crossed)
        } : undefined
      }))
    );
  }

  getAvailableNotes(partyType: 'vendor' | 'customer', partyId: number): Observable<ApiResponse<AvailableNote[]>> {
    const params = new HttpParams().set('partyType', partyType).set('partyId', String(partyId));
    return this.http.get<ApiResponse<any[]>>(this.url('available-notes'), { headers: this.headers(), params }).pipe(
      map(res => ({ ...res, data: (res.data ?? []).map(r => this.normNote(r)) }))
    );
  }

  getPaymentVouchers(voucherType?: 'payment' | 'receipt', segmentId?: number | null): Observable<ApiResponse<PaymentVoucher[]>> {
    let params = new HttpParams();
    if (voucherType) params = params.set('voucherType', voucherType);
    if (segmentId) params = params.set('segmentId', String(segmentId));
    return this.http.get<ApiResponse<any[]>>(this.url('vouchers'), { headers: this.headers(), params }).pipe(
      map(res => ({ ...res, data: (res.data ?? []).map(r => this.normVoucher(r)) }))
    );
  }

  getPaymentVoucherAccountSetup(): Observable<PaymentVoucherAccountSetup> {
    const params = this.accountsParams();
    return forkJoin({
      bankRes: this.http.get<any>(this.accountsUrl('GetBankntList'), { headers: this.headers(), params }).pipe(catchError(() => of({ banklist: [] }))),
      modeRes: this.http.get<any>(this.accountsUrl('GetModeoftransactions'), { headers: this.headers(), params }).pipe(catchError(() => of({ modeofTransactionslist: [] })))
    }).pipe(map(({ bankRes, modeRes }) => {
      const banks = this.normBankOptions(bankRes?.banklist ?? bankRes?.bankList ?? bankRes);
      return {
        banks,
        depositBanks: banks,
        onlinePaymentTypes: this.normOnlinePaymentTypes(modeRes?.modeofTransactionslist ?? modeRes?.modeOfTransactionsList ?? modeRes)
      };
    }));
  }

  /** Cheque-book leaves + UPI handles configured against one bank account, from
   *  the same /Accounts/GetBankDetailsbyId the Accounts screens use. Returns
   *  empty lists (never errors) when nothing is configured, so the Cheque No. /
   *  UPI fields fall back to free text. */
  getPaymentVoucherBankDetails(bankId: any): Observable<PaymentVoucherBankDetails> {
    const empty: PaymentVoucherBankDetails = { chequeNumbers: [], upiNames: [] };
    if (bankId === null || bankId === undefined || bankId === '') return of(empty);
    const params = this.accountsParams().set('pbankid', String(bankId));
    return this.http.get<any>(this.accountsUrl('GetBankDetailsbyId'), { headers: this.headers(), params }).pipe(
      map(res => ({
        chequeNumbers: this.normChequeOptions(res?.chequeslist ?? res?.chequesList),
        upiNames: this.normUpiOptions(res?.bankupilist ?? res?.bankUpiList)
      })),
      catchError(() => of(empty))
    );
  }

  /** Bank printed on the Sales Invoice: the Primary bank of Accounts > Bank
   *  Configuration (the first active one when none is primary), with bank
   *  name / branch / account no / IFSC from /Accounts/ViewBankInformation.
   *  That call needs the Bank Config view permission, so when it fails the
   *  list row's own branch / account no are used and IFSC stays blank.
   *  Emits null (never errors) when no bank is configured. */
  getInvoiceBankDetails(): Observable<InvoiceBankDetails | null> {
    const params = this.accountsParams();
    return this.http.get<any>(this.accountsUrl('GetBankntList'), { headers: this.headers(), params }).pipe(
      map(res => this.normBankOptions(res?.banklist ?? res?.bankList ?? res)),
      switchMap(banks => {
        const bank = banks.find(item => item.isPrimary) || banks[0];
        if (!bank) return of(null);
        return this.http.get<any>(this.accountsUrl('ViewBankInformation'), {
          headers: this.headers(), params: params.set('precordid', String(bank.id))
        }).pipe(
          catchError(() => of(null)),
          map(res => {
            const info = Array.isArray(res) ? res[0] : res;
            return {
              bankName: this.readString(info, ['pBankname', 'pbankname']) || bank.label,
              branchName: this.readString(info, ['pBankbranch', 'pbankbranch']) || bank.branchName || '',
              accountNo: this.readString(info, ['pAccountnumber', 'paccountnumber']) || bank.accountNumber || '',
              ifscCode: this.readString(info, ['pIfsccode', 'pifsccode'])
            };
          })
        );
      }),
      catchError(() => of(null))
    );
  }

  savePaymentVoucher(payload: {
    voucherType: 'payment' | 'receipt';
    voucherDate?: string;
    segmentId?: number | null;
    segmentName?: string;
    partyType: 'vendor' | 'customer';
    partyId: number;
    partyName?: string;
    partyGstin?: string;
    narration?: string;
    tdsAmount?: number;
    tdsSection?: string;
    tcsAmount?: number;
    tcsPercentage?: number | null;
    allocations: { invoiceType: string; invoiceId: number; invoiceNumber?: string; allocatedAmount: number }[];
    modes: { modeKey: string; amount: number; refJson?: Record<string, string> }[];
  }): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(this.url('vouchers'), payload, { headers: this.headers() }).pipe(
      map(res => ({ ...res, data: res.data ? this.normVoucher(res.data) : undefined }))
    );
  }

  cancelPaymentVoucher(voucherId: number): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(this.url('vouchers/cancel'), { voucherId }, { headers: this.headers() });
  }
}
