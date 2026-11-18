const { withNativeFederation, shareAll } = require('@angular-architects/native-federation/config');

module.exports = withNativeFederation({
  name: 'inventory',

  exposes: {
    './InventoryRoutes': './src/app/inventory/inventory_routs.ts',
    './InventoryDashboard': './src/app/inventory/inventory-dashboard/inventory-dashboard.ts',
    // Accounts > Re-Print of a Sales / Purchase Invoice (top-level route invoice-reprint/:id).
    './InvoiceReprint': './src/app/inventory/Inventory_Transactions/invoice-reprint/invoice-reprint.ts',
  },

  shared: {
    ...shareAll({ singleton: true, strictVersion: false, requiredVersion: 'auto' }),
  },

  skip: [
    'rxjs/ajax',
    'rxjs/fetch',
    'rxjs/testing',
    'rxjs/webSocket',
    'file-saver',
    // exceljs's Node.js entry pulls in @fast-csv / stream / fs which don't exist in
    // the browser. Skip sharing so esbuild uses the browser bundle (dist/exceljs.min.js).
    'exceljs',
    // xlsx isn't used by any other remote, so there's nothing to share it with.
    'xlsx',
    // jspdf/jspdf-autotable versions diverge across remotes (Accounts is on jspdf 4.x /
    // autotable 5.x, this app and hrms-suite are on 2.x/3.x) so singleton sharing can never
    // actually dedupe them anyway. hrms-suite already skips these for the same reason.
    'jspdf',
    'jspdf-autotable',
  ],

  features: {
    ignoreUnusedDeps: true,
  },
});
