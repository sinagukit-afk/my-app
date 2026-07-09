> **STATUS (2026-07-02): COMPLETE.** All of Phases 21–26 below are done —
> see `PROGRESS.md` for the build log and verification notes on each, and
> `MODULE_STATUS.md` for current per-screen badges. This document is kept
> for historical reference only (exact original specs/scope for each
> phase); it does not describe pending work. Active development moved to
> the Accounting Module (`PROGRESS-ACCOUNTING.md`, `ACCT-1`...`ACCT-8`),
> which is itself currently paused — see `MODULE_STATUS.md`'s Accounting
> section. Do not treat anything below as a to-do list.

## Phase 21 — Finance: Cash Flow & Profit/Loss (read-only reports)

### Preflight (do first, before any code)
Follow the Preflight section in the `bms-supabase` skill. Confirm
Phase 20's `income`/`expenses` tables exist and have the expected
columns before building reports on top of them.

### Objective
Read-only Cash Flow and Profit & Loss reports.

### Scope
- Cash Flow: income vs. expenses over a selectable date range
- Profit & Loss: revenue (from `orders.total_money`, confirmed+
  statuses) minus expenses, over a selectable date range

### Requirements
- Follow SKILL.md
- Follow ARCHITECTURE.md
- Follow BUSINESS_RULES.md
- Follow DECISIONS.md
- Same admin/manager-only access scoping as Phase 20

### Do Not
- Add new write actions — this phase is read-only
- Modify the `income`/`expenses` schema from Phase 20
- Touch order/inventory logic

### Deliverables
]- Cash Flow report page
- Profit & Loss report page
- Shared date-range filter component (reusable in Phase 22+ if
  useful)

### Verification
- npm run build
- Browser tested with real Income/Expense + Order data
- Update PROGRESS.md
- Update MODULE_STATUS.md (flip Finance > Cash Flow, Profit & Loss
  to 🟩)

---

## Phase 22 — Analytics: Sales Report

### Preflight (do first, before any code)
Follow the Preflight section in the `bms-supabase` skill. Confirm the
Analytics routes are still stubs and `orders`/`order_items` schema is
unchanged since Phase 14.

### Objective
Read-only sales reporting.

### Scope
- Sales by date range
- Sales by item/category
- Top sellers
- Chart + table view

### Requirements
- Follow SKILL.md
- Follow ARCHITECTURE.md
- Follow BUSINESS_RULES.md
- Follow DECISIONS.md

### Do Not
- Touch order creation/edit/confirm logic — read-only against
  `orders`/`order_items` where status is confirmed or later
- Add new tables

### Deliverables
- Sales Report page with at least one chart and a supporting table

### Verification
- npm run build
- Browser tested
- Update PROGRESS.md
- Update MODULE_STATUS.md (flip Analytics > Sales Report to 🟩)

---

## Phase 23 — Analytics: Inventory Report

### Preflight (do first, before any code)
Follow the Preflight section in the `bms-supabase` skill. Confirm
`inventory_levels`/`inventory_movements` schema is unchanged.

### Objective
Read-only inventory reporting.

### Scope
- Current stock by item/variant
- Low-stock flags
- Stock value (in_stock × cost or price — confirm which with the
  user if ambiguous)
- Movement volume over a selectable date range

### Requirements
- Follow SKILL.md
- Follow ARCHITECTURE.md
- Follow BUSINESS_RULES.md
- Follow DECISIONS.md

### Do Not
- Touch stock mutation logic (`adjust_stock`, receiving, etc.) —
  read-only
- Add new tables

### Deliverables
- Inventory Report page

### Verification
- npm run build
- Browser tested
- Update PROGRESS.md
- Update MODULE_STATUS.md (flip Analytics > Inventory Report to 🟩)

---

## Phase 24 — Analytics: Production Report

### Preflight (do first, before any code)
Follow the Preflight section in the `bms-supabase` skill. Confirm
`orders.status`/`updated_at` are the only production-timing signals
available — there is currently no dedicated status-change log.

### Objective
Read-only production throughput reporting, within current data
limits.

### Scope
- Orders by stage (quote/confirmed/in_production/completed/cancelled)
  counts
- Completed count per period

### Requirements
- Follow SKILL.md
- Follow ARCHITECTURE.md
- Follow BUSINESS_RULES.md
- Follow DECISIONS.md

### Do Not
- Add a production-stage-change-log table to enable precise
  "average time in production" metrics unless the user explicitly
  asks for it in this phase — flag the limitation instead of quietly
  building around it or skipping it
- Touch order status-transition logic

### Deliverables
- Production Report page with the throughput metrics that are
  actually derivable from current data
- A clear note in the UI or report about the time-in-stage
  limitation, if precise timing isn't included

### Verification
- npm run build
- Browser tested
- Update PROGRESS.md
- Update MODULE_STATUS.md (flip Analytics > Production Report to 🟩)

---

## Phase 25 — Analytics: Financial Report

### Preflight (do first, before any code)
Follow the Preflight section in the `bms-supabase` skill. Confirm
Phases 20–22 are complete (Finance tables + Sales Report exist) —
this phase depends on both.

### Objective
Executive-summary read-only report combining Finance and Sales data.

### Scope
- Revenue vs. expenses vs. margin over a selectable date range,
  reusing Phase 20/21's Finance queries and Phase 22's Sales queries
  rather than re-deriving them from scratch

### Requirements
- Follow SKILL.md
- Follow ARCHITECTURE.md
- Follow BUSINESS_RULES.md
- Follow DECISIONS.md
- Same admin/manager-only access scoping as Phase 20/21

### Do Not
- Duplicate report logic already built in Phase 20–22 — reuse it
- Add new tables

### Deliverables
- Financial Report page

### Verification
- npm run build
- Browser tested
- Update PROGRESS.md
- Update MODULE_STATUS.md (flip Analytics > Financial Report to 🟩)

---

## Phase 26 — Quotes: Encoder Self-Service Cancellation

### Preflight (do first, before any code)
Follow the Preflight section in the `bms-supabase` skill. Confirm
the current shape of the `orders_encoder_update_own_quote` /
`order_items_encoder_update_own_quote` RLS policies (from migration
`0007_fix_orders_rls_status_and_manager`) before changing anything.

**Also: confirm with the user that this behavior is actually wanted
before touching the policy** — this phase exists because Phase 14
flagged it as a possible gap, not because it's been confirmed as a
requirement.

### Objective
Let an encoder/manager cancel their own quote without needing an
admin, closing the gap flagged in Phase 14's notes.

### Scope
- Widen the existing "own quote" RLS policy's `with_check` to also
  allow `quote` → `cancelled` (currently only allows `quote` →
  `confirmed`)
- Show a Cancel action on the Quotes screen for encoder/manager on
  their own rows (mirroring the existing Edit button's visibility
  logic)

### Requirements
- Follow SKILL.md
- Follow ARCHITECTURE.md
- Follow BUSINESS_RULES.md
- Follow DECISIONS.md

### Do Not
- Allow cancellation of anything past `quote` status (confirmed/
  in_production orders still require admin, per existing rules)
- Widen any other policy while in there — scope this to exactly the
  one transition

### Deliverables
- Migration widening the RLS policy (additive, policy-only)
- Cancel button on Quotes for the row's own encoder/manager creator

### Verification
- npm run build
- Browser tested as encoder: create a quote, cancel it, confirm an
  admin-created quote still can't be cancelled by a different
  encoder
- Run get_advisors to confirm no new security warnings
- Update PROGRESS.md
- Update DECISIONS.md
