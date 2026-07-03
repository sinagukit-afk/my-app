---
name: bms-supabase
description: Conventions for Supabase schema, RLS, and RPC design in the Sinag Ukit BMS project (SinagUkitData, project glwskmtworldifydsihc). Use when writing migrations, RPCs, RLS policies, or any stock-affecting database logic.
---

# BMS Supabase Conventions

## Preflight — do this before starting any new phase, before writing any code

`PROGRESS.md`, `MODULE_STATUS.md`, `DECISIONS.md`, and `BUSINESS_RULES.md` are a fast index, not ground truth — they are hand-maintained and have already been caught out of sync with the real system more than once (e.g. `MODULE_STATUS.md` marked Dashboard and Incoming Inventory "complete" when the actual code was mock data / an unwired stub). Do not start building against what these files claim without checking the live system first:

1. **Database:** run `list_tables`, `list_migrations`, and `get_advisors` (Supabase MCP) to confirm the schema actually matches what the docs describe — new columns, RPCs, or RLS policies referenced in `PROGRESS.md` should exist; nothing destructive should be pending.
2. **App code:** open or grep the actual route(s) for the module you're about to touch. Confirm whether it's still a literal "Coming Soon" stub or already wired to real queries — don't infer this from `MODULE_STATUS.md`'s badge alone.
3. **If you find a mismatch** between what the docs say and what the system actually shows, stop and flag it to the user before proceeding — don't silently trust either the docs or your own assumption about which one is right.

This is the same instinct as "don't trust memory of past phases" below, extended to the docs themselves.

Before making schema changes: use `list_tables`/`list_migrations` (Supabase MCP) to confirm current state — don't trust memory of past phases, schema may have moved on. When debugging, start with `get_advisors` and `get_logs` before touching anything.

## Stock-change pattern — the one rule that matters most

Never let application code or a generic trigger write `inventory_levels` directly outside an RPC or the one existing incoming-item trigger. The pattern everywhere in this schema is: **upsert `inventory_levels` (on conflict `variant_id, store_id`), then insert an `inventory_movements` row with `quantity_after` set to the resulting level** — in that order, inside one transaction/RPC. There is deliberately no generic movements→levels trigger, to avoid double-counting against the incoming-item trigger (`apply_incoming_item_inventory_movement`).

Any new feature that touches stock should be a new `SECURITY DEFINER` RPC following the `adjust_stock` / `confirm_order` / `receive_purchase_order` / `adjust_order_items` precedent — do the multi-step stock-affecting work atomically in Postgres, not as sequential client-side calls. If an edit needs to reconcile *already-deducted* stock (not just add new), diff old-vs-new BOM-expanded quantities per variant and post one movement per changed variant (see `adjust_order_items` for the reference implementation of a stock-reconciling edit).

## Role-gating convention

Enum `user_role`; no new values without checking blast radius first — ~25 RLS policies and 2+ RPCs hardcode `role = 'admin'` / `role IN (...)`. Prefer reusing an existing role (e.g. the `claude-code@sinagukit.internal` test account reuses `admin` rather than adding an agent role) unless a genuinely new permission tier is required.

Standard RLS shape on new tables: SELECT = any authenticated user; INSERT/UPDATE = admin/manager/encoder; DELETE = admin/manager only. RPCs are `SECURITY DEFINER` and check `current_user_role()` internally — don't rely on RLS alone to gate an RPC's effects. When remodeling a status/enum column (like `orders.status` in Phase 10), grep the whole app for old-value references AND re-check every RLS policy on that table — Phase 14 caught a policy left checking a status value that had already been removed, silently making an "encoder can update own row" policy permanently false.

## Soft delete only — never a hard DELETE from user actions

No user-facing "Delete" action should ever remove a row from Supabase. Every table that supports delete needs a soft-delete column (e.g. `deleted_at timestamptz`, or reuse an existing `is_active`/`active` boolean where one already exists, like `suppliers`). A "Delete" action sets that column instead of running `DELETE`; a hard `DELETE` statement should only ever be run manually by the user via SQL, never from application/RPC code.

Rows marked deleted must never appear anywhere in the app: every `SELECT` (list pages, dropdowns/pickers, joins, RPCs that expand BOM/components, RLS policies themselves) must filter `deleted_at IS NULL` (or `is_active = true`). The safest way to guarantee this app-wide is a `WHERE` filter baked into RLS SELECT policies on soft-deletable tables, not just in individual page queries — that way a query that forgets the filter still can't surface deleted rows. Unique constraints that should allow reusing a value after "deletion" (e.g. a supplier name) may need a partial unique index (`WHERE deleted_at IS NULL`) instead of a plain unique constraint.

**Why:** avoids losing referential/audit history (e.g. a deleted supplier still referenced by old `incoming_items`/`purchase_orders`) and gives a recovery path, consistent with this project's existing preference for deactivate-over-delete (see the Suppliers FK-violation handling in the `bms-app` skill).

## Reference numbering / auto-generated identifiers

If a table needs a human-facing reference (like `purchase_orders.reference` = `SPO-<year><mmdd><seq>`), use a `BEFORE INSERT` trigger with `NOT NULL UNIQUE`, not app-generated strings — keeps numbering server-authoritative. Known accepted limitation: a `SELECT COUNT`-based daily sequence has a small race window under concurrent same-millisecond inserts; acceptable for this app's low-concurrency usage, revisit with a real sequence/advisory lock only if volume grows.

## Rollup totals

Tables with a header + line-items shape (`purchase_orders`/`purchase_order_items`) get a recalc trigger (`recalc_purchase_order_totals()`) so totals are never hand-computed in app code. Tables without one yet (`orders`/`order_items`) compute totals once in the server action at creation/edit time — if a screen ever needs to edit line items after creation, remember totals must be explicitly recomputed there too (no trigger safety net).

## Migrations

Apply via the Supabase MCP `apply_migration` tool directly against the linked project (no local Supabase CLI stack in use for this project). Keep migrations additive wherever possible (new columns/tables/triggers/RPCs rather than altering existing behavior) — every migration so far in this project has avoided drops/destructive alters. Before any destructive SQL (deletes, drops, backfills that alter existing rows), stop and ask the user first, even if it seems reversible — a same-session incident (Phase 15) showed that "reversible" is a judgment call that should not be made unilaterally.

## Loyverse ↔ Supabase sync (n8n)

The `n8n` MCP is connected and can inspect/edit/test-execute the live sync workflows — use it (`get_workflow_details`, `search_executions`, `get_execution`, `update_workflow`, `execute_workflow`) instead of assuming sync behavior from the DB schema alone.

Everything currently lives in **one** n8n workflow, `Loyverse Sync - Modifiers & Discounts` (id `F6CfXnxji98Y75JJ`), despite the name — it actually bundles all Loyverse↔Supabase sync branches: categories, items/variants/components, customers, inventory levels/movements, receipts, payment types, modifiers, and discounts, each on its own schedule trigger. User intends to split these into per-resource workflows eventually; until then, this one workflow is the whole picture.

**Status as of 2026-07-03:** intentionally left `active: false` (test phase) — all execution so far has been manual, don't assume anything is syncing on a schedule. Fixed today: the `sync_state` "mark complete" nodes for modifiers/discounts/payment_types were wired as parallel fan-out branches off the *fetch* step instead of sequenced after the actual Postgres write, so `sync_state` could report false success/failure independent of what really happened — rewired to fire after the real upsert (payment types now uses n8n's proper error-output port instead of an always-fires main connection). Still open: `Upsert Items`/`Upsert Variants`/`Upsert Components`/`Upsert Inventory Levels`/`Insert Inventory Movements`/`Upsert Receipts`/`Upsert Receipt Line Items`/`Upsert Receipt Payments` nodes have a `query` param of literal `{{ $json.query }}` missing the required `=` expression prefix — untested because that branch has never run; will fail as-is once exercised.

**Conflicts with the stock-change rule above:** the inventory branch of this workflow upserts `inventory_levels` and inserts `inventory_movements` directly via raw SQL from Loyverse data, bypassing the RPC convention entirely. That's intentional here — Loyverse is the source of truth for its own stock, not an app-initiated adjustment — but don't treat the "never write `inventory_levels` outside an RPC" rule as violated-by-omission when reading this workflow; it's a separate, deliberate external sync path.
