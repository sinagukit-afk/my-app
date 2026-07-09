# Inventory Reservation Lifecycle Fixes — Kickoff

> **ARCHIVED (2026-07-09).** Both gaps below (INV-7, INV-8) are fully
> resolved — see `PROGRESS-INVENTORY.md` for the current, authoritative
> build log and live state. Kept here for historical reference only.

Two code-level gaps were found during a full inventory audit on 2026-07-08 (see `PROGRESS-INVENTORY.md` INV-1..6 for the Phase 1 background, and the chat session that produced this doc for the full forensic trace). Both gaps let `reserved_qty` / `in_production_qty` drift away from reality with nothing to catch it. The drift itself was already cleaned up by hand in that session (12 `transfer_stock_status` releases + one `start_production` replay for order `SOD26-0706-0005`) — **this doc is only about closing the two code paths that caused it**, so it doesn't happen again.

Continue numbering under `PROGRESS-INVENTORY.md` as `INV-7` (Gap 1) and `INV-8` (Gap 2), same convention as `INV-1..6`.

---

## Preflight (mandatory — do this before writing any code)

1. **Do not trust this doc's paraphrase of current function bodies.** Re-read the live SQL via `Supabase:execute_sql` against `pg_get_functiondef` for: `adjust_order_items()`, `start_production()`, `create_shipment()`, `update_shipment()`, `_deduct_shipment_stock()`, `mark_shipment_shipped()`, `mark_shipment_delivered()`, `mark_delivered()`, `transfer_stock_status()`, `deduct_stock_out()`. Code may have changed since 2026-07-08.
2. Confirm the latest migration number via `list_migrations` before writing a new one (these fixes are RPC-body replacements, likely no schema/DDL change needed — confirm that assumption still holds).
3. **Re-run the audit query in the Appendix first.** Confirm it still returns zero rows (i.e., confirm the 2026-07-08 manual cleanup hasn't been undone or re-drifted) before starting. If it returns rows, something new has happened since — investigate that before assuming these two gaps are the only cause.
4. Confirm exactly which RPC actually calls `_deduct_shipment_stock()` — at the time of the audit this was inferred to be `create_shipment()` (deduction happens at shipment-creation time, not at a later "mark shipped" step) but was not double-checked against the live function body. Get this right before designing Gap 2's fix — it changes where the validation hook belongs.

---

## Gap 1 — `adjust_order_items()` always assumes committed stock sits in `'reserved'`

### The bug

`adjust_order_items()` is callable while `orders.status` is `confirmed`, `in_production`, `partially_completed`, or `production_completed` (the last one short-circuits to a metadata-only edit — no stock touched). For the other three, on every edit it:

1. Computes each existing line's actual reservation (`order_items.reserved_qty`, expanded through `item_components`).
2. Releases it: `transfer_stock_status(component, store, 'reserved', 'available', qty, ...)` — **hardcoded `'reserved'`**.
3. Re-reserves for the new line list: `transfer_stock_status(component, store, 'available', 'reserved', qty, ...)` — **hardcoded `'reserved'`**.

This is only correct when `status = 'confirmed'`. Once `start_production()` has run, that same committed stock is sitting in `'in_production'`, not `'reserved'`. Editing an order after production has started either raises `"Insufficient reserved quantity"` (if `'reserved'` happens to be empty for that component) or — worse — silently re-reserves the new allocation into `'reserved'` while the order's status still claims `in_production`, leaving the two permanently out of sync. This is exactly what happened to `SOD26-0706-0005`: it was edited at 12:19:43 on 2026-07-06, before ever calling `start_production()`, and the re-reservation landed in `'reserved'`; separately (not seen in this order, but the same code path) editing an order *after* `start_production()` would land the new reservation in `'reserved'` while everything else sits in `'in_production'`.

### Design decision needed (Sinag's call before implementing)

**What should happen when editing line items on an order whose status is `partially_completed`?** At that point some of the order's production has already shipped (partial `shipment_items` coverage exists), so the "release everything, re-reserve everything" dance can't safely assume the full `reserved_qty` is still sitting in one bucket — some of it is already gone.

- **Option A (recommended, smaller scope):** Make the release/reserve bucket **status-aware** for `confirmed` and `in_production` only (see implementation below). For `partially_completed`, extend the existing `production_completed` short-circuit — treat it as metadata-only too (customer/note/shipping fields only; line items become frozen once *any* shipment has posted against the order, not just once production fully completes). This is a one-line change to the existing status check and avoids the harder problem of computing a partial release.
- **Option B (more general, more work):** Compute the actual live bucket split per component before releasing — query how much of this order's committed quantity is currently in `'reserved'` vs `'in_production'` (would need a new way to attribute movements back to a specific order, since `inventory_movements.note` is free text today, not a structured FK) and release proportionally. Only worth doing if Option A's restriction turns out to block a real workflow Sinag needs.

Default to Option A unless told otherwise — confirm with Sinag at the start of the session if there's any known need to edit line items on a partially-shipped order.

### Implementation (Option A)

1. Add a small helper (inline `case` or a `plpgsql` local) at the top of `adjust_order_items()`:
   ```sql
   v_bucket := case when v_order.status = 'confirmed' then 'reserved' else 'in_production' end;
   ```
   (only reachable for `confirmed`/`in_production` — `partially_completed` and `production_completed` both go metadata-only, see step 2).
2. Widen the existing `production_completed` short-circuit condition to `status in ('partially_completed', 'production_completed')`.
3. Replace both hardcoded `'reserved'` literals in the release loop and the reservation loop with `v_bucket`.
4. Note in a comment: this assumes an order's entire committed quantity for a component lives in exactly one bucket at a time (true today because `start_production()` moves everything atomically in one call, with no partial-per-line production start). If partial production starts are ever introduced, this assumption breaks and needs Option B.

### Test plan

- Create an order (status `confirmed`), edit it — confirm reservation still lands in `'reserved'` (no regression).
- Create an order, run `start_production()`, then edit its line items (change a quantity) — confirm the release comes from `'in_production'` and the new reservation lands back in `'in_production'`, and the audit query (Appendix) still returns zero rows afterward.
- Attempt to edit line items on a `partially_completed` order — confirm it now takes the metadata-only path (same behavior as `production_completed` today) rather than touching stock.

---

## Gap 2 — Shipments can leave an order's committed stock permanently stranded

### The bug

`_deduct_shipment_stock()` only deducts stock for whatever rows exist in `shipment_items` / `shipment_packaging_items` for that specific shipment — there is no check anywhere that a shipment (or the set of all shipments against an order) actually covers the order's full committed quantity (`order_items.reserved_qty`) before the order is allowed to reach a terminal state (`delivered`). If a shipment is created with a missing line, or with `quantity_shipped` less than what was actually produced, the shortfall's raw materials stay sitting in `'reserved'` or `'in_production'` forever — nothing ever looks at them again. This was the root cause of the historical drift on `SOD26-0701-0001`, `SOD26-0701-0002`, `SOD26-0706-0004`, `SOD26-0706-0006`, and part of `SOD26-0707-0009`.

### Design decision needed (Sinag's call before implementing)

**When an order/shipment is finalized with incomplete coverage, should the system block, or auto-close the gap?**

- **Option A (recommended): block.** Add a check — most naturally in `mark_delivered()` / `mark_shipment_delivered()` (confirm which one is the actual terminal transition per Preflight #4) — that raises an exception if, for any `order_item` on the order, `reserved_qty > sum(shipment_items.quantity_shipped)` (BOM-expanded, matching the audit query's shape). Forces the user to either add the missing shipment line or explicitly deal with the shortfall before the order can close. Fail-fast, no silent assumptions, matches how `adjust_order_items()` already blocks on other invalid states.
- **Option B: auto-close.** On the same trigger point, automatically `deduct_stock_out()` the shortfall with a note like `"Auto-closed on delivery: N units not recorded on any shipment"`. Convenient, no workflow friction, but silently assumes the goods really did ship without a line-item record — which is exactly the assumption that turned out to be wrong for some of the 2026-07-08 cleanup (some of that stock's true history was unrecoverable).
- **Possible hybrid:** Option A as the default path, plus a separate explicit admin-only "force close" action (requires a note) that does what Option B would have done automatically — for legitimate cases like scrap/waste that will never get a shipment line. This mirrors the "Sinag's call required" pattern already used elsewhere in this project (e.g. the `available_qty` negative-clamp decision in `PROGRESS-INVENTORY.md` INV-1).

Default to Option A (block) unless Sinag prefers B or the hybrid — confirm at the start of the session.

### Implementation (Option A)

1. Preflight #4 first — find the actual terminal transition point.
2. Add a query at that point, shaped like the Appendix's `delivered_gap` CTE but scoped to the single order being finalized, and raise a clear exception naming the specific item(s) and shortfall quantity if any `unshipped_qty > 0` remains.
3. Decide whether this check applies only at the *order*-level terminal transition, or also should soft-warn earlier (e.g., when creating a shipment that clearly won't cover the full order) — recommend order-level only for v1, since partial shipments across multiple `order_shipments` rows for one order are a legitimate, existing pattern.

### Test plan

- Create an order, start production, ship a shipment that covers only part of the committed quantity, attempt to mark delivered — confirm it now blocks with a clear message instead of silently succeeding.
- Ship the remainder, mark delivered again — confirm it now succeeds and the audit query still returns zero rows for that order's components.
- Confirm existing fully-covered delivered orders in the current dataset are unaffected (no new exceptions raised for already-correct orders).

---

## Appendix — reusable gap-detection query

Run this before and after each fix to confirm zero drift. It compares live `inventory_levels.reserved_qty` / `in_production_qty` against what currently-open orders (`confirmed` / `in_production` / `partially_completed` / `production_completed`) actually justify, BOM-expanded through `item_components`:

```sql
with reservations as (
  select o.order_number, o.status, oi.variant_id as composite_variant_id, oi.reserved_qty as qty
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.reserved_qty > 0
),
expanded as (
  select r.order_number, r.status, ic.component_variant_id as variant_id, ic.quantity * r.qty as qty
  from reservations r
  join public.item_components ic on ic.composite_variant_id = r.composite_variant_id
  union all
  select r.order_number, r.status, r.composite_variant_id as variant_id, r.qty
  from reservations r
  where not exists (select 1 from public.item_components ic where ic.composite_variant_id = r.composite_variant_id)
),
expected as (
  select e.variant_id,
    sum(e.qty) filter (where e.status = 'confirmed') as expected_reserved,
    sum(e.qty) filter (where e.status in ('in_production','partially_completed','production_completed')) as expected_in_production
  from expanded e
  join public.item_variants v on v.id = e.variant_id
  join public.items i on i.id = v.item_id
  where coalesce(i.track_stock, false) = true
  group by e.variant_id
)
select v.sku, i.name,
  round(il.reserved_qty - coalesce(ex.expected_reserved,0), 4) as gap_reserved,
  round(il.in_production_qty - coalesce(ex.expected_in_production,0), 4) as gap_in_production
from public.inventory_levels il
join public.item_variants v on v.id = il.variant_id
join public.items i on i.id = v.item_id
left join expected ex on ex.variant_id = il.variant_id
where round(il.reserved_qty - coalesce(ex.expected_reserved,0), 4) <> 0
   or round(il.in_production_qty - coalesce(ex.expected_in_production,0), 4) <> 0
order by v.sku;
```

Zero rows = fully reconciled. As of 2026-07-08 (after the manual cleanup) this returns zero rows.

The "unshipped committed quantity per order_item" query (used to find Gap 2's historical instances) is also worth keeping handy for testing:

```sql
select o.order_number, o.status as order_status, oi.id as order_item_id, oi.item_name_snapshot,
  oi.reserved_qty, coalesce(sum(si.quantity_shipped),0) as total_shipped,
  oi.reserved_qty - coalesce(sum(si.quantity_shipped),0) as unshipped_committed_qty
from public.order_items oi
join public.orders o on o.id = oi.order_id
left join public.shipment_items si on si.order_item_id = oi.id
where oi.reserved_qty > 0
group by o.order_number, o.status, oi.id, oi.item_name_snapshot, oi.reserved_qty
having oi.reserved_qty - coalesce(sum(si.quantity_shipped),0) > 0
order by o.order_number;
```

---

## Deliverables checklist

1. Design decisions confirmed with Sinag (Gap 1: Option A vs B; Gap 2: block vs auto-close vs hybrid)
2. `adjust_order_items()` updated: status-aware bucket for release/reserve; `partially_completed` moved to metadata-only path
3. Terminal-transition RPC (per Preflight #4) updated with the coverage-gap check
4. Both test plans executed and passing
5. Appendix audit query re-run, confirmed zero rows
6. `PROGRESS-INVENTORY.md` updated with `INV-7` / `INV-8` entries, following the existing `INV-` convention (what was found, what was decided, what was verified — same structure as `INV-1..6`)
