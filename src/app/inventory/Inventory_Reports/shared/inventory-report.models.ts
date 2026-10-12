import { INVENTORY_OPTIONS } from '../../Inventory_Shared/inventory-screen.model';

export type InventoryReportPhase = 1 | 2 | 3;

export type InventoryReportGroupId =
  | 'dashboard'
  | 'stock'
  | 'stockMovement'
  | 'purchase'
  | 'sales'
  | 'gstCompliance'
  | 'batchSerialExpiry'
  | 'uom'
  | 'costingProfitability'
  | 'alertsExceptions'
  | 'customerSupplier'
  | 'selfConsumption'
  | 'manufacturing'
  | 'branchWarehouse'
  | 'auditControl';

export type InventoryReportFilterKey =
  | 'companyId'
  | 'branchId'
  | 'segmentId'
  | 'financialYear'
  | 'warehouseId'
  | 'fromDate'
  | 'toDate'
  | 'productId'
  | 'productCategory'
  | 'brand'
  | 'hsnSac'
  | 'customerId'
  | 'supplierId'
  | 'batchNo'
  | 'serialNo'
  | 'uom'
  | 'status'
  | 'project'
  | 'department'
  | 'createdBy'
  | 'approvedBy';

export type InventoryReportColumnType = 'text' | 'number' | 'currency' | 'date' | 'percent' | 'status';

export type InventoryReportRow = Record<string, string | number | boolean | null | undefined>;

export interface InventoryReportGroup {
  id: InventoryReportGroupId;
  title: string;
  icon: string;
}

export interface InventoryReportColumn {
  key: string;
  label: string;
  type?: InventoryReportColumnType;
  total?: boolean;
  defaultVisible?: boolean;
}

export interface InventoryReportSummaryCard {
  label: string;
  valueKey: string;
  fallback: string;
  icon: string;
  tone?: 'blue' | 'green' | 'amber' | 'rose';
}

export interface InventoryReportDefinition {
  key: string;
  slug: string;
  title: string;
  groupId: InventoryReportGroupId;
  phase: InventoryReportPhase;
  endpoint: string;
  icon: string;
  purpose: string;
  audience: string[];
  columns: InventoryReportColumn[];
  filters: InventoryReportFilterKey[];
  summaryCards?: InventoryReportSummaryCard[];
  defaultGroupBy?: string;
  drillDown?: boolean;
  sampleRows: InventoryReportRow[];
}

export interface InventoryReportFilterDefinition {
  key: InventoryReportFilterKey;
  label: string;
  type: 'text' | 'date' | 'select' | 'multiselect';
  placeholder?: string;
  options?: string[];
}

export type InventoryReportFilterValue = string | string[] | Date | null | undefined;
export type InventoryReportFilters = Partial<Record<InventoryReportFilterKey, InventoryReportFilterValue>>;

export interface InventoryReportApiResponse {
  success: boolean;
  message: string;
  data: InventoryReportRow[];
  summary: Record<string, string | number>;
  totalRecords: number;
}

export const INVENTORY_REPORT_PRIMARY_FILTERS: InventoryReportFilterKey[] = [
  'companyId',
  'branchId',
  'segmentId',
  'financialYear',
  'warehouseId',
  'fromDate',
  'toDate',
  'status'
];

export const INVENTORY_REPORT_COMPANY_OPTIONS = [
  'Global ERP Pvt Ltd',
  'OneSphere Foods',
  'AeroTech Manufacturing',
  'Metro Projects'
];

export const INVENTORY_COMMON_REPORT_FILTERS: InventoryReportFilterDefinition[] = [
  { key: 'companyId', label: 'Company', type: 'multiselect', placeholder: 'Select company', options: INVENTORY_REPORT_COMPANY_OPTIONS },
  { key: 'branchId', label: 'Branch', type: 'multiselect', placeholder: 'Select branch', options: INVENTORY_OPTIONS.branches },
  { key: 'segmentId', label: 'Segment', type: 'multiselect', placeholder: 'Select segment', options: INVENTORY_OPTIONS.segments },
  // Previous: { key: 'financialYear', label: 'Financial Year', type: 'multiselect', placeholder: 'Select financial year', options: ['2026-2027', '2025-2026', '2024-2025'] },
  // One financial year at a time: a single-select shows the chosen year as plain
  // text instead of a multi-select chip that got clipped in the 34px header box.
  { key: 'financialYear', label: 'Financial Year', type: 'select', placeholder: 'Select financial year', options: ['2026-2027', '2025-2026', '2024-2025'] },
  { key: 'warehouseId', label: 'Warehouse', type: 'multiselect', placeholder: 'Select warehouse / location', options: INVENTORY_OPTIONS.locations },
  { key: 'fromDate', label: 'Date From', type: 'date' },
  { key: 'toDate', label: 'Date To', type: 'date' },
  { key: 'productId', label: 'Product', type: 'multiselect', placeholder: 'Select product', options: INVENTORY_OPTIONS.products },
  { key: 'productCategory', label: 'Product Category', type: 'multiselect', placeholder: 'Select category', options: INVENTORY_OPTIONS.categories },
  { key: 'brand', label: 'Brand', type: 'multiselect', placeholder: 'Select brand', options: INVENTORY_OPTIONS.brands },
  { key: 'hsnSac', label: 'HSN / SAC', type: 'multiselect', placeholder: 'Select HSN or SAC', options: INVENTORY_OPTIONS.hsnSac },
  { key: 'customerId', label: 'Customer', type: 'multiselect', placeholder: 'Select customer', options: INVENTORY_OPTIONS.customers },
  { key: 'supplierId', label: 'Supplier', type: 'multiselect', placeholder: 'Select supplier', options: INVENTORY_OPTIONS.suppliers },
  { key: 'batchNo', label: 'Batch No', type: 'text', placeholder: 'Batch / lot' },
  { key: 'serialNo', label: 'Serial No', type: 'text', placeholder: 'Serial / IMEI' },
  { key: 'uom', label: 'UOM', type: 'multiselect', placeholder: 'Select UOM', options: INVENTORY_OPTIONS.uoms },
  { key: 'status', label: 'Status', type: 'multiselect', placeholder: 'Select status', options: ['Draft', 'Pending', 'Approved', 'Posted', 'Cancelled', 'Open', 'Closed', 'Critical', 'Watch', 'Good'] },
  { key: 'project', label: 'Project', type: 'multiselect', placeholder: 'Select project', options: ['Skyline', 'Metro Site', 'Villa Site', 'Tower Site', 'Green County', 'Internal'] },
  { key: 'department', label: 'Department', type: 'multiselect', placeholder: 'Select department', options: ['Admin', 'Production', 'Sales', 'Kitchen', 'IT', 'Maintenance', 'Finance', 'Operations'] },
  { key: 'createdBy', label: 'Created By', type: 'multiselect', placeholder: 'Select user', options: INVENTORY_OPTIONS.contactPersons },
  { key: 'approvedBy', label: 'Approved By', type: 'multiselect', placeholder: 'Select approver', options: INVENTORY_OPTIONS.contactPersons }
];
