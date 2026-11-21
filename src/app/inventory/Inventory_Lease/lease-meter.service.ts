import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { currentAccessToken } from '../../core/host/host-bridge';

/** Envelope returned by every inventory API endpoint. */
export interface LeaseApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
}

export interface MeterDefinition {
  id?: number;
  meter_code?: string;
  meter_name: string;
  unit_name: string;
  description?: string | null;
  status?: string;
}

export interface LeaseSlab { from_qty: number | null; to_qty: number | null; slab_rate: number | null; }
export interface LeaseRate {
  effective_from: string;
  rate: number | null;
  free_qty: number | null;
  min_charge: number | null;
  slabs: LeaseSlab[];
  /** UI only: show the slab editor for this rate. */
  _slabs?: boolean;
}
export interface LeaseMeter {
  id?: number;
  meter_def_id?: number | null;
  meter_label?: string | null;
  meter_name?: string;
  unit_name?: string;
  opening_reading: number | null;
  charge_product_id: number | null;
  charge_product_name?: string;
  lease_asset_id?: number | null;
  asset_ref?: string | null;
  status?: string;
  /** Variant / attribute of the meter item (picked like a Sales Invoice line). */
  variant_id?: number | null;
  variant_name?: string | null;
  attribute_id?: number | null;
  attribute_name?: string | null;
  attribute_value?: string | null;
  rates: LeaseRate[];
}
export interface LeaseAsset {
  id: number;
  contract_id: number;
  contract_no?: string;
  product_id: number;
  product_name?: string;
  product_code?: string;
  asset_ref: string;
  customer_id: number;
  customer_name?: string;
  site_name?: string;
  handover_date: string;
  handover_condition?: string;
  return_date?: string | null;
  return_condition?: string | null;
  status: 'on_lease' | 'returned' | 'under_repair';
  /** Rent of this asset: applicable or not, rental unit (UOM) and rate. */
  rent_applicable?: boolean;
  rent_uom_id?: number | null;
  rent_unit_name?: string | null;
  rent_rate?: number | null;
}
export interface LeaseContract {
  id?: number;
  contract_no?: string;
  customer_id: number | null;
  customer_name?: string;
  customer_gstin?: string;
  site_name?: string | null;
  site_address?: string | null;
  site_state?: string | null;
  site_district?: string | null;
  site_city?: string | null;
  site_pincode?: string | null;
  contract_type: 'rent' | 'usage' | 'rent_usage';
  start_date: string;
  end_date?: string | null;
  billing_cycle: string;
  billing_mode: string;
  fixed_rent_amount: number | null;
  rent_product_id: number | null;
  rent_product_name?: string;
  segment_id?: number | null;
  status?: string;
  remarks?: string | null;
  asset_count?: number;
  meter_count?: number;
  last_billed_to?: string | null;
  meters?: LeaseMeter[];
  assets?: LeaseAsset[];
}
export interface MeterReading {
  id: number;
  lease_meter_id: number;
  meter_label?: string;
  unit_name?: string;
  contract_id?: number;
  contract_no?: string;
  customer_name?: string;
  reading_date: string;
  reading_value: number;
  previous_value?: number | null;
  baseline_value?: number | null;
  usage_qty?: number | null;
  reading_type: string;
  status: 'draft' | 'verified' | 'billed' | 'void';
  remarks?: string | null;
}
export interface BillingLine {
  line_type: 'rent' | 'usage';
  product_id: number;
  product_name: string;
  description: string;
  usage_qty?: number | null;
  qty: number;
  rate: number;
  amount: number;
  gst_rate?: number | null;
}
export interface RentInput { asset_id: number; label: string; unit: string; rate: number; qty: number | null; }
export interface BillingCandidate {
  contract_id: number;
  contract_no: string;
  customer_id: number;
  customer_name: string;
  site_name?: string | null;
  site_state?: string | null;
  /** State (and GSTIN) the bill uses: the customer registration in the site state, else the customer's own. */
  place_of_supply?: string | null;
  site_state_registered?: boolean;
  billing_cycle: string;
  billing_mode: string;
  start_date: string;
  end_date?: string | null;
  last_billed_to?: string | null;
  period_from: string;
  cycle_to: string;
  max_to: string;
  due: boolean;
  asset_count: number;
  meter_count: number;
}
export interface BillingPreview {
  contract_id: number;
  contract_no: string;
  customer_name: string;
  period_from: string;
  period_to: string;
  lines: BillingLine[];
  warnings: string[];
  rent_inputs?: RentInput[];
  total: number;
  has_billable: boolean;
}

export interface DueContract {
  contract_id: number;
  contract_no: string;
  customer_id: number;
  customer_name: string;
  site_name?: string | null;
  billing_cycle?: string;
  total: number;
  line_count: number;
  warnings: string[];
  ready: boolean;
  message?: string | null;
}
export interface BulkBillResult {
  contract_ids: number[];
  ok: boolean;
  error?: string;
  customer_name?: string;
  contract_nos?: string[];
  invoice_id?: number;
  invoice_number?: string;
  total_amount?: number;
  skipped?: string[];
}

/** HTTP access to /api/inventory/lease (Lease & Meter Billing). */
@Injectable({ providedIn: 'root' })
export class LeaseMeterService {
  private readonly http = inject(HttpClient);

  private base(): string { return sessionStorage.getItem('apiURL') || ''; }
  private url(path: string): string { return `${this.base()}/inventory/lease/${path}`; }
  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${currentAccessToken()}` });
  }
  private params(query?: Record<string, string | number | boolean | null | undefined>): HttpParams {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(query ?? {})) {
      if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
    }
    return p;
  }
  private get<T>(path: string, query?: Record<string, any>): Observable<LeaseApiResponse<T>> {
    return this.http.get<LeaseApiResponse<T>>(this.url(path), { headers: this.headers(), params: this.params(query) });
  }
  private post<T>(path: string, body: unknown = {}): Observable<LeaseApiResponse<T>> {
    return this.http.post<LeaseApiResponse<T>>(this.url(path), body, { headers: this.headers() });
  }
  private put<T>(path: string, body: unknown = {}): Observable<LeaseApiResponse<T>> {
    return this.http.put<LeaseApiResponse<T>>(this.url(path), body, { headers: this.headers() });
  }

  /** Message for the user from a failed call (the API sends { message }). */
  static errorMessage(err: any): string {
    return err?.error?.message || err?.message || 'Request failed.';
  }

  // contracts
  getContracts(query?: { status?: string; customerId?: number }): Observable<LeaseApiResponse<LeaseContract[]>> { return this.get('contracts', query); }
  getContract(id: number): Observable<LeaseApiResponse<LeaseContract>> { return this.get(`contracts/${id}`); }
  saveContract(c: LeaseContract): Observable<LeaseApiResponse<LeaseContract>> {
    return c.id ? this.put(`contracts/${c.id}`, c) : this.post('contracts', c);
  }
  setContractStatus(id: number, status: string): Observable<LeaseApiResponse<LeaseContract>> {
    return this.post(`contracts/${id}/status`, { status });
  }

  // lease register
  getRegister(query?: { status?: string; customerId?: number; contractId?: number; includeHistory?: boolean }): Observable<LeaseApiResponse<LeaseAsset[]>> {
    return this.get('register', query);
  }
  getAvailableAssets(): Observable<LeaseApiResponse<{ product_id: number; product_name: string; product_code?: string; serial_unit_id: number | null; asset_ref: string | null; serial_tracked: boolean }[]>> {
    return this.get('assets/available');
  }
  handover(body: { contract_id: number; product_id: number; serial_unit_id?: number | null; asset_ref: string; handover_date: string; handover_condition?: string;
                  rent_applicable?: boolean; rent_uom_id?: number | null; rent_rate?: number | null }): Observable<LeaseApiResponse<LeaseAsset>> {
    return this.post('register/handover', body);
  }
  setAssetRent(id: number, body: { rent_applicable: boolean; rent_uom_id?: number | null; rent_rate?: number | null }): Observable<LeaseApiResponse<LeaseAsset>> {
    return this.post(`register/${id}/rent`, body);
  }
  returnAsset(id: number, body: { return_date: string; return_condition?: string; new_status: 'returned' | 'under_repair' }): Observable<LeaseApiResponse<LeaseAsset>> {
    return this.post(`register/${id}/return`, body);
  }

  // readings
  getReadings(query?: { contractId?: number; leaseMeterId?: number; status?: string }): Observable<LeaseApiResponse<MeterReading[]>> { return this.get('readings', query); }
  saveReading(body: Record<string, any>): Observable<LeaseApiResponse<MeterReading>> {
    return body['id'] ? this.put(`readings/${body['id']}`, body) : this.post('readings', body);
  }
  verifyReadings(ids: number[]): Observable<LeaseApiResponse<{ verified: number; requested: number }>> { return this.post('readings/verify', { ids }); }
  voidReading(id: number): Observable<LeaseApiResponse<MeterReading>> { return this.post(`readings/${id}/void`); }

  // billing
  previewBilling(contractId: number, periodFrom: string, periodTo: string, rentQty?: Record<number, number>): Observable<LeaseApiResponse<BillingPreview>> {
    return this.post('billing/preview', { contract_id: contractId, period_from: periodFrom, period_to: periodTo, rent_qty: rentQty ?? {} });
  }
  getBillingCandidates(customerId: number): Observable<LeaseApiResponse<BillingCandidate[]>> {
    return this.get('billing/candidates', { customerId });
  }
  generateBill(body: { contractId: number; periodFrom: string; periodTo: string; expectedTotal: number; rentQuantities?: Record<number, number>; invoiceDate?: string; placeOfSupply?: string; segmentId?: number | null; remarks?: string }):
    Observable<LeaseApiResponse<{ bill_id: number; invoice_id: number; invoice_number: string; total_amount: number }>> {
    return this.post('billing/generate', body);
  }
  getDueContracts(periodFrom: string, periodTo: string): Observable<LeaseApiResponse<DueContract[]>> {
    return this.get('billing/due', { periodFrom, periodTo });
  }
  generateBulk(body: { contractIds: number[]; periodFrom: string; periodTo: string; mode: 'per_contract' | 'per_customer'; invoiceDate?: string; placeOfSupply?: string; remarks?: string }):
    Observable<LeaseApiResponse<BulkBillResult[]>> {
    return this.post('billing/generate-bulk', body);
  }
  getBills(contractId?: number): Observable<LeaseApiResponse<any[]>> { return this.get('bills', { contractId }); }
  releaseBill(id: number): Observable<LeaseApiResponse<any>> { return this.post(`bills/${id}/release`); }

  // reports
  getReport(report: string, extra?: Record<string, any>): Observable<LeaseApiResponse<any[]>> { return this.get('reports', { report, ...extra }); }

}
