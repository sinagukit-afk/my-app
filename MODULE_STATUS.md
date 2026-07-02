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

⬜ Income
⬜ Expenses
⬜ Cash Flow
⬜ Profit & Loss

## Analytics

⬜ Sales Report
⬜ Inventory Report
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
