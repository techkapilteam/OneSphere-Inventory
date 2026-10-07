export type InventoryScreenKind = 'dashboard' | 'master' | 'transaction' | 'report';

export interface InventoryField {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'tags' | 'textarea' | 'file';
  options?: string[];
  addMaster?: string;
  allowCustomValue?: boolean;
  hidden?: boolean;
}

export interface InventoryDependency {
  name: string;
  status: 'Ready' | 'Required' | 'Pending Setup';
}

export interface InventoryScreenConfig {
  key: string;
  title: string;
  subtitle: string;
  kind: InventoryScreenKind;
  icon: string;
  dependsOn?: InventoryDependency[];
  outputImpact?: string;
  screenMode?: string;
  guideVideoUrl?: string;
  guideVideoTitle?: string;
  posMode?: 'none' | 'switch' | 'pos';
  recordTitle?: string;
  recordSubtitle?: string;
  fields?: InventoryField[];
  posFields?: InventoryField[];
  lineTitle?: string;
  lineColumns?: string[];
  lineRows?: string[][];
  columns?: string[];
  rows?: string[][];
}

export interface InventorySegment {
  name: string;
  behavior: string;
  stock: string;
  availability: string;
}

export interface InventoryKpi {
  label: string;
  value: string;
  icon: string;
  hint: string;
}

export interface InventorySegmentDashboard {
  title: string;
  summary: string;
  kpis: InventoryKpi[];
  workflow: string[];
  uomRows: typeof INVENTORY_UOM_CONVERSIONS;
  columns: string[];
  rows: string[][];
}

export const INVENTORY_SEGMENTS: InventorySegment[] = [
  { name: 'Electronics', behavior: 'Physical stock + warranty serial tracking', stock: '12,480', availability: '92%' },
  { name: 'Agro Product', behavior: 'Batch, grade, bag/ton conversion', stock: '4,820 Bags', availability: '76%' },
  { name: 'Co-working Space', behavior: 'Seat, cabin, meeting room availability', stock: '186 Seats', availability: '81%' },
  { name: 'IT Services', behavior: 'Service billing with SAC mapping', stock: '64 Active Contracts', availability: '94%' },
  { name: 'Drone Manufacturing', behavior: 'BOM components, assembly, QC stock', stock: '1,240 Components', availability: '68%' },
  { name: 'Precast Panels', behavior: 'Project material and panel yard tracking', stock: '340 Panels', availability: '73%' },
  { name: 'Real Estate Inventory', behavior: 'Unit, plot, block, floor availability', stock: '218 Units', availability: '59%' },
  { name: 'Hotel / Restaurant', behavior: 'Food stock, rooms, recipes, banquet and POS billing', stock: '1,860 Menu Units', availability: '84%' }
];

export const INVENTORY_KPIS = [
  { label: 'Physical Stock Value', value: 'Rs. 4.82 Cr', icon: 'pi pi-box', hint: 'Across warehouses and projects' },
  { label: 'Service Billing Queue', value: '86', icon: 'pi pi-receipt', hint: 'IT, co-working and AMC items' },
  { label: 'Available Space / Units', value: '404', icon: 'pi pi-building', hint: 'Seats, cabins, plots and flats' },
  { label: 'Pending Inward', value: '28', icon: 'pi pi-truck', hint: 'PO and GRN follow-up' }
];

export const INVENTORY_UOM_CONVERSIONS = [
  { product: 'Agro Seed', base: 'KG', alternate: 'Bag', factor: '1 Bag = 50 KG', behavior: 'Purchase in Bags, stock in KG' },
  { product: 'Cement Panel', base: 'Nos', alternate: 'Sq Ft', factor: '1 Panel = 48 Sq Ft', behavior: 'Project issue in Sq Ft' },
  { product: 'Co-working Seat', base: 'Seat-Day', alternate: 'Seat-Month', factor: '1 Seat-Month = 30 Seat-Days', behavior: 'Availability + billing' },
  { product: 'Drone Motor', base: 'Nos', alternate: 'Set', factor: '1 Set = 4 Nos', behavior: 'BOM consumption' },
  { product: 'Basmati Rice', base: 'KG', alternate: 'Bag', factor: '1 Bag = 25 KG', behavior: 'Kitchen issue and restaurant consumption' }
];

export const INVENTORY_SEGMENT_DASHBOARDS: Record<string, InventorySegmentDashboard> = {
  Electronics: {
    title: 'Electronics Inventory',
    summary: 'Serial stock, warranty tracking, warehouse stock movement and counter sales.',
    kpis: [
      { label: 'Stock Value', value: 'Rs. 1.42 Cr', icon: 'pi pi-box', hint: 'Serialized goods in warehouses' },
      { label: 'Warranty Stock', value: '318', icon: 'pi pi-shield', hint: 'Items under warranty tracking' },
      { label: 'Low Stock SKUs', value: '24', icon: 'pi pi-exclamation-triangle', hint: 'Need reorder planning' },
      { label: 'Today POS Bills', value: '62', icon: 'pi pi-desktop', hint: 'Counter billing transactions' }
    ],
    workflow: ['Purchase Order', 'Goods Receipt', 'Serial / IMEI Mapping', 'Sales Invoice / POS', 'Warranty Return'],
    uomRows: [
      { product: 'LED Display', base: 'Nos', alternate: 'Box', factor: '1 Box = 4 Nos', behavior: 'Purchase in Box, stock in Nos' },
      { product: 'Cable Roll', base: 'Meter', alternate: 'Roll', factor: '1 Roll = 90 Meter', behavior: 'Issue by Meter' }
    ],
    columns: ['SKU', 'Item', 'Warehouse', 'Serial Mode', 'Available', 'Reorder', 'Value'],
    rows: [
      ['ELE-1001', 'LED Display', 'HYD Main WH', 'Required', '146 Nos', '40 Nos', 'Rs. 24,82,000'],
      ['ELE-1140', 'Smart Sensor', 'BLR Store', 'Required', '820 Nos', '150 Nos', 'Rs. 18,40,000'],
      ['ELE-1205', 'Cable Roll', 'HYD Main WH', 'Optional', '42 Roll', '12 Roll', 'Rs. 3,78,000']
    ]
  },
  'Agro Product': {
    title: 'Agro Product Inventory',
    summary: 'Batch, grade, moisture, bag-to-kg conversion and expiry-aware stock movement.',
    kpis: [
      { label: 'Stock in Bags', value: '4,820', icon: 'pi pi-briefcase', hint: 'Across grades and lots' },
      { label: 'Stock in KG', value: '2,41,000', icon: 'pi pi-sort-alt', hint: 'Base UOM ledger balance' },
      { label: 'Expiring Lots', value: '11', icon: 'pi pi-calendar-times', hint: 'Within next 30 days' },
      { label: 'Quality Hold', value: '280 Bags', icon: 'pi pi-stop-circle', hint: 'Moisture or grade mismatch' }
    ],
    workflow: ['Purchase by Bag', 'Quality Check', 'Batch / Lot Entry', 'Grade-wise Storage', 'Sale by KG / Ton'],
    uomRows: [
      { product: 'Agro Seed', base: 'KG', alternate: 'Bag', factor: '1 Bag = 50 KG', behavior: 'Purchase in Bags, stock in KG' },
      { product: 'Fertilizer', base: 'KG', alternate: 'Ton', factor: '1 Ton = 1000 KG', behavior: 'Bulk sale in Ton' }
    ],
    columns: ['Lot No', 'Product', 'Grade', 'Warehouse', 'Available', 'Moisture', 'Expiry'],
    rows: [
      ['LOT-7781', 'Agro Seed', 'A', 'BLR Store', '93 Bags', '8.5%', '18-Jun-2026'],
      ['LOT-7834', 'Fertilizer', 'Standard', 'HYD Main WH', '42 Ton', 'NA', '30-Sep-2026'],
      ['LOT-8012', 'Organic Mix', 'Premium', 'Project Yard A', '610 Bags', '7.9%', '12-Aug-2026']
    ]
  },
  'Co-working Space': {
    title: 'Co-working Space Availability',
    summary: 'Seat, cabin, meeting room and occupancy based billing availability.',
    kpis: [
      { label: 'Available Seats', value: '186', icon: 'pi pi-building', hint: 'Open seats across floors' },
      { label: 'Booked Today', value: '42', icon: 'pi pi-calendar-plus', hint: 'Seat-day reservations' },
      { label: 'Meeting Rooms', value: '8 / 12', icon: 'pi pi-users', hint: 'Available rooms now' },
      { label: 'Monthly Occupancy', value: '81%', icon: 'pi pi-chart-line', hint: 'Current month usage' }
    ],
    workflow: ['Space Master', 'Seat Availability', 'Booking', 'Proforma / Invoice', 'Occupancy Report'],
    uomRows: [
      { product: 'Dedicated Seat', base: 'Seat-Day', alternate: 'Seat-Month', factor: '1 Seat-Month = 30 Seat-Days', behavior: 'Availability + billing' },
      { product: 'Meeting Room', base: 'Hour', alternate: 'Day', factor: '1 Day = 8 Hours', behavior: 'Hourly booking' }
    ],
    columns: ['Floor', 'Resource', 'Capacity', 'Booked', 'Available', 'Billing UOM', 'Status'],
    rows: [
      ['Floor 2', 'Dedicated Seat', '220', '174', '46', 'Seat-Day', 'Open'],
      ['Floor 3', 'Private Cabin', '38', '31', '7', 'Cabin-Month', 'Open'],
      ['Floor 1', 'Meeting Room', '12', '4', '8', 'Hour', 'Open']
    ]
  },
  'IT Services': {
    title: 'IT Services Billing',
    summary: 'Service catalog, SAC mapping, AMC contracts, milestones and billing queue.',
    kpis: [
      { label: 'Active Contracts', value: '64', icon: 'pi pi-file', hint: 'AMC and project contracts' },
      { label: 'Billing Queue', value: '86', icon: 'pi pi-receipt', hint: 'Ready for invoice' },
      { label: 'Pending Milestones', value: '19', icon: 'pi pi-clock', hint: 'Awaiting confirmation' },
      { label: 'Unbilled Value', value: 'Rs. 18.6 L', icon: 'pi pi-wallet', hint: 'Current service WIP' }
    ],
    workflow: ['Service Master', 'SAC Mapping', 'Estimation', 'Milestone Billing', 'Service Invoice'],
    uomRows: [
      { product: 'Developer Support', base: 'Hour', alternate: 'Day', factor: '1 Day = 8 Hours', behavior: 'Timesheet billing' },
      { product: 'AMC Support', base: 'Month', alternate: 'Year', factor: '1 Year = 12 Months', behavior: 'Contract billing' }
    ],
    columns: ['Service Code', 'Service', 'Client', 'SAC', 'Billing UOM', 'Pending Qty', 'Value'],
    rows: [
      ['SRV-2090', 'AMC Support', 'Tenant Works', '9983', 'Month', '3', 'Rs. 4,80,000'],
      ['SRV-3320', 'Implementation', 'Aero Labs', '9983', 'Milestone', '2', 'Rs. 9,60,000'],
      ['SRV-4102', 'Developer Support', 'ElectroMart', '9983', 'Hour', '128', 'Rs. 4,22,000']
    ]
  },
  'Drone Manufacturing': {
    title: 'Drone Manufacturing Inventory',
    summary: 'BOM components, assembly stock, QC hold, production issue and finished goods.',
    kpis: [
      { label: 'Component Stock', value: '1,240', icon: 'pi pi-cog', hint: 'BOM linked components' },
      { label: 'Assembly WIP', value: '38', icon: 'pi pi-sync', hint: 'Drones under assembly' },
      { label: 'QC Hold', value: '17', icon: 'pi pi-stop-circle', hint: 'Pending inspection' },
      { label: 'Ready FG', value: '52', icon: 'pi pi-send', hint: 'Finished drones ready' }
    ],
    workflow: ['Component Inward', 'BOM Setup', 'Production Issue', 'Assembly', 'QC / Finished Goods'],
    uomRows: [
      { product: 'Drone Motor', base: 'Nos', alternate: 'Set', factor: '1 Set = 4 Nos', behavior: 'BOM consumption' },
      { product: 'Propeller', base: 'Nos', alternate: 'Kit', factor: '1 Kit = 8 Nos', behavior: 'Assembly issue' }
    ],
    columns: ['Component', 'Store', 'Required / Unit', 'Available', 'Reserved', 'QC Hold', 'Shortage'],
    rows: [
      ['Drone Motor', 'Manufacturing Store', '4 Nos', '620 Nos', '180 Nos', '12 Nos', 'No'],
      ['Flight Controller', 'Manufacturing Store', '1 Nos', '86 Nos', '38 Nos', '5 Nos', 'No'],
      ['Battery Pack', 'QC Store', '1 Nos', '72 Nos', '24 Nos', '17 Nos', 'Watch']
    ]
  },
  'Precast Panels': {
    title: 'Precast Panel Project Inventory',
    summary: 'Panel yard stock, project issue, square-foot conversion and site-wise material control.',
    kpis: [
      { label: 'Panels in Yard', value: '340', icon: 'pi pi-th-large', hint: 'Ready and curing stock' },
      { label: 'Project Reserved', value: '118', icon: 'pi pi-lock', hint: 'Allocated to project sites' },
      { label: 'Sq Ft Available', value: '16,320', icon: 'pi pi-chart-bar', hint: 'Converted availability' },
      { label: 'Dispatch Pending', value: '26', icon: 'pi pi-truck', hint: 'Site issue pending' }
    ],
    workflow: ['Panel Production', 'Curing Yard', 'Project Reservation', 'Dispatch', 'Site Consumption'],
    uomRows: [
      { product: 'Cement Panel', base: 'Nos', alternate: 'Sq Ft', factor: '1 Panel = 48 Sq Ft', behavior: 'Project issue in Sq Ft' },
      { product: 'Beam Panel', base: 'Nos', alternate: 'Meter', factor: '1 Panel = 6 Meter', behavior: 'Site measurement issue' }
    ],
    columns: ['Panel Type', 'Yard', 'Available', 'Reserved', 'Sq Ft', 'Project', 'Status'],
    rows: [
      ['Wall Panel', 'Project Yard A', '140 Nos', '48 Nos', '6,720', 'Metro Site', 'Ready'],
      ['Slab Panel', 'Project Yard A', '92 Nos', '36 Nos', '4,416', 'Villa Site', 'Curing'],
      ['Beam Panel', 'HYD Main WH', '108 Nos', '34 Nos', '648 Meter', 'Tower Site', 'Ready']
    ]
  },
  'Real Estate Inventory': {
    title: 'Real Estate Unit Inventory',
    summary: 'Block, floor, flat, plot and unit availability with booking and sale status.',
    kpis: [
      { label: 'Total Units', value: '218', icon: 'pi pi-home', hint: 'Across projects and blocks' },
      { label: 'Available Units', value: '129', icon: 'pi pi-check-circle', hint: 'Ready for booking' },
      { label: 'Booked Units', value: '74', icon: 'pi pi-bookmark', hint: 'Advance received' },
      { label: 'Blocked Units', value: '15', icon: 'pi pi-ban', hint: 'Management hold' }
    ],
    workflow: ['Project / Block Setup', 'Unit Master', 'Availability Status', 'Booking', 'Sale Invoice'],
    uomRows: [
      { product: 'Flat', base: 'Unit', alternate: 'Sq Ft', factor: '1 Unit = saleable area', behavior: 'Unit sale + area tracking' },
      { product: 'Plot', base: 'Unit', alternate: 'Sq Yd', factor: '1 Unit = plot area', behavior: 'Plot booking' }
    ],
    columns: ['Project', 'Block', 'Unit', 'Area', 'Facing', 'Status', 'Value'],
    rows: [
      ['Skyline', 'A', 'Flat A-1204', '1,420 Sq Ft', 'East', 'Available', 'Rs. 72,00,000'],
      ['Skyline', 'B', 'Flat B-0902', '1,180 Sq Ft', 'West', 'Booked', 'Rs. 61,50,000'],
      ['Green County', 'P1', 'Plot P1-044', '220 Sq Yd', 'North', 'Available', 'Rs. 38,40,000']
    ]
  },
  'Hotel / Restaurant': {
    title: 'Hotel / Restaurant Inventory',
    summary: 'Kitchen stock, recipe ingredients, menu items, room minibar stock, banquet items and POS counter billing.',
    kpis: [
      { label: 'Kitchen Stock Value', value: 'Rs. 12.8 L', icon: 'pi pi-shopping-bag', hint: 'Food, beverages and consumables' },
      { label: 'Low Stock Ingredients', value: '18', icon: 'pi pi-exclamation-triangle', hint: 'Need purchase planning' },
      { label: 'Today POS Orders', value: '146', icon: 'pi pi-receipt', hint: 'Restaurant and counter bills' },
      { label: 'Expiring Items', value: '9', icon: 'pi pi-calendar-times', hint: 'Within next 7 days' }
    ],
    workflow: ['Ingredient Purchase', 'Goods Receipt', 'Recipe / BOM Consumption', 'Restaurant POS', 'Kitchen Stock Report'],
    uomRows: [
      { product: 'Basmati Rice', base: 'KG', alternate: 'Bag', factor: '1 Bag = 25 KG', behavior: 'Purchase in Bag, issue to kitchen in KG' },
      { product: 'Soft Drink', base: 'Bottle', alternate: 'Crate', factor: '1 Crate = 24 Bottles', behavior: 'Restaurant sale and minibar issue' }
    ],
    columns: ['Item Code', 'Item', 'Location', 'Category', 'Available', 'Reorder', 'Expiry'],
    rows: [
      ['FOD-1001', 'Basmati Rice', 'Main Kitchen Store', 'Raw Ingredients', '340 KG', '80 KG', '18-Aug-2026'],
      ['BEV-2010', 'Soft Drink 300ml', 'Restaurant Counter', 'Beverages', '28 Crate', '8 Crate', '12-Sep-2026'],
      ['RM-0304', 'Deluxe Room 304', 'Hotel Floor 3', 'Rooms', 'Available', 'NA', 'NA']
    ]
  }
};

export const INVENTORY_OPTIONS = {
  segments: INVENTORY_SEGMENTS.map(item => item.name),
  branches: ['Head Office', 'Hyderabad', 'Bengaluru', 'Hotel Main Branch', 'Restaurant Outlet'],
  locations: ['HYD Main WH', 'BLR Store', 'Project Yard A', 'Co-work Floor 2', 'Manufacturing Store', 'Main Kitchen Store', 'Restaurant Counter', 'Room Minibar Store'],
  branchActivityTypes: ['Sales Unit', 'Procurement & Sales Unit', 'Consumption Unit', 'Operations Unit', 'Production Unit', 'Service Unit', 'Project Unit'],
  contactPersons: ['Rajesh Kumar', 'Priya Sharma', 'Anil Reddy', 'Meera Nair'],
  parties: ['V-1001 ElectroMart', 'C-204 Tenant Works', 'P-330 Aero Labs', 'V-440 Fresh Foods', 'C-501 Walk-in Diner'],
  suppliers: ['ElectroMart Supplies', 'Aero Labs', 'BuildWell Contractors', 'Agro Fresh Traders', 'Fresh Foods Distributor', 'Beverage World'],
  customers: ['Walk-in Customer', 'Tenant Works Pvt Ltd', 'Metro Projects', 'Green County Buyer', 'Restaurant Walk-in Guest', 'Banquet Customer'],
  products: ['LED Display', 'Agro Seed', 'Dedicated Seat', 'Drone Motor', 'Precast Panel', 'Flat A-1204', 'Basmati Rice', 'Paneer Tikka', 'Deluxe Room 304'],
  rawMaterialProducts: ['Agro Seed', 'Precast Panel', 'Basmati Rice'],
  finishedGoodsProducts: ['LED Display', 'Dedicated Seat', 'Drone Motor', 'Flat A-1204', 'Paneer Tikka', 'Deluxe Room 304'],
  brands: ['Dell', 'Samsung', 'AgroFresh', 'AeroTech', 'BuildCast', 'Own Brand', 'Kitchen Fresh', 'House Brand'],
  uoms: ['Nos', 'Box', 'Set', 'KG', 'Bag', 'Quintal', 'Ton', 'Litre', 'Bottle', 'Crate', 'Plate', 'Portion', 'Room-Night', 'Sq Ft', 'Seat-Day', 'Seat-Month', 'Hour', 'Day', 'Month', 'Unit', 'Set'],
  hsnSac: ['8471', '8517', '8504', '1006', '1209', '1508', '2106', '2202', '996331', '996332', '997212', '998599', '998313', '998314', '997331', '8806', '8507', '8537', '6810', '2523', '7214', '9954'],
  categories: ['Computers & Devices', 'Mobile & Accessories', 'Agro Commodities', 'Fertilizers & Chemicals', 'Workspace Resources', 'IT Services', 'Drone Components', 'Precast Materials', 'Real Estate Units', 'Raw Ingredients', 'Beverages', 'Menu Items', 'Rooms'],
  currencies: ['INR', 'USD', 'EUR'],
  paymentTerms: ['Immediate', '7 Days', '15 Days', '30 Days', '45 Days', 'Advance'],
  customerTypes: ['Dealer', 'Corporate Client', 'Tenant', 'Property Buyer', 'Project Client', 'Restaurant Guest', 'Banquet Client', 'Hotel Guest'],
  vendorTypes: ['Supplier', 'Service Provider', 'Contractor', 'Manufacturer', 'Broker', 'Channel Partner', 'Food Supplier', 'Beverage Supplier'],
  trackingMethods: ['None', 'Batch', 'Serial / IMEI', 'Unit / Plot', 'Seat / Space', 'Room / Table', 'Recipe / BOM Component', 'BOM Component'],
  valuationMethods: ['None', 'FIFO', 'FEFO', 'LIFO', 'Weighted Average', 'Specific Identification', 'Batch Cost'],
  hsnTypes: ['HSN', 'SAC'],
  gstRates: ['0', '5', '12', '18', '28'],
  uomTypes: ['Base', 'Purchase', 'Sale', 'Billing', 'Capacity'],
  applicableFor: ['Goods', 'Services', 'Space Billing', 'Manufacturing', 'Project Material', 'Real Estate Unit', 'Restaurant Service', 'Hotel Room Service'],
  paymentModes: ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Credit'],
  referenceTypes: ['Direct', 'Estimate', 'Proforma Invoice', 'POS Reference'],
  adjustmentTypes: ['Opening Correction', 'Physical Difference', 'Damage', 'Booking Hold', 'Release Hold'],
  status: ['Active', 'Inactive'],
  behavior: ['Stock In/Out', 'Service Billing Only', 'Availability Booking', 'BOM Consumption', 'Recipe Consumption', 'Project Issue', 'Unit Sale', 'Room Booking'],
  inventoryBehavior: ['Physical Stock', 'Service Billing', 'Space Availability', 'Manufacturing Components', 'Project Materials', 'Real Estate Units', 'Restaurant Recipe Stock', 'Hotel Room Inventory'],
  productTypes: ['Physical Stock', 'Raw Material', 'Consumable', 'Fixed Asset', 'Service', 'Service Bundle', 'Digital / Subscription'],
  productNatures: ['Physical Stock', 'Raw Material', 'Consumable', 'Fixed Asset', 'Service', 'Service Bundle', 'Digital / Subscription'],
  pricingTypes: ['One-time', 'Rental', 'Subscription', 'Per Use'],
  rentalUnits: ['Per Hour', 'Per Day', 'Per Week', 'Per Month', 'Per Year']
};

const transactionFields: InventoryField[] = [
  { key: 'segment', label: 'Business Segment', type: 'select', options: INVENTORY_OPTIONS.segments, addMaster: 'Business Segment' },
  { key: 'transactionDate', label: 'Transaction Date', type: 'date' },
  { key: 'referenceNo', label: 'Reference No' },
  { key: 'party', label: 'Vendor / Customer', type: 'select', options: INVENTORY_OPTIONS.parties, addMaster: 'Party' },
  { key: 'location', label: 'Warehouse / Location', type: 'select', options: INVENTORY_OPTIONS.locations, addMaster: 'Location' },
  { key: 'product', label: 'Item / Service / Unit', type: 'select', options: INVENTORY_OPTIONS.products, addMaster: 'Product / Service' },
  { key: 'hsnSac', label: 'HSN / SAC', type: 'select', options: INVENTORY_OPTIONS.hsnSac, addMaster: 'HSN / SAC' },
  { key: 'uom', label: 'Transaction UOM', type: 'select', options: INVENTORY_OPTIONS.uoms, addMaster: 'UOM' },
  { key: 'quantity', label: 'Quantity / Capacity', type: 'number' },
  { key: 'rate', label: 'Rate', type: 'number' },
  { key: 'gst', label: 'GST %', type: 'number' },
  { key: 'total', label: 'Total Amount', type: 'number' },
  { key: 'status', label: 'Status', type: 'select', options: ['Draft', 'Ready', 'Posted', 'Pending Approval'] },
  { key: 'remarks', label: 'Remarks', type: 'textarea' }
];

const posFields: InventoryField[] = [
  { key: 'segment', label: 'Business Segment', type: 'select', options: INVENTORY_OPTIONS.segments, addMaster: 'Business Segment' },
  { key: 'counter', label: 'Counter / Location', type: 'select', options: INVENTORY_OPTIONS.locations, addMaster: 'Location' },
  { key: 'billDate', label: 'Bill Date', type: 'date' },
  { key: 'customer', label: 'Customer / Walk-in', type: 'select', options: ['Walk-in Customer', ...INVENTORY_OPTIONS.parties], addMaster: 'Customer' },
  { key: 'productSearch', label: 'Product Search', type: 'select', options: INVENTORY_OPTIONS.products, addMaster: 'Product / Service' },
  { key: 'paymentMode', label: 'Payment Mode', type: 'select', options: INVENTORY_OPTIONS.paymentModes },
  { key: 'quantity', label: 'Quantity', type: 'number' },
  { key: 'rate', label: 'Rate', type: 'number' },
  { key: 'gst', label: 'GST %', type: 'number' },
  { key: 'netAmount', label: 'Net Amount', type: 'number' }
];

const reportFields: InventoryField[] = [
  { key: 'segment', label: 'Segment', type: 'select', options: ['All', ...INVENTORY_OPTIONS.segments] },
  { key: 'location', label: 'Location', type: 'select', options: ['All', ...INVENTORY_OPTIONS.locations] },
  { key: 'category', label: 'Product Category', type: 'select', options: ['All', ...INVENTORY_OPTIONS.categories] },
  { key: 'productNature', label: 'Product Nature', type: 'select', options: ['All', ...INVENTORY_OPTIONS.productNatures] },
  { key: 'item', label: 'Item / Service', type: 'select', options: ['All', ...INVENTORY_OPTIONS.products] },
  { key: 'fromDate', label: 'From Date', type: 'date' },
  { key: 'toDate', label: 'To Date', type: 'date' },
  { key: 'asOnDate', label: 'As-on Date', type: 'date' }
];

const reportRows = [
  ['Electronics', 'HYD Main WH', 'LED Display', '140', '24', '18', '146', 'Rs. 24,82,000'],
  ['Agro Product', 'BLR Store', 'Agro Seed', '80 Bags', '25 Bags', '12 Bags', '93 Bags', 'Rs. 8,36,000'],
  ['Co-working Space', 'Floor 2', 'Dedicated Seat', '190', '16', '20', '186', 'Rs. 4,65,000'],
  ['Real Estate Inventory', 'Block A', 'Flat A-1204', '1', '0', '0', 'Available', 'Rs. 72,00,000']
];

const reportColumns = ['Segment', 'Location', 'Item', 'Opening', 'Inward', 'Outward', 'Available', 'Value'];
const transactionColumns = ['Date', 'Segment', 'Party', 'Location', 'Item', 'Qty', 'UOM', 'Status'];
const lineColumns = ['Item / SKU', 'UOM', 'Qty', 'Rate', 'Disc %', 'GST', 'Amount'];

function partyMaster(key: string, title: string, subtitle: string, icon: string): InventoryScreenConfig {
  const isVendor = key === 'vendorMaster';
  const isChannelPartner = key === 'channelPartnerMaster';
  const partyLabel = isVendor ? 'Vendor' : isChannelPartner ? 'Channel Partner' : 'Customer';
  return {
    key,
    title,
    subtitle,
    kind: 'master',
    icon,
    dependsOn: [{ name: 'Business Segment', status: 'Ready' }, { name: isVendor ? 'GSTIN validation rules' : 'GSTIN / mobile validation', status: 'Required' }, { name: `${partyLabel} code uniqueness`, status: 'Ready' }],
    outputImpact: isVendor
      ? 'Vendor master used in Purchase Order, GRN reference, procurement reports and payables integration.'
      : isChannelPartner
        ? 'Channel Partner master used in Sales Order, Sales Invoice, Delivery Challan and partner-wise sales reports.'
        : 'Customer master used in Estimation, Proforma Invoice, Sales Invoice, POS billing, receivables and customer reports.',
    screenMode: 'Master setup',
    fields: [
      { key: 'name', label: `${partyLabel} Name / Company Name`, type: 'select', options: ['ElectroMart Supplies Pvt Ltd', 'Tenant Works Pvt Ltd', 'Rajesh Kumar', 'Priya Sharma', 'Fresh Foods Distributor'], addMaster: 'Contact Person' },
      { key: 'code', label: `${partyLabel} Code` },
      { key: 'segment', label: 'Business Segment', type: 'select', options: INVENTORY_OPTIONS.segments, addMaster: 'Business Segment' },
      { key: 'gstin', label: 'GSTIN' },
      { key: 'pan', label: 'PAN' },
      { key: 'contactPerson', label: 'Contact Person Mapping', type: 'select', options: INVENTORY_OPTIONS.contactPersons, addMaster: 'Contact Person' },
      { key: 'mobile', label: 'Mobile No. From Global Contact' },
      { key: 'email', label: 'Mail ID From Global Contact' },
      { key: 'address', label: isVendor || isChannelPartner ? 'Address' : 'Billing Address', type: 'textarea', addMaster: 'Location Address' },
      ...(!isVendor && !isChannelPartner ? [{ key: 'shippingAddress', label: 'Shipping Address', type: 'textarea' as const, addMaster: 'Location Address' }] : []),
      { key: 'paymentTerms', label: 'Payment Terms', type: 'select', options: INVENTORY_OPTIONS.paymentTerms },
      { key: 'creditLimit', label: 'Credit Limit', type: 'number' },
      // Bank Details used to be a free-text field here (vendor only, and
      // never actually wired into the save payload) -- replaced by the
      // shared app-inventory-bank-details component (structured Payee
      // Name/Account No./IFSC/Bank/Branch, IFSC-driven auto-populate),
      // rendered separately in vendor-master.html/customer-master.html
      // rather than through this generic field list.
      ...(!isVendor && !isChannelPartner ? [{ key: 'priceList', label: 'Price List', type: 'select' as const, options: ['Retail Price List', 'Dealer Price List', 'Corporate Price List'] }] : []),
      { key: 'status', label: 'Status', type: 'select', options: INVENTORY_OPTIONS.status }
    ],
    columns: ['Code', 'Name', 'Type', 'Segment', 'GSTIN', 'Status'],
    rows: isChannelPartner
      ? [
          ['CP-001', 'City Sales Associates', 'Referral Partner', 'Electronics', '36CPAAA0001A1Z5', 'Active'],
          ['CP-002', 'Broker Network', 'Broker', 'Real Estate Inventory', '29CPBBB0002B1Z8', 'Active']
        ]
      : [
          ['V-1001', 'ElectroMart Supplies', 'Supplier', 'Electronics', '36ABCDE1234F1Z5', 'Active'],
          ['C-204', 'Tenant Works Pvt Ltd', 'Corporate Client', 'Co-working Space', '29PQRSX2211K1Z9', 'Active'],
          ['P-330', 'Aero Labs', 'Manufacturer', 'Drone Manufacturing', '36AEROL4421F1Z2', 'Active'],
          isVendor
            ? ['V-440', 'Fresh Foods Distributor', 'Food Supplier', 'Hotel / Restaurant', '36FOODX4400F1Z6', 'Active']
            : ['C-501', 'Restaurant Walk-in Guest', 'Restaurant Guest', 'Hotel / Restaurant', 'NA', 'Active']
        ]
  };
}

function transaction(
  key: string,
  title: string,
  subtitle: string,
  icon: string,
  dependsOn: InventoryDependency[],
  outputImpact: string,
  options: Partial<InventoryScreenConfig> = {}
): InventoryScreenConfig {
  return {
    key,
    title,
    subtitle,
    kind: 'transaction',
    icon,
    dependsOn,
    outputImpact,
    screenMode: options.screenMode || 'Transaction entry',
    fields: options.fields || transactionFields,
    posFields: options.posFields,
    posMode: options.posMode || 'none',
    lineTitle: options.lineTitle || 'Item Lines',
    lineColumns: options.lineColumns || lineColumns,
    lineRows: [],
    columns: options.columns || transactionColumns,
    rows: []
  };
}

function report(key: string, title: string, subtitle: string, dependsOn: InventoryDependency[], outputImpact: string): InventoryScreenConfig {
  return {
    key,
    title,
    subtitle,
    kind: 'report',
    icon: 'pi pi-chart-bar',
    dependsOn,
    outputImpact,
    screenMode: 'Report filters',
    fields: reportFields,
    columns: reportColumns,
    rows: reportRows
  };
}

export const inventoryDashboardConfig: InventoryScreenConfig = {
  key: 'dashboard',
  title: 'Inventory Dashboard',
  subtitle: 'Unified stock, services, space availability, manufacturing and real estate inventory view',
  kind: 'dashboard',
  icon: 'pi pi-box',
  dependsOn: [
    { name: 'Business Segment data', status: 'Ready' },
    { name: 'Sample item definitions', status: 'Ready' },
    { name: 'Item type, UOM and segment metadata', status: 'Ready' }
  ],
  outputImpact: 'Quick overview and entry point to Business Segments using View All.',
  screenMode: 'Landing dashboard'
};

export const businessSegmentsConfig: InventoryScreenConfig = {
  key: 'businessSegments',
  title: 'Segment-wise Configuration Examples',
  subtitle: 'Define segment-wise categories. HSN/SAC and UOM values load from system masters.',
  kind: 'master',
  icon: 'pi pi-sitemap',
  dependsOn: [
    { name: 'Segment master', status: 'Ready' },
    { name: 'Category list', status: 'Required' },
    { name: 'System HSN/SAC and UOM masters', status: 'Ready' }
  ],
  outputImpact: 'Selected segment drives all master, transaction and report screens.',
  screenMode: 'Configuration',
  recordTitle: 'Segment-wise Configuration Examples',
  recordSubtitle: 'Use this as the development reference for each supported business segment. HSN/SAC and UOM stay in their system masters.',
  fields: [
    { key: 'segmentName', label: 'Business Segment', type: 'select', options: INVENTORY_OPTIONS.segments, addMaster: 'New Segment' },
    { key: 'category', label: 'Categories', type: 'multiselect', options: INVENTORY_OPTIONS.categories, addMaster: 'Category' },
    { key: 'usageNote', label: 'Usage Note', type: 'textarea' }
  ],
  columns: ['Segment', 'Categories', 'Serial / Batch Policies', 'Usage Note', 'Status'],
  rows: [
    ['Electronics', 'Computers & Devices, Mobile & Accessories', 'Serial: Device Serial', 'Stock products, accessories, warranties, serial tracking.', 'Active'],
    ['Agro Product', 'Agro Commodities, Fertilizers & Chemicals', 'Batch: Lot Tracking', 'Flexible UOM, e.g., Rice can be purchased/sold in Kg or Bag = 26 Kg.', 'Active'],
    ['Co-working Space', 'Workspace Resources, IT Services', '', 'Space/seat availability, subscription and time-based billing.', 'Active'],
    ['IT Services', 'IT Services', '', 'Service billing, milestones, support contracts and license billing.', 'Active'],
    ['Drone Manufacturing', 'Drone Components, Computers & Devices', 'Serial: Component Serial / Batch: Production Lot', 'Components, finished goods, batch/serial tracking, manufacturing stock.', 'Active'],
    ['Precast Panels', 'Precast Materials', 'Batch: Casting Lot', 'Project material, raw material, panel dispatch, project/site location tracking.', 'Active'],
    ['Real Estate Inventory', 'Real Estate Units, Workspace Resources', '', 'Unit inventory, saleable/leasable area, booking hold and release.', 'Active'],
    ['Hotel / Restaurant', 'Raw Ingredients, Beverages, Menu Items, Rooms', 'Batch: Kitchen Lot', 'Kitchen stock, recipe consumption, restaurant POS, room minibar and room-night billing.', 'Active']
  ]
};

export const branchMasterConfig: InventoryScreenConfig = {
  key: 'branchMaster',
  title: 'Branch / Store Setup',
  subtitle: 'Use existing company branches/stores or create branch/store records with inventory access behavior',
  kind: 'master',
  icon: 'pi pi-map-marker',
  dependsOn: [
    { name: 'Business Segment', status: 'Ready' },
    { name: 'Branch code uniqueness', status: 'Required' }
  ],
  outputImpact: 'Branch/store record used by Warehouse Setup, transactions, access control and branch-wise reporting.',
  screenMode: 'Configuration',
  fields: [
    { key: 'segment', label: 'Business Segment', type: 'select', options: INVENTORY_OPTIONS.segments, addMaster: 'Business Segment' },
    { key: 'branchCode', label: 'Branch Code' },
    { key: 'branchName', label: 'Branch Name' },
    { key: 'gstin', label: 'GSTIN' },
    { key: 'pan', label: 'PAN' },
    { key: 'contactPerson', label: 'Contact Person', type: 'select', options: INVENTORY_OPTIONS.contactPersons, addMaster: 'Contact Person' },
    { key: 'mobile', label: 'Mobile' },
    { key: 'email', label: 'Email' },
    { key: 'defaultWarehouse', label: 'Default Warehouse (Optional)', type: 'select', options: INVENTORY_OPTIONS.locations, addMaster: 'Location' },
    { key: 'status', label: 'Status', type: 'select', options: INVENTORY_OPTIONS.status },
    { key: 'address', label: 'Address', type: 'textarea', addMaster: 'Location Address' },
    { key: 'moreInfo', label: 'More Information (Optional)', type: 'textarea' }
  ],
  columns: ['Branch Code', 'Branch / Store Name', 'Activity Types', 'Tax Details', 'Branch Contact', 'Default Warehouse', 'Status'],
  rows: [
    ['HO', 'Head Office', 'Procurement & Sales Unit, Operations Unit', 'GSTIN: 36ABCDE1234F1Z5 | PAN: ABCDE1234F', 'Rajesh Kumar | 9876543210 | rajesh@example.com', 'HYD Main WH', 'Active'],
    ['BLR', 'Bengaluru Store', 'Service Unit, Sales Unit', 'GSTIN: 29PQRSX2211K1Z9 | PAN: PQRSX2211K', 'Priya Sharma | 9848012345 | priya@example.com', 'BLR Store', 'Active'],
    ['YRD', 'Project Yard', 'Project Unit, Consumption Unit', 'GSTIN: 37YARDX4455P1Z2 | PAN: YARDX4455P', 'Anil Reddy | 9123456780 | anil@example.com', 'Project Yard A', 'Active'],
    ['RST', 'Restaurant Outlet', 'Sales Unit, Consumption Unit', 'GSTIN: 36RESTO1234F1Z8 | PAN: RESTO1234F', 'Meera Nair | 9000011122 | meera@example.com', 'Main Kitchen Store', 'Active']
  ]
};

export const warehouseLocationMasterConfig: InventoryScreenConfig = {
  key: 'warehouseMaster',
  title: 'Warehouse Setup',
  subtitle: 'Create warehouses, project yards, service locations and co-working floors',
  kind: 'master',
  icon: 'pi pi-home',
  dependsOn: [
    { name: 'Business Segment', status: 'Ready' },
    { name: 'Branch Master', status: 'Ready' },
    { name: 'UOM Master', status: 'Required' },
    { name: 'Location code uniqueness', status: 'Required' }
  ],
  outputImpact: 'Location record used in PO delivery, GRN receipt, POS counter, stock transfer, adjustment and stock reports.',
  screenMode: 'Configuration',
  fields: [
    { key: 'segment', label: 'Business Segment', type: 'select', options: INVENTORY_OPTIONS.segments, addMaster: 'Business Segment' },
    { key: 'locationName', label: 'Location Name' },
    { key: 'locationCode', label: 'Location Code' },
    { key: 'locationAddress', label: 'Location Address', type: 'textarea', addMaster: 'Location Address' },
    { key: 'capacity', label: 'Capacity of Warehouse (Optional)' },
    { key: 'status', label: 'Status', type: 'select', options: INVENTORY_OPTIONS.status }
  ],
  columns: ['Location Code', 'Location Name', 'Address', 'Capacity', 'Status'],
  rows: [
    ['HYD-WH', 'HYD Main Warehouse', 'Hyderabad Industrial Area', 'Approx. 12,000 sq.ft', 'Active'],
    ['CW-F2', 'Co-work Floor 2', 'Madhapur, Hyderabad', 'Seats and cabins capacity', 'Active'],
    ['MFG-01', 'Manufacturing Store', 'Hardware Park, Hyderabad', 'Component storage area', 'Active'],
    ['KIT-01', 'Main Kitchen Store', 'Hotel service block, Hyderabad', 'Cold, dry and daily kitchen stock', 'Active']
  ]
};

export const uomMasterConfig: InventoryScreenConfig = {
  key: 'uomMaster',
  title: 'UOM Master',
  subtitle: 'Define segment-wise units such as KG, Bag, Box, Litre and Nos. Product-wise purchase/sales conversion is configured in Product Master.',
  kind: 'master',
  icon: 'pi pi-sort-alt',
  dependsOn: [
    { name: 'Business-defined UOM categories', status: 'Required' },
    { name: 'Accounts team precision rules', status: 'Pending Setup' }
  ],
  outputImpact: 'UOM list used by Product Master, purchase UOM, sale/billing UOM, transactions and reports.',
  screenMode: 'Master setup',
  fields: [
    { key: 'uomName', label: 'UOM Name' },
    { key: 'uomCode', label: 'UOM Code' },
    { key: 'uomSymbol', label: 'UOM Symbol' },
    { key: 'decimalAllowed', label: 'Decimal Allowed', type: 'select', options: ['Yes', 'No'] },
    { key: 'status', label: 'Status', type: 'select', options: INVENTORY_OPTIONS.status }
  ],
  columns: ['UOM Code', 'UOM Name', 'UOM Symbol', 'Decimal Allowed', 'Status'],
  rows: [
    ['NOS', 'Numbers', 'Nos', 'No', 'Active'],
    ['BAG', 'Bag', 'Bag', 'Yes', 'Active'],
    ['KG', 'Kilogram', 'Kg', 'Yes', 'Active'],
    ['SFT', 'Square Feet', 'Sft', 'Yes', 'Active'],
    ['LTR', 'Litre', 'Ltr', 'Yes', 'Active']
  ]
};

export const hsnSacMappingConfig: InventoryScreenConfig = {
  key: 'hsnSacMapping',
  title: 'Tax Classification Master',
  subtitle: 'Define HSN/SAC codes with GST rates and map them to Product Categories. Product Master auto-binds HSN/SAC when a Category is selected.',
  kind: 'master',
  icon: 'pi pi-percentage',
  dependsOn: [
    { name: 'Business Segment', status: 'Ready' },
    { name: 'Category Master', status: 'Ready' }
  ],
  outputImpact: 'HSN/SAC code and GST rate auto-bind to Product Master on category selection. Used in invoices, POS billing and HSN/SAC compliance reports.',
  screenMode: 'Master setup',
  fields: [
    { key: 'code', label: 'HSN/SAC Code' },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'category', label: 'Product Category', type: 'select', options: INVENTORY_OPTIONS.categories, addMaster: 'Category' },
    { key: 'gstRate', label: 'GST %', type: 'select', options: INVENTORY_OPTIONS.gstRates },
    { key: 'cgstRate', label: 'CGST %', type: 'number' },
    { key: 'sgstRate', label: 'SGST %', type: 'number' },
    { key: 'igstRate', label: 'IGST %', type: 'number' },
    { key: 'cessRate', label: 'Cess %', type: 'number' },
    { key: 'effectiveDate', label: 'Effective Date', type: 'date' },
    { key: 'status', label: 'Status', type: 'select', options: INVENTORY_OPTIONS.status }
  ],
  columns: ['HSN/SAC Code', 'Description', 'Category', 'GST %', 'CGST %', 'SGST %', 'IGST %', 'Cess %', 'Effective Date', 'Status'],
  rows: [
    ['8471', 'Laptop and data processing machines', 'Computers & Devices', '18%', '9%', '9%', '18%', '0%', '01-Apr-2025', 'Active'],
    ['998313', 'Software implementation services', 'IT Services', '18%', '9%', '9%', '18%', '0%', '01-Apr-2025', 'Active'],
    ['9954', 'Construction and real estate services', 'Real Estate Units', '18%', '9%', '9%', '18%', '0%', '01-Apr-2025', 'Active'],
    ['996331', 'Restaurant and food serving services', 'Menu Items', '5%', '2.5%', '2.5%', '5%', '0%', '01-Apr-2025', 'Active'],
    ['996332', 'Hotel accommodation services', 'Rooms', '12%', '6%', '6%', '12%', '0%', '01-Apr-2025', 'Active']
  ]
};

export const taxCodeImportConfig: InventoryScreenConfig = {
  key: 'taxCodeImport',
  title: 'HSN/SAC Tax Code Import',
  subtitle: 'Import GST/CBIC HSN and SAC rate files for tax suggestions.',
  kind: 'master',
  icon: 'pi pi-upload',
  dependsOn: [
    { name: 'Official GST/CBIC file', status: 'Required' },
    { name: 'Tax Classification Master', status: 'Ready' }
  ],
  outputImpact: 'Imported tax guide data supports HSN/SAC search and product tax review. Users must still verify GST classification before filing.',
  screenMode: 'Configuration import',
  fields: [
    { key: 'sourceName', label: 'Source Name' },
    { key: 'sourceUpdatedAt', label: 'Source Updated Date', type: 'date' },
    { key: 'taxCodeFile', label: 'CSV / XLSX File', type: 'file' }
  ],
  columns: ['Source', 'Updated Date', 'Imported At', 'Rows Added', 'Rows Updated', 'Status'],
  rows: [
    ['GST/CBIC import', 'Latest source date', 'After import', 'HSN/SAC rows', 'Guide notes', 'Reviewed']
  ]
};

export const vendorMasterConfig = partyMaster('vendorMaster', 'Vendor Master', 'Supplier and service vendor setup', 'pi pi-truck');
export const customerMasterConfig = partyMaster('customerMaster', 'Customer Master', 'Customer, tenant, buyer and client setup', 'pi pi-users');
export const channelPartnerMasterConfig = partyMaster('channelPartnerMaster', 'Channel Partner Master', 'Referral, broker and channel partner setup', 'pi pi-share-alt');

export const productGroupMasterConfig: InventoryScreenConfig = {
  key: 'productGroupMaster',
  title: 'Product Group Master',
  subtitle: 'Group products below category for browsing, reporting and rule mapping.',
  kind: 'master',
  icon: 'pi pi-th-large',
  dependsOn: [{ name: 'Category Master', status: 'Ready' }],
  outputImpact: 'Product group is used in Product Master, product search, stock summaries and MIS reporting.',
  screenMode: 'Master setup',
  fields: [
    { key: 'groupName', label: 'Group Name' },
    { key: 'groupCode', label: 'Group Code' },
    { key: 'linkedCategory', label: 'Linked Category', type: 'select', options: INVENTORY_OPTIONS.categories, addMaster: 'Category' },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'status', label: 'Status', type: 'select', options: INVENTORY_OPTIONS.status }
  ],
  columns: ['Group Code', 'Group Name', 'Linked Category', 'Description', 'Status'],
  rows: [
    ['GRP-MOB', 'Mobile Devices', 'Mobile & Accessories', 'Phones, tablets and handheld devices', 'Active'],
    ['GRP-KIT', 'Kitchen Ingredients', 'Raw Ingredients', 'Restaurant kitchen stock groups', 'Active'],
    ['GRP-DRN', 'Drone Components', 'Drone Components', 'Manufacturing component group', 'Active']
  ]
};

export const barcodeConfigurationConfig: InventoryScreenConfig = {
  key: 'barcodeConfiguration',
  title: 'Barcode Configuration',
  subtitle: 'Configure barcode generation rules and product applicability.',
  kind: 'master',
  icon: 'pi pi-barcode',
  dependsOn: [{ name: 'Product Master', status: 'Ready' }],
  outputImpact: 'Barcode rules support product labels, inward scanning, POS billing and stock verification.',
  screenMode: 'Master setup',
  fields: [
    { key: 'categoryName', label: 'Product Category', type: 'select', options: INVENTORY_OPTIONS.categories, addMaster: 'Category' },
    { key: 'barcodeType', label: 'Barcode Type', type: 'select', options: ['EAN-13', 'Code 128', 'QR Code', 'Internal SKU'] },
    { key: 'autoGenerate', label: 'Auto Generate', type: 'select', options: ['Yes', 'No'] },
    { key: 'prefix', label: 'Prefix' },
    { key: 'startingNumber', label: 'Starting Number', type: 'number' },
    { key: 'length', label: 'Length', type: 'number' },
    { key: 'applicableProducts', label: 'Applicable Products', type: 'multiselect', options: INVENTORY_OPTIONS.products, addMaster: 'Product / Service' }
  ],
  columns: ['Barcode Type', 'Auto Generate', 'Prefix', 'Starting Number', 'Length', 'Applicable Products'],
  rows: [
    ['Code 128', 'Yes', 'ELE', '10001', '12', 'LED Display, Smart Sensor'],
    ['QR Code', 'Yes', 'ROOM', '300', '8', 'Deluxe Room 304']
  ]
};

export const vehicleMasterConfig: InventoryScreenConfig = {
  key: 'vehicleMaster',
  title: 'Vehicle Master',
  subtitle: 'Maintain owned, hired and logistics vehicles used for purchase delivery, dispatch and stock transfer.',
  kind: 'master',
  icon: 'pi pi-truck',
  dependsOn: [
    { name: 'Branch / Store Setup', status: 'Ready' },
    { name: 'Vendor Master for hired vehicles', status: 'Ready' },
    { name: 'Driver and permit validation', status: 'Pending Setup' }
  ],
  outputImpact: 'Vehicle records can be selected in purchase receipt, dispatch, stock transfer and logistics reports.',
  screenMode: 'Master setup',
  fields: [
    { key: 'vehicleNo', label: 'Vehicle No' },
    { key: 'vehicleType', label: 'Vehicle Type', type: 'select', options: ['Own Vehicle', 'Hired Vehicle', 'Transport Partner', 'Two Wheeler', 'Mini Truck', 'Container', 'Refrigerated Vehicle'] },
    { key: 'ownerVendor', label: 'Owner / Vendor', type: 'select', options: INVENTORY_OPTIONS.suppliers, addMaster: 'Vendor' },
    { key: 'assignedBranch', label: 'Assigned Branch', type: 'select', options: INVENTORY_OPTIONS.branches },
    { key: 'capacity', label: 'Capacity' },
    { key: 'driverName', label: 'Driver Name' },
    { key: 'driverMobile', label: 'Driver Mobile' },
    { key: 'permitNo', label: 'Permit / RC No' },
    { key: 'insuranceExpiry', label: 'Insurance Expiry', type: 'date' },
    { key: 'status', label: 'Status', type: 'select', options: INVENTORY_OPTIONS.status },
    { key: 'remarks', label: 'Remarks', type: 'textarea' }
  ],
  columns: ['Vehicle No', 'Vehicle Type', 'Owner / Vendor', 'Assigned Branch', 'Capacity', 'Driver', 'Permit / RC', 'Status'],
  rows: [
    ['TS09AB1234', 'Own Vehicle', 'Company Fleet', 'Head Office', '3 Ton', 'Ravi Kumar | 9876543201', 'RC-TS09-1234', 'Active'],
    ['KA03CD7788', 'Hired Vehicle', 'BuildWell Contractors', 'Bengaluru', '5 Ton', 'Anand Shetty | 9876543202', 'PER-KA03-7788', 'Active'],
    ['TS10RF4421', 'Refrigerated Vehicle', 'Fresh Foods Distributor', 'Restaurant Outlet', '2 Ton Cold Chain', 'Meera Nair | 9876543203', 'RC-TS10-4421', 'Active']
  ]
};

export const substituteProductsConfig: InventoryScreenConfig = {
  key: 'substituteProducts',
  title: 'Substitute Products',
  subtitle: 'Map alternate products that can be suggested during sale, purchase or stock issue.',
  kind: 'master',
  icon: 'pi pi-arrow-right-arrow-left',
  dependsOn: [{ name: 'Product Master', status: 'Ready' }],
  outputImpact: 'Substitute mapping helps sales, procurement and stock issue teams pick approved alternatives.',
  screenMode: 'Master setup',
  fields: [
    { key: 'product', label: 'Product', type: 'select', options: INVENTORY_OPTIONS.products, addMaster: 'Product / Service' },
    { key: 'substituteProduct', label: 'Substitute Product', type: 'select', options: INVENTORY_OPTIONS.products, addMaster: 'Product / Service' },
    { key: 'priority', label: 'Priority', type: 'number' },
    { key: 'remarks', label: 'Remarks', type: 'textarea' }
  ],
  columns: ['Product', 'Substitute Product', 'Priority', 'Remarks'],
  rows: [
    ['LED Display', 'Smart Sensor', '1', 'Use only for project demos'],
    ['Basmati Rice', 'Agro Seed', '2', 'Stock availability fallback']
  ]
};

export const openingInventoryBalanceConfig: InventoryScreenConfig = {
  key: 'openingInventoryBalance',
  title: 'Opening Inventory Balance',
  subtitle: 'Capture branch and warehouse-wise opening stock before live inventory transactions start.',
  kind: 'master',
  icon: 'pi pi-database',
  dependsOn: [
    { name: 'Branch / Store Setup', status: 'Ready' },
    { name: 'Warehouse Setup', status: 'Ready' },
    { name: 'Product Master', status: 'Ready' }
  ],
  outputImpact: 'Opening balances seed stock ledger, valuation and availability reports.',
  screenMode: 'Opening balance',
  fields: [
    // Full Warehouse/Branch Independence: same merged Warehouse/Branch picker
    // GRN/PI/DC/PR/SI use -- a branch pick posts stock directly against the
    // branch itself, no longer resolved to "the one warehouse it's linked
    // to". This screen previously showed Branch and Warehouse as two
    // separate mandatory fields, missed by the original migration. No
    // addMaster here, same as every other genuinely-merged picker (GRN/PI/
    // PR/SI) -- "Add Location" is ambiguous once a Branch is also a valid
    // pick, so those screens deliberately show no add-button on this field.
    { key: 'warehouse', label: 'Warehouse / Branch', type: 'select', options: INVENTORY_OPTIONS.locations },
    { key: 'product', label: 'Product', type: 'select', options: INVENTORY_OPTIONS.products, addMaster: 'Product / Service' },
    { key: 'batchNo', label: 'Batch No' },
    { key: 'serialNo', label: 'Serial No' },
    { key: 'quantity', label: 'Quantity', type: 'number' },
    { key: 'rate', label: 'Rate', type: 'number' },
    { key: 'totalValue', label: 'Total Value', type: 'number' },
    { key: 'openingDate', label: 'Opening Date', type: 'date' }
  ],
  columns: ['Warehouse / Branch', 'Product', 'Batch No', 'Serial No', 'Quantity', 'Rate', 'Total Value', 'Opening Date'],
  rows: [
    ['HYD Main WH', 'LED Display', 'NA', 'SN-1001', '24', '24500', '588000', '01-Apr-2026'],
    ['Main Kitchen Store', 'Basmati Rice', 'LOT-7781', 'NA', '340', '92', '31280', '01-Apr-2026']
  ]
};

export const paymentTermsMasterConfig: InventoryScreenConfig = {
  key: 'paymentTermsMaster',
  title: 'Payment Terms Master',
  subtitle: 'Define credit days and discounts used in purchase and vendor payment planning.',
  kind: 'master',
  icon: 'pi pi-calendar-clock',
  dependsOn: [{ name: 'Vendor Master', status: 'Ready' }],
  outputImpact: 'Payment terms default into Vendor Master, Purchase Order and payable schedules.',
  screenMode: 'Master setup',
  fields: [
    { key: 'termName', label: 'Term Name' },
    { key: 'termCode', label: 'Term Code' },
    { key: 'creditDays', label: 'Credit Days', type: 'number' },
    { key: 'discountPercent', label: 'Discount %', type: 'number' },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'status', label: 'Status', type: 'select', options: INVENTORY_OPTIONS.status }
  ],
  columns: ['Term Name', 'Term Code', 'Credit Days', 'Discount %', 'Description', 'Status'],
  rows: [
    ['Immediate', '0', '0', 'Payment on receipt'],
    ['30 Days', '30', '0', 'Standard vendor credit'],
    ['Advance with Discount', '0', '2', 'Advance payment discount']
  ]
};

export const priceListMasterConfig: InventoryScreenConfig = {
  key: 'priceListMaster',
  title: 'Price List Master',
  subtitle: 'Maintain branch-wise product rates with effective dates.',
  kind: 'master',
  icon: 'pi pi-tags',
  dependsOn: [{ name: 'Product Master', status: 'Ready' }, { name: 'Branch / Store Setup', status: 'Ready' }],
  outputImpact: 'Price lists default rates into estimation, proforma invoice, sales invoice and POS billing.',
  screenMode: 'Master setup',
  fields: [
    { key: 'priceListName', label: 'Price List Name' },
    { key: 'applicableBranch', label: 'Applicable Branch', type: 'select', options: INVENTORY_OPTIONS.branches },
    { key: 'product', label: 'Product', type: 'select', options: INVENTORY_OPTIONS.products, addMaster: 'Product / Service' },
    { key: 'rate', label: 'Rate', type: 'number' },
    { key: 'effectiveFrom', label: 'Effective From', type: 'date' },
    { key: 'effectiveTo', label: 'Effective To', type: 'date' },
    { key: 'status', label: 'Status', type: 'select', options: INVENTORY_OPTIONS.status }
  ],
  columns: ['Price List Name', 'Applicable Branch', 'Product', 'Rate', 'Effective From', 'Effective To', 'Status'],
  rows: [
    ['Retail Price List', 'Head Office', 'LED Display', '28910', '01-Apr-2026', '31-Mar-2027', 'Active'],
    ['Restaurant POS', 'Restaurant Outlet', 'Paneer Tikka', '280', '01-Apr-2026', '31-Mar-2027', 'Active']
  ]
};

export const categoryMasterConfig: InventoryScreenConfig = {
  key: 'categoryMaster',
  title: 'Category Master',
  subtitle: 'Create product groups. Parent Category is the higher-level group, for example Electronics is parent of Mobiles.',
  kind: 'master',
  icon: 'pi pi-folder',
  dependsOn: [
    { name: 'Business Segment', status: 'Ready' },
    { name: 'Product naming policy', status: 'Pending Setup' }
  ],
  outputImpact: 'Categories are used in Product Master, attributes, variants, product search, stock reports and MIS grouping.',
  screenMode: 'Master setup',
  fields: [
    { key: 'categoryName', label: 'Category Name' },
    { key: 'categoryCode', label: 'Category Code' },
    { key: 'parentCategory', label: 'Parent Category', type: 'select', options: ['None / Main Category', 'Electronics', 'Agro Products', 'IT Services', 'Real Estate Units', 'Project Materials', 'Hotel / Restaurant', 'Food & Beverage'], addMaster: 'Business Segment' },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'status', label: 'Status', type: 'select', options: INVENTORY_OPTIONS.status }
  ],
  columns: ['Category Code', 'Category Name', 'Parent Category', 'Serial Policy', 'Batch / Lot Policy', 'Description', 'Applicable UOMs', 'Status'],
  rows: [
    ['CAT-ELEC', 'Electronics', 'None / Main Category', 'Warranty Serial Tracking', 'No', 'Main group for devices, accessories and warranty items', 'Nos, Box', 'Active'],
    ['CAT-MOB', 'Mobiles', 'Electronics', 'IMEI Required', 'No', 'Child category under Electronics for mobile phones', 'Nos', 'Active'],
    ['CAT-SEED', 'Seeds', 'Agro Products', 'No', 'Agro Lot Tracking', 'Child category for agro seed stock', 'KG, Bag', 'Active'],
    ['CAT-FLAT', 'Flats', 'Real Estate Units', 'No', 'No', 'Child category for saleable apartment units', 'Nos', 'Active'],
    ['CAT-FNB', 'Food & Beverage', 'Hotel / Restaurant', 'No', 'Food Batch With Expiry', 'Main restaurant category for kitchen and counter items', 'KG, Plate', 'Active'],
    ['CAT-MENU', 'Menu Items', 'Food & Beverage', 'No', 'Recipe Batch Optional', 'Child category for sellable dishes like Paneer Tikka', 'Plate', 'Active'],
    ['CAT-ROOM', 'Rooms', 'Hotel / Restaurant', 'No', 'No', 'Hotel room inventory for room-night billing', 'Nos', 'Active']
  ]
};

export const brandMasterConfig: InventoryScreenConfig = {
  key: 'brandMaster',
  title: 'Brand Master',
  subtitle: 'Maintain brands used by products, menu items, supplies and hotel consumables.',
  kind: 'master',
  icon: 'pi pi-bookmark',
  dependsOn: [
    { name: 'Product Category', status: 'Ready' },
    { name: 'Manufacturer / supplier details', status: 'Pending Setup' }
  ],
  outputImpact: 'Brand is used in Product Master, purchase analysis, sales reports, stock search and item identification.',
  screenMode: 'Master setup',
  fields: [
    { key: 'brandName', label: 'Brand Name' },
    { key: 'brandCode', label: 'Brand Code' },
    { key: 'categoryName', label: 'Product Category', type: 'select', options: INVENTORY_OPTIONS.categories, addMaster: 'Category', hidden: true },
    { key: 'manufacturer', label: 'Manufacturer', type: 'select', options: [], allowCustomValue: true, addMaster: 'Manufacturer' },
    { key: 'brandLogo', label: 'Brand Logo (Optional)', type: 'file' },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'status', label: 'Status', type: 'select', options: INVENTORY_OPTIONS.status }
  ],
  columns: ['Brand Code', 'Brand Name', 'Manufacturer', 'Brand Logo', 'Description', 'Status'],
  rows: [
    ['BR-DLL', 'Dell', 'Dell Technologies', 'dell-logo.png', 'Electronics and computer devices', 'Active'],
    ['BR-SAM', 'Samsung', 'Samsung India', 'samsung-logo.png', 'Mobiles, displays and accessories', 'Active'],
    ['BR-KFR', 'Kitchen Fresh', 'Kitchen Fresh Foods', 'kitchen-fresh-logo.png', 'Restaurant raw ingredients and ready-to-cook items', 'Active'],
    ['BR-HSE', 'House Brand', 'House Brand', 'house-brand-logo.png', 'Hotel amenities, menu items and in-house products', 'Active']
  ]
};

export const attributeMasterConfig: InventoryScreenConfig = {
  key: 'attributeMaster',
  title: 'Attribute Master',
  subtitle: 'Define reusable product attributes like size, color, grade, capacity and mandatory item properties',
  kind: 'master',
  icon: 'pi pi-sliders-h',
  dependsOn: [
    { name: 'Business Segment', status: 'Ready' },
    { name: 'Variant Master', status: 'Required' },
    { name: 'Product / Service Master', status: 'Pending Setup' }
  ],
  outputImpact: 'Attributes are mapped to variants. The attribute type controls how input is captured at transaction level (text, number, dropdown, yes/no etc.).',
  screenMode: 'Master setup',
  fields: [
    { key: 'attributeName', label: 'Attribute Name' },
    { key: 'possibleValues', label: 'Attribute Values', type: 'tags' },
    { key: 'attributeCode', label: 'Attribute Code' },
    { key: 'attributeType', label: 'Data Type', type: 'select', options: ['List', 'Text', 'Number', 'Date', 'Dropdown', 'Multi Select', 'Yes/No'] },
    { key: 'mandatoryFlag', label: 'Mandatory Flag', type: 'select', options: ['Yes', 'No'] },
    { key: 'status', label: 'Status', type: 'select', options: INVENTORY_OPTIONS.status }
  ],
  columns: ['Attribute Code', 'Attribute Name', 'Data Type', 'Values (Usage)', 'Usage Count', 'Status'],
  rows: [
    ['ATTR-COLOR', 'Color', 'List', 'Black, White, Silver, Blue', '0', 'Active'],
    ['ATTR-STORAGE', 'Storage Capacity', 'List', '64GB, 128GB, 256GB, 512GB', '0', 'Active'],
    ['ATTR-EXPIRY', 'Expiry Date', 'Date', 'Date picker value', '0', 'Active'],
    ['ATTR-GRADE', 'Grade', 'List', 'A, B, C, Premium', '0', 'Active'],
    ['ATTR-SPICE', 'Spice Level', 'List', 'Mild, Medium, Spicy', '0', 'Active'],
    ['ATTR-MEAL', 'Meal Type', 'List', 'Veg, Non-Veg, Vegan', '0', 'Active'],
    ['ATTR-ROOM', 'Room Type', 'List', 'Standard, Deluxe, Suite', '0', 'Active']
  ]
};

export const variantMasterConfig: InventoryScreenConfig = {
  key: 'variantMaster',
  title: 'Variant Master',
  subtitle: 'Define product variants with one or more mapped attributes for SKU clarity',
  kind: 'master',
  icon: 'pi pi-sitemap',
  dependsOn: [
    { name: 'Attribute Master', status: 'Required' },
    { name: 'Product Category', status: 'Ready' }
  ],
  outputImpact: 'Variant values are reusable definitions. They are mapped to specific items later in Product / Service Master.',
  screenMode: 'Master setup',
  fields: [
    { key: 'variantName', label: 'Variant Name' },
    { key: 'variantCode', label: 'Variant Code' },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'status', label: 'Status', type: 'select', options: INVENTORY_OPTIONS.status }
  ],
  columns: ['Variant Code', 'Variant Name', 'Attributes', 'Status'],
  rows: [
    ['VAR-COLOR-BLK', 'Black Color', 'Color: Black', 'Active'],
    ['VAR-STOR-128', '128GB Storage', 'Storage Capacity: 128GB', 'Active'],
    ['VAR-GRADE-A', 'Grade A', 'Grade: A', 'Active'],
    ['VAR-SIZE-L', 'Large Size', 'Size: Large', 'Active'],
    ['VAR-SPICE-MED', 'Medium Spicy', 'Spice Level: Medium', 'Active'],
    ['VAR-MEAL-VEG', 'Vegetarian', 'Meal Type: Veg', 'Active'],
    ['VAR-ROOM-DLX', 'Deluxe Room', 'Room Type: Deluxe', 'Active']
  ],
  lineTitle: 'Variant Attributes',
  lineColumns: ['Attribute Name', 'Attribute Value']
};

export const serialNumberPolicyConfig: InventoryScreenConfig = {
  key: 'serialNumberPolicy',
  title: 'Serial Number Policy Master',
  subtitle: 'Define serial/IMEI policy defaults that can be mapped category-wise and overridden in Product Master.',
  kind: 'master',
  icon: 'pi pi-qrcode',
  dependsOn: [
    { name: 'Category Master', status: 'Ready' },
    { name: 'Product Master override', status: 'Pending Setup' }
  ],
  outputImpact: 'Serial policy controls whether products require IMEI, serial number, warranty tracking or unique item scanning.',
  screenMode: 'Master setup',
  fields: [
    { key: 'policyName', label: 'Policy Name' },
    { key: 'policyCode', label: 'Policy Code' },
    { key: 'applicableCategory', label: 'Applicable Category', type: 'select', options: INVENTORY_OPTIONS.categories, addMaster: 'Category' },
    { key: 'serialFormat', label: 'Format Notes (optional)' },
    { key: 'captureStage', label: 'Capture Stage', type: 'select', options: ['Purchase Inward', 'Sales Invoice', 'Both Inward and Sale', 'Warranty Registration'] },
    { key: 'allowDuplicate', label: 'Allow Duplicate Serial No.', type: 'select', options: ['Yes', 'No'] },
    { key: 'warrantyApplicable', label: 'Warranty Applicable', type: 'select', options: ['Yes', 'No'] },
    { key: 'status', label: 'Status', type: 'select', options: INVENTORY_OPTIONS.status }
  ],
  columns: ['Policy Code', 'Policy Name', 'Applicable Category', 'Serial Format', 'Capture Stage', 'Allow Duplicate', 'Warranty Applicable', 'Status'],
  rows: [
    ['SNP-IMEI', 'IMEI Required', 'Mobile & Accessories', '15 digit IMEI', 'Both Inward and Sale', 'No', 'Yes', 'Active'],
    ['SNP-SERIAL', 'Serial No Required', 'Computers & Devices', 'Brand serial number', 'Purchase Inward', 'No', 'No', 'Active'],
    ['SNP-WAR', 'Warranty Serial Tracking', 'Electronics', 'Alphanumeric', 'Warranty Registration', 'No', 'Yes', 'Active']
  ]
};

export const batchLotPolicyConfig: InventoryScreenConfig = {
  key: 'batchLotPolicy',
  title: 'Batch / Lot Policy Master',
  subtitle: 'Define batch and lot tracking rules that can be selected product-wise in Product Master.',
  kind: 'master',
  icon: 'pi pi-box',
  dependsOn: [
    { name: 'Product Category', status: 'Ready' },
    { name: 'Expiry and QC rules', status: 'Pending Setup' }
  ],
  outputImpact: 'Batch/Lot policy controls inward lots, expiry, QC hold, food/agro traceability and manufacturing raw material tracking.',
  screenMode: 'Master setup',
  fields: [
    { key: 'policyName', label: 'Policy Name' },
    { key: 'policyCode', label: 'Policy Code' },
    { key: 'applicableCategory', label: 'Applicable Category', type: 'select', options: INVENTORY_OPTIONS.categories, addMaster: 'Category' },
    { key: 'batchFormat', label: 'Format Notes (optional)' },
    { key: 'expiryRequired', label: 'Expiry Required', type: 'select', options: ['Yes', 'No'] },
    { key: 'qcRequired', label: 'QC Required', type: 'select', options: ['Yes', 'No'] },
    { key: 'status', label: 'Status', type: 'select', options: INVENTORY_OPTIONS.status }
  ],
  columns: ['Policy Code', 'Policy Name', 'Applicable Category', 'Batch / Lot Format', 'Expiry Required', 'QC Required', 'Status'],
  rows: [
    ['BLP-FOOD', 'Food Batch With Expiry', 'Raw Ingredients', 'YYYYMMDD-SUPPLIER-SEQ', 'Yes', 'Yes', 'Active'],
    ['BLP-AGRO', 'Agro Lot Tracking', 'Agro Commodities', 'LOT-FY-SEQ', 'Yes', 'Yes', 'Active'],
    ['BLP-RM', 'Raw Material Batch', 'Drone Components', 'RM-PO-SEQ', 'No', 'Yes', 'Active']
  ]
};

export const bomMasterConfig: InventoryScreenConfig = {
  key: 'bomMaster',
  title: 'BOM Master',
  subtitle: 'Define raw material requirements and production cost for finished products.',
  kind: 'master',
  icon: 'pi pi-cog',
  dependsOn: [{ name: 'Product Master', status: 'Ready' }],
  outputImpact: 'BOM supports manufacturing issue, consumption, costing and production planning.',
  screenMode: 'Master setup',
  fields: [
    { key: 'bomCode', label: 'BOM Code' },
    { key: 'finishedProduct', label: 'Finished Product', type: 'select', options: INVENTORY_OPTIONS.finishedGoodsProducts, addMaster: 'Product / Service' },
    { key: 'version', label: 'Version' },
    { key: 'rawMaterials', label: 'Raw Materials', type: 'multiselect', options: INVENTORY_OPTIONS.rawMaterialProducts, addMaster: 'Product / Service' },
    { key: 'quantity', label: 'Quantity', type: 'number' },
    { key: 'wastagePercent', label: 'Wastage %', type: 'number' },
    { key: 'productionCost', label: 'Production Cost', type: 'number' },
    { key: 'status', label: 'Status', type: 'select', options: INVENTORY_OPTIONS.status }
  ],
  columns: ['BOM Code', 'Finished Product', 'Version', 'Raw Materials', 'Quantity', 'Wastage %', 'Production Cost', 'Status'],
  rows: [
    ['BOM-DRN-01', 'Drone Motor', 'V1', 'Battery Pack, Flight Controller', '1', '2', '12500', 'Active'],
    ['BOM-MENU-01', 'Paneer Tikka', 'V1', 'Paneer, Spice Mix', '1 Plate', '3', '145', 'Active']
  ]
};

export const workCenterMasterConfig: InventoryScreenConfig = {
  key: 'workCenterMaster',
  title: 'Work Center Master',
  subtitle: 'Maintain manufacturing work centers, capacity and hourly cost.',
  kind: 'master',
  icon: 'pi pi-building',
  dependsOn: [{ name: 'Branch / Store Setup', status: 'Ready' }],
  outputImpact: 'Work centers support production routing, capacity planning and manufacturing costing.',
  screenMode: 'Master setup',
  fields: [
    { key: 'workCenterName', label: 'Work Center Name' },
    { key: 'department', label: 'Department' },
    { key: 'capacity', label: 'Capacity' },
    { key: 'costPerHour', label: 'Cost Per Hour', type: 'number' },
    { key: 'status', label: 'Status', type: 'select', options: INVENTORY_OPTIONS.status },
    { key: 'workCenterCode', label: 'Work Center Code' }
  ],
  columns: ['Work Center Code', 'Work Center Name', 'Department', 'Capacity', 'Cost Per Hour', 'Status'],
  rows: [
    ['WC-ASM', 'Assembly Line', 'Manufacturing', '40 Units / Day', '1200', 'Active'],
    ['WC-QC', 'Quality Check', 'Quality', '80 Checks / Day', '850', 'Active']
  ]
};

export const consumptionTypeMasterConfig: InventoryScreenConfig = {
  key: 'consumptionTypeMaster',
  title: 'Consumption Type Master',
  subtitle: 'Define consumption types and map the approval workflow used for internal stock usage.',
  kind: 'master',
  icon: 'pi pi-list-check',
  dependsOn: [{ name: 'Department list', status: 'Pending Setup' }, { name: 'Approval Workflow Master', status: 'Required' }],
  outputImpact: 'Consumption types drive stock issue, workflow selection, department approvals and consumption reports.',
  screenMode: 'Master setup',
  fields: [
    { key: 'consumptionType', label: 'Consumption Type' },
    { key: 'typeCode', label: 'Consumption Code' },
    { key: 'department', label: 'Department' },
    { key: 'approvalRequired', label: 'Approval Required', type: 'select', options: ['Yes', 'No'] },
    { key: 'approvalWorkflow', label: 'Approval Workflow', type: 'select', options: ['Admin Department Head Approval', 'Production Manager Approval', 'Kitchen Auto Approval'], addMaster: 'Approval Workflow' },
    { key: 'remarks', label: 'Remarks', type: 'textarea' }
  ],
  columns: ['Consumption Code', 'Consumption Type', 'Department', 'Approval Required', 'Remarks', 'Status'],
  rows: [
    ['Internal Maintenance', 'Admin', 'Yes', 'Admin Department Head Approval', 'Office and facility consumption'],
    ['Production Issue', 'Manufacturing', 'Yes', 'Production Manager Approval', 'Raw material issued to production'],
    ['Kitchen Consumption', 'Restaurant', 'No', 'Kitchen Auto Approval', 'Daily recipe consumption']
  ]
};

export const productTypeMasterConfig: InventoryScreenConfig = {
  key: 'productTypeMaster',
  title: 'Product Nature Master',
  subtitle: 'Define product natures and configure behavior flags that control purchase, sale, inventory tracking, asset allocation and services.',
  kind: 'master',
  icon: 'pi pi-box',
  outputImpact: 'Product Nature controls which transactions are allowed per product, how stock and cost are tracked, and whether serial, batch or expiry defaults apply.',
  screenMode: 'Company-wide setup',
  fields: [
    { key: 'typeName', label: 'Type Name' },
    { key: 'typeCode', label: 'Type Code' },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'status', label: 'Status', type: 'select', options: INVENTORY_OPTIONS.status }
  ],
  columns: ['Type Code', 'Type Name', 'Purchase', 'Sale', 'Tracks Inventory', 'Service', 'Asset', 'Kind', 'Status'],
  rows: [
    ['PHY_STOCK', 'Physical Stock', 'Yes', 'Yes', 'Yes', 'No', 'No', 'System', 'Active'],
    ['SERVICE', 'Service', 'Yes', 'Yes', 'No', 'Yes', 'No', 'System', 'Active'],
    ['FIXED_ASSET', 'Fixed Asset', 'Yes', 'No', 'Yes', 'No', 'Yes', 'System', 'Active'],
    ['CONSUMABLE', 'Consumable', 'Yes', 'Yes', 'Yes', 'No', 'No', 'System', 'Active'],
    ['SUBFIN', 'Semi-Finished Product', 'No', 'No', 'Yes', 'No', 'No', 'System', 'Active'],
    ['FINP', 'Finished Product', 'No', 'Yes', 'Yes', 'No', 'No', 'System', 'Active'],
    ['RAW_MAT', 'Raw Material', 'Yes', 'No', 'Yes', 'No', 'No', 'System', 'Active']
  ]
};

export const approvalWorkflowMasterConfig: InventoryScreenConfig = {
  key: 'approvalWorkflowMaster',
  title: 'Approval Workflow Master',
  subtitle: 'Create reusable approval rules for consumption, stock adjustment, purchase, sales and other ERP screens.',
  kind: 'master',
  icon: 'pi pi-verified',
  dependsOn: [
    { name: 'Users and roles', status: 'Required' },
    { name: 'Department list', status: 'Pending Setup' },
    { name: 'Branch / Store Setup', status: 'Ready' }
  ],
  outputImpact: 'Workflow rules tell the ERP who must approve, when approval is needed, and how pending documents move to the next approver.',
  screenMode: 'Shared approval setup',
  fields: [
    { key: 'workflowCode', label: 'Workflow Code' },
    { key: 'workflowName', label: 'Workflow Name' },
    { key: 'applicableScreen', label: 'Applicable Screen', type: 'multiselect', options: ['Consumption Type', 'Stock Adjustment', 'Purchase Order', 'Goods Receipt', 'Sales Invoice', 'Payment Voucher'] },
    { key: 'approvalLevel', label: 'Approval Level', type: 'select', options: ['Single Level', 'Two Level', 'Multi Level'] },
    { key: 'approverType', label: 'Approver Type', type: 'select', options: ['User', 'Role', 'Department Head', 'Branch Manager', 'Reporting Manager'] },
    { key: 'approver', label: 'Approver', type: 'select', options: ['Admin Manager', 'Production Manager', 'Branch Manager', 'Finance Manager', 'Restaurant Manager'] },
    { key: 'autoApproveBelow', label: 'Auto Approve Below Amount', type: 'number' },
    { key: 'escalationTo', label: 'Escalation To', type: 'select', options: ['Admin Head', 'Operations Head', 'Finance Head', 'CEO'] },
    { key: 'escalationHours', label: 'Escalation Hours', type: 'number' },
    { key: 'status', label: 'Status', type: 'select', options: INVENTORY_OPTIONS.status }
  ],
  columns: ['Workflow Code', 'Workflow Name', 'Applicable Screen', 'Approval Level', 'Approver Type', 'Approver', 'Auto Approve Below', 'Escalation', 'Status'],
  rows: [
    ['WF-ADM-01', 'Admin Department Head Approval', 'Consumption Type, Stock Adjustment', 'Single Level', 'Department Head', 'Admin Manager', '5000', 'Operations Head / 24 Hrs', 'Active'],
    ['WF-PRD-01', 'Production Manager Approval', 'Consumption Type, Purchase Order', 'Two Level', 'Role', 'Production Manager', '0', 'Operations Head / 12 Hrs', 'Active'],
    ['WF-FIN-01', 'Finance Manager Approval', 'Payment Voucher, Purchase Order', 'Multi Level', 'Role', 'Finance Manager', '10000', 'Finance Head / 24 Hrs', 'Active']
  ]
};

export const transporterMasterConfig: InventoryScreenConfig = {
  key: 'transporterMaster',
  title: 'Transporter Master',
  subtitle: 'Maintain logistics partners and contact details from global contacts.',
  kind: 'master',
  icon: 'pi pi-send',
  dependsOn: [{ name: 'Global Contact', status: 'Ready' }],
  outputImpact: 'Transporter details are used in purchase delivery, dispatch, stock transfer and logistics reporting.',
  screenMode: 'Master setup',
  fields: [
    { key: 'transporterCode', label: 'Transporter Code' },
    { key: 'transporterName', label: 'Transporter Name' },
    { key: 'gstin', label: 'GSTIN' },
    { key: 'contactPerson', label: 'Contact Person', type: 'select', options: INVENTORY_OPTIONS.contactPersons, addMaster: 'Contact Person' },
    { key: 'mobile', label: 'Mobile' },
    { key: 'vehicleType', label: 'Vehicle Type', type: 'select', options: ['Own Vehicle', 'Hired Vehicle', 'Mini Truck', 'Container', 'Refrigerated Vehicle'] },
    { key: 'status', label: 'Status', type: 'select', options: INVENTORY_OPTIONS.status }
  ],
  columns: ['Transporter Code', 'Transporter Name', 'GSTIN', 'Contact Person', 'Mobile', 'Vehicle Type', 'Status'],
  rows: [
    ['TRN-1001', 'BuildWell Logistics', '36TRNSP1234F1Z2', 'Rajesh Kumar', '9876543201', 'Mini Truck', 'Active'],
    ['TRN-1002', 'Fresh Cold Chain', '36COLD4421F1Z8', 'Meera Nair', '9876543203', 'Refrigerated Vehicle', 'Active']
  ]
};

export const productServiceMasterConfig: InventoryScreenConfig = {
  key: 'productServiceMaster',
  title: 'Product / Service Master',
  subtitle: 'Create one specific product or service SKU and map it to its general product category, UOM, HSN/SAC and transaction behavior',
  kind: 'master',
  icon: 'pi pi-tags',
  dependsOn: [
    { name: 'Business Segment', status: 'Ready' },
    { name: 'Product Category', status: 'Required' },
    { name: 'UOM Master', status: 'Ready' },
    { name: 'HSN/SAC Mapping', status: 'Ready' },
    { name: 'GST rules', status: 'Pending Setup' },
    { name: 'Serial policy and Batch/Lot policy', status: 'Pending Setup' }
  ],
  outputImpact: 'Product/service record used by all transactions and reports. Category defaults can auto-fill serial policy, while product-wise batch/lot policy controls lot, expiry and QC behavior.',
  screenMode: 'Master setup',
  recordTitle: 'Product / Service Examples',
  recordSubtitle: 'Product means one specific item or service. Product Category means the general group it belongs to.',
  fields: [
    { key: 'segment', label: 'Business Segment', type: 'select', options: INVENTORY_OPTIONS.segments, addMaster: 'Business Segment' },
    { key: 'sku', label: 'Product / Service SKU' },
    { key: 'name', label: 'Product / Service Name (Specific Item)' },
    { key: 'category', label: 'Product Category (Group)', type: 'select', options: INVENTORY_OPTIONS.categories, addMaster: 'Category' },
    { key: 'brand', label: 'Brand', type: 'select', options: INVENTORY_OPTIONS.brands, addMaster: 'Brand' },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'tracking', label: 'Tracking Method', type: 'select', options: INVENTORY_OPTIONS.trackingMethods },
    { key: 'hasExpiry', label: 'Has Expiry', type: 'select', options: ['Yes', 'No'] },
    { key: 'valuationMethod', label: 'Valuation Method', type: 'select', options: INVENTORY_OPTIONS.valuationMethods },
    { key: 'status', label: 'Status', type: 'select', options: INVENTORY_OPTIONS.status },
    { key: 'baseUom', label: 'Base UOM', type: 'select', options: INVENTORY_OPTIONS.uoms, addMaster: 'UOM' },
    { key: 'alternateUom', label: 'Alternate UOM', type: 'select', options: INVENTORY_OPTIONS.uoms, addMaster: 'UOM' },
    { key: 'conversionFactor', label: 'Conversion Factor', type: 'number' },
    { key: 'hsnSac', label: 'HSN / SAC (Auto Bind)', type: 'select', options: INVENTORY_OPTIONS.hsnSac, addMaster: 'HSN / SAC' },
    { key: 'gstRate', label: 'GST % (Auto from HSN/SAC)', type: 'number' },
    { key: 'openingQty', label: 'Opening Qty / Capacity', type: 'number' },
    { key: 'limit', label: 'Reorder / Booking Limit', type: 'number' },
    { key: 'purchaseUom', label: 'Purchase UOM', type: 'select', options: INVENTORY_OPTIONS.uoms, addMaster: 'UOM' },
    { key: 'saleUom', label: 'Saleable / Billable UOM', type: 'select', options: INVENTORY_OPTIONS.uoms, addMaster: 'UOM' },
    { key: 'behavior', label: 'Transaction Behavior', type: 'select', options: INVENTORY_OPTIONS.behavior }
  ],
  columns: ['Product Code', 'SKU', 'Name', 'Product Category', 'Product Nature', 'Base UOM', 'Variants', 'Mapped UOMs', 'Valuation', 'HSN/SAC', 'GST %', 'Status'],
  rows: [
    ['ITM-1001', 'LED Display', 'LED Display', 'Computers & Devices', '', 'Nos', '', '', 'FIFO', '8471', '18', 'Active'],
    ['SRV-2090', 'AMC Support', 'AMC Support', 'IT Services', '', 'Month', '', '', 'Weighted Average', '998313', '18', 'Active'],
    ['UNT-A1204', 'Flat A-1204', 'Flat A-1204', 'Real Estate Units', '', 'Unit', '', '', 'Specific Identification', '9954', '18', 'Active'],
    ['FOD-1001', 'Basmati Rice', 'Basmati Rice', 'Raw Ingredients', '', 'KG', '', 'Bag x 25 (Purchase)', 'FIFO', '1006', '5', 'Active'],
    ['MENU-204', 'Paneer Tikka', 'Paneer Tikka', 'Menu Items', '', 'Plate', '', '', 'Recipe Cost', '996331', '5', 'Active'],
    ['ROOM-304', 'Deluxe Room 304', 'Deluxe Room 304', 'Rooms', '', 'Room-Night', '', '', 'Specific Identification', '996332', '12', 'Active']
  ],
  lineTitle: 'Alternate UOM Conversion Mapping',
  lineColumns: ['Alternate UOM', 'Conversion Factor', 'Is Purchase', 'Is Sales', 'Active'],
  lineRows: []
};

export const estimationConfig = transaction(
  'estimation',
  'Estimation',
  'Prepare quotations across goods, services, spaces and units',
  'pi pi-calculator',
  [
    { name: 'Customer / Lead', status: 'Required' },
    { name: 'Product / Service Master', status: 'Ready' },
    { name: 'UOM conversion', status: 'Ready' },
    { name: 'HSN/SAC mapping', status: 'Ready' },
    { name: 'Pricing rules', status: 'Pending Setup' }
  ],
  'Estimate record that may become a Proforma Invoice.',
  { columns: ['Est. No', 'Date', 'Segment', 'Customer', 'Items', 'Status'] }
);

export const proformaInvoiceConfig = transaction(
  'proformaInvoice',
  'Proforma Invoice',
  'Create pre-sales invoice before final billing',
  'pi pi-file',
  [
    { name: 'Estimate reference', status: 'Pending Setup' },
    { name: 'Customer Master', status: 'Ready' },
    { name: 'Product / Service Master', status: 'Ready' },
    { name: 'GST and pricing', status: 'Pending Setup' }
  ],
  'Proforma record that may become Sales Invoice without stock impact until converted.',
  { columns: ['Proforma No', 'Date', 'Segment', 'Customer', 'Items', 'Status'] }
);

export const purchaseOrderConfig = transaction(
  'purchaseOrder',
  'Purchase Order',
  'Order materials, stock, project goods and services',
  'pi pi-shopping-cart',
  [
    { name: 'Vendor Master', status: 'Ready' },
    { name: 'Product / Service Master', status: 'Ready' },
    { name: 'Warehouse / Location Master', status: 'Ready' },
    { name: 'Purchase UOM conversion', status: 'Required' },
    { name: 'HSN/SAC', status: 'Ready' }
  ],
  'Purchase Order used by Goods Receipt / Material Inward.',
  {
    fields: [
      { key: 'poNo', label: 'PO No' },
      { key: 'poDate', label: 'PO Date', type: 'date' },
      { key: 'expectedDelivery', label: 'Expected Delivery', type: 'date' },
      { key: 'linkedPr', label: 'RFQ Reference' },
      { key: 'supplier', label: 'Party / Vendor', type: 'select', options: INVENTORY_OPTIONS.suppliers, addMaster: 'Vendor' },
      { key: 'receivingWarehouse', label: 'Receiving WH', type: 'select', options: INVENTORY_OPTIONS.locations, addMaster: 'Location' },
      { key: 'currency', label: 'Currency', type: 'select', options: INVENTORY_OPTIONS.currencies },
      { key: 'paymentTerms', label: 'Payment Terms', type: 'select', options: INVENTORY_OPTIONS.paymentTerms },
      { key: 'referenceNo', label: 'Reference No' },
      { key: 'terms', label: 'Terms & Conditions', type: 'textarea' }
    ],
    lineTitle: 'Purchase Items',
    lineColumns: ['Item / SKU', 'Variant', 'Attribute', 'UOM', 'Qty', 'Rate', 'Disc %', 'GST', 'Warehouse', 'Amount'],
    lineRows: [
      ['LED Display 32 inch', '', '', 'Box', '5', '90,000', '2', '18%', 'HYD Main WH', '5,31,000'],
      ['Agro Seed Premium', 'Bag', '120', '1,850', '0', '5%', 'BLR Store', '2,33,100'],
      ['Basmati Rice 25KG', 'Bag', '60', '2,250', '1', '5%', 'Main Kitchen Store', '1,40,333']
    ],
    columns: ['PO No', 'PO Date', 'Supplier', 'RFQ Ref', 'Receiving WH', 'Items', 'Amount', 'Status'],
    rows: [
      ['PO-1001', '08-May-2026', 'ElectroMart Supplies', 'HYD Main WH', '2', 'Rs. 6,51,360', 'Draft'],
      ['PO-1002', '07-May-2026', 'Aero Labs', 'Manufacturing Store', '1', 'Rs. 1,20,360', 'Approved']
    ]
  }
);

export const goodsReceiptConfig = transaction(
  'goodsReceipt',
  'Goods Receipt Note (GRN)',
  'Record inward goods against a Purchase Order reference or directly against a vendor invoice, with accepted/rejected quantities and batch/serial capture.',
  'pi pi-download',
  [
    { name: 'Vendor Master', status: 'Ready' },
    { name: 'Location / Warehouse Master', status: 'Ready' },
    { name: 'Product Master with UOM', status: 'Ready' },
    { name: 'Purchase Order reference', status: 'Ready' }
  ],
  'GRN posts stock into selected warehouse. Accepted qty updates stock ledger. Rejected qty triggers quality hold.',
  {
    screenMode: 'Goods receipt entry',
    fields: [
      { key: 'segment', label: 'Business Segment', type: 'select', options: INVENTORY_OPTIONS.segments, addMaster: 'Business Segment' },
      { key: 'grnNo', label: 'GRN Number' },
      { key: 'grnDate', label: 'GRN Date', type: 'date' },
      { key: 'vendor', label: 'Party / Vendor', type: 'select', options: INVENTORY_OPTIONS.suppliers, addMaster: 'Vendor' },
      { key: 'poReference', label: 'PO Reference / Direct' },
      { key: 'vendorInvoiceNo', label: 'Vendor Invoice No' },
      { key: 'vendorInvoiceDate', label: 'Vendor Invoice Date', type: 'date' },
      { key: 'receivingLocation', label: 'Receiving Warehouse / Branch', type: 'select', options: [] },
      { key: 'status', label: 'Status', type: 'select', options: ['Draft', 'Posted'] },
      { key: 'remarks', label: 'Remarks', type: 'textarea' }
    ],
    lineTitle: 'Received Items',
    lineColumns: ['Product', 'Variant', 'Attribute', 'UOM', 'Received Qty', 'Accepted Qty', 'Rate', 'Disc %', 'GST', 'Batch No', 'Serial No', 'Expiry Date', 'Amount'],
    lineRows: [
      ['LED Display 32 inch', '', '', 'Box', '5', '4', '90,000', '2', '18%', 'NA', 'SN-1042..46', 'NA', '3,53,808'],
      ['Agro Seed Premium', '', '', 'Bag', '120', '118', '1,850', '0', '5%', 'LOT-AGRO-0526-A', 'NA', '18-Dec-2026', '2,29,509'],
      ['Basmati Rice 25KG', '', '', 'Bag', '60', '60', '2,250', '1', '5%', 'LOT-RICE-0526-K', 'NA', '30-Nov-2026', '1,40,333']
    ],
    columns: ['GRN No', 'GRN Date', 'Vendor', 'PO Ref', 'Warehouse', 'Items', 'Status'],
    rows: [
      ['GRN-1042', '08-May-2026', 'ElectroMart Supplies', 'PO-1001', 'HYD Main WH', '2', 'Draft'],
      ['GRN-1043', '07-May-2026', 'Aero Labs', 'PO-1002', 'Manufacturing Store', '1', 'Draft']
    ]
  }
);

export const purchaseInvoiceConfig = transaction(
  'purchaseInvoice',
  'Purchase Invoice',
  'Record supplier invoice against GRN or enter a direct purchase invoice without reference',
  'pi pi-receipt',
  [
    { name: 'Vendor Master', status: 'Ready' },
    { name: 'Product / Service Master', status: 'Ready' },
    { name: 'GRN reference', status: 'Ready' },
    { name: 'Payment Terms Master', status: 'Ready' }
  ],
  'Purchase Invoice stores supplier bill details in Inventory only. Accounts posting is intentionally not touched here. Posting a direct invoice (no GRN Reference) receives stock into the selected Warehouse / Branch; a GRN-linked invoice does not move stock again since the GRN already posted it.',
  {
    screenMode: 'Purchase invoice entry',
    fields: [
      { key: 'segment', label: 'Business Segment', type: 'select', options: INVENTORY_OPTIONS.segments, addMaster: 'Business Segment' },
      { key: 'piNo', label: 'PI Number' },
      { key: 'piDate', label: 'PI Date', type: 'date' },
      { key: 'vendor', label: 'Party / Vendor', type: 'select', options: INVENTORY_OPTIONS.suppliers, addMaster: 'Vendor' },
      { key: 'grnReference', label: 'GRN Reference / Direct' },
      { key: 'vendorInvoiceNo', label: 'Vendor Invoice No' },
      { key: 'vendorInvoiceDate', label: 'Vendor Invoice Date', type: 'date' },
      { key: 'receivingLocation', label: 'Warehouse / Branch', type: 'select', options: [] },
      { key: 'paymentTerms', label: 'Payment Terms', type: 'select', options: INVENTORY_OPTIONS.paymentTerms },
      { key: 'dueDate', label: 'Due Date', type: 'date' },
      { key: 'status', label: 'Status', type: 'select', options: ['Draft', 'Posted'] },
      { key: 'remarks', label: 'Remarks', type: 'textarea' }
    ],
    lineTitle: 'Invoice Items',
    // Qty is for a direct entry (no GRN reference) -- a plain purchased
    // quantity, nothing more. Accepted Qty only applies once this invoice
    // actually references a posted GRN, where it displays (read-only) the
    // GRN's accepted quantity -- see item 5. Received Qty is intentionally
    // NOT a PI column: PI always bills on Accepted Qty when GRN-linked.
    lineColumns: ['Product', 'Variant', 'Attribute', 'UOM', 'Qty', 'Accepted Qty', 'Rate', 'MRP', 'Selling Price', 'Disc %', 'GST', 'Batch No', 'Serial No', 'Expiry Date', 'Warranty Upto', 'Amount'],
    lineRows: [],
    columns: ['PI No', 'PI Date', 'Vendor', 'Warehouse / Branch', 'GRN Ref', 'Amount', 'Due Date', 'Status'],
    rows: []
  }
);

export const salesInvoiceConfig = transaction(
  'salesInvoice',
  'Sales Invoice',
  'Bill goods, services, space usage and real estate units',
  'pi pi-receipt',
  [
    { name: 'Customer Master', status: 'Ready' },
    { name: 'Product / Service Master', status: 'Ready' },
    { name: 'HSN/SAC', status: 'Ready' },
    { name: 'Sale / billing UOM', status: 'Required' },
    { name: 'Stock/capacity availability', status: 'Pending Setup' }
  ],
  'Posting a Sales Invoice decrements stock at the selected Warehouse — either directly, or against a picked Sales Order (its line items pull in automatically).',
  {
    posMode: 'switch',
    fields: [
      { key: 'invoiceNo', label: 'Invoice No' },
      { key: 'invoiceDate', label: 'Date', type: 'date' },
      { key: 'paymentTerms', label: 'Payment Terms', type: 'select', options: INVENTORY_OPTIONS.paymentTerms, addMaster: 'Payment Terms' },
      { key: 'dueDate', label: 'Due Date', type: 'date' },
      { key: 'soReference', label: 'Reference', type: 'select', options: [] },
      { key: 'referenceNo', label: 'Reference' },
      { key: 'customer', label: 'Party / Customer', type: 'select', options: INVENTORY_OPTIONS.customers, addMaster: 'Customer' },
      { key: 'channelPartner', label: 'Channel Partner', type: 'select', options: [], addMaster: 'Channel Partner' },
      { key: 'placeOfSupply', label: 'Place of Supply', type: 'select', options: ['Telangana', 'Karnataka', 'Andhra Pradesh', 'Maharashtra'] },
      // Full Warehouse/Branch Independence: the same merged Warehouse/Branch
      // picker GRN/PI/DC/Purchase Return use -- a branch pick posts stock
      // directly against the branch itself (fn_post_sales_invoice_stock,
      // migration 166), no longer resolved to "the one warehouse it's linked
      // to". Unrelated to the separate Interbranch Sale Branch field below.
      { key: 'warehouse', label: 'Warehouse / Branch', type: 'select', options: INVENTORY_OPTIONS.locations },
      // Item 13: multi-branch sales. Off by default (defaultFieldValue()
      // defaults every Yes/No field to 'No') so every existing invoice and
      // every new one that never touches this switch behaves byte-for-byte
      // as before. Branch only matters, and only renders, once the switch
      // is on.
      { key: 'interbranchSale', label: 'Interbranch Sale', type: 'select', options: ['Yes', 'No'] },
      { key: 'branch', label: 'Branch', type: 'select', options: INVENTORY_OPTIONS.branches },
      { key: 'transportMode', label: 'Transport Mode', type: 'select', options: ['Road', 'Rail', 'Air', 'Hand Delivery', 'Not Applicable'] },
      { key: 'vehicleNo', label: 'Vehicle No' },
      { key: 'deliveryAddress', label: 'Delivery Address', type: 'textarea' },
      { key: 'customerNotes', label: 'Customer Notes', type: 'textarea' },
      { key: 'internalNotes', label: 'Internal Notes', type: 'textarea' }
    ],
    posFields,
    lineTitle: 'Sales Items',
    // Workstream D: Warehouse column removed -- it was forced read-only and
    // purely cosmetic on this screen (identical value in every real case to
    // the header 'warehouse' field), and the picker's own Stock Across
    // Branches panel (Workstream A) is now the natural replacement for the
    // per-cell "also in stock at X" hint it carried. Purchase Order's own
    // Warehouse column (line ~1290 above) is a real, independently-editable
    // per-line field and stays untouched -- this removal is Sales Invoice
    // only.
    lineColumns: ['Item / SKU', 'Variant', 'Attribute', 'UOM', 'Qty', 'Rate', 'Disc %', 'GST', 'Batch No', 'Serial No', 'Expiry Date', 'Warranty Upto', 'Amount'],
    lineRows: [
      ['LED Display 32 inch', '', '', 'Nos', '2', '24,500', '26,000', '24,500', '0', '18%', 'NA', 'SN-1042, SN-1043', 'NA', 'HYD Main WH', '57,820'],
      ['Agro Seed Premium', '', '', 'Bag', '10', '2,150', '2,300', '2,150', '1', '5%', 'LOT-AGRO-0526-A', 'NA', '18-Dec-2026', 'BLR Store', '22,349'],
      ['Basmati Rice 25KG', '', '', 'Bag', '6', '2,650', '2,800', '2,650', '0', '5%', 'LOT-RICE-0526-K', 'NA', '30-Nov-2026', 'Main Kitchen Store', '16,695']
    ],
    columns: ['Invoice No', 'Date', 'Segment', 'Customer', 'Proforma Ref', 'Status']
  }
);

export const posBillingConfig = transaction(
  'posBilling',
  'POS / Counter Billing',
  'Quick counter sales or front-office billing with simple payment capture',
  'pi pi-desktop',
  [
    { name: 'Counter / Location Master', status: 'Ready' },
    { name: 'Product Master', status: 'Ready' },
    { name: 'Stock availability', status: 'Pending Setup' },
    { name: 'Payment mode master', status: 'Required' },
    { name: 'Tax/pricing rules', status: 'Pending Setup' }
  ],
  'POS bill or sales invoice with immediate stock impact and payment entry.',
  {
    posMode: 'pos',
    fields: posFields,
    lineColumns,
    lineRows: [],
    columns: ['Bill Date', 'Counter', 'Customer', 'Item', 'Qty', 'Payment', 'Net Amount', 'Status'],
    rows: [
      ['08-May-2026', 'HYD Main WH', 'Walk-in Customer', 'LED Display', '1', 'UPI', 'Rs. 28,910', 'Completed'],
      ['08-May-2026', 'BLR Store', 'Walk-in Customer', 'Cable Roll', '2', 'Card', 'Rs. 4,366', 'Hold Bill']
    ]
  }
);

export const stockTransferConfig = transaction(
  'stockTransfer',
  'Stock Transfer',
  'Move stock between branches, warehouses, sites and floors',
  'pi pi-arrow-right-arrow-left',
  [
    { name: 'Location Master', status: 'Ready' },
    { name: 'Product Master', status: 'Ready' },
    { name: 'UOM conversion', status: 'Ready' },
    { name: 'Stock availability in from-location', status: 'Ready' }
  ],
  'Stock decreases from source and increases at destination with stock ledger movement entry. Cost moves with the stock -- the source lot\'s own cost carries over to the destination unchanged.',
  {
    fields: [
      { key: 'segment', label: 'Business Segment', type: 'select', options: INVENTORY_OPTIONS.segments, addMaster: 'Business Segment' },
      { key: 'transferNo', label: 'Transfer No' },
      { key: 'transferDate', label: 'Transfer Date', type: 'date' },
      { key: 'fromWarehouse', label: 'From Warehouse / Branch', type: 'select', options: INVENTORY_OPTIONS.locations, addMaster: 'Location' },
      { key: 'toWarehouse', label: 'To Warehouse / Branch', type: 'select', options: INVENTORY_OPTIONS.locations, addMaster: 'Location' },
      { key: 'remarks', label: 'Remarks', type: 'textarea' }
    ],
    lineTitle: 'Transfer Items',
    lineColumns: ['Item / SKU', 'Variant', 'Attribute', 'UOM', 'Qty', 'Batch No', 'Serial No'],
    lineRows: [
      ['LED Display 32 inch', '', '', 'Nos', '2', 'NA', ''],
      ['Basmati Rice 25KG', '', '', 'Bag', '5', 'LOT-RICE-0526-K', '']
    ],
    columns: ['Transfer No', 'Transfer Date', 'From Warehouse', 'To Warehouse', 'Items', 'Status'],
    rows: [
      ['ST-EL-26-00001', '10-May-2026', 'HYD Main WH', 'BLR Store', '2', 'Posted'],
      ['ST-EL-26-00002', '09-May-2026', 'BLR Store', 'Main Kitchen Store', '1', 'Draft']
    ]
  }
);

export const stockAdjustmentConfig = transaction(
  'stockAdjustment',
  'Stock / Availability Adjustment',
  'Adjust physical stock, seats, units and project material availability',
  'pi pi-sliders-h',
  [
    { name: 'Location Master', status: 'Ready' },
    { name: 'Product Master', status: 'Ready' },
    { name: 'UOM conversion', status: 'Ready' },
    // Workstream 3: these two overclaimed "Ready" -- there is no dedicated
    // Reason master (Reason is a plain free-text field on this form) and no
    // real approval routing (Approval is just the generic Status dropdown:
    // Pending Approval / Approved / Rejected). Copy corrected to say what
    // actually exists today; building either feature for real is separate,
    // unrequested scope.
    { name: 'Reason (free text field, no dedicated master)', status: 'Pending Setup' },
    { name: 'Approval (Status field only, no approval routing)', status: 'Pending Setup' }
  ],
  'Pending or approved adjustment. Stock impact happens only after approval -- rejecting a pending adjustment never touches stock.',
  {
    fields: [
      { key: 'segment', label: 'Business Segment', type: 'select', options: INVENTORY_OPTIONS.segments, addMaster: 'Business Segment' },
      { key: 'adjustmentNo', label: 'Adjustment No' },
      { key: 'adjustmentDate', label: 'Adjustment Date', type: 'date' },
      { key: 'warehouse', label: 'Warehouse / Branch', type: 'select', options: INVENTORY_OPTIONS.locations, addMaster: 'Location' },
      { key: 'adjustmentType', label: 'Adjustment Type', type: 'select', options: ['Increase', 'Decrease'] },
      { key: 'reason', label: 'Reason' },
      { key: 'status', label: 'Status', type: 'select', options: ['Pending Approval', 'Approved', 'Rejected'] },
      { key: 'remarks', label: 'Remarks', type: 'textarea' }
    ],
    lineTitle: 'Adjustment Items',
    lineColumns: ['Item / SKU', 'Variant', 'Attribute', 'UOM', 'Qty', 'Batch No', 'Serial No'],
    lineRows: [
      ['LED Display 32 inch', '', '', 'Nos', '1', 'NA', ''],
      ['Basmati Rice 25KG', '', '', 'Bag', '3', 'LOT-RICE-0526-K', '']
    ],
    columns: ['Adjustment No', 'Adjustment Date', 'Warehouse / Branch', 'Type', 'Reason', 'Items', 'Status'],
    rows: [
      ['SA-EL-26-00001', '10-May-2026', 'HYD Main WH', 'Increase', 'Found stock during cycle count', '1', 'Approved'],
      ['SA-EL-26-00002', '09-May-2026', 'BLR Store', 'Decrease', 'Damaged in storage', '1', 'Pending Approval']
    ]
  }
);

export const stockAvailabilityReportConfig = report(
  'stockAvailabilityReport',
  'Stock / Availability Report',
  'View stock, seats, services and unit availability by segment',
  [
    { name: 'Product Master', status: 'Ready' },
    { name: 'Location Master', status: 'Ready' },
    { name: 'Posted GRN / invoices / transfers', status: 'Pending Setup' }
  ],
  'Current available quantity/capacity report by segment and location.'
);
export const stockLedgerConfig = report(
  'stockLedger',
  'Stock Ledger',
  'Track inward, outward, transfer and adjustment movement',
  [
    { name: 'Posted GRN, Invoice/POS, Transfer, Adjustment records', status: 'Pending Setup' },
    { name: 'Product Master', status: 'Ready' },
    { name: 'UOM conversion', status: 'Ready' }
  ],
  'Audit trail of stock movement and balance calculation.'
);
export const segmentSummaryConfig = report(
  'segmentSummary',
  'Segment-wise Summary',
  'Compare inventory value and availability by business segment',
  [
    { name: 'All masters grouped by segment', status: 'Ready' },
    { name: 'Transactions grouped by segment', status: 'Pending Setup' }
  ],
  'Management summary for segment performance and operational status.'
);
export const hsnSacReportConfig = report(
  'hsnSacReport',
  'HSN/SAC Mapping Report',
  'Review tax mapping for product and service master',
  [
    { name: 'Product Master', status: 'Ready' },
    { name: 'HSN/SAC mapping source', status: 'Pending Setup' },
    { name: 'GST master/API', status: 'Pending Setup' }
  ],
  'Compliance support report for tax/accounts review.'
);

// ─────────────────────────────────────────────────────────────────────────────
// PROCUREMENT TRANSACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const vendorPaymentConfig = transaction(
  'vendorPayment',
  'Vendor Payment',
  'Settle vendor purchase invoices with full or partial allocation.',
  'pi pi-arrow-up-right',
  [
    { name: 'Vendor Master', status: 'Ready' },
    { name: 'Posted Purchase Invoice', status: 'Required' },
    { name: 'Payment mode details', status: 'Required' }
  ],
  'Payment reduces vendor outstanding and prepares payable settlement details for Accounts.',
  {
    screenMode: 'Payment settlement',
    fields: [
      { key: 'vendor', label: 'Vendor', type: 'select', options: INVENTORY_OPTIONS.suppliers, addMaster: 'Vendor' },
      { key: 'voucherDate', label: 'Voucher Date', type: 'date' },
      { key: 'amountToPay', label: 'Amount To Pay', type: 'number' },
      { key: 'purchaseInvoice', label: 'Purchase Invoice Allocation', type: 'multiselect' },
      { key: 'paymentMode', label: 'Payment Mode', type: 'select', options: INVENTORY_OPTIONS.paymentModes },
      { key: 'narration', label: 'Narration', type: 'textarea' }
    ],
    lineTitle: 'Payment Allocations',
    lineColumns: ['Purchase Invoice', 'Outstanding', 'This Payment', 'Balance'],
    columns: ['Voucher No', 'Date', 'Vendor', 'Allocated Amount', 'Mode', 'Status']
  }
);

export const customerReceiptConfig = transaction(
  'customerReceipt',
  'Customer Receipt',
  'Record customer receipts against sales invoices with full or partial allocation.',
  'pi pi-arrow-down-left',
  [
    { name: 'Customer Master', status: 'Ready' },
    { name: 'Posted Sales Invoice', status: 'Required' },
    { name: 'Receipt mode details', status: 'Required' }
  ],
  'Receipt reduces customer outstanding and prepares receivable settlement details for Accounts.',
  {
    screenMode: 'Receipt settlement',
    fields: [
      { key: 'customer', label: 'Customer', type: 'select', options: INVENTORY_OPTIONS.customers, addMaster: 'Customer' },
      { key: 'voucherDate', label: 'Voucher Date', type: 'date' },
      { key: 'amountReceived', label: 'Amount Received', type: 'number' },
      { key: 'salesInvoice', label: 'Sales Invoice Allocation', type: 'multiselect' },
      { key: 'receiptMode', label: 'Receipt Mode', type: 'select', options: INVENTORY_OPTIONS.paymentModes },
      { key: 'narration', label: 'Narration', type: 'textarea' }
    ],
    lineTitle: 'Receipt Allocations',
    lineColumns: ['Sales Invoice', 'Outstanding', 'This Receipt', 'Balance'],
    columns: ['Voucher No', 'Date', 'Customer', 'Allocated Amount', 'Mode', 'Status']
  }
);

export const purchaseRequisitionConfig = transaction(
  'purchaseRequisition',
  'Purchase Requisition (PR)',
  'Raise internal purchase requests for procurement team review and approval',
  'pi pi-file-plus',
  [
    { name: 'Product / Service Master', status: 'Ready' },
    { name: 'Department Setup', status: 'Required' },
    { name: 'Approval Workflow Master', status: 'Pending Setup' }
  ],
  'Approved PR triggers Purchase Order creation to vendor.',
  {
    screenMode: 'Procurement request entry',
    fields: [
      { key: 'segment', label: 'Business Segment', type: 'select', options: INVENTORY_OPTIONS.segments },
      { key: 'prNo', label: 'PR Number' },
      { key: 'prDate', label: 'PR Date', type: 'date' },
      { key: 'branch', label: 'Branch', type: 'select', options: [] },
      { key: 'department', label: 'Department', type: 'select', options: ['Admin', 'Production', 'Sales', 'Kitchen', 'IT', 'Maintenance', 'Finance', 'Operations'] },
      { key: 'requestedBy', label: 'Requested By', type: 'select', options: [] },
      { key: 'priority', label: 'Priority', type: 'select', options: ['High', 'Medium', 'Low'] },
      { key: 'requiredDate', label: 'Required Date', type: 'date' },
      { key: 'remarks', label: 'Remarks', type: 'textarea' }
    ],
    lineTitle: 'Requested Items',
    lineColumns: ['Product', 'Variant', 'Attribute', 'Description', 'UOM', 'Request Qty'],
    lineRows: [
      ['LED Display 32"', '', '', '32-inch 4K LED Display', 'Nos', '5'],
      ['Drone Motor (2212)', '', '', 'Brushless 2212 Motor Set', 'Set', '12']
    ],
    columns: ['PR No', 'PR Date', 'Branch', 'Department', 'Requested By', 'Priority', 'Status'],
    rows: []
  }
);

export const requestForQuotationConfig = transaction(
  'requestForQuotation',
  'Request for Quotation (RFQ)',
  'Send RFQs to vendors for price comparison before issuing a Purchase Order',
  'pi pi-send',
  [
    { name: 'Vendor Master', status: 'Ready' },
    { name: 'Product / Service Master', status: 'Ready' },
    { name: 'Purchase Requisition', status: 'Pending Setup' }
  ],
  'RFQ responses are compared to select the best vendor for Purchase Order.',
  {
    screenMode: 'Vendor quotation request',
    fields: [
      { key: 'segment', label: 'Business Segment', type: 'select', options: INVENTORY_OPTIONS.segments, addMaster: 'Business Segment' },
      { key: 'rfqNo', label: 'RFQ Number' },
      { key: 'rfqDate', label: 'RFQ Date', type: 'date' },
      { key: 'validTill', label: 'Valid Till', type: 'date' },
      { key: 'vendor', label: 'Party / Vendor', type: 'select', options: INVENTORY_OPTIONS.suppliers, addMaster: 'Vendor' },
      { key: 'prReference', label: 'PR Reference' },
      { key: 'currency', label: 'Currency', type: 'select', options: INVENTORY_OPTIONS.currencies },
      { key: 'deliveryLocation', label: 'Delivery Location', type: 'select', options: INVENTORY_OPTIONS.locations, addMaster: 'Location' },
      { key: 'paymentTerms', label: 'Payment Terms', type: 'select', options: INVENTORY_OPTIONS.paymentTerms },
      { key: 'status', label: 'Status', type: 'select', options: ['Draft', 'Sent', 'Response Received', 'Accepted', 'Closed'] },
      { key: 'termsConditions', label: 'Terms & Conditions', type: 'textarea' }
    ],
    lineTitle: 'Quoted Items',
    lineColumns: ['Product', 'Variant', 'Attribute', 'Qty', 'UOM', 'Target Rate', 'Vendor Rate', 'Lead Time'],
    lineRows: [
      ['LED Display', '', '', '5', 'Nos', '24,500', '23,800', '7 Days'],
      ['Drone Motor', '', '', '12', 'Set', '8,500', '8,200', '10 Days']
    ],
    columns: ['RFQ No', 'RFQ Date', 'Valid Till', 'Vendor', 'Items', 'Status'],
    rows: [
      ['RFQ-001', '08-May-2026', '15-May-2026', 'ElectroMart Supplies', '2', 'Sent'],
      ['RFQ-002', '07-May-2026', '14-May-2026', 'Aero Labs', '1', 'Response Received']
    ]
  }
);

export const purchaseReturnConfig = transaction(
  'purchaseReturn',
  'Purchase Return',
  'Return rejected or excess goods to vendor against a posted PI or direct return',
  'pi pi-reply',
  [
    { name: 'Posted Purchase Invoice reference', status: 'Required' },
    { name: 'Vendor Master', status: 'Ready' },
    { name: 'Product Master', status: 'Ready' }
  ],
  'Purchase return reduces stock when posted. It can be raised against a posted Purchase Invoice or entered directly when needed.',
  {
    screenMode: 'Purchase return entry',
    fields: [
      { key: 'returnNo', label: 'Return Number' },
      { key: 'returnDate', label: 'Return Date', type: 'date' },
      { key: 'vendor', label: 'Party / Vendor', type: 'select', options: INVENTORY_OPTIONS.suppliers, addMaster: 'Vendor' },
      { key: 'piReference', label: 'PI Reference', type: 'select', options: [] },
      // Full Warehouse/Branch Independence: now the same merged Warehouse/
      // Branch picker GRN/PI/DC use (runtimeOptions() returns the merged
      // list for this key+screen, and the payload builder resolves via
      // resolveMergedLocation()) -- a branch pick posts stock directly
      // against the branch itself (fn_post_purchase_return_stock, migration
      // 165), no longer resolved to "the one warehouse it's linked to".
      { key: 'warehouse', label: 'Warehouse / Branch', type: 'select', options: INVENTORY_OPTIONS.locations },
      { key: 'returnReason', label: 'Return Reason', type: 'select', options: ['Damaged in Transit', 'Quality Failure', 'Wrong Item Delivered', 'Excess Quantity', 'Expired on Arrival'] },
      { key: 'remarks', label: 'Remarks', type: 'textarea' }
    ],
    lineTitle: 'Return Items',
    lineColumns: ['Product', 'Variant', 'Attribute', 'UOM', 'Invoice Qty', 'Return Qty', 'Rate', 'GST', 'Return Amount', 'Serial No'],
    lineRows: [
      ['LED Display', '', '', 'Nos', '5', '1', '24,500', '18', '28,910', ''],
      ['Drone Motor', '', '', 'Set', '12', '2', '8,500', '18', '20,060', '']
    ],
    columns: ['Return No', 'Return Date', 'Vendor', 'PI Ref', 'Items', 'Return Amount', 'Status'],
    rows: [
      ['PR-RET-001', '09-May-2026', 'ElectroMart Supplies', 'PI-1042', '1', 'Rs. 24,500', 'Posted'],
      ['PR-RET-002', '08-May-2026', 'Aero Labs', 'PI-1043', '2', 'Rs. 17,000', 'Draft']
    ]
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// SALES TRANSACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const salesEnquiryConfig = transaction(
  'salesEnquiry',
  'Sales Enquiry',
  'Capture customer enquiries, requirements and expected delivery for quotation',
  'pi pi-question-circle',
  [
    { name: 'Customer Master', status: 'Required' },
    { name: 'Product / Service Master', status: 'Ready' }
  ],
  'Sales enquiry converts to Sales Quotation. Tracks lead-to-order pipeline.',
  {
    screenMode: 'Enquiry capture',
    fields: [
      { key: 'enquiryNo', label: 'Enquiry Number' },
      { key: 'enquiryDate', label: 'Enquiry Date', type: 'date' },
      { key: 'referenceNo', label: 'Reference' },
      { key: 'customer', label: 'Party / Customer', type: 'select', options: INVENTORY_OPTIONS.customers, addMaster: 'Customer' },
      { key: 'contactPerson', label: 'Contact Person', type: 'select', options: INVENTORY_OPTIONS.contactPersons, addMaster: 'Contact Person' },
      { key: 'expectedDelivery', label: 'Expected Delivery', type: 'date' },
      { key: 'branch', label: 'Branch', type: 'select', options: INVENTORY_OPTIONS.branches },
      { key: 'source', label: 'Enquiry Source', type: 'select', options: ['Walk-in', 'Phone', 'Email', 'Website', 'Referral', 'Exhibition'] },
      { key: 'remarks', label: 'Remarks', type: 'textarea' }
    ],
    lineTitle: 'Enquired Products',
    lineColumns: ['Product', 'Description', 'UOM', 'Quantity', 'Expected Price'],
    lineRows: [
      ['LED Display', '55-inch 4K commercial display', 'Nos', '10', '22,000'],
      ['AMC Support', 'Annual maintenance 50 systems', 'Year', '1', '3,00,000']
    ],
    columns: ['Enquiry No', 'Enquiry Date', 'Customer', 'Items', 'Expected Delivery', 'Status'],
    rows: [
      ['ENQ-2001', '08-May-2026', 'Tenant Works Pvt Ltd', '2', '15-Jun-2026', 'Open'],
      ['ENQ-2002', '07-May-2026', 'Metro Projects', '1', '30-May-2026', 'Quoted'],
      ['ENQ-2003', '06-May-2026', 'Green County Buyer', '3', '20-Jun-2026', 'Open']
    ]
  }
);

export const salesQuotationConfig = transaction(
  'salesQuotation',
  'Sales Quotation',
  'Prepare and send formal price quotation to customer with validity period',
  'pi pi-file-export',
  [
    { name: 'Customer Master', status: 'Ready' },
    { name: 'Product / Service Master', status: 'Ready' },
    { name: 'Price List Master', status: 'Pending Setup' },
    { name: 'HSN/SAC mapping', status: 'Ready' }
  ],
  'Approved quotation converts to Sales Order. Quotation sent via WhatsApp or email.',
  {
    screenMode: 'Quotation entry',
    fields: [
      { key: 'quotationNo', label: 'Quotation Number' },
      { key: 'quotationDate', label: 'Quotation Date', type: 'date' },
      { key: 'validTill', label: 'Valid Till', type: 'date' },
      { key: 'customer', label: 'Party / Customer', type: 'select', options: INVENTORY_OPTIONS.customers, addMaster: 'Customer' },
      { key: 'priceList', label: 'Price List', type: 'select', options: ['Retail Price List', 'Dealer Price List', 'Corporate Price List'], addMaster: 'Price List' },
      { key: 'currency', label: 'Currency', type: 'select', options: INVENTORY_OPTIONS.currencies },
      { key: 'enquiryRef', label: 'Enquiry Reference' },
      { key: 'branch', label: 'Branch', type: 'select', options: INVENTORY_OPTIONS.branches },
      { key: 'terms', label: 'Terms & Conditions', type: 'textarea' }
    ],
    lineTitle: 'Quoted Items',
    lineColumns: ['Product', 'UOM', 'Qty', 'List Rate', 'Disc %', 'Net Rate', 'GST %', 'Amount'],
    lineRows: [
      ['LED Display', 'Nos', '10', '24,500', '5', '23,275', '18%', '2,74,645'],
      ['AMC Support', 'Year', '1', '3,00,000', '0', '3,00,000', '18%', '3,54,000']
    ],
    columns: ['Quotation No', 'Date', 'Valid Till', 'Customer', 'Amount', 'Status'],
    rows: [
      ['QUO-3001', '08-May-2026', '22-May-2026', 'Tenant Works Pvt Ltd', 'Rs. 6,28,645', 'Sent'],
      ['QUO-3002', '07-May-2026', '21-May-2026', 'Metro Projects', 'Rs. 3,54,000', 'Accepted']
    ]
  }
);

export const salesOrderConfig = transaction(
  'salesOrder',
  'Sales Order (SO)',
  'Confirm customer order with delivery terms, warehouse and payment schedule',
  'pi pi-shopping-bag',
  [
    { name: 'Customer Master', status: 'Ready' },
    { name: 'Warehouse / Location Master', status: 'Ready' },
    { name: 'Product Master with stock', status: 'Required' }
  ],
  'SO reserves stock in warehouse and drives delivery challan, invoice and receivables.',
  {
    screenMode: 'Sales order confirmation',
    fields: [
      { key: 'soNo', label: 'SO Number' },
      { key: 'soDate', label: 'SO Date', type: 'date' },
      { key: 'customer', label: 'Party / Customer', type: 'select', options: INVENTORY_OPTIONS.customers, addMaster: 'Customer' },
      { key: 'creditSale', label: 'Credit Sale', type: 'select', options: ['Yes', 'No'] },
      { key: 'paymentTerms', label: 'Payment Terms', type: 'select', options: INVENTORY_OPTIONS.paymentTerms },
      { key: 'dueDate', label: 'Due Date', type: 'date' },
      { key: 'deliveryDate', label: 'Delivery Date', type: 'date' },
      { key: 'deliveryAddress', label: 'Delivery Address', type: 'textarea' }
    ],
    lineTitle: 'Order Items',
    lineColumns: ['Product', 'Variant', 'Attribute', 'UOM', 'Qty', 'Expected Rate (Exp. Rate)', 'GST %', 'Batch No', 'Expiry Date', 'Amount'],
    lineRows: [],
    columns: ['SO No', 'SO Date', 'Customer', 'Amount', 'Delivery Date', 'Status'],
    rows: [
      ['SO-4001', '09-May-2026', 'Tenant Works Pvt Ltd', 'Rs. 6,28,645', '25-May-2026', 'Posted'],
      ['SO-4002', '08-May-2026', 'Metro Projects', 'Rs. 3,54,000', '30-May-2026', 'Partially Delivered']
    ]
  }
);

export const deliveryChallanConfig = transaction(
  'deliveryChallan',
  'Delivery Challan (DC)',
  'Issue delivery challan for dispatching goods against sales order or direct sale',
  'pi pi-truck',
  [
    { name: 'Sales Order reference', status: 'Required' },
    { name: 'Vehicle Master', status: 'Ready' },
    { name: 'Transporter Master', status: 'Ready' },
    { name: 'Warehouse stock', status: 'Pending Setup' }
  ],
  'DC dispatches goods from warehouse. Stock moves out. Invoice follows after delivery confirmation.',
  {
    screenMode: 'Dispatch entry',
    fields: [
      { key: 'dcNo', label: 'DC Number' },
      { key: 'dcDate', label: 'DC Date', type: 'date' },
      { key: 'soReference', label: 'Reference (SO / Invoice)', type: 'select', options: [] },
      { key: 'customer', label: 'Party / Customer', type: 'select', options: INVENTORY_OPTIONS.customers, addMaster: 'Customer' },
      { key: 'fromWarehouse', label: 'From Warehouse / Branch', type: 'select', options: [], addMaster: 'Location' },
      { key: 'vehicle', label: 'Vehicle', type: 'select', options: ['TS09AB1234', 'KA03CD7788', 'TS10RF4421'], addMaster: 'Vehicle' },
      { key: 'transporter', label: 'Transporter', type: 'select', options: ['BuildWell Logistics', 'Fresh Cold Chain', 'Own Fleet'], addMaster: 'Transporter' },
      { key: 'lrNo', label: 'LR No' },
      { key: 'deliveryAddress', label: 'Delivery Address', type: 'textarea' }
    ],
    lineTitle: 'Dispatched Items',
    lineColumns: ['Product', 'Variant', 'Attribute', 'SO Qty', 'Dispatch Qty', 'UOM', 'Serial No'],
    lineRows: [
      ['LED Display', '', '', '10', '6', 'Nos', ''],
      ['AMC Support', '', '', '1', '1', 'Year', '']
    ],
    columns: ['DC No', 'DC Date', 'Customer', 'Vehicle', 'Items', 'SO Ref', 'Status'],
    rows: [
      ['DC-5001', '10-May-2026', 'Tenant Works Pvt Ltd', 'TS09AB1234', '2', 'SO-4001', 'In Transit'],
      ['DC-5002', '09-May-2026', 'Metro Projects', 'KA03CD7788', '1', 'SO-4002', 'Delivered']
    ]
  }
);

export const salesReturnConfig = transaction(
  'salesReturn',
  'Sales Return',
  'Accept returned goods from customer with credit note and stock restoration',
  'pi pi-undo',
  [
    { name: 'Sales Invoice reference', status: 'Required' },
    { name: 'Customer Master', status: 'Ready' },
    { name: 'Warehouse / Location Master', status: 'Ready' }
  ],
  'Sales return increases stock back. Credit note reduces customer receivables.',
  {
    screenMode: 'Sales return entry',
    fields: [
      { key: 'returnNo', label: 'Return Number' },
      { key: 'returnDate', label: 'Return Date', type: 'date' },
      { key: 'customer', label: 'Party / Customer', type: 'select', options: INVENTORY_OPTIONS.customers, addMaster: 'Customer' },
      { key: 'invoiceReference', label: 'Invoice Reference', type: 'select', options: [] },
      { key: 'returnToWarehouse', label: 'Return To Warehouse', type: 'select', options: INVENTORY_OPTIONS.locations, addMaster: 'Location' },
      { key: 'returnReason', label: 'Return Reason', type: 'select', options: ['Wrong Product Delivered', 'Damaged in Delivery', 'Customer Cancelled', 'Quality Issue', 'Excess Quantity'] },
      { key: 'remarks', label: 'Remarks', type: 'textarea' }
    ],
    lineTitle: 'Returned Items',
    lineColumns: ['Product', 'Variant', 'Attribute', 'Invoiced Qty', 'Return Qty', 'UOM', 'Rate', 'GST', 'Batch No', 'Serial No', 'Expiry Date', 'Return Amount', 'Reason'],
    lineRows: [
      ['LED Display', '', '', '6', '1', 'Nos', '28,910', '18%', 'NA', 'SN-1042', 'NA', '34,114', 'Damaged in Delivery'],
      ['AMC Support', '', '', '1', '0', 'Year', '0', '0%', 'NA', 'NA', 'NA', '0', 'No Return']
    ],
    columns: ['Return No', 'Return Date', 'Customer', 'Invoice Ref', 'Amount', 'Status'],
    rows: [
      ['SR-RET-001', '11-May-2026', 'Tenant Works Pvt Ltd', 'INV-6001', 'Rs. 28,910', 'Posted'],
      ['SR-RET-002', '10-May-2026', 'Metro Projects', 'INV-5998', 'Rs. 14,160', 'Draft']
    ]
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// INVENTORY TRANSACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const openingStockEntryConfig = transaction(
  'openingStockEntry',
  'Opening Stock Entry',
  'Enter warehouse-wise opening stock before live inventory operations begin',
  'pi pi-database',
  [
    { name: 'Branch / Store Setup', status: 'Ready' },
    { name: 'Warehouse Setup', status: 'Ready' },
    { name: 'Product Master', status: 'Ready' }
  ],
  'Opening stock seeds stock ledger balance, valuation and availability reports.',
  {
    screenMode: 'Opening stock entry',
    fields: [
      { key: 'entryNo', label: 'Entry Number' },
      { key: 'entryDate', label: 'Entry Date', type: 'date' },
      // Full Warehouse/Branch Independence: same merged Warehouse/Branch
      // picker GRN/PI/DC/PR/SI use -- a branch pick posts stock directly
      // against the branch itself, no longer resolved to "the one warehouse
      // it's linked to". This screen previously showed Branch and Warehouse
      // as two separate mandatory fields, missed by the original migration.
      // No addMaster here, same as every other genuinely-merged picker
      // (GRN/PI/PR/SI) -- "Add Location" is ambiguous once a Branch is also
      // a valid pick, so those screens deliberately show no add-button.
      { key: 'warehouse', label: 'Warehouse / Branch', type: 'select', options: INVENTORY_OPTIONS.locations },
      { key: 'remarks', label: 'Remarks', type: 'textarea' }
    ],
    lineTitle: 'Opening Stock Items',
    lineColumns: ['Product', 'UOM', 'Opening Qty', 'Rate', 'Total Value', 'Batch No', 'Serial No'],
    lineRows: [
      ['LED Display', 'Nos', '24', '24,500', '5,88,000', 'NA', 'SN-1001..SN-1024'],
      ['Basmati Rice', 'KG', '340', '92', '31,280', 'LOT-7781', 'NA'],
      ['Drone Motor', 'Set', '45', '8,500', '3,82,500', 'LOT-DRN-001', 'NA']
    ],
    columns: ['Entry No', 'Entry Date', 'Warehouse / Branch', 'Items', 'Total Value', 'Status'],
    rows: [
      ['OSE-001', '01-Apr-2026', 'HYD Main WH', '3', 'Rs. 10,01,780', 'Posted'],
      ['OSE-002', '01-Apr-2026', 'Main Kitchen Store', '8', 'Rs. 1,24,600', 'Posted']
    ]
  }
);

export const cycleCountConfig = transaction(
  'cycleCount',
  'Cycle Count / Physical Verification',
  'Conduct physical stock count and reconcile with system quantity',
  'pi pi-search-plus',
  [
    { name: 'Warehouse Setup', status: 'Ready' },
    { name: 'Product Master', status: 'Ready' },
    { name: 'Stock adjustment permission', status: 'Required' }
  ],
  'Physical count variance triggers stock adjustment for approval. Audit trail maintained.',
  {
    screenMode: 'Physical verification',
    fields: [
      { key: 'verificationNo', label: 'Verification Number' },
      { key: 'verificationDate', label: 'Verification Date', type: 'date' },
      { key: 'warehouse', label: 'Warehouse', type: 'select', options: INVENTORY_OPTIONS.locations, addMaster: 'Location' },
      { key: 'verifiedBy', label: 'Verified By', type: 'select', options: INVENTORY_OPTIONS.contactPersons, addMaster: 'Contact Person' },
      { key: 'productCategory', label: 'Product Category', type: 'select', options: INVENTORY_OPTIONS.categories, addMaster: 'Category' },
      { key: 'remarks', label: 'Remarks', type: 'textarea' }
    ],
    lineTitle: 'Count Sheet',
    lineColumns: ['Product', 'UOM', 'System Qty', 'Physical Qty', 'Variance', 'Reason', 'Action'],
    lineRows: [
      ['LED Display', 'Nos', '146', '142', '-4', 'Damaged/Unrecorded', 'Adjust'],
      ['Basmati Rice', 'KG', '340', '345', '+5', 'Receipt not updated', 'Adjust'],
      ['Drone Motor', 'Set', '45', '45', '0', 'Match', 'None']
    ],
    columns: ['Verification No', 'Date', 'Warehouse', 'Verified By', 'Items', 'Variance Items', 'Status'],
    rows: [
      ['CC-001', '10-May-2026', 'HYD Main WH', 'Rajesh Kumar', '12', '3', 'Pending Approval'],
      ['CC-002', '08-May-2026', 'Manufacturing Store', 'Anil Reddy', '8', '1', 'Approved']
    ]
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// MANUFACTURING TRANSACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const productionPlanningConfig = transaction(
  'productionPlanning',
  'Production Planning',
  'Plan production runs with finished product, BOM version and raw material requirements',
  'pi pi-calendar-plus',
  [
    { name: 'BOM Master', status: 'Ready' },
    { name: 'Work Center Master', status: 'Ready' },
    { name: 'Raw Material Stock', status: 'Pending Setup' }
  ],
  'Production plan drives material issue, production entry and finished goods stock.',
  {
    screenMode: 'Production planning',
    fields: [
      { key: 'planNo', label: 'Plan Number' },
      { key: 'planDate', label: 'Plan Date', type: 'date' },
      { key: 'productionDate', label: 'Production Date', type: 'date' },
      { key: 'finishedProduct', label: 'Finished Product', type: 'select', options: INVENTORY_OPTIONS.products, addMaster: 'Product / Service' },
      { key: 'plannedQty', label: 'Planned Qty', type: 'number' },
      { key: 'bomVersion', label: 'BOM Version', type: 'select', options: ['V1', 'V2', 'V3', 'Latest'], addMaster: 'BOM' },
      { key: 'workCenter', label: 'Work Center', type: 'select', options: ['Assembly Line', 'Quality Check', 'Kitchen Station'], addMaster: 'Work Center' },
      { key: 'warehouse', label: 'Production Warehouse / Branch', type: 'select', options: INVENTORY_OPTIONS.locations, addMaster: 'Location' },
      { key: 'remarks', label: 'Remarks', type: 'textarea' }
    ],
    lineTitle: 'Raw Material Requirement Grid',
    lineColumns: ['Raw Material', 'Variant', 'Attribute', 'UOM', 'Required Qty', 'Available Qty', 'Shortage', 'Batch Req'],
    lineRows: [
      ['Drone Motor', '', '', 'Nos', '48', '620', '0', 'Yes'],
      ['Flight Controller', '', '', 'Nos', '12', '86', '0', 'No'],
      ['Battery Pack', '', '', 'Nos', '12', '55', '0', 'Yes']
    ],
    columns: ['Plan No', 'Plan Date', 'Finished Product', 'Planned Qty', 'Work Center', 'Status'],
    rows: [
      ['PP-001', '08-May-2026', 'Drone Motor', '12 Sets', 'Assembly Line', 'In Progress'],
      ['PP-002', '07-May-2026', 'Paneer Tikka', '50 Plates', 'Kitchen Station', 'Completed']
    ]
  }
);

export const materialIssueProductionConfig = transaction(
  'materialIssueProduction',
  'Material Issue for Production',
  'Issue raw materials from warehouse to production work center against a production plan',
  'pi pi-arrow-up-right',
  [
    { name: 'Production Plan reference', status: 'Required' },
    { name: 'Raw Material Stock', status: 'Ready' },
    { name: 'Warehouse / Work Center', status: 'Ready' }
  ],
  'Stock decreases from raw material store. Production WIP is updated.',
  {
    screenMode: 'Material issue for production',
    fields: [
      { key: 'issueNo', label: 'Issue Number' },
      { key: 'issueDate', label: 'Issue Date', type: 'date' },
      { key: 'productionRef', label: 'Production Plan Ref' },
      { key: 'forFinishedProduct', label: 'For Finished Product', type: 'select', options: INVENTORY_OPTIONS.products, addMaster: 'Product / Service' },
      { key: 'fromWarehouse', label: 'Production Warehouse / Branch', type: 'select', options: INVENTORY_OPTIONS.locations, addMaster: 'Location' },
      { key: 'toWorkCenter', label: 'To Work Center', type: 'select', options: ['Assembly Line', 'Quality Check', 'Kitchen Station'], addMaster: 'Work Center' },
      { key: 'issuedBy', label: 'Issued By', type: 'select', options: INVENTORY_OPTIONS.contactPersons },
      { key: 'remarks', label: 'Remarks', type: 'textarea' }
    ],
    lineTitle: 'Issued Materials',
    lineColumns: ['Raw Material', 'Variant', 'Attribute', 'UOM', 'Required Qty', 'Issued Qty', 'Batch / Lot No', 'Serial No'],
    lineRows: [
      ['Drone Motor', '', '', 'Nos', '48', '48', 'LOT-DRN-001', ''],
      ['Flight Controller', '', '', 'Nos', '12', '12', '', ''],
      ['Basmati Rice', '', '', 'KG', '20', '20', 'LOT-7781', '']
    ],
    columns: ['Issue No', 'Issue Date', 'Production Ref', 'From WH', 'Items', 'Status'],
    rows: [
      ['MI-001', '09-May-2026', 'PP-001', 'Manufacturing Store', '3', 'Posted'],
      ['MI-002', '08-May-2026', 'PP-002', 'Main Kitchen Store', '4', 'Posted']
    ]
  }
);

export const productionEntryConfig = transaction(
  'productionEntry',
  'Production Entry',
  'Record production output with produced, rejected quantities and tentative cost',
  'pi pi-cog',
  [
    { name: 'Production Plan', status: 'Required' },
    { name: 'Material Issue reference', status: 'Ready' },
    { name: 'Finished Goods Warehouse', status: 'Ready' }
  ],
  'Finished goods stock increases. Production cost is captured. Rejected qty goes to QC hold.',
  {
    screenMode: 'Production output entry',
    fields: [
      { key: 'productionNo', label: 'Production Number' },
      { key: 'productionDate', label: 'Production Date', type: 'date' },
      { key: 'planRef', label: 'Production Plan Ref' },
      { key: 'finishedProduct', label: 'Finished Product', type: 'select', options: INVENTORY_OPTIONS.products, addMaster: 'Product / Service' },
      { key: 'producedQty', label: 'Produced Qty', type: 'number' },
      { key: 'rejectedQty', label: 'Rejected Qty', type: 'number' },
      { key: 'productionCost', label: 'Production Cost (Tentative)', type: 'number' },
      { key: 'toWarehouse', label: 'Production Warehouse / Branch', type: 'select', options: INVENTORY_OPTIONS.locations, addMaster: 'Location' },
      { key: 'batchNo', label: 'Batch / Lot No' },
      { key: 'expiryDate', label: 'Expiry Date', type: 'date' },
      { key: 'remarks', label: 'Remarks', type: 'textarea' }
    ],
    lineTitle: 'Production Output Summary',
    lineColumns: ['Finished Product', 'Variant', 'Attribute', 'UOM', 'Planned Qty', 'Produced Qty', 'Rejected Qty', 'Production Cost (Tentative)', 'Batch / Lot No', 'Expiry Date', 'Serial No'],
    lineRows: [
      ['Drone Motor', '', '', 'Nos', '12 Sets', '11 Sets', '1 Set', 'Rs. 1,10,000', '', '', ''],
      ['Paneer Tikka', '', '', 'Plate', '50 Plates', '50 Plates', '0', 'Rs. 7,250', '', '', '']
    ],
    columns: ['Production No', 'Date', 'Finished Product', 'Produced', 'Rejected', 'Cost', 'Status'],
    rows: [
      ['PRD-001', '09-May-2026', 'Drone Motor', '11 Sets', '1 Set', 'Rs. 1,10,000', 'Posted'],
      ['PRD-002', '08-May-2026', 'Paneer Tikka', '50 Plates', '0', 'Rs. 7,250', 'Posted']
    ]
  }
);

export const productionReturnConfig = transaction(
  'productionReturn',
  'Production Return',
  'Return unused raw materials from production back to warehouse',
  'pi pi-step-backward-alt',
  [
    { name: 'Material Issue reference', status: 'Required' },
    { name: 'Warehouse', status: 'Ready' }
  ],
  'Returned materials increase stock back in source warehouse.',
  {
    screenMode: 'Production return entry',
    fields: [
      { key: 'returnNo', label: 'Return Number' },
      { key: 'returnDate', label: 'Return Date', type: 'date' },
      { key: 'issueRef', label: 'Material Issue Ref' },
      { key: 'productionRef', label: 'Production Ref' },
      { key: 'toWarehouse', label: 'Production Warehouse / Branch', type: 'select', options: INVENTORY_OPTIONS.locations, addMaster: 'Location' },
      { key: 'reason', label: 'Return Reason', type: 'select', options: ['Excess Issued', 'Production Cancelled', 'Recipe Changed', 'Quality Rejected'] },
      { key: 'remarks', label: 'Remarks', type: 'textarea' }
    ],
    lineTitle: 'Returned Materials',
    lineColumns: ['Material', 'Variant', 'Attribute', 'Issued Qty', 'Consumed Qty', 'Returned Qty', 'UOM', 'Batch / Serial'],
    lineRows: [
      ['Drone Motor', '', '', '48 Nos', '44 Nos', '4 Nos', 'Nos', 'LOT-DRN-001'],
      ['Battery Pack', '', '', '12 Nos', '11 Nos', '1 Nos', 'Nos', 'NA']
    ],
    columns: ['Return No', 'Return Date', 'Issue Ref', 'To Warehouse', 'Items', 'Status'],
    rows: [
      ['PRET-001', '10-May-2026', 'MI-001', 'Manufacturing Store', '2', 'Posted'],
      ['PRET-002', '09-May-2026', 'MI-002', 'Main Kitchen Store', '1', 'Draft']
    ]
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// CONSUMPTION TRANSACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const materialConsumptionConfig = transaction(
  'materialConsumption',
  'Material Consumption Entry',
  'Record internal material usage by department, project or recipe',
  'pi pi-list-check',
  [
    { name: 'Consumption Type Master', status: 'Required' },
    { name: 'Product Master', status: 'Ready' },
    { name: 'Approval Workflow', status: 'Pending Setup' }
  ],
  'Stock reduces from warehouse. Consumption posted to department or project cost.',
  {
    screenMode: 'Consumption entry',
    fields: [
      { key: 'consumptionNo', label: 'Consumption Number' },
      { key: 'consumptionDate', label: 'Consumption Date', type: 'date' },
      { key: 'department', label: 'Department', type: 'select', options: ['Admin', 'Production', 'Sales', 'Kitchen', 'IT', 'Maintenance', 'Finance', 'Operations'] },
      { key: 'project', label: 'Project / Cost Center' },
      { key: 'consumptionType', label: 'Consumption Type', type: 'select', options: ['Internal Maintenance', 'Production Issue', 'Kitchen Consumption', 'Office Supplies'], addMaster: 'Consumption Type' },
      { key: 'warehouse', label: 'From Warehouse', type: 'select', options: INVENTORY_OPTIONS.locations, addMaster: 'Location' },
      { key: 'approvalStatus', label: 'Approval Status', type: 'select', options: ['Draft', 'Pending Approval', 'Approved', 'Rejected'] },
      { key: 'remarks', label: 'Remarks', type: 'textarea' }
    ],
    lineTitle: 'Consumed Items',
    lineColumns: ['Product', 'UOM', 'Qty', 'Rate', 'Amount', 'Consumption Reason'],
    lineRows: [
      ['LED Display', 'Nos', '2', '24,500', '49,000', 'Conference room setup'],
      ['Basmati Rice', 'KG', '20', '92', '1,840', 'Kitchen daily batch']
    ],
    columns: ['Consumption No', 'Date', 'Department', 'Type', 'Amount', 'Status'],
    rows: [
      ['CON-001', '09-May-2026', 'Admin', 'Internal Maintenance', 'Rs. 49,000', 'Approved'],
      ['CON-002', '08-May-2026', 'Restaurant', 'Kitchen Consumption', 'Rs. 1,840', 'Approved'],
      ['CON-003', '07-May-2026', 'Production', 'Production Issue', 'Rs. 3,82,500', 'Pending Approval']
    ]
  }
);

export const internalIssueSlipConfig = transaction(
  'internalIssueSlip',
  'Internal Issue Slip',
  'Issue materials or items to employees, departments or work areas with approval reference',
  'pi pi-share-alt',
  [
    { name: 'Product Master', status: 'Ready' },
    { name: 'Warehouse Stock', status: 'Required' },
    { name: 'Approval reference', status: 'Pending Setup' }
  ],
  'Item reduces from warehouse. Issue recorded with employee/department for accountability.',
  {
    screenMode: 'Internal issue entry',
    fields: [
      { key: 'issueNo', label: 'Issue Number' },
      { key: 'issueDate', label: 'Issue Date', type: 'date' },
      { key: 'issuedTo', label: 'Issued To', type: 'select', options: INVENTORY_OPTIONS.contactPersons, addMaster: 'Contact Person' },
      { key: 'department', label: 'Department', type: 'select', options: ['Admin', 'Production', 'Sales', 'Kitchen', 'IT', 'Maintenance'] },
      { key: 'fromWarehouse', label: 'From Warehouse', type: 'select', options: INVENTORY_OPTIONS.locations, addMaster: 'Location' },
      { key: 'approvalRef', label: 'Approval Reference' },
      { key: 'expectedReturn', label: 'Expected Return (Returnable)', type: 'date' },
      { key: 'remarks', label: 'Remarks', type: 'textarea' }
    ],
    lineTitle: 'Issued Items',
    lineColumns: ['Product', 'UOM', 'Qty', 'Returnable', 'Purpose'],
    lineRows: [
      ['LED Display', 'Nos', '1', 'No', 'Permanent installation'],
      ['Cable Roll', 'Roll', '2', 'No', 'Network cabling']
    ],
    columns: ['Issue No', 'Issue Date', 'Issued To', 'Department', 'Items', 'Status'],
    rows: [
      ['IIS-001', '09-May-2026', 'Priya Sharma', 'IT', '2', 'Issued'],
      ['IIS-002', '08-May-2026', 'Anil Reddy', 'Maintenance', '1', 'Returned']
    ]
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// LOGISTICS TRANSACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const shipmentEntryConfig = transaction(
  'shipmentEntry',
  'Shipment Entry',
  'Record outbound shipments with vehicle, driver, route and LR number',
  'pi pi-map',
  [
    { name: 'Delivery Challan reference', status: 'Required' },
    { name: 'Vehicle Master', status: 'Ready' },
    { name: 'Transporter Master', status: 'Ready' }
  ],
  'Shipment tracks goods in transit. Delivery confirmation updates SO and invoice status.',
  {
    screenMode: 'Shipment dispatch entry',
    fields: [
      { key: 'shipmentNo', label: 'Shipment Number' },
      { key: 'shipmentDate', label: 'Shipment Date', type: 'date' },
      { key: 'dcReference', label: 'DC Reference', type: 'select', options: [] },
      { key: 'vehicle', label: 'Vehicle', type: 'select', options: ['TS09AB1234', 'KA03CD7788', 'TS10RF4421'], addMaster: 'Vehicle' },
      { key: 'driver', label: 'Driver Name' },
      { key: 'driverMobile', label: 'Driver Mobile' },
      { key: 'transporter', label: 'Transporter', type: 'select', options: ['BuildWell Logistics', 'Fresh Cold Chain', 'Own Fleet'], addMaster: 'Transporter' },
      { key: 'route', label: 'Route' },
      { key: 'lrNo', label: 'LR Number' },
      { key: 'expectedDelivery', label: 'Expected Delivery', type: 'date' },
      { key: 'remarks', label: 'Remarks', type: 'textarea' }
    ],
    lineTitle: 'Shipment Contents',
    lineColumns: ['DC No', 'Customer', 'Product', 'Qty', 'UOM', 'Weight', 'Value'],
    lineRows: [
      ['DC-5001', 'Tenant Works Pvt Ltd', 'LED Display', '6', 'Nos', '42 KG', 'Rs. 1,73,460'],
      ['DC-5002', 'Metro Projects', 'AMC Support', '1', 'Year', 'NA', 'Rs. 3,54,000']
    ],
    columns: ['Shipment No', 'Date', 'Vehicle', 'Transporter', 'DC Ref', 'LR No', 'Status'],
    rows: [
      ['SHP-001', '10-May-2026', 'TS09AB1234', 'BuildWell Logistics', 'DC-5001', 'LR-HYD-001', 'In Transit'],
      ['SHP-002', '09-May-2026', 'KA03CD7788', 'Fresh Cold Chain', 'DC-5002', 'LR-BLR-002', 'Delivered']
    ]
  }
);

export const gatePassConfig = transaction(
  'gatePass',
  'Gate Pass',
  'Authorize inward or outward movement of goods at security gate with vehicle and product details',
  'pi pi-sign-out',
  [
    { name: 'GRN or DC reference', status: 'Required' },
    { name: 'Security approval setup', status: 'Pending Setup' }
  ],
  'Gate pass is the physical security authorization for inward/outward goods movement.',
  {
    screenMode: 'Gate pass entry',
    fields: [
      { key: 'gatePassNo', label: 'Gate Pass Number' },
      { key: 'gatePassDate', label: 'Gate Pass Date', type: 'date' },
      { key: 'gatePassType', label: 'Gate Pass Type', type: 'select', options: ['Inward', 'Outward', 'Returnable Outward', 'Returnable Inward'] },
      { key: 'reference', label: 'Reference (GRN / DC)', type: 'select', options: ['Direct Movement'] },
      { key: 'vehicle', label: 'Vehicle No', type: 'select', options: ['TS09AB1234', 'KA03CD7788', 'TS10RF4421'], addMaster: 'Vehicle' },
      { key: 'driver', label: 'Driver / Person Name' },
      { key: 'securityApproval', label: 'Security Approval By', type: 'select', options: INVENTORY_OPTIONS.contactPersons },
      { key: 'expectedReturnDate', label: 'Expected Return (Returnable)', type: 'date' },
      { key: 'remarks', label: 'Remarks', type: 'textarea' }
    ],
    lineTitle: 'Items Covered',
    lineColumns: ['Product', 'Qty', 'UOM', 'Purpose'],
    lineRows: [
      ['LED Display', '6', 'Nos', 'Customer Delivery'],
      ['Drone Motor', '12', 'Set', 'Purchase Inward']
    ],
    columns: ['Gate Pass No', 'Date', 'Type', 'Vehicle', 'Reference', 'Security By', 'Status'],
    rows: [
      ['GP-001', '10-May-2026', 'Outward', 'TS09AB1234', 'DC-5001', 'Rajesh Kumar', 'Approved'],
      ['GP-002', '08-May-2026', 'Inward', 'KA03CD7788', 'GRN-1042', 'Rajesh Kumar', 'Completed']
    ]
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// FINANCIAL INTEGRATION TRANSACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const debitNoteConfig = transaction(
  'debitNote',
  'Debit Note',
  'Settle purchase returns or raise a vendor debit adjustment without moving stock',
  'pi pi-minus-circle',
  [
    { name: 'Vendor Master', status: 'Ready' },
    { name: 'Purchase Return or price adjustment reference', status: 'Required' }
  ],
  'Debit note is the financial settlement document for Purchase Return or direct vendor adjustment. It does not move stock; later Accounts posting should use this note as the payable reduction / vendor debit source.',
  {
    screenMode: 'Debit note settlement',
    fields: [
      { key: 'debitNoteNo', label: 'Debit Note Number' },
      { key: 'debitNoteDate', label: 'Debit Note Date', type: 'date' },
      { key: 'vendor', label: 'Party / Vendor', type: 'select', options: INVENTORY_OPTIONS.suppliers, addMaster: 'Vendor' },
      { key: 'reference', label: 'Settlement Reference', type: 'select', options: ['Direct Debit Note'] },
      { key: 'reason', label: 'Reason', type: 'select', options: ['Purchase Return Settlement', 'Price Difference', 'Short Supply', 'Quality Deduction', 'Freight Overcharge', 'Direct Vendor Adjustment'] },
      { key: 'gstAdjustment', label: 'GST Adjustment', type: 'select', options: ['Yes', 'No'] },
      { key: 'remarks', label: 'Remarks', type: 'textarea' }
    ],
    lineTitle: 'Settlement / Adjustment Lines',
    lineColumns: ['Description', 'Reference', 'Amount', 'GST %', 'GST Amount', 'Total Amount'],
    lineRows: [
      ['Purchase Return - LED Display', 'GRN-1042', '24,500', '18%', '4,410', '28,910'],
      ['Price Difference Adjustment', 'PO-0998', '12,000', '18%', '2,160', '14,160']
    ],
    columns: ['Debit Note No', 'Date', 'Vendor', 'Reference', 'Amount', 'Status'],
    rows: [
      ['DN-001', '09-May-2026', 'ElectroMart Supplies', 'PR-RET-001', 'Rs. 28,910', 'Posted'],
      ['DN-002', '08-May-2026', 'Aero Labs', 'PR-RET-002', 'Rs. 17,000', 'Draft']
    ]
  }
);

export const creditNoteConfig = transaction(
  'creditNote',
  'Credit Note',
  'Settle sales returns or raise a customer credit adjustment without moving stock',
  'pi pi-plus-circle',
  [
    { name: 'Customer Master', status: 'Ready' },
    { name: 'Sales Return or invoice reference', status: 'Required' }
  ],
  'Credit note is the financial settlement document for Sales Return or direct customer adjustment. It does not move stock; later Accounts posting should use this note as the receivable reduction / customer credit source.',
  {
    screenMode: 'Credit note settlement',
    fields: [
      { key: 'creditNoteNo', label: 'Credit Note Number' },
      { key: 'creditNoteDate', label: 'Credit Note Date', type: 'date' },
      { key: 'customer', label: 'Party / Customer', type: 'select', options: INVENTORY_OPTIONS.customers, addMaster: 'Customer' },
      { key: 'reference', label: 'Settlement Reference', type: 'select', options: ['Direct Credit Note'] },
      { key: 'reason', label: 'Reason', type: 'select', options: ['Sales Return Settlement', 'Price Correction', 'Discount Adjustment', 'Goodwill Credit', 'Short Delivery', 'Direct Customer Adjustment'] },
      { key: 'gstAdjustment', label: 'GST Adjustment', type: 'select', options: ['Yes', 'No'] },
      { key: 'remarks', label: 'Remarks', type: 'textarea' }
    ],
    lineTitle: 'Settlement / Adjustment Lines',
    lineColumns: ['Description', 'Reference', 'Amount', 'GST %', 'GST Amount', 'Total Amount'],
    lineRows: [
      ['Sales Return - LED Display', 'INV-6001', '24,500', '18%', '4,410', '28,910'],
      ['Price Correction - AMC', 'INV-6002', '10,000', '18%', '1,800', '11,800']
    ],
    columns: ['Credit Note No', 'Date', 'Customer', 'Reference', 'Amount', 'Status'],
    rows: [
      ['CN-001', '11-May-2026', 'Tenant Works Pvt Ltd', 'SR-RET-001', 'Rs. 28,910', 'Posted'],
      ['CN-002', '10-May-2026', 'Metro Projects', 'SR-RET-002', 'Rs. 11,800', 'Draft']
    ]
  }
);
