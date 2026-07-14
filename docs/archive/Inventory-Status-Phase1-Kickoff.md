# Inventory Status — Phase 1 Kickoff (Movement-Based)

> **ARCHIVED (2026-07-09).** All 9 deliverables below shipped as `INV-1`
> through `INV-6` and were substantially extended further by `INV-7..16` —
> see `PROGRESS-INVENTORY.md` for the current, authoritative build log and
> live state. Kept here for historical reference only.

## Preflight (mandatory — do this before writing any migration)

1. Read the full SQL body of `confirm_order()` and `adjust_stock()` (via `Supabase:execute_sql` against `pg_get_functiondef`). Both write to `inventory_levels.in_stock` and `inventory_movements` today, and this phase extends both. Do not guess their current logic.
2. **VERIFIED (2026-07-05):** `inventory_levels` does **not** have a unique constraint on `(variant_id, store_id, source_id)`. The actual constraint is `inventory_levels_variant_id_store_id_key` = `UNIQUE(variant_id, store_id)` only. `source_id` is a plain nullable column, not part of the row's identity — of 33 existing rows, 32 have `source_id` set but all point to the same single source (`Loyverse POS`), and neither `adjust_stock()` nor `confirm_order()` reference `source_id` at all today. **This doc has been updated to key everything off the real grain, `(variant_id, store_id)` — `p_source_id` has been dropped from both new RPCs below.** Do not reintroduce a 3-column grain without a separate decision to actually start using `source_id` as a live dimension.
3. Confirm current `movement_type` check constraint values on `inventory_movements` (`initial_sync`, `incoming`, `sale`, `adjustment`, `manual_adjustment`, `order`) before altering it. **VERIFIED (2026-07-05):** matches exactly.
4. Latest migration is `0025_adjust_order_items_receiver_fields` — this phase is `0026_inventory_status_foundation`. **Note:** this project has no local `supabase/migrations` folder; apply migrations via the Supabase MCP `apply_migration` tool directly against the linked project, per the `erp-supabase` skill.

## Objective

Introduce inventory **status tracking** — Available, Reserved, In Production, On Hold, Incoming — as a first-class dimension of both the inventory balance table and the movement ledger. Every status change is a *logged movement*, not a silent field edit. No automatic status transitions are wired to Sales Orders, Purchase Orders, Production Orders, or Adjustments in this phase — those remain future phases. Manual, user-triggered status moves are the only way status quantities change in Phase 1.

## Non-goals (unchanged from original spec — do not implement)

- Sales Order reservation logic or automatic reservation release
- Purchase Order receiving logic (Incoming → Available on goods receipt)
- Production Order consumption/completion logic
- Any automatic, trigger-driven movement between statuses
- Aggregation across stores (keep everything at the existing `(variant_id, store_id)` grain)

Status quantities only change through the manual actions defined below, or through the existing `adjust_stock()` / `confirm_order()` paths as extended in this phase.

---

## Schema changes

### `inventory_levels` — add 5 columns

```sql
ALTER TABLE public.inventory_levels
  ADD COLUMN available_qty     numeric NOT NULL DEFAULT 0 CHECK (available_qty >= 0),
  ADD COLUMN reserved_qty      numeric NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
  ADD COLUMN in_production_qty numeric NOT NULL DEFAULT 0 CHECK (in_production_qty >= 0),
  ADD COLUMN on_hold_qty       numeric NOT NULL DEFAULT 0 CHECK (on_hold_qty >= 0),
  ADD COLUMN incoming_qty      numeric NOT NULL DEFAULT 0 CHECK (incoming_qty >= 0);

-- Backfill: existing in_stock becomes the starting Available balance
UPDATE public.inventory_levels SET available_qty = in_stock;
```

`in_stock` is kept as-is for backward compatibility (Loyverse sync and existing reads depend on it). It continues to represent On Hand going forward — see "Keeping `in_stock` in sync" below.

### `inventory_movements` — add 4 columns

```sql
ALTER TABLE public.inventory_movements
  ADD COLUMN status text NOT NULL DEFAULT 'available'
    CHECK (status = ANY (ARRAY['available','reserved','in_production','on_hold','incoming'])),
  ADD COLUMN quantity_before numeric,
  ADD COLUMN transfer_group_id uuid,
  ADD COLUMN counterpart_status text
    CHECK (counterpart_status IS NULL OR counterpart_status = ANY (ARRAY['available','reserved','in_production','on_hold','incoming']));

-- Backfill quantity_before for existing rows
UPDATE public.inventory_movements SET quantity_before = quantity_after - quantity_change;
ALTER TABLE public.inventory_movements ALTER COLUMN quantity_before SET NOT NULL;

-- Extend movement_type to support status-aware manual actions
ALTER TABLE public.inventory_movements DROP CONSTRAINT inventory_movements_movement_type_check;
ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_movement_type_check
  CHECK (movement_type = ANY (ARRAY[
    'initial_sync','incoming','sale','adjustment','manual_adjustment','order',
    'status_transfer','status_adjustment'
  ]));
```

- `status_transfer` — used for the two-row pattern below (moving stock between two named statuses)
- `status_adjustment` — used for single-bucket changes with no counterpart (only valid for `status = 'incoming'`, since Incoming isn't drawn from another bucket)
- All existing rows and existing writers (`sale`, `order`, `adjustment`, `manual_adjustment`, `initial_sync`) implicitly mean `status = 'available'` — the default covers this, no data rewrite needed beyond the backfill above.
- `transfer_group_id` links the two rows of a transfer. Index it: `CREATE INDEX ON inventory_movements (transfer_group_id) WHERE transfer_group_id IS NOT NULL;`

---

## RPCs

### `transfer_stock_status(p_variant_id, p_store_id, p_from_status, p_to_status, p_quantity, p_note)`

Moves quantity from one status bucket to another. Two linked movement rows, one transaction:

1. Lock/read the `inventory_levels` row.
2. Validate `p_from_status` column has `>= p_quantity`.
3. Insert movement row A: `status = p_from_status`, `quantity_change = -p_quantity`, `counterpart_status = p_to_status`, shared `transfer_group_id`.
4. Insert movement row B: `status = p_to_status`, `quantity_change = +p_quantity`, `counterpart_status = p_from_status`, same `transfer_group_id`.
5. Update both corresponding `*_qty` columns on `inventory_levels`.
6. Return the updated `inventory_levels` row.

This is the only path for moving stock between Available / Reserved / In Production / On Hold in this phase — surfaced in the UI as "Move Stock Between Statuses."

### `adjust_incoming_qty(p_variant_id, p_store_id, p_quantity_change, p_note)`

Simple add/remove on `incoming_qty` only — no counterpart, since incoming stock isn't drawn from another bucket yet (receiving logic is a future phase). Single movement row: `movement_type = 'status_adjustment'`, `status = 'incoming'`.

### Extend `adjust_stock()` (read its current body first — see Preflight)

Add a movement row with `status = 'available'` alongside whatever it already writes to `in_stock`, and update `available_qty` in the same transaction. This keeps `available_qty` synced through the one function that legitimately changes stock today, without adding a separate trigger. Same treatment for `confirm_order()` if it writes to `inventory_levels` directly.

**Also:** both functions' movement inserts must now populate the new `quantity_before` column (the `in_stock`/`available_qty` value prior to this change) — it becomes `NOT NULL` after this migration's backfill, so an insert that omits it will fail.

---

## On Hand / Available to Sell / Projected — centralize these

Create a shared helper (e.g. `lib/inventory/calculations.ts`), pure functions, no I/O:

```ts
getOnHand(row)        = row.available_qty + row.reserved_qty + row.in_production_qty + row.on_hold_qty
getAvailableToSell(row) = row.available_qty
getProjectedStock(row)  = row.available_qty + row.incoming_qty
```

Note: a `status_transfer` never changes On Hand (it just moves quantity between two buckets that are both counted in the sum) — that invariant is a good basis for a unit test.

---

## UI changes

- **Inventory Monitoring table** (per variant/SKU row): replace the Quantity column with `Available | Reserved | In Production | On Hold | Incoming | On Hand | Projected`. Badge colors: Available green, Reserved blue, In Production purple, On Hold orange, Incoming yellow.
- **Inventory Summary card** (per variant detail page, above movement history): same 7 values for that variant.
- **Movement history**: now shows `status`, `quantity_before → quantity_after`, and — for transfers — the counterpart status (e.g. "Reserved: 0 → 20 (from Available)").
- **New action: "Move Stock Between Statuses"** — from/to status pickers, quantity, note. Calls `transfer_stock_status`.
- **New action: adjust Incoming** — simple +/- with note. Calls `adjust_incoming_qty`.
- Scope status columns to rows where the parent item has `track_stock = true`, consistent with how `low_stock_threshold` is already scoped.
- Per project convention: new render-function table columns must live in a `"use client"` `*-table.tsx` wrapper, never inline in a server `page.tsx`. Per `AGENTS.md`, check `node_modules/next/dist/docs/` for current API conventions before writing new UI code — this Next.js version has breaking changes vs. training data.

---

## Deliverables checklist

1. Migration `0026_inventory_status_foundation` (both tables, backfills, constraint update)
2. `transfer_stock_status()` and `adjust_incoming_qty()` RPCs
3. `adjust_stock()` (and `confirm_order()` if applicable) extended to write `status='available'` movements
4. Regenerated TypeScript types
5. Shared calculation helper + unit tests (including the On Hand invariant under transfers)
6. Inventory Monitoring table + Summary card updated
7. Movement history updated to show status + before/after + counterpart
8. "Move Stock Between Statuses" and "Adjust Incoming" UI actions
9. `PROGRESS-INVENTORY.md` created with `INV-` prefixed tasks, following the `PROGRESS-ITEMS.md` / `PROGRESS-ACCOUNTING.md` convention, including this Preflight section verbatim
