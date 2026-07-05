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

## Open / deferred (not blocking this phase)

- Wiring the generated `Database` type into `lib/supabase/client.ts`/`server.ts` and the ~23 call sites (INV-2) — separate follow-up, not part of Phase 1.
- The 7 pre-existing negative-`in_stock` rows (raw-material `Inv-` items) — flagged, clamped to `available_qty=0`, but the underlying `in_stock` data-quality issue itself is untouched. Needs a separate physical-count/adjustment pass.
- All the Phase 1 non-goals from the kickoff doc remain out of scope: Sales Order auto-reservation, PO receiving (Incoming→Available), Production Order consumption, any automatic/trigger-driven status transitions, cross-store aggregation.
