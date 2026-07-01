# Business Rules

## Inventory

-   Inventory can never become negative.
-   Every inventory change must generate an inventory movement.
-   Inventory mutations occur only through RPC.
-   Never edit inventory_levels directly.

## Suppliers

-   Suppliers use soft delete.
-   Referenced suppliers cannot be hard deleted.

## Purchase Orders

Status transitions are restricted, not a free linear chain:

-   Draft → Sent or Cancelled
-   Sent → Cancelled, or advances to Partial/Received via Receiving
-   Partial → no manual transition; only advances further via Receiving
-   Received → Closed

Line items are only editable while a PO is Draft; item removal additionally requires `quantity_received = 0`.

## Receiving

-   Cannot receive beyond ordered quantity.
-   Receiving creates Incoming Inventory.
-   Receiving updates stock automatically.

## Quotes

-   Editable before confirmation (line items, customer, notes).
-   Editing a quote snapshots the pre-edit `orders` row + items into `activity_logs` (`action: 'quote_edited'`) before applying changes.
-   Confirmation deducts inventory (single-level BOM expansion) and ends quote-style editing.
-   Quote history is retained via the activity_logs snapshot, not a versioned table — no viewer UI exists for it yet (queryable via SQL).

## Orders

Status Flow: Quote → Confirmed → In Production → Completed (+ Cancelled).

-   Confirmed and In Production orders **can be edited** (customer, notes, line items) via the `adjust_order_items` RPC. It diffs old vs. new BOM-expanded quantities per variant, blocks the whole edit if any variant would go short, and posts one `inventory_movements` row per changed variant (negative for a net deduction, positive for a net return).
-   `orders`/`order_items` have **no rollup trigger** (unlike `purchase_orders`). Any code path that changes order line items must explicitly recompute `subtotal`/`total_discount`/`total_money` — it will not happen automatically.

## Security

-   SELECT: any authenticated user
-   INSERT/UPDATE: Admin, Manager, Encoder
-   DELETE: Admin, Manager

RPCs validate permissions internally (don't rely on RLS alone to gate an RPC's effects).

## Soft Delete

Never hard delete business data. Soft-deletable tables use a `deleted_at` timestamp, or an existing `is_active`/`active` flag. If a field must allow reusing a value after "deletion" (e.g. a supplier name), use a partial unique index (`WHERE deleted_at IS NULL`) instead of a plain unique constraint.
