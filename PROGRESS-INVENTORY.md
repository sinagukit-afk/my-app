# PROGRESS-INVENTORY.md

Tracks the **Inventory Status (movement-based) Phase 1** build for Sinag Ukit BMS. Follows the same convention as `PROGRESS-ITEMS.md`/`PROGRESS-ACCOUNTING.md`: `INV-` prefixed phases, kept separate from the core `PROGRESS.md` numbering. Append-only.

Source doc: `Inventory-Status-Phase1-Kickoff.md` (repo root).

---

## Preflight (verbatim from the kickoff doc)

1. Read the full SQL body of `confirm_order()` and `adjust_stock()` (via `Supabase:execute_sql` against `pg_get_functiondef`). Both write to `inventory_levels.in_stock` and `inventory_movements` today, and this phase extends both. Do not guess their current logic.
2. **VERIFIED (2026-07-05):** `inventory_levels` does **not** have a unique constraint on `(variant_id, store_id, source_id)`. The actual constraint is `inventory_levels_variant_id_store_id_key` = `UNIQUE(variant_id, store_id)` only. `source_id` is a plain nullable column, not part of the row's identity. This doc has been updated to key everything off the real grain, `(variant_id, store_id)` — `p_source_id` has been dropped from both new RPCs below. Do not reintroduce a 3-column grain without a separate decision to actually start using `source_id` as a live dimension.
3. Confirm current `movement_type` check constraint values on `inventory_movements` (`initial_sync`, `incoming`, `sale`, `adjustment`, `manual_adjustment`, `order`) before altering it. **VERIFIED (2026-07-05):** matches exactly.
4. Latest migration is `0025_adjust_order_items_receiver_fields` — this phase is `0026_inventory_status_foundation`. This project has no local `supabase/migrations` folder; apply migrations via the Supabase MCP `apply_migration` tool directly against the linked project, per the `bms-supabase` skill.

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

**Found during a full inventory audit 2026-07-08** ([`Inventory-Reservation-Lifecycle-Fixes-Kickoff.md`](Inventory-Reservation-Lifecycle-Fixes-Kickoff.md)): the release/re-reserve loops in `adjust_order_items()` hardcoded `'reserved'` as the bucket regardless of order status. Correct only while `status='confirmed'` — once `start_production()` moves an order's committed stock to `'in_production'`, editing line items either raised a spurious "insufficient reserved" error or silently re-reserved into the wrong bucket, permanently desyncing `reserved_qty`/`in_production_qty` from what the order's status implied. Root cause of the drift manually cleaned up on `SOD26-0706-0005` earlier the same session.

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

## Open / deferred (not blocking this phase)

- Wiring the generated `Database` type into `lib/supabase/client.ts`/`server.ts` and the ~23 call sites (INV-2) — separate follow-up, not part of Phase 1.
- The 7 pre-existing negative-`in_stock` rows (raw-material `Inv-` items) — flagged, clamped to `available_qty=0`, but the underlying `in_stock` data-quality issue itself is untouched. Needs a separate physical-count/adjustment pass.
- All the Phase 1 non-goals from the kickoff doc remain out of scope: Sales Order auto-reservation, PO receiving (Incoming→Available), Production Order consumption, any automatic/trigger-driven status transitions, cross-store aggregation.
