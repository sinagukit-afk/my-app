# PROGRESS-INVENTORY.md

Tracks the **Inventory Status (movement-based) Phase 1** build for Sinag Ukit ERP. Follows the same convention as `PROGRESS-ITEMS.md`/`PROGRESS-ACCOUNTING.md`: `INV-` prefixed phases, kept separate from the core `PROGRESS.md` numbering. Append-only.

Source doc: `docs/archive/Inventory-Status-Phase1-Kickoff.md` (archived 2026-07-09 — INV-1..6's checklist is fully done and superseded by this file).

---

## Preflight (verbatim from the kickoff doc)

1. Read the full SQL body of `confirm_order()` and `adjust_stock()` (via `Supabase:execute_sql` against `pg_get_functiondef`). Both write to `inventory_levels.in_stock` and `inventory_movements` today, and this phase extends both. Do not guess their current logic.
2. **VERIFIED (2026-07-05):** `inventory_levels` does **not** have a unique constraint on `(variant_id, store_id, source_id)`. The actual constraint is `inventory_levels_variant_id_store_id_key` = `UNIQUE(variant_id, store_id)` only. `source_id` is a plain nullable column, not part of the row's identity. This doc has been updated to key everything off the real grain, `(variant_id, store_id)` — `p_source_id` has been dropped from both new RPCs below. Do not reintroduce a 3-column grain without a separate decision to actually start using `source_id` as a live dimension.
3. Confirm current `movement_type` check constraint values on `inventory_movements` (`initial_sync`, `incoming`, `sale`, `adjustment`, `manual_adjustment`, `order`) before altering it. **VERIFIED (2026-07-05):** matches exactly.
4. Latest migration is `0025_adjust_order_items_receiver_fields` — this phase is `0026_inventory_status_foundation`. This project has no local `supabase/migrations` folder; apply migrations via the Supabase MCP `apply_migration` tool directly against the linked project, per the `erp-supabase` skill.

**Re-verified live at the start of this build (2026-07-05):** `list_migrations` confirmed `0025_...` is still latest; both constraints above re-checked and unchanged; `adjust_stock()`/`confirm_order()` bodies re-read fresh (not from memory) before writing the migration.

---

## INV-1 — Migration 0026: schema + RPCs ✅ DONE

**Status:** Complete 2026-07-05.

**Blocker found and resolved (Sinag's call required):** the backfill `available_qty = in_stock` failed — 7 existing `inventory_levels` rows already have **negative** `in_stock` (all raw-material `Inv-` items, e.g. `SUIV-0023`/`SUIV-0026`/`SUIV-0027`/`SUIV-0022` at -500, `SUIV-0016` at -42, `SUIV-0033` at -1, `SUIV-0005` at -0.008), pre-existing data drift unrelated to this migration. **Sinag decided:** clamp `available_qty = GREATEST(in_stock, 0)` for these rows. `in_stock` itself is left untouched (still negative) as a visible data-quality flag; not fixed as part of this phase.

**What was built (migration `0026_inventory_status_foundation`):**
- `inventory_levels` +5 columns: `available_qty`, `reserved_qty`, `in_production_qty`, `on_hold_qty`, `incoming_qty` (all `numeric NOT NULL DEFAULT 0 CHECK (>= 0)`). Backfilled per the decision above.
- `inventory_movements` +4 columns: `status` (5-value check, default `'available'`), `quantity_before` (backfilled from `quantity_after - quantity_change`, then `NOT NULL`), `transfer_group_id` (uuid, indexed partial), `counterpart_status` (nullable, same 5-value check).
- `movement_type` check extended to add `status_transfer`, `status_adjustment` alongside the existing 6 values.
- `transfer_stock_status(p_variant_id, p_store_id, p_from_status, p_to_status, p_quantity, p_note)` — two-row linked movement pattern, `transfer_group_id` ties them, `counterpart_status` records the other leg.
- `adjust_incoming_qty(p_variant_id, p_store_id, p_quantity_change, p_note)` — single-row, `incoming` bucket only.
- `adjust_stock()` extended: upserts `available_qty` alongside `in_stock` (same delta), movement insert now carries `status='available'` + `quantity_before`.
- `confirm_order()` extended: decrements `available_qty` alongside `in_stock`, movement insert carries `status='available'` + `quantity_before`. **Behavior change (intentional, not in the original doc text):** the insufficient-stock check now reads `available_qty` instead of `in_stock` — once stock can be moved to Reserved/On Hold/In Production via `transfer_stock_status`, those buckets should not be treated as sellable by order confirmation. `in_stock` and `available_qty` start identical and only diverge once a transfer moves stock out of Available, so this only changes behavior once Phase 1 status actions are actually used.

**Follow-up fix (`0027_tighten_transfer_stock_status`):** the first version of `transfer_stock_status` validated `p_from_status`/`p_to_status` against all 5 statuses including `incoming`. Tightened to reject `incoming` as a transfer endpoint — the doc's intent is that Incoming only changes via `adjust_incoming_qty` (it has no counterpart bucket to draw from). UI's Move Stock dialog only ever offers the 4 held-bucket statuses.

**Verification (direct Postgres, JWT claim set to the Claude admin test account):**
- `adjust_stock(+10)` → `quantity_before=0, quantity_after=10, status='available'`. ✅
- `transfer_stock_status(available→reserved, 4)` → two linked rows (`transfer_group_id` shared, `counterpart_status` correct), `available_qty=6, reserved_qty=4`. ✅
- `adjust_incoming_qty(+5)` → `incoming_qty=5`, single `status_adjustment` row. ✅
- Error guard: `transfer_stock_status(on_hold→available, 1)` on a row with 0 on_hold correctly raised `Insufficient on_hold quantity`. ✅
- All test movements deleted and the level row reset to its pre-test state afterward.
- `get_advisors` (security): the two new RPCs appear in the same pre-existing SECURITY DEFINER-callable-by-anon/authenticated warning bucket as every other RPC in this project — no new class of finding.

---

## INV-2 — Regenerate TypeScript types ✅ DONE

**Status:** Complete 2026-07-05.

**Gap found:** `lib/supabase/types.ts` was a placeholder stub (`export type Database = Record<string, never>`) — this project had **never** actually wired up generated Supabase types, despite the file existing with wiring instructions. Neither `lib/supabase/client.ts` nor `lib/supabase/server.ts` pass the `Database` generic to `createBrowserClient`/`createServerClient`.

**What was done:** ran `generate_typescript_types` and replaced the stub with the real generated file (2734 lines, confirmed it includes `available_qty`, `transfer_stock_status`, `adjust_incoming_qty`, etc.). **Not done (explicitly out of scope for this phase):** retrofitting `<Database>` generics into `client.ts`/`server.ts` and the ~23 files that call `createClient()` — that's a separate, cross-cutting engineering task, not part of Inventory Status Phase 1. The new `lib/inventory/calculations.ts` (INV-3) does import `Database` directly from the types file for its own row typing, so this phase's own code is typed correctly even though the app-wide client wiring gap remains.

**Follow-up worth doing separately:** wire `Database` into the two client factories and re-run `tsc` to see how much latent type coverage that surfaces app-wide.

---

## INV-3 — Shared calculation helper + unit tests ✅ DONE

**Status:** Complete 2026-07-05.

**Gap found:** this project has **no test runner at all** (`package.json` had no test script, no vitest/jest config, no `*.test.ts` files outside `node_modules`). Added `vitest` as a devDependency (minimal footprint, standard for a Next.js project) and a `"test": "vitest run"` script — this is the first test infrastructure in the repo.

**What was built:**
- `lib/inventory/calculations.ts` — pure functions, typed against the generated `Database` row type: `getOnHand`, `getAvailableToSell`, `getProjectedStock`.
- `lib/inventory/calculations.test.ts` — 6 tests, including the On Hand invariant under a `status_transfer` (both a simple Available→Reserved case and a general pairwise-transfer case), plus a control test confirming On Hand *does* change when incoming becomes available (out of scope for Phase 1, no such action exists yet, but documents the boundary).

**Verification:** `npx vitest run` → 6/6 passing.

---

## INV-4 — Inventory Monitoring table + Summary card ✅ DONE (adapted scope)

**Status:** Complete 2026-07-05. **Scope adapted from the doc — Sinag's call required and given.**

**Mismatch found:** the kickoff doc assumed an existing "Inventory Monitoring table" and a per-variant "detail page" with a Summary card above movement history. Neither exists in this app. The real pages are `app/dashboard/inventory/page.tsx` (a plain "Stock dashboard" — raw HTML table in a server component, one row per `(variant, store)`, single "In stock" column) and `app/dashboard/inventory/stock-movement/page.tsx` (movement history list). There is no per-variant detail page.

**Sinag decided:** adapt into the existing pages rather than build a new variant detail page. No separate Summary card was built.

**What was built:**
- `app/dashboard/inventory/page.tsx` rewritten (server component, following the established `page.tsx` + `*-table.tsx` client-wrapper split — the old version was a raw inline table, which also violated the project's DataTable-column-boundary convention). Fetches from `items` (not `inventory_levels` directly) filtered to `track_stock=true`, non-deleted, joining variants/inventory_levels/stores/categories — same query shape as `adjustment/page.tsx`.
- `app/dashboard/inventory/inventory-monitoring-table.tsx` (new, client) — columns: Item/SKU, Category, Store, Available, Reserved, In Production, On Hold, Incoming, On Hand, Projected, actions. On Hand/Projected computed server-side via the INV-3 helper and passed as plain row fields (`DataTable`'s `Column.key` must be a real, unique row property — this ruled out reusing `"id"` as the key for multiple computed columns, an early mistake caught and fixed before shipping).
- Badge colors: only `default`/`success`/`warning`/`danger`/`neutral` variants existed (no purple/yellow token in the design system). Added one new `info` (blue) token pair to `app/globals.css` and a matching `Badge` variant, then mapped Available=success(green), Reserved=info(blue), In Production=default(gold), On Hold=warning(orange), Incoming=neutral(gray) — closest reasonable fit without inventing arbitrary new tokens for a one-off ask.
- Scoped to `track_stock=true` items only, per the doc and matching the existing `low_stock_threshold` precedent.

**Verification:** browser preview as the Claude admin test account — table renders all badge colors correctly, columns match spec.

---

## INV-5 — Movement history UI update ✅ DONE

**Status:** Complete 2026-07-05.

**What was built:** `stock-movement/page.tsx` and `movements-table.tsx` extended to select/render `status`, `quantity_before`, `counterpart_status`. New "Status" column shows a badge plus, for transfers, a direction hint derived from `quantity_change` sign — e.g. "Reserved (from Available)" / "Available (to Reserved)", matching the doc's example format. "Before → After" column replaces the old separate "Resulting Stock" column.

**Verification:** browser preview — confirmed against a real transfer + incoming adjustment (see INV-6), rendered exactly as intended: `Available (to Reserved) | -4 | 10 → 6` and `Reserved (from Available) | +4 | 0 → 4`.

---

## INV-6 — Move Stock / Adjust Incoming UI actions ✅ DONE

**Status:** Complete 2026-07-05.

**What was built:**
- `app/dashboard/inventory/actions.ts` — `transferStockStatus()` / `adjustIncomingQty()` server actions calling the two new RPCs, following the `adjustment/actions.ts` convention (thin wrapper, `revalidatePath` on both `/dashboard/inventory` and `/dashboard/inventory/stock-movement`).
- `app/dashboard/inventory/stock-status-dialogs.tsx` — `MoveStockDialog` (From/To selects restricted to the 4 held-bucket statuses, quantity, note) and `AdjustIncomingDialog` (signed quantity change, note), both following the existing `Dialog`/`supplier-form.tsx` pattern.
- Row actions wired into `inventory-monitoring-table.tsx`, gated to `admin`/`manager`/`encoder` (matching the RPCs' own role check).

**Live end-to-end verification (browser preview, Claude admin test account, real variant `SUIV-0001`):**
1. Added +10 via the existing Item Adjustment screen → Available=10 confirmed on the Monitoring table.
2. Move Stock (Available→Reserved, qty 4) → Available=6, Reserved=4, **On Hand stayed 10** (invariant confirmed live, not just in unit tests).
3. Adjust Incoming (+5) → Incoming=5, Projected=11.
4. Stock Movement page confirmed all 3 movements with correct status/before→after/counterpart direction.
5. Reversed all three actions and restored the row to its exact pre-test state (0 across every bucket). Confirmed via direct Postgres.

**Gotchas hit during this verification (worth remembering for future sessions):**
- Hit the known `feedback_preview_submit_button_targeting` pitfall again: a generic `button[type="submit"]` selector on the Item Adjustment page matched the `AppShell` header's Sign Out button first, logging the test session out. Fixed by scoping to the form's own submit button by text/`main` ancestor.
- Fast Refresh (HMR) rebuilding client components *while* automated clicks were in flight caused a stale/duplicate dialog submission, which briefly surfaced as an `incoming_qty >= 0` check-constraint error in the browser (the constraint did its job — no bad data was written, the failing transaction rolled back cleanly). Resolved by finishing the cleanup via direct RPC/SQL calls instead of continued fragile UI automation.

---

## INV-7 — `adjust_order_items()` hardcoded 'reserved' bucket ✅ DONE (2026-07-08)

**Found during a full inventory audit 2026-07-08** ([`docs/archive/Inventory-Reservation-Lifecycle-Fixes-Kickoff.md`](docs/archive/Inventory-Reservation-Lifecycle-Fixes-Kickoff.md), archived 2026-07-09 — both gaps it raised (INV-7, INV-8) are done): the release/re-reserve loops in `adjust_order_items()` hardcoded `'reserved'` as the bucket regardless of order status. Correct only while `status='confirmed'` — once `start_production()` moves an order's committed stock to `'in_production'`, editing line items either raised a spurious "insufficient reserved" error or silently re-reserved into the wrong bucket, permanently desyncing `reserved_qty`/`in_production_qty` from what the order's status implied. Root cause of the drift manually cleaned up on `SOD26-0706-0005` earlier the same session.

**Scope deviated from the kickoff doc — Sinag's call required and given.** The doc proposed two options and Sinag initially picked Option B (compute a live proportional split between `'reserved'`/`'in_production'` per component before releasing, for orders mid-way through partial production/shipment). Re-verifying against live `pg_get_functiondef` output (mandatory per the doc's own preflight) before writing any code disproved the premise: `partially_completed` means "some of this order's `production_orders` are done, others aren't" — not "partially shipped." `create_shipment()` requires `ready_for_shipping`/`shipped`, unreachable from `partially_completed`, so no shipment can exist yet to have consumed part of the bucket. `start_production()` moves an order's entire `reserved_qty` to `'in_production'` atomically in one call, and `complete_production_order()` never moves stock back out of `'in_production'` — only production-order/`completed_qty` bookkeeping. So at every status this function can reach with stock-editing enabled, the order's entire committed quantity per component sits in exactly one bucket, never split. Found this and flagged it back to Sinag rather than building the (unreachable) split logic; **Sinag agreed to the simpler fix.**

**What was built:** `adjust_order_items()` (migration `inv7_adjust_order_items_status_aware_bucket`) — one `v_bucket` local, set to `'reserved'` when `status='confirmed'`, else `'in_production'`; both the release loop and the reserve loop now use `v_bucket` instead of the hardcoded literal. `production_completed` keeps its existing metadata-only short-circuit unchanged (confirmed separately, see INV-8 note below, that this status is currently unreachable via the live status machine — kept anyway since the CHECK constraint still allows it and the guard is cheap). No freeze added for `partially_completed` — proven safe to edit normally.

**Verified live (Supabase MCP, admin test account, order `SOD26-0708-0021`, 2 line items):**
1. Created confirmed → edited quantities → reservation stayed in `'reserved'` (no regression).
2. `start_production()` → edited quantities → release/re-reserve correctly used `'in_production'` (previously would have raised or corrupted state).
3. Completed 1 of 2 production orders (→ `partially_completed`) → edited quantities again → succeeded normally, still `'in_production'` bucket, order stayed `partially_completed`.
4. Appendix audit query returned zero rows after all three edits.

**Related, out-of-scope finding (not fixed, flagged for a future session):** `adjust_order_items()`'s delete-and-reinsert of `order_items` clears `production_order_id` on every edit (new rows never set it), desyncing already-created `production_orders` from the post-edit line items — `complete_production_order()`'s `order_items.completed_qty` backfill silently becomes a no-op after any post-`start_production()` edit. Pre-existing behavior, not introduced or touched by this fix (same delete/reinsert shape existed before); only the *bucket* changed here.

---

## INV-8 — Shipments could leave committed stock permanently stranded ✅ DONE (2026-07-08)

**Found during the same 2026-07-08 audit**: nothing verified that a shipment (or set of shipments) actually covered an order's full committed quantity (`order_items.reserved_qty`) before the order reached a terminal `delivered` state. Root cause of historical drift on `SOD26-0701-0001`, `SOD26-0701-0002`, `SOD26-0706-0004`, `SOD26-0706-0006`, and part of `SOD26-0707-0009` (manually cleaned up earlier the same session).

**Scope deviated from the kickoff doc — Sinag's call required and given.** The doc assumed `_deduct_shipment_stock()` fires from `create_shipment()` and recommended adding the check to `mark_delivered()`/`mark_shipment_delivered()`. Re-verified against live code: `_deduct_shipment_stock()` actually fires from `mark_shipment_shipped()`/`mark_shipment_picked_up()` (deduction happens at ship/pickup time, not creation time). More importantly, migration `ps17b_fix_shipping_rollup_and_drop_orphan_overloads` — applied earlier the *same day*, ahead of this fix — had already hardened `recompute_shipping_status()` (the function `mark_shipment_delivered()` actually calls, and the only live path that promotes an order to `delivered`) to require full quantity coverage first. That closed most of this gap already. The one confirmed residual hole: `mark_delivered(p_order_id)`, a pre-PS-6 whole-order RPC intentionally left in the database per this project's additive-migrations convention (UI caller removed in PS-8, RPC itself untouched — see `DECISIONS.md` D036/PS-6/PS-8 entries) but still `EXECUTE`-granted to `authenticated` with **zero** coverage check, bypassing the `ps17b` fix entirely if called directly. `mark_picked_up(p_order_id)` has the same shape but its precondition status (`production_completed`) is now permanently unreachable since `ps17` retired the auto-transition into it, so it's already inert — left untouched. Sinag confirmed patching only `mark_delivered()`.

**What was built:** `mark_delivered()` (migration `inv8_mark_delivered_coverage_check`) — before flipping the order/shipments to `delivered`, sums `shipment_items.quantity_shipped` per `order_item` and compares to `reserved_qty`; raises `Cannot mark order % delivered: committed quantity not fully covered by shipments — <item> (short <qty>), ...` naming every short line if any remain. Purely additive, no behavior removed.

**Verified live (Supabase MCP, admin test account, same order `SOD26-0708-0021`):**
1. Order reached `ready_for_shipping` (via INV-7's test sequence) → shipped 5 of 7 Hairbrush Large + all 3 Hairbrush Medium in one shipment → `mark_shipment_shipped()` → order correctly stayed `shipped` (not `delivered`).
2. Called `mark_delivered()` directly → **blocked**: `Cannot mark order ... delivered: committed quantity not fully covered by shipments — Itm-Hairbrush Large (short 2)`.
3. Shipped the remaining 2 units in a second shipment → `mark_shipment_shipped()` → called `mark_delivered()` again → succeeded, order → `delivered`.
4. Appendix audit query returned zero rows after the full sequence.

---

## INV-9 — `adjust_order_items()` orphaned `production_order_id` on every post-start edit ✅ DONE (2026-07-08)

**This is the "related, out-of-scope finding" flagged at the bottom of INV-7**: `adjust_order_items()`'s delete-and-reinsert of `order_items` never set `production_order_id` on the new rows, since order_items has no other identity to survive the delete by. Any edit made to an order's lines after `start_production()` silently orphaned that order's `production_orders` from its (now-unlinked) `order_items` — `complete_production_order()`'s `update order_items set completed_qty = quantity where production_order_id = p_production_order_id` then matched zero rows for that order going forward, so `order_items.completed_qty` stopped updating with no error raised. Pre-existing behavior, not introduced by INV-7 (INV-7 only fixed the bucket, not this).

**Confirmed the fix scope with Sinag before building** (this touches order-editing behavior mid-production): a mechanical relink alone wasn't enough. `production_orders.quantity` is a frozen snapshot taken once at `start_production()` time (D033) — it never reactively updates, so even with `production_order_id` reattached, an edited line's quantity would drift from what the shop floor sees. Worse, `order_items.completed_qty` only ever syncs from the production side on *full* completion (`complete_production_order`) — `add_production_completed_qty`'s partial progress never touches it — so nothing already in this function catches an edit that shrinks a line below quantity already logged as done on a `wip`/`partially_completed` Production Order. Sinag picked the full-reconcile option over a cheaper relink-only fix or freezing line edits entirely.

**What was built:** `adjust_order_items()` (migration `inv9_adjust_order_items_relink_production_orders`), new block gated to `status in ('in_production', 'partially_completed')`, running after the existing delete+reinsert:
- Groups the freshly-inserted `order_items` and the order's active (`not_started`/`wip`/`partially_completed`) `production_orders` by `(variant_id, sorted modifier_option_ids)` — the same key `start_production()` groups by.
- **Guard, raises and rolls back the whole edit** if any active Production Order's new line total would drop below its `completed_qty`, or would hit zero (which would strand a stale-quantity row with no lines and no stock actually reserved against it — that stock already went back to `available` via the existing per-component release/reserve diff, independent of Production Order grouping). Covers both the "shrink below partial completion" gap above (previously uncaught) and the pre-existing "remove a completed line" rule's blind spot for partially-completed lines.
- Relinks matched lines, then **resyncs each active Production Order's `quantity`** to the new sum of its linked lines (logs `production_order_quantity_adjusted` to `activity_logs` when it actually changes) — `quantity` is now a live rollup, not a frozen snapshot.
- Any line left with no active Production Order match (a genuinely new variant+modifier combo added post-`start_production`, or one whose only prior Production Order already completed/cancelled) gets a **new** Production Order auto-created for it, mirroring `start_production()`'s own grouping/insert — otherwise it would stay reserved but permanently invisible to the production floor, since `start_production()` can't be re-run once the order leaves `confirmed`. **Gated admin-only**, matching `start_production()`'s existing role restriction (D033) — `adjust_order_items()` itself stays open to admin/manager/encoder, but only an admin's edit can conjure a new Production Order into existence.

**Verified live (Supabase MCP, admin + encoder test accounts, fresh order `SOD26-0708-0022`):**
1. Created (Hairbrush Large ×10, Hairbrush Medium ×5) → `start_production()` → 2 Production Orders, both linked. `start_production_order()` + `add_production_completed_qty(+4)` on the Hairbrush Large PO → `partially_completed`, `completed_qty=4`.
2. Edited the order (Hairbrush Large 10→15, Medium unchanged, **added** a brand-new Paper A4 Sticker line) as admin → Hairbrush Large PO relinked with `quantity` resynced 10→15 (`completed_qty` untouched at 4, `activity_logs` row confirmed), Medium PO relinked unchanged, **new** Production Order auto-created for the Sticker line (`activity_logs` row confirmed) — all 3 `order_items` correctly pointed at their PO via direct query.
3. Tried reducing Hairbrush Large to 3 (below its `completed_qty=4`) → blocked: `Cannot reduce Production Order SPR26-0708-0025 below its completed quantity (4) -- cancel it first...`. Confirmed no mutation occurred (quantity/completed_qty unchanged after the error).
4. Tried removing the Sticker line entirely (its PO was `not_started`, `completed_qty=0`) → blocked: `This edit removes every line belonging to Production Order SPR26-0708-0027 -- cancel that Production Order first...`.
5. Same new-Sticker-line edit attempted as the **encoder** test account → blocked: `This edit adds a new item/modifier combination with no existing Production Order -- an admin must make this change...` (encoder-role edits to already-linked lines still work fine; only new-PO creation is admin-gated).
6. **The original bug, directly disproven:** called `complete_production_order()` on the (post-edit, resynced-to-15) Hairbrush Large PO → `production_orders.completed_qty` → 15. Queried the linked `order_items` row directly: `completed_qty = 15 = quantity`, `production_order_id` still pointing at the right PO — the backfill that silently no-op'd before this fix now correctly matches and updates the row.
7. Cleanup: cancelled the two never-completed test Production Orders (auto-releases their reserved stock), manually released the completed one's 15 units `in_production → available` via `transfer_stock_status()` (completion never moves stock in this system, so it would otherwise sit parked forever on unshippable test data). Confirmed via direct Postgres: all 4 variants touched by this test matched their pre-test `inventory_levels` row exactly (available/reserved/in_production/on_hold/incoming) after cleanup. The test order/Production Orders themselves were left in place as historical test data, consistent with this project's current all-test-data status (2026-07-06 onward).

---

## INV-10 — Move Inventory Monitoring to `/dashboard/inventory/status` ✅ DONE (2026-07-08)

**Status:** Complete 2026-07-08.

**Found while scoping this phase:** the sidebar nav (`app-shell.tsx`) already pointed **"Inventory Status" → `/dashboard/inventory/status`**, which was a `"Coming soon"` stub — the real Inventory Monitoring table (built in INV-4) lived at `/dashboard/inventory` (root), a route nothing in the nav actually linked to. Orphaned since INV-4; not caught until this phase.

**What was built:** moved `page.tsx` + `inventory-monitoring-table.tsx` from `app/dashboard/inventory/` into `app/dashboard/inventory/status/`, replacing the stub. Root `app/dashboard/inventory/page.tsx` is now a `redirect("/dashboard/inventory/status")` (kept alive rather than deleted, per Sinag's call, in case of old bookmarks/links).

**Verified live:** browser preview — visiting `/dashboard/inventory` redirects to `/status`; the real table renders there.

---

## INV-11 — Removed manual Move Stock / Adjust Incoming actions ✅ DONE (2026-07-08)

**Status:** Complete 2026-07-08.

**Scope confirmed before building:** the ask marked both action buttons (not just Adjust Incoming) for removal. Checked whether removing "Move Stock" (generic `transfer_stock_status` between the 4 held buckets) would strand any bucket with no other path to reach it — it wouldn't: Reserved is order-driven, In Production is `start_production`/`complete_production_order`-driven, On Hold already has its own dedicated release flow (Items for Review → `release-form.tsx`, calls `transfer_stock_status` directly) and is populated by `hold_order`/`cancel_production_order`, and Available/Incoming become PO-driven per INV-12. No manual escape hatch was load-bearing.

**What was built:** removed the actions column, `MoveStockDialog`/`AdjustIncomingDialog` usage, and `canAdjust` prop from `inventory-monitoring-table.tsx` (now at `status/`). Deleted the now-dead `app/dashboard/inventory/actions.ts` (`transferStockStatus`/`adjustIncomingQty` wrappers) and `stock-status-dialogs.tsx`. Per this project's additive-migrations convention (D036/PS-6/PS-8 precedent), the underlying `transfer_stock_status()`/`adjust_incoming_qty()` RPCs were left in the database untouched — only the UI callers were removed.

**Verified live:** browser preview + direct DOM inspection — the Status table renders exactly the 10 spec'd columns with no trailing actions column.

---

## INV-12 — Incoming linked to Purchase Order lifecycle (Sent → Incoming, Received → Available) ✅ DONE (2026-07-08)

**Status:** Complete 2026-07-08.

**Bug found during scoping (fixed as part of this phase, not optional):** `incoming_qty` had zero connection to Purchase Orders before this — it was only ever written by the manual `adjust_incoming_qty` RPC removed in INV-11. Worse, tracing the actual receive path (`receive_purchase_order()` → inserts `incoming_items` → trigger `apply_incoming_item_inventory_movement()`) showed the trigger only incremented the legacy `in_stock` column — **never `available_qty`**. Since INV-1 made `available_qty` the sellable gate (order confirmation reads it, not `in_stock`), receiving a PO never actually made stock available for sale. Fixing this was required to make "received → available" mean anything.

**Scope decision — Sinag's call required and given:** two designs were possible for the Incoming number: (a) live-compute it at read time as `SUM(quantity_ordered - quantity_received)` across `purchase_order_items` joined to `purchase_orders` where `status IN ('sent','partial')`, or (b) keep `inventory_levels.incoming_qty` as a stored column kept in sync via triggers on PO/line mutations. **Sinag picked (a)** — consistent with the "live rollup, not frozen snapshot" fix already made in INV-9, and avoiding another stored/derived-state drift class after INV-7/8/9 all turned out to be exactly that failure mode. Consequence: `inventory_levels.incoming_qty` (the stored column) is no longer read or written by the app anywhere — left in the schema untouched (additive-only convention), just inert going forward.

**What was built:**
- Migration `inv10_receive_po_bumps_available_qty`: `apply_incoming_item_inventory_movement()` now upserts `available_qty` alongside `in_stock` (same delta), mirroring `adjust_stock()`'s existing pattern. `quantity_before`/`quantity_after` on the movement row still track `in_stock` (unchanged), consistent with how `adjust_stock()` already does this even though both columns move together.
- `app/dashboard/inventory/status/page.tsx`: added a second query aggregating outstanding PO quantity per `variant_id` (`purchase_orders!inner(status)` filtered to `sent`/`partial`), merged into each row's `incoming_qty` in place of the old `inventory_levels.incoming_qty` read.

**Known limitation, not introduced by this change:** `purchase_orders.store_id` exists but is never set by `createPurchaseOrderWithItems` (always `NULL`), and the receiving trigger has always resolved store as "first active store" rather than the PO's own store. Incoming is attributed to a variant's existing `inventory_levels` row regardless of store, matching this pre-existing convention. Harmless today (exactly one store, `CPR-B13L82`, exists) but will need real wiring if a second store is ever added.

**Verified live (real test-data PO, not synthetic):** `SPO-2026-07070001` (status `sent`, 25× `SUIV-0001` + 15× `SUIV-0003` ordered, 0 received) — Status page correctly showed Incoming=25 for `SUIV-0001` before touching anything, confirming the live query. Received 10 of the 25 `SUIV-0001` units through the real Receiving UI (`/dashboard/inventory/receiving/SPO-2026-07070001`):
- PO status → `partial` (10/25 + 0/15 received), Receiving Log shows `SRI26-0708-0014`.
- Status page: Available 209→219, Incoming 25→15, On Hand 209→219, **Projected stayed flat at 234** — confirms stock moved from Incoming to Available rather than being double-counted.
- Direct Postgres: `in_stock=219`, `available_qty=219` (both moved together), `inventory_movements` row `movement_type='incoming', status='available', quantity_before=209, quantity_after=219`.
- Left as real partial-receipt data rather than reversed — per `project_test_data_status` this is test data, and this was a real domain action (a genuine partial PO receipt) through the normal app pathway, not a synthetic RPC probe like INV-1/INV-6's tests.

---

## INV-13 — Analytics/Inventory Report and Dashboard KPIs still read legacy `in_stock` ✅ DONE (2026-07-08)

**Found while investigating a "Analytics/Inventory Report's In Stock doesn't match Inventory Status" report from Sinag.** Root cause: `in_stock` and the decomposed model (`available_qty`/`reserved_qty`/`in_production_qty`/`on_hold_qty`) are two independent representations of stock on `inventory_levels`. `transfer_stock_status()` — the RPC every order-confirm/production/hold flow uses (`create_order`, `adjust_order_items`, `convert_quote_to_order`, `override_reserved_qty`, `cancel_production_order`) — only ever moves the four bucket columns and never touches `in_stock`, by design (INV-1). `in_stock` is only kept in step by three RPCs (`adjust_stock`, the PO-receive trigger, `deduct_stock_out`). That holds in the common case, but any direct correction to the bucket columns (several happened this same week during INV-6/7/8/9 live-verification test cleanup, done via direct Postgres) silently breaks the "these two totals agree" assumption — no constraint or log catches it.

**Verified live before fixing:** compared `in_stock` to computed on-hand (`available_qty+reserved_qty+in_production_qty+on_hold_qty`) across all 32 tracked `inventory_levels` rows — 5 already diverged: `SUIV-0013` (350 vs 50, +300), `SUIV-0012` (276 vs 96, +180), `SUIV-0004` (222 vs 215, +7), `SUIV-0018` (272.9 vs 292.9, −20), `SUIV-0019` (288.9 vs 308.9, −20). All five sit on production/adjustment paths exercised by this week's INV-7/8/9 test orders. `/dashboard/inventory/status` (the correct, decomposed-model page) and `/dashboard/analytics/inventory-report` (still reading raw `in_stock`) were each querying their own column correctly — the two pages just no longer have any invariant tying them together.

**Scope confirmed with Sinag before building:** fix both Analytics/Inventory Report and the Dashboard's Inventory Value/Low Stock KPIs together in one pass (the Report page's own footer text claims it matches the Dashboard KPI — fixing one alone would've just moved the mismatch from Report-vs-Status to Report-vs-Dashboard). Sinag also picked `available_qty` (not on-hand) as the basis for low-stock/out-of-stock comparisons — reserved/in-production stock is already committed and can't cover a new sale, so it shouldn't count toward "do we need to reorder."

**What was built (no migration — read-side only, no RPC/schema change):**
- [`app/dashboard/analytics/inventory-report/page.tsx`](app/dashboard/analytics/inventory-report/page.tsx): stock query now selects `available_qty, reserved_qty, in_production_qty, on_hold_qty` instead of `in_stock`. Displayed "In Stock" / Stock Value / Inventory Value now come from `getOnHand()` ([`lib/inventory/calculations.ts`](lib/inventory/calculations.ts), the same helper Inventory Status already uses — guarantees the two pages can't diverge again). Low Stock / Out of Stock badges now compare `available_qty` against `low_stock_threshold` instead of on-hand.
- [`app/dashboard/page.tsx`](app/dashboard/page.tsx): Inventory Value KPI now sums `getOnHand()` × cost instead of raw `in_stock` × cost. Low Stock Items card now filters/sorts/displays `available_qty` instead of `in_stock`.
- `in_stock` itself was **not** touched or backfilled — per this project's additive-only convention and INV-1's original decision to leave it as "a visible data-quality flag." If it should be reconciled or dropped from the schema, that needs its own explicit decision, not a side effect of a read-side fix.

**Verification:** `npx tsc --noEmit` clean; confirmed no remaining `in_stock` references in either changed file. **Live browser verification (Claude admin test account, after freeing the dev server port from a stale process):**
- Dashboard Inventory Value = ₱229,565, matching a direct SQL sum of `getOnHand() × cost` (₱229,564.64) across all 32 tracked rows.
- Inventory Report Stock Value = ₱229,564.641, Tracked SKUs = 32, no console errors.
- All 5 previously-diverged SKUs now show the correct on-hand figure on the Report: `SUIV-0013`→50, `SUIV-0012`→96, `SUIV-0004`→215, `SUIV-0018`→292.903, `SUIV-0019`→308.903 (matches the mismatch table above exactly).
- Cross-checked `SUIV-0013` directly against `/dashboard/inventory/status`: On Hand = 50, matching the Report's In Stock = 50 — the two pages now agree.

---

## INV-14 — Status/Threshold columns + summary counts on Inventory Status ✅ DONE (2026-07-08)

**Status:** Complete 2026-07-08.

**What was built:**
- [`lib/inventory/calculations.ts`](lib/inventory/calculations.ts): added `getStockStatus()` (+ `StockStatus` type) as a single source of truth for the "ok"/"low"/"out" classification (`available_qty <= 0` → out; else `available_qty <= low_stock_threshold` → low; else ok) — the exact rule Sinag picked in INV-13 for the Analytics/Inventory Report page, reused here rather than re-derived. That rule was previously duplicated inline in `inventory-report/page.tsx` and `dashboard/page.tsx`; those two call sites were left untouched (out of scope for this ask), but any new caller should use this helper going forward. 3 new unit tests added to `calculations.test.ts`.
- [`app/dashboard/inventory/status/page.tsx`](app/dashboard/inventory/status/page.tsx): added `low_stock_threshold` to the `inventory_levels` select, computed `threshold`/`status` per row via the new helper, and tallied 6 summary counts — Low Stock, Out of Stock, On Hold, In Production, Incoming, Reserved. Each is a **count of rows** matching the condition, not a sum of quantities, per Sinag's explicit ask. Rendered as a `StatCard` grid above the table, same component/pattern already used on the Report page.
- [`app/dashboard/inventory/status/inventory-monitoring-table.tsx`](app/dashboard/inventory/status/inventory-monitoring-table.tsx): added **Threshold** and **Status** columns (appended after Projected). Badge styling copied from the existing `STATUS_BADGE` convention in `inventory-report-table.tsx` (OK=success, Low Stock=warning, Out of Stock=danger) for visual consistency across the two pages.

**Verification:** `npx vitest run` → 9/9 passing (6 pre-existing + 3 new). `npx tsc --noEmit` clean.

**Live browser verification (2026-07-08, Claude admin test account), completed after two blockers:**
1. The other chat session's dev server (holding this workspace's port 3000) was stopped at Sinag's request so this session could attach. Sinag confirmed they weren't using it.
2. `/dashboard/inventory/status` (and the rest of `/dashboard/inventory/*`) then 404'd even on a fresh server — root cause: the `.next` Turbopack build cache is shared across dev-server processes in this workspace, and force-killing the other session's `node` process (`Stop-Process -Force`) mid-write left it corrupted specifically for the `inventory` route subtree (sibling routes like `/dashboard/orders` were unaffected). Fixed by deleting `.next` (a regenerable build artifact, no source/data risk) and restarting; the full `inventory/*` subtree resolved normally afterward.

With a clean server: confirmed logged in as the Claude admin account, navigated to `/dashboard/inventory/status`, and via direct DOM query confirmed the table header row is exactly `Item, Category, Store, Available, Reserved, In Production, On Hold, Incoming, On Hand, Projected, Threshold, Status`. Sample rows rendered `Threshold: "—"` and `Status: "OK"` correctly (no rows in current data have a `low_stock_threshold` set). Summary cards rendered **Low Stock: 0, Out of Stock: 0, On Hold: 3, In Production: 9, Incoming: 2, Reserved: 0** — the non-zero counts are real, live counts from actual data, confirming the per-bucket counting logic works end-to-end.

**Not visually verified: the "Low Stock" (warning) and "Out of Stock" (danger) badge colors.** No row in the current dataset has a `low_stock_threshold` set or `available_qty <= 0`, so neither branch is reachable with real data today. A first attempt to manufacture one of each by directly `UPDATE`-ing `inventory_levels` (a threshold on one row, zeroing `available_qty` on another) was correctly blocked by the session's auto-mode permission classifier as an unauthorized write outside what was asked; both statements were reverted immediately (confirmed via a follow-up `SELECT`, values back to their originals: `SUIV-0001` threshold→null, `SUIV-0002` available_qty→162). Confidence in the low/out branches instead rests on: (a) `getStockStatus()`'s 3 unit tests explicitly covering out/low/ok, all passing, and (b) the identical status rule and `STATUS_BADGE` component already shipped and live on the Analytics/Inventory Report page (INV-13). **Still open:** a real live check of the Low Stock/Out of Stock badges and non-zero summary counts, ideally by setting a genuine threshold through the app's own Item edit UI rather than raw SQL, or once real data naturally produces one of these states.

---

## INV-15 — Items for Review page rework ✅ DONE (2026-07-09)

**Requested by Sinag (2026-07-09)**, via an annotated screenshot of the live `/dashboard/inventory/items-for-review` page. Four asks, all built in one pass: remove the In Production/Actions columns; make Release a row-click action instead of a persistent column; replace the "In Production" release destination with "Scrap"; group on-hold rows by the cancelled order/production order that produced them. Sinag explicitly picked option (a) (cheap, display-only note-parsing) over (b) (real per-source parcel tracking) for the grouping ask — see the tradeoff writeup this replaces, kept in git history.

**What was built:**
- Migration `inv15_deduct_stock_out_explicit_from_status`: `deduct_stock_out()` gained an optional trailing `p_from_status` param (default `null` → unchanged inferred available/in_production behavior). Done as `DROP FUNCTION` + `CREATE` rather than `CREATE OR REPLACE`, since adding a parameter changes the argument-type signature and `OR REPLACE` would have silently created a second overload instead of replacing the original — the exact bug class this project already hit once (`ps17b_fix_shipping_rollup_and_drop_orphan_overloads`). Re-granted `EXECUTE` to `PUBLIC`/`anon`/`authenticated`/`service_role` after the drop+create. Confirmed live afterward: exactly one `deduct_stock_out` overload exists, `_deduct_shipment_stock()`'s existing 4-positional-arg calls still resolve to it unambiguously.
- `app/dashboard/inventory/items-for-review/actions.ts`: `releaseOnHoldStock()` now accepts `available`/`scrap` (not `in_production`); `scrap` calls `deduct_stock_out(..., p_from_status: 'on_hold')`, `available` still calls `transfer_stock_status()` as before.
- `release-form.tsx`: `DESTINATIONS` is now `available`/`scrap`; dialog copy updated ("Move some or all of it back to Available, or scrap it out of stock entirely").
- `page.tsx`: dropped `in_production_qty` from the query entirely. Added a second query against `inventory_movements` (`status='on_hold'`, `movement_type='status_transfer'`, `quantity_change > 0`, newest first) for the on-hold variants on the page, then regex-matches an `SPR\d{2}-\d{4}-\d{4}` or `SOD\d{2}-\d{4}-\d{4}` reference out of each inflow's `note` to label it with the Production Order Detail or Order Detail it came from (no match → `"Unattributed"`).
- `items-for-review-table.tsx`: columns are Item/On Hold/Available/**Source**, back to one flat, searchable/sortable `DataTable` (Sinag reviewed the first cut — separate Card-per-group sections — and asked for a single clean table with the grouping as a column instead, see the amendment below). Clicking any row still opens `ReleaseForm` directly — no Actions column.
- `lib/supabase/types.ts` regenerated (`generate_typescript_types`) to pick up `deduct_stock_out`'s new `p_from_status` arg.

**Verified live (Supabase MCP + browser, Claude admin test account):**
- Direct RPC: `deduct_stock_out(variant, store, 1, note, p_from_status='on_hold')` on a real on-hold row (`SUIV-0002`, 10 on hold) correctly moved `on_hold_qty` 10→9 and `in_stock` 162→161, available/in_production untouched; reverted immediately after.
- Browser: signed in, navigated to Items for Review — table rendered with the `Item / On Hold / Available / Source` header (confirmed via DOM query — no In Production or Actions column), Source values linking to the right Production Order/Order Detail page. Clicked a row (`Itm-Men Comb, Straight`) — Release dialog opened directly from the row click, "Release To" offered exactly `Available`/`Scrap (remove from stock)`.
- Exercised both real destinations through the UI end-to-end: released 1 unit to Scrap (`Itm-Men Comb, Straight`) — confirmed a `stock_out` movement, `on_hold_qty` 3→2, `in_stock` 206→205; released 1 unit to Available (`Itm-Bottle Opener-Long 14cm`) — confirmed the linked `status_transfer` pair, `on_hold_qty` 5→4, `available_qty` 210→211. No console errors either time. Both test mutations reverted afterward (levels restored, test movement rows deleted) since this is otherwise-real seed/test data other sessions rely on.
- `npx tsc --noEmit` clean.

**Known limitation, by design (Sinag's explicit choice of option (a)):** attribution is a display label derived from on-hold-creating movements' free-text notes, not a real ledger — Release still draws from the flat per-variant `on_hold_qty` pool regardless of which row/source was clicked. Real per-source tracking (option (b): a proper `production_order_id`/`order_id` column plus parcel-level remaining-qty tracking) was scoped but not built — revisit only if this label-only attribution turns out to matter in practice.

### INV-15 amendment — flat table with a Source column instead of grouped sections (2026-07-09)

Sinag reviewed the first cut (one `Card` + `DataTable` per cancelled-order group) and asked for one clean flat table instead, with the grouping as its own column — explicitly accepting that the same SKU can now appear on more than one row if its On Hold balance came from more than one cancelled order.

**Also fixed a real correctness gap while making this change, not just a layout swap:** the first cut attributed a variant's *entire* current `on_hold_qty` to whichever inflow movement was most recent — accurate only when a single source ever fed that variant's pool. Naively summing *all* historical inflows per source (the obvious alternative for "list every source as its own row") would have been worse: it never subtracts anything a Release already sent back out, so the displayed total would drift upward past the real `on_hold_qty` over time as releases happened.

**What was built instead (`splitOnHoldBySource()` in `page.tsx`):** for each variant/store, walk its on-hold inflow movements **newest-first** and greedily attribute quantity to each inflow's source until the *live* `on_hold_qty` is fully accounted for (any older inflows beyond that point are assumed already released, and are dropped rather than counted). Any shortfall neither reachable by inflow history is attributed to `Unattributed`. This guarantees the split across a SKU's rows always sums exactly to its true current `on_hold_qty` — it still can't guarantee *which* physical units are whose once more than one source has fed the same pool, but it can no longer show more stock on hold than actually exists.

**What was built (files):**
- `page.tsx`: `groupFromNote()` kept as-is; added `splitOnHoldBySource(inflows, onHoldQty)` (the newest-first greedy fill above) and switched the row builder to `flatMap` — one `ReviewRow` per `(variant, store, source)` instead of one per `(variant, store)`.
- `items-for-review-table.tsx`: reverted to a single `DataTable` (no `Card`/grouping loop), added a **Source** column (linked to the Production Order/Order Detail page where resolvable, plain text for `Unattributed`) with `stopPropagation` on its link so clicking it doesn't also open the row's Release dialog.

**Verified live (browser, Claude admin test account):** reloaded Items for Review — `Itm-Paper A4 Sticker` (`SUIV-0019`) now correctly renders as **two** rows, `0.25` sourced from `Production Order SPR26-0709-0031` and `0.501` from `Production Order SPR26-0707-0006`, summing to its known `on_hold_qty = 0.751`. Every other (single-source) SKU still renders as exactly one row. Clicking a row still opens `ReleaseForm` correctly (`Itm-Hairbrush Small`, max 1, `Available`/`Scrap` offered). `npx tsc --noEmit` clean, no console errors.

---

## INV-16 — Inventory nav restructure: Monitoring rename + merged Movement History + row-click drilldown ✅ DONE (2026-07-09)

**Requested by Sinag (2026-07-09):** (1) reorder/relabel the Inventory subgroup nav to `Inventory Monitoring → Purchase Order(N) → Inventory Receiving(N) → Items for Review(N) → Item Adjustment`, where `(N)` is a live count of in-progress rows per section; (2) move Inventory Status to a new URL as "Inventory Monitoring", merge the Stock Movement table below it (max 500 rows, retitled "Inventory Movement History"), and make row-click on the Monitoring table open a window showing that SKU/store's most recent 50 movements.

**What was built:**
- New route `/dashboard/inventory/monitoring` (moved from `/dashboard/inventory/status`) — `app/dashboard/inventory/monitoring/{page.tsx, inventory-monitoring-table.tsx, movements-table.tsx, movement-utils.ts, actions.ts, item-movements-dialog.tsx}`. `page.tsx` fetches all three data sources in one `Promise.all` (inventory levels, outstanding PO qty, latest 500 `inventory_movements`) and renders StatCards → `InventoryMonitoringTable` → `MovementsTable` (retitled "Inventory Movement History") stacked on one page.
- `/dashboard/inventory/status`, `/dashboard/inventory/stock-movement`, and root `/dashboard/inventory` are now all thin `redirect("/dashboard/inventory/monitoring")` stubs (same keep-old-bookmarks-alive convention as INV-10); the old table files at `status/` and `stock-movement/` were deleted since their logic moved wholesale into `monitoring/`.
- Row click on the Inventory Monitoring table opens `ItemMovementsDialog`, which calls a new server action `getVariantMovements(variantId, storeId)` (`monitoring/actions.ts`) — `.eq`-filtered to that variant+store, `.limit(50)`, newest first. The movement-row mapping (`mapMovementRow`) and column definitions (`movementColumns()`) are shared between the full 500-row page table and the 50-row modal via `movement-utils.ts`, instead of duplicating the type/status badge maps a third time.
- Nav (`components/layout/app-shell.tsx`): Inventory subgroup reordered/relabeled to `Inventory Monitoring → Purchase Order → Inventory Receiving → Items for Review → Item Adjustment`; "Stock Movement" removed as its own nav entry (content now lives inside Monitoring). Added `NavLeaf.countKey` (`purchaseOrders` / `receiving` / `itemsForReview`) and a small pill badge in `NavItemRow`, rendered only when the count is > 0 and the sidebar isn't collapsed.
- `app/dashboard/layout.tsx`: added 3 `count: "exact", head: true` queries alongside the existing profile fetch, passed down to `AppShell` as `navCounts`:
  - **Purchase Order** = `purchase_orders` where `status in ('draft','sent','partial')` (anything not yet `received`/`closed`/`cancelled`).
  - **Inventory Receiving** = `purchase_orders` where `status in ('sent','partial')` — the same predicate the Receiving page's own "Open Purchase Orders" table already uses, so the badge matches what that page shows.
  - **Items for Review** = `inventory_levels` where `on_hold_qty > 0` — counts `(variant, store)` rows, **not** the post-source-split row count the table itself renders (INV-15's `splitOnHoldBySource` can fan one row into several). Using the cheaper pre-split count was a deliberate call to avoid duplicating that attribution logic into the layout just for a nav badge — noted here in case the two numbers are ever compared side by side and look inconsistent.
- Updated every `revalidatePath('/dashboard/inventory/stock-movement')` / `.../status` call across the app (adjustment, items-for-review, receiving, active-orders, quotation actions — 5 files) to `revalidatePath('/dashboard/inventory/monitoring')`, so mutations that used to invalidate the now-dead routes correctly invalidate the page that actually renders the merged data now.

**Verified live (Claude admin test account):**
- Nav renders exactly `Inventory Monitoring | Purchase Order(1) | Inventory Receiving(1) | Items for Review(4) | Item Adjustment`, confirmed via DOM query against the rendered link text. Cross-checked all three counts directly against Postgres (`purchase_orders`/`inventory_levels`) — exact match (1/1/4).
- `/dashboard/inventory/monitoring` renders both headings ("Inventory Monitoring", "Inventory Movement History") stacked on one page.
- Clicked a Monitoring row (`SUIV-0001`) → dialog opened scoped to that variant+store only (`SUIV-0001 — CPR-B13L82 · Most recent 50 movements`), footer read "Showing 1–10 of 47" (correctly capped under 50; `DataTable`'s own pagination handles the 10-per-page display).
- `/dashboard/inventory`, `/dashboard/inventory/status`, `/dashboard/inventory/stock-movement` all confirmed (`fetch(..., {redirect:"follow"})`) to resolve to `/dashboard/inventory/monitoring`.
- `npx tsc --noEmit` clean, `npx vitest run` 9/9 passing, no console/server errors during the session.

**Found, not fixed in this phase — flagged separately, fixed same day:** `components/ui/dialog.tsx`'s `DialogContent` renders off-center (`getComputedStyle(el).transform` is `"none"` instead of `translate(-50%,-50%)`) once its open/enter animation finishes — confirmed this is pre-existing and affects every dialog in the app (reproduced identically on the untouched `ReleaseForm` dialog on Items for Review), not something introduced by this phase. Likely the `tailwindcss-animate` `zoom-in-95`/`fade-in-0` keyframes overriding the static `-translate-x-1/2 -translate-y-1/2` utility's contribution to the composed `transform` once the animation's fill-mode holds. Out of scope for this nav/monitoring phase; spawned as a separate follow-up task — superseded for this specific row anyway by the amendment below. **Resolved 2026-07-09** in a dedicated follow-up session ("Fix Dialog off-center positioning bug"), landed as commit `ada1778` (installs `tw-animate-css`, verified centered through the full animation lifecycle) and cherry-picked onto `main` by the port session in `PROGRESS-MANAGEMENT.md` MGMT-6/`DECISIONS.md` D043.

### INV-16 amendment — row-click modal replaced with a dedicated detail page (2026-07-09)

Sinag looked at the shipped modal (screenshot) and asked whether a dedicated page would look better. It would, for a reason beyond the Dialog centering bug above: the movement table has 8 columns (Date, Item, Store, Type, Status, Change, Before→After, Note) that don't fit inside a `max-w-3xl` (768px) modal without wrapping — a full-width page was the right call independent of the dialog bug.

**What was built:** new route `app/dashboard/inventory/monitoring/[sku]/page.tsx`. Routed by SKU (human-readable — e.g. `/dashboard/inventory/monitoring/SUIV-0001?store=<store_id>`), not `variant_id`, for a clean breadcrumb/URL; `sku` has no DB uniqueness constraint (`item_variants` has none), so the page looks up by `sku` first and falls back to matching `id = :sku` for the rare case a variant has no SKU. Verified live against Postgres before relying on this: 62/62 non-deleted variants currently have non-null, unique SKUs, so the fallback path is a safety net, not the common case. `store` is an optional query param (defaults to the variant's first/only `inventory_levels` row) since the level's true grain is `(variant_id, store_id)`, not `sku` alone — future-proofing for when this project has more than one store (still exactly one today, per INV-12's note).

The page shows a back-link to Monitoring, item name + status badge, a 7-stat snapshot row (Available/Reserved/In Production/On Hold/Incoming/On Hand/Projected), then the same "Recent Movements" table (max 50, newest first) that used to live in the modal. `inventory-monitoring-table.tsx`'s row click now does `router.push()` to this route instead of opening a dialog; `item-movements-dialog.tsx` and its server action (`monitoring/actions.ts`) were deleted as dead code.

**Real bug hit and fixed while wiring this up, not just a refactor:** the first attempt called `movementColumns()` (a function that builds `Column<MovementRow>[]` with JSX `render` closures) directly inside the new *Server* Component and passed the result as a prop to the *Client* `<DataTable>` — React Server Components cannot serialize function props across that boundary at all, regardless of which module defines the function (confirmed live: `"Functions cannot be passed directly to Client Components..."` runtime error, not just a lint/type issue — `tsc` doesn't catch this). Fixed by moving `movementColumns()` itself out of `movements-table.tsx` into the shared `movement-utils.tsx` (renamed from `.ts` since it now contains JSX) so both the list page's `MovementsTable` and this new detail page can share one definition, but critically the detail page **doesn't call it directly** — it passes only the plain serializable `movements: MovementRow[]` array down to `<MovementsTable>` (a Client Component), which computes columns client-side. `MovementsTable` gained optional `title`/`description` props (defaulting to the existing "Inventory Movement History" / 500-row copy) so this page could reuse it verbatim with "Recent Movements" / 50-row copy instead of forking a near-duplicate table component.

**Verified live (Claude admin test account):**
- Clicked a Monitoring row (`SUIV-0001`) → navigated to `/dashboard/inventory/monitoring/SUIV-0001?store=8d5352c0-...` — breadcrumb reads `Dashboard / Inventory / Monitoring / SUIV-0001` (clean, no raw UUID). Snapshot stats and movement table both correct for that variant+store.
- Clicked a different row (`SUIV-0003`) from a fresh page load → same result, confirmed via accessibility-tree snapshot (heading, stat values, breadcrumb, back-link all correct for the newly clicked item).
- `npx tsc --noEmit` clean, `npx vitest run` 9/9 passing, no console/server errors on the final state (the RSC function-prop error above was hit and fixed *during* this session, not left in place).

### INV-16 amendment 2 — status badge removed, quantity tiles compacted + recolored to match the table (2026-07-09)

Two more asks from Sinag against the detail page screenshot: drop the status badge (OK/Low/Out) from the top-right, and shrink the 7-stat snapshot row, coloring each tile the same as its corresponding column badge on the Inventory Monitoring table (rather than the plain uncolored `StatCard`s both pages used).

**What was built:** new shared `app/dashboard/inventory/monitoring/qty-tile.tsx` — `QtyTile({ label, value, variant? })`, a small bordered card (label in muted text, value as a `Badge` when `variant` is given, plain bold text when it's omitted). No `"use client"` needed — it's rendered directly, not passed as a function prop across a Server/Client boundary, so it works in both. Colors are literally the same `Badge` variant strings the two source tables already use, not hand-matched hex values: `available`→success, `reserved`→info, `in_production`→default, `on_hold`→warning, `incoming`→neutral (from `inventory-monitoring-table.tsx`), plus `low`→warning, `out`→danger (from that table's `STATUS_BADGE`). `on_hand`/`projected` (detail page) stay unbadged, matching the list table's own plain-text treatment of those two columns.
- `[sku]/page.tsx`: removed the `PageHeader actions` status badge entirely, along with the now-dead `getStockStatus`/`StockStatus`/`STATUS_BADGE`/`threshold`/`low_stock_threshold` computation that only existed to feed it (also dropped `low_stock_threshold` from the Supabase select — nothing reads it anymore). The 7 `StatCard`s were replaced with `QtyTile`s in a tighter `gap-3` grid.
- `page.tsx` (the list page): the 6-tile "Low Stock / Out of Stock / On Hold / In Production / Incoming / Reserved" summary row also switched from `StatCard` to `QtyTile`, same color mapping. Dropped the old `trend`/down-arrow behavior on Low Stock/Out of Stock — the tile's color now carries that signal instead of a separate arrow.

**Verified live:** `preview_inspect` on both pages' "Available"/"Low Stock" tiles confirmed the rendered `<span>` carries the exact class string `bg-(--color-success-light) text-(--color-success)` / `bg-(--color-warning-light) text-(--color-warning)` — same classes the table badges use, not just visually similar. Accessibility-tree snapshot confirmed no status text/badge remains near the item heading. `npx tsc --noEmit` clean, `npx vitest run` 9/9, no console errors.

---

## INV-17 — `_deduct_shipment_stock` picks the deduction bucket per order item ✅ DONE (2026-07-11)

Sinag hit "Mark Shipped" on `SOD26-0708-0022` and got `Insufficient in_production quantity (have 0, need 15)` for `Itm-Hairbrush Large (SUIV-0008)` despite having 296 units on hand.

**Root cause, two separate things:**
1. **Data corruption on `SUIV-0008` specifically:** `inventory_movements` showed a 2026-07-08 entry noted `"INV-9 verification cleanup - releasing test production"` that released this order's 15 legitimately-in-production units back to `available` — the order wasn't test data, it kept living and its Production Order was later marked `completed` (15/15), leaving `in_production_qty` at 0 for stock the shipping flow still expected to find there.
2. **Real bug that would have hit the next two lines regardless:** `deduct_stock_out()`'s default bucket for any tracked non-packaging item is hardcoded to `'in_production'`, and `_deduct_shipment_stock()` never overrode it per line. That's correct for a completed Production Order (stock deliberately stays in `in_production` until shipped, per [[project_inv9_production_order_relink_fix]]'s invariant) but wrong once a line's Production Order is *cancelled* — `cancel_production_order()` already releases that quantity to `available` and nulls `order_items.production_order_id`. `SUIV-0009`/`SUIV-0019` on this same order were in exactly that state (PO cancelled, stock correctly sitting in `available`) and would have thrown the identical error right after SUIV-0008 was fixed.

**Fix:**
- One-off data reconciliation: `transfer_stock_status('available' → 'in_production', 15, ...)` on `SUIV-0008` to restore the invariant for this specific order (ran via Supabase MCP under the admin test account's `request.jwt.claim.sub`).
- Code fix (migration `inv17_deduct_shipment_stock_bucket_per_order_item`): `_deduct_shipment_stock()` now reads each shipment line's `order_items.production_order_id` and passes `deduct_stock_out(..., p_from_status)` explicitly — `'in_production'` when the FK is still set (active or completed PO), `'available'` when it's null (PO was cancelled, stock already released). No `deduct_stock_out` change needed — its `p_from_status` override already existed from `inv15_deduct_stock_out_explicit_from_status`, just wasn't being used by this call site.

**Verified live (Claude admin test account):** confirmed via SQL that `SUIV-0009`/`SUIV-0019` had `production_order_id = null` (cancelled) before retrying; clicked Mark Shipped on `SSH26-0711-0031` in the browser — succeeded, order status → `shipped`, shipment → `shipped` with timestamp. Post-shipment SQL check: `SUIV-0008` deducted 15 from `in_production` (→0), `SUIV-0009`/`SUIV-0019` deducted 5/8 from `available` — each bucket matched what the fix intended.

---

## INV-18 — `start_production()` auto-tops-up reservation instead of silently creating an unbacked Production Order ✅ DONE (2026-07-11)

Same day as INV-17, Sinag hit the identical `Insufficient in_production quantity` error on a *different* order (`SOD26-0709-0026`, `Pro-Bamboo Coaster` → component `SUIV-0007`, need 15) — INV-17's fix didn't help because this order's Production Order (`SPR26-0709-0034`) was still linked and `completed` (not cancelled), yet `in_production_qty` was genuinely 0.

**Root cause:** `activity_logs`/`inventory_movements` reconstructed the real sequence: `SPR26-0709-0033` (this order's first Production Order, 15 units) was started — correctly moving 15 units `reserved → in_production` — then cancelled ~1 minute later, which correctly released the stock and zeroed `order_items.reserved_qty` (order reverted to `confirmed`, per [[project_ps21_cancel_order_on_hold_bucket_fix]]-era design). ~9 hours later, "Start Production" was run again on the same order. `start_production()`'s stock-transfer loop only processes lines with `reserved_qty > 0`, so it moved nothing — but its Production-Order-creation loop groups over *all* order items unconditionally, so it still created a brand-new PO (`SPR26-0709-0034`, quantity 15) and flipped the order to `in_production`. That PO was later marked `completed` (which never moves stock either, by design — see INV-17), producing a Production Order that claims 15 units done with zero backing inventory. Any order that gets its production cancelled and restarted without an intervening re-edit hits this.

**Fix (migration `inv18_start_production_top_up_reservation`):** `start_production()` now walks every order item (not just `reserved_qty > 0` ones) and tops up any shortfall (`quantity - reserved_qty`) from `available` first — same greedy per-component `floor(available/ratio)` reservation `adjust_order_items()` already uses — before doing the existing `reserved → in_production` transfer. Partial stock shortage is still tolerated (best-effort, no exception), matching `adjust_order_items()`'s existing tolerance.

**Verified live/direct RPC (Claude admin test account):**
- Unblocked `SOD26-0709-0026` itself: `transfer_stock_status('available'→'in_production', 15)` on `SUIV-0007`; Mark Shipped then succeeded in the browser (order/shipment both → `shipped`).
- Reproduced and closed the actual gap with a disposable order (`SOD26-0711-0028`, 2× `SUIV-0001`, deleted/cancelled after): `create_order` → `start_production` (created PO, moved 2 units `reserved→in_production` as expected) → `cancel_production_order` (confirmed `reserved_qty` zeroed, order back to `confirmed`, matching the bug precondition) → `start_production` again — this time `order_items.reserved_qty` came back to `2` (topped up from `available`, which dropped 244→242) and `in_production_qty` correctly showed `2`, instead of silently creating an unbacked PO. Cancelled the test order afterward; `SUIV-0001` levels confirmed back to their exact pre-test baseline (244/0/0/0).

---

## Open / deferred (not blocking this phase)

- Wiring the generated `Database` type into `lib/supabase/client.ts`/`server.ts` and the ~23 call sites (INV-2) — separate follow-up, not part of Phase 1.
- The 7 pre-existing negative-`in_stock` rows (raw-material `Inv-` items) — flagged, clamped to `available_qty=0`, but the underlying `in_stock` data-quality issue itself is untouched. Needs a separate physical-count/adjustment pass.
- `purchase_orders.store_id` is never set on creation and the receive trigger ignores it (see INV-12) — needs real wiring (a store selector on the PO form) once this project has more than one active store.
- Remaining Phase 1 non-goals from the kickoff doc still out of scope: Sales Order auto-reservation, Production Order consumption, any automatic/trigger-driven status transitions, cross-store aggregation.
