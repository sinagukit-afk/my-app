# PROGRESS-ORDERS.md

Tracks the **Order Module Improvement** build for Sinag Ukit ERP. Follows the same convention as `PROGRESS-QUOTES.md`/`PROGRESS-CUSTOMERS.md`/`PROGRESS-INVENTORY.md`: `ORDER-` prefixed phases, kept separate from the core `PROGRESS.md` numbering. Append-only.

Source doc: `ORDER_MODULE_IMPROVEMENT.md` (handed over by Sinag from Downloads, 2026-07-06), assessed against the live app before any build. This is explicitly the deferred "future order page revision" phase referenced in `PROGRESS-QUOTES.md` (QUOTE-1: *"Reserved → deducted-at-completion stock transition, and partial-reservation-on-shortage — both deferred to a future 'order page revision' phase"*) and in `DECISIONS.md` D025.

**Status: 🟩 DONE.** ORDER-1 through ORDER-11 complete.

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

## ORDER-3 — Order Detail page ✅ DONE

**Kickoff decision (confirmed with Sinag, 2026-07-06):** the live RLS policies (`order_items_admin_update`, `orders_admin_update`) are **admin-only** — there is no manager-level UPDATE policy on either table, despite the original kickoff decision 2 saying "admin/manager." Rather than silently widening RLS as a side effect of this UI phase, Completed Qty entry is gated **admin-only** in the UI to match live RLS exactly; widening to admin+manager (if still wanted) is an explicit follow-up, not bundled here. See D028.

**What was built:**
- Migration `0036_order_items_completed_qty_check`: additive `CHECK (completed_qty <= quantity)` on `order_items`, enforcing "Ordered Qty must never be less than Completed Qty" at the DB layer (not just the UI). Verified via direct SQL that an out-of-range `UPDATE` is rejected with a `23514` constraint violation.
- New route `app/dashboard/orders/order-list/[id]/page.tsx` + `order-detail.tsx` (server/client split, mirrors `quotes/[quoteNumber]/quote-detail.tsx`): Order Summary card (status badge, customer, shipping/receiver info when `!same_as_customer`, notes), Line Items card (Ordered/Reserved/Completed Qty per line, editable Completed Qty inputs + Save button gated `canEnterCompletedQty` = admin-only), Payments card (payment list, Total Paid/Remaining Balance/Change, Payment Status badge — Unpaid/Partially Paid/Paid/Overpaid — computed client-side from `sum(order_payments.amount)` vs `total_money`, "Add Payment" dialog gated to admin/manager/encoder matching `order_payments` RLS), Activity Log card (same pattern as Quote Detail, `entity_type='order'`). Routing stays **UUID-based** (`[id]`, not `order_number`) per the still-open question in "Not built" below — unchanged from ORDER-2.
- Kept **UUID routing** deliberately, not `order_number`-based like Quotes (QUOTE-7) — that migration is still an open question (see bottom of this file), not decided in this phase.
- New server actions in `order-list/actions.ts`: `updateCompletedQty()` (loops individual `order_items` updates rather than a bulk `upsert`, per the ON-CONFLICT-checks-raw-INSERT-row gotcha documented for `adjust_stock` — see memory `project_adjust_stock_upsert_check_constraint_fix`) and `addOrderPayment()` (plain insert into `order_payments`, no RPC needed since this isn't stock-affecting). Both log to `activity_logs` on success, following the `convertQuote`/`cancelQuote` pattern (plain args, not FormData; error message surfaced straight from Postgres/RLS rather than pre-checking role in the action).
- Order List (`order-list-table.tsx`, `order-list/page.tsx`): removed the old View dialog and the Actions column entirely; rows now navigate to the new Detail page via `DataTable`'s `onRowClick`. `startProduction` moved into the Detail page header (shown when `canAdvance` = admin + status `confirmed`); Edit link also moved to the Detail header (shown when `canEdit` = admin/manager/encoder + status in `confirmed`/`in_production`, matching the edit page's own guard).
- Regenerated `lib/supabase/types.ts` after the migration.

**Verification:** `npm run build` clean (new `/dashboard/orders/order-list/[id]` route registered). Browser-verified end-to-end on a real order (Claude admin account): clicked a List row → landed on Detail; edited Completed Qty on one line, saved, confirmed via direct SQL the correct row updated (others untouched) and an `activity_logs` row was written; opened Add Payment, submitted a ₱100 Cash payment, confirmed the `order_payments` row, Payment Status flipping to "Partially Paid", and Total Paid/Remaining Balance updating on screen. Re-verified as the real `encoder` test account: Completed Qty renders as read-only text (no inputs, no Save button) while Add Payment remains available — matches the admin-only decision above. Confirmed the DB CHECK constraint itself rejects an out-of-range direct `UPDATE`. Test payment/activity rows cleaned up after verification. `get_advisors` shows no new findings (pre-existing warnings only).

**Not built (deferred, tracked as open follow-ups):**
- Whether to widen Completed Qty entry to admin+manager (would need a new RLS policy) — explicitly deferred, not decided here (see kickoff decision above).
- Status-gated action buttons beyond Edit/Start Production — the richer status-transition buttons (Ready for Shipping, Shipped, etc.) depend on ORDER-6/7, which don't exist yet.
- `completed_qty` still resets to 0 on any line-item edit via `adjust_order_items()`'s delete+reinsert (the gap ORDER-2/D027 flagged) — not fixed here; still open for ORDER-6.

## ORDER-4 — Order List rework ✅ DONE

**What was built:**
- `order-list-table.tsx` rewritten to mirror `quotes-table.tsx`'s pattern: added `FilterBar` (status, all 9 non-legacy statuses + All) and `DateRangeFilter` (`from`/`to` on `created_at`) above the table, both URL/state-driven the same way Quotes does it.
- Columns now: Order No. (`order_number`), Customer, Order Date (`created_at` date part), Created (`created_at` full timestamp), Modified (`updated_at`), Status (badge, extended `STATUS_VARIANT`/label map copied from `order-detail.tsx` to cover all 9 statuses instead of just `confirmed`/`in_production`), Total Items (sum of `order_items.quantity`, not line count), Order Total, Payment Status (badge — same Unpaid/Partially Paid/Paid/Overpaid derivation as Order Detail, computed from `sum(order_payments.amount)` vs `total_money`), Last Activity (latest `activity_logs` description for `entity_type='order'`, same lookup pattern as Quotes).
- Actions column was already removed in ORDER-3 (row click → Detail page); nothing further to remove here.
- `page.tsx` query dropped the old `.in("status", ["confirmed", "in_production"])` restriction — now fetches **all** orders (any status, including `cancelled`/`completed`) since the FilterBar's "All" option is now the mechanism for seeing everything, matching how Quotes shows all statuses by default. Added nested `order_payments(amount)` and `order_items(quantity)` (replacing the old `order_items(id, item_name_snapshot, quantity, unit_price, line_discount)` — no longer needed since the list no longer shows a line-item preview) to the select, plus `updated_at` and `order_number`.

**Verification:** `npx tsc --noEmit` clean. Browser-verified (Claude admin account) after killing a stale dev server holding this workspace's port 3000 lock: all 4 existing orders render (including `completed`/`confirmed`/`in_production` statuses now visible, previously hidden by the dropped status restriction); Total Items, Order Total, Payment Status (Partially Paid/Unpaid badges matched actual `order_payments` totals), and Last Activity columns all populated correctly; "In Production" status filter correctly narrowed 4 rows to 1; row click still navigates to Order Detail correctly.

**Not built / open follow-ups:**
- No "New Order" button added — Method 2 (direct creation) doesn't exist until ORDER-5.

## ORDER-5 — Create Order directly (Method 2) ✅ DONE

**What was built** (migration `order5_create_order_rpc`):
- New `create_order()` RPC: admin/manager/encoder-gated, takes `p_lines` (same shape as `adjust_order_items`'s line input), `p_target_date`, customer/note/receiver/fulfillment fields. Resolves the active store, inserts the `orders` row first (letting the existing `set_order_number()` trigger assign `order_number`, status hardcoded `confirmed`), then runs the **same greedy per-line partial-reservation loop as `adjust_order_items`** (ORDER-2/D027) — lines reserved in submitted order, each claiming feasible whole-unit stock via `transfer_stock_status()` before the next line is tried — then inserts `order_items` with the resulting `reserved_qty` and recomputes `subtotal`/`total_discount`/`total_money`. Logs an `order_created` row to `activity_logs` (Order Detail's Activity panel would otherwise start empty, unlike `convert_quote_to_order` which already logs `quote_converted`).
- New route `app/dashboard/orders/order-list/new/` (`page.tsx` + `new-order-form.tsx`): rather than importing Quotes' `QuoteLineItemsEditor` (which is modifier-aware — `order_items`/`order_payments` have no modifier-support table, unlike `quote_item_modifiers`), the line-items UI is copied from **Edit Order's own editor** (`edit-order-form.tsx`) instead, since it already matches `order_items`' exact shape (item/qty/unit price/discount, no modifiers) and keeps New/Edit visually and behaviorally consistent within the Orders module. Order Date + Target Date fields mirror Quotes' Quote Date/Valid Until pattern (target date auto-computed as order date + 5, editable, per the ORDER-1 kickoff decision). Same Shipping toggle/receiver fields as Edit Order.
- New `createOrder()` server action in `order-list/actions.ts`, same FormData/validation shape as `adjustOrderItems`, calling `create_order` instead. `ActionResult` extended with an optional `orderId` so the form can redirect straight into the new Order's Detail page.
- "New Order" button added to Order List's `PageHeader` (admin/manager/encoder-gated `canCreate`, same role check as Quotes' equivalent button), linking to `/dashboard/orders/order-list/new`.
- Regenerated `lib/supabase/types.ts`.

**Verification:** `npx tsc --noEmit` clean. Browser-verified end-to-end (Claude admin account, after killing a stale dev server holding this workspace's port — see ORDER-4 entry): filled Order Date/Target Date (auto-computed +5, confirmed editable), added a 3-qty line of "Pro-Keychain Leather, Rectangle with Card Sleeve" (a real composite) at ₱250, submitted — redirected straight to the new order's Detail page (`SOD26-0706-0005`), Activity Log showed "Order created directly". Confirmed via direct SQL: `order_number` sequential, `status='confirmed'`, `target_date` = order date + 5, `subtotal`/`total_money` = 750 (3×250), `order_items.reserved_qty = 3`, `created_by` set to the acting user. Confirmed the BOM expansion reserved correctly against real inventory: the 1:1 leather-keychain component dropped 99→96 available/+3 reserved, and two fractional (0.25-ratio) paper components each moved 0.75 available→reserved — correct partial/fractional math, not just whole-unit lines. Test order, its `order_items`, and the `activity_logs` row were deleted and the reservation released back to baseline (99/54/73 available, 0 reserved) after verification. `get_advisors` shows no new finding *category* (only the same pre-existing "anon can execute SECURITY DEFINER" warning class every other RPC in this project already has).

**Not built / open follow-ups:**
- No fulfillment-method input in the New Order form (Edit Order doesn't have one either — pre-existing gap, out of scope here).
- Method 1 (Convert Quote → Order) unchanged, still via `convert_quote_to_order()`.

## ORDER-6 — Progressive lock rules + line item rules ✅ DONE

**Kickoff decisions (confirmed with Sinag, 2026-07-06):** the doc's status matrix assumed a status-transition mechanism that didn't exist anywhere in the code — nothing previously set `partially_completed`/`production_completed`. Two gaps surfaced and resolved before building, per the same "flag doc/system mismatches" pattern as D028:
1. **Status auto-derives from Completed Qty**, not a manual picker: every time Completed Qty is saved, the order's status is recomputed from `sum(completed_qty)` vs `sum(quantity)` across its lines — `in_production` while 0, `partially_completed` while partial, `production_completed` once every line's `completed_qty = quantity`. Reversible both ways (reducing Completed Qty back to 0 reverts the status).
2. **New line items may still be added through Partially Completed** — only Production Completed fully freezes the line list. Confirmed/In Production/Partially Completed share one editable state; the two rules below (removal, qty floor) are what "restricted" means for In Production/Partially Completed versus Confirmed's unrestricted editing.

**What was built** (migration `0037_order_progressive_lock_rules`):
- New `recompute_order_status(p_order_id)`: derives `in_production`/`partially_completed`/`production_completed` from `order_items` totals; no-ops for any other status (`confirmed`, `cancelled`, `on_hold`, shipping statuses) so it never fights a status this phase doesn't own.
- New `update_completed_qty(p_order_id, p_updates)` RPC, replacing the app-side loop-of-`UPDATE`s from ORDER-3: admin-only, only callable while status is `in_production`/`partially_completed` (production must have actually started, and Production Completed freezes it), writes each line's `completed_qty`, calls `recompute_order_status()`, and self-logs to `activity_logs` — same self-contained pattern as `create_order`. `updateCompletedQty()` in `actions.ts` now just calls the RPC instead of looping raw `UPDATE`s + a separate log insert.
- Rewrote `adjust_order_items()`: allowed-status set widened to `confirmed`/`in_production`/`partially_completed`/`production_completed`. At `production_completed`, the function takes an entirely separate early branch that updates only customer/note/shipping/fulfillment fields and returns — `p_lines` is never parsed, so line items are structurally impossible to touch, matching "read-only except Payments/Shipping/Notes" (Payments were already status-independent via the existing Add Payment dialog). For the other three statuses, each submitted line now carries an optional `id` (the existing `order_item.id`, absent for new lines); the function matches on it to (a) reject the call outright if any existing line with `completed_qty > 0` is missing from the submitted set ("Cannot remove a line item that already has completed quantity recorded against it"), and (b) carry `completed_qty` forward onto the reinserted row instead of resetting it to 0 (the gap ORDER-2/ORDER-3 both flagged as open). A pre-check rejects any submitted quantity below the matched line's `completed_qty` with a clear message; the existing `order_items_completed_qty_le_quantity` CHECK (ORDER-3) remains the DB-level backstop. `recompute_order_status()` runs at the end so quantity edits that change the ordered/completed ratio re-derive status too, not just Completed Qty saves.
- `OrderItemInput` (`actions.ts`) gained an optional `id`. `EditOrderForm` (`edit-order-form.tsx`) now carries `existingId`/`completedQty` per row: Remove is disabled (with a tooltip) for any row with `completedQty > 0`, the Quantity input's `min` becomes that row's `completedQty` instead of `0.01`, and when `status === 'production_completed'` the entire Line Items card renders read-only (all inputs `disabled`, Add Row hidden) while Customer/Notes/Shipping stay editable — the same submit path is used either way since the RPC's locked branch ignores whatever items are submitted.
- Edit Order's page guard (`[id]/edit/page.tsx`) widened from `confirmed`/`in_production` to also allow `partially_completed`/`production_completed`; now fetches `id` and `completed_qty` per line to feed the form. Order Detail (`[id]/page.tsx`): `canEdit` widened the same way; `canEnterCompletedQty` gained a status check (`in_production`/`partially_completed` only, on top of the existing admin-only role gate from ORDER-3/D028) so Completed Qty can't be entered before production starts or after it's marked complete.
- Regenerated `lib/supabase/types.ts`.

**Verification:** `npx tsc --noEmit` clean. Direct-SQL, on a real order (`SOD26-0706-0004`, 3 lines): confirmed removal-rule rejection (tried dropping a line with `completed_qty=1`, got the expected exception); confirmed the qty-floor rejection (tried shrinking a line's quantity below its `completed_qty`, got the expected exception); confirmed a valid edit increasing two lines' quantities carried `completed_qty` forward correctly on the reinserted rows and left status unchanged; confirmed `update_completed_qty` auto-transitioned the order `in_production → partially_completed → production_completed` as completed totals rose; confirmed the `production_completed` locked branch updated `note` while leaving all 3 `order_items` rows completely untouched (same count, same qty sum) even when garbage line data was submitted. Order fully restored to its original 3-line/stock baseline afterward, and the two test `activity_logs` rows were deleted. `get_advisors` (security) shows no new finding *category* beyond the same pre-existing "anon can execute SECURITY DEFINER" class every RPC in this project already has.

**Not verified in this phase:** browser/UI verification could not be run — this session's preview tooling couldn't reach a dev server (another session already had one running in this workspace, and repeated `preview_start` attempts here weren't tracked by `preview_list`/reachable by the other preview tools). The UI wiring (disabled inputs, status-gated visibility) is a direct reflection of props/conditions already covered by a clean `tsc` pass and the RPC-level SQL verification above, but a real click-through pass on Edit Order / Order Detail at each status is still owed before calling this fully done end-to-end.

**Not built (deferred, tracked as open follow-ups):**
- No dedicated Notes/Shipping-only UI was built for Production Completed — it reuses the existing Edit Order page with the Line Items card disabled, so no new surface was needed. If a lighter-weight editor is ever wanted, that's a separate ask.

## ORDER-7 — Status workflow expansion (Shipping/Cancellation) ✅ DONE

**Kickoff decisions (confirmed with Sinag, 2026-07-06)**, resolving the TBDs `MODULE_STATUS.md`'s Shipping entry and `PROGRESS-CUSTOMERS.md` Part 2 had flagged as blocking:
1. **Cancel release amount:** release the *full* `reserved_qty` of every line back to available, regardless of `completed_qty`. There is no separate "consumed" inventory bucket — Production consumption is explicitly out of scope for Inventory Phase 1 (`PROGRESS-INVENTORY.md`) — so `completed_qty` stays a manual tracking number with no inventory-side effect.
2. **Cancel scope:** `confirmed`/`in_production`/`partially_completed` only, **admin-only** (matches the existing admin-only `orders_admin_update` RLS exactly, same gap D028 found for Completed Qty).
3. **On Hold scope:** `confirmed`/`in_production`/`partially_completed`/`production_completed`/`ready_for_shipping`, admin-only. Resume restores whichever status the order was in right before being held.
4. **Pickup vs delivery:** the Ready for Shipping → Shipped → Delivered chain (and `order_shipments`/`couriers`) applies to delivery orders only. Pickup orders skip straight from `production_completed` to `delivered` — no `order_shipments` row created.
5. **Shipment actions role:** admin + encoder (matches the existing `order_shipments` RLS policies exactly — no RLS change needed).
6. **Shipping fees:** `shipping_cost`/`shipping_fee_charged` are informational only on the shipment record — no effect on `orders.total_money` or the existing Payment Status derivation.

**Blocker found and fixed as a prerequisite:** `orders.fulfillment_method` existed as a schema column (and both `create_order`/`adjust_order_items` already accepted a `p_fulfillment_method` param) but **no UI ever set it** — every order in the app had it `NULL`, which would have made the pickup/delivery branch above undecidable. Added a "Fulfillment Method" select (Pickup/Delivery, defaults to Pickup) to both New Order and Edit Order forms, and wired `fulfillment_method` through `createOrder`/`adjustOrderItems` in `actions.ts`, which previously omitted the param entirely (silently NULLing it on every save). Orders with `fulfillment_method` still `NULL` (any row created before this phase and never edited since) are treated as pickup-eligible by `mark_ready_for_shipping`/`mark_picked_up`'s guards (`<> 'pickup'` / `<> 'delivery'`), so both actions remain available until the order is explicitly edited to set one.

**What was built** (migration `0038_order_status_workflow`):
- `orders.on_hold_previous_status` (nullable text, `CHECK` restricted to the 5 holdable statuses) — stores what to restore on Resume, since Resume can't be derived from data the way `recompute_order_status()` derives the production-family statuses.
- `order_shipments_status_check` — additive `CHECK (status IS NULL OR status IN ('shipped','delivered'))`, the column had no constraint before.
- Seven new RPCs, all following the existing self-contained pattern (role-check inside the function body, not just RLS; own `activity_logs` insert): `cancel_order()` (releases the full BOM-expanded reservation footprint via `transfer_stock_status`, same expansion query pattern as `adjust_order_items`' release step), `hold_order()`/`resume_order()` (store/restore `on_hold_previous_status`), `mark_ready_for_shipping()`/`mark_picked_up()` (the `production_completed` fork, gated on `fulfillment_method`), `ship_order()` (inserts the `order_shipments` row, takes courier/tracking/cost/fee/note), `mark_delivered()` (updates the `order_shipments` row's `delivered_at`/`status` when one exists — a no-op `UPDATE` for the pickup path where none was created).
- These RPCs bypass RLS via `SECURITY DEFINER` deliberately: `mark_ready_for_shipping`/`mark_picked_up`/`ship_order`/`mark_delivered` need to let **encoder** write `orders.status`, which the admin-only `orders_admin_update` RLS policy would otherwise block (same rationale as D023's extension of `adjust_order_items`).
- New Couriers management page (`app/dashboard/orders/couriers/`, `page.tsx`/`couriers-table.tsx`/`courier-form.tsx`/`actions.ts`) — mirrors the existing Suppliers page pattern. The `couriers` table existed since migration `0023_shipping` but had no admin UI at all; needed so staff can populate the courier picker in the new Ship Order dialog. Write access is admin-only (matches `couriers`' existing "Admin full access" RLS — there's no manager/encoder write policy on this table). Added to the sidebar nav under Orders.
- Order Detail (`order-detail.tsx`/`page.tsx`): new action buttons in the header (Mark Ready for Shipping, Mark Picked Up, Ship Order, Mark Delivered, Resume Order, Put On Hold, Cancel Order), each gated by a `can*` boolean computed server-side from role + current status + `fulfillment_method` (mirroring the existing `canEdit`/`canAdvance` pattern). New "Ship Order" dialog (courier select, tracking number, shipping cost, shipping fee charged, note). New Shipment card (courier, tracking, shipped/delivered timestamps, cost/fee, note) rendered when an `order_shipments` row exists.
- `actions.ts`: seven new thin server actions (`cancelOrder`/`holdOrder`/`resumeOrder`/`markReadyForShipping`/`markPickedUp`/`markDelivered`/`shipOrder`) sharing one `callOrderStatusRpc()` helper (RPC call + `revalidatePath` on List/Detail/Stock Movement).
- Regenerated `lib/supabase/types.ts`.

**Verification:** `npx tsc --noEmit` clean. `get_advisors` (security) shows no new finding *category* — only the same pre-existing anon/authenticated SECURITY DEFINER-executable warning class every other RPC in this project already has, plus the unrelated pre-existing leaked-password-protection setting.

Direct-SQL, JWT claim set to the Claude admin test account (this session's browser preview tooling could not reach a dev server — another session already had one running in this workspace, same limitation ORDER-6 hit):
- **Cancel:** created a test order (qty 3, tracked variant), confirmed `reserved_qty=3`/`available_qty` dropped by 3, called `cancel_order` → status `cancelled`, confirmed full release back to available (94/0 baseline restored). Re-cancelling the already-cancelled order correctly raised an exception.
- **Hold/Resume:** held a `confirmed` order → `status='on_hold'`, `on_hold_previous_status='confirmed'`; confirmed `cancel_order` on the held order is correctly rejected ("cannot be cancelled from its current status (on_hold)"); `resume_order` correctly restored `status='confirmed'` and cleared `on_hold_previous_status`.
- **Delivery chain:** drove a test order through `in_production` → `production_completed` (via direct status update + `update_completed_qty`), confirmed `mark_picked_up` is rejected for a delivery order, then `mark_ready_for_shipping` → `ready_for_shipping`, `ship_order` (with a temporary test courier) → `shipped` + `order_shipments` row created with correct courier/tracking/cost/fee/`shipped_at`, `mark_delivered` → `delivered` + the same `order_shipments` row updated with `delivered_at`/`status='delivered'`.
- **Pickup chain:** same production setup with `fulfillment_method='pickup'`; confirmed `mark_ready_for_shipping` is rejected, `mark_picked_up` → `status='delivered'` directly with **zero** `order_shipments` rows created.
- **Role gates:** `manager` correctly rejected from `cancel_order` ("Not authorized to cancel orders"); `encoder` correctly rejected from `hold_order` ("Not authorized to place orders on hold"); `encoder` correctly *passed* the role check on `mark_ready_for_shipping` (failed only on the status guard, proving the role gate itself allows encoder).
- All test orders/items/shipments/activity-log rows and the temporary test courier were deleted afterward; the test variant's reservation was manually released back to available (`transfer_stock_status`) since delivered orders don't auto-release, restoring the exact 94/0 baseline.

**Not verified in this phase:** browser/UI click-through — same tooling limitation ORDER-6 hit (another session's dev server already holds this workspace, not reachable from this session's preview tools). The new buttons/dialog/card are a direct reflection of the `can*` booleans and `OrderDetailData` fields already covered by a clean `tsc` pass and the RPC-level SQL verification above, but a real UI pass (as both the Claude admin and Claude encoder test accounts) is still owed before calling this fully done end-to-end.

**Not built / open follow-ups:**
- No UI surfaces `on_hold_previous_status` directly (Resume Order button just calls the RPC) — not needed since the RPC derives the restore target itself.
- Orders with `fulfillment_method` still `NULL` (pre-existing rows never edited since this phase) are treated as eligible for *both* Mark Ready for Shipping and Mark Picked Up until edited — an acceptable default given no data exists to infer real intent, but worth resolving with a real backfill decision if it ever becomes a live nuisance.
- Shipping fee reconciliation against `orders.total_money`/Payment Status remains explicitly out of scope per kickoff decision 6 above.

---

## ORDER-8 — `order_number`-based routing ✅ DONE

**Requested by Sinag (2026-07-06):** Order Detail/Edit URLs should be `order_number`-based (e.g. `/dashboard/orders/order-list/SOD26-0706-0001`), same pattern as Quotes (`quotes/[quoteNumber]`, QUOTE-7) — resolves the open question ORDER-3/ORDER-7 both left deferred.

**What was built:**
- Renamed `app/dashboard/orders/order-list/[id]/` → `.../[orderNumber]/` (both the Detail and `edit/` subroute). Both `page.tsx`s now resolve the order via `.eq("order_number", orderNumber)` instead of `.eq("id", id)`; the resolved `order.id` is still used internally for every RPC call, `order_items`/`order_payments`/`activity_logs` lookup, etc. — only the URL param and the initial lookup changed.
- `order-list-table.tsx`'s row-click navigation now pushes `/dashboard/orders/order-list/${row.orderNumber}` (dropped the now-unused `id` field from `OrderRow`/`order-list/page.tsx`'s row mapping).
- `order-detail.tsx`'s Edit link now points at `${data.orderNumber}/edit`.
- `create_order`'s post-submit redirect (`new-order-form.tsx`) now uses the RPC's returned `order_number` (added to `ActionResult`/`createOrder()` in `actions.ts`) instead of the UUID.
- Quote Detail's "View linked Sales Order" link (`quote-detail.tsx`) was UUID-based (`converted_order_id`) and would have 404'd against the new route — `quotes/[quoteNumber]/page.tsx` now does a small extra lookup (`orders.order_number` by `converted_order_id`) and passes `convertedOrderNumber` instead. Also changed the link's target from `.../edit` to the Order Detail page itself (a small drive-by fix: Detail didn't exist yet when that link was originally written pre-ORDER-3, and landing on Detail first is more consistent with how the Order List's own row-click behaves).
- Stale `.next/types` build cache (referenced the deleted `[id]` route, causing a false `tsc` error) was cleared — regenerates automatically, not a real regression.

**Verification:** `npx tsc --noEmit` clean. Browser-verified (Claude admin account): Order List row click → `/order-list/SOD26-0706-0005`; Edit link → `/order-list/SOD26-0706-0005/edit`; New Order submit → redirected straight to the new order's `order_number` URL; Quotes → SQT26-0706-0002 → "View linked Sales Order" → correctly landed on `/order-list/SOD26-0706-0004` (a `delivered` order, Edit button correctly absent per `canEdit`'s status gate).

## ORDER-9 — Line item editor parity with Quotes (discount + modifier support) ✅ DONE

**Requested by Sinag (2026-07-06):** New Order and Edit Order's line-items editor should match Quotes' `QuoteLineItemsEditor` — a Discount picklist (fixed %/fixed amount/variable, with manual entry for variable types) and per-item Modifier selects, not just a bare quantity/unit-price/manual-discount-number row.

**Schema gap found and closed** (migration `order9_discount_and_modifiers_schema`): `quote_items.discount_id` (FK → `discounts`) had no `order_items` counterpart, and `quote_item_modifiers` had no `order_items` equivalent at all. Added `order_items.discount_id` (nullable FK to `discounts`) and a new `order_item_modifiers` table (`order_item_id` FK `ON DELETE CASCADE`, `modifier_id`, `modifier_option_id`, `name_snapshot`, `price_snapshot`), RLS mirroring `order_items`' own policy set exactly (`select_all`/`insert_encoder_manager_admin`/`admin_update`/`admin_delete` — no "own order" restriction, since all order writes go through the RPCs below, not direct table access).

**RPC rework** (`create_order()` and `adjust_order_items()`, both reapplied via `apply_migration`): `p_lines`' expected shape grew two fields — `discount_id` (nullable uuid) and `modifiers` (a jsonb array of `{modifier_id, modifier_option_id, name_snapshot, price_snapshot}`, same shape Quotes already sends). Both functions were restructured so the `order_items` insert happens **inside** the per-line reservation loop (one row at a time via `INSERT ... RETURNING id`) instead of a bulk `INSERT ... SELECT` afterward, so each new row's id is available immediately to insert its `order_item_modifiers` rows. `adjust_order_items`' existing delete-then-reinsert edit flow needed no extra handling for cleanup — deleting an `order_items` row already cascades to its `order_item_modifiers` via the FK. Both functions' final subtotal/total_money computation now left-joins a per-`order_item` sum of `order_item_modifiers.price_snapshot` and folds it in as `quantity * (unit_price + modifier_total) - line_discount`, matching `order-line-items.tsx`'s (and Quotes') client-side `lineTotal()` formula exactly.

**UI:** New shared `app/dashboard/orders/order-list/order-line-items.tsx` (`OrderLineItemsEditor` + `resolveOrderLines`/`emptyOrderRow`/`lineTotal` helpers) — a duplicate-not-shared-with-Quotes component (per ORDER-5's own precedent of duplicating rather than importing `QuoteLineItemsEditor`, and since Quotes/Orders progress docs have been kept deliberately separate throughout this project) that additionally carries `existingId`/`completedQty` per row and a `locked` prop, folding in ORDER-6's progressive-lock rules (Remove disabled once `completedQty > 0`, quantity floor at `completedQty`, entire editor disabled + Add Row hidden when `locked` — used for the `production_completed` freeze) that Quotes' own editor has no equivalent of. Wired into both `new-order-form.tsx` and `edit-order-form.tsx` (and their `page.tsx`s, which now fetch `discounts`/`item_modifiers` the same way Quotes' New/Edit pages do); `edit/page.tsx` also now fetches each existing line's `order_item_modifiers` to seed `modifierSelections`. `OrderItemInput` (`actions.ts`) gained `discount_id`/`modifiers` fields — no other `actions.ts` changes needed since `p_lines` was already passed through generically. Order Detail (`order-detail.tsx`) now also fetches and displays each line's modifiers/discount (same "Name (+₱price)" / "Discount: -₱x" sub-line Quote Detail already shows), and its `lineTotal()` helper was updated to fold in modifier cost the same way.

**Verification:** `npx tsc --noEmit` clean after regenerating `lib/supabase/types.ts`. `get_advisors` (security) shows no new finding *category* (only the same pre-existing anon/authenticated SECURITY DEFINER-executable warning class every RPC in this project already has). Browser-verified end-to-end (Claude admin account) on real orders:
- **Edit Order:** opened `SOD26-0706-0005`, confirmed Discount and per-item Modifier selects render correctly and are scoped to each line's own item (Keychain line showed Keychain modifiers, Coaster line showed Coaster modifiers); selected a 10% discount + a modifier option, watched the line total update client-side (₱50 → ₱45), saved, confirmed via direct SQL that `order_items.discount_id`/`line_discount` and the new `order_item_modifiers` row persisted correctly and `orders.subtotal`/`total_money` recomputed to ₱45.
- **New Order:** created a test order with a composite item + 15% discount + a modifier selection; confirmed via SQL that `discount_id`, the modifier row, and `reserved_qty` (BOM-expanded against real component stock) all persisted correctly through `create_order`.
- Both test artifacts were cleaned up afterward: the test order's stock reservation was released component-by-component via `transfer_stock_status` (its composite item itself had no direct `inventory_levels` row — only its two raw-material components did, confirming ORDER-2's "track_stock lives on the component, never the composite" note still holds), the test order deleted, and the real order's test discount/modifier edit reverted back to its original ₱50/no-discount baseline.
- Test data note: no modifier option in the live dataset carries a non-zero `price` today, so the "modifier price folded into subtotal" arithmetic path was verified by formula/code review (identical to Quotes' already-verified `lineTotal()`) rather than a non-zero live example — flagged per [[project_test_data_status]], not a gap in the implementation.
- Incidentally re-triggered (and this time correctly avoided reacting badly to) the known `button[type="submit"]` Sign-Out mis-click pitfall — see [[feedback_preview_submit_button_targeting]] for the updated (4th) recurrence note.

**Not built / open follow-ups:**
- No RLS widening — `order_item_modifiers` writes only ever happen through the `SECURITY DEFINER` RPCs, matching how `order_items` itself already works.
- Modifier/discount editing is not yet exposed anywhere the Completed-Qty-only "read-only Line Items" state doesn't already cover (i.e. `production_completed` freezes everything uniformly, same as before this phase) — no separate lock granularity was requested.

---

## ORDER-10 — Fix `target_date` NOT NULL crash on Quote → Order conversion ✅ DONE

**Bug reported by Sinag (2026-07-06):** clicking "Convert to Order" on a quote (`SQT26-0706-0003`) threw `null value in column "target_date" of relation "orders" violates not-null constraint".

**Root cause:** ORDER-1 added `orders.target_date` as `date NOT NULL` with no DB default (by design — see ORDER-1's note, the value has to come from app code). `create_order()` (ORDER-5) and the New Order form always supply it, but `convert_quote_to_order()` (predates ORDER-1, never revisited) was never updated to accept or set it — every quote conversion was broken since ORDER-1 shipped, not just this one quote.

**Two more pre-existing gaps found and fixed while rewriting this function** (it was already being rewritten for the fix above, so leaving them broken in the same pass would have shipped a known-bad function):
- `order_items.reserved_qty` (added in ORDER-1, wired into `create_order`/`adjust_order_items` in ORDER-2) was never populated by `convert_quote_to_order` — every converted order had `reserved_qty=0` on its lines despite stock actually being reserved.
- `order_items.discount_id` and `order_item_modifiers` (added in ORDER-9, wired into `create_order`/`adjust_order_items`) were never carried over from `quote_items`/`quote_item_modifiers` — a quote's discounts and modifier selections were silently dropped on conversion.

**What was built** (migration `order10_convert_quote_target_date_fix`, applied directly via Supabase MCP — no local `.sql` file, this project's migrations live in the Supabase project, not the repo):
- `convert_quote_to_order(p_quote_id uuid, p_target_date date)` — new required param, raises `'Target date is required'` if null, sets it on the `orders` insert.
- Rewrote the `order_items` insert as a per-line loop with `RETURNING id` (matching `create_order`'s ORDER-9 pattern) instead of a bulk `INSERT ... SELECT`, so each new row's id is available to insert its `order_item_modifiers` from the matching `quote_item_modifiers` without any join-based matching ambiguity. `reserved_qty` set to the full line quantity (quote conversion has no partial-reserve path — the upfront stock check already guarantees enough stock exists, unlike `create_order`/`adjust_order_items`'s greedy partial model).
- `convertQuote()` (`app/dashboard/orders/quotes/actions.ts`) now takes a `targetDate` param and passes it through; rejects up front if empty.
- Quote Detail's "Convert to Order" button (`quote-detail.tsx`) no longer fires on a bare `confirm()` — it opens a dialog (same shape as the existing Cancel dialog) with a required Target Date picker, defaulting to today + 5 days (same default as the New Order form), before calling `convertQuote`.
- Regenerated `lib/supabase/types.ts`.

**Verification:** `npx tsc --noEmit` clean. Direct-SQL, wrapped in `BEGIN`/`ROLLBACK` against the real quote from the bug report (`SQT26-0706-0003`): `convert_quote_to_order(id, current_date + 5)` succeeded (previously failed with the reported error), returned an order with `order_number='SOD26-0706-0006'`, `target_date` = today+5, `status='confirmed'`, `subtotal`/`total_money=2750` matching the quote; confirmed the rollback left the quote untouched (`status='open'`, `converted_order_id=null`) and no order row persisted. Browser click-through **not done this session** — a dev server for this workspace was already running under the user's own active session (the one that produced the bug screenshot), and killing another session's server to free the port wasn't appropriate here; Sinag should retry the Convert action in that same browser tab to confirm end-to-end. `get_advisors` (security) shows no new finding *category* — same pre-existing anon/authenticated SECURITY DEFINER-executable warning class every RPC in this project already has.

**Not built / open follow-ups:**
- No real UI click-through this session (see above) — low risk given the direct-SQL RPC verification, but still owed.

## ORDER-11 — CSV export with scope picker for Active Orders ✅ DONE

**Requested by Sinag (2026-07-10):** add an "export to Excel" button to the Active Orders table (piloted here, generalizable to other `DataTable` screens later), then upgraded mid-session to a scope picker (Current Filter / This Month / Last Month / This Year / All Time) instead of a single direct-download button.

**Note on numbering:** this was committed to git as "ORDER-10" before this doc was checked — that code was already taken by the `target_date` NOT NULL fix above. Filed here as ORDER-11 to avoid the collision; the pushed commit subject line still says ORDER-10 and was left as-is rather than rewriting already-pushed history.

**Library decision:** the obvious `xlsx` (SheetJS) npm package was installed first, but `npm audit` flagged it with a high-severity prototype-pollution advisory and a ReDoS advisory, both with "no fix available" on the registry. Uninstalled it rather than build on it. `exceljs` was considered next but pulls in ~96 packages / 21.8MB (archiver, jszip, unzipper) for a need that's just flat rows. Landed on a dependency-free CSV export instead — Excel opens `.csv` natively on double-click, which covers this use case (flat rows, no formulas/multi-sheet/rich formatting needed).

**What was built:**
- `components/ui/data-table.tsx`: generic `downloadCsv()` helper (UTF-8 BOM for the ₱ sign, proper quote/comma escaping) exported for reuse, plus an optional `exportFilename` prop that renders a simple single-button "Export to Excel" affordance for tables that don't need a scope picker. `Column<T>` gained an optional `exportValue` per-column override, since `render` often returns JSX (badges, formatted dates) that isn't usable as a cell value — defaults to the raw field value when omitted.
- `lib/utils/date-range-presets.ts`: extracted the This Month/Last Month/This Year/All Time date-math out of `components/business/date-range-filter.tsx` (which now imports it) so the export dialog can reuse the exact same preset definitions instead of duplicating the month/year arithmetic.
- `app/dashboard/orders/active-orders/queries.ts`: extracted `page.tsx`'s order-fetch-and-shape query (the same one driving the on-screen list) into a standalone `fetchOrderRows(from, to)` so it can be called a second time, with a different date range, from the export path without duplicating the Supabase query/mapping logic.
- `app/dashboard/orders/active-orders/actions.ts`: new `exportOrders(from, to)` server action, a thin wrapper around `fetchOrderRows`.
- `app/dashboard/orders/active-orders/order-list-table.tsx`: replaced the single Export button with a `Dialog`-based scope picker (radio list, `Current Filter` selected by default). **Current Filter** exports client-side from the already-loaded `filteredData` (current date range + current Status filter, but *not* whatever text is typed into `DataTable`'s own search box — that state is private to `DataTable` and wasn't lifted up for this). **This Month / Last Month / This Year / All Time** each call `exportOrders()` for a fresh full-period snapshot — deliberately **ignoring** whatever Status filter tab is active on screen (confirmed with Sinag: these are period snapshots across all statuses, not "current status × different date range").

**Verification:** `npx tsc --noEmit` and `eslint` clean on all touched files (2 pre-existing `react-hooks/static-components` lint errors in `data-table.tsx`, confirmed via `git stash` to predate this change). Browser-verified end-to-end (Claude admin account): dialog renders all 5 options; **Current Filter** downloads client-side with no server round-trip (dialog closes, no console errors); **This Month** correctly POSTs to the server action and returns properly-shaped `OrderRow[]` JSON (inspected the raw response body); **All Time** (empty `from`/`to`, exercising the `if (from) query.gte(...)` skip-path) completes cleanly with no errors. Did not verify **Last Month**/**This Year** individually in-browser beyond the shared code path already covered by This Month + All Time — both go through the identical `exportOrders()` call with a different computed range from the same `DATE_RANGE_PRESETS` list.

**Not built / open follow-ups:**
- Not rolled out to any other `DataTable` screen yet — Active Orders was an explicit pilot (Sinag's choice); the plain single-button `exportFilename` prop on `DataTable` is ready for tables that don't need date-range scoping, and the scope-picker `Dialog` pattern in `order-list-table.tsx` would need to be copied (not yet extracted into a shared component) for any other date-filtered table that wants the same picker.
- "Current Filter" does not include the `DataTable` search box's typed text, only the date range + Status filter — see the note above; would need `DataTable` to lift its internal search state up via a callback prop if that's ever wanted.
- Git commit subject line says ORDER-10 (numbering collision — see note above); not corrected via amend/force-push since the commit was already pushed to `origin/main`.

## Not built / open questions to resolve before or during build

- Exact mapping of the new status enum onto the existing `completed` value (legacy data + Production Report's `OrderStage` type both reference it — needs an explicit decision, not an assumption).

---

**2026-07-06 — path update (D031):** Operations nav restructure moved
several routes referenced throughout this doc: `orders/order-list` →
`orders/active-orders`, `orders/quotes` → `orders/quotation`,
`orders/production-queue` → `orders/production`, `orders/couriers` →
`management/couriers`, `orders/customers` → `management/customers`,
`inventory/items` → `management/items`, `inventory/suppliers` →
`management/suppliers`, `purchasing/purchase-orders` →
`inventory/purchase-orders`, `purchasing/receiving` →
`inventory/receiving`. All code references updated; historical entries
above describe the state at build time under the old paths. See
`DECISIONS.md` D031.

**2026-07-07 — manual Completed Qty retired (PS-3):** ORDER-3/D028's
admin-only manual Completed Qty entry (the "no Production module
exists yet" stopgap noted above) is retired now that one does.
`completed_qty` is set automatically when a Production Order is
completed (`complete_production_order()`); Order Detail's Completed
Qty column is now read-only and links to the owning Production Order.
The `update_completed_qty()` RPC and its UI wiring were removed from
`active-orders/actions.ts`/`order-detail.tsx`; the RPC itself was left
in the database (not dropped) per this project's additive-migrations
convention. See `PROGRESS-PRODUCTION-SHIPPING.md` PS-3.

**2026-07-07 — `completed`/`delivered` alias resolved (PS-7):** the open
question above (line 236) is resolved in favor of `delivered` as the
single terminal `orders.status` for both pickup and delivery orders.
The 2 live `completed` rows were migrated to `delivered` and
`'completed'` was dropped from `orders_status_check`. See
`PROGRESS-PRODUCTION-SHIPPING.md` PS-7 and `DECISIONS.md` D035.

---

**2026-07-19 — Quote-to-Shipping UX audit (12 fixes), commit `8af5364`:**
Sinag requested a UX audit of the Order process end-to-end (Quote →
Order → Confirmed → Production → Shipping, persona: Senior ERP UX
Auditor), then asked to implement every finding. All 12 items landed in
one session, UI/navigation only — no schema or RPC changes:

1. **Currency formatting** — every local `peso()`/inline
   `` ₱${n.toFixed(2)} `` helper across Quotation, Active Orders,
   Confirmed, On Hold, Completed, and Finance → Customer Payment was
   replaced with the shared `formatCurrency()` (`lib/utils/format.ts`).
   Money had been rendering without thousands separators app-wide in
   this module (e.g. `₱123456.78` instead of `₱123,456.78`).
2. **Completed archive traceability** — `completed-table.tsx` now shows
   Order No. and its row click routes to the canonical
   `active-orders/[orderNumber]` detail page instead of a stripped
   read-only modal that had no shipments/payments/activity log and
   didn't even surface the order number.
3. **`ConfirmedOrderDetail` parity** — gained an Activity Log card and a
   "View Full Order →" link, matching the thin-view-plus-link pattern
   Shipping/Payment's own detail views already used.
4. **Searchable item picker** — Quote/Order line-item editors
   (`quote-line-items.tsx`/`order-line-items.tsx`) swapped the plain
   `Select` for the searchable `Combobox`, matching Purchasing's
   existing item-picker pattern.
5. **Silent line-item drop** — a row with a selected item but a
   zero/blank quantity now shows an inline "Won't be saved — enter a
   quantity" warning instead of silently vanishing from the saved
   Quote/Order with only a generic top-level error if every row was
   invalid.
6. **Dead breadcrumb** — `/dashboard/orders` added to
   `components/layout/app-shell.tsx`'s `NON_ROUTABLE_PATHS`; the
   "Orders" breadcrumb segment on every nested order page had been a
   dead link to a "Coming soon" stub (that page itself isn't in the
   sidebar nav, only reachable via the breadcrumb).
7. **Reserved Qty override confirmation** — saving a Reserved Qty
   change (Order Detail + Confirmed Detail) now requires confirming an
   item-by-item before→after diff dialog first, matching the
   confirm-before-mutate pattern every other stock-affecting action on
   the page already used (Cancel/Hold/Start Production).
8. **Merged shipment forms** — "Add Shipment" now opens the same Dialog
   used for editing (pre-filled to each line's full remaining
   quantity) instead of navigating to a separate full-page form with
   near-duplicate state/validation/AI-autofill wiring; deleted the
   now-redundant `active-orders/[orderNumber]/shipments/new/` route
   (see `PROGRESS-PRODUCTION-SHIPPING.md` PS-24).
9. **CSV export coverage** — added the `DataTable` `exportFilename`
   button (ORDER-11's plain-button variant) to Quotation, Confirmed,
   Production, both Shipping tables, and On Hold — previously only
   Active Orders had export.
10. **Jump-to nav** — added an anchor-link row (Summary/Line
    Items/Shipments/Payments/Activity Log) to the top of Order Detail,
    conditionally showing Shipments only when that section renders.
11. **Date auto-recompute gotcha** — in both New Quote and New Order,
    manually editing Valid Until/Target Date and then changing the
    Quote/Order Date was silently overwriting the manual edit; both
    forms now track whether the derived field has been touched and
    stop auto-recomputing it once it has.
12. **Completed ↔ Active Orders link** — Active Orders' status filter
    now reads an initial value from a `?status=` URL param
    (`OrderListTable`'s new `initialStatus` prop), and the Completed
    page links to `/dashboard/orders/active-orders?status=completed` —
    one canonical, more capable path (Payment Status, richer filters)
    to the same data instead of two divergent views.

**Verification:** `npx tsc --noEmit` and `eslint` clean on every touched
file (two pre-existing, untouched `_id`/`_poStatus` unused-var warnings
in `quotation/actions.ts`/`shipping/page.tsx` confirmed unrelated).
Browser-verified end-to-end (Claude admin test account): thousands
separators on Completed/Quotation/Customer Payment lists; Completed row
click landing on the full order detail with shipments/payments/activity
log intact; Combobox type-to-filter narrowing to matching SKUs on New
Order; the zero-qty inline warning appearing the moment a quantity is
cleared; the Reserved Qty confirm dialog showing the correct
item/before/after diff; "Add Shipment" opening in place (URL unchanged)
with each line pre-filled to its remaining quantity; manually-set Valid
Until/Target Date surviving a subsequent Quote/Order Date change; and
the Completed → Active Orders `?status=completed` link landing
pre-filtered. No new console or server errors.

---

**2026-07-19 — Customer Payment audit + fixes (FIN-2), all 9 items done:** Sinag asked for a
UX audit of Customer Payment, then to implement every finding. Confirmed live gap: shipping
fee charged to the customer was optional and unrecoverable once a shipment shipped (3 real
delivered shipments had ₱0 billed to the customer despite real courier cost). Fixed same
session: fee now required at entry (client + RPC), a new `update_shipment_fee()` RPC +
"Edit Fee" dialog lets staff correct it post-ship until payment is closed, `order_payments`
inserts are now blocked once payment is closed or the order is cancelled (RLS + action),
Cancel Order warns when payments exist, `total_tax` is wired into Total Due everywhere, plus
3 smaller UX fixes (quick-fill full balance, pending-fee badge in Finance's list, clearer
Change/Tip wording). Full write-up, verification detail (including 2 server-side bypass
tests run directly via SQL), and the 2 still-unfixed historical shipments live in
`PROGRESS-FINANCE.md` FIN-2 (that's where Customer Payment itself lives, per FIN-1's
relocation from `orders/payment/`); shipping-specific slice cross-referenced from
`PROGRESS-PRODUCTION-SHIPPING.md` PS-25.
