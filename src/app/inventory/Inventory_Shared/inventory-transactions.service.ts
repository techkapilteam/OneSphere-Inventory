import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiResponse } from './inventory-config.service';
import { currentAccessToken } from './inventory-auth-token.util';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface PrItem {
  id?: number;
  sno: number;
  product_id?: number;
  product_name: string;
  product_code?: string;
  variant_id?: number;
  variant_name?: string;
  attribute_id?: number;
  attribute_name?: string;
  attribute_value?: string;
  uom_id?: number;
  uom_name?: string;
  required_qty: number;
  estimated_rate?: number;
  remarks?: string;
}

export interface PurchaseRequisition {
  id: number;
  pr_number: string;
  pr_date?: string;
  segment_id?: number;
  segment_name?: string;
  branch_id?: number;
  branch_name?: string;
  department?: string;
  requested_by?: string;
  required_by?: string;
  priority: string;
  remarks?: string;
  status: string;
  created_at?: string;
  items: PrItem[];
}

export interface RfqItem {
  id?: number;
  sno: number;
  product_id?: number;
  product_name: string;
  product_code?: string;
  variant_id?: number;
  variant_name?: string;
  attribute_id?: number;
  attribute_name?: string;
  attribute_value?: string;
  uom_id?: number;
  uom_name?: string;
  required_qty: number;
  target_rate?: number;
  vendor_rate?: number;
  gst_rate: number;
  gst_inclusive?: boolean;
  cgst_rate?: number;
  sgst_rate?: number;
  igst_rate?: number;
  taxable_amount?: number;
  tax_amount?: number;
  line_total?: number;
  lead_time?: string;
  remarks?: string;
}

export interface Rfq {
  id: number;
  rfq_number: string;
  rfq_group_number?: string;
  rfq_date?: string;
  valid_till?: string;
  estd_delivery_date?: string;
  source_type?: string;
  segment_id?: number;
  segment_name?: string;
  pr_id?: number;
  pr_number?: string;
  vendor_id?: number;
  vendor_name?: string;
  vendor_gstin?: string;
  delivery_location?: string;
  payment_terms?: string;
  currency: string;
  send_channel?: string;
  vendor_response_link?: string;
  sent_at?: string;
  response_received_at?: string;
  gst_inclusive?: boolean;
  tds_applicable?: boolean;
  quality_score?: number;
  price_weight?: number;
  quality_weight?: number;
  lead_time_weight?: number;
  payment_terms_weight?: number;
  negotiation_notes?: string;
  selected_for_po?: boolean;
  remarks?: string;
  status: string;
  created_at?: string;
  items: RfqItem[];
}

export interface GrnItem {
  id?: number;
  sno: number;
  product_id?: number;
  product_name: string;
  product_code?: string;
  variant_id?: number;
  variant_name?: string;
  attribute_id?: number;
  attribute_name?: string;
  attribute_value?: string;
  uom_id?: number;
  uom_name?: string;
  order_qty?: number;
  received_qty: number;
  accepted_qty: number;
  rejected_qty: number;
  rate: number;
  discount_pct: number;
  gst_rate: number;
  gst_inclusive?: boolean;
  taxable_amount?: number;
  tax_amount?: number;
  amount: number;
  batch_no?: string;
  serial_no?: string;
  serial_numbers?: string[] | null;
  expiry_date?: string;
  remarks?: string;
}

export interface StockTransferItem {
  id?: number;
  sno: number;
  product_id?: number;
  product_name: string;
  product_code?: string;
  variant_id?: number;
  variant_name?: string;
  attribute_id?: number;
  attribute_name?: string;
  attribute_value?: string;
  uom_id?: number;
  uom_name?: string;
  qty: number;
  batch_no?: string;
  serial_no?: string;
  serial_numbers?: string[] | null;
  remarks?: string;
}

export interface StockTransfer {
  id: number;
  transfer_number: string;
  transfer_date?: string;
  segment_id?: number;
  segment_name?: string;
  from_branch_id?: number;
  from_branch_name?: string;
  from_warehouse_id?: number;
  from_warehouse_name?: string;
  to_branch_id?: number;
  to_branch_name?: string;
  to_warehouse_id?: number;
  to_warehouse_name?: string;
  remarks?: string;
  total_qty: number;
  status: string;
  created_at?: string;
  items: StockTransferItem[];
}

export interface ManufacturingMaterialItem {
  id?: number;
  sno: number;
  product_id?: number;
  product_name: string;
  product_code?: string;
  variant_id?: number;
  variant_name?: string;
  attribute_id?: number;
  attribute_name?: string;
  attribute_value?: string;
  uom_id?: number;
  uom_name?: string;
  required_qty?: number;
  available_qty?: number;
  shortage_qty?: number;
  batch_required?: boolean;
  issued_qty?: number;
  consumed_qty?: number;
  returned_qty?: number;
  batch_no?: string;
  serial_no?: string;
  serial_numbers?: string[] | null;
  remarks?: string;
}

export interface ProductionPlan {
  id: number;
  plan_number: string;
  plan_date?: string;
  production_date?: string;
  segment_id?: number;
  segment_name?: string;
  finished_product_id?: number;
  finished_product_name?: string;
  planned_qty: number;
  bom_version?: string;
  work_center?: string;
  branch_id?: number;
  branch_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  remarks?: string;
  status: string;
  created_at?: string;
  items: ManufacturingMaterialItem[];
}

export interface MaterialIssueProduction {
  id: number;
  issue_number: string;
  issue_date?: string;
  segment_id?: number;
  segment_name?: string;
  production_plan_id?: number;
  production_plan_number?: string;
  from_branch_id?: number;
  from_branch_name?: string;
  from_warehouse_id?: number;
  from_warehouse_name?: string;
  to_work_center?: string;
  issued_by_name?: string;
  remarks?: string;
  total_qty: number;
  status: string;
  created_at?: string;
  items: ManufacturingMaterialItem[];
}

export interface ProductionEntryItem extends ManufacturingMaterialItem {
  planned_qty?: number;
  produced_qty: number;
  rejected_qty?: number;
  wastage_qty?: number;
  production_cost?: number;
}

export interface ProductionEntry {
  id: number;
  production_number: string;
  production_date?: string;
  segment_id?: number;
  segment_name?: string;
  production_plan_id?: number;
  production_plan_number?: string;
  finished_product_id?: number;
  finished_product_name?: string;
  produced_qty: number;
  rejected_qty: number;
  wastage_qty: number;
  production_cost: number;
  to_branch_id?: number;
  to_branch_name?: string;
  to_warehouse_id?: number;
  to_warehouse_name?: string;
  batch_no?: string;
  remarks?: string;
  status: string;
  created_at?: string;
  items: ProductionEntryItem[];
}

export interface ProductionReturn {
  id: number;
  return_number: string;
  return_date?: string;
  segment_id?: number;
  segment_name?: string;
  material_issue_id?: number;
  material_issue_number?: string;
  production_plan_id?: number;
  production_plan_number?: string;
  to_branch_id?: number;
  to_branch_name?: string;
  to_warehouse_id?: number;
  to_warehouse_name?: string;
  reason?: string;
  remarks?: string;
  total_qty: number;
  status: string;
  created_at?: string;
  items: ManufacturingMaterialItem[];
}

export interface StockAdjustmentItem {
  id?: number;
  sno: number;
  product_id?: number;
  product_name: string;
  product_code?: string;
  variant_id?: number;
  variant_name?: string;
  attribute_id?: number;
  attribute_name?: string;
  attribute_value?: string;
  uom_id?: number;
  uom_name?: string;
  qty: number;
  batch_no?: string;
  serial_no?: string;
  serial_numbers?: string[] | null;
  remarks?: string;
}

export interface StockAdjustment {
  id: number;
  adjustment_number: string;
  adjustment_date?: string;
  segment_id?: number;
  segment_name?: string;
  branch_id?: number;
  branch_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  adjustment_type: string;
  reason?: string;
  remarks?: string;
  total_qty: number;
  status: string;
  approved_by?: number;
  approved_at?: string;
  created_at?: string;
  items: StockAdjustmentItem[];
}

export interface OpeningStockEntryItem {
  id?: number;
  sno: number;
  product_id?: number;
  product_name: string;
  product_code?: string;
  variant_id?: number;
  variant_name?: string;
  attribute_id?: number;
  attribute_name?: string;
  attribute_value?: string;
  uom_id?: number;
  uom_name?: string;
  qty: number;
  rate: number;
  amount: number;
  batch_no?: string;
  serial_no?: string;
  serial_numbers?: string[] | null;
  remarks?: string;
}

export interface OpeningStockEntry {
  id: number;
  entry_number: string;
  entry_date?: string;
  segment_id?: number;
  segment_name?: string;
  branch_id?: number;
  branch_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  remarks?: string;
  total_value: number;
  status: string;
  created_at?: string;
  items: OpeningStockEntryItem[];
}

export interface CycleCountItem {
  id?: number;
  sno: number;
  product_id?: number;
  product_name: string;
  product_code?: string;
  variant_id?: number;
  variant_name?: string;
  attribute_id?: number;
  attribute_name?: string;
  attribute_value?: string;
  uom_id?: number;
  uom_name?: string;
  system_qty: number;
  physical_qty: number;
  variance_qty: number;
  reason?: string;
  remarks?: string;
}

export interface CycleCount {
  id: number;
  verification_number: string;
  verification_date?: string;
  segment_id?: number;
  segment_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  verified_by_name?: string;
  product_category_id?: number;
  remarks?: string;
  total_items: number;
  variance_items: number;
  status: string;
  approved_by?: number;
  approved_at?: string;
  created_at?: string;
  items: CycleCountItem[];
}

export interface Grn {
  id: number;
  grn_number: string;
  grn_date?: string;
  segment_id?: number;
  segment_name?: string;
  branch_id?: number;
  branch_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  vendor_id?: number;
  vendor_name?: string;
  vendor_gstin?: string;
  rfq_id?: number;
  rfq_number?: string;
  vendor_invoice_no?: string;
  vendor_invoice_dt?: string;
  transport_details?: string;
  remarks?: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  created_at?: string;
  items: GrnItem[];
}

export interface PiItem {
  id?: number;
  sno: number;
  product_id?: number;
  product_name: string;
  product_code?: string;
  variant_id?: number;
  variant_name?: string;
  attribute_id?: number;
  attribute_name?: string;
  attribute_value?: string;
  uom_id?: number;
  uom_name?: string;
  qty: number;
  rate: number;
  mrp?: number;
  selling_price?: number;
  discount_pct: number;
  gst_rate: number;
  gst_inclusive?: boolean;
  taxable_amount?: number;
  tax_amount?: number;
  batch_no?: string;
  serial_no?: string;
  serial_numbers?: string[] | null;
  expiry_date?: string;
  amount: number;
  remarks?: string;
}

export interface PurchaseInvoice {
  id: number;
  pi_number: string;
  pi_date?: string;
  segment_id?: number;
  segment_name?: string;
  vendor_id?: number;
  vendor_name?: string;
  vendor_gstin?: string;
  grn_id?: number;
  grn_number?: string;
  branch_id?: number;
  branch_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  vendor_invoice_no?: string;
  vendor_invoice_dt?: string;
  due_date?: string;
  payment_terms?: string;
  remarks?: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  created_at?: string;
  items: PiItem[];
}

export interface PurchaseOrderItem {
  id?: number;
  sno: number;
  product_id?: number;
  product_name: string;
  product_code?: string;
  variant_id?: number;
  variant_name?: string;
  attribute_id?: number;
  attribute_name?: string;
  attribute_value?: string;
  uom_id?: number;
  uom_name?: string;
  qty: number;
  rate: number;
  discount_pct: number;
  gst_rate: number;
  gst_inclusive?: boolean;
  taxable_amount?: number;
  tax_amount?: number;
  warehouse_name?: string;
  amount: number;
}

export interface PurchaseOrder {
  id: number;
  po_number: string;
  po_date?: string;
  expected_delivery?: string;
  segment_id?: number;
  segment_name?: string;
  rfq_id?: number;
  rfq_number?: string;
  vendor_id?: number;
  vendor_name?: string;
  vendor_gstin?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  currency: string;
  payment_terms?: string;
  reference_no?: string;
  terms_conditions?: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  created_at?: string;
  items: PurchaseOrderItem[];
}

export interface PurchaseRefDoc {
  id: number;
  doc_type?: string;
  doc_number: string;
  doc_date?: string;
  segment_id?: number;
  segment_name?: string;
  branch_id?: number;
  branch_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  vendor_id?: number;
  party_name?: string;
  channel_partner_id?: number;
  channel_partner_name?: string;
  vendor_invoice_no?: string;
  vendor_invoice_dt?: string;
  payment_terms?: string;
  so_id?: number;
  so_number?: string;
  grn_id?: number;
  status: string;
  remarks?: string;
  items: any[];
}

export interface PurchaseReturnItem {
  id?: number;
  sno: number;
  product_id?: number;
  product_name: string;
  product_code?: string;
  variant_id?: number;
  variant_name?: string;
  attribute_id?: number;
  attribute_name?: string;
  attribute_value?: string;
  uom_name?: string;
  grn_qty?: number;
  return_qty: number;
  rate: number;
  gst_rate?: number;
  gst_inclusive?: boolean;
  taxable_amount?: number;
  tax_amount?: number;
  return_amount: number;
  return_reason?: string;
  serial_numbers?: string[] | null;
  remarks?: string;
}

export interface PurchaseReturn {
  id: number;
  return_number: string;
  return_date?: string;
  segment_id?: number;
  segment_name?: string;
  vendor_id?: number;
  vendor_name?: string;
  pi_id?: number;
  pi_number?: string;
  pi_grn_id?: number;
  debit_note_ref?: string;
  branch_id?: number;
  branch_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  return_reason?: string;
  remarks?: string;
  subtotal?: number;
  tax_amount?: number;
  total_amount: number;
  status: string;
  created_at?: string;
  items: PurchaseReturnItem[];
}

export interface DebitNoteItem {
  id?: number;
  sno: number;
  description: string;
  reference?: string;
  amount: number;
  gst_pct: number;
  gst_amount: number;
  total_amount: number;
}

export interface DebitNote {
  id: number;
  debit_note_number: string;
  debit_note_date?: string;
  segment_id?: number;
  segment_name?: string;
  vendor_id?: number;
  vendor_name?: string;
  purchase_return_id?: number;
  purchase_return_number?: string;
  purchase_invoice_id?: number;
  purchase_invoice_number?: string;
  reason?: string;
  gst_adjustment: boolean;
  remarks?: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  created_at?: string;
  items: DebitNoteItem[];
}

export interface CreditNote {
  id: number;
  credit_note_number: string;
  credit_note_date?: string;
  segment_id?: number;
  segment_name?: string;
  customer_id?: number;
  customer_name?: string;
  sales_return_id?: number;
  sales_return_number?: string;
  sales_invoice_id?: number;
  sales_invoice_number?: string;
  reason?: string;
  gst_adjustment: boolean;
  remarks?: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  created_at?: string;
  items: DebitNoteItem[];
}

export interface DeliveryChallanItem {
  id?: number;
  sno: number;
  so_item_id?: number;
  si_item_id?: number;
  product_id?: number;
  product_name: string;
  product_code?: string;
  variant_id?: number;
  variant_name?: string;
  attribute_id?: number;
  attribute_name?: string;
  attribute_value?: string;
  uom_id?: number;
  uom_name?: string;
  so_qty?: number;
  dispatch_qty: number;
  invoiced_qty?: number;
  batch_serial?: string;
  serial_numbers?: string[] | null;
  remarks?: string;
}

export interface DeliveryChallan {
  id: number;
  dc_number: string;
  dc_date?: string;
  segment_id?: number;
  segment_name?: string;
  so_id?: number;
  so_number?: string;
  si_id?: number;
  si_number?: string;
  reference_no?: string;
  customer_id?: number;
  customer_name?: string;
  channel_partner_id?: number;
  channel_partner_name?: string;
  branch_id?: number;
  branch_name?: string;
  from_warehouse_id?: number;
  from_warehouse_name?: string;
  vehicle?: string;
  transporter?: string;
  lr_no?: string;
  delivery_address?: string;
  remarks?: string;
  status: string;
  display_status?: string;
  created_at?: string;
  items: DeliveryChallanItem[];
}

export interface AvailableStock {
  product_id?: number;
  variant_id?: number;
  attribute_id?: number;
  warehouse_id?: number;
  product_name?: string;
  variant_name?: string;
  attribute_name?: string;
  attribute_value?: string;
  warehouse_name?: string;
  // Location-generic additions (Workstream A) -- populated for branch-only
  // stock rows (warehouse_id null) that sp_get_available_stock already
  // emits; mutually exclusive with warehouse_id/warehouse_name per row.
  branch_id?: number | null;
  branch_name?: string | null;
  location_type?: string | null;
  location_id?: number | null;
  location_name?: string | null;
  on_hand: number;
  pending_dc_qty: number;
  available: number;
}

export interface SerialUnit {
  id?: number;
  serial_no?: string;
  // The warranty already fixed on this exact physical unit at receipt time
  // (migration 237) — read-only display when selling it, never re-entered.
  manufacturing_date?: string | null;
  warranty_upto?: string | null;
}

export interface SalesReturnItem {
  id?: number;
  sno: number;
  product_id?: number;
  product_name: string;
  product_code?: string;
  variant_id?: number;
  variant_name?: string;
  attribute_id?: number;
  attribute_name?: string;
  attribute_value?: string;
  uom_id?: number;
  uom_name?: string;
  invoiced_qty?: number;
  return_qty: number;
  rate: number;
  gst_rate?: number;
  gst_inclusive?: boolean;
  taxable_amount?: number;
  tax_amount?: number;
  return_amount: number;
  reason?: string;
  serial_numbers?: string[] | null;
  remarks?: string;
}

export interface SalesReturn {
  id: number;
  return_number: string;
  return_date?: string;
  segment_id?: number;
  segment_name?: string;
  customer_id?: number;
  customer_name?: string;
  channel_partner_id?: number;
  channel_partner_name?: string;
  invoice_id?: number;
  invoice_number?: string;
  credit_note_ref?: string;
  return_to_warehouse_id?: number;
  return_to_warehouse_name?: string;
  return_reason?: string;
  remarks?: string;
  subtotal?: number;
  tax_amount?: number;
  total_amount: number;
  status: string;
  created_at?: string;
  items: SalesReturnItem[];
}

export interface ServiceBundleConsumptionItem {
  id: number;
  item_id: number;
  item_name: string;
  item_nature?: string;
  quantity_per_bundle: number;
  bundle_qty: number;
  required_qty: number;
  issued_qty: number;
  shortfall_qty: number;
  stock_before?: number;
  stock_after?: number;
  stock_posted: boolean;
  cost_rate: number;
  cost_amount: number;
  remarks?: string;
  status: string;
}

export interface ServiceBundleConsumption {
  id: number;
  company_id: number;
  invoice_id: number;
  invoice_number?: string;
  invoice_item_id: number;
  bundle_product_id: number;
  bundle_product_name: string;
  warehouse_id?: number;
  warehouse_name?: string;
  consumption_date?: string;
  status: string;
  created_at?: string;
  items: ServiceBundleConsumptionItem[];
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class InventoryTransactionsService {
  private readonly http = inject(HttpClient);

  private base(): string { return sessionStorage.getItem('apiURL') || ''; }
  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${currentAccessToken()}` });
  }
  private url(path: string): string { return `${this.base()}/inventory/transactions/${path}`; }

  private camelize(key: string): string {
    return key.replace(/_([a-z])/g, (_, l: string) => l.toUpperCase());
  }

  private toApiValue(value: any): any {
    if (Array.isArray(value)) return value.map(i => this.toApiValue(i));
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      return Object.entries(value).reduce((out, [k, v]) => {
        (out as any)[this.camelize(k)] = this.toApiValue(v);
        return out;
      }, {} as Record<string, any>);
    }
    return value;
  }

  private mapArray<T>(src: Observable<ApiResponse<any[]>>, normalize: (item: any) => T): Observable<ApiResponse<T[]>> {
    return src.pipe(map(res => ({ ...res, data: (res.data ?? []).map(normalize) })));
  }

  private mapItem<T>(src: Observable<ApiResponse<any>>, normalize: (item: any) => T): Observable<ApiResponse<T>> {
    return src.pipe(map(res => ({ ...res, data: res.data ? normalize(res.data) : undefined })));
  }

  // ── Normalizers ──────────────────────────────────────────────────────────────

  private normPr(r: any): PurchaseRequisition {
    return {
      id: r?.id, pr_number: r?.prNumber || r?.pr_number || '',
      pr_date: r?.prDate || r?.pr_date,
      segment_id: r?.segmentId ?? r?.segment_id,
      segment_name: r?.segmentName || r?.segment_name,
      branch_id: r?.branchId ?? r?.branch_id,
      branch_name: r?.branchName || r?.branch_name,
      department: r?.department,
      requested_by: r?.requestedBy || r?.requested_by,
      required_by: r?.requiredBy || r?.required_by,
      priority: r?.priority || 'medium', remarks: r?.remarks,
      status: r?.status || 'draft', created_at: r?.createdAt || r?.created_at,
      items: (r?.items || []).map((i: any) => ({
        id: i.id, sno: i.sno || 1,
        product_id: i.productId ?? i.product_id,
        product_name: i.productName || i.product_name || '',
        product_code: i.productCode || i.product_code,
        variant_id: i.variantId ?? i.variant_id,
        variant_name: i.variantName || i.variant_name,
        attribute_id: i.attributeId ?? i.attribute_id,
        attribute_name: i.attributeName || i.attribute_name,
        attribute_value: i.attributeValue || i.attribute_value,
        uom_id: i.uomId ?? i.uom_id,
        uom_name: i.uomName || i.uom_name,
        required_qty: Number(i.requiredQty || i.required_qty || 0),
        estimated_rate: i.estimatedRate ?? i.estimated_rate,
        remarks: i.remarks
      }))
    };
  }

  private normRfq(r: any): Rfq {
    return {
      id: r?.id, rfq_number: r?.rfqNumber || r?.rfq_number || '',
      rfq_group_number: r?.rfqGroupNumber || r?.rfq_group_number,
      rfq_date: r?.rfqDate || r?.rfq_date,
      valid_till: r?.validTill || r?.valid_till,
      estd_delivery_date: r?.estdDeliveryDate || r?.estd_delivery_date,
      source_type: r?.sourceType || r?.source_type,
      segment_id: r?.segmentId ?? r?.segment_id,
      segment_name: r?.segmentName || r?.segment_name,
      pr_id: r?.prId || r?.pr_id, pr_number: r?.prNumber || r?.pr_number,
      vendor_id: r?.vendorId ?? r?.vendor_id,
      vendor_name: r?.vendorName || r?.vendor_name,
      vendor_gstin: r?.vendorGstin || r?.vendor_gstin,
      delivery_location: r?.deliveryLocation || r?.delivery_location,
      payment_terms: r?.paymentTerms || r?.payment_terms,
      currency: r?.currency || 'INR',
      send_channel: r?.sendChannel || r?.send_channel,
      vendor_response_link: r?.vendorResponseLink || r?.vendor_response_link,
      sent_at: r?.sentAt || r?.sent_at,
      response_received_at: r?.responseReceivedAt || r?.response_received_at,
      gst_inclusive: !!(r?.gstInclusive ?? r?.gst_inclusive),
      tds_applicable: !!(r?.tdsApplicable ?? r?.tds_applicable),
      quality_score: r?.qualityScore ?? r?.quality_score,
      price_weight: r?.priceWeight ?? r?.price_weight,
      quality_weight: r?.qualityWeight ?? r?.quality_weight,
      lead_time_weight: r?.leadTimeWeight ?? r?.lead_time_weight,
      payment_terms_weight: r?.paymentTermsWeight ?? r?.payment_terms_weight,
      negotiation_notes: r?.negotiationNotes || r?.negotiation_notes,
      selected_for_po: !!(r?.selectedForPo ?? r?.selected_for_po),
      remarks: r?.remarks,
      status: r?.status || 'draft', created_at: r?.createdAt || r?.created_at,
      items: (r?.items || []).map((i: any) => ({
        id: i.id, sno: i.sno || 1,
        product_id: i.productId ?? i.product_id,
        product_name: i.productName || i.product_name || '',
        product_code: i.productCode || i.product_code,
        variant_id: i.variantId ?? i.variant_id,
        variant_name: i.variantName || i.variant_name,
        attribute_id: i.attributeId ?? i.attribute_id,
        attribute_name: i.attributeName || i.attribute_name,
        attribute_value: i.attributeValue || i.attribute_value,
        uom_id: i.uomId ?? i.uom_id,
        uom_name: i.uomName || i.uom_name,
        required_qty: Number(i.requiredQty || i.required_qty || 0),
        target_rate: i.targetRate ?? i.target_rate,
        vendor_rate: i.vendorRate ?? i.vendor_rate,
        gst_rate: Number(i.gstRate || i.gst_rate || 0),
        gst_inclusive: !!(i.gstInclusive ?? i.gst_inclusive),
        cgst_rate: i.cgstRate ?? i.cgst_rate,
        sgst_rate: i.sgstRate ?? i.sgst_rate,
        igst_rate: i.igstRate ?? i.igst_rate,
        taxable_amount: Number(i.taxableAmount ?? i.taxable_amount ?? 0),
        tax_amount: Number(i.taxAmount ?? i.tax_amount ?? 0),
        line_total: Number(i.lineTotal ?? i.line_total ?? 0),
        lead_time: i.leadTime || i.lead_time, remarks: i.remarks
      }))
    };
  }

  private normStockTransfer(r: any): StockTransfer {
    return {
      id: r?.id, transfer_number: r?.transferNumber || r?.transfer_number || '',
      transfer_date: r?.transferDate || r?.transfer_date,
      segment_id: r?.segmentId ?? r?.segment_id,
      segment_name: r?.segmentName || r?.segment_name,
      from_branch_id: r?.fromBranchId ?? r?.from_branch_id,
      from_branch_name: r?.fromBranchName || r?.from_branch_name,
      from_warehouse_id: r?.fromWarehouseId ?? r?.from_warehouse_id,
      from_warehouse_name: r?.fromWarehouseName || r?.from_warehouse_name,
      to_branch_id: r?.toBranchId ?? r?.to_branch_id,
      to_branch_name: r?.toBranchName || r?.to_branch_name,
      to_warehouse_id: r?.toWarehouseId ?? r?.to_warehouse_id,
      to_warehouse_name: r?.toWarehouseName || r?.to_warehouse_name,
      remarks: r?.remarks,
      total_qty: Number(r?.totalQty ?? r?.total_qty ?? 0),
      status: r?.status || 'draft', created_at: r?.createdAt || r?.created_at,
      items: (r?.items || []).map((i: any) => ({
        id: i.id, sno: i.sno || 1,
        product_id: i.productId ?? i.product_id,
        product_name: i.productName || i.product_name || '',
        product_code: i.productCode || i.product_code,
        variant_id: i.variantId ?? i.variant_id,
        variant_name: i.variantName || i.variant_name,
        attribute_id: i.attributeId ?? i.attribute_id,
        attribute_name: i.attributeName || i.attribute_name,
        attribute_value: i.attributeValue || i.attribute_value,
        uom_id: i.uomId ?? i.uom_id,
        uom_name: i.uomName || i.uom_name,
        qty: Number(i.qty || 0),
        batch_no: i.batchNo || i.batch_no,
        serial_no: i.serialNo || i.serial_no,
        serial_numbers: i.serialNumbers ?? i.serial_numbers ?? null,
        remarks: i.remarks
      }))
    };
  }

  private normManufacturingMaterialItem(i: any): ManufacturingMaterialItem {
    return {
      id: i?.id,
      sno: i?.sno || 1,
      product_id: i?.productId ?? i?.product_id,
      product_name: i?.productName || i?.product_name || '',
      product_code: i?.productCode || i?.product_code,
      variant_id: i?.variantId ?? i?.variant_id,
      variant_name: i?.variantName || i?.variant_name,
      attribute_id: i?.attributeId ?? i?.attribute_id,
      attribute_name: i?.attributeName || i?.attribute_name,
      attribute_value: i?.attributeValue || i?.attribute_value,
      uom_id: i?.uomId ?? i?.uom_id,
      uom_name: i?.uomName || i?.uom_name,
      required_qty: Number(i?.requiredQty ?? i?.required_qty ?? 0),
      available_qty: Number(i?.availableQty ?? i?.available_qty ?? 0),
      shortage_qty: Number(i?.shortageQty ?? i?.shortage_qty ?? 0),
      batch_required: !!(i?.batchRequired ?? i?.batch_required),
      issued_qty: Number(i?.issuedQty ?? i?.issued_qty ?? 0),
      consumed_qty: Number(i?.consumedQty ?? i?.consumed_qty ?? 0),
      returned_qty: Number(i?.returnedQty ?? i?.returned_qty ?? 0),
      batch_no: i?.batchNo || i?.batch_no,
      serial_no: i?.serialNo || i?.serial_no,
      serial_numbers: i?.serialNumbers ?? i?.serial_numbers ?? null,
      remarks: i?.remarks
    };
  }

  private normProductionPlan(r: any): ProductionPlan {
    return {
      id: r?.id,
      plan_number: r?.planNumber || r?.plan_number || '',
      plan_date: r?.planDate || r?.plan_date,
      production_date: r?.productionDate || r?.production_date,
      segment_id: r?.segmentId ?? r?.segment_id,
      segment_name: r?.segmentName || r?.segment_name,
      finished_product_id: r?.finishedProductId ?? r?.finished_product_id,
      finished_product_name: r?.finishedProductName || r?.finished_product_name,
      planned_qty: Number(r?.plannedQty ?? r?.planned_qty ?? 0),
      bom_version: r?.bomVersion || r?.bom_version,
      work_center: r?.workCenter || r?.work_center,
      branch_id: r?.branchId ?? r?.branch_id,
      branch_name: r?.branchName || r?.branch_name,
      warehouse_id: r?.warehouseId ?? r?.warehouse_id,
      warehouse_name: r?.warehouseName || r?.warehouse_name,
      remarks: r?.remarks,
      status: r?.status || 'draft',
      created_at: r?.createdAt || r?.created_at,
      items: (r?.items || []).map((i: any) => this.normManufacturingMaterialItem(i))
    };
  }

  private normMaterialIssueProduction(r: any): MaterialIssueProduction {
    return {
      id: r?.id,
      issue_number: r?.issueNumber || r?.issue_number || '',
      issue_date: r?.issueDate || r?.issue_date,
      segment_id: r?.segmentId ?? r?.segment_id,
      segment_name: r?.segmentName || r?.segment_name,
      production_plan_id: r?.productionPlanId ?? r?.production_plan_id,
      production_plan_number: r?.productionPlanNumber || r?.production_plan_number,
      from_branch_id: r?.fromBranchId ?? r?.from_branch_id,
      from_branch_name: r?.fromBranchName || r?.from_branch_name,
      from_warehouse_id: r?.fromWarehouseId ?? r?.from_warehouse_id,
      from_warehouse_name: r?.fromWarehouseName || r?.from_warehouse_name,
      to_work_center: r?.toWorkCenter || r?.to_work_center,
      issued_by_name: r?.issuedByName || r?.issued_by_name,
      remarks: r?.remarks,
      total_qty: Number(r?.totalQty ?? r?.total_qty ?? 0),
      status: r?.status || 'draft',
      created_at: r?.createdAt || r?.created_at,
      items: (r?.items || []).map((i: any) => this.normManufacturingMaterialItem(i))
    };
  }

  private normProductionEntry(r: any): ProductionEntry {
    return {
      id: r?.id,
      production_number: r?.productionNumber || r?.production_number || '',
      production_date: r?.productionDate || r?.production_date,
      segment_id: r?.segmentId ?? r?.segment_id,
      segment_name: r?.segmentName || r?.segment_name,
      production_plan_id: r?.productionPlanId ?? r?.production_plan_id,
      production_plan_number: r?.productionPlanNumber || r?.production_plan_number,
      finished_product_id: r?.finishedProductId ?? r?.finished_product_id,
      finished_product_name: r?.finishedProductName || r?.finished_product_name,
      produced_qty: Number(r?.producedQty ?? r?.produced_qty ?? 0),
      rejected_qty: Number(r?.rejectedQty ?? r?.rejected_qty ?? 0),
      wastage_qty: Number(r?.wastageQty ?? r?.wastage_qty ?? 0),
      production_cost: Number(r?.productionCost ?? r?.production_cost ?? 0),
      to_branch_id: r?.toBranchId ?? r?.to_branch_id,
      to_branch_name: r?.toBranchName || r?.to_branch_name,
      to_warehouse_id: r?.toWarehouseId ?? r?.to_warehouse_id,
      to_warehouse_name: r?.toWarehouseName || r?.to_warehouse_name,
      batch_no: r?.batchNo || r?.batch_no,
      remarks: r?.remarks,
      status: r?.status || 'draft',
      created_at: r?.createdAt || r?.created_at,
      items: (r?.items || []).map((i: any) => ({
        ...this.normManufacturingMaterialItem(i),
        planned_qty: Number(i?.plannedQty ?? i?.planned_qty ?? 0),
        produced_qty: Number(i?.producedQty ?? i?.produced_qty ?? 0),
        rejected_qty: Number(i?.rejectedQty ?? i?.rejected_qty ?? 0),
        wastage_qty: Number(i?.wastageQty ?? i?.wastage_qty ?? 0),
        production_cost: Number(i?.productionCost ?? i?.production_cost ?? 0)
      }))
    };
  }

  private normProductionReturn(r: any): ProductionReturn {
    return {
      id: r?.id,
      return_number: r?.returnNumber || r?.return_number || '',
      return_date: r?.returnDate || r?.return_date,
      segment_id: r?.segmentId ?? r?.segment_id,
      segment_name: r?.segmentName || r?.segment_name,
      material_issue_id: r?.materialIssueId ?? r?.material_issue_id,
      material_issue_number: r?.materialIssueNumber || r?.material_issue_number,
      production_plan_id: r?.productionPlanId ?? r?.production_plan_id,
      production_plan_number: r?.productionPlanNumber || r?.production_plan_number,
      to_branch_id: r?.toBranchId ?? r?.to_branch_id,
      to_branch_name: r?.toBranchName || r?.to_branch_name,
      to_warehouse_id: r?.toWarehouseId ?? r?.to_warehouse_id,
      to_warehouse_name: r?.toWarehouseName || r?.to_warehouse_name,
      reason: r?.reason,
      remarks: r?.remarks,
      total_qty: Number(r?.totalQty ?? r?.total_qty ?? 0),
      status: r?.status || 'draft',
      created_at: r?.createdAt || r?.created_at,
      items: (r?.items || []).map((i: any) => this.normManufacturingMaterialItem(i))
    };
  }

  private normStockAdjustment(r: any): StockAdjustment {
    return {
      id: r?.id, adjustment_number: r?.adjustmentNumber || r?.adjustment_number || '',
      adjustment_date: r?.adjustmentDate || r?.adjustment_date,
      segment_id: r?.segmentId ?? r?.segment_id,
      segment_name: r?.segmentName || r?.segment_name,
      branch_id: r?.branchId ?? r?.branch_id,
      branch_name: r?.branchName || r?.branch_name,
      warehouse_id: r?.warehouseId ?? r?.warehouse_id,
      warehouse_name: r?.warehouseName || r?.warehouse_name,
      adjustment_type: r?.adjustmentType || r?.adjustment_type || 'Increase',
      reason: r?.reason,
      remarks: r?.remarks,
      total_qty: Number(r?.totalQty ?? r?.total_qty ?? 0),
      status: r?.status || 'pending_approval',
      approved_by: r?.approvedBy ?? r?.approved_by,
      approved_at: r?.approvedAt || r?.approved_at,
      created_at: r?.createdAt || r?.created_at,
      items: (r?.items || []).map((i: any) => ({
        id: i.id, sno: i.sno || 1,
        product_id: i.productId ?? i.product_id,
        product_name: i.productName || i.product_name || '',
        product_code: i.productCode || i.product_code,
        variant_id: i.variantId ?? i.variant_id,
        variant_name: i.variantName || i.variant_name,
        attribute_id: i.attributeId ?? i.attribute_id,
        attribute_name: i.attributeName || i.attribute_name,
        attribute_value: i.attributeValue || i.attribute_value,
        uom_id: i.uomId ?? i.uom_id,
        uom_name: i.uomName || i.uom_name,
        qty: Number(i.qty || 0),
        batch_no: i.batchNo || i.batch_no,
        serial_no: i.serialNo || i.serial_no,
        serial_numbers: i.serialNumbers ?? i.serial_numbers ?? null,
        remarks: i.remarks
      }))
    };
  }

  private normOpeningStockEntry(r: any): OpeningStockEntry {
    return {
      id: r?.id, entry_number: r?.entryNumber || r?.entry_number || '',
      entry_date: r?.entryDate || r?.entry_date,
      segment_id: r?.segmentId ?? r?.segment_id,
      segment_name: r?.segmentName || r?.segment_name,
      branch_id: r?.branchId ?? r?.branch_id,
      branch_name: r?.branchName || r?.branch_name,
      warehouse_id: r?.warehouseId ?? r?.warehouse_id,
      warehouse_name: r?.warehouseName || r?.warehouse_name,
      remarks: r?.remarks,
      total_value: Number(r?.totalValue ?? r?.total_value ?? 0),
      status: r?.status || 'draft', created_at: r?.createdAt || r?.created_at,
      items: (r?.items || []).map((i: any) => ({
        id: i.id, sno: i.sno || 1,
        product_id: i.productId ?? i.product_id,
        product_name: i.productName || i.product_name || '',
        product_code: i.productCode || i.product_code,
        variant_id: i.variantId ?? i.variant_id,
        variant_name: i.variantName || i.variant_name,
        attribute_id: i.attributeId ?? i.attribute_id,
        attribute_name: i.attributeName || i.attribute_name,
        attribute_value: i.attributeValue || i.attribute_value,
        uom_id: i.uomId ?? i.uom_id,
        uom_name: i.uomName || i.uom_name,
        qty: Number(i.qty || 0), rate: Number(i.rate || 0), amount: Number(i.amount || 0),
        batch_no: i.batchNo || i.batch_no,
        serial_no: i.serialNo || i.serial_no,
        serial_numbers: i.serialNumbers ?? i.serial_numbers ?? null,
        remarks: i.remarks
      }))
    };
  }

  private normCycleCount(r: any): CycleCount {
    return {
      id: r?.id, verification_number: r?.verificationNumber || r?.verification_number || '',
      verification_date: r?.verificationDate || r?.verification_date,
      segment_id: r?.segmentId ?? r?.segment_id,
      segment_name: r?.segmentName || r?.segment_name,
      warehouse_id: r?.warehouseId ?? r?.warehouse_id,
      warehouse_name: r?.warehouseName || r?.warehouse_name,
      verified_by_name: r?.verifiedByName || r?.verified_by_name,
      product_category_id: r?.productCategoryId ?? r?.product_category_id,
      remarks: r?.remarks,
      total_items: Number(r?.totalItems ?? r?.total_items ?? 0),
      variance_items: Number(r?.varianceItems ?? r?.variance_items ?? 0),
      status: r?.status || 'pending_approval',
      approved_by: r?.approvedBy ?? r?.approved_by,
      approved_at: r?.approvedAt || r?.approved_at,
      created_at: r?.createdAt || r?.created_at,
      items: (r?.items || []).map((i: any) => ({
        id: i.id, sno: i.sno || 1,
        product_id: i.productId ?? i.product_id,
        product_name: i.productName || i.product_name || '',
        product_code: i.productCode || i.product_code,
        variant_id: i.variantId ?? i.variant_id,
        variant_name: i.variantName || i.variant_name,
        attribute_id: i.attributeId ?? i.attribute_id,
        attribute_name: i.attributeName || i.attribute_name,
        attribute_value: i.attributeValue || i.attribute_value,
        uom_id: i.uomId ?? i.uom_id,
        uom_name: i.uomName || i.uom_name,
        system_qty: Number(i.systemQty ?? i.system_qty ?? 0),
        physical_qty: Number(i.physicalQty ?? i.physical_qty ?? 0),
        variance_qty: Number(i.varianceQty ?? i.variance_qty ?? 0),
        reason: i.reason,
        remarks: i.remarks
      }))
    };
  }

  private normGrn(r: any): Grn {
    return {
      id: r?.id, grn_number: r?.grnNumber || r?.grn_number || '',
      grn_date: r?.grnDate || r?.grn_date,
      segment_id: r?.segmentId ?? r?.segment_id,
      segment_name: r?.segmentName || r?.segment_name,
      branch_id: r?.branchId ?? r?.branch_id,
      branch_name: r?.branchName || r?.branch_name,
      warehouse_id: r?.warehouseId ?? r?.warehouse_id,
      warehouse_name: r?.warehouseName || r?.warehouse_name,
      vendor_id: r?.vendorId ?? r?.vendor_id,
      vendor_name: r?.vendorName || r?.vendor_name,
      vendor_gstin: r?.vendorGstin || r?.vendor_gstin,
      rfq_id: r?.rfqId || r?.rfq_id, rfq_number: r?.rfqNumber || r?.rfq_number,
      vendor_invoice_no: r?.vendorInvoiceNo || r?.vendor_invoice_no,
      vendor_invoice_dt: r?.vendorInvoiceDt || r?.vendor_invoice_dt,
      transport_details: r?.transportDetails || r?.transport_details,
      remarks: r?.remarks,
      subtotal: Number(r?.subtotal || 0), tax_amount: Number(r?.taxAmount || r?.tax_amount || 0),
      total_amount: Number(r?.totalAmount || r?.total_amount || 0),
      status: r?.status || 'draft', created_at: r?.createdAt || r?.created_at,
      items: (r?.items || []).map((i: any) => ({
        id: i.id, sno: i.sno || 1,
        product_id: i.productId ?? i.product_id,
        product_name: i.productName || i.product_name || '',
        product_code: i.productCode || i.product_code,
        variant_id: i.variantId ?? i.variant_id,
        variant_name: i.variantName || i.variant_name,
        attribute_id: i.attributeId ?? i.attribute_id,
        attribute_name: i.attributeName || i.attribute_name,
        attribute_value: i.attributeValue || i.attribute_value,
        uom_id: i.uomId ?? i.uom_id,
        uom_name: i.uomName || i.uom_name,
        order_qty: Number(i.orderQty || i.order_qty || i.receivedQty || i.received_qty || 0),
        received_qty: Number(i.receivedQty || i.received_qty || 0),
        accepted_qty: Number(i.acceptedQty || i.accepted_qty || 0),
        rejected_qty: Number(i.rejectedQty || i.rejected_qty || 0),
        rate: Number(i.rate || 0), discount_pct: Number(i.discountPct || i.discount_pct || 0),
        gst_rate: Number(i.gstRate || i.gst_rate || 0),
        gst_inclusive: !!(i.gstInclusive ?? i.gst_inclusive),
        taxable_amount: Number(i.taxableAmount ?? i.taxable_amount ?? 0),
        tax_amount: Number(i.taxAmount ?? i.tax_amount ?? i.gstAmount ?? i.gst_amount ?? 0),
        amount: Number(i.amount || 0),
        batch_no: i.batchNo || i.batch_no, serial_no: i.serialNo || i.serial_no,
        serial_numbers: i.serialNumbers ?? i.serial_numbers ?? null,
        expiry_date: i.expiryDate || i.expiry_date, remarks: i.remarks
      }))
    };
  }

  private normPi(r: any): PurchaseInvoice {
    return {
      id: r?.id, pi_number: r?.piNumber || r?.pi_number || '',
      pi_date: r?.piDate || r?.pi_date,
      segment_id: r?.segmentId ?? r?.segment_id,
      segment_name: r?.segmentName || r?.segment_name,
      vendor_id: r?.vendorId ?? r?.vendor_id,
      vendor_name: r?.vendorName || r?.vendor_name,
      vendor_gstin: r?.vendorGstin || r?.vendor_gstin,
      grn_id: r?.grnId || r?.grn_id, grn_number: r?.grnNumber || r?.grn_number,
      branch_id: r?.branchId ?? r?.branch_id,
      branch_name: r?.branchName || r?.branch_name,
      warehouse_id: r?.warehouseId ?? r?.warehouse_id,
      warehouse_name: r?.warehouseName || r?.warehouse_name,
      vendor_invoice_no: r?.vendorInvoiceNo || r?.vendor_invoice_no,
      vendor_invoice_dt: r?.vendorInvoiceDt || r?.vendor_invoice_dt,
      due_date: r?.dueDate || r?.due_date,
      payment_terms: r?.paymentTerms || r?.payment_terms,
      remarks: r?.remarks,
      subtotal: Number(r?.subtotal || 0), tax_amount: Number(r?.taxAmount || r?.tax_amount || 0),
      total_amount: Number(r?.totalAmount || r?.total_amount || 0),
      status: r?.status || 'draft', created_at: r?.createdAt || r?.created_at,
      items: (r?.items || []).map((i: any) => ({
        id: i.id, sno: i.sno || 1,
        product_id: i.productId ?? i.product_id,
        product_name: i.productName || i.product_name || '',
        product_code: i.productCode || i.product_code,
        variant_id: i.variantId ?? i.variant_id,
        variant_name: i.variantName || i.variant_name,
        attribute_id: i.attributeId ?? i.attribute_id,
        attribute_name: i.attributeName || i.attribute_name,
        attribute_value: i.attributeValue || i.attribute_value,
        uom_id: i.uomId ?? i.uom_id,
        uom_name: i.uomName || i.uom_name,
        qty: Number(i.qty || 0), rate: Number(i.rate || 0),
        mrp: Number(i.mrp ?? i.Mrp ?? 0),
        selling_price: Number(i.sellingPrice ?? i.selling_price ?? 0),
        discount_pct: Number(i.discountPct || i.discount_pct || 0),
        gst_rate: Number(i.gstRate || i.gst_rate || 0),
        gst_inclusive: !!(i.gstInclusive ?? i.gst_inclusive),
        taxable_amount: Number(i.taxableAmount ?? i.taxable_amount ?? 0),
        tax_amount: Number(i.taxAmount ?? i.tax_amount ?? i.gstAmount ?? i.gst_amount ?? 0),
        batch_no: i.batchNo || i.batch_no,
        serial_no: i.serialNo || i.serial_no,
        serial_numbers: i.serialNumbers ?? i.serial_numbers ?? null,
        expiry_date: i.expiryDate || i.expiry_date,
        amount: Number(i.amount || 0), remarks: i.remarks
      }))
    };
  }

  // ── API methods ───────────────────────────────────────────────────────────────

  private normPurchaseInvoiceAttachment(r: any): PurchaseInvoiceAttachment {
    return {
      id: Number(r?.id || 0),
      purchaseInvoiceId: Number(r?.purchaseInvoiceId ?? r?.purchase_invoice_id ?? 0),
      fileKey: r?.fileKey || r?.file_key || '',
      fileName: r?.fileName || r?.file_name || '',
      contentType: r?.contentType ?? r?.content_type ?? null,
      fileSizeBytes: r?.fileSizeBytes ?? r?.file_size_bytes ?? null,
      uploadedBy: r?.uploadedBy ?? r?.uploaded_by ?? null,
      uploadedByName: r?.uploadedByName ?? r?.uploaded_by_name ?? null,
      createdAt: r?.createdAt ?? r?.created_at ?? null
    };
  }

  getPurchaseRequisitions(status?: string, segmentId?: number | null): Observable<ApiResponse<PurchaseRequisition[]>> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (segmentId) params = params.set('segmentId', String(segmentId));
    return this.mapArray(
      this.http.get<ApiResponse<any[]>>(this.url('purchase-requisitions'), { headers: this.headers(), params }),
      r => this.normPr(r)
    );
  }

  savePurchaseRequisition(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<PurchaseRequisition>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.url(`purchase-requisitions/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.url('purchase-requisitions'), body, { headers: h }),
      r => this.normPr(r)
    );
  }

  getRfqs(status?: string, segmentId?: number | null): Observable<ApiResponse<Rfq[]>> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (segmentId) params = params.set('segmentId', String(segmentId));
    return this.mapArray(
      this.http.get<ApiResponse<any[]>>(this.url('rfq'), { headers: this.headers(), params }),
      r => this.normRfq(r)
    );
  }

  saveRfq(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<Rfq>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.url(`rfq/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.url('rfq'), body, { headers: h }),
      r => this.normRfq(r)
    );
  }

  getGrns(status?: string, segmentId?: number | null): Observable<ApiResponse<Grn[]>> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (segmentId) params = params.set('segmentId', String(segmentId));
    return this.mapArray(
      this.http.get<ApiResponse<any[]>>(this.url('grn'), { headers: this.headers(), params }),
      r => this.normGrn(r)
    );
  }

  saveGrn(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<Grn>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.url(`grn/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.url('grn'), body, { headers: h }),
      r => this.normGrn(r)
    );
  }

  getStockTransfers(status?: string, segmentId?: number | null): Observable<ApiResponse<StockTransfer[]>> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (segmentId) params = params.set('segmentId', String(segmentId));
    return this.mapArray(
      this.http.get<ApiResponse<any[]>>(this.url('stock-transfers'), { headers: this.headers(), params }),
      r => this.normStockTransfer(r)
    );
  }

  saveStockTransfer(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<StockTransfer>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.url(`stock-transfers/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.url('stock-transfers'), body, { headers: h }),
      r => this.normStockTransfer(r)
    );
  }

  getProductionPlans(status?: string, segmentId?: number | null): Observable<ApiResponse<ProductionPlan[]>> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (segmentId) params = params.set('segmentId', String(segmentId));
    return this.mapArray(
      this.http.get<ApiResponse<any[]>>(this.url('production-plans'), { headers: this.headers(), params }),
      r => this.normProductionPlan(r)
    );
  }

  saveProductionPlan(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<ProductionPlan>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.url(`production-plans/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.url('production-plans'), body, { headers: h }),
      r => this.normProductionPlan(r)
    );
  }

  getMaterialIssueProductions(status?: string, segmentId?: number | null): Observable<ApiResponse<MaterialIssueProduction[]>> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (segmentId) params = params.set('segmentId', String(segmentId));
    return this.mapArray(
      this.http.get<ApiResponse<any[]>>(this.url('material-issues-production'), { headers: this.headers(), params }),
      r => this.normMaterialIssueProduction(r)
    );
  }

  saveMaterialIssueProduction(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<MaterialIssueProduction>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.url(`material-issues-production/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.url('material-issues-production'), body, { headers: h }),
      r => this.normMaterialIssueProduction(r)
    );
  }

  getProductionEntries(status?: string, segmentId?: number | null): Observable<ApiResponse<ProductionEntry[]>> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (segmentId) params = params.set('segmentId', String(segmentId));
    return this.mapArray(
      this.http.get<ApiResponse<any[]>>(this.url('production-entries'), { headers: this.headers(), params }),
      r => this.normProductionEntry(r)
    );
  }

  saveProductionEntry(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<ProductionEntry>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.url(`production-entries/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.url('production-entries'), body, { headers: h }),
      r => this.normProductionEntry(r)
    );
  }

  getProductionReturns(status?: string, segmentId?: number | null): Observable<ApiResponse<ProductionReturn[]>> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (segmentId) params = params.set('segmentId', String(segmentId));
    return this.mapArray(
      this.http.get<ApiResponse<any[]>>(this.url('production-returns'), { headers: this.headers(), params }),
      r => this.normProductionReturn(r)
    );
  }

  saveProductionReturn(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<ProductionReturn>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.url(`production-returns/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.url('production-returns'), body, { headers: h }),
      r => this.normProductionReturn(r)
    );
  }

  getStockAdjustments(status?: string, segmentId?: number | null): Observable<ApiResponse<StockAdjustment[]>> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (segmentId) params = params.set('segmentId', String(segmentId));
    return this.mapArray(
      this.http.get<ApiResponse<any[]>>(this.url('stock-adjustments'), { headers: this.headers(), params }),
      r => this.normStockAdjustment(r)
    );
  }

  saveStockAdjustment(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<StockAdjustment>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.url(`stock-adjustments/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.url('stock-adjustments'), body, { headers: h }),
      r => this.normStockAdjustment(r)
    );
  }

  getOpeningStockEntries(status?: string, segmentId?: number | null): Observable<ApiResponse<OpeningStockEntry[]>> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (segmentId) params = params.set('segmentId', String(segmentId));
    return this.mapArray(
      this.http.get<ApiResponse<any[]>>(this.url('opening-stock-entries'), { headers: this.headers(), params }),
      r => this.normOpeningStockEntry(r)
    );
  }

  saveOpeningStockEntry(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<OpeningStockEntry>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.url(`opening-stock-entries/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.url('opening-stock-entries'), body, { headers: h }),
      r => this.normOpeningStockEntry(r)
    );
  }

  getCycleCounts(status?: string, segmentId?: number | null): Observable<ApiResponse<CycleCount[]>> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (segmentId) params = params.set('segmentId', String(segmentId));
    return this.mapArray(
      this.http.get<ApiResponse<any[]>>(this.url('cycle-counts'), { headers: this.headers(), params }),
      r => this.normCycleCount(r)
    );
  }

  saveCycleCount(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<CycleCount>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.url(`cycle-counts/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.url('cycle-counts'), body, { headers: h }),
      r => this.normCycleCount(r)
    );
  }

  getPurchaseInvoices(status?: string, segmentId?: number | null): Observable<ApiResponse<PurchaseInvoice[]>> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (segmentId) params = params.set('segmentId', String(segmentId));
    return this.mapArray(
      this.http.get<ApiResponse<any[]>>(this.url('purchase-invoices'), { headers: this.headers(), params }),
      r => this.normPi(r)
    );
  }

  savePurchaseInvoice(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<PurchaseInvoice>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.url(`purchase-invoices/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.url('purchase-invoices'), body, { headers: h }),
      r => this.normPi(r)
    );
  }

  private normPo(r: any): PurchaseOrder {
    return {
      id: r?.id, po_number: r?.poNumber || r?.po_number || '',
      po_date: r?.poDate || r?.po_date,
      expected_delivery: r?.expectedDelivery || r?.expected_delivery,
      segment_id: r?.segmentId ?? r?.segment_id,
      segment_name: r?.segmentName || r?.segment_name,
      rfq_id: r?.rfqId || r?.rfq_id,
      rfq_number: r?.rfqNumber || r?.rfq_number,
      vendor_id: r?.vendorId ?? r?.vendor_id,
      vendor_name: r?.vendorName || r?.vendor_name,
      vendor_gstin: r?.vendorGstin || r?.vendor_gstin,
      warehouse_id: r?.warehouseId ?? r?.warehouse_id,
      warehouse_name: r?.warehouseName || r?.warehouse_name,
      currency: r?.currency || 'INR',
      payment_terms: r?.paymentTerms || r?.payment_terms,
      reference_no: r?.referenceNo || r?.reference_no,
      terms_conditions: r?.termsConditions || r?.terms_conditions,
      subtotal: Number(r?.subtotal || 0),
      tax_amount: Number(r?.taxAmount || r?.tax_amount || 0),
      total_amount: Number(r?.totalAmount || r?.total_amount || 0),
      status: r?.status || 'draft', created_at: r?.createdAt || r?.created_at,
      items: (r?.items || []).map((i: any) => ({
        id: i.id, sno: i.sno || 1,
        product_id: i.productId ?? i.product_id,
        product_name: i.productName || i.product_name || '',
        product_code: i.productCode || i.product_code,
        variant_id: i.variantId ?? i.variant_id,
        variant_name: i.variantName || i.variant_name,
        attribute_id: i.attributeId ?? i.attribute_id,
        attribute_name: i.attributeName || i.attribute_name,
        attribute_value: i.attributeValue || i.attribute_value,
        uom_id: i.uomId ?? i.uom_id,
        uom_name: i.uomName || i.uom_name,
        qty: Number(i.qty || 0),
        rate: Number(i.rate || 0),
        discount_pct: Number(i.discountPct || i.discount_pct || 0),
        gst_rate: Number(i.gstRate || i.gst_rate || 0),
        gst_inclusive: !!(i.gstInclusive ?? i.gst_inclusive),
        taxable_amount: Number(i.taxableAmount ?? i.taxable_amount ?? 0),
        tax_amount: Number(i.taxAmount ?? i.tax_amount ?? i.gstAmount ?? i.gst_amount ?? 0),
        warehouse_name: i.warehouseName || i.warehouse_name,
        amount: Number(i.amount || 0)
      }))
    };
  }

  getPurchaseOrders(status?: string, segmentId?: number | null): Observable<ApiResponse<PurchaseOrder[]>> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (segmentId) params = params.set('segmentId', String(segmentId));
    return this.mapArray(
      this.http.get<ApiResponse<any[]>>(this.url('purchase-orders'), { headers: this.headers(), params }),
      r => this.normPo(r)
    );
  }

  savePurchaseOrder(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<PurchaseOrder>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.url(`purchase-orders/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.url('purchase-orders'), body, { headers: h }),
      r => this.normPo(r)
    );
  }

  cancelDoc(docType: string, docId: number, reason?: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      this.url('cancel'),
      this.toApiValue({ doc_type: docType, doc_id: docId, reason }),
      { headers: this.headers() }
    );
  }

  // ── Sales transactions ────────────────────────────────────────────────────────

  private salesUrl(path: string): string { return `${this.base()}/inventory/sales/${path}`; }

  private normSalesItem(i: any) {
    return {
      id: i.id, sno: i.sno || 1,
      product_id: i.productId ?? i.product_id,
      product_name: i.productName || i.product_name || '',
      product_code: i.productCode || i.product_code,
      variant_id: i.variantId ?? i.variant_id,
      variant_name: i.variantName || i.variant_name,
      uom_id: i.uomId ?? i.uom_id,
      uom_name: i.uomName || i.uom_name,
      attribute_name: i.attributeName || i.attribute_name,
      attribute_value: i.attributeValue || i.attribute_value,
      qty: Number(i.qty || 0), rate: Number(i.rate || 0),
      discount_pct: Number(i.discountPct || i.discount_pct || 0),
      gst_rate: Number(i.gstRate || i.gst_rate || 0),
      gst_inclusive: !!(i.gstInclusive ?? i.gst_inclusive),
      taxable_amount: Number(i.taxableAmount ?? i.taxable_amount ?? 0),
      tax_amount: Number(i.taxAmount ?? i.tax_amount ?? i.gstAmount ?? i.gst_amount ?? 0),
      amount: Number(i.amount || 0), remarks: i.remarks
    };
  }

  private normEstimation(r: any) {
    return {
      id: r?.id, doc_number: r?.docNumber || r?.doc_number || '',
      doc_date: r?.docDate || r?.doc_date,
      valid_till: r?.validTill || r?.valid_till,
      segment_id: r?.segmentId ?? r?.segment_id,
      segment_name: r?.segmentName || r?.segment_name,
      customer_id: r?.customerId ?? r?.customer_id,
      customer_name: r?.customerName || r?.customer_name,
      reference_no: r?.referenceNo || r?.reference_no,
      payment_terms: r?.paymentTerms || r?.payment_terms,
      remarks: r?.remarks, status: r?.status || 'draft',
      created_at: r?.createdAt || r?.created_at,
      items: (r?.items || []).map((i: any) => this.normSalesItem(i))
    };
  }

  getEstimations(status?: string, segmentId?: number | null): Observable<ApiResponse<any[]>> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (segmentId) params = params.set('segmentId', String(segmentId));
    return this.http.get<ApiResponse<any[]>>(this.salesUrl('estimations'), { headers: this.headers(), params }).pipe(
      map(res => ({ ...res, data: (res.data ?? []).map(r => this.normEstimation(r)) }))
    );
  }

  saveEstimation(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<any>> {
    const h = this.headers(); const body = this.toApiValue(payload);
    return id
      ? this.http.put<ApiResponse<any>>(this.salesUrl(`estimations/${id}`), body, { headers: h })
      : this.http.post<ApiResponse<any>>(this.salesUrl('estimations'), body, { headers: h });
  }

  private normProforma(r: any) {
    return {
      id: r?.id, doc_number: r?.docNumber || r?.doc_number || '',
      doc_date: r?.docDate || r?.doc_date, valid_till: r?.validTill || r?.valid_till,
      segment_id: r?.segmentId ?? r?.segment_id, segment_name: r?.segmentName || r?.segment_name,
      estimation_number: r?.estimationNumber || r?.estimation_number,
      customer_id: r?.customerId ?? r?.customer_id, customer_name: r?.customerName || r?.customer_name,
      payment_terms: r?.paymentTerms || r?.payment_terms, place_of_supply: r?.placeOfSupply || r?.place_of_supply,
      reference_no: r?.referenceNo || r?.reference_no,
      remarks: r?.remarks, status: r?.status || 'draft', created_at: r?.createdAt || r?.created_at,
      items: (r?.items || []).map((i: any) => this.normSalesItem(i))
    };
  }

  getProformaInvoices(status?: string, segmentId?: number | null): Observable<ApiResponse<any[]>> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (segmentId) params = params.set('segmentId', String(segmentId));
    return this.http.get<ApiResponse<any[]>>(this.salesUrl('proforma-invoices'), { headers: this.headers(), params }).pipe(
      map(res => ({ ...res, data: (res.data ?? []).map(r => this.normProforma(r)) }))
    );
  }

  saveProformaInvoice(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<any>> {
    const h = this.headers(); const body = this.toApiValue(payload);
    return id
      ? this.http.put<ApiResponse<any>>(this.salesUrl(`proforma-invoices/${id}`), body, { headers: h })
      : this.http.post<ApiResponse<any>>(this.salesUrl('proforma-invoices'), body, { headers: h });
  }

  private normSalesInvoice(r: any) {
    return {
      id: r?.id, doc_number: r?.docNumber || r?.doc_number || '',
      doc_date: r?.docDate || r?.doc_date, due_date: r?.dueDate || r?.due_date,
      segment_id: r?.segmentId ?? r?.segment_id, segment_name: r?.segmentName || r?.segment_name,
      proforma_number: r?.proformaNumber || r?.proforma_number,
      so_id: r?.soId ?? r?.so_id, so_number: r?.soNumber || r?.so_number,
      reference_no: r?.referenceNo || r?.reference_no,
      customer_id: r?.customerId ?? r?.customer_id, customer_name: r?.customerName || r?.customer_name,
      customer_gstin: r?.customerGstin || r?.customer_gstin,
      channel_partner_id: r?.channelPartnerId ?? r?.channel_partner_id,
      channel_partner_name: r?.channelPartnerName || r?.channel_partner_name,
      // Lead By (Sales Invoice, migration 253).
      lead_by_contact_id: r?.leadByContactId ?? r?.lead_by_contact_id,
      lead_by_name: r?.leadByName || r?.lead_by_name,
      place_of_supply: r?.placeOfSupply || r?.place_of_supply,
      warehouse_id: r?.warehouseId ?? r?.warehouse_id,
      warehouse_name: r?.warehouseName || r?.warehouse_name, payment_terms: r?.paymentTerms || r?.payment_terms,
      remarks: r?.remarks, status: r?.status || 'draft', created_at: r?.createdAt || r?.created_at,
      items: (r?.items || []).map((i: any) => ({
        ...this.normSalesItem(i),
        batch_no: i.batchNo || i.batch_no, serial_no: i.serialNo || i.serial_no,
        serial_numbers: i.serialNumbers ?? i.serial_numbers ?? null,
        expiry_date: i.expiryDate || i.expiry_date,
        warehouse_name: i.warehouseName || i.warehouse_name,
        so_item_id: i.soItemId ?? i.so_item_id, dc_item_id: i.dcItemId ?? i.dc_item_id
      }))
    };
  }

  getSalesInvoices(status?: string, segmentId?: number | null): Observable<ApiResponse<any[]>> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (segmentId) params = params.set('segmentId', String(segmentId));
    return this.http.get<ApiResponse<any[]>>(this.salesUrl('invoices'), { headers: this.headers(), params }).pipe(
      map(res => ({ ...res, data: (res.data ?? []).map(r => this.normSalesInvoice(r)) }))
    );
  }

  saveSalesInvoice(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<any>> {
    const h = this.headers(); const body = this.toApiValue(payload);
    return id
      ? this.http.put<ApiResponse<any>>(this.salesUrl(`invoices/${id}`), body, { headers: h })
      : this.http.post<ApiResponse<any>>(this.salesUrl('invoices'), body, { headers: h });
  }

  private normServiceBundleConsumption(r: any): ServiceBundleConsumption {
    return {
      id: r?.id,
      company_id: r?.companyId ?? r?.company_id,
      invoice_id: r?.invoiceId ?? r?.invoice_id,
      invoice_number: r?.invoiceNumber || r?.invoice_number,
      invoice_item_id: r?.invoiceItemId ?? r?.invoice_item_id,
      bundle_product_id: r?.bundleProductId ?? r?.bundle_product_id,
      bundle_product_name: r?.bundleProductName || r?.bundle_product_name || '',
      warehouse_id: r?.warehouseId ?? r?.warehouse_id,
      warehouse_name: r?.warehouseName || r?.warehouse_name,
      consumption_date: r?.consumptionDate || r?.consumption_date,
      status: r?.status || 'posted',
      created_at: r?.createdAt || r?.created_at,
      items: (r?.items || []).map((i: any) => ({
        id: i?.id,
        item_id: i?.itemId ?? i?.item_id,
        item_name: i?.itemName || i?.item_name || '',
        item_nature: i?.itemNature || i?.item_nature,
        quantity_per_bundle: Number(i?.quantityPerBundle ?? i?.quantity_per_bundle ?? 0),
        bundle_qty: Number(i?.bundleQty ?? i?.bundle_qty ?? 0),
        required_qty: Number(i?.requiredQty ?? i?.required_qty ?? 0),
        issued_qty: Number(i?.issuedQty ?? i?.issued_qty ?? 0),
        shortfall_qty: Number(i?.shortfallQty ?? i?.shortfall_qty ?? 0),
        stock_before: i?.stockBefore ?? i?.stock_before,
        stock_after: i?.stockAfter ?? i?.stock_after,
        stock_posted: !!(i?.stockPosted ?? i?.stock_posted),
        cost_rate: Number(i?.costRate ?? i?.cost_rate ?? 0),
        cost_amount: Number(i?.costAmount ?? i?.cost_amount ?? 0),
        remarks: i?.remarks,
        status: i?.status || 'posted'
      }))
    };
  }

  getServiceBundleConsumptions(invoiceId: number): Observable<ApiResponse<ServiceBundleConsumption[]>> {
    return this.http.get<ApiResponse<any[]>>(this.salesUrl(`invoices/${invoiceId}/bundle-consumption`), { headers: this.headers() }).pipe(
      map(res => ({ ...res, data: (res.data ?? []).map(r => this.normServiceBundleConsumption(r)) }))
    );
  }

  private normSalesOrder(r: any) {
    const status = String(r?.status || 'draft').toLowerCase() === 'confirmed' ? 'posted' : (r?.status || 'draft');
    return {
      id: r?.id, doc_number: r?.docNumber || r?.doc_number || '',
      doc_date: r?.docDate || r?.doc_date, due_date: r?.dueDate || r?.due_date, delivery_date: r?.deliveryDate || r?.delivery_date,
      segment_id: r?.segmentId ?? r?.segment_id, segment_name: r?.segmentName || r?.segment_name,
      customer_id: r?.customerId ?? r?.customer_id, customer_name: r?.customerName || r?.customer_name,
      channel_partner_id: r?.channelPartnerId ?? r?.channel_partner_id,
      channel_partner_name: r?.channelPartnerName || r?.channel_partner_name,
      payment_terms: r?.paymentTerms || r?.payment_terms,
      remarks: r?.remarks, status, created_at: r?.createdAt || r?.created_at,
      items: (r?.items || []).map((i: any) => this.normSalesItem(i))
    };
  }

  getSalesOrders(status?: string, segmentId?: number | null): Observable<ApiResponse<any[]>> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (segmentId) params = params.set('segmentId', String(segmentId));
    return this.http.get<ApiResponse<any[]>>(this.salesUrl('orders'), { headers: this.headers(), params }).pipe(
      map(res => ({ ...res, data: (res.data ?? []).map(r => this.normSalesOrder(r)) }))
    );
  }

  saveSalesOrder(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<any>> {
    const h = this.headers(); const body = this.toApiValue(payload);
    return id
      ? this.http.put<ApiResponse<any>>(this.salesUrl(`orders/${id}`), body, { headers: h })
      : this.http.post<ApiResponse<any>>(this.salesUrl('orders'), body, { headers: h });
  }

  private normSalesQuotation(r: any) {
    return {
      id: r?.id, doc_number: r?.docNumber || r?.doc_number || '',
      doc_date: r?.docDate || r?.doc_date, valid_till: r?.validTill || r?.valid_till,
      segment_id: r?.segmentId ?? r?.segment_id, segment_name: r?.segmentName || r?.segment_name,
      customer_id: r?.customerId ?? r?.customer_id, customer_name: r?.customerName || r?.customer_name,
      payment_terms: r?.paymentTerms || r?.payment_terms, reference_no: r?.referenceNo || r?.reference_no,
      remarks: r?.remarks, status: r?.status || 'draft', created_at: r?.createdAt || r?.created_at,
      items: (r?.items || []).map((i: any) => this.normSalesItem(i))
    };
  }

  getSalesQuotations(status?: string, segmentId?: number | null): Observable<ApiResponse<any[]>> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (segmentId) params = params.set('segmentId', String(segmentId));
    return this.http.get<ApiResponse<any[]>>(this.salesUrl('quotations'), { headers: this.headers(), params }).pipe(
      map(res => ({ ...res, data: (res.data ?? []).map(r => this.normSalesQuotation(r)) }))
    );
  }

  saveSalesQuotation(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<any>> {
    const h = this.headers(); const body = this.toApiValue(payload);
    return id
      ? this.http.put<ApiResponse<any>>(this.salesUrl(`quotations/${id}`), body, { headers: h })
      : this.http.post<ApiResponse<any>>(this.salesUrl('quotations'), body, { headers: h });
  }

  cancelSalesDoc(docType: string, docId: number): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      this.salesUrl('cancel'),
      this.toApiValue({ doc_type: docType, doc_id: docId }),
      { headers: this.headers() }
    );
  }

  // ── Purchase Return ──────────────────────────────────────────────────────────

  private normPurchaseReturn(r: any): PurchaseReturn {
    return {
      id: r?.id, return_number: r?.returnNumber || r?.return_number || '',
      return_date: r?.returnDate || r?.return_date,
      segment_id: r?.segmentId ?? r?.segment_id,
      segment_name: r?.segmentName || r?.segment_name,
      vendor_id: r?.vendorId ?? r?.vendor_id,
      vendor_name: r?.vendorName || r?.vendor_name,
      pi_id: r?.piId ?? r?.pi_id,
      pi_number: r?.piNumber || r?.pi_number,
      pi_grn_id: r?.piGrnId ?? r?.pi_grn_id,
      debit_note_ref: r?.debitNoteRef || r?.debit_note_ref,
      branch_id: r?.branchId ?? r?.branch_id,
      branch_name: r?.branchName || r?.branch_name,
      warehouse_id: r?.warehouseId ?? r?.warehouse_id,
      warehouse_name: r?.warehouseName || r?.warehouse_name,
      return_reason: r?.returnReason || r?.return_reason,
      remarks: r?.remarks,
      total_amount: r?.totalAmount ?? r?.total_amount ?? 0,
      status: r?.status || 'draft',
      created_at: r?.createdAt || r?.created_at,
      items: (r?.items || []).map((i: any) => ({
        id: i?.id, sno: i?.sno ?? 0,
        product_id: i?.productId ?? i?.product_id,
        product_name: i?.productName || i?.product_name || '',
        product_code: i?.productCode || i?.product_code,
        variant_id: i?.variantId ?? i?.variant_id,
        variant_name: i?.variantName || i?.variant_name,
        attribute_id: i?.attributeId ?? i?.attribute_id,
        attribute_name: i?.attributeName || i?.attribute_name,
        attribute_value: i?.attributeValue || i?.attribute_value,
        uom_name: i?.uomName || i?.uom_name,
        grn_qty: i?.grnQty ?? i?.grn_qty,
        return_qty: i?.returnQty ?? i?.return_qty ?? 0,
        rate: i?.rate ?? 0,
        gst_rate: i?.gstRate ?? i?.gst_rate ?? 0,
        gst_inclusive: !!(i?.gstInclusive ?? i?.gst_inclusive),
        taxable_amount: i?.taxableAmount ?? i?.taxable_amount ?? 0,
        tax_amount: i?.taxAmount ?? i?.tax_amount ?? i?.gstAmount ?? i?.gst_amount ?? 0,
        return_amount: i?.returnAmount ?? i?.return_amount ?? 0,
        return_reason: i?.returnReason || i?.return_reason,
        serial_numbers: i?.serialNumbers ?? i?.serial_numbers ?? null,
        remarks: i?.remarks
      } as PurchaseReturnItem))
    };
  }

  getPurchaseReturns(status?: string, segmentId?: number | null): Observable<ApiResponse<PurchaseReturn[]>> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (segmentId) params = params.set('segmentId', String(segmentId));
    return this.http.get<ApiResponse<any[]>>(this.url('purchase-returns'), { headers: this.headers(), params }).pipe(
      map(res => ({ ...res, data: (res.data ?? []).map(r => this.normPurchaseReturn(r)) }))
    );
  }

  savePurchaseReturn(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<any>> {
    const h = this.headers(); const body = this.toApiValue(payload);
    return id
      ? this.http.put<ApiResponse<any>>(this.url(`purchase-returns/${id}`), body, { headers: h })
      : this.http.post<ApiResponse<any>>(this.url('purchase-returns'), body, { headers: h });
  }

  // ── Debit Note ────────────────────────────────────────────────────────────────

  private normDebitNote(r: any): DebitNote {
    return {
      id: r?.id, debit_note_number: r?.debitNoteNumber || r?.debit_note_number || '',
      debit_note_date: r?.debitNoteDate || r?.debit_note_date,
      segment_id: r?.segmentId ?? r?.segment_id,
      segment_name: r?.segmentName || r?.segment_name,
      vendor_id: r?.vendorId ?? r?.vendor_id,
      vendor_name: r?.vendorName || r?.vendor_name,
      purchase_return_id: r?.purchaseReturnId ?? r?.purchase_return_id,
      purchase_return_number: r?.purchaseReturnNumber || r?.purchase_return_number,
      purchase_invoice_id: r?.purchaseInvoiceId ?? r?.purchase_invoice_id,
      purchase_invoice_number: r?.purchaseInvoiceNumber || r?.purchase_invoice_number,
      reason: r?.reason,
      gst_adjustment: !!(r?.gstAdjustment ?? r?.gst_adjustment),
      remarks: r?.remarks,
      subtotal: r?.subtotal ?? 0,
      tax_amount: r?.taxAmount ?? r?.tax_amount ?? 0,
      total_amount: r?.totalAmount ?? r?.total_amount ?? 0,
      status: r?.status || 'draft',
      created_at: r?.createdAt || r?.created_at,
      items: (r?.items || []).map((i: any) => ({
        id: i?.id, sno: i?.sno ?? 0,
        description: i?.description || '',
        reference: i?.reference,
        amount: i?.amount ?? 0,
        gst_pct: i?.gstPct ?? i?.gst_pct ?? 0,
        gst_amount: i?.gstAmount ?? i?.gst_amount ?? 0,
        total_amount: i?.totalAmount ?? i?.total_amount ?? 0
      } as DebitNoteItem))
    };
  }

  getDebitNotes(status?: string, segmentId?: number | null): Observable<ApiResponse<DebitNote[]>> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (segmentId) params = params.set('segmentId', String(segmentId));
    return this.http.get<ApiResponse<any[]>>(this.url('purchase-debit-notes'), { headers: this.headers(), params }).pipe(
      map(res => ({ ...res, data: (res.data ?? []).map(r => this.normDebitNote(r)) }))
    );
  }

  saveDebitNote(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<any>> {
    const h = this.headers(); const body = this.toApiValue(payload);
    return id
      ? this.http.put<ApiResponse<any>>(this.url(`purchase-debit-notes/${id}`), body, { headers: h })
      : this.http.post<ApiResponse<any>>(this.url('purchase-debit-notes'), body, { headers: h });
  }

  // ── Delivery Challan ─────────────────────────────────────────────────────────

  private normDeliveryChallan(r: any): DeliveryChallan {
    return {
      id: r?.id, dc_number: r?.dcNumber || r?.dc_number || '',
      dc_date: r?.dcDate || r?.dc_date,
      segment_id: r?.segmentId ?? r?.segment_id,
      segment_name: r?.segmentName || r?.segment_name,
      so_id: r?.soId ?? r?.so_id,
      so_number: r?.soNumber || r?.so_number,
      si_id: r?.siId ?? r?.si_id,
      si_number: r?.siNumber || r?.si_number,
      reference_no: r?.referenceNo || r?.reference_no,
      customer_id: r?.customerId ?? r?.customer_id,
      customer_name: r?.customerName || r?.customer_name,
      channel_partner_id: r?.channelPartnerId ?? r?.channel_partner_id,
      channel_partner_name: r?.channelPartnerName || r?.channel_partner_name,
      branch_id: r?.branchId ?? r?.branch_id,
      branch_name: r?.branchName || r?.branch_name,
      from_warehouse_id: r?.fromWarehouseId ?? r?.from_warehouse_id,
      from_warehouse_name: r?.fromWarehouseName || r?.from_warehouse_name,
      vehicle: r?.vehicle, transporter: r?.transporter,
      lr_no: r?.lrNo || r?.lr_no,
      delivery_address: r?.deliveryAddress || r?.delivery_address,
      remarks: r?.remarks, status: r?.status || 'draft',
      display_status: r?.displayStatus || r?.display_status || r?.status || 'draft',
      created_at: r?.createdAt || r?.created_at,
      items: (r?.items || []).map((i: any) => ({
        id: i?.id, sno: i?.sno ?? 0,
        so_item_id: i?.soItemId ?? i?.so_item_id,
        si_item_id: i?.siItemId ?? i?.si_item_id,
        product_id: i?.productId ?? i?.product_id,
        product_name: i?.productName || i?.product_name || '',
        product_code: i?.productCode || i?.product_code,
        variant_id: i?.variantId ?? i?.variant_id,
        variant_name: i?.variantName || i?.variant_name,
        attribute_id: i?.attributeId ?? i?.attribute_id,
        attribute_name: i?.attributeName || i?.attribute_name,
        attribute_value: i?.attributeValue || i?.attribute_value,
        uom_id: i?.uomId ?? i?.uom_id,
        uom_name: i?.uomName || i?.uom_name,
        so_qty: i?.soQty ?? i?.so_qty,
        dispatch_qty: i?.dispatchQty ?? i?.dispatch_qty ?? 0,
        invoiced_qty: i?.invoicedQty ?? i?.invoiced_qty ?? 0,
        batch_serial: i?.batchSerial || i?.batch_serial,
        serial_numbers: i?.serialNumbers ?? i?.serial_numbers ?? null,
        remarks: i?.remarks
      } as DeliveryChallanItem))
    };
  }

  getDeliveryChallans(status?: string, segmentId?: number | null, customerId?: number | null, pendingInvoice?: boolean): Observable<ApiResponse<DeliveryChallan[]>> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (segmentId) params = params.set('segmentId', String(segmentId));
    if (customerId) params = params.set('customerId', String(customerId));
    if (pendingInvoice) params = params.set('pendingInvoice', 'true');
    return this.http.get<ApiResponse<any[]>>(this.salesUrl('delivery-challans'), { headers: this.headers(), params }).pipe(
      map(res => ({ ...res, data: (res.data ?? []).map(r => this.normDeliveryChallan(r)) }))
    );
  }

  getAvailableStock(params: { segmentId?: number | null; productId?: number | null; variantId?: number | null; attributeId?: number | null; attributeValue?: string | null; warehouseId?: number | null; branchId?: number | null }): Observable<ApiResponse<AvailableStock[]>> {
    let httpParams = new HttpParams();
    if (params.segmentId) httpParams = httpParams.set('segmentId', String(params.segmentId));
    if (params.productId) httpParams = httpParams.set('productId', String(params.productId));
    if (params.variantId) httpParams = httpParams.set('variantId', String(params.variantId));
    if (params.attributeId) httpParams = httpParams.set('attributeId', String(params.attributeId));
    if (params.attributeValue) httpParams = httpParams.set('attributeValue', String(params.attributeValue));
    if (params.warehouseId) httpParams = httpParams.set('warehouseId', String(params.warehouseId));
    if (params.branchId) httpParams = httpParams.set('branchId', String(params.branchId));
    return this.http.get<ApiResponse<any[]>>(this.salesUrl('available-stock'), { headers: this.headers(), params: httpParams }).pipe(
      map(res => ({
        ...res, data: (res.data ?? []).map((r: any) => ({
          product_id: r?.productId ?? r?.product_id, variant_id: r?.variantId ?? r?.variant_id,
          attribute_id: r?.attributeId ?? r?.attribute_id,
          warehouse_id: r?.warehouseId ?? r?.warehouse_id,
          product_name: r?.productName || r?.product_name, variant_name: r?.variantName || r?.variant_name,
          attribute_name: r?.attributeName || r?.attribute_name,
          attribute_value: r?.attributeValue || r?.attribute_value,
          warehouse_name: r?.warehouseName || r?.warehouse_name,
          branch_id: r?.branchId ?? r?.branch_id,
          branch_name: r?.branchName || r?.branch_name,
          location_type: r?.locationType || r?.location_type,
          location_id: r?.locationId ?? r?.location_id,
          location_name: r?.locationName || r?.location_name,
          on_hand: Number(r?.onHand ?? r?.on_hand ?? 0),
          pending_dc_qty: Number(r?.pendingDcQty ?? r?.pending_dc_qty ?? 0),
          available: Number(r?.available ?? 0)
        } as AvailableStock))
      }))
    );
  }

  private normSerialUnits(res: ApiResponse<any[]>): ApiResponse<SerialUnit[]> {
    return {
      ...res, data: (res.data ?? []).map((r: any) => ({
        id: r?.id,
        serial_no: r?.serialNo || r?.serial_no,
        // Carried through so the picker can show, read-only, the warranty
        // already fixed on this exact unit when it was received (migration
        // 237) — "warranty should carry at sales by its serial no."
        manufacturing_date: r?.manufacturingDate || r?.manufacturing_date || null,
        warranty_upto: r?.warrantyUpto || r?.warranty_upto || null
      }))
    };
  }

  getAvailableSerials(params: { productId: number; variantId?: number | null; attributeId?: number | null; attributeValue?: string | null; warehouseId?: number | null; branchId?: number | null }): Observable<ApiResponse<SerialUnit[]>> {
    let httpParams = new HttpParams().set('productId', String(params.productId));
    if (params.variantId) httpParams = httpParams.set('variantId', String(params.variantId));
    if (params.attributeId) httpParams = httpParams.set('attributeId', String(params.attributeId));
    if (params.attributeValue) httpParams = httpParams.set('attributeValue', params.attributeValue);
    if (params.warehouseId) httpParams = httpParams.set('warehouseId', String(params.warehouseId));
    if (params.branchId) httpParams = httpParams.set('branchId', String(params.branchId));
    return this.http.get<ApiResponse<any[]>>(this.salesUrl('serials/available'), { headers: this.headers(), params: httpParams }).pipe(
      map(res => this.normSerialUnits(res))
    );
  }

  getReservedSerialsForDcItem(dcItemId: number): Observable<ApiResponse<SerialUnit[]>> {
    const httpParams = new HttpParams().set('dcItemId', String(dcItemId));
    return this.http.get<ApiResponse<any[]>>(this.salesUrl('serials/reserved-for-dc-item'), { headers: this.headers(), params: httpParams }).pipe(
      map(res => this.normSerialUnits(res))
    );
  }

  getSoldSerialsForSiItem(siItemId: number): Observable<ApiResponse<SerialUnit[]>> {
    const httpParams = new HttpParams().set('siItemId', String(siItemId));
    return this.http.get<ApiResponse<any[]>>(this.salesUrl('serials/sold-for-si-item'), { headers: this.headers(), params: httpParams }).pipe(
      map(res => this.normSerialUnits(res))
    );
  }

  getSoldSerialsForReturn(params: { productId: number; invoiceId?: number | null; variantId?: number | null; attributeId?: number | null; attributeValue?: string | null }): Observable<ApiResponse<SerialUnit[]>> {
    let httpParams = new HttpParams().set('productId', String(params.productId));
    if (params.invoiceId) httpParams = httpParams.set('invoiceId', String(params.invoiceId));
    if (params.variantId) httpParams = httpParams.set('variantId', String(params.variantId));
    if (params.attributeId) httpParams = httpParams.set('attributeId', String(params.attributeId));
    if (params.attributeValue) httpParams = httpParams.set('attributeValue', params.attributeValue);
    return this.http.get<ApiResponse<any[]>>(this.salesUrl('serials/sold-for-return'), { headers: this.headers(), params: httpParams }).pipe(
      map(res => this.normSerialUnits(res))
    );
  }

  // Purchase Return side — in-stock serials scoped to the GRN/Purchase
  // Invoice being returned against, so the return auto-binds exactly the
  // units received on that document. variantId/attributeId/attributeValue
  // further narrow to the exact variant/attribute of the row being
  // returned, since one GRN/PI can carry the same product across multiple
  // variants (115_return_serial_variant_scope.sql).
  getInstockSerialsForSource(params: { productId: number; sourceDocType?: string | null; sourceDocId?: number | null; variantId?: number | null; attributeId?: number | null; attributeValue?: string | null }): Observable<ApiResponse<SerialUnit[]>> {
    let httpParams = new HttpParams().set('productId', String(params.productId));
    if (params.sourceDocType) httpParams = httpParams.set('sourceDocType', params.sourceDocType);
    if (params.sourceDocId) httpParams = httpParams.set('sourceDocId', String(params.sourceDocId));
    if (params.variantId) httpParams = httpParams.set('variantId', String(params.variantId));
    if (params.attributeId) httpParams = httpParams.set('attributeId', String(params.attributeId));
    if (params.attributeValue) httpParams = httpParams.set('attributeValue', params.attributeValue);
    return this.http.get<ApiResponse<any[]>>(this.salesUrl('serials/instock-for-source'), { headers: this.headers(), params: httpParams }).pipe(
      map(res => this.normSerialUnits(res))
    );
  }

  // Live "already exists" hint for the serial picker — called as the user
  // types/scans a serial. exists=true + allowDuplicate=false means the
  // picker should block/warn before the user even gets to Post, where
  // fn_post_grn_stock/fn_post_pi_stock would otherwise reject it anyway.
  checkSerialDuplicate(productId: number, serialNo: string): Observable<ApiResponse<{ exists: boolean; allowDuplicate: boolean }>> {
    const httpParams = new HttpParams().set('productId', String(productId)).set('serialNo', serialNo);
    return this.http.get<ApiResponse<any>>(this.salesUrl('serials/check-duplicate'), { headers: this.headers(), params: httpParams }).pipe(
      map(res => ({ ...res, data: { exists: !!res?.data?.exists, allowDuplicate: !!(res?.data?.allowDuplicate ?? res?.data?.allow_duplicate) } }))
    );
  }

  saveDeliveryChallan(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<any>> {
    const h = this.headers(); const body = this.toApiValue(payload);
    return id
      ? this.http.put<ApiResponse<any>>(this.salesUrl(`delivery-challans/${id}`), body, { headers: h })
      : this.http.post<ApiResponse<any>>(this.salesUrl('delivery-challans'), body, { headers: h });
  }

  // Item 31: reverses a partially-invoiced DC's unbilled remainder back into
  // stock and marks it closed — see sp_close_delivery_challan's own header
  // comment for why this has to be an explicit user action rather than
  // something automatic.
  closeDeliveryChallan(id: number): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(this.salesUrl(`delivery-challans/${id}/close`), {}, { headers: this.headers() });
  }

  // ── Sales Return ─────────────────────────────────────────────────────────────

  private normSalesReturn(r: any): SalesReturn {
    return {
      id: r?.id, return_number: r?.returnNumber || r?.return_number || '',
      return_date: r?.returnDate || r?.return_date,
      segment_id: r?.segmentId ?? r?.segment_id,
      segment_name: r?.segmentName || r?.segment_name,
      customer_id: r?.customerId ?? r?.customer_id,
      customer_name: r?.customerName || r?.customer_name,
      channel_partner_id: r?.channelPartnerId ?? r?.channel_partner_id,
      channel_partner_name: r?.channelPartnerName || r?.channel_partner_name,
      invoice_id: r?.invoiceId ?? r?.invoice_id,
      invoice_number: r?.invoiceNumber || r?.invoice_number,
      credit_note_ref: r?.creditNoteRef || r?.credit_note_ref,
      return_to_warehouse_id: r?.returnToWarehouseId ?? r?.return_to_warehouse_id,
      return_to_warehouse_name: r?.returnToWarehouseName || r?.return_to_warehouse_name,
      return_reason: r?.returnReason || r?.return_reason,
      remarks: r?.remarks,
      subtotal: r?.subtotal ?? 0,
      tax_amount: r?.taxAmount ?? r?.tax_amount ?? 0,
      total_amount: r?.totalAmount ?? r?.total_amount ?? 0,
      status: r?.status || 'draft',
      created_at: r?.createdAt || r?.created_at,
      items: (r?.items || []).map((i: any) => ({
        id: i?.id, sno: i?.sno ?? 0,
        product_id: i?.productId ?? i?.product_id,
        product_name: i?.productName || i?.product_name || '',
        product_code: i?.productCode || i?.product_code,
        variant_id: i?.variantId ?? i?.variant_id,
        variant_name: i?.variantName || i?.variant_name,
        attribute_id: i?.attributeId ?? i?.attribute_id,
        attribute_name: i?.attributeName || i?.attribute_name,
        attribute_value: i?.attributeValue || i?.attribute_value,
        uom_id: i?.uomId ?? i?.uom_id,
        uom_name: i?.uomName || i?.uom_name,
        invoiced_qty: i?.invoicedQty ?? i?.invoiced_qty,
        return_qty: i?.returnQty ?? i?.return_qty ?? 0,
        rate: i?.rate ?? 0,
        gst_rate: i?.gstRate ?? i?.gst_rate ?? 0,
        gst_inclusive: !!(i?.gstInclusive ?? i?.gst_inclusive),
        taxable_amount: i?.taxableAmount ?? i?.taxable_amount ?? 0,
        tax_amount: i?.taxAmount ?? i?.tax_amount ?? i?.gstAmount ?? i?.gst_amount ?? 0,
        return_amount: i?.returnAmount ?? i?.return_amount ?? 0,
        reason: i?.reason,
        serial_numbers: i?.serialNumbers ?? i?.serial_numbers ?? null,
        remarks: i?.remarks
      } as SalesReturnItem))
    };
  }

  getSalesReturns(status?: string, segmentId?: number | null): Observable<ApiResponse<SalesReturn[]>> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (segmentId) params = params.set('segmentId', String(segmentId));
    return this.http.get<ApiResponse<any[]>>(this.salesUrl('sales-returns'), { headers: this.headers(), params }).pipe(
      map(res => ({ ...res, data: (res.data ?? []).map(r => this.normSalesReturn(r)) }))
    );
  }

  saveSalesReturn(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<any>> {
    const h = this.headers(); const body = this.toApiValue(payload);
    return id
      ? this.http.put<ApiResponse<any>>(this.salesUrl(`sales-returns/${id}`), body, { headers: h })
      : this.http.post<ApiResponse<any>>(this.salesUrl('sales-returns'), body, { headers: h });
  }

  // ── Credit Note ──────────────────────────────────────────────────────────────

  private normCreditNote(r: any): CreditNote {
    return {
      id: r?.id, credit_note_number: r?.creditNoteNumber || r?.credit_note_number || '',
      credit_note_date: r?.creditNoteDate || r?.credit_note_date,
      segment_id: r?.segmentId ?? r?.segment_id,
      segment_name: r?.segmentName || r?.segment_name,
      customer_id: r?.customerId ?? r?.customer_id,
      customer_name: r?.customerName || r?.customer_name,
      sales_return_id: r?.salesReturnId ?? r?.sales_return_id,
      sales_return_number: r?.salesReturnNumber || r?.sales_return_number,
      sales_invoice_id: r?.salesInvoiceId ?? r?.sales_invoice_id,
      sales_invoice_number: r?.salesInvoiceNumber || r?.sales_invoice_number,
      reason: r?.reason,
      gst_adjustment: !!(r?.gstAdjustment ?? r?.gst_adjustment),
      remarks: r?.remarks,
      subtotal: r?.subtotal ?? 0,
      tax_amount: r?.taxAmount ?? r?.tax_amount ?? 0,
      total_amount: r?.totalAmount ?? r?.total_amount ?? 0,
      status: r?.status || 'draft',
      created_at: r?.createdAt || r?.created_at,
      items: (r?.items || []).map((i: any) => ({
        id: i?.id, sno: i?.sno ?? 0,
        description: i?.description || '',
        reference: i?.reference,
        amount: i?.amount ?? 0,
        gst_pct: i?.gstPct ?? i?.gst_pct ?? 0,
        gst_amount: i?.gstAmount ?? i?.gst_amount ?? 0,
        total_amount: i?.totalAmount ?? i?.total_amount ?? 0
      } as DebitNoteItem))
    };
  }

  getCreditNotes(status?: string, segmentId?: number | null): Observable<ApiResponse<CreditNote[]>> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (segmentId) params = params.set('segmentId', String(segmentId));
    return this.http.get<ApiResponse<any[]>>(this.salesUrl('credit-notes'), { headers: this.headers(), params }).pipe(
      map(res => ({ ...res, data: (res.data ?? []).map(r => this.normCreditNote(r)) }))
    );
  }

  saveCreditNote(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<any>> {
    const h = this.headers(); const body = this.toApiValue(payload);
    return id
      ? this.http.put<ApiResponse<any>>(this.salesUrl(`credit-notes/${id}`), body, { headers: h })
      : this.http.post<ApiResponse<any>>(this.salesUrl('credit-notes'), body, { headers: h });
  }

  /**
   * The number the next document of this type will get, for display before
   * posting. A preview only — nothing is allocated, so opening a screen and
   * closing it leaves no gap. The saved document is the authority: if someone
   * else saves first, the server hands this one the next free number instead.
   */
  peekNextDocNumber(docType: string): Observable<ApiResponse<string | null>> {
    const params = new HttpParams().set('docType', docType);
    return this.http.get<ApiResponse<string | null>>(
      this.url('next-doc-number'), { headers: this.headers(), params });
  }

  getRefDocs(docType: string, segmentId?: number | null, customerId?: number | null): Observable<ApiResponse<PurchaseRefDoc[]>> {
    let params = new HttpParams().set('docType', docType);
    if (segmentId) params = params.set('segmentId', String(segmentId));
    if (customerId) params = params.set('customerId', String(customerId));
    return this.http.get<ApiResponse<PurchaseRefDoc[]>>(this.url('ref-docs'), { headers: this.headers(), params }).pipe(
      map(res => {
        const docs = (res.data || []).map(r => ({
          id: (r as any).id, doc_number: (r as any).docNumber || (r as any).doc_number || '',
          doc_type: (r as any).docType || (r as any).doc_type || docType.toUpperCase(),
          doc_date: (r as any).docDate || (r as any).doc_date,
          segment_id: (r as any).segmentId ?? (r as any).segment_id,
          segment_name: (r as any).segmentName || (r as any).segment_name,
          branch_id: (r as any).branchId ?? (r as any).branch_id,
          branch_name: (r as any).branchName || (r as any).branch_name,
          warehouse_id: (r as any).warehouseId ?? (r as any).warehouse_id,
          warehouse_name: (r as any).warehouseName || (r as any).warehouse_name,
          vendor_id: (r as any).vendorId ?? (r as any).vendor_id,
          party_name: (r as any).partyName || (r as any).party_name,
          channel_partner_id: (r as any).channelPartnerId ?? (r as any).channel_partner_id,
          channel_partner_name: (r as any).channelPartnerName || (r as any).channel_partner_name,
          vendor_invoice_no: (r as any).vendorInvoiceNo || (r as any).vendor_invoice_no,
          vendor_invoice_dt: (r as any).vendorInvoiceDt || (r as any).vendor_invoice_dt,
          payment_terms: (r as any).paymentTerms || (r as any).payment_terms,
          so_id: (r as any).soId ?? (r as any).so_id,
          so_number: (r as any).soNumber || (r as any).so_number,
          grn_id: (r as any).grnId ?? (r as any).grn_id,
          status: (r as any).status || '', remarks: (r as any).remarks,
          items: (r as any).items || []
        }));
        const filteredDocs = docType.toUpperCase() === 'PR'
          ? docs.filter(doc => String(doc.status || '').trim().toLowerCase() === 'approved')
          : docs;
        return { ...res, data: filteredDocs };
      })
    );
  }

  // ── Transport Details (shared across every goods-moving transaction screen) ─

  getTransportDetails(docType: string, docId: number): Observable<ApiResponse<TransportDetails>> {
    const httpParams = new HttpParams().set('docType', docType).set('docId', String(docId));
    return this.http.get<ApiResponse<TransportDetails>>(this.url('transport-details'), { headers: this.headers(), params: httpParams });
  }

  saveTransportDetails(details: TransportDetails): Observable<ApiResponse<TransportDetails>> {
    return this.http.post<ApiResponse<TransportDetails>>(this.url('transport-details'), details, { headers: this.headers() });
  }

  // ── IFSC lookup (feeds the shared Bank Details component's Bank/Branch
  // auto-populate) — proxied server-side, see CommonController.GetIfscDetails.
  getIfscDetails(code: string): Observable<{ ifsc: string; bankName: string | null; branchName: string | null }> {
    return this.http.get<{ ifsc: string; bankName: string | null; branchName: string | null }>(
      `${this.base()}/Common/GetIfscDetails`, { headers: this.headers(), params: new HttpParams().set('code', code) }
    );
  }

  // ── Purchase Invoice Attachments (item 11 — Purchase Invoice screen only) ──

  getPurchaseInvoiceAttachments(purchaseInvoiceId: number): Observable<ApiResponse<PurchaseInvoiceAttachment[]>> {
    return this.http.get<ApiResponse<any[]>>(
      this.url(`purchase-invoices/${purchaseInvoiceId}/attachments`), { headers: this.headers() }
    ).pipe(
      map(res => ({ ...res, data: (res.data ?? []).map(r => this.normPurchaseInvoiceAttachment(r)) }))
    );
  }

  savePurchaseInvoiceAttachment(purchaseInvoiceId: number, attachment: {
    fileKey: string; fileName: string; contentType?: string | null; fileSizeBytes?: number | null;
  }): Observable<ApiResponse<PurchaseInvoiceAttachment>> {
    return this.http.post<ApiResponse<any>>(
      this.url(`purchase-invoices/${purchaseInvoiceId}/attachments`), attachment, { headers: this.headers() }
    ).pipe(
      map(res => ({ ...res, data: res.data ? this.normPurchaseInvoiceAttachment(res.data) : undefined }))
    );
  }

  uploadPurchaseInvoiceAttachment(purchaseInvoiceId: number, file: File): Observable<ApiResponse<PurchaseInvoiceAttachment>> {
    const fd = new FormData();
    fd.append('file', file, file.name);
    return this.http.post<ApiResponse<any>>(
      this.url(`purchase-invoices/${purchaseInvoiceId}/attachments/upload`), fd, { headers: this.headers() }
    ).pipe(
      map(res => ({ ...res, data: res.data ? this.normPurchaseInvoiceAttachment(res.data) : undefined }))
    );
  }

  deletePurchaseInvoiceAttachment(purchaseInvoiceId: number, attachmentId: number): Observable<ApiResponse<{ id: number; fileKey: string; deleted: boolean }>> {
    return this.http.delete<ApiResponse<{ id: number; fileKey: string; deleted: boolean }>>(
      this.url(`purchase-invoices/${purchaseInvoiceId}/attachments/${attachmentId}`), { headers: this.headers() }
    );
  }

  // Generic download-for-preview, shared plumbing behind Accounts/DownloadImage
  // (S3UploadService.DownloadFileAsync) -- fileName must be the bare,
  // GUID-prefixed name with no folder prefix (see 147_purchase_invoice_
  // attachments.sql for why a full "folder/name" key can't be used here).
  downloadS3File(formName: string, fileName: string): Observable<Blob> {
    return this.http.get(`${this.base()}/Accounts/DownloadImage/${formName}/${encodeURIComponent(fileName)}`, {
      headers: this.headers(),
      responseType: 'blob'
    });
  }
}

export interface PurchaseInvoiceAttachment {
  id: number;
  purchaseInvoiceId: number;
  fileKey: string;
  fileName: string;
  contentType?: string | null;
  fileSizeBytes?: number | null;
  uploadedBy?: number | null;
  uploadedByName?: string | null;
  createdAt?: string | null;
}

export interface TransportDetails {
  id?: number;
  docType: string;
  docId: number;
  vehicleType?: string | null;
  vehicleName?: string | null;
  vehicleNo?: string | null;
  weighingEnabled?: boolean;
  beforeWeight?: number | null;
  beforeWeightPhoto?: string | null;
  afterWeight?: number | null;
  afterWeightPhoto?: string | null;
  driverEnabled?: boolean;
  driverName?: string | null;
  driverContactNo?: string | null;
  driverLicenseNo?: string | null;
}
