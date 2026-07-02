# Module Status

Legend: - 🟩 Complete - 🟨 In Progress - ⬜ Not Started

## Dashboard

🟩 Dashboard — KPI cards, Low Stock, and Recent Activity wired to
live Supabase queries (Phase 17). Quick Actions remain static links.

## Inventory

🟩 Incoming Inventory — manual (non-PO) entry form + history table wired
to real `incoming_items` inserts (Phase 18). Supplier picker, item/variant
picker, qty, unit price, date, notes. Stock updated automatically by the
existing `incoming_items_apply_inventory_movement` trigger on INSERT.
🟩 Stock Movement
🟩 Item Adjustment
🟩 Suppliers

## Purchasing

🟩 Purchase Orders
🟩 Receiving

## Orders

🟩 Quotes
🟩 Order List
🟩 Production Queue
🟩 Completed Orders

## Finance

🟩 Income — manual entry CRUD (`income` table), admin/manager only
🟩 Expenses — manual entry CRUD (`expenses` table), admin/manager only
🟩 Cash Flow — read-only income vs. expenses timeline with running
balance, selectable date range, admin/manager only
🟩 Profit & Loss — read-only revenue (confirmed+ orders) minus
expenses statement with margin %, selectable date range,
admin/manager only

## Analytics

🟩 Sales Report — revenue by day/category charts, sortable item
breakdown table (doubles as top sellers, pre-sorted by revenue),
date-range filter, open to any authenticated user
🟩 Inventory Report — current stock by item/variant, low-stock
badges, stock value (in_stock × cost, same convention as the
Dashboard KPI), date-ranged movement volume chart, open to any
authenticated user
⬜ Production Report
⬜ Financial Report

## Administration

🟩 Users — invite, edit (name/role), deactivate/reactivate
🟩 Roles — read-only reference + permission matrix
🟩 Activity Logs — filters (action/actor/date) + quote-edit diff viewer

## Account

🟩 Profile — view name/email/role (role read-only), edit full name/contact
number/birthday, password change via Supabase Auth reset-email link
(no raw password fields in app code)

## Integrations

⬜ AI
⬜ n8n
⬜ Loyverse Sync
⬜ Barcode
⬜ Reports
