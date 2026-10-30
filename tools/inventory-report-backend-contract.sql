/*
  Inventory Reports Backend Contract - Phase 1

  This workspace contains the Angular frontend only. Use this script as the
  backend/database contract for the report controller and optimized SQL layer.
  Map table names to the actual ERP schema before running in a database.

  Standard API response:
  {
    "success": true,
    "message": "",
    "data": [],
    "summary": {},
    "totalRecords": 0
  }

  Required endpoint pattern:
  GET /api/reports/{report-key}

  Common query params:
  companyId, branchId, financialYear, warehouseId, fromDate, toDate,
  productId, productCategory, brand, hsnSac, customerId, supplierId,
  batchNo, serialNo, uom, status, project, department, createdBy,
  approvedBy, globalSchema, branchSchema, userId, roleId, page, pageSize.
*/

/*
  Phase 1 endpoints to implement in InventoryReportsController:

  /api/reports/inventory-summary
  /api/reports/stock-summary
  /api/reports/stock-ledger
  /api/reports/warehouse-wise-stock
  /api/reports/low-stock-alert
  /api/reports/purchase-order-register
  /api/reports/grn-register
  /api/reports/purchase-invoice-register
  /api/reports/sales-order-register
  /api/reports/delivery-challan-register
  /api/reports/sales-invoice-register
  /api/reports/pending-document
  /api/reports/hsn-summary
  /api/reports/batch-serial-expiry
  /api/reports/product-profitability
  /api/reports/dues-list
*/

/*
  /api/reports/dues-list  (Dues List Report, customer-wise)

  Params: toDate (= "As on" date; default today), customerId, branchId.
  One row per POSTED, non-cancelled Sales Invoice with invoiceDate <= toDate
  whose due is > 0. Use the same outstanding logic as the Customer Receipt
  outstanding-invoices API, but count only receipts / credit notes dated
  <= toDate, so a back-dated "As on" shows what was due on that day.

  Row fields:
    invoiceDate     sales invoice date
    invoiceNo       sales invoice number
    customer        customer name
    totalAmount     invoice grand total
    receivedAmount  receipts + credit notes allocated to it up to toDate
    dueAmount       totalAmount - receivedAmount
    ageDays         toDate - invoiceDate (days)

  Order by customer, invoiceDate, invoiceNo.
  summary: { totalAmount, receivedAmount, dueAmount }

  Later (after Sales Invoice saves the group-company branch): add
  customerBranch and region (GLOBAL.tbl_mst_global_branch_configuration
  .branch_name / .region_name) to each row.
*/

/*
  Authorization rule:
  - Always filter by allowed companyId, branchId and warehouseId from user role.
  - Admin may omit branchId/warehouseId only when the user permission allows it.
  - Export and print should reuse the same filtered query as the grid.
*/

/*
  Recommended indexes. Replace table names with the actual ERP table names.
*/

-- Inventory movement / ledger
-- CREATE INDEX IX_InventoryTransactions_ReportFilters
-- ON dbo.InventoryTransactions (companyId, branchId, warehouseId, transactionDate, productId, documentNo)
-- INCLUDE (inwardQty, outwardQty, rate, value, batchNo, serialNo, createdBy, approvedBy, status);

-- Product master report filters
-- CREATE INDEX IX_InventoryProducts_ReportFilters
-- ON dbo.InventoryProducts (companyId, productId, categoryId, brandId, hsnCode, uomId, status);

-- Purchase register filters
-- CREATE INDEX IX_PurchaseOrders_ReportFilters
-- ON dbo.PurchaseOrders (companyId, branchId, supplierId, poDate, status, documentNo)
-- INCLUDE (grossAmount, taxAmount, netAmount, createdBy, approvedBy);

-- GRN register filters
-- CREATE INDEX IX_GoodsReceipt_ReportFilters
-- ON dbo.GoodsReceiptNotes (companyId, branchId, warehouseId, supplierId, grnDate, status, documentNo)
-- INCLUDE (poNo, receivedQty, acceptedQty, rejectedQty, createdBy, approvedBy);

-- Purchase invoice filters
-- CREATE INDEX IX_PurchaseInvoices_ReportFilters
-- ON dbo.PurchaseInvoices (companyId, branchId, supplierId, invoiceDate, status, invoiceNo)
-- INCLUDE (taxableAmount, cgst, sgst, igst, netAmount, createdBy, approvedBy);

-- Sales order and invoice filters
-- CREATE INDEX IX_SalesOrders_ReportFilters
-- ON dbo.SalesOrders (companyId, branchId, customerId, soDate, status, documentNo)
-- INCLUDE (grossAmount, taxAmount, netAmount, createdBy, approvedBy);

-- Delivery challan filters
-- CREATE INDEX IX_DeliveryChallans_ReportFilters
-- ON dbo.DeliveryChallans (companyId, branchId, warehouseId, customerId, dcDate, status, documentNo)
-- INCLUDE (soNo, vehicleNo, transporterId, createdBy, approvedBy);

-- Sales invoice filters
-- CREATE INDEX IX_SalesInvoices_ReportFilters
-- ON dbo.SalesInvoices (companyId, branchId, customerId, invoiceDate, status, invoiceNo)
-- INCLUDE (taxableAmount, cgst, sgst, igst, netAmount, createdBy, approvedBy);

-- Batch / serial / expiry filters
-- CREATE INDEX IX_InventoryBatchSerial_ReportFilters
-- ON dbo.InventoryBatchSerial (companyId, branchId, warehouseId, productId, batchNo, serialNo, expiryDate, status)
-- INCLUDE (manufacturingDate, quantity, value);

/*
  View/query guidance:
  - Build views over posted transaction tables and product/party masters.
  - Do not copy transaction data into report tables.
  - Use OFFSET/FETCH or keyset pagination for large registers.
  - Summary cards should be computed by the same filtered query scope as the grid.
*/
