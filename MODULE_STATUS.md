# Module Status

Legend: - 🟩 Complete - 🟨 In Progress - ⬜ Not Started

## Dashboard

🟩 Dashboard — KPI cards, Low Stock, and Recent Activity wired to
live Supabase queries (Phase 17). Quick Actions remain static links.

## Management

*Sidebar group as of D031 (2026-07-06 nav restructure) — master-data
screens formerly split across Inventory/Orders, now consolidated.*

🟩 Customer (`/dashboard/management/customers`) — profile + linked-sources
(Loyverse/Facebook/Instagram/manual) + order history (orders ∪ receipts),
manual walk-in creation. Facebook/Instagram are schema-ready
(`customer_sources.source`) but unbuilt — "Link Facebook" is a disabled
stub. See `PROGRESS-CUSTOMERS.md` (CUST-0..4) and D022/D023 in
`DECISIONS.md`.
🟩 Supplier (`/dashboard/management/suppliers`)
🟩 Item List (`/dashboard/management/items`) — full Loyverse-parity
Add/Edit (variant matrix, composite components, modifier assignment,
minimum stock threshold), archive, activity logging, ERP→Loyverse
push-sync via n8n. See `PROGRESS-ITEMS.md` (ITEM-0..7) and D020/D021 in
`DECISIONS.md`.
🟩 Item Category (`/dashboard/management/item-categories`) — full CRUD
(name, `category_type` Product/Packaging, color), admin/manager/encoder
write, admin/manager delete; archive not hard-delete. Source badge shows
Loyverse-synced vs. ERP-only; Loyverse pull-sync can still overwrite a
ERP edit on that category's next sync (accepted risk). Lets Master Items
be tagged Packaging for the shipment packaging picker. See
`PROGRESS-PRODUCTION-SHIPPING.md` PS-1 and `PROGRESS-MANAGEMENT.md`
MGMT-2.
🟩 Product Modifier (`/dashboard/management/product-modifiers`) — full
CRUD, options edited as inline repeatable rows (name + price) matching
the Items variant-matrix UX; same write/delete roles and archive
convention as Item Category. See `PROGRESS-MANAGEMENT.md` MGMT-3.
🟩 Couriers (`/dashboard/management/couriers`) — admin-only CRUD,
populates the courier picker in Order Detail's Ship Order dialog. See
`PROGRESS-ORDERS.md` ORDER-7/D030.
🟩 Stores (`/dashboard/management/stores`) — full CRUD (name, address,
phone, email), `is_active` toggle, hard delete guarded against FK use
(matches Suppliers). No Loyverse sync path exists for stores at all
(API has no create/update endpoint) — ERP-local by necessity. See
`PROGRESS-MANAGEMENT.md` MGMT-4.

## Orders

🟩 Active Orders (`/dashboard/orders/active-orders`, formerly "Order
List") — the order-level "Ships to customer?" receiver toggle
(previously here and on Order Detail) was retired in PS-18/D040 in
favor of the per-shipment receiver on the Add/Edit Shipment dialog.
Order Detail/Edit routes are
`order_number`-based (`/active-orders/SOD26-0706-0001`, matching
Quotes). Order Detail has the full status workflow: Start Production
(all orders auto-advance to Ready for Shipping on production
completion, PS-13/PS-17 — pickup vs delivery is now decided per
shipment, not per order), Add Shipment/Mark Shipped/Mark Delivered/Mark
as Picked Up (per-shipment, PS-7/PS-8/PS-17 — replaces both the old
single Ship Order/Mark Delivered pair and the old whole-order Mark
Picked Up button), Resume/Put On Hold, Cancel Order. New/Edit
Order's line-item editor
now matches Quotes': Discount picklist + per-item Modifier selects
(`order_items.discount_id`, `order_item_modifiers` table) alongside
the existing reserve-model qty/BOM logic — see `PROGRESS-ORDERS.md`
ORDER-1..9 and D026-D030.
🟩 Quotation (`/dashboard/orders/quotation`, formerly "Quotes") —
standalone document (`quotes`/`quote_items`/`quote_item_modifiers`,
separate from `orders`), own numbering (`SQTYY-MMDD-0001`, yearly
reset), Open/Converted/Cancelled/Expired lifecycle. Converting reserves
stock (available→reserved) via `convert_quote_to_order()` rather than
deducting outright, and creates a linked Sales Order. Discounts/
modifiers picked from the Loyverse-synced tables; no shipping/receiver
fields (those stay on Sales Orders). See `PROGRESS-QUOTES.md`
(QUOTE-1..6).
🟩 Confirmed (`/dashboard/orders/confirmed`, formerly "Received",
renamed 2026-07-07 per Sinag's request) — read-only list of orders with
`status='confirmed'` (Received maps to Confirmed, no new status — same
mapping PS-1..9's kickoff decision #1 already established). Row click
navigates to Active Orders' Order Detail page, same as every other
status-scoped Orders list.
🟩 On Hold (`/dashboard/orders/on-hold`, added 2026-07-09) — read-only
list of orders with `status='on_hold'`, same columns as Confirmed. Row
click navigates to its own dedicated detail page
(`/dashboard/orders/on-hold/<orderNumber>`), not Active Orders' Order
Detail — Order Summary, Line Items, and Shipments (if any) only, with
Resume Order and Cancel Order actions (both admin-only). The Payments
card and Activity Log are deliberately omitted, staying exclusive to
Active Orders' Order Detail. See `PROGRESS-PRODUCTION-SHIPPING.md`
PS-20/its amendment and PS-21 (Cancel Order, `cancel_order()`
bucket-resolution rewrite, D042).
🟩 Production (`/dashboard/orders/production`, formerly "Production
Queue") — now a real per-product Production Orders list + detail
screen (`production_orders` table), not an order-level filtered list.
Start Production (PS-2) moves Reserved→In Production stock and creates
Production Orders; "Mark as Complete" (admin-only, on the detail page)
sets `completed_qty = quantity` on the Production Order and its order
lines and derives the parent order's status. Order Detail's Completed
Qty is now read-only with a link to its Production Order — the old
manual entry (ORDER-3/D028) is retired. PS-12 (2026-07-07) added: an
inline-editable `completed_qty` for tracking partial progress while
`in_production` (admin/manager/encoder); a "Cancel Order" action that
splits stock back — uncompleted portion to Available, completed
portion to On Hold — and reverts the parent order to Confirmed if it
was the last active Production Order; and, for composite products, a
Components card showing each BOM component's Reserved/Completed
(derived from the component ratio × quantity/completed_qty, not
separately tracked). The list itself is filtered to pending Production
Orders only (`not_started`/`wip`/`partially_completed`) per Sinag's
request (2026-07-07) — Completed and Cancelled rows no longer show
here, they're still visible on the Production Report. See
`PROGRESS-PRODUCTION-SHIPPING.md` PS-2/PS-3/PS-12.
🟩 Shipping (`/dashboard/orders/shipping`) — a real list, filtered to
`status IN ('ready_for_shipping','shipped')` (small in-page status
toggle between the two). Orders land here **automatically** once
production completes (PS-13) — no manual "Mark Ready for Shipping"
click. Row click navigates to Order Detail, where the actual shipment
actions live — this list is a navigational front door, not a new
workflow surface. The real workflow lives on Active Orders' Order
Detail page: a **Shipments** card lists every `order_shipments` row for
the order (N per order, mixing pickup and delivery freely, PS-17), each
with its own product lines (`shipment_items`, BOM-expanded on Mark
Shipped/Mark Picked Up), packaging lines (`shipment_packaging_items`),
a type badge (Pickup/Delivery), and the matching action — delivery
keeps the two-step Mark Shipped → Mark Delivered, pickup gets a single
"Mark as Picked Up" — plus an **Edit** action (PS-15) while a shipment
is still `preparing`, which now also lets the fulfillment type itself
be flipped (preserving already-entered line quantities) via
`update_shipment()`. **Fulfillment Method dropdown + "Ships to
Customer?" toggle in the Add/Edit Shipment dialog (PS-18)** — a
Delivery/Pick Up dropdown decides pickup vs delivery per shipment, not
per order, so a single order can be split across shipments with
different fulfillment types (e.g. some units picked up today, the rest
couriered later); for Delivery, a separate toggle (default on) picks
between shipping to the order's registered customer (server-side
snapshot of `customers.name/phone/address`, not client-editable) or a
manually entered receiver — Pick Up has no receiver at all. "Add
Shipment" creates a shipment with no stock effect and is available
while the order is Ready for Shipping *or* already Shipped (D039
supersedes D036, needed for incremental mixed-fulfillment allocation);
Mark Shipped/Mark Picked Up is what actually deducts stock (In
Production/Available → Out via `deduct_stock_out`); the order's status
is derived from all its shipments — `shipped` once any is
shipped/picked-up/delivered, `delivered` only once every shipment is
delivered **and** the full ordered quantity has been allocated. All
shipments number `SSH...` (PS-18 retired the separate `SSP` pickup
prefix from PS-17/D039; existing `SSP...` rows are untouched history).
`orders.fulfillment_method` and the older order-level `same_as_customer`/
`receiver_*` fields (superseded by the per-shipment receiver) are now
unused (kept in the schema, open decision — see `DECISIONS.md` D039/
D040). `completed` was retired as an `orders.status` value —
`delivered` is the single terminal status for both fulfillment types.
See `PROGRESS-PRODUCTION-SHIPPING.md` PS-6/PS-7/PS-8/PS-17/PS-18 and
`DECISIONS.md` D035/D036/D039/D040.
🟩 Payment (`/dashboard/orders/payment`) — a real list, added
2026-07-07 per Sinag's request: every order from `confirmed` through
`delivered` (all statuses except `cancelled`), with Payment Status
filter (Unpaid/Partially Paid/Paid/Overpaid). Row click now navigates
to its own dedicated Payment detail page (`/dashboard/orders/payment/
<orderNumber>`, PS-16, 2026-07-07) rather than the full Order Detail —
order/customer info and the Payments card only, no line items or
shipping. The Payments card (`OrderPayments`, shared with Order
Detail) also gained a **Close Payment** action: Paid closes freely,
Overpaid closes and records the excess as a tip (`orders.tip_amount`),
Partially Paid requires a note (for cases like the customer going
unreachable after shipment) — enforced both client-side and in
`close_order_payment()`. A **Payment Preview** page
(`/dashboard/orders/payment/<orderNumber>/preview`, print-friendly,
same convention as the Quotation view) lists items, payment history,
and the remaining balance for sending to the customer. See
`PROGRESS-PRODUCTION-SHIPPING.md` PS-16.
🟩 Completed (`/dashboard/orders/completed`, formerly "Completed
Orders")

## Inventory

*Nav order/labels as of PUR-1 (2026-07-11): Inventory Monitoring → Items for
Review(N) → Item Adjustment. Purchase Order and Receiving moved out to the
new top-level Purchasing group below (D044) — no longer nested here.*

🟩 Inventory Monitoring (`/dashboard/inventory/monitoring`, renamed from
"Inventory Status", merged with the former "Stock Movement" screen,
INV-16) — five-bucket stock model per `(variant, store)`: Available,
Reserved, In Production, On Hold, Incoming, plus derived On Hand/
Projected/Threshold/Status columns. Below it, "Inventory Movement
History" lists the latest 500 `inventory_movements` rows on the same
page. Row click on a Monitoring row opens a dedicated detail page
(`/monitoring/<sku>`) with that SKU/store's snapshot + most recent 50
movements — not a modal. `/dashboard/inventory`,
`/dashboard/inventory/status`, and `/dashboard/inventory/stock-movement`
are now thin redirects here (old bookmarks still work). See
`PROGRESS-INVENTORY.md` (INV-1..16).
🟩 Items for Review (`/dashboard/inventory/items-for-review`) — flat
table of on-hold stock, one row per `(variant, store, source)`, Source
column attributes each row's on-hold quantity back to the Order/
Production Order that produced it (label-only, not a real per-source
ledger). Row click opens Release directly (destinations: Available or
Scrap). See `PROGRESS-INVENTORY.md` INV-15.
🟩 Item Adjustment

## Purchasing

*New top-level nav group as of PUR-1 (2026-07-11, `DECISIONS.md` D044) —
Purchasing recreated as top-level, the opposite of D031's fold into
Inventory, now justified because it routes three distinct PO types to
three different destinations instead of doing one thing. One shared
`purchase_orders` table (`po_type` discriminator), not three schemas.*

🟩 Inventory PO (`/dashboard/purchasing/inventory-po`, moved back from
`inventory/purchase-orders`) — unchanged behavior, scoped to
`po_type='inventory'`.
🟩 Expense PO (`/dashboard/purchasing/expense-po`) — new. Category +
free-text description lines (no SKU); receiving creates an unpaid
`opex_expenses` row in Finance → Expenses per line. Creation is
admin/manager only (page-gated); receiving stays admin/manager/encoder,
same as Inventory PO always was. See `PROGRESS-PURCHASING.md` PUR-1.
🟩 Asset PO (`/dashboard/purchasing/asset-po`) — new. Same shape as
Expense PO; receiving creates one `fixed_assets` row **per line** (not
per unit — assets depreciate individually) in Finance → Fixed Assets,
with useful life/salvage pre-filled from the asset category and
overridable at receiving time. See `PROGRESS-PURCHASING.md` PUR-1.
🟩 Receiving (`/dashboard/purchasing/receiving`, moved back from
`inventory/receiving`) — Inventory-only (Expense/Asset PO receive
inline on their own detail page instead, no shared log). Standalone
"Incoming Inventory" screen retired; manual (non-PO) receipts logged
via "Log Manual Incoming". Every receiving event gets its own numbered
reference (`SRIYY-MMDD-0001`, yearly reset) and `status='received'`,
shown in a combined Receiving Log alongside the Open Purchase Orders
list. PO receipt also bumps `available_qty`, not just legacy
`in_stock` (INV-12). See `PROGRESS-PURCHASING.md` (RECV-1, PUR-1) and
`PROGRESS-INVENTORY.md` (INV-12).
🟩 AI Auto-Fill on Expense PO / Asset PO / Inventory PO (2026-07-12) —
upload/photograph a supplier invoice, hybrid Tesseract.js + OpenAI Vision
extracts and pre-fills the New PO form (header + line items), every field
stays editable, nothing auto-saves. Inventory PO matches against
registered item variants, including alias/keyword matching via
`items.ai_match_keywords`. Reusable module (`lib/ai-autofill/`,
`components/ai-autofill/`), 4 more document schemas defined but not yet
wired to a form. Inventory PO also gets a non-blocking warning when a
line's unit cost is >50% off the item's registered cost. See
`PROGRESS-PURCHASING.md` PUR-2/PUR-2.1 and `DECISIONS.md` D045/D046.

## Finance

🟩 Income — manual entry CRUD (`income` table), admin/manager only.
**Deprecated/unchanged by PUR-1/FIN-1** — untouched, still reads the
old `income` table, out of scope for the 2026-07-11 restructure.
🟩 Expenses (`/dashboard/finance/expenses`) — real CRUD over a new
`opex_expenses` table (replacing the deprecated `expenses`-table
archive), admin/manager only: categories (+ inline Manage Categories),
optional supplier, attachments (Supabase Storage), payment status
(unpaid/partial/paid, derived from `payable_payments`), source (Direct
Entry or Expense PO). See `PROGRESS-FINANCE.md` FIN-1.
🟩 Fixed Assets (`/dashboard/finance/fixed-assets`, moved from
Accounting) — gained the add/edit-asset UI it never had, plus
`category_id`/`salvage_value`. Admin-only, matching the original
ACCT-5 RLS tier. See `PROGRESS-FINANCE.md` FIN-1.
🟩 Payments (`/dashboard/finance/payments`, moved from
`orders/payment`) — relocation only, `close_order_payment()`/
`order_payments` unchanged. "Central payment hub" spanning
customer/expense/asset/credit-card payments is explicit future work,
not built this phase. See `PROGRESS-FINANCE.md` FIN-1.
🟩 Cash Flow — read-only income vs. expenses timeline with running
balance, selectable date range, admin/manager only. **Unchanged by
PUR-1/FIN-1** — still reads the old `income`/`expenses` tables (both
effectively empty since ACCT-3), flagged but out of scope.
🟩 Profit & Loss — read-only revenue (confirmed+ orders) minus
expenses statement with margin %, selectable date range, admin/manager
only. Same stale-table caveat as Cash Flow above.

## Accounting

> **▶ ACTIVE — resumed 2026-07-10 (clean restart), all data wiped.** See
> `PROGRESS-ACCOUNTING.md` for detail.

🟩 Chart of Accounts (ACCT-1) — re-seeded 2026-07-10 (103 accounts: 96 original + 7 new for ACCT-7). Admin-only edit UI (add/edit/deactivate) built same day at `/dashboard/accounting/chart-of-accounts`
🟩 Journal Core — `journal_entries`/`journal_entry_lines`, `post_journal_entry()` (ACCT-2)
🟩 Manual Entry UI + retire income/expenses (ACCT-3)
🟩 Financial Reports — Trial Balance, Income Statement, Balance Sheet (ACCT-4)
🟩 Fixed Assets & Depreciation (ACCT-5) — asset register/depreciation engine
built here; **the UI itself moved to `/dashboard/finance/fixed-assets` on
2026-07-11 (FIN-1)**, this row now describes the underlying schema/RPC only
🟩 Historical Import / Opening Balance (ACCT-6)
🟩 Event-driven auto-posting (ACCT-7) — rewritten 2026-07-10, all 8
sub-phases (7.1..7.8) done same day: COA re-seed + edit UI, Purchasing
payment-method capture, item→account mapping (`/dashboard/accounting/
product-mapping`), `business_events` log + 6 trigger RPCs, `journal_entry_
drafts` rule engine, Review & Approve/Post UI, reversal RPC, Credit Card
Payable. **Extended 2026-07-11 (7.9, D044)** with 4 more event types
(expense/asset recorded + their payments, posting through `SCA-2000
Accounts payable`) and a new Category Mapping page
(`/dashboard/accounting/category-mapping`, expense/asset categories →
accounts). See `PROGRESS-ACCOUNTING.md`.
⬜ BIR tax estimate calculator (ACCT-8) — optional, lowest priority, not started
🟨 Module restructure (ACCT-9) — COA hierarchy, Financial Settings nav,
mapping generalization, foundation-only Taxes. **9.1 done 2026-07-15**:
`accounts` gained `parent_account_id`/`is_postable`, Chart of Accounts UI
is now a tree with expand/collapse. **9.2 done 2026-07-15**: new Financial
Settings nav subgroup under Accounting; Product Mapping and Category
Mapping moved to `/dashboard/accounting/financial-settings/product-mapping`
and `/financial-settings/expense-categories` (old paths above are now
stale); Journal→Journal Entries, Review→Pending Review, Income
Statement→Profit & Loss renames applied. **9.3 done 2026-07-15**: new
`system_account_mappings` table (7 seeded keys) closes the hardcoded-
`account_number` gap in `generate_draft_journal_entries()` — every account
it resolves is now FK'd via `mapping_key`, not a literal string. **9.4 done
2026-07-15**: new `bank_accounts` table (name, bank, masked account #,
`gl_account_id → accounts`, currency, active) + admin CRUD page at
`/dashboard/accounting/financial-settings/bank-accounts`;
`payment_type_accounting_mappings` gained an optional `bank_account_id`, and
a first-ever admin UI for that table shipped alongside it at
`/financial-settings/payment-methods` (previously seed-only via SQL) — GL
Account (required, drives posting) stays separate from Bank Account
(optional, reconciliation reference only, no posting-logic change this
round). 9.5–9.7 not started.

Tracked separately in `PROGRESS-ACCOUNTING.md`, not this file's usual phase log.

## Analytics

🟩 Sales Report — revenue by day/category charts, sortable item
breakdown table (doubles as top sellers, pre-sorted by revenue),
date-range filter, open to any authenticated user
🟩 Inventory Report — current stock by item/variant, low-stock
badges, stock value (in_stock × cost, same convention as the
Dashboard KPI), date-ranged movement volume chart, open to any
authenticated user
🟩 Production Report — Production Order counts/units by status
(in_production/completed, created-in-range; PS-9 reworked this from
order-level stage counts to per-Production-Order granularity now that
`production_orders` exists), completed-per-day chart (`updated_at` as
a completion-time proxy), supporting table linking to each Production
Order's detail page, open to any authenticated user. No
time-in-production/avg-cycle-time metric — flagged in-page as needing
a dedicated status-change-log table, out of this phase's scope.
🟩 Financial Report — Revenue/Expenses/Net Margin/Margin % KPIs,
revenue-by-day and expenses-by-day charts, expense breakdown by
category (reuses Phase 21's table component), date-range filter.
Restricted to Admin/Manager (matching Finance), unlike the other
three open Analytics reports — the sidebar item itself is still
visible to everyone since the Analytics nav group has no per-item
role filter, only the page content is gated.

## Administration

🟩 Users — invite, edit (name/role), deactivate/reactivate
🟩 Roles — read-only reference + permission matrix
🟩 Activity Logs — filters (action/actor/date) + quote-edit diff viewer

## Account

🟩 Profile — view name/email/role (role read-only), edit full name/contact
number/birthday, password change via Supabase Auth reset-email link
(no raw password fields in app code)

## Integrations

> No dedicated Integrations screens exist in the ERP UI. That said,
> Loyverse sync is functionally live as of the Item List feature
> (D020): pull-sync for categories/items/customers/inventory/receipts/
> payment types/modifiers/discounts runs daily via the n8n workflow
> `Loyverse-Supabase`, and ERP item Create/Edit pushes to Loyverse in
> real time. This all runs invisibly under Inventory > Item List —
> none of it surfaces as an "Integrations" screen below.

⬜ AI
⬜ n8n
⬜ Loyverse Sync
⬜ Barcode
⬜ Reports
