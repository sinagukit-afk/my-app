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
minimum stock threshold), archive, activity logging, BMS→Loyverse
push-sync via n8n. See `PROGRESS-ITEMS.md` (ITEM-0..7) and D020/D021 in
`DECISIONS.md`.
🟨 Item Category (`/dashboard/management/item-categories`) — read-only
list with a `category_type` (Product/Packaging) toggle, admin-only;
categories themselves still sync in from Loyverse (no create/edit here).
Lets Master Items be tagged Packaging for the shipment packaging picker.
See `PROGRESS-PRODUCTION-SHIPPING.md` PS-1.
⬜ Product Modifier (`/dashboard/management/product-modifiers`) — blank
placeholder, not yet built.
🟩 Couriers (`/dashboard/management/couriers`) — admin-only CRUD,
populates the courier picker in Order Detail's Ship Order dialog. See
`PROGRESS-ORDERS.md` ORDER-7/D030.
⬜ Stores (`/dashboard/management/stores`) — blank placeholder, not yet
built.

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
Detail — Order Summary, Line Items, and Shipments (if any) only, with a
Resume Order action (ORDER-9's `canResume` gating); the Payments card
and Activity Log are deliberately omitted, staying exclusive to Active
Orders' Order Detail. See `PROGRESS-PRODUCTION-SHIPPING.md` PS-20 and
its amendment.
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

⬜ Inventory Status (`/dashboard/inventory/status`) — blank placeholder,
not yet built.
🟩 Item Adjustment
🟩 Stock Movement
🟩 Purchase Orders (`/dashboard/inventory/purchase-orders`, moved from
the retired Purchasing group)
🟩 Receiving (`/dashboard/inventory/receiving`, moved from the retired
Purchasing group) — standalone "Incoming Inventory" screen retired;
manual (non-PO) receipts now logged from Receiving itself via "Log
Manual Incoming". Every receiving event (manual or PO-sourced) gets its
own numbered receiving reference (`SRIYY-MMDD-0001`, yearly reset) and
`status='received'`, shown in a combined Receiving Log alongside the
existing Open Purchase Orders list. See `PROGRESS-PURCHASING.md`
(RECV-1).

## Finance

🟩 Income — manual entry CRUD (`income` table), admin/manager only
🟩 Expenses — manual entry CRUD (`expenses` table), admin/manager only
🟩 Cash Flow — read-only income vs. expenses timeline with running
balance, selectable date range, admin/manager only
🟩 Profit & Loss — read-only revenue (confirmed+ orders) minus
expenses statement with margin %, selectable date range,
admin/manager only

## Accounting

> **⏸ PAUSED (2026-07-02) — do not resume ACCT-7/8 or any Accounting work
> until Sinag explicitly says go.** See `PROGRESS-ACCOUNTING.md` for detail.

🟩 Chart of Accounts (ACCT-1)
🟩 Journal Core — `journal_entries`/`journal_entry_lines`, `post_journal_entry()` (ACCT-2)
🟩 Manual Entry UI + retire income/expenses (ACCT-3)
🟩 Financial Reports — Trial Balance, Income Statement, Balance Sheet (ACCT-4)
🟩 Fixed Assets & Depreciation (ACCT-5)
🟩 Historical Import / Opening Balance (ACCT-6)
⬜ Auto-posting from `confirm_order()` / PO receiving (ACCT-7) — gated until core BMS order/PO flow stabilizes, **and now also on the module-wide pause above**
⬜ BIR tax estimate calculator (ACCT-8) — optional, lowest priority, **also on the module-wide pause above**

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

> No dedicated Integrations screens exist in the BMS UI. That said,
> Loyverse sync is functionally live as of the Item List feature
> (D020): pull-sync for categories/items/customers/inventory/receipts/
> payment types/modifiers/discounts runs daily via the n8n workflow
> `Loyverse-Supabase`, and BMS item Create/Edit pushes to Loyverse in
> real time. This all runs invisibly under Inventory > Item List —
> none of it surfaces as an "Integrations" screen below.

⬜ AI
⬜ n8n
⬜ Loyverse Sync
⬜ Barcode
⬜ Reports
