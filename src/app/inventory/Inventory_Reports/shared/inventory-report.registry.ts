import {
  InventoryReportColumn,
  InventoryReportDefinition,
  InventoryReportFilterKey,
  InventoryReportGroup
} from './inventory-report.models';

// No 'companyId' filter — a report is always scoped to the single company the
// user is currently signed into (see currentCompanyName() on the report page,
// shown as a read-only badge instead); a multiselect of other companies never
// meant anything real here and only ever listed hardcoded demo names.
const baseFilters: InventoryReportFilterKey[] = ['branchId', 'segmentId', 'financialYear', 'warehouseId', 'fromDate', 'toDate', 'status'];
const productFilters: InventoryReportFilterKey[] = ['productId', 'productCategory', 'brand', 'hsnSac', 'uom', 'batchNo', 'serialNo'];
const partyFilters: InventoryReportFilterKey[] = ['customerId', 'supplierId'];
const controlFilters: InventoryReportFilterKey[] = ['project', 'department', 'createdBy', 'approvedBy'];

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

// No hardcoded sample / preview rows or fallback card values in any report --
// every report shows only live data from the API (empty until generated).
function phaseOneReport(definition: Omit<InventoryReportDefinition, 'phase' | 'filters'> & { filters?: InventoryReportFilterKey[] }): InventoryReportDefinition {
  return {
    ...definition,
    phase: 1,
    filters: definition.filters ?? [...baseFilters, ...productFilters, ...partyFilters, ...controlFilters],
    columns: withSegmentColumn(definition.columns)
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
      { label: 'Total stock value', valueKey: 'totalStockValue', icon: 'pi pi-chart-bar', tone: 'blue' },
      { label: 'Total products', valueKey: 'totalProducts', icon: 'pi pi-list', tone: 'blue' },
      { label: 'Low stock items', valueKey: 'lowStockItems', icon: 'pi pi-exclamation-triangle', tone: 'rose' },
      { label: 'Out of stock items', valueKey: 'outOfStockItems', icon: 'pi pi-times-circle', tone: 'rose' },
      { label: 'Negative stock items', valueKey: 'negativeStockItems', icon: 'pi pi-minus-circle', tone: 'amber' },
      { label: 'Near expiry items', valueKey: 'nearExpiryItems', icon: 'pi pi-calendar-times', tone: 'amber' },
      { label: 'Pending purchase orders', valueKey: 'pendingPurchaseOrders', icon: 'pi pi-shopping-cart', tone: 'blue' },
      { label: 'Pending sales orders', valueKey: 'pendingSalesOrders', icon: 'pi pi-truck', tone: 'blue' },
      { label: "Today's sales", valueKey: 'todaySales', icon: 'pi pi-arrow-circle-up', tone: 'green' },
      { label: "Today's purchases", valueKey: 'todayPurchases', icon: 'pi pi-arrow-circle-down', tone: 'green' },
      { label: 'Top selling products', valueKey: 'topSellingProducts', icon: 'pi pi-star', tone: 'green' },
      { label: 'Slow moving products', valueKey: 'slowMovingProducts', icon: 'pi pi-clock', tone: 'amber' }
    ],
    columns: cols([
      ['indicatorGroup', 'Group'],
      ['indicator', 'Indicator'],
      ['currentValue', 'Current Value'],
      ['risk', 'Risk', 'status'],
      ['ownerAction', 'Owner Action']
    ]),
    defaultGroupBy: 'indicatorGroup',
    drillDown: true
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
      { label: 'Closing stock value', valueKey: 'stockValue', icon: 'pi pi-wallet', tone: 'blue' },
      { label: 'GST on stock', valueKey: 'gstAmount', icon: 'pi pi-percentage', tone: 'amber' },
      { label: 'Products covered', valueKey: 'productCount', icon: 'pi pi-list', tone: 'green' },
      { label: 'Inward quantity', valueKey: 'inwardQty', icon: 'pi pi-arrow-down', tone: 'green' },
      { label: 'Outward quantity', valueKey: 'outwardQty', icon: 'pi pi-arrow-up', tone: 'amber' }
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
      ['gstRate', 'GST %', 'percent'],
      ['gstAmount', 'GST Amount', 'currency', true],
      ['pendingInvoiceQty', 'Dispatched Without SI', 'number', true]
    ]),
    defaultGroupBy: 'category',
    drillDown: true
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
    drillDown: true
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
    defaultGroupBy: 'warehouse'
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
    drillDown: true
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
    drillDown: true
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
    drillDown: true
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
    drillDown: true
  }),
  // Purchase Invoice (client item-wise format) is its own component -
  // Inventory_Reports/purchase-invoice, route 'purchase-invoice' - not in this list.
  // Its definition is PURCHASE_INVOICE_REPORT at the end of this file.
  // Vendor Dues (308): posted Purchase Invoices still unpaid or part-paid as on
  // "Date To" - same due as the Vendor Payment pending list. Layout follows the
  // old "Vendor Wise Dues List": vendor heading, vendor bill no / date, Total and
  // Due, a "Total:" line per vendor. PI No / Paid / Age can be switched on.
  phaseOneReport({
    key: 'vendorDues',
    slug: 'vendor-dues',
    title: 'Vendor Wise Dues List',
    groupId: 'purchase',
    endpoint: 'vendor-dues',
    icon: 'pi pi-wallet',
    purpose: 'Vendor-wise list of unpaid and part-paid purchase invoices with total and due amount as on a date.',
    audience: ['Accountant', 'Purchase', 'Business Owner'],
    // Previous: filters: ['branchId', 'toDate', 'supplierId'],
    // From Date + To Date with the As On checkbox, like the Dues List (317).
    filters: ['branchId', 'fromDate', 'toDate', 'supplierId'],
    columns: cols([
      ['segment', 'Segment', 'text', false, false],
      ['supplier', 'Vendor Name'],
      ['invoiceNo', 'Invoice No'],
      // Previous: ['invoiceDate', 'Invoice Date', 'date'],
      // invoiceDate is the vendor's bill date (vendor_invoice_dt); piDate is our
      // Purchase Invoice date - both shown under each vendor.
      ['invoiceDate', 'Vendor Invoice Date', 'date'],
      ['piNo', 'PI No', 'text', false, false],
      // Previous: ['piDate', 'PI Date', 'date', false, false],
      ['piDate', 'Purchase Invoice Date', 'date'],
      ['totalAmount', 'Total Amount', 'currency', true],
      ['paidAmount', 'Paid', 'currency', true, false],
      ['dueAmount', 'Due Amount', 'currency', true],
      ['ageDays', 'Age (Days)', 'number', false, false]
    ]),
    defaultGroupBy: 'supplier'  }),
  // Vendor Payments (309): posted Inventory Vendor Payments between From / To
  // date, one row per purchase invoice paid. Layout follows the old "VENDOR
  // PAYMENTS REPORT": vendor code-name heading, Trans Date, vendor bill no,
  // amount, Cheque No, Voucher No; plus a Total per vendor and a Grand Total.
  // Paid Amount = what was paid on that invoice in that voucher (lines of one
  // voucher add up to its cheque); Invoice Amount (full total) can be switched on.
  phaseOneReport({
    key: 'vendorPaymentReport',
    slug: 'vendor-payment-report',
    title: 'Vendor Payments Report',
    groupId: 'purchase',
    endpoint: 'vendor-payment-report',
    icon: 'pi pi-money-bill',
    purpose: 'Vendor-wise list of purchase invoices paid between two dates, with cheque and voucher number.',
    audience: ['Accountant', 'Purchase', 'Business Owner'],
    filters: ['branchId', 'fromDate', 'toDate', 'supplierId'],
    columns: cols([
      ['segment', 'Segment', 'text', false, false],
      ['supplier', 'Vendor Name'],
      ['transDate', 'Trans Date', 'date'],
      ['invoiceNo', 'Invoice No'],
      ['piNo', 'PI No', 'text', false, false],
      ['invoiceAmount', 'Invoice Amount', 'currency', false, false],
      ['paidAmount', 'Paid Amount', 'currency', true],
      ['chequeNo', 'Cheque No'],
      ['paymentMode', 'Payment Mode', 'text', false, false],
      ['voucherNo', 'Voucher No']
    ]),
    defaultGroupBy: 'supplier'
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
    drillDown: true
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
    drillDown: true
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
      ['netAmount', 'Net Amount', 'currency', true]
    ]),
    defaultGroupBy: 'customer',
    drillDown: true
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
    // Previous: filters: ['branchId', 'toDate', 'customerId'],
    // From Date + To Date (user request 2026-11-23): invoices dated in the range, due as on To Date (310).
    filters: ['branchId', 'fromDate', 'toDate', 'customerId'],
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
    defaultGroupBy: 'customer'  }),
  // Product-wise Dues List (313): same invoices and due as the Dues List, one
  // row per product line. A receipt is against the whole invoice, so its Total
  // and Received are split across the invoice's products by line value; the
  // Grand Total Due always equals the Dues List total for the same filters.
  phaseOneReport({
    key: 'productwiseDues',
    slug: 'productwise-dues',
    title: 'Product-wise Dues List',
    groupId: 'customerSupplier',
    endpoint: 'productwise-dues',
    icon: 'pi pi-box',
    purpose: 'Product-wise list of amounts still due from customers on unpaid and part-paid sales invoices as on a date.',
    audience: ['Accountant', 'Sales', 'Business Owner'],
    filters: ['branchId', 'fromDate', 'toDate', 'customerId', 'productId'],
    columns: cols([
      // Segment is auto-added to every report; hidden here, same as Dues List.
      ['segment', 'Segment', 'text', false, false],
      ['product', 'Product'],
      ['productCode', 'Product Code', 'text', false, false],
      ['variant', 'Variant', 'text', false, false],
      ['customer', 'Customer'],
      ['invoiceNo', 'Invoice No'],
      ['invoiceDate', 'Invoice Date', 'date'],
      ['qty', 'Qty', 'number', true],
      ['uom', 'UOM', 'text', false, false],
      ['totalAmount', 'Total Amount', 'currency', true],
      ['receivedAmount', 'Received', 'currency', true],
      ['dueAmount', 'Due Amount', 'currency', true],
      ['ageDays', 'Age (Days)', 'number']
    ]),
    defaultGroupBy: 'product'  }),
  // Collection Report (319, user request 2026-11-28): every credit to a customer
  // under SUNDRY DEBITORS between From / To date, read from the accounts ledger --
  // Inventory / Accounts receipts, cleared cheques (RJV) and JVs. One row per
  // receipt (per invoice for Inventory receipts); Accounts receipts / JVs have no
  // invoice, so those columns stay blank. A cheque counts on its clearing date.
  // Cards and export lines: Grand Total Cheque / Cash / JV and Total Collection
  // (online receipts are totalled under Cheque).
  // Previous (281): one row per customer with Cash / Pre Cash / Cheque / Pre Cheque /
  // JV / Pre JV / Grand Total from Inventory Customer Receipts only.
  phaseOneReport({
    key: 'collectionReport',
    slug: 'collection-report',
    title: 'Collection Report',
    groupId: 'customerSupplier',
    endpoint: 'collection-report',
    icon: 'pi pi-money-bill',
    purpose: 'Money collected from customers in a period: every receipt, cleared cheque and JV credited to Sundry Debitors, with Cheque / Cash / JV totals.',
    audience: ['Accountant', 'Sales', 'Business Owner'],
    filters: ['branchId', 'fromDate', 'toDate', 'customerId'],
    summaryCards: [
      { label: 'Grand Total Cheque', valueKey: 'chequeAmount', icon: 'pi pi-credit-card', tone: 'blue' },
      { label: 'Grand Total Cash', valueKey: 'cashAmount', icon: 'pi pi-wallet', tone: 'green' },
      { label: 'Grand Total JV', valueKey: 'jvAmount', icon: 'pi pi-book', tone: 'amber' },
      { label: 'Total Collection', valueKey: 'totalCollection', icon: 'pi pi-money-bill', tone: 'blue' }
    ],
    columns: cols([
      // Segment is auto-added to every report; hidden here, same as Dues List.
      ['segment', 'Segment', 'text', false, false],
      ['sNo', 'S.No', 'number'],
      ['receiptDate', 'Receipt Date', 'date'],
      ['receiptNo', 'Receipt / JV No'],
      ['customer', 'Customer'],
      ['invoiceNo', 'Invoice'],
      ['invoiceDate', 'Invoice Date', 'date'],
      ['invoiceAmount', 'Invoice Amount', 'currency'],
      ['receivedAmount', 'Received Amount', 'currency', true],
      ['mode', 'CHQ / CASH']
    ])  }),
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
    drillDown: true
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
    defaultGroupBy: 'hsnSacCode'
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
    drillDown: true
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
    drillDown: true
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
    drillDown: true
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
    ])
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
    ])
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
    drillDown: true
  })
];

export const INVENTORY_REPORTS = INVENTORY_PHASE_1_REPORTS;

// Purchase Invoice (user 2026-11-28): the same screen as the Purchase Invoice
// Register - same filters, Generate, search, columns, export, paging - and the same
// endpoint (320), but one grid row per item line in the client's "Purchase Report"
// columns. Used by PurchaseInvoiceReportComponent (route 'purchase-invoice'), which
// extends the report page; kept out of INVENTORY_REPORTS so ':reportKey' never picks it.
export const PURCHASE_INVOICE_REPORT: InventoryReportDefinition = phaseOneReport({
  key: 'purchaseInvoice',
  slug: 'purchase-invoice',
  title: 'Purchase Invoice',
  groupId: 'purchase',
  endpoint: 'purchase-invoice-register',
  icon: 'pi pi-file-import',
  purpose: 'Item-wise purchase invoices with CGST / SGST / IGST, other charges and deductions.',
  audience: ['Accountant', 'Purchase', 'Admin'],
  // Same filters as the Purchase Invoice Register.
  filters: [...baseFilters, 'supplierId', 'hsnSac', 'status', 'createdBy', 'approvedBy'],
  columns: cols([
    ['segment', 'Segment', 'text', false, false],
    ['invoiceDate', 'Date', 'date'],
    ['invoiceNo', 'Invoice'],
    ['piNo', 'PI No', 'text', false, false],
    ['vendor', 'Vendor/Direct Sale'],
    ['itemDescription', 'Item Description'],
    ['qty', 'Qty.', 'number'],
    ['price', 'Price', 'currency'],
    ['amount', 'Amount', 'currency', true],
    ['cgstRate', 'CGST Rate %', 'number'],
    ['cgst', 'CGST Amount', 'currency', true],
    ['sgstRate', 'SGST Rate %', 'number'],
    ['sgst', 'SGST Amount', 'currency', true],
    ['igstRate', 'IGST Rate %', 'number'],
    ['igst', 'IGST Amount', 'currency', true],
    ['otherCharges', 'Other Charges', 'currency', true],
    ['otherDeductions', 'Other Deductions', 'currency', true],
    ['totalAmount', 'Total Amount', 'currency', true],
    ['status', 'Status', 'status', false, false]
  ])
});

// Sale Invoice (user 2026-11-28): the client's old "Sales Report" - same screen as the
// Sale Invoice Register (same filters and endpoint, 321), one grid row per item line,
// grouped SALES / SALE RETURN / CANCEL like the old print. Used by
// SaleInvoiceReportComponent (route 'sale-invoice'); kept out of INVENTORY_REPORTS.
// On screen, Sale Return and Cancel amounts are negative, so the Grand Total row is
// the net sales; the PDF / Excel print every section with positive amounts.
export const SALE_INVOICE_REPORT: InventoryReportDefinition = phaseOneReport({
  key: 'saleInvoice',
  slug: 'sale-invoice',
  title: 'Sale Invoice',
  groupId: 'sales',
  endpoint: 'sales-invoice-register',
  icon: 'pi pi-receipt',
  purpose: 'Item-wise sales invoices, sales returns and cancelled invoices with CGST / SGST / IGST.',
  audience: ['Accountant', 'Sales', 'Business Owner'],
  // Same filters as the Sale Invoice Register.
  filters: [...baseFilters, 'customerId', 'productId', 'hsnSac', 'status', 'createdBy', 'approvedBy'],
  columns: cols([
    ['segment', 'Segment', 'text', false, false],
    ['section', 'Type'],
    ['invoiceDate', 'Date', 'date'],
    ['invoiceNo', 'Invoice'],
    ['customerLabel', 'Dealer/Customer Name'],
    ['itemDescription', 'Item Description'],
    ['qty', 'Qty.', 'number'],
    ['price', 'Price', 'currency'],
    ['amount', 'Amount', 'currency', true],
    ['cgstRate', 'CGST Rate %', 'number'],
    ['cgst', 'CGST Amount', 'currency', true],
    ['sgstRate', 'SGST Rate %', 'number'],
    ['sgst', 'SGST Amount', 'currency', true],
    ['igstRate', 'IGST Rate %', 'number'],
    ['igst', 'IGST Amount', 'currency', true],
    ['otherCharges', 'Other Charges', 'currency', true],
    ['otherDeductions', 'Other Deductions', 'currency', true],
    ['totalAmount', 'Total Amount', 'currency', true],
    ['status', 'Status', 'status', false, false]
  ]),
  defaultGroupBy: 'section'
});

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
