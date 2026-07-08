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

-   Standalone `quotes`/`quote_items` tables (2026-07-06) — not `orders.status = 'quote'`, which was retired.
-   Editable while `open` (line items, customer, notes, discounts/modifiers). Editing a quote snapshots the pre-edit row + items into `activity_logs` (`action: 'quote_edited'`) before applying changes.
-   `convert_quote_to_order()` **reserves** stock (`available_qty` → `reserved_qty`, BOM-expanded via `transfer_stock_status`) rather than deducting `in_stock` — creates a new `orders` row (`status = 'confirmed'`) and copies `quote_items` → `order_items`. Blocks entirely (no partial reserve) if any component would go short.
-   Cancellation requires a reason; `Expired` is computed live off `valid_until` (no cron). Quote history is retained via the activity_logs snapshot, not a versioned table.

## Orders

Status Flow: Confirmed → In Production → (Partially Completed | Production Completed) → delivery orders: Ready for Shipping → Shipped → Delivered; pickup orders: → Delivered directly (+ On Hold, Cancelled in parallel). `completed` was retired as a status value (2026-07-07) — `Delivered` is the single terminal status for both fulfillment methods. Delivery/null-fulfillment orders **skip Production Completed automatically** (PS-13, 2026-07-07): once every Production Order finishes, `recompute_order_status()` advances the order straight to Ready for Shipping with no manual click. Pickup orders still stop at Production Completed and require a manual "Mark Picked Up" click — unchanged.

-   Order creation/edits **reserve** stock (Available → Reserved), never deduct it directly. `start_production()` moves Reserved → In Production per Production Order (see below); `mark_shipment_shipped()` is the only step that actually removes stock (In Production/Available → Out).
-   Confirmed and In Production orders **can be edited** (customer, notes, line items) via the `adjust_order_items` RPC. It diffs old vs. new BOM-expanded quantities per variant, blocks the whole edit if any variant would go short, and posts one `inventory_movements` row per changed variant (negative for a net deduction, positive for a net return).
-   Confirmed orders' Reserved Qty can be manually overridden via `override_reserved_qty()` (admin/manager/encoder) — status-gated to `confirmed` only.
-   `orders`/`order_items` have **no rollup trigger** (unlike `purchase_orders`). Any code path that changes order line items must explicitly recompute `subtotal`/`total_discount`/`total_money` — it will not happen automatically.

## Production Orders

-   `production_orders` groups an order's `order_items` by `(variant, modifier set)` — duplicate SKU+modifier lines within one order **merge into one row** with summed quantity.
-   `production_orders.status` is its own 5-state lifecycle, **distinct from `orders.status`**: `not_started → wip → partially_completed → completed`, plus `cancelled` from any non-terminal state. `start_production()` (admin-only, order-level) creates rows as `not_started` and moves Reserved → In Production stock per BOM-expanded component (only components where `items.track_stock = true` actually move); `start_production_order()` (admin/manager/encoder, per-PO) is a separate button that moves `not_started → wip` with no stock effect (the stock already moved at creation).
-   `production_orders.completed_qty` (PS-12) tracks running progress while `wip`/`partially_completed`, via `add_production_completed_qty()` (admin/manager/encoder) — **strictly additive and non-reversible**: each call adds a positive amount to the running total (capped at `quantity`), auto-flips `wip → partially_completed` on the first successful add, and logs a dated `+N completed on <date> — X of Y total` entry. No stock effect. For composite products, each BOM component's Reserved/Completed is **derived**, not separately tracked: `component_ratio × production_orders.quantity` / `× completed_qty`.
-   `complete_production_order()` (admin-only) marks a Production Order `completed`, stamps `completed_qty = quantity`, and **auto-sets** `completed_qty = quantity` on every `order_items` row it aggregates — this is derived, not hand-entered (retires the old manual Completed Qty field).
-   `cancel_production_order()` (PS-12, admin/manager/encoder) cancels a Production Order from any non-terminal status (`not_started`/`wip`/`partially_completed`): the **uncompleted** portion (`quantity - completed_qty`) releases In Production → Available per BOM-expanded component; the **completed** portion moves In Production → On Hold (parked there — no UI yet to release On Hold stock, a deliberately deferred follow-up). Unlinks the order's `order_items` (clears `production_order_id` and zeroes `reserved_qty`, since the backing stock no longer sits in Reserved or In Production) so those lines are eligible for a future Start Production run. The parent order reverts to `confirmed` if this was its last non-cancelled Production Order; otherwise its status is recomputed from what remains.
-   `recompute_order_status()` derives the order's status from Production Order completion counts (`in_production` / `partially_completed` / `production_completed`), excluding `cancelled` Production Orders from both totals. Since PS-13 (2026-07-07), when all Production Orders finish it goes straight to `ready_for_shipping` for delivery/null-fulfillment orders instead of stopping at `production_completed` — only pickup orders still land on `production_completed` (to await a manual `mark_picked_up()`).

## Shipments

-   `order_shipments` supports **N shipments per order** via `shipment_items` (product lines) and `shipment_packaging_items` (packaging lines) — enables partial shipments, including mixing pickup and delivery on the same order.
-   Fulfillment type is decided **per shipment**, not per order (PS-17) — `order_shipments.fulfillment_type` (`pickup`/`delivery`, default `delivery`) is the single source of truth, chosen via the **Fulfillment Method** dropdown in the Add/Edit Shipment dialog (PS-18; PS-17's implicit toggle was split into an explicit dropdown). `orders.fulfillment_method` still exists but is unused — see `DECISIONS.md` D039 (open decision, not resolved).
-   **Receiver is decided per shipment (PS-18)**, replacing the retired order-level "Ships to customer?" system (`orders.same_as_customer`/`receiver_*`, kept in the schema unused — see D040). For `delivery` shipments, a "Ships to Customer?" toggle (default on) picks one of two conditions: **On** — `order_shipments.receiver_*` is a server-side snapshot of the order's registered customer (`customers.name/phone_number/address_*`), taken at save time; the client cannot override it, and it fails with `'Cannot ship to customer: this order has no registered customer'` if the order is walk-in. **Off** — `receiver_*` holds a manually entered receiver (name required), independent of the customer. `pickup` shipments have no receiver at all — `ships_to_customer` and all `receiver_*` are forced null, and the toggle doesn't apply.
-   `create_shipment()` (admin/encoder) creates a shipment header (`status = 'preparing'`) plus its line items; requires `orders.status IN ('ready_for_shipping', 'shipped')` — shipments can be added incrementally even after the order already has one shipped/picked-up (D039 supersedes D036's stricter "must plan while Ready for Shipping" gate). Courier/tracking/cost/fee are forced null on pickup-type shipments. Creating a shipment has **no stock effect**.
-   `mark_shipment_shipped()` (admin/encoder) is the delivery-type inventory-out step — deducts stock via `deduct_stock_out()`: product lines BOM-expanded (In Production → Out, only the shipped quantity), packaging lines directly (Available → Out, skipped for packaging items that don't track stock). `mark_shipment_delivered()` is the terminal transition for that shipment.
-   `mark_shipment_picked_up()` (admin/encoder) is the pickup-type equivalent — a single atomic step (no separate Shipped/Delivered) that runs the identical BOM-expanded stock-out logic as `mark_shipment_shipped()`, then sets the shipment straight to `delivered`.
-   Shipment numbering: **all shipments use `SSH<YY>-<MMDD>-####`** regardless of fulfillment type (PS-18) — the separate `SSP` prefix for pickup (PS-17/D039) is retired for new shipments; existing `SSP`-numbered rows are left as historical records, not renumbered.
-   Order-level status is derived from all shipments via `recompute_shipping_status()`: `shipped` once any shipment is shipped/picked-up or delivered; `delivered` only once **every** shipment is delivered **and** the order's full line-item quantity has actually been allocated across its shipments (a mixed order with unallocated remaining quantity stays `shipped`, even if every shipment created so far is already delivered).

## Payments

-   `order_payments` is append-only (`amount > 0` check) — there is no edit/delete path, only new rows via `addOrderPayment`. Payment Status is derived, not stored: `Unpaid` (nothing paid) / `Partially Paid` (paid < total) / `Paid` (paid = total) / `Overpaid` (paid > total).
-   `close_order_payment()` (admin/manager/encoder) formally closes an order's payment (`orders.payment_closed_at`/`payment_closed_by`/`payment_close_note`), independent of `orders.status` — closing is a payment-side concept, not a fulfillment one. Rules by bucket: `Unpaid` cannot be closed (nothing to close); `Partially Paid` **requires** a non-blank note (the intended use is writing off a balance after a customer goes unreachable post-shipment); `Paid`/`Overpaid` close freely with an optional note. Closing while `Overpaid` records the excess (`total_paid - total_money`) into `orders.tip_amount` — the overpayment is treated as a customer tip, not a refundable credit. A closed payment cannot be closed again; there is no reopen path (not built — a deliberate scope cut, see `PROGRESS-PRODUCTION-SHIPPING.md` PS-16).
-   The Payment Preview page (`/dashboard/orders/payment/<orderNumber>/preview`) is read-only and print-friendly (same convention as the Quotation view) — no RPC, just a plain query, meant for showing a customer their remaining balance.

## Packaging Materials

-   `categories.category_type` (`product` default | `packaging`) tags which Master Items are packaging.
-   Packaging items never enter Reserved/In Production — their only pre-shipment bucket is Available. `deduct_stock_out()` infers the correct bucket automatically from `category_type`, so callers never need to pass it.

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
