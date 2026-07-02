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
🟩 Production Report — order counts by stage (created-in-range),
completed-per-day chart (`updated_at` as a completion-time proxy),
supporting table with stage badges, open to any authenticated user.
No time-in-stage/avg-cycle-time metric — flagged in-page as needing
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

⬜ AI
⬜ n8n
⬜ Loyverse Sync
⬜ Barcode
⬜ Reports
