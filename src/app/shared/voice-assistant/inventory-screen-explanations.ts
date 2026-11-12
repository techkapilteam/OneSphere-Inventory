// Spoken explanations for every Inventory screen. Used by the voice assistant:
// saying just the screen name (e.g. "goods receipt", "kap bom master") explains
// it; "open <screen>" still navigates. Identical copy lives in the Inventory app
// (src/app/shared/voice-assistant/) — keep both in sync when editing.

export const INVENTORY_SCREEN_EXPLANATIONS: Record<string, string> = {

  // ── Dashboard / Configuration ──────────────────────────────────────────────
  'inventory dashboard':
    'Inventory Dashboard is a live summary of the business built from real data. ' +
    'It shows stock value, out of stock items, pending purchase and sales orders, pending dispatch, payables and receivables with ageing, ' +
    'and period totals for purchases, sales and returns. Click any card to drill down into the documents behind the number.',

  'business segments':
    'Business Segments, also called Segment-wise Configuration, defines the business lines the company runs, such as Electronics, Agro Product, IT Services or Hotel and Restaurant. ' +
    'For each segment you map the product categories it uses. The selected segment then filters every master, transaction and report screen.',

  'branch store setup':
    'Branch or Store Setup holds each branch or store with its code, name, GSTIN, PAN, contact person, mobile, email, address and default warehouse. ' +
    'Branches are used in warehouse setup, every transaction, access control and branch-wise reporting.',

  'warehouse setup':
    'Warehouse Setup creates the warehouses, stores, project yards and service locations where stock is kept. ' +
    'You enter the location name, code, address, capacity and status. Every receipt, issue, transfer and stock report is recorded against a warehouse.',

  'uom master':
    'UOM Master defines units of measure such as Nos, KG, Bag, Box and Litre, with a code, symbol and whether decimals are allowed. ' +
    'Product Master uses these units for base, purchase and sale UOM, and every transaction quantity uses them.',

  'tax classification master':
    'Tax Classification Master defines HSN codes for goods and SAC codes for services with their GST rate, split into CGST, SGST and IGST, plus cess and effective date. ' +
    'Each code is mapped to a product category, so when that category is selected in Product Master the HSN and GST fill automatically.',

  'hsn sac tax code import':
    'HSN SAC Tax Code Import uploads the official GST or CBIC rate file in CSV or Excel. ' +
    'The imported codes are used as suggestions when choosing HSN or SAC in products. Always verify the classification before filing GST.',

  'approval workflow master':
    'Approval Workflow Master defines who must approve a document, such as a purchase requisition or purchase order, the approval levels and escalation. ' +
    'A wrong mapping can block documents or send them to the wrong approver.',

  'payment terms master':
    'Payment Terms Master defines credit days and any early payment discount, like Immediate, 15 Days or 30 Days. ' +
    'Terms are picked on vendors, customers and documents and drive due dates and ageing.',

  // ── Product masters ────────────────────────────────────────────────────────
  'product service master':
    'Product or Service Master is the main item master. For each product you set the business segment, name, category, group, brand, product nature, base UOM and purchase and sale UOM, ' +
    'HSN or SAC with GST, serial or batch tracking, and stock controls like minimum, maximum and reorder level. Every purchase, sale and stock transaction picks items from here.',

  'category master':
    'Category Master groups products into categories such as Computers, Raw Ingredients or Beverages under a business segment. ' +
    'The category drives HSN and GST auto-fill in Product Master, default serial or batch policy, and category-wise reports.',

  'product group master':
    'Product Group Master creates groups below a category, for example Mobile Devices under Mobile and Accessories. ' +
    'Groups are used in Product Master, product search, stock summaries and MIS reports.',

  'brand master':
    'Brand Master stores the brands or manufacturers of products, like Dell or Samsung. ' +
    'The brand is selected in Product Master and is used for filtering and brand-wise reports.',

  'attribute master':
    'Attribute Master defines product attributes such as Colour, Size or Capacity and their allowed values. ' +
    'Attributes are combined in Variant Master to create product variants.',

  'variant master':
    'Variant Master creates variants of a product by combining attribute values, for example a T-shirt in Red, Size M. ' +
    'Each variant can then be bought, sold and stocked separately.',

  'product nature master':
    'Product Nature Master defines the nature of an item, such as Raw Material, Semi-Finished, Finished Goods, Consumable, Service or Fixed Asset, with flags for purchase, sale and tracking. ' +
    'The nature controls where an item can be used; for example only raw material or semi-finished items can be issued to production.',

  'policy master':
    'Policy Master holds inventory policies such as serial or batch tracking rules that apply to categories and products.',

  'batch lot policy master':
    'Batch or Lot Policy Master defines how batch or lot numbers are captured, including expiry and manufacturing date rules. ' +
    'Products under this policy must have a batch entered on GRN, sale and stock movement, which gives traceability and expiry control.',

  'barcode configuration':
    'Barcode Configuration sets barcode rules per product category: the barcode type such as Code 128 or QR, auto generation, prefix, starting number and length. ' +
    'Barcodes are used for labels, inward scanning, POS billing and stock verification.',

  'substitute products':
    'Substitute Products maps alternate products that can be offered when the main product is not available, with a priority. ' +
    'It helps sales, purchase and stock issue teams pick an approved alternative.',

  'price list master':
    'Price List Master defines selling rates for products, such as a Retail, Dealer or Corporate price list. ' +
    'When a price list is linked to a customer, the rate fills automatically on sales documents and POS.',

  'bom master':
    'BOM Master, the Bill of Materials, lists the raw materials and quantities needed to make one unit of a finished or semi-finished product, with a version. ' +
    'Production Planning and Material Issue use the BOM to work out raw material requirements. A wrong BOM quantity consumes wrong stock and distorts cost.',

  'work center master':
    'Work Center Master defines the production work centers or machines with their capacity and hourly cost. ' +
    'It is used in production planning and manufacturing costing.',

  'consumption type master':
    'Consumption Type Master defines the reasons or types for internal material consumption, such as department use or project use, and the approval workflow for each.',

  // ── Party masters ──────────────────────────────────────────────────────────
  'vendor master':
    'Vendor Master holds suppliers and service vendors. Select or create the vendor from Global Contact; mobile, email, GSTIN, PAN and address fill from the contact. ' +
    'You also set payment terms, credit limit and bank details. Vendors are used in purchase requisition, purchase order, GRN, purchase invoice and vendor payment.',

  'customer master':
    'Customer Master holds customers, tenants, buyers and clients with GSTIN, PAN, contact details, billing and shipping address, payment terms, credit limit and price list. ' +
    'Customers are used in estimation, quotation, sales order, sales invoice, POS and customer receipt.',

  'channel partner master':
    'Channel Partner Master holds referral partners, brokers and channel partners. ' +
    'Partners are used in sales order, sales invoice and delivery challan, and for partner-wise sales reports.',

  'vehicle master':
    'Vehicle Master stores own and hired vehicles with vehicle number, type, owner, branch, capacity, driver, permit and insurance expiry. ' +
    'Vehicles are selected in GRN, dispatch, gate pass, shipment and stock transfer.',

  'transporter master':
    'Transporter Master stores the transport companies used for shipping goods, with their GSTIN and contact details. ' +
    'Transporters are selected on delivery challan, shipment entry and e-way details.',

  // ── Opening ────────────────────────────────────────────────────────────────
  'opening inventory balance':
    'Opening Inventory Balance captures the stock already on hand, warehouse or branch wise, before going live: product, batch, serial, quantity, rate and opening date. ' +
    'It seeds the stock ledger, valuation and availability reports.',

  'opening stock entry':
    'Opening Stock Entry records the opening quantity and value of items in each warehouse before live transactions start. ' +
    'It appears as the brought forward balance in Stock Ledger.',

  // ── Purchase cycle ─────────────────────────────────────────────────────────
  'purchase requisition':
    'Purchase Requisition is an internal request from a branch or department to buy items. ' +
    'You enter the branch, requested by, required date and item rows with quantity. After approval, the requisition is converted into a Request for Quotation or Purchase Order.',

  'request for quotation':
    'Request for Quotation, or RFQ, is sent to one or more vendors to get their prices for the required items. ' +
    'You compare vendor quotes and raise the Purchase Order with the best one.',

  'purchase order':
    'Purchase Order is the formal order placed on a vendor for goods or services, with quantity, rate, tax, delivery date and payment terms. ' +
    'Goods are then received against it in GRN, and the vendor bill is entered in Purchase Invoice.',

  'goods receipt note':
    'Goods Receipt Note, or GRN, records goods physically received from a vendor, against a purchase order or directly. ' +
    'You enter received, accepted and rejected quantities with batch or serial numbers. Saving the GRN increases stock in the selected warehouse.',

  'purchase invoice':
    'Purchase Invoice records the vendor bill, against a GRN or as a direct purchase. ' +
    'It captures the vendor invoice number, items, rates, GST and transport charges, posts the purchase to accounts and creates the payable that Vendor Payment settles.',

  'purchase return':
    'Purchase Return records goods sent back to a vendor against a posted Purchase Invoice. ' +
    'Posting it reduces stock in the warehouse and automatically raises a Debit Note for the returned value.',

  'vendor payment':
    'Vendor Payment settles what you owe a vendor. Select the vendor, tick the Purchase Invoices being paid, and optionally apply a Debit Note to reduce the amount. ' +
    'You can split the payment across Cash, UPI, Card, Cheque, NEFT or IMPS and deduct TDS before posting.',

  'debit note':
    'A Debit Note reduces the amount you owe a vendor. It is created automatically when a Purchase Return is posted and can be applied in Vendor Payment. ' +
    'It can also be raised manually as a vendor adjustment without moving stock.',

  // ── Sales cycle ────────────────────────────────────────────────────────────
  'sales enquiry':
    'Sales Enquiry captures a customer requirement: customer, items, quantity and expected delivery. ' +
    'It is the starting point of the sales cycle and is converted into a Sales Quotation.',

  'sales quotation':
    'Sales Quotation is the formal price offer sent to a customer with rates, taxes and a validity period. ' +
    'Once the customer accepts, it is converted into a Sales Order.',

  'estimation':
    'Estimation prepares a quotation or cost estimate for goods, services, space or units for a customer. ' +
    'It can later be converted into a proforma invoice or sales order.',

  'proforma invoice':
    'Proforma Invoice is a pre-sale invoice sent to the customer before final billing, usually to collect an advance. ' +
    'It does not affect stock or accounts and can be converted into a Sales Invoice.',

  'sales order':
    'Sales Order confirms a customer order with items, quantity, rate, delivery terms, warehouse and payment schedule. ' +
    'Goods are dispatched against it with a Delivery Challan and billed with a Sales Invoice.',

  'delivery challan':
    'Delivery Challan, or DC, is issued when goods are dispatched to a customer, against a sales order or directly. ' +
    'It reduces stock from the warehouse and is later billed in Sales Invoice.',

  'sales invoice':
    'Sales Invoice is the tax invoice raised to the customer for goods, services, space or units. ' +
    'It captures customer, delivery address, items, rate, discount and GST, rounds off to whole rupees, reduces stock, posts the sale to accounts and creates the receivable.',

  'pos counter billing':
    'POS or Counter Billing is quick billing at a counter for walk-in customers. ' +
    'Scan or search products, enter quantity, and take payment by cash, UPI or card. Stock reduces immediately.',

  'sales return':
    'Sales Return records goods received back from a customer against a Sales Invoice. ' +
    'Posting it increases stock back in the warehouse and automatically raises a Credit Note for the returned value.',

  'customer receipt':
    'Customer Receipt records money received from a customer against their Sales Invoices. ' +
    'Select the customer, tick the invoices being settled, optionally apply a Credit Note, and split the receipt across Cash, UPI, Cheque, NEFT or IMPS before posting.',

  'credit note':
    'A Credit Note reduces the amount a customer owes you. It is created automatically when a Sales Return is posted and can be applied in Customer Receipt. ' +
    'It can also be raised manually as a customer adjustment without moving stock.',

  'identifier registration':
    'Identifier Registration records per-unit identifiers that a category needs before sale, such as UIN or RTO number. ' +
    'A unit whose mandatory registration is missing cannot be sold.',

  // ── Stock movement ─────────────────────────────────────────────────────────
  'stock transfer':
    'Stock Transfer moves stock from one branch or warehouse to another. ' +
    'Select the source and destination, add products and quantities, and save. Stock reduces at the source and is received at the destination.',

  'stock adjustment':
    'Stock or Availability Adjustment corrects system stock to match physical stock, for example after damage, loss or count difference. ' +
    'Positive quantity adds stock and negative quantity reduces it, with a reason.',

  'cycle count':
    'Cycle Count or Physical Verification is used to count stock physically in a warehouse and compare it with the system quantity. ' +
    'Differences are reconciled through a stock adjustment.',

  'internal issue slip':
    'Internal Issue Slip issues materials or items to employees, departments or work areas with an approval reference. ' +
    'Stock reduces from the issuing warehouse.',

  'material consumption entry':
    'Material Consumption Entry records internal usage of materials by a department, project or recipe, based on the consumption type. ' +
    'It reduces stock and charges the consumption to that department or project.',

  'gate pass':
    'Gate Pass authorises goods moving in or out through the security gate, with vehicle, driver and product details. ' +
    'It gives security a record of every movement.',

  'shipment entry':
    'Shipment Entry records outbound shipments with vehicle, driver, transporter, route and LR number, so dispatches can be tracked to delivery.',

  // ── Production ─────────────────────────────────────────────────────────────
  'production planning':
    'Production Planning plans a production run: the finished product, quantity, BOM version and dates. ' +
    'It works out the raw materials required from the BOM, and material is then issued against the plan.',

  'material issue for production':
    'Material Issue for Production issues raw materials from the warehouse to the production work center against a production plan. ' +
    'Stock of raw materials reduces and their cost becomes the cost of production.',

  'production entry':
    'Production Entry records the output of production: produced and rejected quantities of the finished product. ' +
    'Finished goods stock increases, and the cost comes from the material issued.',

  'production return':
    'Production Return sends unused raw materials from production back to the warehouse, increasing their stock again.',

  // ── Reports ────────────────────────────────────────────────────────────────
  'stock availability report':
    'Stock or Availability Report shows the current available stock, seats, services or units by segment, warehouse, category and product as on a date.',

  'stock ledger':
    'Stock Ledger shows every inward and outward movement of a product, such as GRN, sales, transfers and adjustments, with the opening balance, running balance and value, ' +
    'including the vendor or customer of each movement.',

  'segment wise summary':
    'Segment-wise Summary compares inventory value and availability across business segments.',

  'hsn sac mapping report':
    'HSN SAC Mapping Report lists products and services with their HSN or SAC code and GST rate, to check tax mapping before filing GST.'
};

// Spoken short forms → canonical key above.
export const INVENTORY_SCREEN_ALIASES: Record<string, string> = {
  'grn': 'goods receipt note',
  'goods receipt': 'goods receipt note',
  'goods received note': 'goods receipt note',
  'rfq': 'request for quotation',
  'po': 'purchase order',
  'pr': 'purchase requisition',
  'pi': 'purchase invoice',
  'si': 'sales invoice',
  'so': 'sales order',
  'dc': 'delivery challan',
  'pos': 'pos counter billing',
  'pos billing': 'pos counter billing',
  'counter billing': 'pos counter billing',
  'bom': 'bom master',
  'bill of materials': 'bom master',
  'bill of material': 'bom master',
  'uom': 'uom master',
  'unit of measure': 'uom master',
  'hsn master': 'tax classification master',
  'hsn sac mapping': 'tax classification master',
  'tax code import': 'hsn sac tax code import',
  'product master': 'product service master',
  'service master': 'product service master',
  'item master': 'product service master',
  'product group': 'product group master',
  'category': 'category master',
  'brand': 'brand master',
  'attribute': 'attribute master',
  'variant': 'variant master',
  'product nature': 'product nature master',
  'batch policy': 'batch lot policy master',
  'lot policy': 'batch lot policy master',
  'barcode': 'barcode configuration',
  'substitute product': 'substitute products',
  'price list': 'price list master',
  'work center': 'work center master',
  'consumption type': 'consumption type master',
  'vendor': 'vendor master',
  'supplier master': 'vendor master',
  'customer': 'customer master',
  'channel partner': 'channel partner master',
  'vehicle': 'vehicle master',
  'transporter': 'transporter master',
  'branch setup': 'branch store setup',
  'store setup': 'branch store setup',
  'branch master': 'branch store setup',
  'warehouse': 'warehouse setup',
  'warehouse master': 'warehouse setup',
  'business segment': 'business segments',
  'segment configuration': 'business segments',
  'segment wise configuration': 'business segments',
  'approval workflow': 'approval workflow master',
  'payment terms': 'payment terms master',
  'opening stock': 'opening stock entry',
  'opening inventory': 'opening inventory balance',
  'opening balance inventory': 'opening inventory balance',
  'stock availability': 'stock availability report',
  'availability report': 'stock availability report',
  'availability adjustment': 'stock adjustment',
  'physical verification': 'cycle count',
  'issue slip': 'internal issue slip',
  'material consumption': 'material consumption entry',
  'shipment': 'shipment entry',
  'material issue': 'material issue for production',
  'segment summary': 'segment wise summary',
  'hsn report': 'hsn sac mapping report',
  'hsn sac report': 'hsn sac mapping report',
  'uin registration': 'identifier registration',
  'quotation': 'sales quotation',
  'enquiry': 'sales enquiry'
};
