# Inventory Module — Complete User Flow

**Purpose:** a single, accurate walkthrough of the Inventory module as it actually works
today — for a developer picking this up for the first time, or a user learning the system
end to end. Built by reading the live code (menu config, routes, and the backend it calls),
not from older design docs. Where this doc disagrees with an older phase document in this
`docs/` folder, trust this one — it's dated 2026-09-24.

For "which screen calls which stored procedure," see the companion doc:
`GLOBAL_ACCOUNTS_LATEST/Kapil_Group_ERP_API/Docs/inventory-controllers-to-schema-mapping.md`.

---

## 1. How the module is organized

The sidebar has five sections: **Dashboard**, **Configuration**, **Masters**, **Transactions**,
**Reports**. Every screen (except a handful of bespoke ones noted below) is built from one
shared component — you'll see this in the code as a small class that just points at a config
object and extends a shared "screen shell." That shell handles the list view, the add/edit
form, save, and — for document screens — the draft → posted lifecycle.

**A note on reachability.** Not every screen that's built and working is actually clickable
in the menu today. Three different states exist, and this doc calls them out explicitly for
every screen because the difference matters for a handover:

- **Live** — in the menu, has a real backend, works end to end.
- **Wired but hidden** — has a real, working backend, but the menu currently greys it out
  (`disabled: true` in the nav config). A user cannot click into it, even though it works.
  This looks like an oversight left over from a rollout, not an intentional limitation — flag
  it to whoever owns the product roadmap rather than assuming it's fine.
- **Dead** — a config and a full component exist in the source code, but there's no route
  and no menu entry at all. Not reachable by any means short of adding a route.

---

## 2. Setup, before any transaction can happen

A new company can't process a single document until this is done, roughly in this order:

1. **Business Segments** (Configuration) — defines the segment(s) this company operates in
   (e.g. electronics, agro, real estate, hotel). Segments drive numbering series and some
   report groupings. Bespoke screen (not the generic shell), real backend.
2. **Branch / Store Setup** (Configuration) — the physical locations. Bespoke screen; also
   the one config screen that reads `AccessControlService`/`SubscriptionService` and tenant
   context, since branch access ties into licensing.
3. **Warehouse Setup** (Configuration) — warehouses and their storage locations, scoped to a
   branch. Bespoke screen, real backend.
4. **HSN/SAC Tax Code Import** (Configuration) — bulk-loads the tax code master used by
   Product Master and GST calculation everywhere downstream.
5. **Masters**, roughly in dependency order: UOM → Item Type → Product Nature (Type) →
   Category → Brand → Attribute/Variant → Product/Service Master. Product Master depends on
   nearly everything before it (UOM, category, HSN/SAC, tax classification), so it's built
   last, not first.
6. **Party masters**: Vendor Master, Customer Master, Channel Partner Master, Payment Terms
   Master — independent of the product chain, needed before any purchase or sales document.

Everything above is **Live** (menu-visible, real backend) except HSN/SAC import, which is a
bespoke screen with its own service rather than the generic shell — same real backend either
way.

---

## 3. The procurement flow (buying)

```
Purchase Requisition → Request for Quotation → Purchase Order → Goods Receipt (GRN)
        → Purchase Invoice → Vendor Payment
                     ↓ (goods sent back)
              Purchase Return → Debit Note → applied in Vendor Payment
```

- **Purchase Requisition, RFQ, Purchase Order** — internal demand → vendor quote comparison →
  the actual order sent to a vendor. All three are **wired but currently hidden** in the
  menu (real backend, `disabled: true`). A user today has to skip straight to GRN or Purchase
  Invoice without going through this chain in the UI.
- **Goods Receipt (GRN)** — records goods physically received against a PO. **Live.**
- **Purchase Invoice** — the vendor's bill. Can be created standalone or against a GRN. When
  posted (`status = posted`), it triggers the actual accounting entry
  (`accounts.sp_post_purchase_invoice`) and updates stock cost layers (FIFO/LIFO/Weighted-Avg,
  whichever the item's costing method is). **Live**, and the single busiest screen in the
  module — see §7 for known caveats specific to posting.
- **Purchase Return** — goods sent back to the vendor against an existing PI/GRN. Posting it
  reduces warehouse stock and automatically raises a **Debit Note**. **Live.**
- **Debit Note** — reduces what you owe the vendor; created automatically from a posted
  Purchase Return, or manually. Applied later in Vendor Payment. **Live.**
- **Vendor Payment** — settles outstanding Purchase Invoices for a vendor, optionally
  applying a Debit Note, split across Cash/UPI/Card/Cheque/NEFT/IMPS, with TDS deduction if
  applicable. This is a **bespoke component** (`PaymentReceiptVoucherComponent`, shared with
  Customer Receipt), not the generic shell — it has its own service
  (`inventory.sp_get/save_payment_voucher` + `accounts.sp_post_payment_voucher`). **Live.**

---

## 4. The sales flow (selling)

```
Sales Enquiry → Sales Quotation → Sales Order → Delivery Challan → Sales Invoice
                                                       → Customer Receipt
                     ↓ (goods received back)
              Sales Return → Credit Note → applied in Customer Receipt
```

- **Sales Enquiry** — **dead in the current build**: consistently unwired and disabled, not
  a real path today.
- **Sales Quotation** — **wired but currently hidden** in the menu (real backend, disabled).
- **Sales Order** — the confirmed order from a customer. **Live.**
- **Delivery Challan (DC)** — goods physically shipped, ahead of invoicing (or standalone for
  non-invoiced movements). Can be closed once fully invoiced. **Live.**
- **Sales Invoice** — the bill to the customer, against a DC/SO or standalone. Posting it
  books revenue and COGS (`accounts.sp_post_sales_invoice`) and relieves stock. **Live** —
  same "busiest screen, most edge cases" status as Purchase Invoice.
- **Sales Return** — goods received back from a customer against an existing SI. Posting it
  increases warehouse stock and automatically raises a **Credit Note**. **Live.**
- **Credit Note** — reduces what the customer owes; auto-created from a posted Sales Return,
  or manual. Applied in Customer Receipt. **Live.**
- **Customer Receipt** — settles outstanding Sales Invoices, optionally applying a Credit
  Note, split across payment modes. Same bespoke component as Vendor Payment. **Live.**

**Estimation, Proforma Invoice, and POS Billing** have full backend endpoints and complete
frontend components but **no route and no menu entry at all** — dead code today, not a
"hidden" feature. If a future task is to bring these online, the backend work is already
done; it's a routing + navigation task only.

---

## 5. Stock operations (not tied to a buy/sell document)

- **Stock Transfer** — moves stock between warehouses/branches. Posting books the movement
  through the same FIFO/LIFO/Weighted-Avg cost-layer engine as Purchase/Sales. **Live.**
- **Stock Adjustment** — corrects stock counts (damage, shrinkage, found stock). Note: its
  posting trigger is `pending_approval → approved`, not the `draft → posted` pattern every
  other transaction uses — don't assume the generic status logic applies here. **Live.**
- **Opening Stock Entry** — the starting stock balance when a company/warehouse goes live,
  posted into the real stock ledger and cost layers. **Live.** Do not confuse with:
- **Opening Inventory Balance** (a *master*, not a transaction) — this is the one screen in
  the entire module that is genuinely mock/localStorage-only. No backend, not in the menu,
  reachable only by typing its URL directly. If someone asks "why didn't my opening balance
  save," check whether they mean this screen by mistake.
- **Cycle Count** — periodic physical stock count reconciliation. **Wired but currently
  hidden** in the menu — real backend, disabled.

---

## 6. Manufacturing

```
BOM Master → Production Planning → Material Issue for Production
                → Production Entry → Production Return (if needed)
```

- **BOM Master, Work Center Master, Price List Master** — as of migration 219 these have real
  backend tables. (If you've read an older note saying these are browser-only/mock, that's
  out of date — corrected here.)
- **Production Planning, Material Issue for Production, Production Entry, Production
  Return** — all **Live**, and specifically force-enabled in the navigation code even when a
  disabled flag would otherwise apply, so these four are reliably reachable.
- **Material Consumption, Internal Issue Slip** — consistently disabled and unwired; not a
  working path today.

---

## 7. Reports and the Dashboard

- **Inventory Summary Dashboard** — a genuinely live, real-data dashboard: Stock Value, Out
  of Stock count, pending PO/SO, pending Dispatch, Payables/Receivables with ageing, Paid vs
  Received, and period totals, each card clickable to drill into the underlying documents.
  Today/Week/Month/Quarter toggle changes the period. **Live**, and the landing page.
- **The Reports menu** — 15 reports (Stock Summary, Stock Ledger, Warehouse-wise Stock,
  Purchase/Sales/GRN/DC registers, HSN/SAC Summary, Batch/Serial/Expiry, Product
  Profitability, Low Stock Alert, Pending Document, Audit Trail). Every one of them has a
  real, working backend behind a shared report-page component — but **the entire Reports
  menu is currently marked disabled**, so none of them are clickable from the sidebar despite
  working correctly. This is the single biggest "hidden but working" gap in the module.
- **Stock Valuation Comparison** and **MIS Report** (admin-only) — real, working, but not in
  the sidebar at all; reachable only via direct URL.

---

## 8. Known caveats worth knowing before you touch Purchase/Sales Invoice posting

- Posting a document (PI, SI, Stock Transfer, Production Entry/Return, Purchase/Sales
  Return) runs inside one database transaction that saves the document *and* calls the
  matching `accounts.sp_post_*`/`sp_reverse_*` procedure — see the mapping doc for exact
  names. A normal validation failure returns a proper error message to the user. If a save
  ever fails with a generic "Cannot connect to the server" instead of a real error message,
  that specifically means the connection itself died mid-request (a hang or a fatal DB
  error) — not a validation problem — and is worth escalating rather than retried blindly.
- Purchase Invoice, Sales Invoice, and several other transactions can carry optional
  **Transport/Gate Pass Details** (vehicle, driver, weighment) — saved through a *separate*
  endpoint (`transport-details`) fired right after the main document saves. Its response is
  just the transport record, not the parent document — if you're debugging a save/post flow
  and see a response that only has vehicle fields in it, that's this side-call, not the main
  document's response.

---

## 9. Full screen reference

| Section | Screen | Status | Notes |
|---|---|---|---|
| Dashboard | Inventory Summary Dashboard | Live | Landing page |
| Configuration | Business Segments | Live | Bespoke component |
| Configuration | Warehouse Setup | Live | Bespoke component |
| Configuration | Branch / Store Setup | Live | Bespoke; reads AccessControl/Subscription context |
| Configuration | HSN/SAC Tax Code Import | Live | Bespoke, own service |
| Masters | Product Master, Product Nature, Category, Brand, Variant, Attribute, UOM, Tax Classification, Barcode Config, Serial Number Policy, Batch/Lot Policy | Live | Generic shell |
| Masters | Vendor, Customer, Channel Partner, Payment Terms, Price List | Live | Price List gained real backend in migration 219 |
| Masters | BOM, Work Center | Live | Gained real backend in migration 219 |
| Masters | Consumption Type | Wired, hidden | Real backend, disabled in menu |
| Masters | Approval Workflow, Transporter, Vehicle | Dead / not built | Disabled and unwired |
| Masters | Product Group | Orphaned | Real, working, but no menu entry — direct URL only |
| Masters | Opening Inventory Balance | Mock only | The one true mock screen; no menu entry |
| Masters | Substitute Products | Unreachable | Folded into Product Master via redirect |
| Transactions | Vendor Payment, Customer Receipt | Live | Bespoke shared component |
| Transactions | Purchase Requisition, RFQ, Purchase Order | Wired, hidden | Real backend, disabled in menu |
| Transactions | GRN, Purchase Invoice, Purchase Return, Debit Note | Live | |
| Transactions | Sales Enquiry | Dead | Disabled and unwired |
| Transactions | Sales Quotation | Wired, hidden | Real backend, disabled in menu |
| Transactions | Sales Order, Delivery Challan, Sales Invoice, Sales Return, Credit Note | Live | |
| Transactions | Stock Transfer, Opening Stock Entry | Live | |
| Transactions | Stock Adjustment | Live | Posts via pending_approval→approved, not draft→posted |
| Transactions | Cycle Count | Wired, hidden | Real backend, disabled in menu |
| Transactions | Production Planning, Material Issue, Production Entry, Production Return | Live | Force-enabled regardless of disabled flag |
| Transactions | Material Consumption, Internal Issue Slip, Shipment Entry, Gate Pass | Dead | Disabled and unwired |
| Transactions | Estimation, Proforma Invoice, POS Billing | Dead | No route, no menu entry at all |
| Reports | All 15 reports + Stock Valuation Comparison + MIS Report | Wired, hidden | Real backend; entire Reports menu disabled; last 2 also have no sidebar entry |

---

*Companion docs: `inventory-controllers-to-schema-mapping.md` (endpoint → stored procedure →
schema folder), `business-architecture.md` and `technical-architecture.md` in this same
folder (earlier, higher-level snapshots — this doc supersedes them for anything about current
screen reachability).*
