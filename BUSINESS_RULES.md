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

## Customers

-   `customers` is the single BMS profile per person, still pull-synced from Loyverse. `customer_sources` links a customer to any number of external identities (`loyverse` | `facebook` | `instagram` | `manual` | `walkin`) — a new platform is a new `source` value, not a new migration.
-   Manual customer creation (walk-ins/leads) is BMS-only — no push back to Loyverse.
-   Facebook/Instagram matching and sync are not built. `customer_sources.source` accepts those values but nothing writes them yet.

## Orders — Shipping Receiver

-   `same_as_customer` (default `true`) + `receiver_*` fields on `orders` capture who an order actually ships to, snapshotted per-order (same pattern as `order_items.item_name_snapshot`) since the receiver can differ from the paying customer and can change order to order.
-   Check constraint: `receiver_name` is required whenever `same_as_customer = false`.
-   `same_as_customer`, `receiver_*`, and `fulfillment_method` are excluded from any Loyverse push payload — these fields are BMS-only, never synced.
-   Confirmed/In Production orders can only change these fields through the `adjust_order_items` RPC (same path as line-item edits) — a plain table UPDATE on `orders` past `quote` status is admin-only, so encoder/manager edits must go through the RPC.

## Security

-   SELECT: any authenticated user
-   INSERT/UPDATE: Admin, Manager, Encoder
-   DELETE: Admin, Manager

RPCs validate permissions internally (don't rely on RLS alone to gate an RPC's effects).

**Exception — Finance & Accounting tables:** `income`, `expenses`, `accounts`, `journal_entries`, `journal_entry_lines`, `fixed_assets`, and `depreciation_entries` restrict SELECT/INSERT/UPDATE to **admin + manager only** — encoder is excluded from all of them. Financial data is treated as more sensitive than operational data (suppliers, POs, inventory), which is why those allow encoder and this category doesn't. See D016.

## Soft Delete

Never hard delete business data. Soft-deletable tables use a `deleted_at` timestamp, or an existing `is_active`/`active` flag. If a field must allow reusing a value after "deletion" (e.g. a supplier name), use a partial unique index (`WHERE deleted_at IS NULL`) instead of a plain unique constraint.
