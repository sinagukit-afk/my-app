# Roadmap — Phases 17–26

Continuation of the Phase 0–15 build log after Phase 16 (Administration, scoped separately in `NEXT_PHASE.md`). Each phase below is scoped to roughly one screen or one tight feature — sized to run in a single short Claude Code session (~3–7 min of actual work), matching the granularity of Phases 11, 15, etc. rather than bundling multiple RPCs/screens together.

**Before running any of these, follow the Preflight check in the `bms-supabase` skill** — confirm against the live app/DB that the phase's starting assumptions still hold, don't just trust this roadmap or `MODULE_STATUS.md`.

**Not included on purpose:** the Integrations group (AI, n8n, Loyverse Sync, Barcode, Reports). Per D001/D008, Loyverse sync and n8n automation are deliberately disabled right now — building those screens would contradict a settled decision. Revisit only if that decision changes.

---

### Phase 17 — Dashboard: Wire to Real Data
Replace the Phase 5 mock data with live queries: today's sales and monthly revenue (from `orders`/receipts), pending orders count (`quote`+`confirmed`+`in_production`), inventory value (`inventory_levels.in_stock` × cost/price), and the Low Stock list. Recent Activity feed reads from `activity_logs` (now populated since Phase 14 follow-up). Quick Actions can stay as static links. All read-only — no new RPCs needed.

### Phase 18 — Incoming Inventory: Wire to Real Data
Wire the manual (non-PO) incoming-item entry screen to a real `incoming_items` insert (the existing `apply_incoming_item_inventory_movement` trigger handles the stock/movement side automatically). Supplier picker, item/variant picker, quantity, note. Follow the Suppliers-screen CRUD pattern (Phase 11) — this is the last gap in the Inventory module.

### Phase 19 — Account: Profile Screen
Self-service profile page: view own name/email/role, edit own `full_name`, link to Supabase Auth's password-change flow. Single row, own-record-only — simpler than Administration's Users screen (which manages *other* users).

### Phase 20 — Finance: Income & Expenses (manual entry)
Small additive migration for `income` and `expenses` tables (date, category, amount, note, `created_by`). Basic CRUD screens, admin/manager only, soft delete. No computed reports yet — that's Phase 21.

### Phase 21 — Finance: Cash Flow & Profit/Loss (read-only reports)
Read-only reports built on Phase 20's tables plus `orders.total_money` as revenue: a date-range-filtered cash flow summary and a simple P&L (revenue − expenses). Depends on Phase 20 existing first.

### Phase 22 — Analytics: Sales Report
Read-only report over `orders`/`order_items` (confirmed+ statuses): sales by date range, by item/category, top sellers. Chart + table, matches the existing DataTable/read-only screen pattern (e.g. Stock Movement, Completed Orders).

### Phase 23 — Analytics: Inventory Report
Read-only report over `inventory_levels`/`inventory_movements`: current stock by item/variant, low-stock flags, stock value, movement volume over a date range.

### Phase 24 — Analytics: Production Report
Read-only report on production throughput: orders by stage, count completed per period. Note: precise time-in-stage isn't tracked today beyond `updated_at` — if you want true "average time in production," flag it as a small additive follow-up (a status-change log) rather than assuming the data already exists.

### Phase 25 — Analytics: Financial Report
Executive-summary read-only report combining Finance (Phase 20/21) and Sales (Phase 22): revenue vs. expenses vs. margin over a period. Depends on Phases 20–22 being done first.

### Phase 26 — Quotes: Encoder Self-Service Cancellation
Closes the loose end flagged in Phase 14's notes: right now, cancelling/deleting a quote is effectively admin-only because the encoder/manager "own quote" RLS policy's `with_check` only allows `quote`→`confirmed`. Small, scoped fix: widen that policy to also allow `quote`→`cancelled` for the row's own creator (encoder/manager), matching the same "own row" pattern already used for editing. Confirm with the user first whether this self-service behavior is actually wanted before changing the policy.

---

## Suggested order

17 → 18 → 19 are independent, low-risk gap-fills — good to do in any order, even out of numeric sequence.
20 → 21 → 22 → 23 → 24 → 25 have real dependencies (Finance tables before Finance reports; Sales report before the combined Financial report) — keep that sequence.
26 is a standalone policy tweak — can slot in anywhere once you've confirmed the business actually wants it.
