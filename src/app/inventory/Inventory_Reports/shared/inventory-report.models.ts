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

// No static option lists: Branch/Segment/Warehouse/Product/Category/Brand/HSN/
// Customer/Supplier/UOM are filled from the database by the report page.
export const INVENTORY_COMMON_REPORT_FILTERS: InventoryReportFilterDefinition[] = [
  { key: 'companyId', label: 'Company', type: 'multiselect', placeholder: 'Select company', options: [] },
  { key: 'branchId', label: 'Branch', type: 'multiselect', placeholder: 'Select branch', options: [] },
  { key: 'segmentId', label: 'Segment', type: 'multiselect', placeholder: 'Select segment', options: [] },
  // Previous: { key: 'financialYear', label: 'Financial Year', type: 'multiselect', placeholder: 'Select financial year', options: ['2026-2027', '2025-2026', '2024-2025'] },
  // One financial year at a time: a single-select shows the chosen year as plain
  // text instead of a multi-select chip that got clipped in the 34px header box.
  { key: 'financialYear', label: 'Financial Year', type: 'select', placeholder: 'Select financial year', options: ['2026-2027', '2025-2026', '2024-2025'] },
  { key: 'warehouseId', label: 'Warehouse', type: 'multiselect', placeholder: 'Select warehouse / location', options: [] },
  { key: 'fromDate', label: 'Date From', type: 'date' },
  { key: 'toDate', label: 'Date To', type: 'date' },
  { key: 'productId', label: 'Product', type: 'multiselect', placeholder: 'Select product', options: [] },
  { key: 'productCategory', label: 'Product Category', type: 'multiselect', placeholder: 'Select category', options: [] },
  { key: 'brand', label: 'Brand', type: 'multiselect', placeholder: 'Select brand', options: [] },
  { key: 'hsnSac', label: 'HSN / SAC', type: 'multiselect', placeholder: 'Select HSN or SAC', options: [] },
  { key: 'customerId', label: 'Customer', type: 'multiselect', placeholder: 'Select customer', options: [] },
  { key: 'supplierId', label: 'Supplier', type: 'multiselect', placeholder: 'Select supplier', options: [] },
  { key: 'batchNo', label: 'Batch No', type: 'text', placeholder: 'Batch / lot' },
  { key: 'serialNo', label: 'Serial No', type: 'text', placeholder: 'Serial / IMEI' },
  { key: 'uom', label: 'UOM', type: 'multiselect', placeholder: 'Select UOM', options: [] },
  { key: 'status', label: 'Status', type: 'multiselect', placeholder: 'Select status', options: ['Draft', 'Pending', 'Approved', 'Posted', 'Cancelled', 'Open', 'Closed', 'Critical', 'Watch', 'Good'] },
  { key: 'project', label: 'Project', type: 'multiselect', placeholder: 'Select project', options: [] },
  { key: 'department', label: 'Department', type: 'multiselect', placeholder: 'Select department', options: [] },
  { key: 'createdBy', label: 'Created By', type: 'multiselect', placeholder: 'Select user', options: [] },
  { key: 'approvedBy', label: 'Approved By', type: 'multiselect', placeholder: 'Select approver', options: [] }
];
