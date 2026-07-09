# PROGRESS-PRODUCTION-SHIPPING.md

Tracks the **Production Orders + Shipments + Packaging** build for Sinag Ukit BMS. Follows the same convention as `PROGRESS-ORDERS.md`/`PROGRESS-QUOTES.md`: phase-prefixed (`PS-`), kept separate from the core `PROGRESS.md` numbering. Append-only.

Source doc: Orders Module Specification (handed over by Sinag in chat, 2026-07-07), assessed against the live app before any build — see the assessment in this session's transcript for the full comparison. This is the deferred inventory-consumption phase D025/D030 both pointed at ("Production consumption is out of scope for Inventory Phase 1... revisit in a future order page revision phase") — this plan **is** that phase, and building it means formally superseding D030's scope-out, not silently ignoring it.

**Status: 🟩 DONE.** PS-1 through PS-10, plus PS-12, PS-13, PS-15 through PS-22 (follow-on requests), complete.

---

## Gap analysis (2026-07-07 audit against live app)

The spec's lifecycle (Quotation → Received → Production → Shipping → Completed, Payment parallel) is directionally where the app already is. The gap is architectural: the spec wants **Production Order** and **Shipment** as independent, numbered, independently-tracked entities; the live app tracks both as attributes of a single `orders` row.

- **No `production_orders` entity exists.** Production progress today is `order_items.completed_qty` rolled up into an aggregate order-level status (`in_production → partially_completed → production_completed`, `recompute_order_status()`). There's no per-SKU+modifier grouping, no production order number, no independent per-product status/notes/history.
- **`startProduction()` is a bare status flip** (`app/dashboard/orders/active-orders/actions.ts`) — it does not move stock from Reserved to In Production. Confirmed by reading the function body directly.
- **Inventory is never actually deducted.** Verified in `PROGRESS-ORDERS.md` ORDER-7's own verification notes: *"delivered orders don't auto-release"* — stock sat in Reserved through the entire test and had to be released manually. The spec's Available→Reserved→In Production→**Inventory Out** chain is only the first link.
- **`order_shipments` has no line items** — no product/quantity allocation per shipment, no packaging consumption table. App logic and UI assume at most one shipment per order (`ship_order()` inserts a single row; Order Detail renders "the" Shipment card, singular). The spec wants N shipments per order, each with its own product allocation + packaging materials + tracking number, supporting partial shipments.
- **No Packaging item-category concept exists.** `app/dashboard/management/item-categories/page.tsx` is a literal "Coming soon" stub. `items.category_id` FK exists and is already required on every item, so tagging a category as "packaging" is cheap — but there's no category-type flag today.
- **No file upload precedent in the app** — the spec's "Upload proof of shipment" has no existing pattern to copy (no Supabase Storage bucket wired up anywhere in this codebase yet, confirmed by grep).
- **Reserved Qty has no manual override** — it's always derived by the greedy BOM-reservation algorithm from `quantity`; the spec wants it independently adjustable during Received.
- **"Received" as a named status doesn't exist** — functionally the closest match is today's `confirmed` (reservation happens at creation, stays editable pre-production). Likely a pure relabel, not new logic — needs confirming, not building.

**Reusable as-is:**
- `transfer_stock_status()` (INV-1) already does exactly the Reserved→In Production movement needed for Start Production — no new inventory primitive required for that leg.
- `activity_logs`' snapshot-diff pattern (D006) extends directly to a Production Order's history — no new history table needed, same as every other entity in this app.
- The yearly-reset numbering trigger pattern (`SQT`/`SOD`/`SPO`) extends directly to Production Order Number and Shipment Number.
- `order_shipments`/`couriers` schema and RLS shape are already correct for delivery orders — only need line-item tables added, not a rebuild.

---

## Kickoff decisions — confirmed with Sinag (2026-07-07)

1. **"Received" status** — maps to the existing `confirmed` status. No new status, no new gate. Documentation/relabel only.
2. **Production Order grouping** — duplicate SKU+modifier lines within one customer order **merge into one** Production Order with summed quantity.
3. **Production Order completion → order_items.completed_qty** — completing a Production Order **auto-sets** `completed_qty = quantity` on every `order_items` row it aggregates. This retires ORDER-3/D028's manual admin-entered Completed Qty field — it becomes derived, not hand-entered.
4. **Shipment Number format** — global yearly-reset sequence, `SSH<YY>-<MMDD>-<seq>` (e.g. `SSH26-0706-0001`), matching `SOD`/`SQT`/`SPO`.
5. **Proof of shipment upload** — **deferred**, not built in this project. No file-storage precedent exists in this app; revisit as its own small follow-up phase later.
6. **`completed` vs `delivered` status alias** — **resolved in PS-7**, not deferred again. Closes the question open since D026.
7. **Reserved Qty manual override** — **in scope**, built as PS-4 (overrides the earlier recommendation to defer — Sinag's explicit call).

---

## PS-1 — Packaging item-category prerequisite ✅ DONE (2026-07-07)

**What this needs:** a way to mark an `item_categories` row as "Packaging" so Master Items can be filtered by it. Two paths, pick one:
- (a) Minimal: add `item_categories.category_type` (`product` default / `packaging`), edit via direct SQL/a tiny inline toggle — no real Item Category CRUD screen yet.
- (b) Build the actual Item Category management screen (currently a placeholder) with the type flag as part of its Add/Edit form — more work, but stops leaving that placeholder page half-real.

**Built: path (a), minimal.** Sinag's explicit choice over (b).
- Migration `0041_ps1_packaging_category_type`: `categories.category_type text NOT NULL DEFAULT 'product'` + `CHECK (category_type IN ('product','packaging'))`. Additive, no backfill needed (default covers existing rows). Note: the live table is named `categories`, not `item_categories` as this doc assumed — the FK on `items.category_id` points at `categories`.
- `app/dashboard/management/item-categories/page.tsx` replaced the literal "Coming soon" stub with a real read-only list (id/name/category_type from `categories` where `deleted_at IS NULL`) — this is *not* the full CRUD screen from path (b); categories themselves still only come from Loyverse sync, nothing is created/edited here beyond the type flag.
- `item-categories-table.tsx` / `actions.ts` (`setCategoryType`) mirror the Suppliers active/inactive toggle pattern exactly. Admin-only — matches RLS (`categories` only has an admin `ALL` policy plus read policies; no manager/encoder UPDATE grant), so `canWrite = role === 'admin'`, tighter than the module's usual admin+manager+encoder write convention.
- Verified in browser (admin test account): toggled the existing "Packaging" category row live, confirmed `category_type` persisted via SQL, no console errors.

**Depends on:** nothing. Can start immediately, independent of every other phase below.

**Blocks:** PS-6's Packaging Materials picker (needs a real way to query "items where category is packaging") — now unblocked: `categories.category_type = 'packaging'` joined through `items.category_id`.

## PS-2 — `production_orders` schema + Start Production rework ✅ DONE (2026-07-07)

- New `production_orders` table: `production_order_number` (auto trigger, same yearly-reset pattern as `SOD`/`SQT`) — **prefix `SPR`, not `SPO`** as this doc's own gap analysis assumed; `SPO` turned out to already be claimed by `purchase_orders.reference` (checked live DB before picking a prefix). Columns: `order_id` FK, `variant_id`, `item_name_snapshot`/`sku_snapshot`, `modifiers_snapshot` jsonb (array of `{modifier_id, modifier_option_id, name_snapshot, price_snapshot}`, matching `order_item_modifiers`' own shape), `quantity` (summed across matching `order_items` per kickoff decision #2), `status` (`in_production`/`completed`), `notes`, timestamps. Linked back to contributing `order_items` via a plain FK column (`order_items.production_order_id`, nullable, `ON DELETE SET NULL`) rather than a junction table — decision #2's grouping is one-to-many (each `order_item` lands in exactly one Production Order per order), so a junction table would have been unused generality.
- `start_production(p_order_id)` RPC (migration `ps2_production_orders_schema_and_start_production`, fixed in `ps2_fix_start_production_min_uuid`) replaces the bare status flip: transfers Reserved→In Production per `order_item` via `transfer_stock_status()`, BOM-expanded with the exact same component-union query `create_order`/`adjust_order_items`/`cancel_order` already use (only components where `items.track_stock=true` move); groups `order_items` by `(variant_id, sorted modifier_option_ids)` — duplicate lines merge into one `production_orders` row with summed `quantity`; sets `orders.status='in_production'`. Role-gated **admin-only**, matching the existing `canAdvance` UI gate (D028's admin-only precedent) — not widened here.
- `app/dashboard/orders/active-orders/actions.ts`'s `startProduction()` now calls `supabase.rpc('start_production', ...)` instead of a raw `.update()`.
- Logs to `activity_logs`: one `entity_type='production_order'` row per Production Order created, one `entity_type='order'` roll-up row — no new history table.
- **Bug caught and fixed during verification:** first version used `min(id)` (uuid) to pick a representative `order_item` per group — Postgres has no `min(uuid)` aggregate, so the very first live test failed with `function min(uuid) does not exist`. Fixed by switching to `(array_agg(id order by id))[1]`. The failure rolled back cleanly (no partial state), confirming the whole RPC is properly transactional.
- Verified live against real orders (Supabase MCP, admin JWT context): ran on `SOD26-0707-0007` — created `SPR26-0707-0001` (qty 50), linked both `order_items`, wrote both activity log rows, flipped order to `in_production`; separately confirmed the duplicate-merge grouping query alone (not the full RPC, to avoid mutating an already-`delivered` order) against `SOD26-0706-0004`'s two same-variant/no-modifier lines — correctly merged to one group, `total_qty=4`. Re-running `start_production` against an already-`in_production` order correctly raises and rolls back (no double-processing).

**Depends on:** kickoff decisions #1, #2. Nothing else.

## PS-3 — Production Order Detail UI + independent completion ✅ DONE (2026-07-07)

- New Production Orders list page (`app/dashboard/orders/production/page.tsx` + `production-orders-table.tsx`) fully replaces the old order-level Production Queue (deleted `production-queue-table.tsx`, rewrote `actions.ts`) — was just `orders` filtered by `status='in_production'`, with a broken "Mark Completed" that set `orders.status='completed'` directly, bypassing the entire Ready for Shipping/Shipped/Delivered chain built in ORDER-7. Now lists real `production_orders` rows (all statuses, not just in-production) with Production Order No., linked Customer Order, product+modifiers, quantity, status, created date. Row click navigates to detail (matches the Quotes list convention — `onRowClick`, not a dialog).
- Production Order Detail page (`app/dashboard/orders/production/[productionOrderNumber]/`): number, status badge, linked Customer Order (link to Active Orders detail), product/sku, modifiers, quantity, notes, Activity Log panel — same card shape as Order Detail/Quote Detail. **"Complete Production Order" lives only here, not as an inline list action** — a deliberate departure from the old Production Queue's inline "Mark Completed", matching the newer Quotes/Active-Orders convention of mutations-on-detail-page rather than dialogs-in-list.
- `complete_production_order(p_production_order_id)` RPC (migration `ps3_complete_production_order_and_recompute_status`): sets `production_orders.status='completed'`, writes `completed_qty = quantity` onto every aggregated `order_items` row (kickoff decision #3), calls `recompute_order_status()`, logs to `activity_logs`. Admin-only, matching D028's admin-only precedent for the feature it retires.
- `recompute_order_status()` rewritten in place: order status now derives from `production_orders` completion counts (`count(*) filter (where status='completed')` vs total), not raw `sum(order_items.completed_qty)` — the actual architectural shift PS-2/PS-3 exist for.
- Order Detail (`active-orders/[orderNumber]/`): the manual Completed Qty editor (`NumberInput` + "Save Completed Qty", admin-only) is removed — Completed Qty is now read-only and shows the linked Production Order number (linking to its detail page) beneath it. This retires ORDER-3's manual entry (D028), per this doc's own instruction to flag it as a deliberate deprecation, not a silent removal. Left the (now-unused) `update_completed_qty()` RPC in the DB rather than dropping it, matching this project's additive-migrations convention.
- **Concurrency note:** built alongside another session's in-flight PS-4 (Reserved Qty override) work in the same files (`order-detail.tsx`/`page.tsx` both gained `overrideReservedQty`/`canOverrideReservedQty` mid-session). Edits were scoped narrowly to the Completed Qty lines only, re-reading each file immediately before editing to avoid clobbering; no conflicts occurred.
- Verified live (Supabase MCP + browser, admin test account): ran `start_production` → `complete_production_order` end-to-end on a real order, confirmed `completed_qty` auto-set, order status derived to `production_completed`; browser-verified the Production Orders list, Production Order Detail (product/qty/status/Activity Log all correct), and Order Detail's read-only Completed Qty + working link to the Production Order.

**Depends on:** PS-2. This retires ORDER-3's manual Completed Qty entry (D028) — flagged here, not a silent removal.

## PS-4 — Reserved Qty manual override (Received stage) ✅ DONE (2026-07-07)

New RPC `override_reserved_qty(p_order_id, p_updates jsonb)` (migration `ps4_override_reserved_qty`), role-gated `admin`/`manager`/`encoder` (Sinag's explicit call — matches `adjust_order_items`/`transfer_stock_status`'s general stock-write convention, rather than `update_completed_qty`'s tighter admin-only). Status-gated to `confirmed` only (both server-side and via the UI's `canOverrideReservedQty` flag).

- Per line, expands the variant through `item_components` (same BOM-expansion pattern as `adjust_order_items`) and moves the delta between `available`/`reserved` via `transfer_stock_status()` — decreasing releases stock back to Available, increasing claims it from Available (guarded: raises if not enough is actually available). Untracked items skip the stock movement entirely, matching `adjust_order_items`'s `v_feasible is null` branch.
- Guards: reserved qty can't go negative, can't exceed the line's ordered `quantity` — enforced both by the RPC (defense in depth) and by the `NumberInput`'s `min`/`max` in the UI.
- Logs `order_reserved_qty_overridden` to `activity_logs` per line changed.
- UI: inline-editable Reserved Qty column on Order Detail (`order-detail.tsx`), same pattern as the existing Completed Qty inline editor — dirty-tracked, separate "Save Reserved Qty" button in the Line Items card footer. `overrideReservedQty` server action added to `active-orders/actions.ts`.
- Verified in browser (admin test account, order `SOD26-0707-0008`): decreasing 5→2 released 3 units back to Available; increasing 2→5 re-claimed them; activity log recorded both; RPC correctly rejected exceeding ordered quantity and rejected running outside `confirmed` status when tested directly via SQL.

**Depends on:** nothing structural — independent of PS-2/PS-3, built in parallel with them. Note: this phase overlapped in time with PS-2/PS-3 being built in a concurrent session on the same `active-orders` files — no schema conflict (separate migration), UI wiring reconciled cleanly once both landed.

## PS-5 — Inventory "Out" primitive ✅ DONE (2026-07-07)

- New RPC `deduct_stock_out(p_variant_id, p_store_id, p_quantity, p_note)` (migration `ps5_deduct_stock_out_rpc`, fixed in `ps5_fix_deduct_stock_out_null_role_bypass`): permanently removes stock — decrements `in_stock` **and** the relevant bucket together, single `inventory_movements` row, new `movement_type` value **`stock_out`** (not `shipment_out` as this doc's own placeholder guessed — named after the primitive itself, since nothing about it is shipment-specific at this layer) since this isn't a transfer between buckets (no counterpart_status), it's a real removal.
- **Which bucket is inferred, not passed by the caller:** the RPC joins `variant → item → category` and checks `categories.category_type` (PS-1) — `in_production_qty` for ordinary products, `available_qty` for packaging. Packaging never enters Reserved/In Production, so its only pre-shipment bucket is Available; this keeps PS-7's future caller from having to know or guess which bucket to draw from. Raises if the item's `track_stock` is false (there's no meaningful bucket to draw from).
- This is the one genuinely new inventory primitive this whole build needs — everything else reuses `transfer_stock_status()`.
- **Security bug caught during verification, not introduced by this phase:** tested the RPC with `request.jwt.claims` set to `{}` (simulating an unauthenticated/anon caller) and the deduction went through anyway. Root cause: `current_user_role()` returns `NULL` when `auth.uid()` has no matching profile, and `NULL NOT IN (...)` evaluates to `NULL`, which plpgsql's `IF ... THEN` treats as false — the authorization check silently no-ops instead of raising. Confirmed this is **pre-existing and shared by `transfer_stock_status` and `adjust_stock`** (identical pattern, same test against `transfer_stock_status` also let an unauthenticated call through) — I'd copied the same broken pattern into my first draft of `deduct_stock_out`. Fixed **only in `deduct_stock_out`** (explicit `v_role is null` check before the `NOT IN`) since fixing the other two is out of this phase's scope — flagged to Sinag as a separate follow-up, not silently left broken in new code. `EXECUTE` on all three is even granted to the `anon` role, so this is a real, not hypothetical, exploitable gap in the existing functions.
- Verified live (Supabase MCP, simulated admin JWT via `request.jwt.claims`): ran against a real variant with `in_production_qty=50` — deducted 5 then 2 more, `in_stock` and `in_production_qty` moved together each time (91→86→83, 50→45→42), single `stock_out` movement row per call with correct `quantity_before`/`quantity_after`/`status`. Confirmed insufficient-quantity guard rejects over-deduction, non-tracked-item guard exists, and (post-fix) unauthenticated/null-role calls are rejected.

**Depends on:** nothing structurally, but has no caller until PS-6.

**Follow-up flagged, not built here:** `transfer_stock_status` and `adjust_stock` share the null-role auth bypass described above — both need the same `v_role is null or v_role not in (...)` fix. Separate task, since fixing already-shipped RPCs isn't this phase's scope.

**Follow-up done (2026-07-07):** grepped every `public` function calling `current_user_role()` and found the same null-bypass in all of them (`NULL NOT IN (...)` / `NULL <> 'admin'` evaluates to NULL, which plpgsql's `IF` treats as false, silently skipping the check). Fixed 20 via two additive migrations — `ps5_fix_null_role_bypass_stock_rpcs` (`adjust_stock`, `transfer_stock_status`, `override_reserved_qty`, `start_production`, `complete_production_order`, `adjust_incoming_qty`) and `ps5_fix_null_role_bypass_order_item_rpcs` (`create_order`, `adjust_order_items`, `cancel_order`, `hold_order`, `resume_order`, `mark_ready_for_shipping`, `mark_picked_up`, `ship_order`, `mark_delivered`, `convert_quote_to_order`, `update_completed_qty`, `receive_purchase_order`, `archive_item`, `upsert_item`). Each verified live: null-role caller now raises `Not authorized...`, admin caller still reaches business logic. **Left unfixed on purpose:** the 5 Accounting-module RPCs (`post_journal_entry`, `get_trial_balance`, `get_income_statement`, `get_balance_sheet`, `run_monthly_depreciation`) have the identical bug but that module is dev-paused ([[project_accounting_module_paused]]) — don't touch without Sinag's go-ahead.

## PS-6 — Shipment line items schema + multi-shipment support ✅ DONE (2026-07-07)

- New `shipment_items` table (`shipment_id` FK → `order_shipments` `ON DELETE CASCADE`, `order_item_id` FK → `order_items`, `quantity_shipped`, optional `note`) — one row per product line per shipment, enabling partial shipments.
- New `shipment_packaging_items` table (`shipment_id` FK, `variant_id` FK → `item_variants`, `quantity_used`, optional `note`) — restricted to variants whose item's `categories.category_type = 'packaging'` (PS-1), enforced inside the RPC (not a DB CHECK — cross-table lookups aren't expressible there). RLS on both tables mirrors `order_shipments`' existing shape exactly: admin ALL, admin+encoder select/insert/update — **no manager**, matching this table family's narrower-than-usual convention (confirmed by reading `order_shipments`' live policies before copying, not assumed).
- `order_shipments.shipment_number` added (`SSH<YY>-<MMDD>-<seq>`, kickoff decision #4), same `BEFORE INSERT` trigger pattern as `SPR`/`SQT`/`SOD`. The 2 pre-existing test rows (predating this column) backfilled retroactively from their own `created_at`.
- `order_shipments.status` CHECK widened to add **`preparing`** — the initial status for a shipment that's been created but not yet marked shipped. `shipped`/`delivered` remain reachable only through the existing `ship_order()`/`mark_delivered()` path for now; PS-7 is what builds the "Mark Shipped" transition onto the new schema.
- New RPC `create_shipment(p_order_id, p_courier_id, p_tracking_number, p_shipping_cost, p_shipping_fee_charged, p_note, p_items jsonb, p_packaging_items jsonb)` (migration `ps6_shipment_items_schema_and_create_shipment`, fixed in `ps6_fix_create_shipment_fulfillment_method_check`) — creates the `order_shipments` header (status `preparing`) plus its `shipment_items`/`shipment_packaging_items` rows in one transaction. **No stock effect and no `orders.status` change** — matches the spec's "Creating a Shipment does not deduct inventory" and keeps `deduct_stock_out` (PS-5) an explicit later step (PS-7), not implicit here. Per-line guards: quantity must be positive; cumulative `quantity_shipped` across all shipments for an `order_item` can't exceed that line's ordered `quantity` (supports partial shipments correctly); packaging lines must resolve to a `packaging`-category variant. Calling it multiple times against the same order is the normal path now, not a special case — multiple `order_shipments` rows per order is first-class.
- Gate: requires `orders.status = 'ready_for_shipping'` (same gate `ship_order()` already used) and `fulfillment_method <> 'pickup'` — deliberately an exclusion check, not `= 'delivery'`, to match `mark_ready_for_shipping`/`mark_picked_up`'s existing convention of treating a null `fulfillment_method` (pre-dates that column on older test rows) as delivery-track rather than rejecting it. Role-gated admin/encoder (matches `order_shipments`' RLS, no manager) — built with the explicit `v_role is null or v_role not in (...)` null-safe check from the start (see PS-5's writeup for why the naive `NOT IN` form is unsafe).
- `ship_order()`, order-level status workflow, and the existing single-shipment Order Detail UI are **untouched** — `create_shipment()` is a new parallel path with no UI yet. UI work is explicitly PS-8's job per this doc's own sequencing, not bundled in here.
- Verified live (Supabase MCP, simulated admin JWT): ran `mark_ready_for_shipping` then `create_shipment` twice against real order `SOD26-0707-0007` (ordered qty 50) — first shipment `SSH26-0707-0003` shipped 30 units + 2 packaging units, second `SSH26-0707-0004` shipped the remaining 20; confirmed both are independent `order_shipments` rows with correct `shipment_items`/`shipment_packaging_items`, zero inventory movement occurred, a third attempt to ship 5 more correctly raised "would exceed ordered quantity", a non-packaging variant correctly raised "is not a packaging item", and a null-role (unauthenticated) call correctly raised "Not authorized".

**Depends on:** PS-1 (packaging category), kickoff decision #4.

## PS-7 — Ship Order rework: Mark Shipped → Inventory Out ✅ DONE (2026-07-07)

- Split today's single `ship_order()` (which creates the shipment row *and* implicitly represents "shipped") into **Create Shipment** (no stock effect, PS-6) and a separate **Mark Shipped** transition (`mark_shipment_shipped(p_shipment_id)`, migration `ps7_mark_shipped_and_retire_completed_status`, fixed in `ps7_fix_mark_shipment_shipped_skip_untracked_packaging`) that calls PS-5's `deduct_stock_out()`:
  - once per product line in `shipment_items` — BOM-expanded through `item_components` (same union-with-track_stock-filter pattern as `start_production`/`adjust_order_items`/`cancel_order`), In Production → Out, only the shipped quantity (enables partial shipments).
  - once per packaging line in `shipment_packaging_items`, Available → Out — **skips lines whose item has `track_stock = false`** instead of raising (build-time fix: `deduct_stock_out()` raises on untracked items by design, but a real test packaging item had `track_stock=false`; skipping matches the rest of the codebase's convention of silently excluding untracked items from stock movement rather than failing the whole transition).
- New `mark_shipment_delivered(p_shipment_id)` is the terminal per-shipment transition.
- New `recompute_shipping_status(p_order_id)` derives order-level Shipping status from **all** `order_shipments` rows for the order — `shipped` once any shipment reaches shipped/delivered, `delivered` once every shipment does — mirroring PS-3's Production Order completion-count aggregation pattern. Guarded to only act when the order is currently `ready_for_shipping`/`shipped` (same guard style as `recompute_order_status`), so it can't clobber `on_hold`/`cancelled`/pickup-track orders. Both new RPCs role-gated admin/encoder, matching `create_shipment`'s convention; built with the null-safe `v_role is null or v_role not in (...)` check from the start.
- Resolves the `completed` vs `delivered` alias question, open since D026 and deferred again by D033: `completed` is retired in favor of `delivered` as the single terminal status. The 2 live `completed` rows were migrated to `delivered`, then `'completed'` was dropped from `orders_status_check`. Every remaining `'completed'`-as-order-status literal was updated: Completed Orders page query, Production Report's `OrderStage` type/labels/query, Order List's dead badge-map entry, and the `REVENUE_STATUSES` arrays in Sales Report/Financial Report/Profit & Loss (same literal rename, not a broader status-list audit — that's still PS-9 territory). `production_orders.status = 'completed'` is a separate, untouched enum (PS-2/PS-3's own field) — not affected.
- `ship_order()`/`mark_delivered()` (the pre-PS-6 single-implicit-shipment RPCs) and the existing single-shipment Order Detail UI are **left untouched** — same posture as PS-6's `create_shipment`. PS-8 is what cuts the UI over to `create_shipment` + `mark_shipment_shipped` + `mark_shipment_delivered`.
- Verified live (Supabase MCP, simulated admin JWT): ran `mark_shipment_shipped` on one of two `preparing` shipments against real order `SOD26-0707-0007` (ordered qty 50, shipments 30+20) — confirmed BOM-expanded deduction (`in_production_qty` 42→12, `in_stock` 83→53), order rolled up to `shipped` (one shipment shipped, one still preparing); the second shipment's attempt correctly raised "Insufficient in_production quantity" (only 12 left, needed 20) and rolled back cleanly (shipment stayed `preparing`, no partial state); a null-role caller was correctly rejected on `mark_shipment_shipped`. Separately ran `mark_shipment_delivered` on an already-`shipped` single-shipment order (`SSH26-0706-0002`) and confirmed the order rolled up to `delivered`. Confirmed `orders_status_check` no longer accepts `'completed'` and the migrated rows read `'delivered'`.

**Depends on:** PS-3 (order can't reach Shipping until all Production Orders done), PS-5, PS-6.

## PS-8 — Shipping UI rework ✅ DONE (2026-07-07)

- New `order-shipments.tsx` client component replaces the single Shipment card + "Ship Order" dialog on Order Detail — renders **all** shipments for the order (not just the latest one), each showing shipment number, status badge, courier/tracking, product lines, packaging lines, cost/fee, shipped/delivered timestamps, and a per-shipment "Mark Shipped"/"Mark Delivered" action button.
- "Add Shipment" dialog (replaces "Ship Order"): courier/tracking/cost/fee/note fields carried over as-is, plus two new sections — a **Product Lines** checklist driven by each order line's actual remaining-to-ship quantity (`quantity - sum(shipment_items.quantity_shipped)` across all existing shipments for that line, computed server-side), and a **Packaging Materials** repeatable row editor (variant select restricted to `categories.category_type = 'packaging'` + quantity, Add Row/Remove Row) — a lightweight purpose-built editor rather than a literal reuse of `OrderLineItemsEditor` (ORDER-9), since packaging lines have no price/discount/modifier concept; it mirrors that component's add/remove-row interaction pattern instead, which is what the spec's "same interface as the Order Items page" language was actually pointing at.
- `actions.ts`: added `createShipment`/`markShipmentShipped`/`markShipmentDelivered` wrapping the PS-6/PS-7 RPCs; **removed** `shipOrder`/`markDelivered` (their only callers) — the `ship_order`/`mark_delivered` RPCs themselves are left in the database untouched, per this project's additive-migrations convention (same treatment as `update_completed_qty` in PS-3).
- **"Add Shipment" is only shown when `orders.status = 'ready_for_shipping'` exactly** (`canAddShipment`), matching `create_shipment()`'s own gate (PS-6) precisely rather than loosening it — once the first shipment on an order is marked Shipped, the order rolls up to `shipped` and no further shipments can be added through this UI. This is a real workflow constraint carried over from PS-6's design (all shipments for an order must be planned while it's still Ready for Shipping), not a bug; recorded as a build-time decision in `DECISIONS.md` D036 rather than silently changing PS-6's gate.
- `lib/supabase/types.ts` regenerated (`generate_typescript_types`) — it predated PS-2/PS-6 and was missing `shipment_items`, `shipment_packaging_items`, and the new RPC signatures entirely; without this the new queries wouldn't type-check.
- Verified live (Supabase MCP + browser, admin test account): opened Add Shipment on a `ready_for_shipping` order, confirmed the Product Lines section shows the correct remaining quantity and the Packaging Materials dropdown lists exactly the 4 packaging-category items from PS-1; submitted a shipment (10 units + 1 packaging item) and confirmed it appeared in the Shipments list with status `preparing`; clicked Mark Shipped and confirmed BOM-expanded stock deduction on the 3 underlying components (verified via SQL) and the order rolling up to `shipped`; clicked Mark Delivered and confirmed the order rolled up to `delivered`. Separately confirmed via direct RPC call (no UI) that attempting to ship more than what's left In Production correctly raises and rolls back without hanging the app (the browser's native `alert()` on that error path blocks further `preview_eval`/`preview_click` calls in the automated preview tooling specifically — a tooling limitation, not an app bug; confirmed via direct Supabase MCP query that the DB state was untouched after that failed attempt).
- **Proof-of-shipment upload remains explicitly out of scope** (kickoff decision #5) — no Supabase Storage bucket/RLS added.

**Depends on:** PS-6, PS-7.

## PS-9 — Reporting follow-up ✅ DONE (2026-07-07)

- Production Report (`app/dashboard/analytics/production-report/`) reworked from order-level `OrderStage` counts to `production_orders`-level granularity: queries `production_orders` (joined to `orders(order_number)`) instead of `orders`, filtered by `created_at` in range.
- Stat cards changed from 4 order-stage counts (Confirmed/In Production/Delivered/Cancelled) to 4 Production-Order-level metrics: In Production count, Completed count, Units In Production, Units Completed — `production_orders.status` only has two values (`in_production`/`completed`; a row only exists once an order enters production), so the old 4-stage layout no longer applied.
- "Completed per day" chart now counts completed `production_orders` by `updated_at` (same completion-time-proxy convention as before, just at PO granularity instead of order granularity).
- Table (`production-report-table.tsx`) now lists Production Orders (number, linked customer order number, product+SKU+modifiers, quantity, status, created/updated) with row-click navigation to the existing Production Order Detail page (`/dashboard/orders/production/[productionOrderNumber]`, PS-3) — reuses the same column shape as the PS-3 Production Orders list table.
- Footer note rewritten to explain the new unit of measure (one customer order can span several Production Orders; Confirmed orders don't appear since no Production Order exists yet) and retains the pre-existing "no time-in-production metric" caveat.
- `MODULE_STATUS.md`'s Analytics > Production Report bullet updated to match.
- Verified live (browser, admin test account): stat cards (In Production 0, Completed 1, Units In Production 0, Units Completed 50) and table row (`SPR26-0707-0001`, `SOD26-0707-0007`, Pro-Hairbrush qty 50, Completed) match the one real `production_orders` row in the live DB exactly; row click correctly navigated to `/dashboard/orders/production/SPR26-0707-0001`; no console errors.

**Depends on:** PS-2, PS-3 (needs `production_orders` to exist).

## PS-10 — Status-scoped Orders list pages (Confirmed/Shipping/Payment) ✅ DONE (2026-07-07)

**Requested by Sinag directly (2026-07-07)**, outside the original 9-phase plan above — not a kickoff-planned phase, added as a follow-on UI request:
1. Rename the "Received" page to "Confirmed."
2. An order should appear on the Confirmed page once its status is `confirmed`.
3. An order should appear on the Production page once its status is `in_production`.
4. An order should appear on the Shipping page once its status is `ready_for_shipping`.
5. An order should appear on the Payment page from confirmation through completion of the order.

**What was built:**
- `app/dashboard/orders/received/` renamed to `app/dashboard/orders/confirmed/` (sidebar label + href updated in `components/layout/app-shell.tsx`). Replaces the blank stub with a real list: `orders` where `status='confirmed'`, `DateRangeFilter`, same Order No./Customer/Order Date/Created/Modified/Total Items/Order Total/Payment Status/Last Activity columns as Active Orders' own list (ORDER-4), minus the status column/filter since the set is already fixed. Resolves requirements 1 and 2 above — this is the same "Received maps to Confirmed" mapping the PS-1..9 kickoff decisions already established (decision #1), just the first time a dedicated list page was actually built for it.
- Requirement 3 (Production) needed **no code change** — `production_orders` rows (PS-2) only ever exist once an order's status becomes `in_production`, so the Production Orders list (PS-3) already satisfies this exactly. Verified live, not just asserted.
- New `app/dashboard/orders/shipping/page.tsx` + `shipping-table.tsx`: replaces the blank stub with a real list, `orders` where `status IN ('ready_for_shipping','shipped')`, plus a small in-page `FilterBar` (All/Ready for Shipping/Shipped) since two statuses are in play. Resolves requirement 4 — `delivered` orders roll off this list onto the existing Completed page (`status='delivered'`) rather than staying here, keeping the two lists non-overlapping.
- New `app/dashboard/orders/payment/page.tsx` + `payment-table.tsx`: replaces the blank stub with a real list, `orders` where `status <> 'cancelled'` (every status from `confirmed` through `delivered`, i.e. the full lifecycle "from confirmation till completion"), with a Payment Status `FilterBar` (Unpaid/Partially Paid/Paid/Overpaid) since that's the primary lens for a payment-tracking screen. Resolves requirement 5.
- All three pages are **navigational front doors only, not new mutation surfaces** — row click on every one routes to Active Orders' existing Order Detail page (`/dashboard/orders/active-orders/[orderNumber]`), which already owns every real action (Start Production, Add Shipment/Mark Shipped/Mark Delivered, Add Payment, etc., per ORDER-3/PS-8). No new RPCs, no new server actions — pure read-only filtered views mirroring `order-list-table.tsx`'s (ORDER-4) established column/badge conventions.
- This explicitly **supersedes** this doc's own earlier "not required" call on Shipping/Payment as standalone screens (`MODULE_STATUS.md`'s prior wording, itself sourced from this file's PS-6/7/8 writeups) — Sinag asked for the standalone lists directly this time, superseding that earlier judgment call rather than contradicting it silently.
- `MODULE_STATUS.md`'s Orders section updated: Received → Confirmed (🟩), Shipping (🟩, notes it's a front door), Payment (🟩, notes it's a front door).

**Verification:** `npx tsc --noEmit` clean. Browser-verified end-to-end (Claude admin test account, see [[project_claude_test_account]]): Confirmed page rendered correctly with the new columns (empty — no order currently sits at `confirmed` in live data, expected); Shipping page correctly showed the one live `shipped` order (`SOD26-0707-0007`) and no others; Payment page correctly showed all 9 non-cancelled live orders with accurate Payment Status badges (Unpaid/Paid/Overpaid all represented in real data); sidebar nav confirmed via DOM query to show "Confirmed" with the new href and all Orders links resolving correctly; row-click from Shipping landed on Order Detail's Shipments card as expected; no console errors on any of the three pages. Production page re-verified unchanged and correct (4 real Production Orders listed, row-click still working).

**Not built / open follow-ups:**
- No change to Order Detail itself — this phase is purely additive list pages, not a workflow change.
- Confirmed/Shipping/Payment have no "New Order" or bulk-action affordances — matches the "lists navigate, Detail mutates" pattern the rest of this module already follows.

**Environment note:** hit the "another `next dev` process already holds this workspace" symptom other sessions in this doc also hit (PS-6/PS-7/PS-8's "Not verified" notes) — this time it turned out to be a stale port lock with no live process behind it (`tasklist`/`netstat` showed nothing actually running on port 3000). Killing all node processes and restarting cleanly resolved it; not a genuine concurrent-session conflict this time, but worth checking for next time this symptom recurs before assuming verification is blocked.

---

## PS-12 — Production Order progress tracking, Cancel, and composite breakdown ✅ DONE (2026-07-07)

**Requested by Sinag directly (2026-07-07)**, not part of the original 9-phase plan:
1. See item completion progress on opening the Production Order page, and let it be modified (not just all-or-nothing).
2. Add a "Mark as Complete" and a "Cancel Order" action on the Production Order Detail page.
3. For composite products, show reserved/completed broken down per individual (BOM) component.

**Kickoff decisions confirmed with Sinag before building:**
- Cancelling a Production Order with a partial `completed_qty` splits its stock: the **uncompleted** portion (`quantity - completed_qty`) releases to **Available**; the **completed** portion moves to **On Hold** (Sinag's explicit call — "release back to available the uncompleted portion, completed items to Hold"). Releasing stock back out of On Hold is an explicit future phase, not built here.
- On cancel, the affected `order_items` are unlinked (`production_order_id = null`) so they're eligible for a future Start Production run; the parent order reverts to `confirmed` if this was its last non-cancelled Production Order, otherwise its status is recomputed from what remains.
- Editing Completed Qty and Cancel are gated **admin + manager + encoder** — wider than "Mark as Complete", which stays **admin-only** per its existing D028 precedent (not widened, since that wasn't asked).

**What was built:**
- Migration `ps12_completion_qty_and_cancel`: `production_orders.completed_qty numeric NOT NULL DEFAULT 0 CHECK (0 ≤ completed_qty ≤ quantity)`; `production_orders_status_check` widened to add `'cancelled'`. Pre-existing `'completed'` rows backfilled `completed_qty = quantity` (they predate the column).
- `recompute_order_status()` now excludes `status = 'cancelled'` Production Orders from both the total and completed counts — otherwise a cancelled PO would permanently block its order from ever reaching `production_completed` again.
- `complete_production_order()` unchanged in effect, now also stamps `production_orders.completed_qty = quantity` for consistency with the new field.
- New RPC `update_production_completed_qty(p_production_order_id, p_completed_qty)` — status-gated to `in_production`, bounds-checked `0..quantity`, admin/manager/encoder. No stock effect: completion has never moved stock in this system (only Start Production and Mark Shipped do) — this is a pure progress-tracking number.
- New RPC `cancel_production_order(p_production_order_id)` (migration `ps12_completion_qty_and_cancel`, fixed in `ps12_fix_cancel_production_order_reserved_qty_reset`) — status-gated to `in_production`; BOM-expands `(quantity - completed_qty)` → `available` and `completed_qty` → `on_hold` per component through `item_components` (same union-with-track_stock-filter pattern as `start_production`/`cancel_order`); sets status `cancelled`; unlinks `order_items.production_order_id`; **also zeroes `order_items.reserved_qty`** on those lines (caught during verification — see below); reverts the order to `confirmed` if zero non-cancelled Production Orders remain on it, otherwise calls `recompute_order_status()`. Logs one `production_order` activity row and one `order` roll-up row, mirroring `cancel_order`'s convention.
- **Composite breakdown needed no new schema.** `item_components` already stores the per-unit ratio; each component's Reserved/Completed is derived, not tracked: `reservedQty = ratio × production_orders.quantity`, `completedQty = ratio × production_orders.completed_qty` — computed in `page.tsx`, rounded to 4 decimals to avoid float artifacts. The Production Order Detail page's new "Components" card only renders when `item_components` has rows for the PO's variant.
- UI (`production-order-detail.tsx`/`page.tsx`): inline-editable Completed Qty (`NumberInput`, dirty-tracked, "Save Completed Qty" footer button — same pattern as PS-4's Reserved Qty override) shown while `in_production`; "Mark as Complete" (kept, admin-only) and new "Cancel Order" (admin/manager/encoder, confirm dialog, danger styling) header actions; Components card as above. `actions.ts` gained `updateProductionCompletedQty`/`cancelProductionOrder`.
- `BUSINESS_RULES.md`'s Production Orders section and `MODULE_STATUS.md`'s Production bullet updated to describe all three behaviors.

**Bug caught and fixed during verification:** the first version of `cancel_production_order` moved component stock out of In Production correctly, but never touched `order_items.reserved_qty` — leaving it at its pre-cancel value (e.g. still showing 8 reserved) even though the actual component stock was now sitting in Available/On Hold, not Reserved. Since the order reverts to `confirmed` (a status PS-4's Reserved Qty override treats as "has live reservations"), this would have let the order look reserved when it wasn't, and would have made a future Start Production call fail trying to move stock out of a Reserved bucket that no longer holds it. Fixed in `ps12_fix_cancel_production_order_reserved_qty_reset` by zeroing `reserved_qty` alongside the unlink. Confirmed the bug and the fix by inspecting `order_items` directly after a live cancel, not just by re-reading the code.

**Verified live (Supabase MCP, simulated admin JWT — browser verification blocked, see note below):** ran the full flow against real order `SOD26-0707-0010` (two composite Production Orders, `SPR26-0707-0005` qty 15 and `SPR26-0707-0006` qty 8, each with 5 BOM components): `update_production_completed_qty` to 3/8 — confirmed no stock movement, activity logged; rejected 100/8 (out of range) and a null-role call. `cancel_production_order` on the 3/8 PO — confirmed per-component math exactly matched `ratio × 5` released to Available and `ratio × 3` moved to On Hold for all 5 components (e.g. one component's `in_production_qty` 8.0000→0, `available_qty` 84→89, `on_hold_qty` 0→3); order stayed `in_production` since a sibling PO was still active. Cancelled the sibling PO next (completed_qty 0) — confirmed 100% released to Available, 0 to On Hold, and the **order correctly reverted to `confirmed`** since no non-cancelled Production Orders remained; confirmed `order_items.reserved_qty` reset to 0 on both lines (this is what caught the bug above) and rejected a null-role cancel attempt. Re-ran `start_production` on the reverted order (created fresh `SPR26-0707-0007`/`0008`), then `complete_production_order` on one (confirmed `completed_qty` stamped to `quantity`, order rolled up to `partially_completed`) and `cancel_production_order` on the other — this one correctly **raised and rolled back cleanly** ("Insufficient in_production quantity, have 0, need 8") because `reserved_qty` was 0 going into Start Production so no component stock had actually moved into In Production to release; confirms the RPC fails loudly rather than silently succeeding against phantom stock. `npx tsc --noEmit` clean.

**Not verified in-browser (at time of this section):** another session's `next dev` process held an exclusive lock on this project directory (Next.js allows only one dev server per directory) for the duration of this build, so this session couldn't start its own preview server without killing that process — which wasn't done, since it belongs to another active session. All verification above is direct-RPC via Supabase MCP against real (test) data, per this project's established fallback pattern for when browser verification is blocked (see PS-6/7/8's own "Not verified" notes). UI code is `tsc`-clean and mirrors PS-4's already-browser-verified Reserved Qty override pattern exactly, but the inline editors, Cancel confirmation dialog, and Components card have not been visually confirmed in a live browser session. **Update:** Sinag did verify it live via the other session's browser shortly after (see the amendment below, prompted by a screenshot of the real UI) — the feature works end-to-end.

### PS-12 amendment — non-reversible incremental completion, 5-state PO status, layout fix (2026-07-07)

Sinag tried the shipped PS-12 UI live and asked for three changes, informed by a screenshot of the real Production Order page:

1. **Completion should be non-reversible and incremental**, not settable to any value — log each batch with a date, and only let the *remaining* quantity be entered on the next update.
2. **Production Order status should be its own vocabulary**, distinct from `orders.status`: Not Started → WIP → Partially Completed → Completed, plus Cancelled — with an explicit "Start Production" button driving the Not Started → WIP move (clarified via a follow-up question, since `completed_qty` alone only yields 3 buckets while active, not the 4 non-cancelled states requested).
3. **Tighten the Production Order info panel layout** — label/value pairs were rendering far apart (`flex justify-between` stretched across the full card width).

**What changed:**
- Migration `ps12b_status_expansion_and_incremental_completion`: `production_orders_status_check` widened to `not_started | wip | partially_completed | completed | cancelled` (replacing `in_production`); existing rows backfilled (`completed_qty = 0` → `not_started`, `completed_qty > 0` → `partially_completed`, since there's no historical record of exactly when work "started" for a clean `wip` backfill). `status` now defaults to `'not_started'`.
- `start_production()` (order-level, PS-2) now creates Production Orders as `not_started` instead of `in_production` — no other change, it still moves Reserved → In Production for every component at order-creation time.
- New RPC `start_production_order(p_production_order_id)` — the new PO-level "Start Production" button, `not_started → wip`, admin/manager/encoder, no stock effect (the order-level RPC above already moved the stock).
- `update_production_completed_qty()` (the settable version from the initial PS-12 build, same day) **dropped and replaced** by `add_production_completed_qty(p_production_order_id, p_qty)` — strictly additive (`p_qty` must be positive, added to the running total, capped at `quantity`), so a decrease is structurally impossible rather than just discouraged. Auto-flips `wip → partially_completed` on the first successful add. Each call logs `+N completed on <date> — X of Y total` to `activity_logs`, giving the dated history Sinag asked for via the existing Activity Log panel (no new table needed).
- `complete_production_order()` / `cancel_production_order()` guards widened from `= 'in_production'` to `in ('not_started','wip','partially_completed')` — same behavior, just checking against the new 3-substate "still active" range instead of the retired single value.
- New shared module `lib/production-order-status.ts` — status labels/badge variants for all 5 states, used by the detail page, the Production Orders list, and the Production Report table (previously each had its own ad hoc 2-value map).
- Production Report's "In Production" stat card now aggregates all three active substates (`not_started`/`wip`/`partially_completed`) rather than checking a single literal — same 4-card shape as before (PS-9), no new cards added.
- Layout fix: the Production Order info panel now uses a fixed `140px` label column (`grid-cols-[140px_1fr]`) instead of `flex justify-between` spread across the full 2-column-span card width — label and value sit close together regardless of card width. New "Completed Qty" row shows `X of Y (as of <date>)` as a read-only running total; the editable part is a separate "Add completed (max N)" input + Save button, only shown while there's remaining quantity left to log.

**Verified live (Supabase MCP, simulated admin JWT):** ran the full new lifecycle against a real Production Order (`SPR26-0707-0009`, qty 50): confirmed `add_production_completed_qty` correctly **rejected** while still `not_started` ("must be WIP or Partially Completed"); `start_production_order` moved it to `wip`; adding 10 auto-flipped it to `partially_completed`; adding 41 more (only 40 remained) correctly raised "cannot exceed 50 (currently 10 of 50, tried to add 41)"; `cancel_production_order` correctly cancelled from `partially_completed`, and a second cancel attempt correctly raised "cannot be cancelled from its current status (cancelled)". Activity log confirmed the exact expected format (`+10 completed on 2026-07-07 — 10 of 50 total`). `npx tsc --noEmit` clean.

**Further amendment (same day):** Sinag asked to remove Completed/Cancelled from the `/dashboard/orders/production` list — it should only show pending work. Added `.in("status", ["not_started", "wip", "partially_completed"])` to the list query (`app/dashboard/orders/production/page.tsx`); PageHeader description updated to say so and points to the Production Report for the full history (which already lists all statuses, unaffected). Confirmed against live data: 8 `completed` + 3 `cancelled` rows now correctly excluded, only the 1 real `partially_completed` row remains. `npx tsc --noEmit` clean.

**Depends on:** PS-2/PS-3 (`production_orders` must exist). Independent of PS-6/7/8 (Shipments).

 hit the "another `next dev` process already holds this workspace" symptom other sessions in this doc also hit (PS-6/PS-7/PS-8's "Not verified" notes) — this time it turned out to be a stale port lock with no live process behind it (`tasklist`/`netstat` showed nothing actually running on port 3000). Killing all node processes and restarting cleanly resolved it; not a genuine concurrent-session conflict this time, but worth checking for next time this symptom recurs before assuming verification is blocked.

---

## PS-13 — Auto-advance to Ready for Shipping on production completion ✅ DONE (2026-07-07)

**Requested by Sinag directly (2026-07-07)**, not part of the original 9-phase plan: individual orders should go straight from production completion to Ready for Shipping (and thus appear on the Shipping page) without the existing manual "Mark Ready for Shipping" click.

**Kickoff decision confirmed with Sinag before building:** applies to delivery/null-fulfillment orders only. Pickup orders are explicitly excluded — they still stop at `production_completed` and require a manual `mark_picked_up()` click, since that represents a real-world event (the customer physically arriving), not a pure system state.

**What was built:**
- Migration `ps13_auto_ready_for_shipping`: `recompute_order_status()` now also selects `orders.fulfillment_method`. In the branch where all non-cancelled Production Orders are `completed`, it sets the order straight to `ready_for_shipping` for non-pickup orders (was: always `production_completed`, requiring a separate manual step); pickup orders are unaffected, still landing on `production_completed`. The function now also writes one `activity_logs` row (`order_ready_for_shipping`) when it performs this auto-advance, using `get diagnostics` to detect the row actually changed — mirrors the log line the old manual button wrote, so the Activity Log panel keeps showing the transition even though no human triggers it anymore.
- Same migration backfilled the 2 live orders already stuck at `production_completed` with non-pickup fulfillment (`SOD26-0707-0010`, fulfillment_method null; `SOD26-0707-0012`, fulfillment_method delivery) forward to `ready_for_shipping`, with a corresponding activity log row each, so orders that completed production before this shipped land in the same place as new ones.
- Removed the now-permanently-unreachable "Mark Ready for Shipping" button/handler from Order Detail (`order-detail.tsx`, `page.tsx`'s `canMarkReadyForShipping`) and its `markReadyForShipping` wrapper from `active-orders/actions.ts` (no caller left) — same treatment `shipOrder`/`markDelivered` got in PS-8/D036. The underlying `mark_ready_for_shipping()` RPC is left in the database untouched, per this project's additive-migrations convention. `mark_picked_up()` and its UI button are completely unchanged.
- `BUSINESS_RULES.md` (`## Orders` status flow, `recompute_order_status()` bullet), `MODULE_STATUS.md` (Orders/Shipping bullets), `DECISIONS.md` (new `D037`) updated.

**Verified:** `npx tsc --noEmit` clean after the UI removals. Live (Supabase MCP): confirmed the 2 backfilled orders now read `ready_for_shipping`.

**Depends on:** PS-3 (Production Order completion aggregation), PS-7/D036 (Ready for Shipping / Shipping page already exist as the landing state). Independent of PS-9/PS-10/PS-12.

---

## PS-15 — Edit Shipment while preparing ✅ DONE (2026-07-07)

**Requested by Sinag directly (2026-07-07)**, not part of the original plan: let a shipment's courier/tracking/cost/fee/product lines/packaging lines be edited after creation, as long as it hasn't been marked Shipped yet.

**What was built:**
- New RPC `update_shipment(p_shipment_id, p_courier_id, p_tracking_number, p_shipping_cost, p_shipping_fee_charged, p_note, p_items, p_packaging_items)` (migration `ps15_update_shipment`) — mirrors `create_shipment()`'s (PS-6) validation exactly: order-item ownership check, positive-quantity check, cumulative-ships-can't-exceed-ordered-quantity check, packaging-must-be-`packaging`-category check. Status-gated to `preparing` only. Replaces rather than merges: deletes and reinserts `shipment_items`/`shipment_packaging_items` inside the same transaction, so the "already shipped" cumulative check naturally excludes the shipment's own prior allocation (it's gone by the time the check runs) while still counting every other shipment on the order — verified live this doesn't let a shipment double-count itself, and still correctly blocks exceeding the order line's total across shipments. Role-gated admin/encoder, matching `create_shipment`, with the null-safe `v_role is null or v_role not in (...)` check from the start. Logs `shipment_updated` to `activity_logs`.
- `OrderShipments` (`app/dashboard/orders/active-orders/[orderNumber]/order-shipments.tsx`, shared by both the Order Detail Shipments card and the standalone `/dashboard/orders/shipping/[orderNumber]` page) gained an **Edit** button next to Mark Shipped, shown only while `status = 'preparing'` and only for the same admin/encoder role that can create shipments. Clicking it reopens the existing Add-Shipment dialog pre-filled with the shipment's current courier/tracking/cost/fee/note/product-quantities/packaging-quantities, retitled "Edit Shipment `<number>`"; Save calls `update_shipment()` instead of `create_shipment()`. The Add and Edit flows now share one dialog/form instead of two.
- Per-line "remaining" quantity shown in the form is computed as the order-wide remaining (across all shipments) plus that line's own quantity already sitting in the shipment being edited — so editing a shipment doesn't show a falsely-low cap just because its own existing allocation is counted as "already shipped" elsewhere.
- `page.tsx` for both the Order Detail and standalone Shipping detail routes now also select `courier_id` (`order_shipments`) and `variant_id` (`shipment_packaging_items`), and pass `order_item_id`/`variant_id` through on each product/packaging line — needed to pre-fill the edit form and previously only used for display.
- `updateShipment()` added to `active-orders/actions.ts`, revalidating the same paths as `createShipment`. `lib/supabase/types.ts` regenerated to include `update_shipment`.

**Verified live (Supabase MCP direct RPC + browser, admin account `sinagukit@gmail.com`):** null-role call rejected; editing a `delivered` shipment rejected ("can only be edited while preparing"); editing a `preparing` shipment (`SSH26-0707-0010` on `SOD26-0707-0012`) with the same quantity it already had succeeded without a false "would exceed ordered quantity" rejection, confirming the delete-before-recheck logic; attempting to raise that same line to a quantity that would exceed the order total when combined with its sibling shipment (`SSH26-0707-0007`) correctly raised and rolled back. Browser-verified end-to-end on the real Shipping detail page (`/dashboard/orders/shipping/SOD26-0707-0012`, the exact screenshot Sinag provided): Edit button appears only on the two `preparing` shipments; opening it pre-fills tracking number, courier ("J&T" on `SSH26-0707-0007`), and both product-line quantities (5 and 3) with correct remaining caps; editing and saving the tracking number persisted and displayed correctly on refresh; edits reverted afterward to leave live data unchanged. `npx tsc --noEmit` clean.

**Note:** browser verification used a directly-connected Chrome browser (already authenticated as the human admin account) rather than the sandboxed preview tool, because port 3000 was already held by another session's live `next dev` server — same recurring symptom noted in PS-10/PS-12's writeups, this time confirmed to be a genuinely active server (not a stale lock) via a successful `curl`, so it was left running rather than killed.

**Depends on:** PS-6 (`create_shipment`, `shipment_items`/`shipment_packaging_items` schema). Independent of PS-7 through PS-13.

---

## PS-16 — Dedicated Payment page, Close Payment, Payment Preview ✅ DONE (2026-07-07)

**Requested by Sinag directly (2026-07-07)**, not part of the original plan: give payment work its own focused surface instead of front-dooring into the full Active Order Detail page, add a way to formally close an order's payment (with different rules depending on Unpaid/Partially Paid/Paid/Overpaid), and add a printable Payment Preview for communicating the remaining balance to a customer.

**What was built:**
- Migration `ps16_close_payment`: `orders.payment_closed_at timestamptz`, `payment_closed_by uuid references profiles(id)`, `payment_close_note text`, `tip_amount numeric not null default 0`.
- New RPC `close_order_payment(p_order_id, p_note default null)` — admin/manager/encoder (same set as Add Payment), following `cancel_order()`'s row-lock + `activity_logs` pattern. Gated by the derived Payment Status bucket: `Unpaid` rejected (nothing to close); `Partially Paid` requires a non-blank note or rejects; `Paid`/`Overpaid` close with an optional note; `Overpaid` additionally stamps `tip_amount = total_paid - total_money`. Already-closed orders reject a second close. Logs one `activity_logs` row per close, description varying by bucket.
- Extracted the existing Payments card + Add Payment dialog out of `order-detail.tsx` into a new shared client component, `active-orders/[orderNumber]/order-payments.tsx` (`OrderPayments`) — same shared-component pattern PS-15 established for `OrderShipments`. It now also owns a **Close Payment** button (hidden once Unpaid or already closed) with a dialog whose Note field is required only when Partially Paid, previews the tip amount when Overpaid, and shows a closed-state banner (closed date/by/note/tip) once closed; and a **Payment Preview** link next to Add Payment.
- `closeOrderPayment()` added to `active-orders/actions.ts`, revalidating both the Order Detail and the new Payment page/preview paths.
- New dedicated Payment page: `app/dashboard/orders/payment/[orderNumber]/page.tsx` + `payment-order-detail.tsx` — same order/customer info shape as Order Detail (status, customer, dates, fulfillment method) plus the shared `OrderPayments` and Activity Log, but **no line items and no shipping** — exactly the "same as Active Order page but stripped" Sinag asked for. The Payment list (`payment-table.tsx`) row click now routes here instead of Active Orders.
- New Payment Preview page: `app/dashboard/orders/payment/[orderNumber]/preview/page.tsx` — read-only, print-friendly, modeled directly on the existing Quotation view page (`print:hidden` Back button, relies on the browser's native print). Shows store header, order/customer info, the full order-items table (qty/price/modifiers/discount/line total), subtotal/discount/total, payment history table, Total Paid, and Remaining Balance (or, if overpaid, that amount labeled as a tip) — the number this page exists to communicate.
- `BUSINESS_RULES.md` gained a new `## Payments` section; `MODULE_STATUS.md`'s Payment bullet rewritten (no longer "front door only"); `DECISIONS.md` gained `D038` recording the note-required-for-partial-close and overpaid-as-tip semantics. `lib/supabase/types.ts` regenerated.

**Not built:** reopening a closed payment (not requested — a deliberate scope cut, flagged as a future follow-up if a close ever needs correcting).

**Verified:** `npx tsc --noEmit` clean after every file added/changed. Supabase MCP direct-RPC checks against live (test) data: null-role call rejected; Unpaid order rejected ("Nothing to close"); Partially Paid rejected without a note, succeeded with one and stamped `payment_close_note` correctly (trimmed); Overpaid succeeded with `tip_amount` exactly matching `total_paid - total_money` (₱96.00 and ₱100.00 across two orders); double-close on an already-closed order rejected. Browser-verified end-to-end (Claude admin test account): Payment list row click lands on the new dedicated page, not Active Order Detail; the page shows order/customer info + Payments + Activity Log only, no line items or shipping; Close Payment button correctly hidden on an Unpaid order; the Close Payment dialog blocked submission client-side on a Partially Paid order with an empty note, then succeeded once a note was typed, updating the closed banner and Activity Log live; the Overpaid dialog correctly previewed "overpaid by ₱100.00 — recorded as a tip" and the resulting `tip_amount` matched after submit; Payment Preview rendered the item table, totals, payment history, and the Overpaid-as-tip line correctly, with the Back button confirmed `print:hidden` via DOM inspection; Active Order Detail's own Payments card (Order Summary/Line Items/Shipments/Payments/Activity Log headings all present) confirmed unregressed by the `OrderPayments` extraction. No console errors.

**Note:** a stale Turbopack `.next` cache from a prior session's dev server caused every route nested under `/dashboard/orders/` (not just the new Payment pages — pre-existing ones like Production/Quotation/Completed too) to 404 at the start of this verification pass; deleting `.next` and restarting resolved it. Unrelated to this phase's code changes, but recorded here since it briefly looked like a regression.

**Live data note:** verification permanently closed the payment on 3 real (test) orders (`SOD26-0707-0007`, `SOD26-0707-0011` — Partially Paid, `SOD26-0706-0006` — Overpaid) and added matching test `order_payments` rows, since `close_order_payment()` has no reopen path by design. Consistent with this project's test-data status (see `PROGRESS-INVENTORY.md`'s data note) — left in place rather than reverted.

**Depends on:** PS-10 (Payment list), PS-15 (established the shared-component pattern this reuses). Independent of everything else in this doc.

---

## PS-17 — Per-shipment fulfillment type (pickup vs delivery) ✅ DONE (2026-07-08)

**Requested by Sinag directly (2026-07-08)**, prompted by a Quote→Shipping end-to-end test that surfaced a real bug: pickup orders' `mark_picked_up()` never deducted stock, so component stock sat permanently in In Production. Rather than patch that RPC in isolation, Sinag asked for fulfillment type to move from an order-level attribute to a **per-shipment** one, decided in the Add Shipment dialog itself (default "Ship to Customer" = on) — because one order can be split across several shipments with different fulfillment types (some units picked up, the rest couriered later).

**What was built** (migrations `ps17_pickup_shipments`, `ps17b_fix_shipping_rollup_and_drop_orphan_overloads`):
- New `order_shipments.fulfillment_type` column (`pickup`/`delivery`, default `delivery`) — the single source of truth per shipment record. `orders.fulfillment_method` is left in place, unused; see D039 — repurposing/dropping it is an explicit open decision, not resolved here.
- `recompute_order_status()`'s PS-13 special case (pickup stops at `production_completed`) is retired — every order now advances straight to `ready_for_shipping` once production completes, since it may need both pickup and delivery shipments allocated from the same page.
- New RPC `mark_shipment_picked_up()` — the pickup equivalent of `mark_shipment_shipped()`, but a single atomic step (`shipped_at = delivered_at = now()`, one real-world event). Reuses the same BOM-expanded stock-out logic via a new shared private helper `_deduct_shipment_stock()` (factored out of `mark_shipment_shipped()`) — this is what actually fixes the pickup stock-deduction gap. The whole-order `mark_picked_up()` RPC and its Order Detail button are retired the same way `ship_order`/D036 retired their predecessors — RPC left in the database, UI caller removed.
- `create_shipment()`/`update_shipment()` gained `p_fulfillment_type`; courier/tracking/cost/fee are forced null on pickup-type rows regardless of what's passed. **Pickup shipments get a new `SSP` number prefix**, distinct from delivery's existing `SSH` (Sinag's explicit call) — both prefixes coexist in `order_shipments` going forward via `set_shipment_number()` branching on `fulfillment_type`.
- **This supersedes D036**: `create_shipment()`'s gate widened from `orders.status = 'ready_for_shipping'` exactly to also allow `shipped`, since the mixed-fulfillment use case needs shipments addable incrementally (e.g. 3 units picked up today, the remaining 3 shipped once a courier is arranged). Per-line quantity validation already prevents over-allocation, so this adds no new risk. `canAddShipment` widened to match in both `active-orders/[orderNumber]/page.tsx` and `shipping/[orderNumber]/page.tsx`.
- UI (`order-shipments.tsx`, shared by Order Detail and the standalone Shipping page): a "Ship to Customer" `Toggle` at the top of the Add/Edit Shipment dialog, defaulting on. Off hides Courier/Tracking/Cost/Fee; Product Lines and Packaging Materials stay visible and functional either way (pickup orders can still take packaging materials). Flipping the toggle while editing a `preparing` shipment preserves already-entered line quantities — verified live, not just assumed. Each shipment row now shows a type badge (Pickup/Delivery) and the matching action: pickup gets a single "Mark as Picked Up" button, delivery keeps the existing two-step Mark Shipped → Mark Delivered. Pickup rows collapse the Shipped/Delivered timestamps into one "Picked Up" row. The Shipping list page's overview table gained the same type indicator.
- Removed the "Fulfillment Method" select entirely from New Order and Edit Order forms (`new-order-form.tsx`, `edit-order-form.tsx`) — no longer meaningful once type lives per-shipment; this is what actually retires the field, not just its behavior.
- `lib/supabase/types.ts` regenerated.

**Bug caught and fixed during verification (documented in D039):** `recompute_shipping_status()` only counted `order_shipments` rows, not whether the order's full line-item quantity had been allocated. On a mixed order (6 units, one pickup shipment covering 3), marking that one shipment picked up rolled the *entire order* to `delivered` even though 3 units were never allocated to any shipment. Fixed by also requiring zero remaining unshipped quantity (`sum(order_items.quantity) - sum(shipment_items.quantity_shipped)`) before reaching `delivered` — otherwise the order correctly stays `shipped`, and (per the D036 supersession above) "Add Shipment" remains available to allocate the rest.

**Also caught and fixed:** `create or replace function` with a widened parameter list creates a second overload rather than replacing the original when the signature differs — the same class of issue ORDER-2/D027 hit with `adjust_order_items()`. Dropped the orphaned 8-param `create_shipment`/`update_shipment` overloads in the `ps17b` follow-up migration.

**Verified live (browser, admin test account, plus direct RPC for confirm()-gated actions per this project's established tooling-limitation workaround):**
- Pickup-only shipment (`SSP26-0708-0001`): created via the Add/Edit dialog with the toggle off, product-line quantity correctly capped to "remaining", courier fields correctly hidden and stored null; Mark as Picked Up correctly deducted stock BOM-expanded (In Production → Out) in one atomic step, confirmed via SQL before/after on both composite components.
- Delivery-only shipment: unchanged regression check, full Add Shipment → Mark Shipped → Mark Delivered cycle still correct.
- Mixed order (6 units): 3 picked up first (order correctly stayed `shipped`, not prematurely `delivered`, after the rollup fix), "Add Shipment" reappeared despite the order already being `shipped` (confirming the D036 supersession), remaining 3 added as a delivery shipment and carried through Mark Shipped → Mark Delivered — order only reached `delivered` once both portions were complete, with stock correctly reduced by the full 6 units combined.
- Edit flow: opened a `preparing` delivery shipment, flipped the toggle to pickup, confirmed the product-line quantity (4) was still populated (not cleared), saved, confirmed via SQL `fulfillment_type` flipped while `shipment_items.quantity_shipped` was untouched.
- `npx tsc --noEmit` clean throughout. `get_advisors` (security) shows no new finding *category* — same pre-existing anon/authenticated SECURITY DEFINER-executable class every RPC in this project already has.

**Not built / open follow-ups:**
- `orders.fulfillment_method` repurposing or removal — explicit open decision (D039), not resolved here.
- No per-shipment delivery address field was added, despite Sinag's stated rationale ("every shipment may have different address") for why the toggle lives per-shipment rather than per-order — the toggle itself was the actual ask; a distinct address-per-shipment field was not requested as a concrete field and wasn't built speculatively.

**Depends on:** PS-6/PS-7/PS-8 (shipment schema and UI this extends), PS-13 (the `recompute_order_status()` branch this retires). Independent of PS-9/PS-10/PS-12/PS-15/PS-16.

---

## PS-18 — Explicit Fulfillment Method + per-shipment receiver, unified SSH numbering ✅ DONE (2026-07-08)

**Requested by Sinag directly (2026-07-08)**, as an amendment to PS-17. PS-17's "Ship to
Customer" `Toggle` doubled as the fulfillment-type switch itself (on = delivery, off =
pickup), and shipments had no receiver/address at all. Separately, an older order-level
system (ORDER-7/PROGRESS-CUSTOMERS Part 2 — `orders.same_as_customer`/`receiver_*`) let a
Sales Order record a receiver different from its customer, but was never wired into
shipments. Sinag's mockup asked for three explicit conditions in the Add/Edit Shipment
dialog: **Delivery + Ships to Customer On** (receiver = the order's registered customer,
no manual entry), **Delivery + Ships to Customer Off** (a different receiver, entered
manually), and **Pick Up** (no receiver/courier fields, toggle not applicable) — plus a
single `SSH` number prefix for every shipment, dropping PS-17/D039's separate `SSP`
prefix for pickup.

**What was built** (migration `ps18_shipment_receiver_fields`):
- New `order_shipments` columns: `ships_to_customer boolean`, `receiver_name/phone/
  address_line1/barangay/city/province/postal_code text` — all nullable, forced null on
  pickup shipments (same pattern as the existing courier-field nulling).
- `set_shipment_number()` simplified to always generate `SSH<YY>-<MMDD>-####` — the
  pickup/delivery prefix branch is removed. Existing `SSP`-numbered rows are untouched
  history, not renumbered.
- `create_shipment()`/`update_shipment()` gained `p_ships_to_customer` and 7
  `p_receiver_*` params (old 9-arg overloads explicitly dropped first — same
  orphaned-overload trap as D027/PS-17b, avoided this time). Server-side logic per
  condition: pickup forces `ships_to_customer`/`receiver_*` null regardless of input;
  delivery + `ships_to_customer=true` looks up the order's `customer_id` and snapshots
  `customers.name/phone_number/address_*` into the shipment — **client-supplied
  `p_receiver_*` is ignored in this branch**, and it raises `'Cannot ship to customer:
  this order has no registered customer'` if the order is walk-in; delivery +
  `ships_to_customer=false` requires a non-blank `p_receiver_name` and stores the
  client-supplied values verbatim.
- UI (`order-shipments.tsx`, shared by Order Detail and the standalone Shipping page):
  the old single `Toggle` is replaced by a `Select` "Fulfillment Method"
  (Delivery/Pick Up). Delivery reveals a separate "Ships to Customer?" `Toggle` (default
  on): on shows a read-only block with the order's customer name/phone/address (new
  `ShipmentCustomer` prop, threaded from both `page.tsx` callers' existing customer
  joins); off shows the full manual receiver field set (Name required, Phone, Address
  Line 1, Barangay, City, Province, Postal Code — same layout as the retired order-level
  form). Walk-in orders (no customer) auto-force the toggle off and disable it. Pick Up
  hides the toggle and all receiver/courier fields entirely. The read-only shipment card
  gained a Receiver line for delivery shipments. Editing a `preparing` shipment restores
  Fulfillment Method + Ships to Customer + receiver values correctly and still preserves
  already-entered product/packaging line quantities across any of these changes.
- **Retired the order-level receiver system**: the "Shipping" card (Toggle + 6 receiver
  `Input`s) removed from both `new-order-form.tsx` and `edit-order-form.tsx`; the
  matching read-only block removed from Order Detail's Order Summary. `orders.
  same_as_customer`/`receiver_*` columns are left in the schema, unused — same precedent
  as `fulfillment_method` (D039); no `actions.ts` change was needed since
  `same_as_customer` already defaults to `true` when the form field is absent.
- `lib/supabase/types.ts` regenerated. See `DECISIONS.md` D040 for the full decision
  record, including the explicit reversal of D039's SSP-prefix call.

**Verified live:** `npx tsc --noEmit` clean before and after the `types.ts` regen.
`get_advisors` (security) shows `create_shipment`/`update_shipment` under the same two
pre-existing SECURITY DEFINER lint categories every RPC in this project already has, no
new category. Browser-verified end-to-end (Claude admin test account) on a real order
with two composite (BOM) product lines, against a registered customer with no address on
file: **Condition 1** — dialog showed the read-only customer block, no manual fields; the
created shipment (`SSH26-0708-0018`) stored `ships_to_customer=true` and a `receiver_name`
snapshot matching the customer row exactly, not any client input. **Condition 2** —
toggling off revealed the manual fields; submitting with a blank Receiver Name was
blocked client-side (dialog stayed open, no network call); filling it in and submitting
created `SSH26-0708-0019` with the manually entered receiver stored verbatim.
**Condition 3** — selecting Pick Up hid the toggle and all receiver/courier fields,
matching the mockup exactly; created `SSH26-0708-0020` with `ships_to_customer` and every
receiver/courier field null — confirming the `SSH` prefix applies to pickup too. Stock-out
verified for all three: Mark Shipped (Conditions 1 and 2, browser + impersonated-RPC) and
Mark as Picked Up (Condition 3, impersonated-RPC) each deducted the identical
BOM-expanded quantities from `in_production_qty` for all five components of the composite
product, byte-for-byte the same delta each time — proving the new receiver columns don't
disturb `_deduct_shipment_stock`. The server-side "no registered customer" guard was
confirmed by temporarily flipping a walk-in order to `ready_for_shipping` inside a rolled
-back transaction and calling `create_shipment` with `p_ships_to_customer=true` directly —
rejected with the exact expected error, transaction rolled back, order status unaffected.
An existing `SSP`-numbered shipment from before this migration still renders on Order
Detail with no console errors, confirming legacy data is unaffected.

**Not built / open follow-ups:**
- `orders.fulfillment_method`/`same_as_customer`/`receiver_*` removal — still an open
  decision (D039), not resolved here; this phase only stopped writing to the receiver
  columns, it didn't drop them.
- Mixed pickup+delivery order-status rollup (PS-17's `recompute_shipping_status()` fix)
  was not re-verified in this phase — untouched by this change, already covered by PS-17's
  own verification.

**Depends on:** PS-17/D039 (the per-shipment fulfillment-type model this refines).
Independent of everything else in this doc.

---

## PS-19 — Quote Preview / Payment Preview document redesign ✅ DONE (2026-07-08)

**Requested by Sinag directly (2026-07-08)**, iterative revisions against a screenshot of the live Quote Preview page, then extended to the Payment Preview page (which was already modeled directly on Quote Preview per PS-16) for consistency.

**What changed, both pages** (`app/dashboard/orders/quotation/[quoteNumber]/view/page.tsx`, `app/dashboard/orders/payment/[orderNumber]/preview/page.tsx`):
- SKU dropped from the item name cell.
- Modifier column removed from the line-items table; modifier value now renders as a small muted line under the item name instead, and only the option value is shown (`modifierValue()` helper strips the `"Group: "` prefix off `name_snapshot`, e.g. `"Ref Magnet: Simple Text"` → `"Simple Text"`).
- Unit Price column now shows unit price **plus** the summed modifier price (`unitPriceWithModifier`), not unit price alone — Line Total math unchanged, just no longer silently hiding the modifier's contribution.
- Qty/Unit Price/Discount/Line Total columns given equal fixed widths (`table-fixed`, each `w-[12%]`) so they align as a clean grid instead of auto-sizing to content.
- Company header now shows a literal "Sinag Ukit" name (not `stores.name`, which holds the Loyverse store code `CPR-B13L82`) plus Address/Phone/Email, sourced from the (single) active store row rather than gated on `quote.store_id`/`order.store_id` — both of which turned out to never be populated by their respective create flows, so the original `store_id ? fetch : null` conditional silently produced no company details at all. Fetches `stores` by `is_active = true` instead.
- New "Prepared by" section: creator's `full_name` plus a new `function_title` field (see migration below), joined via `profiles!quotes_created_by_fkey` / `profiles!orders_created_by_fkey`.
- New footer line: "Note: No signature required, electronically prepared."

**Payment Preview only:**
- The "Status" field (previously the order's fulfillment `status`, e.g. "Delivered") is now labeled "Payment Status" and shows the same computed Unpaid/Partially Paid/Paid/Overpaid bucket already used by the Payment list page (`paymentStatus()` in `payment/page.tsx`) — duplicated locally rather than shared across the two files (already the existing local-helper pattern here, e.g. `peso()`/`firstOf()`).
- The old "Overpaid (tip)" summary label renamed to "Service Tip" per Sinag's direct correction.

**Migrations** (`add_store_phone_and_profile_function_title`, `add_store_email`):
- `stores.phone`, `stores.email` (new nullable columns) — data backfilled on the one live store row (`name = 'CPR-B13L82'`): address `"Brgy. Makiling, Calamba City, Laguna, PH"`, phone `"0923-430-0026"`, email `"sinagukit@gmail.com"`.
- `profiles.function_title text not null default 'employee'` — a new **job-function** field, explicitly distinct from the `role` permission enum (admin/encoder/manager/cashier/viewer). No UI to edit it yet; defaults to `'employee'` for every existing profile. Sinag's own note when requesting this: "function is different from roles... for now default are employee."

**Verified (browser preview, Claude admin test account):** both preview pages re-checked end-to-end via accessibility snapshot after each round of changes — SKU absent, modifier column absent, modifier value shows the stripped option text, Unit Price includes modifier price (confirmed against a case with a non-zero modifier price via the Payment Preview's ₱99.00-discount line), all four numeric columns measured at equal width via `preview_inspect` (84.23px each), company header shows Sinag Ukit/Address/Phone/Email on both pages, Prepared By shows the real creator (`profiles.full_name`) and `employee` function, footer note present, Payment Preview's Payment Status correctly computed "Overpaid" against real Total Paid vs Order Total, "Service Tip" label confirmed replacing "Overpaid (tip)".

**Not built:** a settings/admin UI to edit `stores.address/phone/email` or `profiles.function_title` — both are DB-only for now, edited directly via migration/SQL since there's a single store and function_title has no assigned values yet beyond the default.

**Depends on:** PS-16 (created the Payment Preview page this also touches). Independent of everything else in this doc.

---

## PS-20 — On Hold status-scoped Orders list page ✅ DONE (2026-07-09)

**Requested by Sinag directly (2026-07-09)**, extending PS-10's status-scoped list pattern to the `on_hold` status, which existed since ORDER-9 (`PROGRESS-ORDERS.md`) but had no dedicated list page — only reachable via a filter dropdown on Active Orders.

**What was built:**
- New `app/dashboard/orders/on-hold/page.tsx` + `on-hold-table.tsx`: same shape as Confirmed's list (Order No./Customer/Order Date/Created/Modified/Items/Last Activity, `DateRangeFilter`, no status column since the set is fixed), querying `orders` where `status='on_hold'` instead of `'confirmed'`.
- Row click routes to Active Orders' full Order Detail page (`/dashboard/orders/active-orders/[orderNumber]`), **not** a new bespoke detail page — that page already has status-aware `canResume`/`canHold`/`canCancel` gating (ORDER-9) and is the only place Resume Order lives. This follows the Shipping/Payment "front door only" pattern from PS-10, not Confirmed's own bespoke `confirmed-order-detail.tsx` (which 404s any non-`confirmed` order and would have needed Resume Order duplicated into it for no benefit).
- New "On Hold" sidebar entry in `components/layout/app-shell.tsx`'s Orders subgroup, placed between Confirmed and Production.
- No schema/RPC changes — `on_hold` status and `hold_order()`/`resume_order()` already existed (ORDER-9).

**Note found, not fixed:** `MODULE_STATUS.md`'s existing Confirmed bullet claims "Row click navigates to Active Orders' Order Detail page, same as every other status-scoped Orders list" — but the actual `confirmed-table.tsx` routes to its own `confirmed/[orderNumber]` bespoke detail page, not Active Orders' Order Detail. Doc/code mismatch, predates this phase, left alone (out of scope for this ask).

**Verification:** `npx tsc --noEmit` clean. Browser-verified end-to-end (Claude admin test account): page rendered correctly empty (no live order was `on_hold` at the time). Held the one live `in_production` order (`SOD26-0708-0020`) via its existing Put On Hold action, confirmed it appeared on the new On Hold list with correct columns/items, clicked the row and landed on Active Orders' Order Detail with a working "Resume Order" button, resumed it, and confirmed via direct Postgres it landed back on `in_production` (its pre-test status) — no residual test-data mutation left behind. On Hold list confirmed empty again afterward. Sidebar "On Hold" link confirmed present with the correct href.

**Depends on:** ORDER-9 (`on_hold` status, `hold_order`/`resume_order`) and PS-10 (the list-page pattern this reuses). Independent of everything else in this doc.

### PS-20 amendment — dedicated On Hold detail page, no Payments/Activity Log (2026-07-09)

**Requested by Sinag directly**, immediately superseding the "front door to Active Orders" routing decision above:
1. On Hold orders need their own URL, `/dashboard/orders/on-hold/<orderNumber>`, not a redirect to Active Orders' Order Detail.
2. That page must not show the Payments card or the Activity Log — those stay exclusive to Active Orders' Order Detail.

**What changed:**
- New `app/dashboard/orders/on-hold/[orderNumber]/page.tsx` + `on-hold-order-detail.tsx` — a bespoke detail page in the Confirmed-page style (404s any order whose status isn't `on_hold`), not the Shipping/Payment front-door style this phase originally used. Reuses `resumeOrder()` from Active Orders' `actions.ts` (no new server actions) and the existing `OrderShipments` component for the Shipments card (shown only if the order already has shipments — carried over from a `ready_for_shipping`/`shipped` order being held — rendered with `canAddShipment` hardcoded `false` since `on_hold` never qualifies to add one).
- Shows Order Summary + Line Items + Shipments (if any). **Omits** the Payments card and Activity Log entirely — not hidden behind a flag, just not rendered, matching the codebase's existing pattern of separate per-status detail components (e.g. `confirmed-order-detail.tsx`) rather than a shared component with visibility toggles.
- `on-hold-table.tsx`'s row click updated to `/dashboard/orders/on-hold/${orderNumber}` instead of the Active Orders path.
- Not changed: `isShippingRole`-gated Mark Shipped/Mark Delivered/Mark Picked Up/Edit actions inside the carried-over Shipments card remain available exactly as they were on Active Orders' Order Detail (gated by shipment status, not order status) — this is pre-existing behavior for any `on_hold` order with an in-flight shipment, not something this change introduces or was asked to restrict.

**Verified (browser preview, Claude admin test account):** `npx tsc --noEmit` clean. Put the same live order (`SOD26-0708-0020`) on hold, confirmed the new URL renders Order Summary + Line Items + Resume Order with no Payments card and no Activity Log present (DOM query), confirmed the On Hold list's row click lands on `/dashboard/orders/on-hold/<orderNumber>` (not Active Orders), clicked Resume Order and confirmed via direct Postgres it restored to `in_production` (its prior status, `on_hold_previous_status` correctly read and cleared) with the redirect landing back on the now-empty On Hold list.

---

## PS-21 — Cancel Order enabled for On Hold, cancel_order() bucket-resolution rewrite ✅ DONE (2026-07-09)

**Requested by Sinag directly**: add a Cancel button to the On Hold detail page (PS-20). Assessed first — On Hold orders don't have a single stock state, so a naive status-guard change would misbehave; see [[D042]] for the full design decision.

**What was built:**
- `cancel_order()` rewritten (migration `fix_cancel_order_on_hold_and_bucket_resolution`): allowed-status list gains `on_hold`; the function no longer assumes stock sits in the `reserved` bucket. It now walks every non-cancelled `production_orders` row linked to the order first — `not_started`/`wip`/`partially_completed` ones go through the existing `cancel_production_order()` (uncompleted → available, completed portion → `on_hold` bucket, `order_items` unlinked/zeroed), and `completed` ones (a case `cancel_production_order()` itself refuses) get an inline branch that parks the full quantity in the `on_hold` bucket directly, since `complete_production_order()` never moves stock out of `in_production` on completion. Only after that does it release any order_items still purely in Reserved (never entered production), then flips `orders.status = 'cancelled'` and clears `on_hold_previous_status`.
- Same rewrite also fixes a latent bug that predated On Hold entirely: `cancel_order()` already claimed to support cancelling `in_production`/`partially_completed` orders, but its old hardcoded `reserved`-bucket release would raise "Insufficient reserved quantity" (or worse, silently drain an unrelated order's reserved stock of the same variant) the moment any linked Production Order had actually started, since `start_production()` (PS-2) moves stock `reserved → in_production` for real. The new production-orders-first reconciliation fixes this for all four cancellable statuses uniformly, not just On Hold.
- On Hold detail page (`on-hold-order-detail.tsx`/`page.tsx`): added `canCancel` (admin-only, mirrors `canResume`), a "Cancel Order" button next to Resume Order, reusing the existing `cancelOrder()` action from Active Orders (no new server action needed).
- **Not touched, flagged only:** `order_shipments` rows aren't reconciled by cancel (no `'cancelled'` value exists in that table's status CHECK constraint) — an On Hold order held from `ready_for_shipping` with a shipment already in `preparing` status will leave that shipment dangling after cancel. Same pre-existing gap as `order_payments` (cancelling never reverses a payment either). Out of scope for this ask; flagged for Sinag.

**Verified (browser preview + direct Postgres, Claude admin test account), three scenarios:**
1. `SOD26-0709-0023` (held from `confirmed`, stock purely Reserved): cancelled via the new button — `available_qty` 217→222, `reserved_qty` 5→0, `order_items.reserved_qty` zeroed, order → `cancelled`.
2. `SOD26-0708-0020` (held from `in_production`, two linked Production Orders — one `not_started`, one `partially_completed` 5/15): cancelled — both POs correctly reconciled via `cancel_production_order()` (remaining released to Available, completed portion parked On Hold), all 6 component variants matched hand-computed expected values exactly, both `order_items` unlinked and zeroed, both POs → `cancelled`.
3. Fresh order `SOD26-0709-0024` built end-to-end (create → Start Production → Mark as Complete → Put On Hold from `ready_for_shipping`) to reach the previously-untested case — a **fully `completed`** linked Production Order: cancelled — the new inline branch moved the full qty from `in_production` to the `on_hold` bucket (`available_qty` unchanged at 203, `in_production_qty` 3→0, `on_hold_qty` 0→3), PO → `cancelled`, `order_items` unlinked/zeroed, activity log chain correct (`production_order_cancelled` → `order_production_order_cancelled` → `order_cancelled`).

**Depends on:** PS-20 (On Hold detail page this adds the button to), PS-2/PS-12 (`start_production`/`cancel_production_order` this now reuses), ORDER-7 (`cancel_order` itself). Independent of everything else in this doc.

---

## PS-22 — Order Detail "Completed" column stale during partial production ✅ DONE (2026-07-09)

**Reported by Sinag directly**, via screenshots: On Hold order `SOD26-0709-0025`'s Line Items table showed `Completed: 0` for a line whose linked Production Order (`SPR26-0709-0032`) already showed `10 of 15` completed.

**Root cause:** `order_items.completed_qty` and `production_orders.completed_qty` are two separate columns for the same real quantity, and only one write path keeps them in sync. `complete_production_order()` (the admin-only "Mark as Complete" RPC) writes both. `add_production_completed_qty()` (PS-12b's incremental "Add completed" RPC — the everyday partial-progress path) only ever wrote `production_orders.completed_qty`; it has no `order_items` write and never called `recompute_order_status()`. The Order Detail Line Items table (`on-hold/[orderNumber]/page.tsx` and `active-orders/[orderNumber]/page.tsx`, which also backs the Confirmed/Shipping/Payment detail views per PS-10) reads `order_items.completed_qty` for its "Completed" column, so it stayed at 0 for a line's entire `wip`/`partially_completed` lifecycle and only ever jumped straight to the full quantity once someone eventually hit "Mark as Complete". This gap existed since PS-12b introduced `add_production_completed_qty()` — not a regression from PS-20/PS-21.

Confirmed by reading the live RPC definitions directly (Supabase MCP): `add_production_completed_qty` genuinely has no `order_items` write; `complete_production_order` has both. Also checked whether `orders.status` should be advancing on partial progress — it shouldn't and isn't a separate bug: `recompute_order_status()` only counts Production Orders with `status = 'completed'`, so order-level `partially_completed` means "some Production Orders are fully done, others aren't," a different concept from a single Production Order's own running `completed_qty`.

**Fix — read-side derivation, no RPC/migration change:** both `page.tsx` files now also select `quantity, completed_qty` from the joined `production_orders`, and derive the displayed "Completed" as `round(production_order.completed_qty × order_item.quantity / production_order.quantity)`, falling back to `order_items.completed_qty` when there's no linked Production Order (cancelled/unlinked lines). Mirrors the existing derived-ratio pattern PS-12 already established for composite BOM component progress (`ratio × completed_qty`) rather than introducing a new write path. Correct for the schema's supported (if currently unused) case of multiple `order_items` merged into one Production Order, since `production_order.quantity` is their summed total.

**Verified:** `npx tsc --noEmit` clean. Browser preview blocked — another session's `next dev` process held the workspace's port 3000 lock (same symptom as PS-6/7/8/12's own notes), and this project allows only one dev server per directory. Verified instead via direct SQL against the exact reported order: `SOD26-0709-0025`'s two lines have `(po_completed_qty=10, po_quantity=15, oi_quantity=15)` and `(po_completed_qty=1, po_quantity=1, oi_quantity=1)` — the new formula evaluates to `10` and `1` respectively, matching each Production Order's real progress instead of the stale `0` both lines showed before.

**Depends on:** PS-3 (Order Detail reading `order_items.completed_qty`/production order link), PS-12b (`add_production_completed_qty`, the RPC that introduced the gap). Independent of everything else in this doc.

---

## Sequencing summary

```
PS-1 (packaging category) ──────────────┐
                                          │
PS-2 (production_orders + start prod) ──┼──> PS-3 (PO detail + completion) ──┐
                                          │                                    │
PS-4 (reserved qty override) ────────────┘                                    │
                                                                                ▼
PS-5 (inventory OUT primitive) ──────────────────────────────────────> PS-6 (shipment line items) ──> PS-7 (mark shipped) ──> PS-8 (shipping UI)
                                                                                                                                      │
                                                                                                                                      ▼
                                                                                                                        PS-9 (reporting, optional fast-follow)
```

PS-10 (status-scoped Orders list pages) is a standalone UI follow-on with no schema/RPC dependency on any of the above — it only reads `orders.status`, which PS-2/PS-7 already populate. Listed last because it was requested last, not because anything blocked it.

PS-1 and PS-5 have no dependencies and can start in parallel with anything. PS-2/PS-3 (Production Orders) and PS-6/PS-7/PS-8 (Shipments) are largely independent tracks that only meet at the "order can't enter Shipping until Production Orders are done" gate — they don't have to be built in strict numeric order, but PS-3 should land before PS-7 since PS-7's "all Production Orders done" gate needs PS-3's aggregation to exist.

---

## Docs to update (per phase, not upfront)

Per this project's own convention (ORDER-1: *"MODULE_STATUS.md/BUSINESS_RULES.md updates held until a phase actually changes user-visible behavior"*), don't touch these ahead of time — update each when the triggering phase actually ships.

| Doc | What changes | Triggered by |
|---|---|---|
| `BUSINESS_RULES.md` | Rewrite `## Orders` status flow; also fix the already-stale `## Quotes` line ("Confirmation deducts inventory" — wrong since D025, unrelated pre-existing bug, fix while in the file) | PS-3, PS-7 |
| `BUSINESS_RULES.md` | Add `## Production Orders` section | PS-2/PS-3 |
| `BUSINESS_RULES.md` | Add `## Shipments` section | PS-6/PS-7 |
| `BUSINESS_RULES.md` | Add `## Packaging Materials` section | PS-1/PS-6 |
| `ARCHITECTURE.md` | Rewrite `## Inventory Flow` to show Available→Reserved→In Production→Out | PS-5 |
| `DECISIONS.md` | New entry (next available letter, e.g. D033) — must state this formally supersedes D030's production-consumption scope-out, and record the `completed`/`delivered` resolution | PS-2, PS-7 |
| `MODULE_STATUS.md` | Rewrite Orders > Production bullet | PS-3 |
| `MODULE_STATUS.md` | Rewrite Orders > Shipping bullet | PS-8 |
| `MODULE_STATUS.md` | Flip Management > Item Category from ⬜ | PS-1 |
| `PROGRESS-ORDERS.md` | Add forward-pointer note: ORDER-3/D028's manual Completed Qty retired | PS-3 |
| `PROGRESS-ORDERS.md` | Add forward-pointer note on the bottom "open questions" section: `completed`/`delivered` resolved here | PS-7 |
| `PROGRESS-CUSTOMERS.md` | Cross-reference Part 2 TBD #5 (split shipments) against new multi-shipment support | PS-6 |
| `.claude/skills/bms-app/SKILL.md` | Re-check/update the Production Queue "Mark Completed is admin-only" example — no longer accurate once Production Orders replace it | PS-3 |
| `.claude/skills/bms-supabase/SKILL.md` | Optional: add `production_order_number`/`shipment_number` as named numbering precedents | PS-2, PS-6 (optional) |

No changes needed: `TESTING.md`, `ROADMAP.md`, `NEXT_PHASE.md`, `PROGRESS.md`, `PROGRESS-INVENTORY.md`, `PROGRESS-QUOTES.md`, `PROGRESS-ITEMS.md`, `PROGRESS-PURCHASING.md`, `PROGRESS-ACCOUNTING.md`, `AGENTS.md`/`CLAUDE.md`.
