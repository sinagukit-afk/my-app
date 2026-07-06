# PROGRESS-ORDERS.md

Tracks the **Order Module Improvement** build for Sinag Ukit BMS. Follows the same convention as `PROGRESS-QUOTES.md`/`PROGRESS-CUSTOMERS.md`/`PROGRESS-INVENTORY.md`: `ORDER-` prefixed phases, kept separate from the core `PROGRESS.md` numbering. Append-only.

Source doc: `ORDER_MODULE_IMPROVEMENT.md` (handed over by Sinag from Downloads, 2026-07-06), assessed against the live app before any build. This is explicitly the deferred "future order page revision" phase referenced in `PROGRESS-QUOTES.md` (QUOTE-1: *"Reserved → deducted-at-completion stock transition, and partial-reservation-on-shortage — both deferred to a future 'order page revision' phase"*) and in `DECISIONS.md` D025.

**Status: 🟨 IN PROGRESS.** ORDER-1 and ORDER-2 done; ORDER-3 onward still planning only.

## Gap analysis (2026-07-06 audit against live app)

The doc says "improve, don't rebuild," which holds for the UI/architecture — but several requirements need **new schema**, not just UI changes:

- No `order_number` column exists on `orders` at all (unlike `quotes.quote_number`).
- No payment history — `orders.payment_type_id` is a single nullable FK, no `order_payments` table.
- No `target_date` or any date field beyond `created_at`/`updated_at`.
- `order_items` has no `reserved_qty` or `completed_qty` columns.
- `adjust_order_items()` deducts `in_stock` directly — inconsistent with the reserve/available split Inventory Phase 1 built (`PROGRESS-INVENTORY.md`) and with how `convert_quote_to_order()` already reserves via `transfer_stock_status()`.
- `orders_status_check` only allows `confirmed|in_production|completed|cancelled` — needs Partially Completed, Production Completed, Ready for Shipping, Shipped, Delivered, On Hold added.
- `confirm_order()` RPC is **dead code** post-Quote-rebuild (checks `status='quote'`, which no order can have anymore since `orders_status_check` was narrowed in QUOTE-5) — candidate to drop or repurpose for "Method 2: Create Order directly."
- No "Create Order directly" path exists today — the only way to create an `orders` row is converting a Quote.

**Reusable as-is:**
- `activity_logs` already has `entity_type='order'` rows and an established snapshot-diff pattern (D006) — Activity Timeline just needs a UI panel on a real Order Detail page (doesn't exist yet; List only has a View dialog).
- `order_shipments`/`couriers` tables already exist (0 rows, unused, from migration `0023_shipping`) with `courier_id`/`tracking_number`/`shipped_at`/`delivered_at` — covers the doc's Shipped step already.
- Quote's `FilterBar` + date-range filter pattern (`quotes-table.tsx`) is directly portable to Order List.

## Kickoff decisions (confirmed with Sinag, 2026-07-06)

1. **Revision History** — reuse the existing Quote-style activity-log snapshot pattern (pre-edit snapshot + `activity_logs` entry), **not** a dedicated versioned revision table. Consistent with D006's precedent.
2. **Completed Qty entry** — no Production module exists yet, so Completed Qty is entered **manually on the Order Detail page** by admin/manager, as a stopgap. The "Ordered Qty must never be less than Completed Qty" rule is enforced against this manually-entered value until a real Production module exists.
3. **Timing** — Sinag reviews this plan first; nothing below starts without an explicit go-ahead.

---

## ORDER-1 — Schema foundation ✅ DONE

**What was built** (migration `0032_orders_module_improvement_schema`):
- `orders.order_number` — format `SOD<YY>-<MMDD>-<seq>` (e.g. `SOD26-0706-0001`), same rule as `set_quote_number()` (QUOTE-1): yearly-reset sequence via `count(*) where order_number like 'SOD'||YY||'%'`. New `set_order_number()` `BEFORE INSERT` trigger, `orders_order_number_key` unique index. Backfilled the 4 existing rows in `created_at` order before making the column `NOT NULL`.
- `orders.target_date` — `date`, `NOT NULL`, **no DB default** (mirrors `quotes.valid_until`'s convention: the value derives from a sibling column — `created_at`/order date — which a column `DEFAULT` expression can't reference, so it must be set explicitly by app code at insert time). Backfilled existing rows to `created_at::date + 5`. Application code (ORDER-5) is responsible for setting `target_date = order_date + 5` (editable) going forward.
- `order_items.reserved_qty`, `order_items.completed_qty` — both `numeric NOT NULL default 0`. Backfilled `reserved_qty = quantity` for existing rows (matches the doc's "Reserved Qty = Ordered Qty" default). Not yet wired into any RPC — `adjust_order_items()` and `convert_quote_to_order()` don't populate these yet, so any *new* order/edit created before ORDER-2 lands will silently get `reserved_qty = 0`. Acceptable for a schema-only phase since no UI reads these columns yet, but ORDER-2 must land before this is relied on.
- `orders_status_check` expanded **additively** — kept `completed` alongside the 6 new statuses (`partially_completed`, `production_completed`, `ready_for_shipping`, `shipped`, `delivered`, `on_hold`) rather than remapping/removing it. Reason: Completed Orders, Production Report's `OrderStage` type, and Order List/Production Queue's status filters all still read `'completed'` today — removing it now would break currently-working pages before ORDER-4/6/7 rework them. **Open decision, still unresolved:** whether `completed` becomes a permanent alias for `delivered` or gets migrated away entirely — deferred to ORDER-6/7.
- New `order_payments` table (append-only): `order_id`, `payment_date`, `amount` (`CHECK > 0`), `payment_type_id` (FK to the existing `payment_types` table, nullable — mirrors `orders.payment_type_id`'s own nullability, reuses the Loyverse-synced payment-method list instead of a free-text column), `reference_no`, `created_by` (defaults `auth.uid()`), `created_at`. RLS: `select_all` (any authenticated), `insert_encoder_manager_admin`, `admin_update`/`admin_delete` (manual correction only — matches the doc's "never deleted *automatically*", not a ban on admin-initiated fixes).
- Migration only — no RPC/UI changes. `npm run build`/browser testing not run for this phase since nothing user-facing changed.

**Verification:** direct SQL — all 4 existing orders backfilled with correctly formatted, chronologically-ordered `order_number`s; `target_date` = `created_at + 5d`; `order_items.reserved_qty` = `quantity` on all 7 existing rows, `completed_qty = 0`. `get_advisors` (security) shows no new findings introduced by this migration (only pre-existing, unrelated warnings across the schema).

**Not done in this phase (deferred to ORDER-2+):** RPC rework to actually populate `reserved_qty`/`completed_qty` on write; `MODULE_STATUS.md`/`BUSINESS_RULES.md` updates (held until a phase actually changes user-visible behavior, per Sinag's earlier question about which docs get touched when).

## ORDER-2 — Reserve-model RPC rework ✅ DONE

**Kickoff decision (confirmed with Sinag, 2026-07-06):** when lines share a raw-material component and it runs short, split greedily by line order (earlier lines in the form get reserved first) rather than proportionally — simpler and easier to explain to staff. See D027.

**What was built** (migrations `0033`, `0034` fix, `0035` fix — see D027 for the full account):
- Dropped `confirm_order()` (dead code post-Quote-rebuild) and an orphaned 4-param `adjust_order_items()` overload left over from migration `0025` (app only ever called the 8-extra-param version).
- Rewrote `adjust_order_items()`: releases the order's entire current reservation footprint (expanded from each line's `reserved_qty`, not `quantity`) back to `available`, deletes/reinserts `order_items` from the new line list, then loops the new lines in submitted order reserving each line's feasible whole-unit amount (`MIN` across required components of `floor(available_qty / per_unit_ratio)`) via `transfer_stock_status()` before moving to the next line — implementing both the reserve-not-deduct model and partial-reserve-on-shortage in one pass, superseding the old delta/temp-table approach entirely.
- Fixed a real bug caught during this work: `track_stock` lives on the *component* (raw material) item, never the composite/kit item itself (composites are always `track_stock=false`) — an early draft checked the line's own item and silently skipped BOM reservation for every composite line. Also fixed a column-count mismatch in the final `order_items` insert caught the same way (both fixed before any real data was affected — caught via direct-SQL testing, not in production).
- Updated the stale "Stock is automatically deducted/returned" copy on the Edit Order page (`app/dashboard/orders/order-list/[id]/edit/edit-order-form.tsx`) to describe the new reserve/release + partial-reserve behavior.
- Regenerated `lib/supabase/types.ts` (confirm_order/old overload removed from the generated RPC types).

**Verification:** Direct-SQL test order with two lines requesting the same composite item (50+50 against 82 available raw stock) confirmed greedy allocation (50 then 32, exhausting available exactly) and an untracked-item line reserved unconditionally; a second call with fewer/changed lines confirmed the release-then-reallocate cycle restores availability correctly. Full round-trip repeated through the actual Edit Order UI (Claude admin account) on a real order — added a 200-qty composite line against 82 available stock, saved, confirmed `reserved_qty=82` (not 200) in the DB and `available_qty` correctly zeroed, then removed the line and re-saved to confirm full release back to the 82/3 baseline. `npm run build` clean. `get_advisors` shows no new findings introduced.

**Not built (deferred, tracked as open follow-ups):**
- `completed_qty` preservation across edits — the delete+reinsert flow currently resets it to 0 on any line-item edit. No live data has `completed_qty > 0` yet (ORDER-3 doesn't exist), so this is a documented gap for ORDER-3/6 to resolve, not a live bug.
- Method 2 (direct order creation) — `confirm_order()` was retired rather than repurposed; ORDER-5 will get its own RPC since its inputs differ (no existing `order_items` to expand from, needs `order_number`/`target_date`).

## ORDER-3 — Order Detail page ⬜ Not Started

- New page (parallel to Quote Detail): header/summary, line items with Ordered/Reserved/Completed Qty, Activity Timeline (reuse `activity_logs`, `entity_type='order'`), status-gated action buttons.
- Payments section: add payment, auto-computed Total Paid / Remaining Balance / Change, Payment Status badge (Unpaid/Partially Paid/Paid/Overpaid).
- Manual Completed Qty entry (per decision 2 above), enforcing ordered ≥ completed.
- Move all row actions here; List page loses its Actions column.

## ORDER-4 — Order List rework ⬜ Not Started

- Columns: Order No., Customer, Order Date, Created, Modified, Status, Total Items, Order Total, Payment Status, Last Activity.
- Remove Actions column (per doc).
- Reuse Quote's `FilterBar` (status) + date-range filter (`created_at`) pattern.

## ORDER-5 — Create Order directly (Method 2) ⬜ Not Started

- New `order-list/new` page reusing the Quote line-item component/layout as much as possible.
- Method 1 (Convert Quote → Order) already exists via `convert_quote_to_order()` — unchanged.

## ORDER-6 — Progressive lock rules + line item rules ⬜ Not Started

- Enforce the editable-until-Production-Completed matrix per status (Confirmed: everything editable; In Production: still editable with restrictions; Partially Completed: only unfinished qty; Production Completed: read-only except Payments/Shipping/Notes).
- Line removal only allowed if `completed_qty = 0`.
- Ordered qty may only increase (never decrease below `completed_qty`).

## ORDER-7 — Status workflow expansion (Shipping/Cancellation) ⬜ Not Started

- Wire Ready for Shipping → Shipped → Delivered to the existing (unused) `order_shipments`/`couriers` tables.
- On Hold: pause only, inventory remains reserved.
- Cancelled: release remaining reserved inventory via `transfer_stock_status()`; never touch qty already consumed by production.

---

## Not built / open questions to resolve before or during build

- Exact mapping of the new status enum onto the existing `completed` value (legacy data + Production Report's `OrderStage` type both reference it — needs an explicit decision, not an assumption).
- Order-number format/reset cadence (yearly like quotes, or a different convention).
- Whether Order routing moves to `order_number`-based URLs (like Quotes did in QUOTE-7) or stays UUID-based — `PROGRESS-QUOTES.md` QUOTE-7 explicitly left Sales Orders on UUID routing "for now."
