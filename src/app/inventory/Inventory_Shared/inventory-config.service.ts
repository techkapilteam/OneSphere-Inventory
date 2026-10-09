import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { currentAccessToken } from './inventory-auth-token.util';

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
}

// BOM / Work Center / Price List — real records as of migration 219; these
// three masters previously had no backend and lived in browser localStorage.
export interface WorkCenterItem {
  id: number;
  company_id?: number | null;
  segment_id?: number | null;
  work_center_code: string;
  work_center_name: string;
  department?: string | null;
  capacity?: string | null;
  cost_per_hour: number;
  status: string;
}

export interface PriceListItem {
  id: number;
  company_id?: number | null;
  segment_id?: number | null;
  price_list_code: string;
  price_list_name: string;
  branch_id?: number | null;
  branch_name?: string | null;
  product_id?: number | null;
  product_name?: string | null;
  rate: number;
  effective_from?: string | null;
  effective_to?: string | null;
  status: string;
}

export interface BomLineItem {
  id?: number;
  sno: number;
  product_id?: number | null;
  product_name: string;
  quantity: number;
  uom_id?: number | null;
  uom_name?: string | null;
}

export interface BomItem {
  id: number;
  company_id?: number | null;
  segment_id?: number | null;
  bom_code: string;
  bom_version?: string | null;
  finished_product_id?: number | null;
  finished_product_name: string;
  quantity: number;
  wastage_percent: number;
  production_cost: number;
  status: string;
  items: BomLineItem[];
}

export interface SegmentItem {
  id: number;
  company_id: number;
  segment_code: string;
  segment_name: string;
  usage_note?: string;
  status: string;
  categories: {
    id: number;
    category_code: string;
    category_name: string;
    serial_applicable?: boolean;
    serial_policy_id?: number | null;
    serial_policy_name?: string | null;
    batch_applicable?: boolean;
    batch_policy_id?: number | null;
    batch_policy_name?: string | null;
  }[];
  hsn_sac_codes: { id: number; code: string; description?: string; hsn_type: string; category?: string; remarks?: string; gst_rate: number }[];
  uoms: { id: number; uom_code: string; uom_name: string; uom_symbol?: string }[];
}

export interface CategoryItem {
  id: number;
  segment_id?: number;
  segment_name?: string;
  category_code: string;
  category_name: string;
  parent_id?: number;
  parent_name?: string;
  description?: string;
  serial_applicable?: boolean;
  serial_policy_id?: number | null;
  serial_policy_name?: string | null;
  batch_applicable?: boolean;
  batch_policy_id?: number | null;
  batch_policy_name?: string | null;
  uoms?: CategoryUomItem[];
  status: string;
}

export interface CategoryUomItem {
  id: number;
  uom_code?: string;
  uom_name?: string;
  uom_symbol?: string;
}

export interface UomItem {
  id: number;
  segment_id?: number;
  segment_name?: string;
  uom_code: string;
  uom_name: string;
  uom_symbol?: string;
  decimal_allowed?: boolean;
  is_base_uom?: boolean;
  is_system: boolean;
  conversions?: UomConversionItem[];
  status: string;
}

export interface UomConversionItem {
  id?: number;
  from_uom_id?: number;
  from_uom_name?: string;
  from_uom_symbol?: string;
  to_uom_id?: number;
  to_uom_name?: string;
  to_uom_symbol?: string;
  conversion_factor?: number | null;
  rounding_rule?: string;
  status?: string;
}

export interface ProductUomConversion {
  id?: number;
  from_uom_id?: number;
  from_uom_name?: string;
  from_uom_symbol?: string;
  to_uom_id?: number;
  to_uom_name?: string;
  to_uom_symbol?: string;
  alt_uom?: string;
  alt_uom_name?: string;
  conversion_factor?: number | null;
  is_purchase_uom?: boolean;
  is_sales_uom?: boolean;
  is_default_purchase?: boolean;
  is_default_sale?: boolean;
  rounding_rule?: string;
  status?: string;
}

export interface ProductUomConversionCalculateRequest {
  quantity: number;
  from_uom_id?: number;
  from_uom_name?: string;
  to_uom_id?: number;
  to_uom_name?: string;
  usage_type?: 'Purchase' | 'Sale' | 'Both';
}

export interface ProductUomConversionCalculateResult {
  product_id: number;
  product_name: string;
  quantity: number;
  from_uom_id: number;
  from_uom_name: string;
  from_uom_symbol?: string;
  to_uom_id: number;
  to_uom_name: string;
  to_uom_symbol?: string;
  base_uom_id: number;
  base_uom_name: string;
  base_uom_symbol?: string;
  converted_quantity: number;
  usage_type: 'Purchase' | 'Sale' | 'Both';
}

export interface HsnSacItem {
  id: number;
  code: string;
  description?: string;
  hsn_type: string;
  category?: string;
  tax_category?: string;
  remarks?: string;
  gst_rate: number;
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
  cess_rate: number;
  source: string;
  status: string;
}

export interface TaxCodeSuggestion {
  id: number;
  code: string;
  description: string;
  type: 'HSN' | 'SAC';
  gst_rate?: number | null;
  chapter?: string;
  category?: string;
  remarks?: string;
  gst_guide_label?: string;
  gst_guide_description?: string;
  gst_guide_notes?: string;
  source?: string;
  source_updated_at?: string;
}

export interface TaxCodeSkippedRow {
  row_number: number;
  reason: string;
  raw_code?: string;
}

export interface TaxCodeImportSummary {
  total_rows: number;
  imported: number;
  updated: number;
  skipped: number;
  duplicates_removed: number;
  gst_guide_slabs_imported: number;
  gst_guide_slabs_updated: number;
  gst_guide_notes_imported: number;
  source: string;
  source_updated_at?: string;
  invalid_rows: TaxCodeSkippedRow[];
}

export interface TaxCodeSourceStatus {
  source?: string;
  source_updated_at?: string;
  imported_at?: string;
  total_codes: number;
}

export interface GstRateSlab {
  id: number;
  rate: number;
  label: string;
  description?: string;
  notes?: string;
  source?: string;
  source_updated_at?: string;
}

export interface GstGuideNote {
  id: number;
  note_text: string;
  display_order: number;
  source?: string;
  source_updated_at?: string;
}

export interface GstRateGuide {
  slabs: GstRateSlab[];
  notes: GstGuideNote[];
}

export interface WarehouseItem {
  id: number;
  company_id: number;
  branch_id?: number;
  segment_id?: number;
  warehouse_code: string;
  warehouse_name: string;
  address?: string;
  city?: string;
  state?: string;
  district?: string;
  country?: string;
  pincode?: string;
  capacity?: number;
  capacity_unit?: string;
  is_default: boolean;
  status: string;
}

export interface BranchInvItem {
  id?: number;
  company_id: number;
  branch_id?: number;
  segment_id?: number;
  segment_name?: string;
  branch_name: string;
  branch_code: string;
  gstin?: string;
  pan?: string;
  address?: string;
  city?: string;
  state?: string;
  district?: string;
  pincode?: string;
  contact_name?: string;
  contact_mobile?: string;
  contact_email?: string;
  activity_types: string[];
  is_head_office: boolean;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface CompanyDetails {
  company_id: number;
  company_name?: string;
  gst_no?: string;
  pan_no?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
}

// ── Master interfaces ────────────────────────────────────────────────────────

export interface PaymentTermItem {
  id: number;
  term_code: string;
  term_name: string;
  credit_days: number;
  discount_pct: number;
  description?: string;
  status: string;
}

export interface BrandItem {
  id: number;
  segment_id?: number;
  segment_name?: string;
  brand_code: string;
  brand_name: string;
  manufacturer?: string;
  description?: string;
  status: string;
}

export interface AttributeItem {
  id: number;
  segment_id?: number;
  segment_name?: string;
  attribute_code?: string;
  attribute_name: string;
  attribute_type: string;
  display_order?: number;
  possible_values?: string[];
  values?: AttributeValueItem[];
  is_mandatory: boolean;
  status: string;
}

export interface AttributeValueItem {
  id: number;
  value_code?: string;
  value_name: string;
  status: string;
  sort_order?: number;
  usage_count?: number;
}

export interface ProductGroupItem {
  id: number;
  segment_id?: number;
  segment_name?: string;
  category_id?: number;
  category_name?: string;
  group_code: string;
  group_name: string;
  description?: string;
  status: string;
}

export interface VariantItem {
  id: number;
  segment_id?: number;
  segment_name?: string;
  product_id?: number;
  product_code?: string;
  product_name?: string;
  attribute_id?: number;
  attribute_name?: string;
  variant_code: string;
  variant_name: string;
  sku?: string;
  sku_pattern?: string;
  barcode?: string;
  price?: number;
  cost?: number;
  stock_on_hand?: number;
  stock?: number;
  images?: string[];
  variant_label?: string;
  attribute_value?: string;
  attributes?: VariantAttributeItem[];
  combination_hash?: string;
  is_generated?: boolean;
  description?: string;
  status: string;
}

export interface VariantAttributeItem {
  attribute_id?: number;
  attribute_name?: string;
  attribute_value_id?: number;
  value_code?: string;
  value_name?: string;
  attribute_value?: string;
  value_status?: string;
  attribute_type?: string;
  possible_values?: string[];
  usage_count?: number;
  display_order?: number;
}

export interface VariantCombinationRow {
  variant_id?: number;
  product_id: number;
  variant_name: string;
  sku?: string;
  combination_hash: string;
  exists: boolean;
  created: boolean;
  attributes: VariantAttributeItem[];
}

export interface VariantCombinationGenerateResult {
  product_id: number;
  product_code?: string;
  product_name?: string;
  total: number;
  new_count: number;
  existing_count: number;
  created_count: number;
  rows: VariantCombinationRow[];
}

export interface AttributeVariantBulkImportResult {
  total_rows: number;
  imported: number;
  updated: number;
  skipped: number;
  invalid_rows: Array<Record<string, any>>;
}

export interface SerialPolicyItem {
  id: number;
  segment_id?: number;
  segment_name?: string;
  category_id?: number;
  category_name?: string;
  policy_code: string;
  policy_name: string;
  serial_format?: string;
  capture_stage?: string;
  allow_duplicate: boolean;
  warranty_applicable: boolean;
  description?: string;
  status: string;
}

export interface BatchPolicyItem {
  id: number;
  segment_id?: number;
  segment_name?: string;
  category_id?: number;
  category_name?: string;
  policy_code: string;
  policy_name: string;
  batch_format?: string;
  expiry_required: boolean;
  qc_required: boolean;
  description?: string;
  status: string;
}

export interface BarcodeConfigurationItem {
  id: number;
  barcode_type: string;
  auto_generate: boolean;
  prefix?: string;
  starting_number: number;
  length: number;
  applicable_products: string[];
  status: string;
}

export interface SubstituteProductItem {
  id: number;
  product_id: number;
  product_name: string;
  substitute_product_id: number;
  substitute_product_name: string;
  priority: number;
  remarks?: string;
  status: string;
}

export interface ConsumptionTypeItem {
  id: number;
  segment_id?: number;
  segment_name?: string;
  type_code: string;
  type_name: string;
  department?: string;
  approval_required: boolean;
  remarks?: string;
  status: string;
}

export interface PartyGstinItem {
  id?: number;
  stateName?: string;
  state_name?: string;
  stateCode?: string | number | null;
  state_code?: string | number | null;
  gstin?: string;
  isPrimary?: boolean;
  is_primary?: boolean;
}

export interface VendorItem {
  id: number;
  segment_id?: number;
  segment_name?: string;
  payment_term_id?: number;
  payment_term_name?: string;
  vendor_code: string;
  vendor_name: string;
  vendor_type: string;
  vendor_category?: string;
  gstin?: string;
  gstins?: PartyGstinItem[];
  pan?: string;
  mobile?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  district?: string;
  pincode?: string;
  credit_limit: number;
  bank_details?: string;
  bank_payee_name?: string;
  bank_account_no?: string;
  bank_ifsc_code?: string;
  bank_name?: string;
  bank_branch_name?: string;
  contact_name?: string;
  contact_mobile?: string;
  contact_email?: string;
  contact_id?: number;
  contact_source?: string;
  status: string;
}

export interface ChannelPartnerItem {
  id: number;
  segment_id?: number;
  segment_name?: string;
  payment_term_id?: number;
  payment_term_name?: string;
  partner_code: string;
  partner_name: string;
  partner_type: string;
  partner_category?: string;
  gstin?: string;
  pan?: string;
  mobile?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  district?: string;
  pincode?: string;
  credit_limit: number;
  bank_details?: string;
  contact_name?: string;
  contact_mobile?: string;
  contact_email?: string;
  contact_id?: number;
  contact_source?: string;
  status: string;
}

export interface ContactItem {
  id: number;
  contact_type: string;
  name: string;
  mobile?: string;
  email?: string;
  gstin?: string;
  pan?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  is_supplier?: boolean;
  is_customer?: boolean;
  is_channel_partner?: boolean;
  is_lead_by?: boolean;
  vendor_exists?: boolean;
  customer_exists?: boolean;
  channel_partner_exists?: boolean;
  status: string;
}

export interface CustomerItem {
  id: number;
  segment_id?: number;
  segment_name?: string;
  payment_term_id?: number;
  payment_term_name?: string;
  customer_code: string;
  customer_name: string;
  customer_type: string;
  customer_category?: string;
  gstin?: string;
  gstins?: PartyGstinItem[];
  pan?: string;
  mobile?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  district?: string;
  pincode?: string;
  shipping_address?: string;
  credit_limit: number;
  bank_payee_name?: string;
  bank_account_no?: string;
  bank_ifsc_code?: string;
  bank_name?: string;
  bank_branch_name?: string;
  contact_name?: string;
  contact_mobile?: string;
  contact_email?: string;
  contact_id?: number;
  contact_source?: string;
  status: string;
}

export interface ProductItem {
  id: number;
  segment_id?: number;
  segment_name?: string;
  category_id?: number;
  category_name?: string;
  base_uom_id?: number;
  base_uom_name?: string;
  base_uom_symbol?: string;
  brand_id?: number;
  brand_name?: string;
  variant_id?: number;
  variant_name?: string;
  variant_label?: string;
  hsn_sac_id?: number;
  hsn_sac_code?: string;
  serial_policy_id?: number;
  serial_policy_name?: string;
  batch_policy_id?: number;
  batch_policy_name?: string;
  product_code: string;
  sku: string;
  product_name: string;
  product_type: string;
  product_nature_id?: number;
  product_nature_name?: string;
  tracks_inventory?: boolean;
  tracks_cost?: boolean;
  is_service?: boolean;
  is_asset?: boolean;
  allows_purchase?: boolean;
  allows_sale?: boolean;
  allows_production?: boolean;
  item_status: string;
  valuation_method?: string;
  gst_rate?: number;
  tax_category?: string;
  mrp?: number | null;
  selling_price?: number | null;
  sellingPrice?: number | null;
  sale_price?: number | null;
  price?: number | null;
  cost_price?: number | null;
  costPrice?: number | null;
  reorder_level: number;
  reorder_qty: number;
  max_stock_level: number;
  min_stock_level: number;
  batch_applicable: boolean;
  serial_applicable: boolean;
  expiry_applicable: boolean;
  qc_required: boolean;
  warranty_applicable: boolean;
  pricing_type?: string;
  rental_unit?: string;
  description?: string;
  uom_conversions?: ProductUomConversion[];
  applicable_variants?: ProductApplicableVariant[];
  bundle_composition?: ProductBundleItem[];
  variant_stock_controls?: ProductVariantStockControl[];
  status: string;
  // True once this product has moved real stock/value through a posted
  // GRN/PI/SI/Return/Transfer/Adjustment/Production document (migration
  // 236) -- the record is then read-only; the backend enforces the same
  // rule on save regardless of what the UI does with this flag.
  locked_for_edit?: boolean;
}

export interface ProductApplicableVariant {
  id: number;
  variant_name: string;
  variant_label: string;
  is_default: boolean;
  attributes?: ProductVariantStockAttribute[];
}

export interface ProductVariantStockControl {
  variant_id: number;
  variant_name?: string;
  variant_label?: string;
  attributes: ProductVariantStockAttribute[];
  min_stock_level: number;
  max_stock_level: number;
  reorder_level: number;
  reorder_qty: number;
}

export interface ProductVariantStockAttribute {
  attribute_name: string;
  attribute_value: string;
}

export interface ProductBundleItem {
  item_id: number;
  item_name: string;
  quantity: number;
  condition_tracked: boolean;
  depreciation_linked: boolean;
}

export interface ProductTypeItem {
  id: number;
  company_id?: number;
  type_code: string;
  type_name: string;
  description?: string;
  tracks_inventory: boolean;
  tracks_cost: boolean;
  is_service: boolean;
  is_asset: boolean;
  allows_purchase: boolean;
  allows_sale: boolean;
  allows_production: boolean;
  default_serial_required: boolean;
  default_batch_required: boolean;
  default_expiry_required: boolean;
  requires_hsn_sac: boolean;
  is_system: boolean;
  sort_order: number;
  status: string;
}

@Injectable({ providedIn: 'root' })
export class InventoryConfigService {
  private readonly http = inject(HttpClient);

  private base(): string {
    return sessionStorage.getItem('apiURL') || '';
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${currentAccessToken()}` });
  }

  private url(path: string): string {
    return `${this.base()}/inventory/config/${path}`;
  }

  private taxCodeUrl(path: string): string {
    return `${this.base()}/tax-codes/${path}`;
  }

  private camelize(key: string): string {
    return key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
  }

  private toApiValue(value: any): any {
    if (Array.isArray(value)) {
      return value.map(item => this.toApiValue(item));
    }

    if (value && typeof value === 'object' && !(value instanceof Date)) {
      return Object.entries(value).reduce((payload, [key, item]) => {
        payload[this.camelize(key)] = this.toApiValue(item);
        return payload;
      }, {} as Record<string, any>);
    }

    return value;
  }

  private value<T = any>(source: any, snakeKey: string, camelKey?: string, fallback?: T): T {
    return (source?.[snakeKey] ?? (camelKey ? source?.[camelKey] : undefined) ?? fallback) as T;
  }

  private normalizeStringList(value: any): string[] {
    if (Array.isArray(value)) {
      return value.flatMap(item => this.normalizeStringList(item));
    }

    if (value && typeof value === 'object') {
      const direct = value.value ?? value.label ?? value.name ?? value.text ?? value.option ?? value.attribute_value ?? value.attributeValue;
      return direct === undefined ? [] : this.normalizeStringList(direct);
    }

    const text = String(value ?? '').trim();
    if (!text) return [];

    if ((text.startsWith('[') && text.endsWith(']')) || (text.startsWith('{') && text.endsWith('}'))) {
      try {
        return this.normalizeStringList(JSON.parse(text));
      } catch {
        // Fall back to comma splitting below.
      }
    }

    return text.split(',').map(item => item.trim()).filter(Boolean);
  }

  private normalizeSegment(item: any): SegmentItem {
    return {
      id: item?.id,
      company_id: this.value(item, 'company_id', 'companyId'),
      segment_code: this.value(item, 'segment_code', 'segmentCode', ''),
      segment_name: this.value(item, 'segment_name', 'segmentName', ''),
      usage_note: this.value(item, 'usage_note', 'usageNote'),
      status: this.value(item, 'status', 'status', 'active'),
      categories: (this.value<any[]>(item, 'categories', 'categories', []) ?? []).map(c => ({
        id: c?.id,
        category_code: this.value(c, 'category_code', 'categoryCode', ''),
        category_name: this.value(c, 'category_name', 'categoryName', ''),
        serial_applicable: !!this.value(c, 'serial_applicable', 'serialApplicable', false),
        serial_policy_id: this.value(c, 'serial_policy_id', 'serialPolicyId', null),
        serial_policy_name: this.value(c, 'serial_policy_name', 'serialPolicyName', null),
        batch_applicable: !!this.value(c, 'batch_applicable', 'batchApplicable', false),
        batch_policy_id: this.value(c, 'batch_policy_id', 'batchPolicyId', null),
        batch_policy_name: this.value(c, 'batch_policy_name', 'batchPolicyName', null)
      })),
      hsn_sac_codes: (this.value<any[]>(item, 'hsn_sac_codes', 'hsnSacCodes', []) ?? []).map(h => ({
        id: h?.id,
        code: this.value(h, 'code', 'code', ''),
        description: this.value(h, 'description', 'description'),
        hsn_type: this.value(h, 'hsn_type', 'hsnType', 'HSN'),
        category: this.value(h, 'category', 'category'),
        remarks: this.value(h, 'remarks', 'remarks'),
        gst_rate: this.value(h, 'gst_rate', 'gstRate', 0)
      })),
      uoms: (this.value<any[]>(item, 'uoms', 'uoms', []) ?? []).map(u => ({
        id: u?.id,
        uom_code: this.value(u, 'uom_code', 'uomCode', ''),
        uom_name: this.value(u, 'uom_name', 'uomName', ''),
        uom_symbol: this.value(u, 'uom_symbol', 'uomSymbol')
      }))
    };
  }

  private normalizeCategory(item: any): CategoryItem {
    return {
      id: item?.id,
      segment_id: this.value(item, 'segment_id', 'segmentId'),
      segment_name: this.value(item, 'segment_name', 'segmentName'),
      category_code: this.value(item, 'category_code', 'categoryCode', ''),
      category_name: this.value(item, 'category_name', 'categoryName', ''),
      parent_id: this.value(item, 'parent_id', 'parentId'),
      parent_name: this.value(item, 'parent_name', 'parentName'),
      description: this.value(item, 'description', 'description'),
      serial_applicable: !!(this.value(item, 'serial_applicable', 'serialApplicable', false)),
      serial_policy_id: this.value(item, 'serial_policy_id', 'serialPolicyId', null),
      serial_policy_name: this.value(item, 'serial_policy_name', 'serialPolicyName', null),
      batch_applicable: !!(this.value(item, 'batch_applicable', 'batchApplicable', false)),
      batch_policy_id: this.value(item, 'batch_policy_id', 'batchPolicyId', null),
      batch_policy_name: this.value(item, 'batch_policy_name', 'batchPolicyName', null),
      uoms: (this.value<any[]>(item, 'uoms', 'uoms', []) ?? []).map(u => ({
        id: u?.id,
        uom_code: this.value(u, 'uom_code', 'uomCode', ''),
        uom_name: this.value(u, 'uom_name', 'uomName', ''),
        uom_symbol: this.value(u, 'uom_symbol', 'uomSymbol')
      })),
      status: this.value(item, 'status', 'status', 'active')
    };
  }

  private normalizeUomConversion(item: any): UomConversionItem {
    return {
      id: item?.id,
      from_uom_id: this.value(item, 'from_uom_id', 'fromUomId'),
      from_uom_name: this.value(item, 'from_uom_name', 'fromUomName'),
      from_uom_symbol: this.value(item, 'from_uom_symbol', 'fromUomSymbol'),
      to_uom_id: this.value(item, 'to_uom_id', 'toUomId'),
      to_uom_name: this.value(item, 'to_uom_name', 'toUomName'),
      to_uom_symbol: this.value(item, 'to_uom_symbol', 'toUomSymbol'),
      conversion_factor: this.value(item, 'conversion_factor', 'conversionFactor'),
      rounding_rule: this.value(item, 'rounding_rule', 'roundingRule', 'Exact'),
      status: this.value(item, 'status', 'status', 'active')
    };
  }

  private normalizeUom(item: any): UomItem {
    return {
      id: item?.id,
      segment_id: this.value(item, 'segment_id', 'segmentId'),
      segment_name: this.value(item, 'segment_name', 'segmentName'),
      uom_code: this.value(item, 'uom_code', 'uomCode', ''),
      uom_name: this.value(item, 'uom_name', 'uomName', ''),
      uom_symbol: this.value(item, 'uom_symbol', 'uomSymbol'),
      decimal_allowed: !!(this.value(item, 'decimal_allowed', 'decimalAllowed', false)),
      is_base_uom: !!(this.value(item, 'is_base_uom', 'isBaseUom', false)),
      is_system: this.value(item, 'is_system', 'isSystem', false),
      conversions: (item?.conversions || []).map((c: any) => this.normalizeUomConversion(c)),
      status: this.value(item, 'status', 'status', 'active')
    };
  }

  private normalizeProductUomConversion(item: any): ProductUomConversion {
    const fromName = this.value<string | undefined>(item, 'from_uom_name', 'fromUomName');
    const fromSymbol = this.value<string | undefined>(item, 'from_uom_symbol', 'fromUomSymbol');
    const toName = this.value<string | undefined>(item, 'to_uom_name', 'toUomName');
    const toSymbol = this.value<string | undefined>(item, 'to_uom_symbol', 'toUomSymbol');
    const isPurchase = !!(
      this.value(item, 'is_purchase_uom', 'isPurchaseUom', false)
      || this.value(item, 'is_default_purchase', 'isDefaultPurchase', false)
    );
    const isSales = !!(
      this.value(item, 'is_sales_uom', 'isSalesUom', false)
      || this.value(item, 'is_default_sale', 'isDefaultSale', false)
    );
    return {
      id: item?.id,
      from_uom_id: this.value(item, 'from_uom_id', 'fromUomId'),
      from_uom_name: fromName,
      from_uom_symbol: fromSymbol,
      to_uom_id: this.value(item, 'to_uom_id', 'toUomId'),
      to_uom_name: toName,
      to_uom_symbol: toSymbol,
      alt_uom: this.value(item, 'alt_uom', 'altUom', fromSymbol || fromName),
      alt_uom_name: this.value(item, 'alt_uom_name', 'altUomName', fromName),
      conversion_factor: this.value(item, 'conversion_factor', 'conversionFactor'),
      is_purchase_uom: isPurchase,
      is_sales_uom: isSales,
      is_default_purchase: isPurchase,
      is_default_sale: isSales,
      rounding_rule: this.value(item, 'rounding_rule', 'roundingRule', 'Exact'),
      status: this.value(item, 'status', 'status', 'active')
    };
  }

  private normalizeProductUomConversionResult(item: any): ProductUomConversionCalculateResult {
    return {
      product_id: this.value(item, 'product_id', 'productId', 0),
      product_name: this.value(item, 'product_name', 'productName', ''),
      quantity: this.value(item, 'quantity', 'quantity', 0),
      from_uom_id: this.value(item, 'from_uom_id', 'fromUomId', 0),
      from_uom_name: this.value(item, 'from_uom_name', 'fromUomName', ''),
      from_uom_symbol: this.value(item, 'from_uom_symbol', 'fromUomSymbol'),
      to_uom_id: this.value(item, 'to_uom_id', 'toUomId', 0),
      to_uom_name: this.value(item, 'to_uom_name', 'toUomName', ''),
      to_uom_symbol: this.value(item, 'to_uom_symbol', 'toUomSymbol'),
      base_uom_id: this.value(item, 'base_uom_id', 'baseUomId', 0),
      base_uom_name: this.value(item, 'base_uom_name', 'baseUomName', ''),
      base_uom_symbol: this.value(item, 'base_uom_symbol', 'baseUomSymbol'),
      converted_quantity: this.value(item, 'converted_quantity', 'convertedQuantity', 0),
      usage_type: this.value(item, 'usage_type', 'usageType', 'Both')
    };
  }

  private normalizeHsnSac(item: any): HsnSacItem {
    return {
      id: item?.id,
      code: this.value(item, 'code', 'code', ''),
      description: this.value(item, 'description', 'description'),
      hsn_type: this.value(item, 'hsn_type', 'hsnType', 'HSN'),
      category: this.value(item, 'category', 'category'),
      remarks: this.value(item, 'remarks', 'remarks'),
      gst_rate: this.value(item, 'gst_rate', 'gstRate', 0),
      cgst_rate: this.value(item, 'cgst_rate', 'cgstRate', 0),
      sgst_rate: this.value(item, 'sgst_rate', 'sgstRate', 0),
      igst_rate: this.value(item, 'igst_rate', 'igstRate', 0),
      cess_rate: this.value(item, 'cess_rate', 'cessRate', 0),
      source: this.value(item, 'source', 'source', 'manual'),
      status: this.value(item, 'status', 'status', 'active')
    };
  }

  private normalizeTaxCode(item: any): TaxCodeSuggestion {
    return {
      id: this.value(item, 'id', 'id'),
      code: this.value(item, 'code', 'code', ''),
      description: this.value(item, 'description', 'description', ''),
      type: this.value(item, 'type', 'type', 'HSN'),
      gst_rate: this.value(item, 'gst_rate', 'gstRate'),
      chapter: this.value(item, 'chapter', 'chapter'),
      category: this.value(item, 'category', 'category'),
      remarks: this.value(item, 'remarks', 'remarks'),
      gst_guide_label: this.value(item, 'gst_guide_label', 'gstGuideLabel'),
      gst_guide_description: this.value(item, 'gst_guide_description', 'gstGuideDescription'),
      gst_guide_notes: this.value(item, 'gst_guide_notes', 'gstGuideNotes'),
      source: this.value(item, 'source', 'source'),
      source_updated_at: this.value(item, 'source_updated_at', 'sourceUpdatedAt')
    };
  }

  private normalizeTaxCodeSourceStatus(item: any): TaxCodeSourceStatus {
    return {
      source: this.value(item, 'source', 'source'),
      source_updated_at: this.value(item, 'source_updated_at', 'sourceUpdatedAt'),
      imported_at: this.value(item, 'imported_at', 'importedAt'),
      total_codes: this.value(item, 'total_codes', 'totalCodes', 0)
    };
  }

  private normalizeTaxCodeImportSummary(item: any): TaxCodeImportSummary {
    return {
      total_rows: this.value(item, 'total_rows', 'totalRows', 0),
      imported: this.value(item, 'imported', 'imported', 0),
      updated: this.value(item, 'updated', 'updated', 0),
      skipped: this.value(item, 'skipped', 'skipped', 0),
      duplicates_removed: this.value(item, 'duplicates_removed', 'duplicatesRemoved', 0),
      gst_guide_slabs_imported: this.value(item, 'gst_guide_slabs_imported', 'gstGuideSlabsImported', 0),
      gst_guide_slabs_updated: this.value(item, 'gst_guide_slabs_updated', 'gstGuideSlabsUpdated', 0),
      gst_guide_notes_imported: this.value(item, 'gst_guide_notes_imported', 'gstGuideNotesImported', 0),
      source: this.value(item, 'source', 'source', ''),
      source_updated_at: this.value(item, 'source_updated_at', 'sourceUpdatedAt'),
      invalid_rows: (this.value<any[]>(item, 'invalid_rows', 'invalidRows', []) ?? []).map(row => ({
        row_number: this.value(row, 'row_number', 'rowNumber', 0),
        reason: this.value(row, 'reason', 'reason', ''),
        raw_code: this.value(row, 'raw_code', 'rawCode')
      }))
    };
  }

  private normalizeGstGuide(item: any): GstRateGuide {
    return {
      slabs: (this.value<any[]>(item, 'slabs', 'slabs', []) ?? []).map(row => ({
        id: this.value(row, 'id', 'id', 0),
        rate: this.value(row, 'rate', 'rate', 0),
        label: this.value(row, 'label', 'label', ''),
        description: this.value(row, 'description', 'description'),
        notes: this.value(row, 'notes', 'notes'),
        source: this.value(row, 'source', 'source'),
        source_updated_at: this.value(row, 'source_updated_at', 'sourceUpdatedAt')
      })),
      notes: (this.value<any[]>(item, 'notes', 'notes', []) ?? []).map(row => ({
        id: this.value(row, 'id', 'id', 0),
        note_text: this.value(row, 'note_text', 'noteText', ''),
        display_order: this.value(row, 'display_order', 'displayOrder', 0),
        source: this.value(row, 'source', 'source'),
        source_updated_at: this.value(row, 'source_updated_at', 'sourceUpdatedAt')
      }))
    };
  }

  private normalizeWarehouse(item: any): WarehouseItem {
    return {
      id: item?.id,
      company_id: this.value(item, 'company_id', 'companyId'),
      branch_id: this.value(item, 'branch_id', 'branchId'),
      segment_id: this.value(item, 'segment_id', 'segmentId'),
      warehouse_code: this.value(item, 'warehouse_code', 'warehouseCode', ''),
      warehouse_name: this.value(item, 'warehouse_name', 'warehouseName', ''),
      address: this.value(item, 'address', 'address'),
      city: this.value(item, 'city', 'city'),
      state: this.value(item, 'state', 'state'),
      district: this.value(item, 'district', 'district'),
      country: this.value(item, 'country', 'country'),
      pincode: this.value(item, 'pincode', 'pincode'),
      capacity: this.value(item, 'capacity', 'capacity'),
      capacity_unit: this.value(item, 'capacity_unit', 'capacityUnit'),
      is_default: this.value(item, 'is_default', 'isDefault', false),
      status: this.value(item, 'status', 'status', 'active')
    };
  }

  private normalizeBranch(item: any): BranchInvItem {
    return {
      id: this.value(item, 'id', 'id'),
      company_id: this.value(item, 'company_id', 'companyId'),
      branch_id: this.value(item, 'branch_id', 'branchId'),
      segment_id: this.value(item, 'segment_id', 'segmentId'),
      segment_name: this.value(item, 'segment_name', 'segmentName'),
      branch_name: this.value(item, 'branch_name', 'branchName', ''),
      branch_code: this.value(item, 'branch_code', 'branchCode', ''),
      gstin: this.value(item, 'gstin', 'gstin'),
      pan: this.value(item, 'pan', 'pan'),
      address: this.value(item, 'address', 'address'),
      city: this.value(item, 'city', 'city'),
      state: this.value(item, 'state', 'state'),
      district: this.value(item, 'district', 'district'),
      pincode: this.value(item, 'pincode', 'pincode'),
      contact_name: this.value(item, 'contact_name', 'contactName'),
      contact_mobile: this.value(item, 'contact_mobile', 'contactMobile'),
      contact_email: this.value(item, 'contact_email', 'contactEmail'),
      activity_types: this.value(item, 'activity_types', 'activityTypes', []) ?? [],
      is_head_office: this.value(item, 'is_head_office', 'isHeadOffice', false),
      status: this.value(item, 'status', 'status', 'active'),
      created_at: this.value(item, 'created_at', 'createdAt'),
      updated_at: this.value(item, 'updated_at', 'updatedAt')
    };
  }

  private normalizeCompanyDetails(item: any): CompanyDetails {
    return {
      company_id: this.value(item, 'company_id', 'companyId'),
      company_name: this.value(item, 'company_name', 'companyName'),
      gst_no: this.value(item, 'gst_no', 'gstNo'),
      pan_no: this.value(item, 'pan_no', 'panNo'),
      address: this.value(item, 'address', 'address'),
      city: this.value(item, 'city', 'city'),
      state: this.value(item, 'state', 'state'),
      country: this.value(item, 'country', 'country'),
      pincode: this.value(item, 'pincode', 'pincode')
    };
  }

  private mapArray<T>(source: Observable<ApiResponse<any>>, normalizer: (item: any) => T): Observable<ApiResponse<T[]>> {
    return source.pipe(map(res => ({
      ...res,
      data: Array.isArray(res.data) ? res.data.map(item => normalizer(item)) : []
    })));
  }

  private mapItem<T>(source: Observable<ApiResponse<any>>, normalizer: (item: any) => T): Observable<ApiResponse<T>> {
    return source.pipe(map(res => ({
      ...res,
      data: res.data ? normalizer(res.data) : undefined
    })));
  }

  // ── Segments ────────────────────────────────────────────────────────────

  getSegments(includeInactive = false): Observable<ApiResponse<SegmentItem[]>> {
    return this.mapArray(this.http.get<ApiResponse<any[]>>(
      this.url('segments'),
      { headers: this.headers(), params: { includeInactive } }
    ), item => this.normalizeSegment(item));
  }

  saveSegment(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<SegmentItem>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.url(`segments/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.url('segments'), body, { headers: h }),
      item => this.normalizeSegment(item)
    );
  }

  batchSaveSegments(segments: Record<string, any>[]): Observable<ApiResponse<SegmentItem[]>> {
    return this.mapArray(this.http.post<ApiResponse<any[]>>(
      this.url('segments/batch'), this.toApiValue({ segments }), { headers: this.headers() }
    ), item => this.normalizeSegment(item));
  }

  // ── HSN/SAC ─────────────────────────────────────────────────────────────

  getHsnSac(search?: string, includeInactive = false): Observable<ApiResponse<HsnSacItem[]>> {
    let params = new HttpParams().set('includeInactive', includeInactive);
    if (search) params = params.set('search', search);
    return this.mapArray(
      this.http.get<ApiResponse<any[]>>(this.url('hsnsac'), { headers: this.headers(), params }),
      item => this.normalizeHsnSac(item)
    );
  }

  saveHsnSac(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<HsnSacItem>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.url(`hsnsac/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.url('hsnsac'), body, { headers: h }),
      item => this.normalizeHsnSac(item)
    );
  }

  quickAddHsnSac(code: string, hsnType: string, description: string, gstRate: number): Observable<ApiResponse<HsnSacItem>> {
    return this.mapItem(this.http.post<ApiResponse<any>>(
      this.url('hsnsac/quick'),
      { code, hsnType, description, gstRate },
      { headers: this.headers() }
    ), item => this.normalizeHsnSac(item));
  }

  // ── Categories ──────────────────────────────────────────────────────────

  searchTaxCodes(q: string, type?: 'HSN' | 'SAC' | '', limit = 10, category?: string): Observable<ApiResponse<TaxCodeSuggestion[]>> {
    let params = new HttpParams()
      .set('q', q)
      .set('limit', Math.min(Math.max(limit, 1), 10));

    if (type) {
      params = params.set('type', type);
    }
    if (category) {
      params = params.set('category', category);
    }

    return this.mapArray(
      this.http.get<ApiResponse<any[]>>(this.taxCodeUrl('search'), { headers: this.headers(), params }),
      item => this.normalizeTaxCode(item)
    );
  }

  getGstGuide(): Observable<ApiResponse<GstRateGuide>> {
    return this.mapItem(
      this.http.get<ApiResponse<any>>(this.taxCodeUrl('gst-guide'), { headers: this.headers() }),
      item => this.normalizeGstGuide(item)
    );
  }

  importTaxCodes(file: File, source?: string, sourceUpdatedAt?: string): Observable<ApiResponse<TaxCodeImportSummary>> {
    const formData = new FormData();
    formData.append('file', file);
    if (source) formData.append('source', source);
    if (sourceUpdatedAt) formData.append('sourceUpdatedAt', sourceUpdatedAt);

    return this.mapItem(
      this.http.post<ApiResponse<any>>(this.taxCodeUrl('import'), formData, { headers: this.headers() }),
      item => this.normalizeTaxCodeImportSummary(item)
    );
  }

  getTaxCodeSourceStatus(): Observable<ApiResponse<TaxCodeSourceStatus>> {
    return this.mapItem(
      this.http.get<ApiResponse<any>>(this.taxCodeUrl('source-status'), { headers: this.headers() }),
      item => this.normalizeTaxCodeSourceStatus(item)
    );
  }

  getCategories(includeInactive = false): Observable<ApiResponse<CategoryItem[]>> {
    return this.mapArray(this.http.get<ApiResponse<any[]>>(
      this.url('categories'),
      { headers: this.headers(), params: { includeInactive } }
    ), item => this.normalizeCategory(item));
  }

  quickAddCategory(categoryName: string, segmentId?: number | null): Observable<ApiResponse<CategoryItem>> {
    return this.mapItem(this.http.post<ApiResponse<any>>(
      this.url('categories/quick'), { categoryName, segmentId }, { headers: this.headers() }
    ), item => this.normalizeCategory(item));
  }

  saveCategory(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<CategoryItem>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.url(`categories/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.url('categories'), body, { headers: h }),
      item => this.normalizeCategory(item)
    );
  }

  // ── UOM ─────────────────────────────────────────────────────────────────

  getUoms(includeInactive = false, segmentId?: number | null): Observable<ApiResponse<UomItem[]>> {
    let params = new HttpParams().set('includeInactive', includeInactive);
    if (segmentId) params = params.set('segmentId', segmentId);
    return this.mapArray(this.http.get<ApiResponse<any[]>>(
      this.url('uom'),
      { headers: this.headers(), params }
    ), item => this.normalizeUom(item));
  }

  quickAddUom(uomName: string, uomSymbol?: string, segmentId?: number | null): Observable<ApiResponse<UomItem>> {
    return this.mapItem(this.http.post<ApiResponse<any>>(
      this.url('uom/quick'), { uomName, uomSymbol, segmentId }, { headers: this.headers() }
    ), item => this.normalizeUom(item));
  }

  saveUom(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<UomItem>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.url(`uom/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.url('uom'), body, { headers: h }),
      item => this.normalizeUom(item)
    );
  }

  // ── Warehouses ──────────────────────────────────────────────────────────

  getWarehouses(includeInactive = false): Observable<ApiResponse<WarehouseItem[]>> {
    return this.mapArray(this.http.get<ApiResponse<any[]>>(
      this.url('warehouses'),
      { headers: this.headers(), params: { includeInactive } }
    ), item => this.normalizeWarehouse(item));
  }

  saveWarehouse(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<WarehouseItem>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.url(`warehouses/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.url('warehouses'), body, { headers: h }),
      item => this.normalizeWarehouse(item)
    );
  }

  batchSaveWarehouses(warehouses: Record<string, any>[]): Observable<ApiResponse<WarehouseItem[]>> {
    return this.mapArray(this.http.post<ApiResponse<any[]>>(
      this.url('warehouses/batch'), this.toApiValue({ warehouses }), { headers: this.headers() }
    ), item => this.normalizeWarehouse(item));
  }

  // ── Company Details ─────────────────────────────────────────────────────

  getCompanyDetails(): Observable<ApiResponse<CompanyDetails>> {
    return this.mapItem(
      this.http.get<ApiResponse<any>>(this.url('company-details'), { headers: this.headers() }),
      item => this.normalizeCompanyDetails(item)
    );
  }

  // ── Branches ────────────────────────────────────────────────────────────

  getBranchesInv(includeInactive = false): Observable<ApiResponse<BranchInvItem[]>> {
    return this.mapArray(this.http.get<ApiResponse<any[]>>(
      this.url('branches'),
      { headers: this.headers(), params: { includeInactive } }
    ), item => this.normalizeBranch(item));
  }

  saveBranchInv(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<BranchInvItem>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.url(`branches/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.url('branches'), body, { headers: h }),
      item => this.normalizeBranch(item)
    );
  }

  batchSaveBranchesInv(branches: Record<string, any>[]): Observable<ApiResponse<BranchInvItem[]>> {
    return this.mapArray(this.http.post<ApiResponse<any[]>>(
      this.url('branches/batch'), this.toApiValue({ branches }), { headers: this.headers() }
    ), item => this.normalizeBranch(item));
  }

  // ── Masters URL helper ───────────────────────────────────────────────────

  private masterUrl(path: string): string {
    return `${this.base()}/inventory/masters/${path}`;
  }

  // ── Normalizers ──────────────────────────────────────────────────────────

  private normalizePaymentTerm(item: any): PaymentTermItem {
    return {
      id: item?.id,
      term_code: this.value(item, 'term_code', 'termCode', ''),
      term_name: this.value(item, 'term_name', 'termName', ''),
      credit_days: this.value(item, 'credit_days', 'creditDays', 0),
      discount_pct: this.value(item, 'discount_pct', 'discountPct', 0),
      description: this.value(item, 'description', 'description'),
      status: this.value(item, 'status', 'status', 'active')
    };
  }

  private normalizeBrand(item: any): BrandItem {
    return {
      id: item?.id,
      segment_id: this.value(item, 'segment_id', 'segmentId'),
      segment_name: this.value(item, 'segment_name', 'segmentName'),
      brand_code: this.value(item, 'brand_code', 'brandCode', ''),
      brand_name: this.value(item, 'brand_name', 'brandName', ''),
      manufacturer: this.value(item, 'manufacturer', 'manufacturer'),
      description: this.value(item, 'description', 'description'),
      status: this.value(item, 'status', 'status', 'active')
    };
  }

  private normalizeAttribute(item: any): AttributeItem {
    const values = (this.value<any[]>(item, 'values', 'values', []) ?? []).map(row => ({
      id: row?.id,
      value_code: this.value(row, 'value_code', 'valueCode'),
      value_name: this.value(row, 'value_name', 'valueName', ''),
      status: this.value(row, 'status', 'status', 'active'),
      sort_order: this.value(row, 'sort_order', 'sortOrder', 100),
      usage_count: this.value(row, 'usage_count', 'usageCount', 0)
    }));
    return {
      id: item?.id,
      segment_id: this.value(item, 'segment_id', 'segmentId'),
      segment_name: this.value(item, 'segment_name', 'segmentName'),
      attribute_code: this.value(item, 'attribute_code', 'attributeCode'),
      attribute_name: this.value(item, 'attribute_name', 'attributeName', ''),
      attribute_type: this.value(item, 'attribute_type', 'attributeType', 'Text'),
      display_order: this.value(item, 'display_order', 'displayOrder', 100),
      possible_values: this.normalizeStringList(this.value(item, 'possible_values', 'possibleValues', [])),
      values,
      is_mandatory: this.value(item, 'is_mandatory', 'isMandatory', false),
      status: this.value(item, 'status', 'status', 'active')
    };
  }

  private normalizeProductGroup(item: any): ProductGroupItem {
    return {
      id: item?.id,
      segment_id: this.value(item, 'segment_id', 'segmentId'),
      segment_name: this.value(item, 'segment_name', 'segmentName'),
      category_id: this.value(item, 'category_id', 'categoryId'),
      category_name: this.value(item, 'category_name', 'categoryName'),
      group_code: this.value(item, 'group_code', 'groupCode', ''),
      group_name: this.value(item, 'group_name', 'groupName', ''),
      description: this.value(item, 'description', 'description'),
      status: this.value(item, 'status', 'status', 'active')
    };
  }

  private normalizeVariant(item: any): VariantItem {
    const attributes = (this.value<any[]>(item, 'attributes', 'attributes', []) ?? []).map(row => ({
      attribute_id: this.value(row, 'attribute_id', 'attributeId'),
      attribute_name: this.value(row, 'attribute_name', 'attributeName'),
      attribute_value_id: this.value(row, 'attribute_value_id', 'attributeValueId'),
      value_code: this.value(row, 'value_code', 'valueCode'),
      value_name: this.value(row, 'value_name', 'valueName'),
      attribute_value: this.value(row, 'attribute_value', 'attributeValue'),
      value_status: this.value(row, 'value_status', 'valueStatus'),
      attribute_type: this.value(row, 'attribute_type', 'attributeType', 'Text'),
      possible_values: this.normalizeStringList(this.value(row, 'possible_values', 'possibleValues', [])),
      usage_count: this.value(row, 'usage_count', 'usageCount', 0),
      display_order: this.value(row, 'display_order', 'displayOrder', 1)
    }));
    return {
      id: item?.id,
      segment_id: this.value(item, 'segment_id', 'segmentId'),
      segment_name: this.value(item, 'segment_name', 'segmentName'),
      product_id: this.value(item, 'product_id', 'productId'),
      product_code: this.value(item, 'product_code', 'productCode'),
      product_name: this.value(item, 'product_name', 'productName'),
      attribute_id: this.value(item, 'attribute_id', 'attributeId'),
      attribute_name: this.value(item, 'attribute_name', 'attributeName'),
      variant_code: this.value(item, 'variant_code', 'variantCode', ''),
      variant_name: this.value(item, 'variant_name', 'variantName', ''),
      sku: this.value(item, 'sku', 'sku'),
      sku_pattern: this.value(item, 'sku_pattern', 'skuPattern'),
      barcode: this.value(item, 'barcode', 'barcode'),
      price: this.value(item, 'price', 'price', 0),
      cost: this.value(item, 'cost', 'cost', 0),
      stock_on_hand: this.value(item, 'stock_on_hand', 'stockOnHand', this.value(item, 'stock', 'stock', 0)),
      stock: this.value(item, 'stock', 'stock', this.value(item, 'stock_on_hand', 'stockOnHand', 0)),
      images: this.normalizeStringList(this.value(item, 'images', 'images', [])),
      variant_label: this.value(item, 'variant_label', 'variantLabel'),
      attribute_value: this.value(item, 'attribute_value', 'attributeValue'),
      attributes,
      combination_hash: this.value(item, 'combination_hash', 'combinationHash'),
      is_generated: this.value(item, 'is_generated', 'isGenerated', false),
      description: this.value(item, 'description', 'description'),
      status: this.value(item, 'status', 'status', 'active')
    };
  }

  private normalizeVariantCombinationResult(item: any): VariantCombinationGenerateResult {
    const rows = (this.value<any[]>(item, 'rows', 'rows', []) ?? []).map(row => ({
      variant_id: this.value(row, 'variant_id', 'variantId'),
      product_id: this.value(row, 'product_id', 'productId', 0),
      variant_name: this.value(row, 'variant_name', 'variantName', ''),
      sku: this.value(row, 'sku', 'sku'),
      combination_hash: this.value(row, 'combination_hash', 'combinationHash', ''),
      exists: this.value(row, 'exists', 'exists', false),
      created: this.value(row, 'created', 'created', false),
      attributes: (this.value<any[]>(row, 'attributes', 'attributes', []) ?? []).map(attr => ({
        attribute_id: this.value(attr, 'attribute_id', 'attributeId'),
        attribute_name: this.value(attr, 'attribute_name', 'attributeName'),
        attribute_value_id: this.value(attr, 'attribute_value_id', 'attributeValueId'),
        value_code: this.value(attr, 'value_code', 'valueCode'),
        value_name: this.value(attr, 'value_name', 'valueName'),
        attribute_value: this.value(attr, 'attribute_value', 'attributeValue'),
        display_order: this.value(attr, 'display_order', 'displayOrder', 1)
      }))
    }));
    return {
      product_id: this.value(item, 'product_id', 'productId', 0),
      product_code: this.value(item, 'product_code', 'productCode'),
      product_name: this.value(item, 'product_name', 'productName'),
      total: this.value(item, 'total', 'total', rows.length),
      new_count: this.value(item, 'new_count', 'newCount', 0),
      existing_count: this.value(item, 'existing_count', 'existingCount', 0),
      created_count: this.value(item, 'created_count', 'createdCount', 0),
      rows
    };
  }

  private normalizeSerialPolicy(item: any): SerialPolicyItem {
    return {
      id: item?.id,
      segment_id: this.value(item, 'segment_id', 'segmentId'),
      segment_name: this.value(item, 'segment_name', 'segmentName'),
      category_id: this.value(item, 'category_id', 'categoryId'),
      category_name: this.value(item, 'category_name', 'categoryName'),
      policy_code: this.value(item, 'policy_code', 'policyCode', ''),
      policy_name: this.value(item, 'policy_name', 'policyName', ''),
      serial_format: this.value(item, 'serial_format', 'serialFormat'),
      capture_stage: this.value(item, 'capture_stage', 'captureStage'),
      allow_duplicate: this.value(item, 'allow_duplicate', 'allowDuplicate', false),
      warranty_applicable: this.value(item, 'warranty_applicable', 'warrantyApplicable', false),
      description: this.value(item, 'description', 'description'),
      status: this.value(item, 'status', 'status', 'active')
    };
  }

  private normalizeBatchPolicy(item: any): BatchPolicyItem {
    return {
      id: item?.id,
      segment_id: this.value(item, 'segment_id', 'segmentId'),
      segment_name: this.value(item, 'segment_name', 'segmentName'),
      category_id: this.value(item, 'category_id', 'categoryId'),
      category_name: this.value(item, 'category_name', 'categoryName'),
      policy_code: this.value(item, 'policy_code', 'policyCode', ''),
      policy_name: this.value(item, 'policy_name', 'policyName', ''),
      batch_format: this.value(item, 'batch_format', 'batchFormat'),
      expiry_required: this.value(item, 'expiry_required', 'expiryRequired', false),
      qc_required: this.value(item, 'qc_required', 'qcRequired', false),
      description: this.value(item, 'description', 'description'),
      status: this.value(item, 'status', 'status', 'active')
    };
  }

  private normalizeBarcodeConfiguration(item: any): BarcodeConfigurationItem {
    return {
      id: item?.id,
      barcode_type: this.value(item, 'barcode_type', 'barcodeType', ''),
      auto_generate: this.value(item, 'auto_generate', 'autoGenerate', true),
      prefix: this.value(item, 'prefix', 'prefix'),
      starting_number: this.value(item, 'starting_number', 'startingNumber', 1),
      length: this.value(item, 'length', 'length', 12),
      applicable_products: this.value(item, 'applicable_products', 'applicableProducts', []) ?? [],
      status: this.value(item, 'status', 'status', 'active')
    };
  }

  private normalizeSubstituteProduct(item: any): SubstituteProductItem {
    return {
      id: item?.id,
      product_id: this.value(item, 'product_id', 'productId'),
      product_name: this.value(item, 'product_name', 'productName', ''),
      substitute_product_id: this.value(item, 'substitute_product_id', 'substituteProductId'),
      substitute_product_name: this.value(item, 'substitute_product_name', 'substituteProductName', ''),
      priority: this.value(item, 'priority', 'priority', 1),
      remarks: this.value(item, 'remarks', 'remarks'),
      status: this.value(item, 'status', 'status', 'active')
    };
  }

  private normalizeConsumptionType(item: any): ConsumptionTypeItem {
    return {
      id: item?.id,
      segment_id: this.value(item, 'segment_id', 'segmentId'),
      segment_name: this.value(item, 'segment_name', 'segmentName'),
      type_code: this.value(item, 'type_code', 'typeCode', ''),
      type_name: this.value(item, 'type_name', 'typeName', ''),
      department: this.value(item, 'department', 'department'),
      approval_required: this.value(item, 'approval_required', 'approvalRequired', false),
      remarks: this.value(item, 'remarks', 'remarks'),
      status: this.value(item, 'status', 'status', 'active')
    };
  }

  private normalizeVendor(item: any): VendorItem {
    return {
      id: item?.id,
      segment_id: this.value(item, 'segment_id', 'segmentId'),
      segment_name: this.value(item, 'segment_name', 'segmentName'),
      payment_term_id: this.value(item, 'payment_term_id', 'paymentTermId'),
      payment_term_name: this.value(item, 'payment_term_name', 'paymentTermName'),
      vendor_code: this.value(item, 'vendor_code', 'vendorCode', ''),
      vendor_name: this.value(item, 'vendor_name', 'vendorName', ''),
      vendor_type: this.value(item, 'vendor_type', 'vendorType', 'Company'),
      vendor_category: this.value(item, 'vendor_category', 'vendorCategory'),
      gstin: this.value(item, 'gstin', 'gstin'),
      gstins: this.value(item, 'gstins', 'gstins', []),
      pan: this.value(item, 'pan', 'pan'),
      mobile: this.value(item, 'mobile', 'mobile'),
      email: this.value(item, 'email', 'email'),
      address: this.value(item, 'address', 'address'),
      city: this.value(item, 'city', 'city'),
      state: this.value(item, 'state', 'state'),
      district: this.value(item, 'district', 'district'),
      pincode: this.value(item, 'pincode', 'pincode'),
      credit_limit: this.value(item, 'credit_limit', 'creditLimit', 0),
      bank_details: this.value(item, 'bank_details', 'bankDetails'),
      bank_payee_name: this.value(item, 'bank_payee_name', 'bankPayeeName'),
      bank_account_no: this.value(item, 'bank_account_no', 'bankAccountNo'),
      bank_ifsc_code: this.value(item, 'bank_ifsc_code', 'bankIfscCode'),
      bank_name: this.value(item, 'bank_name', 'bankName'),
      bank_branch_name: this.value(item, 'bank_branch_name', 'bankBranchName'),
      contact_name: this.value(item, 'contact_name', 'contactName'),
      contact_mobile: this.value(item, 'contact_mobile', 'contactMobile'),
      contact_email: this.value(item, 'contact_email', 'contactEmail'),
      contact_id: this.value(item, 'contact_id', 'contactId'),
      contact_source: this.value(item, 'contact_source', 'contactSource'),
      status: this.value(item, 'status', 'status', 'active')
    };
  }

  private normalizeChannelPartner(item: any): ChannelPartnerItem {
    return {
      id: item?.id,
      segment_id: this.value(item, 'segment_id', 'segmentId'),
      segment_name: this.value(item, 'segment_name', 'segmentName'),
      payment_term_id: this.value(item, 'payment_term_id', 'paymentTermId'),
      payment_term_name: this.value(item, 'payment_term_name', 'paymentTermName'),
      partner_code: this.value(item, 'partner_code', 'partnerCode', ''),
      partner_name: this.value(item, 'partner_name', 'partnerName', ''),
      partner_type: this.value(item, 'partner_type', 'partnerType', 'Company'),
      partner_category: this.value(item, 'partner_category', 'partnerCategory'),
      gstin: this.value(item, 'gstin', 'gstin'),
      pan: this.value(item, 'pan', 'pan'),
      mobile: this.value(item, 'mobile', 'mobile'),
      email: this.value(item, 'email', 'email'),
      address: this.value(item, 'address', 'address'),
      city: this.value(item, 'city', 'city'),
      state: this.value(item, 'state', 'state'),
      district: this.value(item, 'district', 'district'),
      pincode: this.value(item, 'pincode', 'pincode'),
      credit_limit: this.value(item, 'credit_limit', 'creditLimit', 0),
      bank_details: this.value(item, 'bank_details', 'bankDetails'),
      contact_name: this.value(item, 'contact_name', 'contactName'),
      contact_mobile: this.value(item, 'contact_mobile', 'contactMobile'),
      contact_email: this.value(item, 'contact_email', 'contactEmail'),
      contact_id: this.value(item, 'contact_id', 'contactId'),
      contact_source: this.value(item, 'contact_source', 'contactSource'),
      status: this.value(item, 'status', 'status', 'active')
    };
  }

  private normalizeContact(item: any): ContactItem {
    return {
      id: item?.id,
      contact_type: this.value(item, 'contact_type', 'contactType', 'Individual'),
      name: this.value(item, 'name', 'name', ''),
      mobile: this.value(item, 'mobile', 'mobile'),
      email: this.value(item, 'email', 'email'),
      gstin: this.value(item, 'gstin', 'gstin'),
      pan: this.value(item, 'pan', 'pan'),
      address: this.value(item, 'address', 'address'),
      city: this.value(item, 'city', 'city'),
      state: this.value(item, 'state', 'state'),
      pincode: this.value(item, 'pincode', 'pincode'),
      is_supplier: this.value(item, 'is_supplier', 'isSupplier', false),
      is_customer: this.value(item, 'is_customer', 'isCustomer', false),
      is_channel_partner: this.value(item, 'is_channel_partner', 'isChannelPartner', false),
      is_lead_by: this.value(item, 'is_lead_by', 'isLeadBy', false),
      vendor_exists: this.value(item, 'vendor_exists', 'vendorExists', false),
      customer_exists: this.value(item, 'customer_exists', 'customerExists', false),
      channel_partner_exists: this.value(item, 'channel_partner_exists', 'channelPartnerExists', false),
      status: this.value(item, 'status', 'status', 'active')
    };
  }

  private normalizeCustomer(item: any): CustomerItem {
    return {
      id: item?.id,
      segment_id: this.value(item, 'segment_id', 'segmentId'),
      segment_name: this.value(item, 'segment_name', 'segmentName'),
      payment_term_id: this.value(item, 'payment_term_id', 'paymentTermId'),
      payment_term_name: this.value(item, 'payment_term_name', 'paymentTermName'),
      customer_code: this.value(item, 'customer_code', 'customerCode', ''),
      customer_name: this.value(item, 'customer_name', 'customerName', ''),
      customer_type: this.value(item, 'customer_type', 'customerType', 'Company'),
      customer_category: this.value(item, 'customer_category', 'customerCategory'),
      gstin: this.value(item, 'gstin', 'gstin'),
      gstins: this.value(item, 'gstins', 'gstins', []),
      pan: this.value(item, 'pan', 'pan'),
      mobile: this.value(item, 'mobile', 'mobile'),
      email: this.value(item, 'email', 'email'),
      address: this.value(item, 'address', 'address'),
      city: this.value(item, 'city', 'city'),
      state: this.value(item, 'state', 'state'),
      district: this.value(item, 'district', 'district'),
      pincode: this.value(item, 'pincode', 'pincode'),
      shipping_address: this.value(item, 'shipping_address', 'shippingAddress'),
      credit_limit: this.value(item, 'credit_limit', 'creditLimit', 0),
      bank_payee_name: this.value(item, 'bank_payee_name', 'bankPayeeName'),
      bank_account_no: this.value(item, 'bank_account_no', 'bankAccountNo'),
      bank_ifsc_code: this.value(item, 'bank_ifsc_code', 'bankIfscCode'),
      bank_name: this.value(item, 'bank_name', 'bankName'),
      bank_branch_name: this.value(item, 'bank_branch_name', 'bankBranchName'),
      contact_name: this.value(item, 'contact_name', 'contactName'),
      contact_mobile: this.value(item, 'contact_mobile', 'contactMobile'),
      contact_email: this.value(item, 'contact_email', 'contactEmail'),
      contact_id: this.value(item, 'contact_id', 'contactId'),
      contact_source: this.value(item, 'contact_source', 'contactSource'),
      status: this.value(item, 'status', 'status', 'active')
    };
  }

  private normalizeProduct(item: any): ProductItem {
    return {
      id: item?.id,
      segment_id: this.value(item, 'segment_id', 'segmentId'),
      segment_name: this.value(item, 'segment_name', 'segmentName'),
      category_id: this.value(item, 'category_id', 'categoryId'),
      category_name: this.value(item, 'category_name', 'categoryName'),
      base_uom_id: this.value(item, 'base_uom_id', 'baseUomId'),
      base_uom_name: this.value(item, 'base_uom_name', 'baseUomName'),
      base_uom_symbol: this.value(item, 'base_uom_symbol', 'baseUomSymbol'),
      brand_id: this.value(item, 'brand_id', 'brandId'),
      brand_name: this.value(item, 'brand_name', 'brandName'),
      variant_id: this.value(item, 'variant_id', 'variantId'),
      variant_name: this.value(item, 'variant_name', 'variantName'),
      variant_label: this.value(item, 'variant_label', 'variantLabel'),
      hsn_sac_id: this.value(item, 'hsn_sac_id', 'hsnSacId'),
      hsn_sac_code: this.value(item, 'hsn_sac_code', 'hsnSacCode'),
      serial_policy_id: this.value(item, 'serial_policy_id', 'serialPolicyId'),
      serial_policy_name: this.value(item, 'serial_policy_name', 'serialPolicyName'),
      batch_policy_id: this.value(item, 'batch_policy_id', 'batchPolicyId'),
      batch_policy_name: this.value(item, 'batch_policy_name', 'batchPolicyName'),
      product_code: this.value(item, 'product_code', 'productCode', ''),
      sku: this.value(item, 'sku', 'sku', ''),
      product_name: this.value(item, 'product_name', 'productName', ''),
      product_type: this.value(item, 'product_type', 'productType', 'Product'),
      product_nature_id: this.value(item, 'product_nature_id', 'productNatureId'),
      product_nature_name: this.value(item, 'product_nature_name', 'productNatureName'),
      tracks_inventory: this.value(item, 'tracks_inventory', 'tracksInventory'),
      tracks_cost: this.value(item, 'tracks_cost', 'tracksCost'),
      is_service: this.value(item, 'is_service', 'isService'),
      is_asset: this.value(item, 'is_asset', 'isAsset'),
      allows_purchase: this.value(item, 'allows_purchase', 'allowsPurchase'),
      allows_sale: this.value(item, 'allows_sale', 'allowsSale'),
      allows_production: this.value(item, 'allows_production', 'allowsProduction'),
      item_status: this.value(item, 'item_status', 'itemStatus', 'active'),
      valuation_method: this.value(item, 'valuation_method', 'valuationMethod'),
      gst_rate: this.value(item, 'gst_rate', 'gstRate'),
      tax_category: this.value(item, 'tax_category', 'taxCategory'),
      mrp: this.value(item, 'mrp', 'mrp'),
      selling_price: this.value(item, 'selling_price', 'sellingPrice'),
      sellingPrice: this.value(item, 'selling_price', 'sellingPrice'),
      sale_price: this.value(item, 'sale_price', 'salePrice'),
      price: this.value(item, 'price', 'price'),
      cost_price: this.value(item, 'cost_price', 'costPrice'),
      costPrice: this.value(item, 'cost_price', 'costPrice'),
      reorder_level: this.value(item, 'reorder_level', 'reorderLevel', 0),
      reorder_qty: this.value(item, 'reorder_qty', 'reorderQty', 0),
      max_stock_level: this.value(item, 'max_stock_level', 'maxStockLevel', 0),
      min_stock_level: this.value(item, 'min_stock_level', 'minStockLevel', 0),
      batch_applicable: this.value(item, 'batch_applicable', 'batchApplicable', false),
      serial_applicable: this.value(item, 'serial_applicable', 'serialApplicable', false),
      expiry_applicable: this.value(item, 'expiry_applicable', 'expiryApplicable', false),
      qc_required: this.value(item, 'qc_required', 'qcRequired', false),
      warranty_applicable: this.value(item, 'warranty_applicable', 'warrantyApplicable', false),
      pricing_type: this.value(item, 'pricing_type', 'pricingType'),
      rental_unit: this.value(item, 'rental_unit', 'rentalUnit'),
      description: this.value(item, 'description', 'description'),
      uom_conversions: (item?.uom_conversions || item?.uomConversions || []).map((c: any) => this.normalizeProductUomConversion(c)),
      applicable_variants: (item?.applicable_variants || item?.applicableVariants || []).map((v: any) => ({
        id: this.value(v, 'id', 'id', 0),
        variant_name: this.value(v, 'variant_name', 'variantName', ''),
        variant_label: this.value(v, 'variant_label', 'variantLabel', ''),
        is_default: this.value(v, 'is_default', 'isDefault', false),
        attributes: (this.value<any[]>(v, 'attributes', 'attributes', []) ?? []).map((a: any) => ({
          attribute_name: this.value(a, 'attribute_name', 'attributeName', ''),
          attribute_value: this.value(a, 'attribute_value', 'attributeValue', ''),
        } as ProductVariantStockAttribute)),
      } as ProductApplicableVariant)),
      bundle_composition: (item?.bundle_composition || item?.bundleComposition || []).map((b: any) => ({
        item_id: this.value(b, 'item_id', 'itemId', 0),
        item_name: this.value(b, 'item_name', 'itemName', ''),
        quantity: this.value(b, 'quantity', 'quantity', 1),
        condition_tracked: this.value(b, 'condition_tracked', 'conditionTracked', false),
        depreciation_linked: this.value(b, 'depreciation_linked', 'depreciationLinked', false),
      } as ProductBundleItem)),
      variant_stock_controls: (item?.variant_stock_controls || item?.variantStockControls || []).map((s: any) => ({
        variant_id: this.value(s, 'variant_id', 'variantId', 0),
        variant_name: this.value(s, 'variant_name', 'variantName', ''),
        variant_label: this.value(s, 'variant_label', 'variantLabel', ''),
        attributes: (this.value<any[]>(s, 'attributes', 'attributes', []) ?? []).map((a: any) => ({
          attribute_name: this.value(a, 'attribute_name', 'attributeName', ''),
          attribute_value: this.value(a, 'attribute_value', 'attributeValue', ''),
        } as ProductVariantStockAttribute)),
        min_stock_level: this.value(s, 'min_stock_level', 'minStockLevel', 0),
        max_stock_level: this.value(s, 'max_stock_level', 'maxStockLevel', 0),
        reorder_level: this.value(s, 'reorder_level', 'reorderLevel', 0),
        reorder_qty: this.value(s, 'reorder_qty', 'reorderQty', 0),
      } as ProductVariantStockControl)),
      status: this.value(item, 'status', 'status', 'active'),
      locked_for_edit: this.value(item, 'locked_for_edit', 'lockedForEdit', false)
    };
  }

  // ── Payment Terms ────────────────────────────────────────────────────────

  getPaymentTerms(includeInactive = false): Observable<ApiResponse<PaymentTermItem[]>> {
    return this.mapArray(this.http.get<ApiResponse<any[]>>(
      this.masterUrl('payment-terms'),
      { headers: this.headers(), params: { includeInactive } }
    ), item => this.normalizePaymentTerm(item));
  }

  savePaymentTerm(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<PaymentTermItem>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.masterUrl(`payment-terms/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.masterUrl('payment-terms'), body, { headers: h }),
      item => this.normalizePaymentTerm(item)
    );
  }

  // ── Brands ───────────────────────────────────────────────────────────────

  getBrands(segmentId?: number | null, includeInactive = false): Observable<ApiResponse<BrandItem[]>> {
    let params = new HttpParams().set('includeInactive', includeInactive);
    if (segmentId) params = params.set('segmentId', segmentId);
    return this.mapArray(this.http.get<ApiResponse<any[]>>(
      this.masterUrl('brands'), { headers: this.headers(), params }
    ), item => this.normalizeBrand(item));
  }

  saveBrand(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<BrandItem>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.masterUrl(`brands/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.masterUrl('brands'), body, { headers: h }),
      item => this.normalizeBrand(item)
    );
  }

  // ── Attributes ───────────────────────────────────────────────────────────

  getAttributes(segmentId?: number | null, includeInactive = false): Observable<ApiResponse<AttributeItem[]>> {
    let params = new HttpParams().set('includeInactive', includeInactive);
    if (segmentId) params = params.set('segmentId', segmentId);
    return this.mapArray(this.http.get<ApiResponse<any[]>>(
      this.masterUrl('attributes'), { headers: this.headers(), params }
    ), item => this.normalizeAttribute(item));
  }

  saveAttribute(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<AttributeItem>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.masterUrl(`attributes/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.masterUrl('attributes'), body, { headers: h }),
      item => this.normalizeAttribute(item)
    );
  }

  // ── Product Groups ───────────────────────────────────────────────────────

  getProductGroups(segmentId?: number | null, categoryId?: number | null, includeInactive = false): Observable<ApiResponse<ProductGroupItem[]>> {
    let params = new HttpParams().set('includeInactive', includeInactive);
    if (segmentId) params = params.set('segmentId', segmentId);
    if (categoryId) params = params.set('categoryId', categoryId);
    return this.mapArray(this.http.get<ApiResponse<any[]>>(
      this.masterUrl('product-groups'), { headers: this.headers(), params }
    ), item => this.normalizeProductGroup(item));
  }

  saveProductGroup(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<ProductGroupItem>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.masterUrl(`product-groups/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.masterUrl('product-groups'), body, { headers: h }),
      item => this.normalizeProductGroup(item)
    );
  }

  // ── Variants ─────────────────────────────────────────────────────────────

  getVariants(segmentId?: number | null, attributeId?: number | null, includeInactive = false, productId?: number | null): Observable<ApiResponse<VariantItem[]>> {
    let params = new HttpParams().set('includeInactive', includeInactive);
    if (segmentId) params = params.set('segmentId', segmentId);
    if (attributeId) params = params.set('attributeId', attributeId);
    if (productId) params = params.set('productId', productId);
    return this.mapArray(this.http.get<ApiResponse<any[]>>(
      this.masterUrl('variants'), { headers: this.headers(), params }
    ), item => this.normalizeVariant(item));
  }

  saveVariant(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<VariantItem>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.masterUrl(`variants/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.masterUrl('variants'), body, { headers: h }),
      item => this.normalizeVariant(item)
    );
  }

  generateVariantCombinations(payload: { product_id: number; sku_pattern?: string | null; create_variants?: boolean; selections: Array<Record<string, any>> }): Observable<ApiResponse<VariantCombinationGenerateResult>> {
    return this.mapItem(
      this.http.post<ApiResponse<any>>(
        this.masterUrl('variants/generate-combinations'),
        this.toApiValue(payload),
        { headers: this.headers() }
      ),
      item => this.normalizeVariantCombinationResult(item)
    );
  }

  // ── Serial Policies ──────────────────────────────────────────────────────

  bulkImportAttributeVariants(rows: Array<Record<string, any>>): Observable<ApiResponse<AttributeVariantBulkImportResult>> {
    return this.http.post<ApiResponse<any>>(
      this.masterUrl('attribute-variants/bulk-import'),
      this.toApiValue({ rows }),
      { headers: this.headers() }
    ).pipe(map(res => ({
      ...res,
      data: {
        total_rows: this.value(res.data, 'total_rows', 'totalRows', rows.length),
        imported: this.value(res.data, 'imported', 'imported', 0),
        updated: this.value(res.data, 'updated', 'updated', 0),
        skipped: this.value(res.data, 'skipped', 'skipped', 0),
        invalid_rows: this.value(res.data, 'invalid_rows', 'invalidRows', [])
      }
    })));
  }

  getSerialPolicies(segmentId?: number | null, categoryId?: number | null, includeInactive = false): Observable<ApiResponse<SerialPolicyItem[]>> {
    let params = new HttpParams().set('includeInactive', includeInactive);
    if (segmentId) params = params.set('segmentId', segmentId);
    if (categoryId) params = params.set('categoryId', categoryId);
    return this.mapArray(this.http.get<ApiResponse<any[]>>(
      this.masterUrl('serial-policies'), { headers: this.headers(), params }
    ), item => this.normalizeSerialPolicy(item));
  }

  saveSerialPolicy(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<SerialPolicyItem>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.masterUrl(`serial-policies/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.masterUrl('serial-policies'), body, { headers: h }),
      item => this.normalizeSerialPolicy(item)
    );
  }

  // ── Batch Policies ───────────────────────────────────────────────────────

  getBatchPolicies(segmentId?: number | null, categoryId?: number | null, includeInactive = false): Observable<ApiResponse<BatchPolicyItem[]>> {
    let params = new HttpParams().set('includeInactive', includeInactive);
    if (segmentId) params = params.set('segmentId', segmentId);
    if (categoryId) params = params.set('categoryId', categoryId);
    return this.mapArray(this.http.get<ApiResponse<any[]>>(
      this.masterUrl('batch-policies'), { headers: this.headers(), params }
    ), item => this.normalizeBatchPolicy(item));
  }

  saveBatchPolicy(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<BatchPolicyItem>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.masterUrl(`batch-policies/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.masterUrl('batch-policies'), body, { headers: h }),
      item => this.normalizeBatchPolicy(item)
    );
  }

  // ── Consumption Types ────────────────────────────────────────────────────

  getBarcodeConfigurations(includeInactive = false): Observable<ApiResponse<BarcodeConfigurationItem[]>> {
    return this.mapArray(this.http.get<ApiResponse<any[]>>(
      this.masterUrl('barcode-configurations'), { headers: this.headers(), params: { includeInactive } }
    ), item => this.normalizeBarcodeConfiguration(item));
  }

  saveBarcodeConfiguration(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<BarcodeConfigurationItem>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.masterUrl(`barcode-configurations/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.masterUrl('barcode-configurations'), body, { headers: h }),
      item => this.normalizeBarcodeConfiguration(item)
    );
  }

  getSubstituteProducts(includeInactive = false): Observable<ApiResponse<SubstituteProductItem[]>> {
    return this.mapArray(this.http.get<ApiResponse<any[]>>(
      this.masterUrl('substitute-products'), { headers: this.headers(), params: { includeInactive } }
    ), item => this.normalizeSubstituteProduct(item));
  }

  saveSubstituteProduct(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<SubstituteProductItem>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.masterUrl(`substitute-products/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.masterUrl('substitute-products'), body, { headers: h }),
      item => this.normalizeSubstituteProduct(item)
    );
  }

  getConsumptionTypes(segmentId?: number | null, includeInactive = false): Observable<ApiResponse<ConsumptionTypeItem[]>> {
    let params = new HttpParams().set('includeInactive', includeInactive);
    if (segmentId) params = params.set('segmentId', segmentId);
    return this.mapArray(this.http.get<ApiResponse<any[]>>(
      this.masterUrl('consumption-types'), { headers: this.headers(), params }
    ), item => this.normalizeConsumptionType(item));
  }

  saveConsumptionType(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<ConsumptionTypeItem>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.masterUrl(`consumption-types/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.masterUrl('consumption-types'), body, { headers: h }),
      item => this.normalizeConsumptionType(item)
    );
  }

  // ── Vendors ──────────────────────────────────────────────────────────────

  getVendors(segmentId?: number | null, includeInactive = false): Observable<ApiResponse<VendorItem[]>> {
    let params = new HttpParams().set('includeInactive', includeInactive);
    if (segmentId) params = params.set('segmentId', segmentId);
    return this.mapArray(this.http.get<ApiResponse<any[]>>(
      this.masterUrl('vendors'), { headers: this.headers(), params }
    ), item => this.normalizeVendor(item));
  }

  saveVendor(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<VendorItem>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.masterUrl(`vendors/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.masterUrl('vendors'), body, { headers: h }),
      item => this.normalizeVendor(item)
    );
  }

  // ── Channel Partners ─────────────────────────────────────────────────────

  getChannelPartners(segmentId?: number | null, includeInactive = false): Observable<ApiResponse<ChannelPartnerItem[]>> {
    let params = new HttpParams().set('includeInactive', includeInactive);
    if (segmentId) params = params.set('segmentId', segmentId);
    return this.mapArray(this.http.get<ApiResponse<any[]>>(
      this.masterUrl('channel-partners'), { headers: this.headers(), params }
    ), item => this.normalizeChannelPartner(item));
  }

  saveChannelPartner(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<ChannelPartnerItem>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.masterUrl(`channel-partners/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.masterUrl('channel-partners'), body, { headers: h }),
      item => this.normalizeChannelPartner(item)
    );
  }

  // ── Global Contacts ──────────────────────────────────────────────────────

  getContacts(includeInactive = false): Observable<ApiResponse<ContactItem[]>> {
    const params = new HttpParams().set('includeInactive', includeInactive);
    return this.mapArray(this.http.get<ApiResponse<any[]>>(
      this.masterUrl('contacts'), { headers: this.headers(), params }
    ), item => this.normalizeContact(item));
  }

  saveContact(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<ContactItem>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.masterUrl(`contacts/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.masterUrl('contacts'), body, { headers: h }),
      item => this.normalizeContact(item)
    );
  }

  // Shared cross-app contacts (global.tbl_mst_contact) — a single pool, not
  // company/branch-scoped. Same ContactItem shape as getContacts() so
  // callers can merge both lists. Edits made from Vendor/Customer Master are
  // written back here via updateGlobalContact(), keeping this the single
  // source of truth rather than a one-time copy.
  getGlobalContacts(): Observable<ApiResponse<ContactItem[]>> {
    return this.mapArray(this.http.get<ApiResponse<any[]>>(
      this.masterUrl('global-contacts'), { headers: this.headers() }
    ), item => this.normalizeContact(item));
  }

  // Global Contacts' "Supplier / Vendor" tab lists only contacts with an active
  // global.tbl_mst_supplier row (per company/branch). Reuses the Accounts
  // Contacts screen's own endpoint so an Inventory vendor shows up there too.
  // The SP rejects a contact already registered for this company/branch --
  // callers treat that as success.
  markContactAsSupplier(contactId: number, pan?: string | null): Observable<unknown> {
    const params = new HttpParams()
      .set('globalSchema', 'global')
      .set('companyCode', sessionStorage.getItem('companyCode') ?? '')
      .set('branchCode', sessionStorage.getItem('branchCode') ?? '');
    return this.http.post(
      `${this.base()}/ContactMore/SaveContactSupplier`,
      { pContactId: String(contactId), pIsSupplier: true, pPanNumber: pan || null },
      { headers: this.headers(), params }
    );
  }

  // Global Contacts' "Lead By" tab (after Freelancer) lists contacts with an
  // active global.tbl_mst_lead_by row. Same endpoint shape as the Supplier
  // role above; an already-registered contact is likewise treated as success.
  markContactAsLeadBy(contactId: number, pan?: string | null): Observable<unknown> {
    const params = new HttpParams()
      .set('globalSchema', 'global')
      .set('companyCode', sessionStorage.getItem('companyCode') ?? '')
      .set('branchCode', sessionStorage.getItem('branchCode') ?? '');
    return this.http.post(
      `${this.base()}/ContactMore/SaveContactLeadBy`,
      { pContactId: String(contactId), pIsLeadBy: true, pPanNumber: pan || null },
      { headers: this.headers(), params }
    );
  }

  updateGlobalContact(payload: Record<string, any>, id: number): Observable<ApiResponse<ContactItem>> {
    const body = this.toApiValue(payload);
    return this.mapItem(
      this.http.put<ApiResponse<any>>(this.masterUrl(`contacts/global/${id}`), body, { headers: this.headers() }),
      item => this.normalizeContact(item)
    );
  }

  // Item 25: "+Add Global Contact" creates/updates directly in the real
  // global.tbl_mst_contact pool (via getGlobalContacts() above), not the
  // company-scoped inv_contacts saveContact() writes to — no id => create.
  saveGlobalContact(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<ContactItem>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.masterUrl(`contacts/global/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.masterUrl('contacts/global'), body, { headers: h }),
      item => this.normalizeContact(item)
    );
  }

  // ── Customers ────────────────────────────────────────────────────────────

  getCustomers(segmentId?: number | null, includeInactive = false): Observable<ApiResponse<CustomerItem[]>> {
    let params = new HttpParams().set('includeInactive', includeInactive);
    if (segmentId) params = params.set('segmentId', segmentId);
    return this.mapArray(this.http.get<ApiResponse<any[]>>(
      this.masterUrl('customers'), { headers: this.headers(), params }
    ), item => this.normalizeCustomer(item));
  }

  saveCustomer(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<CustomerItem>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.masterUrl(`customers/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.masterUrl('customers'), body, { headers: h }),
      item => this.normalizeCustomer(item)
    );
  }

  // ── Products ─────────────────────────────────────────────────────────────

  getProducts(segmentId?: number | null, categoryId?: number | null, includeInactive = false): Observable<ApiResponse<ProductItem[]>> {
    let params = new HttpParams().set('includeInactive', includeInactive);
    if (segmentId) params = params.set('segmentId', segmentId);
    if (categoryId) params = params.set('categoryId', categoryId);
    return this.mapArray(this.http.get<ApiResponse<any[]>>(
      this.masterUrl('products'), { headers: this.headers(), params }
    ), item => this.normalizeProduct(item));
  }

  saveProduct(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<ProductItem>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.masterUrl(`products/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.masterUrl('products'), body, { headers: h }),
      item => this.normalizeProduct(item)
    );
  }

  convertProductUom(productId: number, payload: ProductUomConversionCalculateRequest): Observable<ApiResponse<ProductUomConversionCalculateResult>> {
    return this.mapItem(
      this.http.post<ApiResponse<any>>(
        this.masterUrl(`products/${productId}/uom-convert`),
        this.toApiValue(payload),
        { headers: this.headers() }
      ),
      item => this.normalizeProductUomConversionResult(item)
    );
  }

  // ── Product Types ──────────────────────────────────────────────────────────

  getProductTypes(includeSystem = true): Observable<ApiResponse<ProductTypeItem[]>> {
    return this.mapArray(this.http.get<ApiResponse<any[]>>(
      this.url('product-types'), { headers: this.headers(), params: { includeSystem } }
    ), item => this.normalizeProductType(item));
  }

  saveProductType(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<ProductTypeItem>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.url(`product-types/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.url('product-types'), body, { headers: h }),
      item => this.normalizeProductType(item)
    );
  }

  deleteProductType(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(this.url(`product-types/${id}`), { headers: this.headers() });
  }

  private normalizeProductType(item: any): ProductTypeItem {
    return {
      id: item?.id,
      company_id: this.value(item, 'company_id', 'companyId'),
      type_code: this.value(item, 'type_code', 'typeCode', ''),
      type_name: this.value(item, 'type_name', 'typeName', ''),
      description: this.value(item, 'description', 'description'),
      tracks_inventory: this.value(item, 'tracks_inventory', 'tracksInventory', true),
      tracks_cost: this.value(item, 'tracks_cost', 'tracksCost', true),
      is_service: this.value(item, 'is_service', 'isService', false),
      is_asset: this.value(item, 'is_asset', 'isAsset', false),
      allows_purchase: this.value(item, 'allows_purchase', 'allowsPurchase', true),
      allows_sale: this.value(item, 'allows_sale', 'allowsSale', true),
      allows_production: this.value(item, 'allows_production', 'allowsProduction', false),
      default_serial_required: this.value(item, 'default_serial_required', 'defaultSerialRequired', false),
      default_batch_required: this.value(item, 'default_batch_required', 'defaultBatchRequired', false),
      default_expiry_required: this.value(item, 'default_expiry_required', 'defaultExpiryRequired', false),
      requires_hsn_sac: this.value(item, 'requires_hsn_sac', 'requiresHsnSac', true),
      is_system: this.value(item, 'is_system', 'isSystem', false),
      sort_order: this.value(item, 'sort_order', 'sortOrder', 100),
      status: this.value(item, 'status', 'status', 'active')
    };
  }

  // ── BOM / Work Center / Price List ────────────────────────────────────────
  // Real endpoints as of migration 219. These three masters previously had no
  // backend at all and were kept in browser localStorage.

  getWorkCenters(includeInactive = false): Observable<ApiResponse<WorkCenterItem[]>> {
    return this.mapArray(this.http.get<ApiResponse<any[]>>(
      this.masterUrl('work-centers'), { headers: this.headers(), params: { includeInactive } }
    ), item => this.normalizeWorkCenter(item));
  }

  saveWorkCenter(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<WorkCenterItem>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.masterUrl(`work-centers/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.masterUrl('work-centers'), body, { headers: h }),
      item => this.normalizeWorkCenter(item)
    );
  }

  deleteWorkCenter(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(this.masterUrl(`work-centers/${id}`), { headers: this.headers() });
  }

  private normalizeWorkCenter(item: any): WorkCenterItem {
    return {
      id: item?.id,
      company_id: this.value(item, 'company_id', 'companyId'),
      segment_id: this.value(item, 'segment_id', 'segmentId'),
      work_center_code: this.value(item, 'work_center_code', 'workCenterCode', ''),
      work_center_name: this.value(item, 'work_center_name', 'workCenterName', ''),
      department: this.value(item, 'department', 'department'),
      capacity: this.value(item, 'capacity', 'capacity'),
      cost_per_hour: Number(this.value(item, 'cost_per_hour', 'costPerHour', 0)) || 0,
      status: this.value(item, 'status', 'status', 'active')
    };
  }

  getPriceLists(includeInactive = false): Observable<ApiResponse<PriceListItem[]>> {
    return this.mapArray(this.http.get<ApiResponse<any[]>>(
      this.masterUrl('price-lists'), { headers: this.headers(), params: { includeInactive } }
    ), item => this.normalizePriceList(item));
  }

  savePriceList(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<PriceListItem>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.masterUrl(`price-lists/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.masterUrl('price-lists'), body, { headers: h }),
      item => this.normalizePriceList(item)
    );
  }

  deletePriceList(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(this.masterUrl(`price-lists/${id}`), { headers: this.headers() });
  }

  private normalizePriceList(item: any): PriceListItem {
    return {
      id: item?.id,
      company_id: this.value(item, 'company_id', 'companyId'),
      segment_id: this.value(item, 'segment_id', 'segmentId'),
      price_list_code: this.value(item, 'price_list_code', 'priceListCode', ''),
      price_list_name: this.value(item, 'price_list_name', 'priceListName', ''),
      branch_id: this.value(item, 'branch_id', 'branchId'),
      branch_name: this.value(item, 'branch_name', 'branchName'),
      product_id: this.value(item, 'product_id', 'productId'),
      product_name: this.value(item, 'product_name', 'productName'),
      rate: Number(this.value(item, 'rate', 'rate', 0)) || 0,
      effective_from: this.value(item, 'effective_from', 'effectiveFrom'),
      effective_to: this.value(item, 'effective_to', 'effectiveTo'),
      status: this.value(item, 'status', 'status', 'active')
    };
  }

  getBoms(includeInactive = false): Observable<ApiResponse<BomItem[]>> {
    return this.mapArray(this.http.get<ApiResponse<any[]>>(
      this.masterUrl('boms'), { headers: this.headers(), params: { includeInactive } }
    ), item => this.normalizeBom(item));
  }

  saveBom(payload: Record<string, any>, id?: number | null): Observable<ApiResponse<BomItem>> {
    const h = this.headers();
    const body = this.toApiValue(payload);
    return this.mapItem(
      id
        ? this.http.put<ApiResponse<any>>(this.masterUrl(`boms/${id}`), body, { headers: h })
        : this.http.post<ApiResponse<any>>(this.masterUrl('boms'), body, { headers: h }),
      item => this.normalizeBom(item)
    );
  }

  deleteBom(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(this.masterUrl(`boms/${id}`), { headers: this.headers() });
  }

  private normalizeBom(item: any): BomItem {
    const rawItems = this.value(item, 'items', 'items', []) || [];
    return {
      id: item?.id,
      company_id: this.value(item, 'company_id', 'companyId'),
      segment_id: this.value(item, 'segment_id', 'segmentId'),
      bom_code: this.value(item, 'bom_code', 'bomCode', ''),
      bom_version: this.value(item, 'bom_version', 'bomVersion'),
      finished_product_id: this.value(item, 'finished_product_id', 'finishedProductId'),
      finished_product_name: this.value(item, 'finished_product_name', 'finishedProductName', ''),
      quantity: Number(this.value(item, 'quantity', 'quantity', 1)) || 0,
      wastage_percent: Number(this.value(item, 'wastage_percent', 'wastagePercent', 0)) || 0,
      production_cost: Number(this.value(item, 'production_cost', 'productionCost', 0)) || 0,
      status: this.value(item, 'status', 'status', 'active'),
      items: (Array.isArray(rawItems) ? rawItems : []).map((row: any) => ({
        id: row?.id,
        sno: Number(this.value(row, 'sno', 'sno', 0)) || 0,
        product_id: this.value(row, 'product_id', 'productId'),
        product_name: this.value(row, 'product_name', 'productName', ''),
        quantity: Number(this.value(row, 'quantity', 'quantity', 1)) || 0,
        uom_id: this.value(row, 'uom_id', 'uomId'),
        uom_name: this.value(row, 'uom_name', 'uomName')
      }))
    };
  }
}
