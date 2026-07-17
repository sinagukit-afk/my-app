# FIFO Inventory Tracking — Kickoff

> **Status: design finalized 2026-07-17, all open decisions resolved with
> Sinag — awaiting go-ahead to start FIFO-1.** Once building starts, work is
> tracked in a new `PROGRESS-FIFO.md` (`FIFO-` prefixed tasks), same
> convention as `PROGRESS-INVENTORY.md`'s `INV-` tasks. This file then gets
> archived to `docs/archive/`, same treatment as
> `Inventory-Status-Phase1-Kickoff.md`.

## Scope, as confirmed with Sinag (2026-07-17)

1. **Which stock:** purchased items only — anything received via Purchase
   Order receiving or Manual Incoming. Not finished/manufactured goods (no
   lot is created when a Production Order completes).
2. **Granularity:** batch/lot level (one record per receiving event), not
   individual unit/serial tracking.
3. **Enforcement:** FIFO is enforced — shipping, production consumption, and
   stock-outs always draw from the oldest open batch first, not just
   tracked passively.
4. **Costing:** traceability only. This does **not** change how COGS/journal
   entries are valued — `unit_cost` on a lot is for display/reference only,
   the existing Accounting costing logic is untouched.
5. **Follow-up (2026-07-17):** positive manual stock adjustments (and an
   item's initial on-hand quantity at creation) must **not** be left
   untracked — they get a real lot too, same as a PO/Manual Incoming
   receipt, so nothing "goes hanging." See the revised `adjust_stock()`
   section below (this replaces the original Decision A, which had
   proposed leaving positive deltas lot-blind).

## Preflight (mandatory — do this before writing any migration)

Everything below was verified live against the linked Supabase project on
2026-07-17. Re-verify anything that looks stale before trusting it — this
project's docs have been caught out of sync with the live system before (see
`erp-supabase` skill's Preflight section).

1. **No lot/batch concept exists anywhere today** — confirmed via
   `information_schema` (no `lot`/`batch` tables) and a full-repo grep for
   `FIFO|lot_number|batch_number` (zero hits). This is greenfield.
2. **`incoming_items` is the single receiving ledger for both paths.**
   `receive_purchase_order()` (PO receiving) and the Manual Incoming form
   both insert a row into `incoming_items` (`purchase_order_id` set vs.
   null) — neither touches `inventory_levels` directly. The
   `apply_incoming_item_inventory_movement()` trigger fires on that insert
   and is the **only** place that bumps `inventory_levels.available_qty`
   and inserts the first `inventory_movements` row (`movement_type =
   'incoming'`, `status = 'available'`). One row per receiving event
   already exists with a real `date_received` and a human-facing `SRI-...`
   reference number (`set_incoming_item_reference`) — this is already
   lot-shaped. **Decision: `incoming_items` rows become the lots. No new
   `inventory_lots` table.**
3. **Two chokepoints cover every consuming/moving path.** Traced every
   caller in `pg_proc` (`prosrc ilike '%deduct_stock_out(%'` /
   `'%transfer_stock_status(%'`):
   - `deduct_stock_out()` is the **only** function that permanently removes
     quantity from a bucket (as opposed to moving it between buckets). Its
     only two callers are `_deduct_shipment_stock()` (shipment) and
     `release_to_scrap()` (scrap write-off) — both call it, neither
     duplicates its logic.
   - `transfer_stock_status()` is the **only** function that moves quantity
     between `available`/`reserved`/`in_production`/`on_hold`. Its callers:
     `start_production`, `cancel_production_order`, `cancel_order`,
     `adjust_order_items`, `create_order`, `convert_quote_to_order`,
     `override_reserved_qty` — seven call sites, all just move buckets.
   - **This means only these two functions need real FIFO rewrites.**
     Every other stock-affecting RPC in the app (7+ of them) inherits
     correct FIFO/lot behavior automatically by calling through one of
     these two, with zero changes to their own bodies. This is a much
     smaller blast radius than it first looked.
4. **`adjust_stock()` is a separate, un-dated path — today.** Manual +/-
   corrections (`adjust_stock`) and an item's initial on-hand quantity at
   creation time (`upsert_item` → `adjust_stock`, create-only) both bump
   `available_qty` directly with **no `incoming_items` row and no lot**.
   Per the 2026-07-17 follow-up (scope #5), positive deltas are brought
   into the lot system rather than left hanging — see the `adjust_stock()`
   subsection under RPC changes. Negative deltas still need an ordering
   rule for when a variant has a mix of lot-tracked and untracked stock in
   the same bucket (pre-feature history, or the rare case lots run out) —
   see Decision A.
5. **`incoming_items.source` is free text, not a checked enum**, and only
   loosely governed: `apply_incoming_item_inventory_movement()`'s
   `business_events` insert branches on it (`= 'purchase_order'` →
   `purchase_received`, anything else → `manual_incoming`). Live values
   today: `purchase_order` (26), `manual` (6), `online` (1), `supplier`
   (1), `walk-in` (1) — all free-typed, no CHECK constraint enforces this.
   Introducing a new source value for adjustment-sourced lots needs a third
   branch added here (see below), or it will get silently misclassified as
   `manual_incoming` in `business_events` — a real regression for anything
   downstream keyed on that event type (Accounting's rule engine reads
   `business_events`, per `[[project_expense_treatment_engine]]`-style
   dispatch). `payment_status` **is** CHECK-constrained
   (`unpaid`/`partial`/`paid`); an adjustment-sourced lot isn't a payable,
   so it should insert as `'paid'` to stay out of unpaid supplier-payment
   lists. `status` has no CHECK constraint, defaults `'received'` — fine
   as-is.
6. **Composite/manufactured items never carry their own stock ledger.**
   `_deduct_shipment_stock()` expands a shipped item through
   `item_components`: if it has components (i.e. it's manufactured), the
   **components'** stock is deducted, not the finished item's. If it has no
   components (a plain purchased/resold item), it deducts itself directly.
   Raw-material components sit in the `in_production` bucket from
   `start_production()` onward and are only actually decremented
   (`deduct_stock_out`) at shipment time — confirmed by
   `_deduct_shipment_stock`'s `v_from_status` logic and consistent with
   `[[project_inv17_shipment_bucket_fix]]`. **This confirms FIFO on raw
   materials is meaningful all the way through production** — a raw
   material lot's identity survives from receipt through
   reserve→in_production→shipped-out.
7. **Scale check:** 35 `incoming_items` rows today (26 PO-sourced, 9
   manual), across 15 distinct variants, 969 `inventory_movements` rows, 1
   active store. Small — backfill/testing is cheap either way.
8. Latest migration is `finpur_21_journal_po_payment`. No local
   `supabase/migrations` folder — apply via the Supabase MCP
   `apply_migration` tool directly, per the `erp-supabase` skill.

## Objective

Give every unit of purchased/received stock a durable batch identity from
the moment it's received (`incoming_items` row) through every bucket it
passes through (`available` → `reserved` → `in_production` → `on_hold`)
to the moment it's permanently consumed (shipped to a customer, or scrapped)
— enforcing that the oldest open batch is always drawn from first. End
result: open any receiving record (`SRI-...`) and see, at a glance, how much
of that batch is still on hand (broken down by bucket) versus already
shipped, and to which order(s).

## Non-goals (explicit — do not implement)

- No `inventory_lots` table — `incoming_items` **is** the lot.
- No lot/batch identity for manufactured/finished goods (per scope #1).
- No individual unit/serial tracking (per scope #2).
- No change to COGS valuation or journal entry generation (per scope #4) —
  `unit_cost`/`total_price` already exist on `incoming_items` and are
  purely carried through for display, not fed into any new costing math.
- No change to `adjust_stock()`'s authorization or validation. Its
  `business_events` emission is preserved in effect (still
  `inventory_adjustment_gain`/`inventory_adjustment_loss`) even though the
  positive-delta path now also routes through `incoming_items` — see the
  `adjust_stock()` subsection under RPC changes for how classification is
  kept correct.
- No multi-store lot allocation logic beyond what already exists (1 active
  store today; the design stays store-scoped like everything else in this
  schema, not store-blind).

---

## Schema changes

### `incoming_items` — add per-bucket remaining-quantity columns

Mirrors the four held buckets on `inventory_levels`, scoped to this one lot.
`quantity` (already exists) stays the original received amount, untouched,
as the historical record.

```sql
ALTER TABLE public.incoming_items
  ADD COLUMN lot_available_qty     numeric NOT NULL DEFAULT 0 CHECK (lot_available_qty >= 0),
  ADD COLUMN lot_reserved_qty      numeric NOT NULL DEFAULT 0 CHECK (lot_reserved_qty >= 0),
  ADD COLUMN lot_in_production_qty numeric NOT NULL DEFAULT 0 CHECK (lot_in_production_qty >= 0),
  ADD COLUMN lot_on_hold_qty       numeric NOT NULL DEFAULT 0 CHECK (lot_on_hold_qty >= 0);

-- A lot's "still in the store" total = sum of the 4 columns above.
-- A lot's "already shipped/scrapped" total = quantity - that sum.
```

Per Decision B below, the 35 existing rows are left at the `DEFAULT 0`
above — no backfill statement needed, this `ALTER TABLE` is the whole
migration for this part.

### `inventory_movements` — add `lot_id`

```sql
ALTER TABLE public.inventory_movements
  ADD COLUMN lot_id uuid REFERENCES public.incoming_items(id);

CREATE INDEX ON public.inventory_movements (lot_id) WHERE lot_id IS NOT NULL;
```

Nullable — a movement with `lot_id IS NULL` means untracked stock (manual
adjustment, pre-feature history, or the "untracked remainder" case in Open
Decision A). Every movement row still means exactly what it means today;
this is purely additive provenance.

### FIFO consumption helper

A single `plpgsql` helper used by both rewritten chokepoints, so the
oldest-first logic exists in exactly one place:

```sql
-- Conceptual signature; returns one row per lot drawn from.
create function public._fifo_consume_lots(
  p_variant_id uuid, p_store_id uuid, p_status text, p_quantity numeric
) returns table(lot_id uuid, qty_taken numeric, lot_col text)
```

Given a variant/store/bucket/quantity: locks and iterates open lots for
that variant+store (join `incoming_items` on `variant_id`/`store_id`,
`lot_<status>_qty > 0`) ordered by `date_received ASC, created_at ASC`
(`FOR UPDATE`), taking `min(remaining, still_needed)` from each until the
requested quantity is satisfied or lots run out. If lots run out before the
quantity is satisfied, the remainder is drawn "untracked" (`lot_id = NULL`)
— see Decision A for the ordering of tracked-vs-untracked stock.

---

## RPC changes

### `apply_incoming_item_inventory_movement()` (trigger on `incoming_items` insert)

After the existing `inventory_levels` upsert and `inventory_movements`
insert, also set `NEW`'s own `lot_available_qty = NEW.quantity` (the batch
starts fully available) and stamp `lot_id = NEW.id` on the movement row it
inserts. **Also:** add a third branch to this function's `business_events`
insert — today it's `new.source = 'purchase_order' ? 'purchase_received' :
'manual_incoming'`, a binary check. Once `adjust_stock()` starts inserting
`incoming_items` rows for positive deltas (below) with
`source = 'inventory_adjustment'`, that binary check would silently
misclassify them as `manual_incoming`. Needs to become a three-way branch:
`purchase_order` → `purchase_received`, `inventory_adjustment` →
`inventory_adjustment_gain` (matching what `adjust_stock()` already emits
today for positive deltas — no reclassification, just preserving it),
everything else → `manual_incoming`.

### `transfer_stock_status(p_variant_id, p_store_id, p_from_status, p_to_status, p_quantity, p_note)`

Currently: one `inventory_levels` row read/write, two linked movement rows.
Rewritten: call `_fifo_consume_lots(..., p_from_status, p_quantity)`, then
for **each** lot slice returned — decrement that lot's `lot_<from>_qty`,
increment its `lot_<to>_qty`, and insert the same two-row
(`transfer_group_id` + `counterpart_status`) movement pattern as today, but
once per lot slice, each stamped with that lot's `lot_id`. A transfer that
spans 2 lots now produces 4 movement rows instead of 2 — this is the
intended, correct trace granularity. `inventory_levels` totals update
exactly as they do today (sum across whatever lots were touched); no
change to its own columns or the function's external contract.

Because every held-bucket transition in this app already funnels through
this one function (start production, cancel/release, hold, reserve — see
Preflight #3), **this single rewrite is what makes cancellation/release
automatically lot-accurate** — a release from `in_production` back to
`available` FIFO-picks from whichever lots currently hold `in_production`
quantity; it does not need to "remember" which lot a reservation originally
came from. No changes needed in `start_production`, `cancel_production_order`,
`cancel_order`, `adjust_order_items`, `create_order`,
`convert_quote_to_order`, or `override_reserved_qty` themselves.

### `deduct_stock_out(p_variant_id, p_store_id, p_quantity, p_note, p_from_status)`

Same pattern: call `_fifo_consume_lots(..., v_from_status, p_quantity)`,
loop the returned slices, decrement each lot's bucket column, insert one
`stock_out` movement row per slice (stamped `lot_id`). `inventory_levels`
update unchanged. `_deduct_shipment_stock()` and `release_to_scrap()` need
**no changes** — they call this function and inherit FIFO for free.

### `adjust_stock(p_variant_id, p_qty_delta, p_reason, p_store_id, p_note)`

Splits into two genuinely different paths — **positive and negative deltas
can no longer share one code path**, because only one of them creates a lot.

**Positive delta (`p_qty_delta > 0`):** instead of writing `inventory_levels`
and `inventory_movements` directly like it does today, **insert a row into
`incoming_items`** (`source = 'inventory_adjustment'`, `purchase_order_id =
NULL`, `supplier_id = NULL`, `quantity = p_qty_delta`, `unit_price =
item_variants.cost` (fallback `0`, display-only per the costing non-goal),
`date_received = current_date`, `payment_status = 'paid'` (not a payable),
`notes = p_reason`/`p_note`) and let the existing
`apply_incoming_item_inventory_movement()` trigger do the rest — same as
any other receipt: it upserts `inventory_levels`, inserts the
`inventory_movements` row (now `movement_type = 'incoming'`, correctly
lot-stamped), and inserts the `business_events` row (now
`inventory_adjustment_gain` via the new third branch above — same
classification as today, not a change). **`adjust_stock()` itself must not
also perform its own direct `inventory_levels`/`inventory_movements`/
`business_events` writes for this branch** — that would double-count
against the trigger, exactly the failure mode
the "never write `inventory_levels` outside an RPC or the one incoming-item
trigger" rule in the `erp-supabase` skill exists to prevent. After the
insert, re-query the movement row the trigger produced (match on
`source_reference_id = <new incoming_items.id>::text`, same lookup pattern
`release_to_scrap()` already uses) to return it, preserving `adjust_stock`'s
existing `RETURNS inventory_movements` contract.

One side effect worth flagging explicitly, not hiding: this also applies to
an item's **initial on-hand quantity at creation** (`upsert_item` →
`adjust_stock`, create-only) — a brand-new item's starting stock becomes a
real lot too, dated at creation. This seems like the right call (an opening
balance genuinely is a receipt), but it means every new item with initial
stock will show up with a `SRI-...` reference in the Batches UI. Flag if
that's not wanted.

**Negative delta (`p_qty_delta < 0`):** stays a direct write (no
`incoming_items` row for a decrease), but the flat `available_qty -=
|delta|` update is replaced with `_fifo_consume_lots(..., 'available',
|delta|)`, decrementing whichever lot(s) it draws from and inserting one
`manual_adjustment` movement row per lot slice touched (falling back to
`lot_id = NULL` once tracked lots are exhausted — Decision A below).
`business_events` emission is unchanged in shape (one `inventory_adjustment_loss`
row per `adjust_stock()` call, referencing the last movement row inserted —
same "one event per logical action even if it spans multiple movement rows"
convention `_deduct_shipment_stock()` already uses for its own multi-component loop).

---

## Decisions (resolved with Sinag, 2026-07-17)

**A. When a bucket has both lot-tracked and untracked stock, which goes
first? → Untracked stock is treated as older than any dated lot and is
consumed first.** Untracked stock can still exist even after the
`adjust_stock()` change above — any `inventory_levels` quantity that
predates this feature shipping (old `adjust_stock`/`initial_sync` deltas
from before FIFO-4 lands) has no lot and never will, since lots are only
created going forward, not retrofitted onto old movements (this is
distinct from Decision B below, which is about the 35 existing *receiving*
rows specifically — this is about old *adjustment* history, which has no
receiving row to retrofit at all). So a variant can permanently have some
untracked stock sitting alongside dated lots; the FIFO helper treats
untracked as the oldest possible "lot" and drains it first, keeping each
dated batch's remaining balance accurate for "is this batch still here."

**B. Backfill for the 35 existing `incoming_items` rows → leave at zero,
no backfill.** The 4 new lot columns default to `0` and nothing rewrites
the 35 existing rows — a fully additive migration, consistent with this
project's migration convention (`erp-supabase` skill: "keep migrations
additive wherever possible"). Current on-hand stock for those 15 variants
becomes untracked stock going forward, governed by Decision A above (drained
first). No reconstruction attempted — there was no way to know, after the
fact, how much of each historical batch had already shipped anyway.

**C. Batch identifier in the UI → reuse the existing `SRI-...` receiving
reference.** No new numbering scheme. The "Batches" section and trace
drill-in (below) both key off `incoming_items.reference`.

---

## UI changes

- **SKU monitoring detail page** (`app/dashboard/inventory/monitoring/[sku]/page.tsx`)
  gets a new "Batches" section: one row per `incoming_items` lot for that
  variant — `SRI-...` reference, Received Date, Qty Received, Available /
  Reserved / In Production / On Hold / Shipped columns (last one =
  `quantity` minus the sum of the four `lot_*_qty` columns).
- **Batch trace drill-in**: clicking a batch row shows every
  `inventory_movements` row with that `lot_id`, in order — received →
  status moves → final shipment/scrap, each with its `source_reference_id`
  linked where resolvable (order/shipment number). This is the direct
  answer to "is this received item still in the store or already shipped
  to a customer."
- Per `AGENTS.md`: check `node_modules/next/dist/docs/` for current
  API conventions before writing new UI code. Per
  `[[feedback_datatable_columns_client_boundary]]`: any table column with a
  render function goes in a `"use client"` `*-table.tsx` wrapper, never
  inline in the server `page.tsx`.

---

## Deliverables checklist (draft — becomes `PROGRESS-FIFO.md` once approved)

1. **FIFO-1** — Migration: `incoming_items` +4 lot columns,
   `inventory_movements` +`lot_id`, backfill per Decision B.
2. **FIFO-2** — `_fifo_consume_lots()` helper function.
3. **FIFO-3** — Rewrite `transfer_stock_status()` and `deduct_stock_out()`
   to consume via the helper, per-lot movement rows. Extend
   `apply_incoming_item_inventory_movement()` to stamp the receiving lot
   and add the three-way `business_events` source branch.
4. **FIFO-4** — Rewrite `adjust_stock()`: positive deltas insert into
   `incoming_items` (delegating to the trigger, no parallel writes);
   negative deltas FIFO-decrement via the helper with the untracked-ordering
   rule (Decision A). Verify `upsert_item`'s initial-stock call path
   still works unchanged (it just calls `adjust_stock`, no signature
   change).
5. **FIFO-5** — Regenerate TypeScript types.
6. **FIFO-6** — UI: Batches section + trace drill-in on the SKU monitoring
   detail page.
7. **FIFO-7** — Live verification (see below), `PROGRESS-FIFO.md` written
   up with this Preflight section carried over verbatim.

## Verification plan

Using the Claude admin test account against a throwaway variant:
1. Receive batch A (qty 20, `date_received` = today - 10 days via Manual
   Incoming with a backdated date if the form allows it, else via direct
   SQL against a disposable row).
2. Receive batch B (qty 15, `date_received` = today).
3. Ship a quantity that spans both (e.g. 25) via a real order →
   confirm → (start production if applicable) → shipment flow.
4. Confirm: batch A shows fully shipped (0 remaining across all buckets),
   batch B shows 10 remaining in whichever bucket the order left it in.
5. Cancel/release a partial reservation and confirm it credits back to
   whichever lot currently holds `in_production`/`reserved` quantity (not
   necessarily the lot the reservation "started" from, per the
   `transfer_stock_status` design above) — verify the released amount is
   correct even though lot attribution may shift.
6. Confirm `inventory_levels` aggregate totals match the sum of the
   touched lots' bucket columns at every step (the core cross-check that
   materialization stayed in sync).
7. Clean up: cancel the test order, verify the variant's inventory
   returns to its exact pre-test baseline (same technique as
   `[[project_inv18_start_production_top_up]]`'s verification).
8. **Adjustment-creates-a-lot check:** run a positive `adjust_stock()`
   correction on the test variant, confirm exactly one new `incoming_items`
   row appears (`source = 'inventory_adjustment'`) with exactly one
   `inventory_movements` row and exactly one `business_events` row
   (`inventory_adjustment_gain`) — the double-write failure mode to rule
   out. Then run a negative `adjust_stock()` correction large enough to
   span two lots, confirm both lots' `lot_available_qty` decrement
   correctly and only one `inventory_adjustment_loss` business event is
   emitted.
