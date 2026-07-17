# PROGRESS-FIFO.md

Tracks the **FIFO Inventory (Batch/Lot) Tracking** build for Sinag Ukit ERP. Follows the same convention as `PROGRESS-INVENTORY.md`/`PROGRESS-ACCOUNTING.md`: `FIFO-` prefixed phases, kept separate from the core `PROGRESS.md` numbering. Append-only.

Source doc: `docs/FIFO-Inventory-Tracking-Kickoff.md` — stays in place until the full `FIFO-1..7` checklist is done, then gets archived to `docs/archive/`, same treatment as `Inventory-Status-Phase1-Kickoff.md`.

---

## Preflight (carried over from the kickoff doc, verified live 2026-07-17)

1. No lot/batch concept existed anywhere before this build (`information_schema` + repo-wide grep for `FIFO|lot_number|batch_number`, zero hits). Greenfield.
2. `incoming_items` is the single receiving ledger for both PO receiving and Manual Incoming — neither touches `inventory_levels` directly, both go through the `apply_incoming_item_inventory_movement()` trigger. `incoming_items` rows become the lots; no new `inventory_lots` table.
3. Two chokepoints cover every consuming/moving path: `deduct_stock_out()` (permanent removal — shipment, scrap) and `transfer_stock_status()` (bucket-to-bucket moves — production, reserve, hold, cancel/release). Only these two need FIFO rewrites (FIFO-3); every other stock-affecting RPC inherits correct behavior by calling through one of them.
4. `adjust_stock()` is a separate, un-dated path today — positive deltas will start creating a lot (FIFO-4), negative deltas FIFO-decrement via the helper.
5. `incoming_items.source` is free text (`purchase_order`/`manual`/`online`/`supplier`/`walk-in`, 35 rows at kickoff), not a checked enum. The `business_events` branch in the receiving trigger needs a third case added in FIFO-3 (`inventory_adjustment` → `inventory_adjustment_gain`) once FIFO-4 starts inserting adjustment-sourced lots, or they'll be silently misclassified as `manual_incoming`.
6. Composite/manufactured items never carry their own lot — `_deduct_shipment_stock()` expands through `item_components`, so a raw-material lot's identity survives receipt → reserve → in_production → shipped.
7. Scale at kickoff: 35 `incoming_items` rows (26 PO, 9 manual) across 15 variants, 969 `inventory_movements` rows, 1 active store.
8. Latest migration at kickoff: `finpur_21_journal_po_payment`. **Re-verified 2026-07-17 at FIFO-1 start:** `list_migrations` confirmed this was still latest immediately before applying `fifo_1_lot_columns`. No local `supabase/migrations` folder — applied via the Supabase MCP `apply_migration` tool directly.

**Finding at FIFO-1, resolved same day (see FIFO-1b below):** `incoming_items` had **no `store_id` column**. The receiving trigger (`apply_incoming_item_inventory_movement()`) resolved store implicitly by looking up `stores WHERE is_active = true ORDER BY created_at LIMIT 1` — there is exactly one active store today, so this never mattered functionally, but it meant a lot had no stored store scope of its own, and the kickoff doc's `_fifo_consume_lots()` signature (`p_variant_id, p_store_id, ...`) assumed joining `incoming_items` on `variant_id`/`store_id`, which wouldn't have compiled as written. **Sinag chose option 2:** add the column, backfilled from the same resolution the trigger already does.

---

## FIFO-1 — Migration: lot columns ✅ DONE

**Status:** Complete 2026-07-17.

**What was built** (migration `fifo_1_lot_columns`):
- `incoming_items` +4 columns: `lot_available_qty`, `lot_reserved_qty`, `lot_in_production_qty`, `lot_on_hold_qty` — all `numeric(12,3) NOT NULL DEFAULT 0 CHECK (>= 0)`.
- `inventory_movements` +1 column: `lot_id uuid REFERENCES incoming_items(id)`, nullable (null = untracked movement), + partial index `inventory_movements_lot_id_idx WHERE lot_id IS NOT NULL`.

**Deviation from the kickoff doc's literal SQL:** the doc specified bare `numeric` for the 4 new columns. Changed to `numeric(12,3)` to match the existing precision convention on every other quantity column in this schema (`incoming_items.quantity`, `inventory_levels.*_qty`, `inventory_movements.quantity_*` are all `numeric(12,3)`, per the price/qty decimal precision work). Not a design change, just consistency.

**Backfill:** none, per Decision B in the kickoff doc — all 38 existing `incoming_items` rows (35 at kickoff-doc time, 38 by the time this ran — a few more were received in the interim) are left at `DEFAULT 0`. Verified post-migration: `SELECT count(*) FILTER (WHERE lot_available_qty <> 0 OR ...)` = 0 of 38 rows. Pre-feature stock is untracked going forward per Decision A (drained first by the FIFO helper once FIFO-2/3 land).

**Verification:**
- `information_schema.columns` confirms all 5 new columns exist with the right type/nullability/defaults.
- `get_advisors` (security): grepped the full output for the new column names — zero new findings tied to this migration; nothing column-specific to grant since RLS is already table-level on both tables.
- No app code changes yet (nothing reads/writes these columns until FIFO-2/3) — nothing to browser-verify this phase.

---

## FIFO-1b — `incoming_items.store_id` column ✅ DONE

**Status:** Complete 2026-07-17, same session as FIFO-1.

**What was built** (migration `fifo_1b_incoming_items_store_id`):
- `incoming_items` +1 column: `store_id uuid REFERENCES stores(id)`, nullable — mirrors the existing `variant_id` self-healing pattern rather than being `NOT NULL`, because neither `receive_purchase_order()` nor the Manual Incoming action (`app/dashboard/purchasing/receiving/actions.ts`) pass `store_id` today, and `NOT NULL` would reject their inserts before the trigger gets a chance to backfill it (`AFTER INSERT` triggers can't rescue a `NOT NULL` violation on the initiating insert itself).
- Backfilled all 38 existing rows to the one active store.
- Extended `apply_incoming_item_inventory_movement()`: `resolved_store_id` now starts from `new.store_id` (falls back to the existing active-store lookup only if null, same shape as the pre-existing `resolved_variant_id` logic), and the existing post-insert self-heal `UPDATE` (previously only backfilling `variant_id` when null) now also backfills `store_id` when null. Zero app-code changes needed — both existing insert call sites keep working unchanged.

**Not done, deliberately:** did not thread `purchase_orders.store_id` (which does exist) through `receive_purchase_order()`'s `INSERT INTO incoming_items` explicitly. That would be more architecturally correct for an eventual multi-store world, but it's a separate change from what was asked (backfill via the existing single-active-store resolution) — flag if Sinag wants that done too once a second store is actually on the table.

**Verification (direct Postgres, live):**
- Backfill: `count(*) FILTER (WHERE store_id IS NULL) = 0` across all 38 rows, `count(DISTINCT store_id) = 1`.
- Trigger self-heal: inserted a disposable `incoming_items` row (qty 0.001, variant `Itm-Paper A4 250 GSM`) with `store_id` omitted, same as real callers do. `RETURNING store_id` came back `null` (expected — `RETURNING` reflects the row at insert time, before the `AFTER INSERT` trigger's `UPDATE` runs), but re-selecting the row immediately after showed `store_id` correctly backfilled to the one store. The linked `inventory_movements` row, the `inventory_levels` bump (+0.001 to both `in_stock`/`available_qty`), and a `business_events` row (`manual_incoming`) all fired correctly. `lot_available_qty` stayed `0.000` on the test row — expected, lot-stamping is FIFO-3 scope, not FIFO-1/1b.
- **Unexpected side effect caught during cleanup:** the test `business_events` insert cascaded into a `journal_entry_drafts` row (`status = 'pending_review'`) via the existing accounting rule-engine trigger (`acct7_5_wire_business_events_trigger`, pre-existing, unrelated to this change) — deleting `business_events` failed on a FK from `journal_entry_drafts.source_event_id` until that draft was deleted first. Good reminder for future test inserts against `incoming_items`/`business_events` in this project: **cleanup must also check `journal_entry_drafts`**, not just the three tables the kickoff doc's verification plan names.
- Full cleanup confirmed: all 4 test rows (`incoming_items`, `inventory_movements`, `business_events`, `journal_entry_drafts`) deleted, `inventory_levels` restored to its exact pre-test values (269.563 / 289.563).

---

## FIFO-2 — `_fifo_consume_lots()` helper ✅ DONE

**Status:** Complete 2026-07-17.

**What was built** (migrations `fifo_2_consume_lots_helper`, then `fifo_2_consume_lots_helper_fix`):
- `public._fifo_consume_lots(p_variant_id, p_store_id, p_status, p_quantity) RETURNS TABLE(lot_id uuid, qty_taken numeric, lot_col text)` — internal helper (underscore prefix, same convention as `_deduct_shipment_stock`), `SECURITY DEFINER`, `EXECUTE` revoked from `PUBLIC`/`anon`/`authenticated` (only `postgres` — verified against `has_function_privilege`, matches `_deduct_shipment_stock`'s access exactly).
- Locks the target `inventory_levels` bucket column (`FOR UPDATE`) and every open lot for that variant+store in that bucket (`lot_<status>_qty > 0`, also `FOR UPDATE`, via a CTE since `FOR UPDATE` can't combine with aggregates directly), computes `untracked = level_qty - sum(tracked lots)`, then returns a consumption plan: untracked first (Decision A — treated as older than any dated lot), then dated lots oldest-first (`date_received ASC, created_at ASC`), taking `min(remaining, still_needed)` from each slice until `p_quantity` is satisfied.
- Pure read + lock — does **not** mutate `incoming_items` or `inventory_levels` itself. FIFO-3 applies the returned slices as real column decrements and movement rows.
- Guards: rejects non-positive quantity, rejects any status outside `available`/`reserved`/`in_production`/`on_hold`, and raises `Insufficient % quantity (have %, need %)` (same message shape as `transfer_stock_status`/`deduct_stock_out` today) if the bucket total can't cover the request — belt-and-suspenders since FIFO-3's callers will already check this themselves before calling in.

**Bug caught before ever calling it live:** the first version (`fifo_2_consume_lots_helper`) reused the function's own scalar `RETURNS TABLE` OUT parameters (`lot_id uuid`, `qty_taken numeric`) as scratch targets for an `array_agg()` result via `EXECUTE ... INTO`. `CREATE FUNCTION` doesn't type-check the body of dynamic SQL, so this compiled cleanly and would only have blown up the first time the function actually ran. Caught on a second read-through before any live call; replaced with properly declared `v_lot_ids uuid[]` / `v_lot_qtys numeric[]` locals in the immediately-following `fifo_2_consume_lots_helper_fix` migration.

**Verification (direct Postgres, live, against a real multi-lot variant):** used the variant behind `Itm-...` with 6 real `incoming_items` rows (dates 07-02 → 07-17, `available_qty = 329.018`, 0 lot-tracked at the time since FIFO-3 hasn't wired the stamping yet). Temporarily stamped `lot_available_qty` on the two oldest lots (07-02 → `1`, 07-08 → `10`) to simulate what FIFO-3 will eventually do on receipt, giving tracked = 11, untracked = 318.018:
- `p_quantity = 5` → single slice, `lot_id = NULL, qty_taken = 5`. Untracked-only path. ✅
- `p_quantity = 320` (spans untracked + both stamped lots) → 3 slices: `(NULL, 318.018)`, `(07-02 lot, 1.000)`, `(07-08 lot, 0.982)` — correct oldest-first order, correct partial take on the last slice, sums to exactly 320. ✅
- `p_quantity = 329.018` (exact total) → 3 slices summing to exactly 329.018, no shortfall exception, the 4 untouched lots (still at 0) correctly excluded by the `lot_<status>_qty > 0` filter. ✅
- `p_quantity = 330` (1 over total) → raised `Insufficient available quantity (have 329.018, need 330)`. ✅
- `p_status = 'incoming'` → raised the invalid-status guard (confirms `incoming` is correctly excluded — matches `transfer_stock_status`'s existing rule that Incoming has no counterpart bucket). ✅
- `p_quantity = 0` → raised the non-positive guard. ✅
- Cleanup: both stamped lots reset to `0`; `count(*) FILTER (WHERE any lot_*_qty <> 0) = 0` across all 38 rows afterward — no lingering test state.

---

## FIFO-3 — Wire FIFO into the two chokepoints + receiving trigger ✅ DONE

**Status:** Complete 2026-07-17.

**What was built** (migrations `fifo_3a_trigger_lot_stamp`, `fifo_3b_transfer_stock_status_fifo`, `fifo_3c_deduct_stock_out_fifo`):
- `apply_incoming_item_inventory_movement()`: every new `incoming_items` row now gets `lot_available_qty = quantity` stamped on itself (unconditional, not just the `variant_id`/`store_id` self-heal from FIFO-1b), and its own `inventory_movements` row is stamped `lot_id = new.id` — a lot is traceable from the very first movement in its life. `business_events` classification is now a three-way branch (`purchase_order` → `purchase_received`, `inventory_adjustment` → `inventory_adjustment_gain`, else → `manual_incoming`) — the middle branch is dead code until FIFO-4 ships (no caller inserts `source = 'inventory_adjustment'` yet), purely forward-compatible.
- `transfer_stock_status()`: now calls `_fifo_consume_lots(..., p_from_status, p_quantity)` and loops the returned slices — per slice, decrements that lot's `lot_<from>_qty` / increments `lot_<to>_qty` (skipped for untracked slices, `lot_id IS NULL`), and inserts the existing two-row linked movement pattern (`transfer_group_id` + `counterpart_status`) once per slice, each pair getting its **own** `transfer_group_id` (so a transfer spanning N lots stays unambiguous — 2N movement rows, each pair still cleanly linked) and each row stamped with that slice's `lot_id`. `quantity_before`/`quantity_after` on each row are a true chained running total of the bucket level across the slices in FIFO order (not a flat before/after for the whole operation) — verified this preserves the existing "ledger reconstructs from movement rows" property. `inventory_levels` aggregate update is unchanged: one update using the full `p_quantity`, same as before. Dropped the old standalone `Insufficient % quantity` check — the helper now performs the equivalent guard.
- `deduct_stock_out()`: same shape, one `stock_out` movement row per slice (not two — no counterpart bucket for a permanent removal), each stamped with `lot_id`. Preserved this function's existing (different from `transfer_stock_status`) convention that `quantity_before`/`quantity_after` track `in_stock` (the cross-bucket total), not the bucket column — now as a per-slice running total. `_deduct_shipment_stock()` and `release_to_scrap()` needed **zero changes** — they call this function and inherited FIFO for free, as the kickoff doc predicted.

**Verification (direct Postgres, live, real receiving path — not manually stamped this time):**
- Used a fresh variant (`Itm-Keychain Leather, Round`, baseline `in_stock=365, available_qty=65, reserved_qty=0`) with no prior lot history, so the pre-existing `available_qty` (65) plays the role of "untracked" cleanly.
- Received two **real** `incoming_items` rows via a plain `INSERT` (same shape Manual Incoming uses) — Lot A (qty 3, `date_received` 07-07) and Lot B (qty 5, `date_received` 07-17). Confirmed the trigger stamped `lot_available_qty = quantity` on both and `lot_id = own id` on their `incoming` movement rows, with **no manual stamping needed this time** — first real proof the trigger extension works end-to-end, not just the FIFO-2 fixture.
- `transfer_stock_status(available → reserved, 69)` — spans untracked (65, all of pre-existing stock) + Lot A fully (3) + 1 of Lot B's 5: resulting `available_qty=4, reserved_qty=69` (exact). Lot A: `available→0, reserved→3`. Lot B: `available→4, reserved→1`. 6 movement rows in 3 correctly-chained groups (`73→8`/`0→65`, then `8→5`/`65→68`, then `5→4`/`68→69`) — oldest-first order and running totals both exactly right. ✅
- `deduct_stock_out(reserved, 68, from_status='reserved')` — spans untracked-in-reserved (65) + Lot A's reserved 3, leaves Lot B's reserved 1 untouched: `reserved_qty=1, in_stock=305` (373 after the two receipts, minus 68). Lot A: `reserved→0`. Lot B: `reserved` stays `1`. 2 movement rows with correctly chained `in_stock` running totals (`373→308`, `308→305`). ✅
- Needed `SET LOCAL request.jwt.claims` (Claude admin profile) to satisfy `current_user_role()` inside both `SECURITY DEFINER` functions — for `deduct_stock_out` specifically, **must not** also `SET LOCAL role = 'authenticated'`, since that role has no `EXECUTE` grant on it (postgres-only, by design — confirmed this is the security sweep working correctly, not a bug). `transfer_stock_status` does allow `authenticated` to call it directly, so that one needed the role switch too.
- Cleanup: same chain as FIFO-1b/FIFO-2 (`journal_entry_drafts` → `business_events` → `inventory_movements` → `incoming_items` → `inventory_levels` reset to exact baseline `in_stock=365, available_qty=65, reserved_qty=0`). Confirmed zero rows left behind across all 4 tables.
- `get_advisors` (security): no new findings tied to any of the three functions — `transfer_stock_status` shows the same pre-existing "callable by `authenticated`" note it already had (intentional, unchanged); `deduct_stock_out`/`_fifo_consume_lots`/the trigger produced no findings at all (not directly callable).

---

## FIFO-4 — Rewrite `adjust_stock()` ✅ DONE

**Status:** Complete 2026-07-17.

**What was built** (migrations `fifo_4_adjust_stock_fifo`, then `fifo_4b_fix_adjustment_gain_rule_engine`):
- `adjust_stock()` split into two genuinely different paths:
  - **Positive delta:** inserts into `incoming_items` (`source = 'inventory_adjustment'`, `unit_price = item_variants.cost` fallback `0`, `date_received = current_date`, `payment_status = 'paid'`, `store_id` passed explicitly since `adjust_stock` already knows it — no need to rely on the trigger's single-active-store fallback) and lets `apply_incoming_item_inventory_movement()` do the `inventory_levels`/`inventory_movements`/`business_events` writes, same as any other receipt. `adjust_stock()` does **not** also write those itself for this branch. Re-queries the movement row the trigger produced via `source_reference_id = <new incoming_items.id>` to preserve the `RETURNS inventory_movements` contract. Confirmed side effect (flagged, not hidden, per the kickoff doc): an item's initial on-hand quantity at creation (`upsert_item` → `adjust_stock`, always positive) now also creates a real lot.
  - **Negative delta:** stays a direct write (no `incoming_items` row for a decrease), but the flat `available_qty -= |delta|` is replaced with a FIFO decrement via `_fifo_consume_lots()`, one `manual_adjustment` movement row per lot slice (lot_id `NULL` once tracked lots are exhausted, per Decision A). The original `in_stock`-based negative-stock guard is preserved unchanged (belt-and-suspenders alongside the helper's own `available_qty`-based guard, which now gives a clean error message instead of a raw CHECK-constraint failure in the case they'd previously diverge). `business_events` stays exactly one `inventory_adjustment_loss` row per call, referencing the **last** movement row inserted, same payload shape as before (`qty_delta`/`unit_cost`) — unchanged, since this path never touches `incoming_items`.
  - Both existing callers (`upsert_item`'s initial-stock loop, which uses `PERFORM` and discards the result; the Adjustment page's server action, which only checks `error`) needed **zero** changes — confirmed by reading both call sites before writing the migration, not assumed.

**Bug found and fixed live, not by inspection — `fifo_4b_fix_adjustment_gain_rule_engine`:** the first live test of the positive-delta path failed with `null value in column "debit" ... violates not-null constraint` inside `generate_draft_journal_entries()`. Root cause: that function's `inventory_adjustment_gain` branch computed the journal amount from `payload->>'qty_delta' * payload->>'unit_cost'` — the shape `adjust_stock()` used to emit when it wrote `business_events` directly. FIFO-4 moved positive-delta adjustments through `incoming_items`, whose trigger-emitted payload uses `quantity`/`unit_price`/`total_price` instead (the same shape `purchase_received`/`manual_incoming` already use) — neither key existed in the new payload, so the amount computed to `NULL`. Confirmed before fixing that this was safe to just fix outright (not a dual-shape compatibility shim): the one pre-existing `inventory_adjustment_gain` event in the table predates this change and is already `processed_at`-stamped, and nothing else emits the old shape anymore. Fixed by aligning the `inventory_adjustment_gain` branch's amount calculation with the identical `coalesce(total_price, quantity * unit_price)` pattern `purchase_received`/`manual_incoming` already use. `inventory_adjustment_loss` and `inventory_scrap` branches were left untouched — both are still fed by direct `business_events` writes using the original `qty_delta`/`unit_cost` shape, unaffected by this phase.

**Verification (direct Postgres, live, real receiving + real adjustment path):**
- Used the same `Itm-Keychain Leather, Round` variant from FIFO-3 (baseline restored `in_stock=365, available_qty=65, reserved_qty=0`).
- `adjust_stock(+3, 'FIFO-4 test')` → Lot C created (`source='inventory_adjustment', payment_status='paid', unit_price=19 (variant cost), total_price=57, lot_available_qty=3`), movement row returned correctly (`quantity_before=365, quantity_after=368, lot_id = the new lot`), `business_events` row (`inventory_adjustment_gain`, `source_table='incoming_items'`, payload has `quantity`/`unit_price`/`total_price`), journal draft generated and **balanced** (57 debit / 57 credit) — confirms the FIFO-4b fix. ✅
- `adjust_stock(+5, 'FIFO-4 test')` → Lot D created the same way (`quantity_after=373`). ✅
- `adjust_stock(-70, 'FIFO-4 test')` → spans untracked (65) + Lot C fully (3) + 2 of Lot D's 5: `available_qty=3, in_stock=303` (73−70, 373−70). Lot C: `lot_available_qty→0`. Lot D: `lot_available_qty→3`. 3 chained `manual_adjustment` movement rows (`373→308` untracked, `308→305` Lot C, `305→303` Lot D partial) — correct oldest-first order across **two same-day adjustment lots**, tie-broken correctly by `created_at` (Lot C before Lot D) since both had `date_received = today`. Exactly **one** `inventory_adjustment_loss` business event, referencing the last movement row (the Lot D slice), payload preserved as `qty_delta=-70, unit_cost=19` — matching the pre-existing shape exactly. Journal draft balanced (1330 debit / 1330 credit = 70 × 19) — confirms zero regression on the unchanged loss path. ✅
- Cleanup gotcha caught mid-cleanup: the first cleanup attempt only accounted for 2 of the **3** journal-entry drafts this test actually produced (missed Lot D's own gain draft) — the batch DELETE failed on an FK violation, and because `execute_sql` runs a multi-statement call as one transaction, the whole batch (including the two deletes that "looked like" they'd succeed) rolled back together, not just the failing statement. Re-queried for every draft created in the test window, found all 3, and re-ran the full cleanup in one pass. Good reminder for future multi-row test scenarios in this project: **query for everything the test could have cascaded into by time window, don't just track the ids you think you created** — a single adjustment call here fanned out to 1 lot + 2 movement rows + 1 business event + 1 journal draft + 2 draft lines, twice over for the two positive calls.
- Full cleanup confirmed: zero rows left in `incoming_items`, `inventory_movements`, `business_events`, `journal_entry_drafts`; `inventory_levels` restored to exact baseline.
- `get_advisors` (security): no new findings — `adjust_stock` shows only its pre-existing "callable by `authenticated`" note (unchanged); `generate_draft_journal_entries` isn't directly exposed, produced nothing.

**All 4 deliverables from the original kickoff doc's FIFO-1..4 core are now done.** Remaining: FIFO-5 (regenerate TypeScript types), FIFO-6 (Batches UI + trace drill-in), FIFO-7 (final live verification + archive the kickoff doc).

**Next:** FIFO-5 — regenerate TypeScript types (`generate_typescript_types`), so the 5 new `incoming_items`/`inventory_movements` columns and the (still `_`-prefixed, non-exposed) `_fifo_consume_lots` shape are reflected in `lib/supabase/types.ts`.
