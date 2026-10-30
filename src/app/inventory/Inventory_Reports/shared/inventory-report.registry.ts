import {
  InventoryReportColumn,
  InventoryReportDefinition,
  InventoryReportFilterKey,
  InventoryReportGroup,
  InventoryReportRow
} from './inventory-report.models';

// No 'companyId' filter — a report is always scoped to the single company the
// user is currently signed into (see currentCompanyName() on the report page,
// shown as a read-only badge instead); a multiselect of other companies never
// meant anything real here and only ever listed hardcoded demo names.
const baseFilters: InventoryReportFilterKey[] = ['branchId', 'segmentId', 'financialYear', 'warehouseId', 'fromDate', 'toDate', 'status'];
const productFilters: InventoryReportFilterKey[] = ['productId', 'productCategory', 'brand', 'hsnSac', 'uom', 'batchNo', 'serialNo'];
const partyFilters: InventoryReportFilterKey[] = ['customerId', 'supplierId'];
const controlFilters: InventoryReportFilterKey[] = ['project', 'department', 'createdBy', 'approvedBy'];
const fallbackSegments = ['Electronics', 'Agro Product', 'Hotel / Restaurant', 'Drone Manufacturing', 'Co-working Space'];

function cols(items: Array<[string, string, InventoryReportColumn['type']?, boolean?, boolean?]>): InventoryReportColumn[] {
  return items.map(([key, label, type = 'text', total = false, defaultVisible = true]) => ({
    key,
    label,
    type,
    total,
    defaultVisible
  }));
}

function withSegmentColumn(columns: InventoryReportColumn[]): InventoryReportColumn[] {
  if (columns.some(column => column.key === 'segment')) return columns;
  return [{ key: 'segment', label: 'Segment', type: 'text', total: false, defaultVisible: true }, ...columns];
}

function withSegmentRows(rows: InventoryReportRow[]): InventoryReportRow[] {
  return rows.map((row, index) => ({
    segment: row['segment'] || inferSegment(row, index),
    ...row
  }));
}

function inferSegment(row: InventoryReportRow, index: number): string {
  const text = Object.values(row).join(' ').toLowerCase();
  const segmentNeedles: Array<[string, string[]]> = [
    ['Electronics', ['ele-', 'led', 'laptop', 'display', 'sensor', 'cable', 'electromart', 'tenant works']],
    ['Agro Product', ['agr-', 'agro', 'seed', 'paddy', 'fertilizer', 'greengrow']],
    ['Hotel / Restaurant', ['hotel', 'restaurant', 'kitchen', 'fresh foods', 'basmati', 'cooking oil', 'paneer', 'diner']],
    ['Drone Manufacturing', ['drn-', 'drone', 'battery', 'aerocore', 'aero labs', 'flight controller']],
    ['Co-working Space', ['co-work', 'seat', 'cabin', 'meeting room', 'amc support', 'it services']],
    ['Precast Panels', ['precast', 'panel', 'cement', 'metro site', 'villa site', 'tower site']],
    ['Real Estate Inventory', ['flat', 'plot', 'skyline', 'green county']]
  ];

  return segmentNeedles.find(([, needles]) => needles.some(needle => text.includes(needle)))?.[0]
    ?? fallbackSegments[index % fallbackSegments.length];
}

function phaseOneReport(definition: Omit<InventoryReportDefinition, 'phase' | 'filters'> & { filters?: InventoryReportFilterKey[] }): InventoryReportDefinition {
  return {
    ...definition,
    phase: 1,
    filters: definition.filters ?? [...baseFilters, ...productFilters, ...partyFilters, ...controlFilters],
    columns: withSegmentColumn(definition.columns),
    sampleRows: withSegmentRows(definition.sampleRows)
  };
}

export const INVENTORY_REPORT_GROUPS: InventoryReportGroup[] = [
  { id: 'dashboard', title: 'Dashboard Reports', icon: 'pi pi-chart-line' },
  { id: 'stock', title: 'Stock Reports', icon: 'pi pi-box' },
  { id: 'stockMovement', title: 'Stock Movement Reports', icon: 'pi pi-sync' },
  { id: 'purchase', title: 'Purchase Reports', icon: 'pi pi-shopping-cart' },
  { id: 'sales', title: 'Sales Reports', icon: 'pi pi-receipt' },
  { id: 'gstCompliance', title: 'GST & Compliance Reports', icon: 'pi pi-verified' },
  { id: 'batchSerialExpiry', title: 'Batch / Serial / Expiry Reports', icon: 'pi pi-barcode' },
  { id: 'uom', title: 'UOM Reports', icon: 'pi pi-sort-alt' },
  { id: 'costingProfitability', title: 'Costing & Profitability Reports', icon: 'pi pi-percentage' },
  { id: 'alertsExceptions', title: 'Alert & Exception Reports', icon: 'pi pi-exclamation-triangle' },
  { id: 'customerSupplier', title: 'Customer & Supplier Reports', icon: 'pi pi-users' },
  { id: 'selfConsumption', title: 'Self Consumption Reports', icon: 'pi pi-home' },
  { id: 'manufacturing', title: 'Manufacturing / Assembly Reports', icon: 'pi pi-cog' },
  { id: 'branchWarehouse', title: 'Branch / Warehouse Reports', icon: 'pi pi-building' },
  { id: 'auditControl', title: 'Audit & Control Reports', icon: 'pi pi-shield' }
];

export const INVENTORY_PHASE_1_REPORTS: InventoryReportDefinition[] = [
  phaseOneReport({
    key: 'inventorySummary',
    slug: 'inventory-summary',
    title: 'Inventory Summary Dashboard',
    groupId: 'dashboard',
    endpoint: 'inventory-summary',
    icon: 'pi pi-chart-line',
    purpose: 'Overall inventory position for business owners with stock, orders, sales, purchase and exception focus.',
    audience: ['Business Owner', 'Admin', 'Warehouse', 'Purchase', 'Sales'],
    filters: [...baseFilters, 'productCategory', 'brand', 'project', 'department'],
    summaryCards: [
      { label: 'Total stock value', valueKey: 'totalStockValue', fallback: 'Rs. 4.82 Cr', icon: 'pi pi-chart-bar', tone: 'blue' },
      { label: 'Total products', valueKey: 'totalProducts', fallback: '1,248', icon: 'pi pi-list', tone: 'blue' },
      { label: 'Low stock items', valueKey: 'lowStockItems', fallback: '14', icon: 'pi pi-exclamation-triangle', tone: 'rose' },
      { label: 'Out of stock items', valueKey: 'outOfStockItems', fallback: '5', icon: 'pi pi-times-circle', tone: 'rose' },
      { label: 'Negative stock items', valueKey: 'negativeStockItems', fallback: '2', icon: 'pi pi-minus-circle', tone: 'amber' },
      { label: 'Near expiry items', valueKey: 'nearExpiryItems', fallback: '9', icon: 'pi pi-calendar-times', tone: 'amber' },
      { label: 'Pending purchase orders', valueKey: 'pendingPurchaseOrders', fallback: '31', icon: 'pi pi-shopping-cart', tone: 'blue' },
      { label: 'Pending sales orders', valueKey: 'pendingSalesOrders', fallback: '86', icon: 'pi pi-truck', tone: 'blue' },
      { label: "Today's sales", valueKey: 'todaySales', fallback: 'Rs. 2.10 L', icon: 'pi pi-arrow-circle-up', tone: 'green' },
      { label: "Today's purchases", valueKey: 'todayPurchases', fallback: 'Rs. 3.80 L', icon: 'pi pi-arrow-circle-down', tone: 'green' },
      { label: 'Top selling products', valueKey: 'topSellingProducts', fallback: '12', icon: 'pi pi-star', tone: 'green' },
      { label: 'Slow moving products', valueKey: 'slowMovingProducts', fallback: '18', icon: 'pi pi-clock', tone: 'amber' }
    ],
    columns: cols([
      ['indicatorGroup', 'Group'],
      ['indicator', 'Indicator'],
      ['currentValue', 'Current Value'],
      ['risk', 'Risk', 'status'],
      ['ownerAction', 'Owner Action']
    ]),
    defaultGroupBy: 'indicatorGroup',
    drillDown: true,
    sampleRows: [
      { segment: 'Electronics', indicatorGroup: 'Stock', indicator: 'Total stock value', currentValue: 'Rs. 2.24 Cr', risk: 'Good', ownerAction: 'Review LED, laptop and cable stock by HYD and BLR warehouses.' },
      { segment: 'Electronics', indicatorGroup: 'Stock', indicator: 'Low stock items', currentValue: '6 items', risk: 'Critical', ownerAction: 'Approve purchase requisitions for laptop and CCTV shortage products.' },
      { segment: 'Agro Product', indicatorGroup: 'Batch / Expiry', indicator: 'Season lots near expiry', currentValue: '3 lots', risk: 'Watch', ownerAction: 'Move paddy seed and fertilizer lots before season closes.' },
      { segment: 'Hotel / Restaurant', indicatorGroup: 'Movement', indicator: 'Kitchen consumption today', currentValue: 'Rs. 1.84 L', risk: 'Watch', ownerAction: 'Consume expiring oil and rice lots through kitchen plan.' },
      { segment: 'Drone Manufacturing', indicatorGroup: 'Manufacturing', indicator: 'QC stock hold', currentValue: '17 battery packs', risk: 'Critical', ownerAction: 'Release QC approval to unblock finished drone dispatch.' },
      { segment: 'Co-working Space', indicatorGroup: 'Availability', indicator: 'Bookable seats', currentValue: '46 seats', risk: 'Good', ownerAction: 'Convert confirmed bookings to sales invoices.' },
      { segment: 'IT Services', indicatorGroup: 'Profit', indicator: 'AMC billing queue', currentValue: '14 contracts', risk: 'Good', ownerAction: 'Invoice monthly AMC support milestones.' },
      { segment: 'Real Estate Inventory', indicatorGroup: 'Availability', indicator: 'Available units', currentValue: '129 units', risk: 'Good', ownerAction: 'Open unit availability and booking status before billing.' }
    ]
  }),
  phaseOneReport({
    key: 'stockSummary',
    slug: 'stock-summary',
    title: 'Stock Summary Report',
    groupId: 'stock',
    endpoint: 'stock-summary',
    icon: 'pi pi-box',
    purpose: 'Opening, inward, outward, closing and value view by product.',
    audience: ['Business Owner', 'Accountant', 'Warehouse'],
    filters: [...baseFilters, ...productFilters],
    summaryCards: [
      { label: 'Closing stock value', valueKey: 'stockValue', fallback: 'Rs. 4.82 Cr', icon: 'pi pi-wallet', tone: 'blue' },
      { label: 'Products covered', valueKey: 'productCount', fallback: '1,248', icon: 'pi pi-list', tone: 'green' },
      { label: 'Inward quantity', valueKey: 'inwardQty', fallback: '8,420', icon: 'pi pi-arrow-down', tone: 'green' },
      { label: 'Outward quantity', valueKey: 'outwardQty', fallback: '6,870', icon: 'pi pi-arrow-up', tone: 'amber' }
    ],
    columns: cols([
      ['productCode', 'Product Code'],
      ['productName', 'Product Name'],
      ['category', 'Category'],
      ['brand', 'Brand'],
      ['uom', 'UOM'],
      ['openingStock', 'Opening Stock', 'number', true],
      ['inwardQty', 'Inward Quantity', 'number', true],
      ['outwardQty', 'Outward Quantity', 'number', true],
      ['closingStock', 'Closing Stock', 'number', true],
      ['averageRate', 'Average Rate', 'currency'],
      ['stockValue', 'Stock Value', 'currency', true],
      ['pendingInvoiceQty', 'Dispatched Without SI', 'number', true]
    ]),
    defaultGroupBy: 'category',
    drillDown: true,
    sampleRows: [
      { productCode: 'ELE-1001', productName: 'LED Display 32 inch', category: 'Electronics', brand: 'VisionPro', uom: 'Nos', openingStock: 120, inwardQty: 40, outwardQty: 48, closingStock: 112, averageRate: 24500, stockValue: 2744000 },
      { productCode: 'AGR-2201', productName: 'Agro Seed Premium', category: 'Agro Product', brand: 'GreenGrow', uom: 'Bag', openingStock: 640, inwardQty: 260, outwardQty: 382, closingStock: 518, averageRate: 1850, stockValue: 958300 },
      { productCode: 'DRN-4007', productName: 'Drone Motor 2KW', category: 'Drone Manufacturing', brand: 'AeroCore', uom: 'Nos', openingStock: 420, inwardQty: 150, outwardQty: 220, closingStock: 350, averageRate: 3950, stockValue: 1382500 }
    ]
  }),
  phaseOneReport({
    key: 'stockLedger',
    slug: 'stock-ledger',
    title: 'Stock Ledger Report',
    groupId: 'stock',
    endpoint: 'stock-ledger',
    icon: 'pi pi-list',
    purpose: 'Transaction audit trail for stock inward, outward, transfer and balance.',
    audience: ['Accountant', 'Warehouse', 'Admin'],
    filters: [...baseFilters, ...productFilters, 'customerId', 'supplierId', 'createdBy'],
    columns: cols([
      ['transactionDate', 'Date', 'date'],
      ['documentType', 'Document Type'],
      ['documentNo', 'Document No'],
      ['referenceNo', 'Reference No'],
      ['productCode', 'Product Code'],
      ['productName', 'Product Name'],
      // Previous: ['warehouse', 'Warehouse / Branch'],
      // Warehouse / Branch column removed from Stock Ledger on user request.
      ['inwardQty', 'Inward Qty', 'number', true],
      ['outwardQty', 'Outward Qty', 'number', true],
      ['balanceQty', 'Balance Qty', 'number'],
      ['rate', 'Rate', 'currency'],
      ['debitValue', 'Debit', 'currency', true],
      ['creditValue', 'Credit', 'currency', true],
      ['totalValue', 'Total', 'currency'],
      // Previous: ['remarks', 'Remarks'],
      // Renamed on user request; SP 279 now fills it with the vendor/customer name.
      ['remarks', 'Purchase / Sale Details']
    ]),
    defaultGroupBy: 'productName',
    drillDown: true,
    sampleRows: [
      { transactionDate: '2026-05-12', documentType: 'GRN', documentNo: 'GRN-1104', referenceNo: 'PO-2241', productCode: 'ELE-1001', productName: 'LED Display 32 inch', warehouse: 'HYD Main WH', inwardQty: 40, outwardQty: 0, balanceQty: 112, rate: 24500, debitValue: 980000, creditValue: 0, totalValue: 2744000, remarks: 'Vendor receipt posted' },
      { transactionDate: '2026-05-12', documentType: 'Sales Invoice', documentNo: 'INV-4481', referenceNo: 'SO-2218', productCode: 'ELE-1001', productName: 'LED Display 32 inch', warehouse: 'HYD Main WH', inwardQty: 0, outwardQty: 12, balanceQty: 100, rate: 31500, debitValue: 0, creditValue: 378000, totalValue: 2366000, remarks: 'Customer dispatch invoiced' },
      { transactionDate: '2026-05-11', documentType: 'Stock Transfer', documentNo: 'ST-0442', referenceNo: 'REQ-144', productCode: 'DRN-4007', productName: 'Drone Motor 2KW', warehouse: 'Manufacturing Store', inwardQty: 0, outwardQty: 80, balanceQty: 350, rate: 3950, debitValue: 0, creditValue: 316000, totalValue: 1382500, remarks: 'Production issue' }
    ]
  }),
  phaseOneReport({
    key: 'warehouseWiseStock',
    slug: 'warehouse-wise-stock',
    title: 'Warehouse-wise Stock Report',
    groupId: 'stock',
    endpoint: 'warehouse-wise-stock',
    icon: 'pi pi-building',
    purpose: 'Warehouse and location level stock quantity and value.',
    audience: ['Warehouse', 'Admin', 'Business Owner'],
    filters: [...baseFilters, ...productFilters],
    columns: cols([
      ['warehouse', 'Warehouse / Branch'],
      ['productCode', 'Product Code'],
      ['productName', 'Product Name'],
      ['uom', 'UOM'],
      ['quantity', 'Quantity', 'number', true],
      ['value', 'Value', 'currency', true]
    ]),
    defaultGroupBy: 'warehouse',
    sampleRows: [
      { warehouse: 'HYD Main WH', productCode: 'ELE-1001', productName: 'LED Display 32 inch', uom: 'Nos', quantity: 112, value: 2744000 },
      { warehouse: 'BLR Store', productCode: 'AGR-2201', productName: 'Agro Seed Premium', uom: 'Bag', quantity: 518, value: 958300 },
      { warehouse: 'Main Kitchen Store', productCode: 'HOT-9002', productName: 'Cooking Oil 1L', uom: 'Nos', quantity: 180, value: 144000 }
    ]
  }),
  phaseOneReport({
    key: 'lowStockAlert',
    slug: 'low-stock-alert',
    title: 'Low Stock Alert Report',
    groupId: 'alertsExceptions',
    endpoint: 'low-stock-alert',
    icon: 'pi pi-exclamation-triangle',
    purpose: 'Products below reorder level with shortage quantity.',
    audience: ['Purchase', 'Warehouse', 'Business Owner'],
    filters: [...baseFilters, ...productFilters, 'createdBy'],
    columns: cols([
      ['product', 'Product'],
      ['warehouse', 'Warehouse / Branch'],
      ['currentStock', 'Current Stock', 'number', true],
      ['reorderLevel', 'Reorder Level', 'number'],
      ['shortageQty', 'Shortage Qty', 'number', true],
      ['status', 'Status', 'status']
    ]),
    defaultGroupBy: 'warehouse',
    drillDown: true,
    sampleRows: [
      { product: 'Laptop i5 Gen12', warehouse: 'HYD Main WH', currentStock: 2, reorderLevel: 10, shortageQty: 8, status: 'Critical' },
      { product: 'Paddy Seeds Grade A', warehouse: 'BLR Store', currentStock: 240, reorderLevel: 300, shortageQty: 60, status: 'Watch' },
      { product: 'Cooking Oil 1L', warehouse: 'Main Kitchen Store', currentStock: 180, reorderLevel: 200, shortageQty: 20, status: 'Watch' }
    ]
  }),
  phaseOneReport({
    key: 'purchaseOrderRegister',
    slug: 'purchase-order-register',
    title: 'Purchase Order Register',
    groupId: 'purchase',
    endpoint: 'purchase-order-register',
    icon: 'pi pi-shopping-cart',
    purpose: 'PO register with gross, tax, net and approval status.',
    audience: ['Purchase', 'Accountant', 'Admin'],
    filters: [...baseFilters, 'supplierId', 'productId', 'status', 'createdBy', 'approvedBy'],
    columns: cols([
      ['poDate', 'PO Date', 'date'],
      ['poNo', 'PO No'],
      ['supplier', 'Supplier'],
      ['variant', 'Variant'],
      ['attribute', 'Attribute'],
      ['productCount', 'Product Count', 'number', true],
      ['grossAmount', 'Gross Amount', 'currency', true],
      ['taxAmount', 'Tax Amount', 'currency', true],
      ['netAmount', 'Net Amount', 'currency', true],
      ['status', 'Status', 'status']
    ]),
    defaultGroupBy: 'supplier',
    drillDown: true,
    sampleRows: [
      { poDate: '2026-05-04', poNo: 'PO-2241', supplier: 'ElectroMart Supplies', variant: 'I7', attribute: 'Memory: 128', productCount: 5, grossAmount: 480000, taxAmount: 86400, netAmount: 566400, status: 'Pending' },
      { poDate: '2026-05-08', poNo: 'PO-2298', supplier: 'GreenGrow Traders', variant: '', attribute: '', productCount: 3, grossAmount: 310000, taxAmount: 15500, netAmount: 325500, status: 'Approved' },
      { poDate: '2026-05-10', poNo: 'PO-2310', supplier: 'AeroCore Components', variant: 'Motor Kit', attribute: 'Power: 2KW', productCount: 8, grossAmount: 720000, taxAmount: 129600, netAmount: 849600, status: 'Open' }
    ]
  }),
  phaseOneReport({
    key: 'grnRegister',
    slug: 'grn-register',
    title: 'GRN Register',
    groupId: 'purchase',
    endpoint: 'grn-register',
    icon: 'pi pi-download',
    purpose: 'Goods receipt register with accepted, rejected and pending quantity status.',
    audience: ['Warehouse', 'Purchase', 'Accountant'],
    filters: [...baseFilters, 'supplierId', 'productId', 'uom', 'status', 'createdBy', 'approvedBy'],
    columns: cols([
      ['grnDate', 'GRN Date', 'date'],
      ['grnNo', 'GRN No'],
      ['supplier', 'Supplier'],
      ['poNo', 'PO No'],
      ['variant', 'Variant'],
      ['attribute', 'Attribute'],
      ['productCount', 'Product Count', 'number', true],
      ['receivedQty', 'Received Qty', 'number', true],
      ['acceptedQty', 'Accepted Qty', 'number', true],
      ['rejectedQty', 'Rejected Qty', 'number', true],
      ['status', 'Status', 'status']
    ]),
    defaultGroupBy: 'supplier',
    drillDown: true,
    sampleRows: [
      { grnDate: '2026-05-12', grnNo: 'GRN-1104', supplier: 'ElectroMart Supplies', poNo: 'PO-2241', variant: 'I7', attribute: 'Memory: 128', productCount: 4, receivedQty: 80, acceptedQty: 78, rejectedQty: 2, status: 'Posted' },
      { grnDate: '2026-05-11', grnNo: 'GRN-1101', supplier: 'GreenGrow Traders', poNo: 'PO-2298', variant: '', attribute: '', productCount: 2, receivedQty: 260, acceptedQty: 260, rejectedQty: 0, status: 'Posted' },
      { grnDate: '2026-05-10', grnNo: 'GRN-1098', supplier: 'AeroCore Components', poNo: 'PO-2310', variant: 'Motor Kit', attribute: 'Power: 2KW', productCount: 6, receivedQty: 420, acceptedQty: 400, rejectedQty: 20, status: 'QC Pending' }
    ]
  }),
  phaseOneReport({
    key: 'purchaseInvoiceRegister',
    slug: 'purchase-invoice-register',
    title: 'Purchase Invoice Register',
    groupId: 'purchase',
    endpoint: 'purchase-invoice-register',
    icon: 'pi pi-file-import',
    purpose: 'Purchase invoice register for accounts, tax and supplier reconciliation.',
    audience: ['Accountant', 'Purchase', 'Admin'],
    filters: [...baseFilters, 'supplierId', 'hsnSac', 'status', 'createdBy', 'approvedBy'],
    columns: cols([
      ['invoiceDate', 'Invoice Date', 'date'],
      ['invoiceNo', 'Invoice No'],
      ['supplier', 'Supplier'],
      ['supplierInvoiceNo', 'Supplier Invoice No'],
      ['variant', 'Variant'],
      ['attribute', 'Attribute'],
      ['taxableAmount', 'Taxable Amount', 'currency', true],
      ['cgst', 'CGST', 'currency', true],
      ['sgst', 'SGST', 'currency', true],
      ['igst', 'IGST', 'currency', true],
      ['netAmount', 'Net Amount', 'currency', true],
      ['status', 'Status', 'status']
    ]),
    defaultGroupBy: 'supplier',
    drillDown: true,
    sampleRows: [
      { invoiceDate: '2026-05-12', invoiceNo: 'PINV-3104', supplier: 'ElectroMart Supplies', supplierInvoiceNo: 'EMS-9881', variant: 'I7', attribute: 'Memory: 128', taxableAmount: 480000, cgst: 43200, sgst: 43200, igst: 0, netAmount: 566400, status: 'Posted' },
      { invoiceDate: '2026-05-11', invoiceNo: 'PINV-3097', supplier: 'GreenGrow Traders', supplierInvoiceNo: 'GGT-5520', variant: '', attribute: '', taxableAmount: 310000, cgst: 7750, sgst: 7750, igst: 0, netAmount: 325500, status: 'Pending' }
    ]
  }),
  phaseOneReport({
    key: 'salesOrderRegister',
    slug: 'sales-order-register',
    title: 'Sales Order Register',
    groupId: 'sales',
    endpoint: 'sales-order-register',
    icon: 'pi pi-shopping-bag',
    purpose: 'SO register with order value, tax and fulfilment status.',
    audience: ['Sales', 'Warehouse', 'Business Owner'],
    filters: [...baseFilters, 'customerId', 'productId', 'status', 'createdBy', 'approvedBy'],
    columns: cols([
      ['soDate', 'SO Date', 'date'],
      ['soNo', 'SO No'],
      ['customer', 'Customer'],
      ['variant', 'Variant'],
      ['attribute', 'Attribute'],
      ['productCount', 'Product Count', 'number', true],
      ['grossAmount', 'Gross Amount', 'currency', true],
      ['taxAmount', 'Tax Amount', 'currency', true],
      ['netAmount', 'Net Amount', 'currency', true],
      ['status', 'Status', 'status']
    ]),
    defaultGroupBy: 'customer',
    drillDown: true,
    sampleRows: [
      { soDate: '2026-05-12', soNo: 'SO-2218', customer: 'Tenant Works Pvt Ltd', variant: 'I7', attribute: 'Memory: 128', productCount: 3, grossAmount: 420000, taxAmount: 75600, netAmount: 495600, status: 'Approved' },
      { soDate: '2026-05-12', soNo: 'SO-2227', customer: 'Fresh Foods Distributor', variant: '', attribute: '', productCount: 6, grossAmount: 180000, taxAmount: 9000, netAmount: 189000, status: 'Open' },
      { soDate: '2026-05-11', soNo: 'SO-2209', customer: 'Aero Labs', variant: 'Motor Kit', attribute: 'Power: 2KW', productCount: 4, grossAmount: 960000, taxAmount: 172800, netAmount: 1132800, status: 'Pending' }
    ]
  }),
  phaseOneReport({
    key: 'deliveryChallanRegister',
    slug: 'delivery-challan-register',
    title: 'Delivery Challan Register',
    groupId: 'sales',
    endpoint: 'delivery-challan-register',
    icon: 'pi pi-truck',
    purpose: 'Dispatch and delivery challan register with logistics details.',
    audience: ['Warehouse', 'Sales', 'Admin'],
    filters: [...baseFilters, 'customerId', 'productId', 'status', 'createdBy', 'approvedBy'],
    columns: cols([
      ['dcDate', 'DC Date', 'date'],
      ['dcNo', 'DC No'],
      ['customer', 'Customer'],
      ['soNo', 'SO No'],
      ['variant', 'Variant'],
      ['attribute', 'Attribute'],
      ['productCount', 'Product Count', 'number', true],
      ['deliveredQty', 'Delivered Qty', 'number', true],
      ['vehicleNo', 'Vehicle No'],
      ['transporter', 'Transporter'],
      ['status', 'Status', 'status']
    ]),
    defaultGroupBy: 'customer',
    drillDown: true,
    sampleRows: [
      { dcDate: '2026-05-12', dcNo: 'DC-1184', customer: 'Tenant Works Pvt Ltd', soNo: 'SO-2218', variant: 'I7', attribute: 'Memory: 128', productCount: 3, deliveredQty: 18, vehicleNo: 'TS09AB2211', transporter: 'SpeedLogix', status: 'Dispatched' },
      { dcDate: '2026-05-11', dcNo: 'DC-1178', customer: 'Fresh Foods Distributor', soNo: 'SO-2227', variant: '', attribute: '', productCount: 6, deliveredQty: 420, vehicleNo: 'KA05MG9081', transporter: 'City Transport', status: 'Pending Invoice' }
    ]
  }),
  phaseOneReport({
    key: 'salesInvoiceRegister',
    slug: 'sales-invoice-register',
    title: 'Sale Invoice Register',
    groupId: 'sales',
    endpoint: 'sales-invoice-register',
    icon: 'pi pi-receipt',
    purpose: 'Sales invoice register with taxable amount, GST split and net value.',
    audience: ['Accountant', 'Sales', 'Business Owner'],
    filters: [...baseFilters, 'customerId', 'productId', 'hsnSac', 'status', 'createdBy', 'approvedBy'],
    columns: cols([
      ['invoiceDate', 'Invoice Date', 'date'],
      ['invoiceNo', 'Invoice No'],
      ['customer', 'Customer'],
      ['variant', 'Variant'],
      ['attribute', 'Attribute'],
      ['taxableAmount', 'Taxable Amount', 'currency', true],
      ['cgst', 'CGST', 'currency', true],
      ['sgst', 'SGST', 'currency', true],
      ['igst', 'IGST', 'currency', true],
      ['netAmount', 'Net Amount', 'currency', true],
      ['status', 'Status', 'status']
    ]),
    defaultGroupBy: 'customer',
    drillDown: true,
    sampleRows: [
      { invoiceDate: '2026-05-12', invoiceNo: 'INV-4481', customer: 'Tenant Works Pvt Ltd', variant: 'I7', attribute: 'Memory: 128', taxableAmount: 420000, cgst: 37800, sgst: 37800, igst: 0, netAmount: 495600, status: 'Posted' },
      { invoiceDate: '2026-05-12', invoiceNo: 'INV-4488', customer: 'Fresh Foods Distributor', variant: '', attribute: '', taxableAmount: 180000, cgst: 4500, sgst: 4500, igst: 0, netAmount: 189000, status: 'Posted' },
      { invoiceDate: '2026-05-11', invoiceNo: 'INV-4479', customer: 'Aero Labs', variant: 'Motor Kit', attribute: 'Power: 2KW', taxableAmount: 960000, cgst: 86400, sgst: 86400, igst: 0, netAmount: 1132800, status: 'Draft' }
    ]
  }),
  // Dues List: posted Sales Invoices still unpaid or part-paid as on the
  // "Date To" (shown as "As on" in the PDF header). Fully paid invoices
  // (Due = 0) are left out. Grouped customer-wise for now; once Sales Invoice
  // saves the group-company branch, add region/customerBranch columns and
  // switch defaultGroupBy to 'region'.
  phaseOneReport({
    key: 'duesList',
    slug: 'dues-list',
    title: 'Dues List Report',
    groupId: 'customerSupplier',
    endpoint: 'dues-list',
    icon: 'pi pi-wallet',
    purpose: 'Customer-wise list of unpaid and part-paid sales invoices with total, received and due amount as on a date.',
    audience: ['Accountant', 'Sales', 'Business Owner'],
    filters: ['branchId', 'toDate', 'customerId'],
    columns: cols([
      // Segment is auto-added to every report; hidden here to match the Dues List layout.
      ['segment', 'Segment', 'text', false, false],
      ['invoiceDate', 'Invoice Date', 'date'],
      ['invoiceNo', 'Invoice No'],
      ['customer', 'Customer'],
      ['totalAmount', 'Total Amount', 'currency', true],
      ['receivedAmount', 'Received', 'currency', true],
      ['dueAmount', 'Due Amount', 'currency', true],
      ['ageDays', 'Age (Days)', 'number']
    ]),
    defaultGroupBy: 'customer',
    sampleRows: [
      { invoiceDate: '2026-09-05', invoiceNo: 'CPINV1358/26', customer: 'Dakshin Infrastructures Private Limited', totalAmount: 40717, receivedAmount: 40027, dueAmount: 690, ageDays: 48 },
      { invoiceDate: '2026-09-22', invoiceNo: 'CPINV1481/26', customer: 'Dakshin Infrastructures Private Limited', totalAmount: 24321, receivedAmount: 0, dueAmount: 24321, ageDays: 31 },
      { invoiceDate: '2026-10-13', invoiceNo: 'CPINV1621/26', customer: 'Kapil Chits (Kakatiya) Private Limited', totalAmount: 11772, receivedAmount: 0, dueAmount: 11772, ageDays: 10 }
    ]
  }),
  phaseOneReport({
    key: 'pendingDocument',
    slug: 'pending-document',
    title: 'Pending Document Report',
    groupId: 'alertsExceptions',
    endpoint: 'pending-document',
    icon: 'pi pi-clock',
    purpose: 'Pending quantity and amount across PO, GRN, DC, invoice and approvals.',
    audience: ['Business Owner', 'Admin', 'Purchase', 'Sales', 'Warehouse'],
    filters: [...baseFilters, 'customerId', 'supplierId', 'productId', 'status', 'createdBy', 'approvedBy'],
    columns: cols([
      ['documentType', 'Document Type'],
      ['documentNo', 'Document No'],
      ['documentDate', 'Date', 'date'],
      ['party', 'Party'],
      ['pendingQty', 'Pending Qty', 'number', true],
      ['pendingAmount', 'Pending Amount', 'currency', true],
      ['status', 'Status', 'status']
    ]),
    defaultGroupBy: 'documentType',
    drillDown: true,
    sampleRows: [
      { documentType: 'Purchase Order', documentNo: 'PO-2241', documentDate: '2026-05-04', party: 'ElectroMart Supplies', pendingQty: 28, pendingAmount: 480000, status: 'Pending GRN' },
      { documentType: 'Delivery Challan', documentNo: 'DC-1178', documentDate: '2026-05-11', party: 'Fresh Foods Distributor', pendingQty: 420, pendingAmount: 189000, status: 'Pending Invoice' },
      { documentType: 'Sales Order', documentNo: 'SO-2209', documentDate: '2026-05-11', party: 'Aero Labs', pendingQty: 14, pendingAmount: 1132800, status: 'Pending Dispatch' }
    ]
  }),
  phaseOneReport({
    key: 'hsnSummary',
    slug: 'hsn-summary',
    title: 'HSN/SAC Summary Report',
    groupId: 'gstCompliance',
    endpoint: 'hsn-summary',
    icon: 'pi pi-verified',
    purpose: 'GST HSN/SAC summary for quantity, taxable value, tax and net value.',
    audience: ['Accountant', 'Admin', 'Compliance'],
    filters: [...baseFilters, 'hsnSac', 'productCategory', 'customerId', 'supplierId', 'status'],
    columns: cols([
      ['hsnSacCode', 'HSN/SAC Code'],
      ['description', 'Description'],
      ['quantity', 'Quantity', 'number', true],
      ['taxableValue', 'Taxable Value', 'currency', true],
      ['cgst', 'CGST', 'currency', true],
      ['sgst', 'SGST', 'currency', true],
      ['igst', 'IGST', 'currency', true],
      ['totalTax', 'Total Tax', 'currency', true],
      ['netValue', 'Net Value', 'currency', true]
    ]),
    defaultGroupBy: 'hsnSacCode',
    sampleRows: [
      { hsnSacCode: '8471', description: 'Computer and electronic equipment', quantity: 60, taxableValue: 1260000, cgst: 113400, sgst: 113400, igst: 0, totalTax: 226800, netValue: 1486800 },
      { hsnSacCode: '1209', description: 'Seeds and agro products', quantity: 382, taxableValue: 706700, cgst: 17668, sgst: 17668, igst: 0, totalTax: 35336, netValue: 742036 },
      { hsnSacCode: '998313', description: 'IT consulting and support services', quantity: 14, taxableValue: 960000, cgst: 86400, sgst: 86400, igst: 0, totalTax: 172800, netValue: 1132800 }
    ]
  }),
  phaseOneReport({
    key: 'batchSerialExpiry',
    slug: 'batch-serial-expiry',
    title: 'Batch / Serial / Expiry Closed Report',
    groupId: 'batchSerialExpiry',
    endpoint: 'batch-serial-expiry',
    icon: 'pi pi-barcode',
    purpose: 'Batch, serial and expiry tracking in one operational report.',
    audience: ['Warehouse', 'Quality', 'Admin', 'Business Owner'],
    filters: [...baseFilters, ...productFilters, 'customerId', 'supplierId', 'status'],
    columns: cols([
      ['product', 'Product'],
      ['variant', 'Variant'],
      ['attribute', 'Attribute'],
      ['batchNo', 'Batch No'],
      ['serialNo', 'Serial No'],
      ['manufacturingDate', 'Manufacturing Date', 'date'],
      ['expiryDate', 'Expiry Date', 'date'],
      ['daysToExpire', 'Days to Expire', 'number'],
      ['warehouse', 'Warehouse / Branch'],
      ['quantity', 'Quantity', 'number', true],
      ['value', 'Value', 'currency', true],
      ['status', 'Status', 'status']
    ]),
    defaultGroupBy: 'status',
    drillDown: true,
    sampleRows: [
      { product: 'Cooking Oil 1L', variant: '', attribute: '', batchNo: 'LOT-CLN-441', serialNo: '', manufacturingDate: '2026-02-18', expiryDate: '2026-05-31', daysToExpire: 18, warehouse: 'Main Kitchen Store', quantity: 80, value: 64000, status: 'Near Expiry' },
      { product: 'LED Display 32 inch', variant: '32 inch', attribute: 'Panel: IPS', batchNo: 'LOT-ELE-0526', serialNo: 'SN-LED-88901', manufacturingDate: '2026-03-20', expiryDate: '', daysToExpire: 0, warehouse: 'HYD Main WH', quantity: 1, value: 24500, status: 'In Stock' },
      { product: 'Agro Seed Premium', variant: 'Premium', attribute: 'Pack: 25Kg', batchNo: 'LOT-AGRO-0526-A', serialNo: '', manufacturingDate: '2026-04-08', expiryDate: '2026-06-17', daysToExpire: 35, warehouse: 'BLR Store', quantity: 118, value: 218300, status: 'Near Expiry' }
    ]
  }),
  phaseOneReport({
    key: 'productProfitability',
    slug: 'product-profitability',
    title: 'Product Profitability Report',
    groupId: 'costingProfitability',
    endpoint: 'product-profitability',
    icon: 'pi pi-percentage',
    purpose: 'Product level sales value, purchase cost, gross profit and margin percentage.',
    audience: ['Business Owner', 'Accountant', 'Sales'],
    filters: [...baseFilters, 'productId', 'productCategory', 'brand', 'customerId', 'status'],
    columns: cols([
      ['product', 'Product'],
      ['category', 'Category'],
      ['variant', 'Variant'],
      ['attribute', 'Attribute'],
      ['salesQuantity', 'Sales Quantity', 'number', true],
      ['salesValue', 'Sales Value', 'currency', true],
      ['purchaseCost', 'Purchase Cost', 'currency', true],
      ['grossProfit', 'Gross Profit', 'currency', true],
      ['marginPercent', 'Margin %', 'percent']
    ]),
    defaultGroupBy: 'category',
    drillDown: true,
    sampleRows: [
      { product: 'LED Display 32 inch', category: 'Electronics', variant: '32 inch', attribute: 'Panel: IPS', salesQuantity: 48, salesValue: 1512000, purchaseCost: 1176000, grossProfit: 336000, marginPercent: 22.22 },
      { product: 'AMC Support', category: 'IT Services', variant: '', attribute: '', salesQuantity: 14, salesValue: 960000, purchaseCost: 556800, grossProfit: 403200, marginPercent: 42 },
      { product: 'Drone Motor 2KW', category: 'Drone Manufacturing', variant: 'Motor Kit', attribute: 'Power: 2KW', salesQuantity: 220, salesValue: 1100000, purchaseCost: 869000, grossProfit: 231000, marginPercent: 21 }
    ]
  }),
  phaseOneReport({
    key: 'lossSales',
    slug: 'loss-sales',
    title: 'Loss Sales Report',
    groupId: 'costingProfitability',
    endpoint: 'loss-sales',
    icon: 'pi pi-arrow-down',
    purpose: 'Sales invoice lines where the selling rate fell below the product\'s current cost price -- flags sales made at a loss (a floor check, unrelated to MRP).',
    audience: ['Business Owner', 'Accountant', 'Sales'],
    filters: [...baseFilters, 'productId', 'productCategory', 'brand', 'customerId', 'status'],
    columns: cols([
      ['invoiceNumber', 'Invoice No'],
      ['invoiceDate', 'Invoice Date', 'date'],
      ['customer', 'Customer'],
      ['product', 'Product'],
      ['variant', 'Variant'],
      ['attribute', 'Attribute'],
      ['qty', 'Qty', 'number'],
      ['rate', 'Rate', 'currency'],
      ['cost', 'Cost', 'currency'],
      ['lossAmount', 'Loss Amount', 'currency', true],
      ['lossPercent', 'Loss %', 'percent']
    ]),
    defaultGroupBy: 'product',
    drillDown: true,
    sampleRows: [
      { invoiceNumber: 'SI-2607', invoiceDate: '2026-08-05', customer: 'Metro Electronics', product: 'LED Display 32 inch', variant: '32 inch', attribute: 'Panel: IPS', qty: 4, rate: 28000, cost: 31500, lossAmount: 14000, lossPercent: 11.11 },
      { invoiceNumber: 'SI-2611', invoiceDate: '2026-08-10', customer: 'AeroBuild Pvt Ltd', product: 'Drone Motor 2KW', variant: 'Motor Kit', attribute: 'Power: 2KW', qty: 10, rate: 3800, cost: 4200, lossAmount: 4000, lossPercent: 9.52 },
      { invoiceNumber: 'SI-2618', invoiceDate: '2026-08-14', customer: 'Spice Route Restaurant', product: 'Cooking Oil 1L', variant: '', attribute: '', qty: 60, rate: 145, cost: 162, lossAmount: 1020, lossPercent: 10.49 }
    ]
  }),
  phaseOneReport({
    key: 'stockValuationComparison',
    slug: 'stock-valuation-comparison',
    title: 'Stock Valuation Comparison Report',
    groupId: 'costingProfitability',
    endpoint: 'stock-valuation-comparison',
    icon: 'pi pi-calculator',
    purpose: 'FIFO vs LIFO vs Weighted Average -- what each valuation method would charge for a chosen product and quantity, computed from its real open cost layers.',
    audience: ['Business Owner', 'Accountant'],
    filters: ['productId'],
    columns: cols([
      ['receivedAt', 'Received Date', 'date'],
      ['sourceDocType', 'Source Document'],
      ['quantity', 'Remaining Qty', 'number', true],
      ['rate', 'Unit Cost', 'currency'],
      ['value', 'Value', 'currency', true]
    ]),
    sampleRows: [
      { product: 'Dell Computer-I7', receivedAt: '2026-08-10', sourceDocType: 'Purchase Invoice', quantity: 10, rate: 150000, value: 1500000 },
      { product: 'Dell Computer-I7', receivedAt: '2026-08-15', sourceDocType: 'Purchase Invoice', quantity: 5, rate: 160000, value: 800000 }
    ]
  }),
  phaseOneReport({
    key: 'misReport',
    slug: 'mis-report',
    title: 'MIS Report',
    groupId: 'dashboard',
    endpoint: 'mis-report',
    icon: 'pi pi-th-large',
    purpose: 'Admin-only executive snapshot -- company-wide Sales, Purchases, Stock Value, Payables/Receivables with ageing and top products, plus the same KPIs broken down by Business Segment.',
    audience: ['Admin'],
    filters: ['fromDate', 'toDate'],
    columns: cols([
      ['segment', 'Segment'],
      ['sales', 'Sales', 'currency', true],
      ['purchases', 'Purchases', 'currency', true],
      ['payables', 'Payables', 'currency', true],
      ['receivables', 'Receivables', 'currency', true]
    ]),
    sampleRows: [
      { segment: 'Electronics', sales: 2450000, purchases: 1820000, payables: 640000, receivables: 512000 },
      { segment: 'Agro Product', sales: 980000, purchases: 710000, payables: 210000, receivables: 165000 }
    ]
  }),
  phaseOneReport({
    key: 'auditTrail',
    slug: 'inventory-audit-trail',
    title: 'Inventory Audit Trail Report',
    groupId: 'auditControl',
    endpoint: 'inventory-audit-trail',
    icon: 'pi pi-shield',
    purpose: 'Chronological trail of create, update, approve and delete actions across inventory masters and transactions for compliance review.',
    audience: ['Admin', 'Accountant', 'Business Owner'],
    filters: [...baseFilters, 'createdBy', 'approvedBy'],
    columns: cols([
      ['actionDate', 'Date & Time', 'date'],
      ['module', 'Module'],
      ['documentType', 'Document Type'],
      ['documentNo', 'Document No'],
      ['action', 'Action'],
      ['fieldChanged', 'Field Changed'],
      ['oldValue', 'Old Value'],
      ['newValue', 'New Value'],
      ['performedBy', 'Performed By'],
      ['approvedBy', 'Approved By'],
      ['status', 'Status', 'status'],
      ['remarks', 'Remarks']
    ]),
    defaultGroupBy: 'module',
    drillDown: true,
    sampleRows: [
      { actionDate: '2026-06-30 10:42', module: 'Purchase Order', documentType: 'PO', documentNo: 'PO-2287', action: 'Approved', fieldChanged: 'Status', oldValue: 'Pending', newValue: 'Approved', performedBy: 'Ramesh Kumar', approvedBy: 'Suresh Rao', status: 'Approved', remarks: 'Approved within credit limit' },
      { actionDate: '2026-06-29 16:05', module: 'Product Master', documentType: 'Product', documentNo: 'ELE-1001', action: 'Updated', fieldChanged: 'Sales Rate', oldValue: '29500', newValue: '31500', performedBy: 'Priya Sharma', approvedBy: '', status: 'Updated', remarks: 'Price revision effective June' },
      { actionDate: '2026-06-28 09:18', module: 'Stock Adjustment', documentType: 'Adjustment', documentNo: 'ADJ-0091', action: 'Rejected', fieldChanged: 'Quantity', oldValue: '0', newValue: '-25', performedBy: 'Warehouse User', approvedBy: 'Suresh Rao', status: 'Rejected', remarks: 'Insufficient supporting documents' }
    ]
  })
];

export const INVENTORY_REPORTS = INVENTORY_PHASE_1_REPORTS;

export function inventoryReportGroupTitle(groupId: string): string {
  return INVENTORY_REPORT_GROUPS.find(group => group.id === groupId)?.title ?? 'Inventory Reports';
}

export function inventoryReportGroupIcon(groupId: string): string {
  return INVENTORY_REPORT_GROUPS.find(group => group.id === groupId)?.icon ?? 'pi pi-file';
}

export function findInventoryReport(slug: string | null | undefined): InventoryReportDefinition {
  const aliases: Record<string, string> = {
    'stock-availability-report': 'stock-summary',
    'segment-summary': 'inventory-summary',
    'hsn-sac-report': 'hsn-summary'
  };
  const normalizedSlug = slug ? aliases[slug] ?? slug : slug;
  return INVENTORY_REPORTS.find(report => report.slug === normalizedSlug || report.key === normalizedSlug) ?? INVENTORY_REPORTS[0];
}
