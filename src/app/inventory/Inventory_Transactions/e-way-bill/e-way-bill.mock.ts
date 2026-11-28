import { Injectable } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';

// ─────────────────────────────────────────────────────────────────────────────
// E-Way Bill — MOCK data source.
//
// The screen talks only to this service, so when the API is ready, replace the
// bodies of getEWayBills / generateEWayBills / cancelEWayBill with HTTP calls
// (e.g. in InventoryTransactionsService) that return the same shapes:
//   GET  sales/e-way-bills?type=New|Old&fromDate&toDate     -> EWayBillRow[]
//   POST sales/e-way-bills/generate  { invoices, transport } -> EWayBillRow[]
//   POST sales/e-way-bills/{invoiceId}/cancel { reasonCode, remarks } -> EWayBillRow
// Data lives in memory only: it resets on page reload.
// ─────────────────────────────────────────────────────────────────────────────

export type EWayBillStatus = 'pending' | 'generated' | 'cancelled' | 'failed';
export type TransportMode = 'Road' | 'Rail' | 'Air' | 'Ship';
export type VehicleType = 'Regular' | 'ODC';

export interface EWayBillRow {
  invoice_id: number;
  invoice_no: string;
  invoice_date: string;          // yyyy-MM-dd
  customer_name: string;
  customer_gstin: string | null; // null = unregistered (URP)
  to_place: string;
  to_state: string;
  to_pincode: string;
  total_amount: number;
  irn: string | null;            // e-invoice IRN, when one exists
  distance_km: number;           // suggested from PIN codes; editable before generating

  // Filled once the e-way bill is generated.
  ewb_no: string | null;
  ewb_date: string | null;       // ISO date-time
  valid_upto: string | null;     // ISO date-time
  transport_mode: TransportMode | null;
  vehicle_type: VehicleType | null;
  vehicle_no: string | null;
  transporter_id: string | null;
  transporter_name: string | null;
  transport_doc_no: string | null;
  transport_doc_date: string | null;

  status: EWayBillStatus;
  error_message: string | null;
  cancel_reason: string | null;
  cancelled_on: string | null;
}

export interface EWayBillTransport {
  transport_mode: TransportMode;
  vehicle_type: VehicleType;
  vehicle_no: string;
  transporter_id: string;
  transporter_name: string;
  transport_doc_no: string;
  transport_doc_date: string | null;  // yyyy-MM-dd
}

export interface EWayBillGenerateRequest {
  invoices: { invoice_id: number; distance_km: number }[];
  transport: EWayBillTransport;
}

export interface MockResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/** An e-way bill is required when the consignment value exceeds ₹50,000. */
export const EWAY_BILL_THRESHOLD = 50000;

const LATENCY_MS = 400;

@Injectable({ providedIn: 'root' })
export class EWayBillMockService {
  private readonly rows: EWayBillRow[] = buildSeed();

  getEWayBills(filters: { type: 'New' | 'Old'; fromDate: string; toDate: string }): Observable<MockResponse<EWayBillRow[]>> {
    const data = this.rows
      .filter(r => r.invoice_date >= filters.fromDate && r.invoice_date <= filters.toDate)
      .filter(r => filters.type === 'New'
        ? r.status === 'pending' || r.status === 'failed'
        : r.status === 'generated' || r.status === 'cancelled')
      .sort((a, b) => b.invoice_date.localeCompare(a.invoice_date) || b.invoice_id - a.invoice_id)
      .map(r => ({ ...r }));
    return of({ success: true, message: `${data.length} record(s)`, data }).pipe(delay(LATENCY_MS));
  }

  generateEWayBills(request: EWayBillGenerateRequest): Observable<MockResponse<EWayBillRow[]>> {
    const now = new Date();
    const results: EWayBillRow[] = [];

    for (const item of request.invoices) {
      const row = this.rows.find(r => r.invoice_id === item.invoice_id);
      if (!row) continue;
      row.distance_km = item.distance_km;

      // Same rule the portal applies: 1 to 4000 km.
      if (!(item.distance_km >= 1 && item.distance_km <= 4000)) {
        row.status = 'failed';
        row.error_message = 'Distance must be between 1 and 4000 km.';
        results.push({ ...row });
        continue;
      }

      const t = request.transport;
      row.ewb_no = nextEwbNo();
      row.ewb_date = now.toISOString();
      row.valid_upto = validUpto(now, item.distance_km, t.vehicle_type).toISOString();
      row.transport_mode = t.transport_mode;
      row.vehicle_type = t.transport_mode === 'Road' ? t.vehicle_type : null;
      row.vehicle_no = t.vehicle_no || null;
      row.transporter_id = t.transporter_id || null;
      row.transporter_name = t.transporter_name || null;
      row.transport_doc_no = t.transport_doc_no || null;
      row.transport_doc_date = t.transport_doc_date;
      row.status = 'generated';
      row.error_message = null;
      results.push({ ...row });
    }

    const ok = results.filter(r => r.status === 'generated').length;
    return of({ success: true, message: `E-way bill generated for ${ok} invoice(s).`, data: results }).pipe(delay(LATENCY_MS));
  }

  cancelEWayBill(invoiceId: number, reason: string, remarks: string): Observable<MockResponse<EWayBillRow>> {
    const row = this.rows.find(r => r.invoice_id === invoiceId);
    if (!row || row.status !== 'generated' || !row.ewb_date) {
      return throwError(() => ({ error: { message: 'E-way bill not found or already cancelled.' } }));
    }
    if (!canCancel(row)) {
      return throwError(() => ({ error: { message: 'An e-way bill can be cancelled only within 24 hours of generation.' } }));
    }
    row.status = 'cancelled';
    row.cancel_reason = remarks ? `${reason} - ${remarks}` : reason;
    row.cancelled_on = new Date().toISOString();
    return of({ success: true, message: `E-way bill ${row.ewb_no} cancelled.`, data: { ...row } }).pipe(delay(LATENCY_MS));
  }
}

/** Cancellation is allowed within 24 hours of generation. */
export function canCancel(row: EWayBillRow): boolean {
  if (row.status !== 'generated' || !row.ewb_date) return false;
  return Date.now() - new Date(row.ewb_date).getTime() < 24 * 60 * 60 * 1000;
}

/**
 * Validity: 1 day per 200 km for regular cargo (20 km for over-dimensional
 * cargo), counted to 23:59:59 of the last day. Day 1 ends at the first
 * midnight after generation.
 */
export function validUpto(from: Date, distanceKm: number, vehicleType: VehicleType): Date {
  const perDay = vehicleType === 'ODC' ? 20 : 200;
  const days = Math.max(1, Math.ceil(distanceKm / perDay));
  const end = new Date(from);
  end.setDate(end.getDate() + days);
  end.setHours(23, 59, 59, 0);
  return end;
}

// ── Seed data ────────────────────────────────────────────────────────────────

let ewbCounter = 3214_5678_9050;
function nextEwbNo(): string {
  ewbCounter += 7;
  return String(ewbCounter);
}

function ymd(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function fy(): string {
  const d = new Date();
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${String(start).slice(2)}-${String(start + 1).slice(2)}`;
}

function buildSeed(): EWayBillRow[] {
  const f = fy();
  const base = (id: number, daysAgo: number, customer: string, gstin: string | null, place: string, state: string,
                pin: string, amount: number, km: number, irn: boolean): EWayBillRow => ({
    invoice_id: id,
    invoice_no: `INVCP${String(id).padStart(5, '0')}/${f}`,
    invoice_date: ymd(daysAgo),
    customer_name: customer,
    customer_gstin: gstin,
    to_place: place,
    to_state: state,
    to_pincode: pin,
    total_amount: amount,
    irn: irn ? `a5c1${id}f0e9b7d2c4e6a8b0d2f4e6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a${id}`.slice(0, 64) : null,
    distance_km: km,
    ewb_no: null, ewb_date: null, valid_upto: null,
    transport_mode: null, vehicle_type: null, vehicle_no: null,
    transporter_id: null, transporter_name: null, transport_doc_no: null, transport_doc_date: null,
    status: 'pending', error_message: null, cancel_reason: null, cancelled_on: null
  });

  const generated = (row: EWayBillRow, at: Date, vehicle: string, transporter: string | null, transporterId: string | null): EWayBillRow => ({
    ...row,
    ewb_no: nextEwbNo(),
    ewb_date: at.toISOString(),
    valid_upto: validUpto(at, row.distance_km, 'Regular').toISOString(),
    transport_mode: 'Road',
    vehicle_type: 'Regular',
    vehicle_no: vehicle,
    transporter_id: transporterId,
    transporter_name: transporter,
    status: 'generated'
  });

  return [
    // New (pending)
    base(41, 0, 'Sri Venkateswara Traders', '36AAKFS1234R1Z5', 'Warangal', 'Telangana', '506002', 128450.00, 148, true),
    base(40, 1, 'Lakshmi Agro Industries', '37AABCL5678M1Z2', 'Vijayawada', 'Andhra Pradesh', '520001', 86520.50, 275, true),
    base(39, 2, 'Green Fields Farmers Co-op', null, 'Karimnagar', 'Telangana', '505001', 64200.00, 165, false),
    base(38, 2, 'Ravi Kumar', null, 'Secunderabad', 'Telangana', '500003', 18750.00, 12, false),
    base(37, 4, 'Deccan Fertilisers Pvt Ltd', '29AADCD4321K1Z9', 'Bengaluru', 'Karnataka', '560058', 245890.00, 575, true),
    base(36, 5, 'Nandi Seeds & Pesticides', '36AAFFN9876C1Z1', 'Nizamabad', 'Telangana', '503001', 52310.00, 178, true),
    { ...base(35, 6, 'Coastal Agri Mart', '37AAGFC2468H1Z7', 'Visakhapatnam', 'Andhra Pradesh', '530003', 98000.00, 0, true),
      status: 'failed', error_message: 'Distance must be between 1 and 4000 km.' },
    base(34, 8, 'Suresh Reddy', null, 'Medak', 'Telangana', '502110', 32400.00, 95, false),

    // Old (generated / cancelled)
    generated(base(33, 0, 'Kaveri Agri Solutions', '36AACCK1357P1Z3', 'Khammam', 'Telangana', '507001', 156700.00, 198, true),
      hoursAgo(3), 'TS09UB4521', 'Swift Logistics', '36AAJCS2468Q1Z8'),
    generated(base(32, 1, 'Sai Krishna Enterprises', '37AAPFS8642L1Z6', 'Guntur', 'Andhra Pradesh', '522002', 74320.00, 265, true),
      hoursAgo(20), 'AP16TC7788', null, null),
    generated(base(31, 3, 'Deccan Fertilisers Pvt Ltd', '29AADCD4321K1Z9', 'Bengaluru', 'Karnataka', '560058', 312450.00, 575, true),
      hoursAgo(70), 'KA01AB1234', 'VRL Logistics Ltd', '29AABCV3609C1ZJ'),
    {
      ...generated(base(30, 6, 'Annapurna Agro Centre', '36AAHFA7531N1Z4', 'Mahabubnagar', 'Telangana', '509001', 58900.00, 102, true),
        hoursAgo(140), 'TS07EX9090', 'Swift Logistics', '36AAJCS2468Q1Z8'),
      status: 'cancelled',
      cancel_reason: 'Data Entry Mistake - wrong vehicle number',
      cancelled_on: hoursAgo(136).toISOString()
    },
    generated(base(29, 10, 'Godavari Crop Care', '36AAIFG2244D1Z0', 'Adilabad', 'Telangana', '504001', 189300.00, 305, true),
      hoursAgo(235), 'TS01UC3456', 'Sri Durga Transport', '36ABEFS1122R1Z2')
  ];
}
