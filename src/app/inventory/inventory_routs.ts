import { Routes } from '@angular/router';
import { screenPermissionGuard, reportPermissionGuard } from '../core/guards/auth.guard';

export const inventoryRoutes: Routes = [
  {
    path: 'inventory-dashboard',
    children: [
      {
        path: 'dashboard',
        canActivate: [screenPermissionGuard('INV_R_DASHBOARD')],
        loadComponent: () => import('./inventory-dashboard/inventory-dashboard')
          .then(m => m.InventoryDashboard)
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },
  {
    path: 'configuration',
    children: [
      {
        path: 'business-segments',
        canActivate: [screenPermissionGuard('INV_CFG_SEGMENTS')],
        loadComponent: () => import('./Inventory_Config/business-segments/business-segments')
          .then(m => m.InventoryBusinessSegmentsComponent)
      },
      {
        path: 'warehouse-location-master',
        canActivate: [screenPermissionGuard('INV_WAREHOUSE')],
        loadComponent: () => import('./Inventory_Config/warehouse-location-master/warehouse-location-master')
          .then(m => m.InventoryWarehouseLocationMasterComponent)
      },
      {
        path: 'branch-master',
        canActivate: [screenPermissionGuard('INV_CFG_BRANCH')],
        loadComponent: () => import('./Inventory_Config/branch-master/branch-master')
          .then(m => m.InventoryBranchMasterComponent)
      },
      {
        path: 'tax-code-import',
        canActivate: [screenPermissionGuard('INV_CFG_TAXCODE')],
        loadComponent: () => import('./Inventory_Config/tax-code-import/tax-code-import')
          .then(m => m.InventoryTaxCodeImportComponent)
      },
      {
        // Reachable from the "Import Data" breadcrumb button (any Inventory
        // screen, OneSphere-Accounts main-layout.component.html's
        // .bc-pay-toggle group), not just Business Segment Data where this
        // used to live -- same screen permission it always had there, since
        // it's the same feature relocated, not a new one.
        path: 'import-data',
        canActivate: [screenPermissionGuard('INV_CFG_SEGMENTS')],
        loadComponent: () => import('./Inventory_Config/import-data/import-data')
          .then(m => m.InventoryImportDataComponent)
      },
      { path: '', redirectTo: 'business-segments', pathMatch: 'full' }
    ]
  },
  {
    path: 'masters',
    children: [
      {
        path: 'product-service-master',
        canActivate: [screenPermissionGuard('INV_M_PRODUCT')],
        loadComponent: () => import('./Inventory_Masters/product-service-master/product-service-master')
          .then(m => m.InventoryProductServiceMasterComponent)
      },
      {
        path: 'category-master',
        canActivate: [screenPermissionGuard('INV_CATEGORY')],
        loadComponent: () => import('./Inventory_Masters/category-master/category-master')
          .then(m => m.InventoryCategoryMasterComponent)
      },
      {
        path: 'product-group-master',
        canActivate: [screenPermissionGuard('INV_M_PRODUCT_GROUP')],
        loadComponent: () => import('./Inventory_Masters/product-group-master/product-group-master')
          .then(m => m.InventoryProductGroupMasterComponent)
      },
      {
        path: 'brand-master',
        canActivate: [screenPermissionGuard('INV_M_BRAND')],
        loadComponent: () => import('./Inventory_Masters/brand-master/brand-master')
          .then(m => m.InventoryBrandMasterComponent)
      },
      {
        path: 'attribute-master',
        canActivate: [screenPermissionGuard('INV_M_ATTRIBUTE')],
        loadComponent: () => import('./Inventory_Masters/attribute-master/attribute-master')
          .then(m => m.InventoryAttributeMasterComponent)
      },
      {
        path: 'variant-master',
        canActivate: [screenPermissionGuard('INV_M_VARIANT')],
        loadComponent: () => import('./Inventory_Masters/variant-master/variant-master')
          .then(m => m.InventoryVariantMasterComponent)
      },
      {
        path: 'uom-master',
        canActivate: [screenPermissionGuard('INV_UOM')],
        loadComponent: () => import('./Inventory_Masters/uom-master/uom-master')
          .then(m => m.InventoryUomMasterComponent)
      },
      {
        path: 'hsn-sac-mapping',
        canActivate: [screenPermissionGuard('INV_M_HSNSAC')],
        loadComponent: () => import('./Inventory_Masters/hsn-sac-mapping/hsn-sac-mapping')
          .then(m => m.InventoryHsnSacMappingComponent)
      },
      {
        path: 'barcode-configuration',
        canActivate: [screenPermissionGuard('INV_M_BARCODE')],
        loadComponent: () => import('./Inventory_Masters/barcode-configuration/barcode-configuration')
          .then(m => m.InventoryBarcodeConfigurationComponent)
      },
      {
        path: 'serial-number-policy',
        canActivate: [screenPermissionGuard('INV_M_SERIAL_POLICY')],
        loadComponent: () => import('./Inventory_Masters/serial-number-policy/serial-number-policy')
          .then(m => m.InventorySerialNumberPolicyComponent)
      },
      {
        path: 'batch-lot-policy',
        canActivate: [screenPermissionGuard('INV_M_BATCH_POLICY')],
        loadComponent: () => import('./Inventory_Masters/batch-lot-policy/batch-lot-policy')
          .then(m => m.InventoryBatchLotPolicyComponent)
      },
      {
        path: 'substitute-products',
        redirectTo: 'product-service-master',
        pathMatch: 'full'
      },
      {
        path: 'opening-inventory-balance',
        canActivate: [screenPermissionGuard('INV_M_OPENING_BAL')],
        loadComponent: () => import('./Inventory_Masters/opening-inventory-balance/opening-inventory-balance')
          .then(m => m.InventoryOpeningInventoryBalanceComponent)
      },
      {
        path: 'vendor-master',
        canActivate: [screenPermissionGuard('INV_M_VENDOR')],
        loadComponent: () => import('./Inventory_Masters/vendor-master/vendor-master')
          .then(m => m.InventoryVendorMasterComponent)
      },
      {
        path: 'payment-terms-master',
        canActivate: [screenPermissionGuard('INV_M_PAYTERMS')],
        loadComponent: () => import('./Inventory_Masters/payment-terms-master/payment-terms-master')
          .then(m => m.InventoryPaymentTermsMasterComponent)
      },
      {
        path: 'customer-master',
        canActivate: [screenPermissionGuard('INV_M_CUSTOMER')],
        loadComponent: () => import('./Inventory_Masters/customer-master/customer-master')
          .then(m => m.InventoryCustomerMasterComponent)
      },
      {
        path: 'channel-partner-master',
        canActivate: [screenPermissionGuard('INV_M_CHANNEL_PARTNER')],
        loadComponent: () => import('./Inventory_Masters/channel-partner-master/channel-partner-master')
          .then(m => m.InventoryChannelPartnerMasterComponent)
      },
      {
        path: 'price-list-master',
        canActivate: [screenPermissionGuard('INV_M_PRICELIST')],
        loadComponent: () => import('./Inventory_Masters/price-list-master/price-list-master')
          .then(m => m.InventoryPriceListMasterComponent)
      },
      {
        path: 'bom-master',
        canActivate: [screenPermissionGuard('INV_M_BOM')],
        loadComponent: () => import('./Inventory_Masters/bom-master/bom-master')
          .then(m => m.InventoryBomMasterComponent)
      },
      {
        path: 'work-center-master',
        canActivate: [screenPermissionGuard('INV_M_WORKCENTER')],
        loadComponent: () => import('./Inventory_Masters/work-center-master/work-center-master')
          .then(m => m.InventoryWorkCenterMasterComponent)
      },
      {
        path: 'consumption-type-master',
        canActivate: [screenPermissionGuard('INV_M_CONSUMPTION')],
        loadComponent: () => import('./Inventory_Masters/consumption-type-master/consumption-type-master')
          .then(m => m.InventoryConsumptionTypeMasterComponent)
      },
      {
        path: 'product-type-master',
        canActivate: [screenPermissionGuard('INV_M_PRODUCT_TYPE')],
        loadComponent: () => import('./Inventory_Masters/product-type-master/product-type-master')
          .then(m => m.InventoryProductTypeMasterComponent)
      },
      {
        path: 'approval-workflow-master',
        canActivate: [screenPermissionGuard('INV_M_APPROVAL')],
        loadComponent: () => import('./Inventory_Masters/approval-workflow-master/approval-workflow-master')
          .then(m => m.InventoryApprovalWorkflowMasterComponent)
      },
      {
        path: 'transporter-master',
        canActivate: [screenPermissionGuard('INV_M_TRANSPORTER')],
        loadComponent: () => import('./Inventory_Masters/transporter-master/transporter-master')
          .then(m => m.InventoryTransporterMasterComponent)
      },
      {
        path: 'vehicle-master',
        canActivate: [screenPermissionGuard('INV_M_VEHICLE')],
        loadComponent: () => import('./Inventory_Masters/vehicle-master/vehicle-master')
          .then(m => m.InventoryVehicleMasterComponent)
      },
      { path: '', redirectTo: 'product-service-master', pathMatch: 'full' }
    ]
  },
  {
    path: 'transactions',
    children: [
      // Payments & Receipts
      {
        path: 'vendor-payment',
        canActivate: [screenPermissionGuard('INV_T_VENDOR_PAYMENT')],
        loadComponent: () => import('./Inventory_Transactions/payment-receipt-voucher/payment-receipt-voucher')
          .then(m => m.PaymentReceiptVoucherComponent),
        data: { mode: 'pay' }
      },
      {
        path: 'customer-receipt',
        canActivate: [screenPermissionGuard('INV_T_CUSTOMER_RECEIPT')],
        loadComponent: () => import('./Inventory_Transactions/payment-receipt-voucher/payment-receipt-voucher')
          .then(m => m.PaymentReceiptVoucherComponent),
        data: { mode: 'receipt' }
      },
      // Procurement
      {
        path: 'purchase-requisition',
        canActivate: [screenPermissionGuard('INV_T_PR')],
        loadComponent: () => import('./Inventory_Transactions/purchase-requisition/purchase-requisition')
          .then(m => m.InventoryPurchaseRequisitionComponent)
      },
      {
        path: 'request-for-quotation',
        canActivate: [screenPermissionGuard('INV_T_RFQ')],
        loadComponent: () => import('./Inventory_Transactions/request-for-quotation/request-for-quotation')
          .then(m => m.InventoryRequestForQuotationComponent)
      },
      {
        path: 'purchase-order',
        canActivate: [screenPermissionGuard('INV_T_PO')],
        loadComponent: () => import('./Inventory_Transactions/purchase-order/purchase-order')
          .then(m => m.InventoryPurchaseOrderComponent)
      },
      {
        path: 'goods-receipt',
        canActivate: [screenPermissionGuard('INV_T_GRN')],
        loadComponent: () => import('./Inventory_Transactions/goods-receipt/goods-receipt')
          .then(m => m.InventoryGoodsReceiptComponent)
      },
      {
        path: 'purchase-invoice',
        canActivate: [screenPermissionGuard('INV_T_PI')],
        loadComponent: () => import('./Inventory_Transactions/purchase-invoice/purchase-invoice')
          .then(m => m.InventoryPurchaseInvoiceComponent)
      },
      {
        path: 'purchase-return',
        canActivate: [screenPermissionGuard('INV_T_PURCHASE_RETURN')],
        loadComponent: () => import('./Inventory_Transactions/purchase-return/purchase-return')
          .then(m => m.InventoryPurchaseReturnComponent)
      },
      // Sales
      {
        path: 'sales-enquiry',
        canActivate: [screenPermissionGuard('INV_T_SALES_ENQUIRY')],
        loadComponent: () => import('./Inventory_Transactions/sales-enquiry/sales-enquiry')
          .then(m => m.InventorySalesEnquiryComponent)
      },
      {
        path: 'sales-quotation',
        canActivate: [screenPermissionGuard('INV_T_SALES_QUOTATION')],
        loadComponent: () => import('./Inventory_Transactions/sales-quotation/sales-quotation')
          .then(m => m.InventorySalesQuotationComponent)
      },
      {
        path: 'sales-order',
        canActivate: [screenPermissionGuard('INV_T_SO')],
        loadComponent: () => import('./Inventory_Transactions/sales-order/sales-order')
          .then(m => m.InventorySalesOrderComponent)
      },
      {
        path: 'delivery-challan',
        canActivate: [screenPermissionGuard('INV_T_DC')],
        loadComponent: () => import('./Inventory_Transactions/delivery-challan/delivery-challan')
          .then(m => m.InventoryDeliveryChallanComponent)
      },
      {
        path: 'sales-invoice',
        canActivate: [screenPermissionGuard('INV_T_SI')],
        loadComponent: () => import('./Inventory_Transactions/sales-invoice/sales-invoice')
          .then(m => m.InventorySalesInvoiceComponent)
      },
      {
        path: 'sales-return',
        canActivate: [screenPermissionGuard('INV_T_SALES_RETURN')],
        loadComponent: () => import('./Inventory_Transactions/sales-return/sales-return')
          .then(m => m.InventorySalesReturnComponent)
      },
      // Inventory
      {
        path: 'stock-transfer',
        canActivate: [screenPermissionGuard('INV_T_STOCK_TRANSFER')],
        loadComponent: () => import('./Inventory_Transactions/stock-transfer/stock-transfer')
          .then(m => m.InventoryStockTransferComponent)
      },
      {
        path: 'stock-adjustment',
        canActivate: [screenPermissionGuard('INV_T_STOCK_ADJ')],
        loadComponent: () => import('./Inventory_Transactions/stock-adjustment/stock-adjustment')
          .then(m => m.InventoryStockAdjustmentComponent)
      },
      {
        path: 'opening-stock-entry',
        canActivate: [screenPermissionGuard('INV_T_OPENING_STOCK')],
        loadComponent: () => import('./Inventory_Transactions/opening-stock-entry/opening-stock-entry')
          .then(m => m.InventoryOpeningStockEntryComponent)
      },
      {
        path: 'cycle-count',
        canActivate: [screenPermissionGuard('INV_T_CYCLE_COUNT')],
        loadComponent: () => import('./Inventory_Transactions/cycle-count/cycle-count')
          .then(m => m.InventoryCycleCountComponent)
      },
      // Manufacturing
      {
        path: 'production-planning',
        canActivate: [screenPermissionGuard('INV_T_PROD_PLAN')],
        loadComponent: () => import('./Inventory_Transactions/production-planning/production-planning')
          .then(m => m.InventoryProductionPlanningComponent)
      },
      {
        path: 'material-issue-production',
        canActivate: [screenPermissionGuard('INV_T_MAT_ISSUE_PROD')],
        loadComponent: () => import('./Inventory_Transactions/material-issue-production/material-issue-production')
          .then(m => m.InventoryMaterialIssueProductionComponent)
      },
      {
        path: 'production-entry',
        canActivate: [screenPermissionGuard('INV_T_PROD_ENTRY')],
        loadComponent: () => import('./Inventory_Transactions/production-entry/production-entry')
          .then(m => m.InventoryProductionEntryComponent)
      },
      {
        path: 'uin-registration',
        // Same permission as Production Entry for now: whoever records production
        // can also register the UINs. A separate key can be added later.
        canActivate: [screenPermissionGuard('INV_T_PROD_ENTRY')],
        loadComponent: () => import('./Inventory_Transactions/uin-registration/uin-registration')
          .then(m => m.InventoryUinRegistrationComponent)
      },
      {
        path: 'production-return',
        canActivate: [screenPermissionGuard('INV_T_PROD_RETURN')],
        loadComponent: () => import('./Inventory_Transactions/production-return/production-return')
          .then(m => m.InventoryProductionReturnComponent)
      },
      // Consumption
      {
        path: 'material-consumption',
        canActivate: [screenPermissionGuard('INV_T_MAT_CONSUMPTION')],
        loadComponent: () => import('./Inventory_Transactions/material-consumption/material-consumption')
          .then(m => m.InventoryMaterialConsumptionComponent)
      },
      {
        path: 'internal-issue-slip',
        canActivate: [screenPermissionGuard('INV_T_ISSUE_SLIP')],
        loadComponent: () => import('./Inventory_Transactions/internal-issue-slip/internal-issue-slip')
          .then(m => m.InventoryInternalIssueSlipComponent)
      },
      // Logistics
      {
        path: 'shipment-entry',
        canActivate: [screenPermissionGuard('INV_T_SHIPMENT')],
        loadComponent: () => import('./Inventory_Transactions/shipment-entry/shipment-entry')
          .then(m => m.InventoryShipmentEntryComponent)
      },
      {
        path: 'gate-pass',
        canActivate: [screenPermissionGuard('INV_T_GATEPASS')],
        loadComponent: () => import('./Inventory_Transactions/gate-pass/gate-pass')
          .then(m => m.InventoryGatePassComponent)
      },
      // Financial
      {
        path: 'debit-note',
        canActivate: [screenPermissionGuard('INV_T_DEBIT_NOTE')],
        loadComponent: () => import('./Inventory_Transactions/debit-note/debit-note')
          .then(m => m.InventoryDebitNoteComponent)
      },
      {
        path: 'credit-note',
        canActivate: [screenPermissionGuard('INV_T_CREDIT_NOTE')],
        loadComponent: () => import('./Inventory_Transactions/credit-note/credit-note')
          .then(m => m.InventoryCreditNoteComponent)
      },
      { path: '', redirectTo: 'purchase-requisition', pathMatch: 'full' }
    ]
  },
  {
    path: 'reports',
    children: [
      {
        path: 'inventory-summary',
        redirectTo: '/dashboard/inventory/inventory-dashboard/dashboard',
        pathMatch: 'full'
      },
      {
        // Bespoke comparison view (product + hypothetical qty picker, three
        // app-stat-card panels, a bar chart, a cost-layer table) -- doesn't
        // fit the generic flat-table report-page shell every other report
        // below uses, so it gets its own static route. Must stay ABOVE the
        // ':reportKey' catch-all so it matches before falling through to it.
        path: 'stock-valuation-comparison',
        canActivate: [screenPermissionGuard('INV_R_STOCK_VALUATION_COMPARISON')],
        loadComponent: () => import('./Inventory_Reports/stock-valuation-comparison/stock-valuation-comparison')
          .then(m => m.StockValuationComparisonComponent)
      },
      {
        // Admin-only (screen code INV_R_MIS, 154_mis_report_screen.sql, granted
        // only to COMPANY_ADMIN). Same bespoke-static-route precedent as
        // stock-valuation-comparison above -- must also stay ABOVE the
        // ':reportKey' catch-all. screenPermissionGuard itself is non-blocking
        // (warns, still loads), so the real gate is this component's own
        // explicit authService.can('INV_R_MIS','view') check.
        path: 'mis-report',
        canActivate: [screenPermissionGuard('INV_R_MIS')],
        loadComponent: () => import('./Inventory_Reports/mis-report/mis-report')
          .then(m => m.MisReportComponent)
      },
      {
        path: ':reportKey',
        canActivate: [reportPermissionGuard],
        loadComponent: () => import('./Inventory_Reports/report-page/inventory-report-page')
          .then(m => m.InventoryReportPageComponent)
      },
      { path: '', redirectTo: 'inventory-summary', pathMatch: 'full' }
    ]
  },
  {
    path: '',
    redirectTo: 'inventory-dashboard/dashboard',
    pathMatch: 'full'
  }
];
