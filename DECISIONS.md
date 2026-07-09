# Design Decisions

## D001

Inventory is managed locally. Reason: Loyverse is receipt only.

## D002

Inventory updates only through RPC. Reason: Prevent inventory
corruption.

## D003

Soft delete only. Reason: Preserve audit history. Reusable unique
fields (e.g. supplier name) use a partial unique index (`WHERE
deleted_at IS NULL`) instead of a plain unique constraint, so the
value can be reused after "deletion."

## D004

Server Components fetch data. Reason: Better performance.

## D005

Single-step Purchase Order creation. Reason: Better user experience.

## D006

Quote edits retain history. Reason: Auditability. Implemented as a
pre-edit snapshot into `activity_logs` (`action: 'quote_edited'`),
not a versioned table. No viewer UI yet — queryable via SQL only.

## D007

Confirmed AND In Production order edits reconcile inventory via the
`adjust_order_items` RPC (not just "production edits" — applies to
both statuses). Reason: Inventory integrity. Diffs old vs. new
BOM-expanded quantities per variant and posts one movement per
changed variant; blocks the whole edit on shortfall.

## D008

Manual Loyverse receipt entry. Reason: Automation disabled.

## D009

Reused the existing `admin` role for the Claude Code test account
instead of adding a new `user_role` enum value. Reason: ~25 RLS
policies and 2+ RPCs hardcode `role = 'admin'` / `role IN (...)`; a
new enum value would require auditing all of them for one test
account.

## D010

Purchase order reference numbers (`SPO-<year><mmdd><seq>`) are
system-generated via a `BEFORE INSERT` trigger, not app code.
Reason: keep numbering server-authoritative. Known limitation: the
daily sequence uses a `SELECT COUNT`, which has a small race window
under concurrent same-millisecond inserts — accepted for this app's
low-concurrency usage; revisit with a real sequence/advisory lock if
volume grows.

## D011

`orders`/`order_items` have no rollup trigger (unlike
`purchase_orders`). Reason: not needed until line items became
editable post-creation. Any code path that edits order line items
must explicitly recompute totals — see Business Rules > Orders.

## D012

Purchase order status transitions are restricted, not a free linear
chain: `draft→sent/cancelled`, `sent→cancelled`, `received→closed`;
`partial` only advances via Receiving and has no manual transition.
Reason: conservative status model until a business need for manual
overrides (e.g. force-closing a partial PO) is identified.

## D013

User deactivation uses Supabase Auth's `banned_until` (via the admin
API), not a new `profiles` column. Reason: avoids a schema change for
something Auth already models natively; keeps the Do-Not-add-a-role
constraint intact since it only touches the Auth user, not the
`user_role` enum.

## D014

The Roles screen's Permission Matrix is the same artifact as the
"Permission UI" deliverable, not a second screen. Reason:
`NEXT_PHASE.md` explicitly asked for the same read-only capability
matrix in both places; two separate but nearly-identical read-only
views would be pure duplication.

## D015

Three seeded demo accounts (`manager@sinagukit.demo`,
`cashier@sinagukit.demo`, `viewer@sinagukit.demo`) had `NULL` in
several Auth-internal columns (`confirmation_token`, `recovery_token`,
`email_change_token_new`, `email_change`), which broke GoTrue's admin
API (`listUsers`/`updateUserById`) for those 3 users specifically.
Fixed via two scoped `UPDATE ... SET <col> = ''` statements (asked and
approved before each), not a migration — this corrects existing row
values it does not change schema. Reason: empty string is GoTrue's own
default for "no pending token"; these columns are never displayed.

## D016

`income`/`expenses` (Phase 20) are scoped to **admin/manager only**
for SELECT, INSERT, UPDATE, and soft-delete — deviating from the
general "SELECT = any authenticated" convention. Reason: financial
records are more sensitive than typical operational data (per
`NEXT_PHASE.md`'s explicit access note). Gated at both RLS and the
sidebar nav (`components/layout/app-shell.tsx`'s `NavGroup.roles`
field, filtered against `userRole` in `AppShell`) and again at the
page level (`hasAccess` check rendering an access-restricted message
for other roles).

## D017

Discovered while building Phase 20: a table's SELECT RLS policy must
**not** filter on the soft-delete column (e.g. `deleted_at IS NULL`)
for any role that also needs to soft-delete rows via a plain UPDATE.
PostgreSQL requires the row resulting from an UPDATE to satisfy the
table's SELECT policy in addition to the UPDATE policy's own `WITH
CHECK` — so setting `deleted_at` makes the row fail a SELECT policy
that requires `deleted_at IS NULL`, and the UPDATE itself is rejected
with "new row violates row-level security policy," even though the
UPDATE policy's own `WITH CHECK` never references `deleted_at`.
`income`/`expenses`'s SELECT policies were fixed to check role only
(no `deleted_at` filter), matching the existing `items`/`categories`
pattern where the privileged-role SELECT policy also omits the
`deleted_at` filter; `deleted_at IS NULL` is instead enforced at the
query level in `page.tsx` (`.is('deleted_at', null)`). Revisit if a
soft-deletable table's SELECT policy is ever written to filter
`deleted_at` for a role that also needs UPDATE-based soft delete on
that same table.

## D018

Phase 26: widened `orders_encoder_update_own_quote`'s `with_check`
to allow `quote` → `cancelled` (previously only `quote` → `confirmed`),
so an encoder/manager can cancel their own quote without an admin.
Confirmed with the user first, per `NEXT_PHASE.md`'s explicit gate on
this phase (it existed as a flagged possible gap from Phase 14, not
a confirmed requirement, until this approval). Scoped to exactly this
one transition: the `using` clause (still requires `status = 'quote'`
at update time, so confirmed/in_production orders remain admin-only
to cancel) and the sibling `order_items_encoder_update_own_quote`
policy were both left untouched, since cancellation only writes
`orders.status`. A dedicated `encoder`-role test account
(`claude-code-encoder@sinagukit.internal`) was created to verify this,
since the existing Claude test account reuses `admin` and can't
exercise encoder-only RLS restrictions.

## D019

`activity_logs`' INSERT policy (`service_can_insert_logs`, from the
original `create_activity_logs` migration) had `WITH CHECK (true)` for
role `public` — despite its name, it was never restricted to a
service-role client. Found during a general consistency check
(2026-07-02): the only app-code writer, `quotes/actions.ts`'s
quote-edit snapshot, inserts via the calling user's own session (not
service-role), and `user_id` is client-supplied — so any authenticated
request could insert an `activity_logs` row with an arbitrary/spoofed
`user_id`, undermining the audit trail Administration > Activity Logs
displays as a source of truth. Fixed via migration
`0018_fix_activity_logs_insert_policy`: dropped
`service_can_insert_logs`, replaced with `users_insert_own_logs`
(`WITH CHECK (user_id = auth.uid())`), matching the `created_by =
auth.uid()` pattern already used elsewhere (e.g.
`orders_encoder_update_own_quote`). Policy-only change, no schema or
data affected; the one real write path is unaffected since it already
used the caller's own id.

## D020

Supersedes D001/D008 for items specifically: starting with the Item
List feature (`PROGRESS-ITEMS.md`), the BMS becomes the source of
truth for item/variant data going forward. Create/Edit in the BMS
pushes to Loyverse via API (ITEM-2); pull-sync switches from polling
to webhook-driven (or an `updated_at`-newer guard if Loyverse has no
outbound webhook support) to avoid a poll cycle clobbering a
just-pushed item. Reason: confirmed with Sinag 2026-07-03. D001/D008
still stand for everything else not covered by this feature (e.g.
receipts remain manual/receipt-only) — this is a scoped reversal, not
a blanket re-enable of Loyverse automation. The push-sync n8n workflow
is built as an addition to the existing `Loyverse Sync - Modifiers &
Discounts` workflow (id `F6CfXnxji98Y75JJ`), not a new standalone one
— confirmed with Sinag, despite that workflow's existing inactive
status and known unfixed upsert-node bug (see `bms-supabase` skill).

**Correction 2026-07-03 (ITEM-2 build):** Loyverse's API does support
outbound webhooks (`ITEM_UPDATED` event, `/v1/webhooks`, live since
Jan 2021) — the "or ... if Loyverse has no outbound webhook support"
framing above was wrong to assume without checking. ITEM-2 still
shipped the `updated_at`-newer guard (not full webhook-driven pull),
since registering a Loyverse webhook subscription is a separate,
externally-dependent piece of work (needs Sinag in the Loyverse
dashboard) that fully satisfies the race-condition requirement either
way. Revisit full webhook migration as a fast-follow only if the
15-minute poll window becomes an actual problem.

**Closed out (ITEM-7, 2026-07-03):** push-sync is live end-to-end —
`Loyverse-Supabase` (`F6CfXnxji98Y75JJ`) is active/published, and
ITEM-6/6.5/6.6 live-tested create, update, modifier-assignment,
composite, and minimum-stock-threshold pushes against the real
Loyverse catalog. Two standing test fixtures intentionally remain in
both Loyverse and Supabase per Sinag's call (see `PROGRESS-ITEMS.md`).

## D021

Composite items use a simple auto-decompose-at-sale model only — no
Production/Disassembly workflow. Reason: that's Loyverse's Advanced
Inventory feature, and the store isn't subscribed to it. Consequences
locked in during the Item List build (`PROGRESS-ITEMS.md`):
`track_stock` is forced `false` server-side for composite items
regardless of form input (enforced in `upsert_item`, not just hidden
in the UI); `use_production` is still pulled from Loyverse and stored
(informational, read-only), but no BMS logic acts on it; component
nesting is capped at 3 levels with recursive-CTE cycle/depth
validation in `upsert_item`. Revisit only if the Advanced Inventory
subscription is ever purchased.

## D022

Widened `customers`/`customer_sources` RLS (migration
`0024_customers_manager_rls`, Customer Management build,
`PROGRESS-CUSTOMERS.md` CUST-1) to the general admin/manager/encoder
convention for SELECT/INSERT/UPDATE. Reason: found during preflight
that `customers` SELECT was admin+encoder only (no manager) and
INSERT/UPDATE/DELETE was admin-only (no manager, no encoder) —
contradicting both the feature brief's own stated intent
("encoder read/insert/update") and this project's documented general
convention. Left as-is, this would have kept manager unable to see
customer names anywhere in the app (including the pre-existing
Quotes/Order List `customers(name)` embeds — a latent bug exposed,
not introduced, by this feature) and blocked encoder from using
Add/Edit Customer at all. Confirmed with Sinag before changing RLS.
DELETE stays admin-only, unchanged, via the existing `Admin full
access` `ALL` policies on both tables.

## D023

Extended the `adjust_order_items` RPC (migration
`0025_adjust_order_items_receiver_fields`) with 9 new trailing
optional parameters, rather than adding a second RPC or a plain
table update, to let Order List edits persist
`same_as_customer`/`receiver_*`/`fulfillment_method` (Customer
Management + Shipping build, `PROGRESS-CUSTOMERS.md` CUST-4). Reason:
`adjust_order_items` is the only write path into a confirmed/
in_production `orders` row available to encoder/manager — a direct
table UPDATE past `quote` status is admin-only per
`orders_admin_update`, so a plain-table receiver-field update from
the client would silently fail RLS for non-admin roles editing their
own confirmed orders. New params default to `true`/`NULL` and are set
directly (not `COALESCE`d) on the same final UPDATE that already sets
`customer_id`/`note`, since the calling form always submits full
current state, not a partial patch. Quotes' create/edit stayed a
plain table insert/update (no RPC involved, already covered by
existing `orders` RLS), so only this one RPC needed extending.

## D024

Quotes split into a standalone `quotes`/`quote_items`/
`quote_item_modifiers` table set, separate from `orders`, superseding
the model D023 describes (`orders.status = 'quote'`). Reason: a
handed-over Quote Module BRS assumed Quote and Sales Order are two
distinct linked documents (conversion creates a *new* Sales Order,
locks the original Quote permanently); the single-table status-flip
model couldn't represent that without contradicting the BRS's
numbering, validity-period, and audit requirements. Confirmed with
Sinag before building — see `PROGRESS-QUOTES.md`. `orders_status_check`
narrowed to drop `'quote'` (QUOTE-5); the two quote-specific RLS
policies on `orders`/`order_items` (`orders_encoder_update_own_quote`,
`order_items_encoder_update_own_quote`) were dropped as dead code in
the same migration, since their `using` clause required
`status='quote'`, which no `orders` row can be anymore.

## D025

`convert_quote_to_order()` reserves stock (`available_qty` →
`reserved_qty` via the existing `transfer_stock_status()`) instead of
deducting `in_stock` outright, unlike the old `confirm_order()` it
replaces for quotes. Reason: the BRS explicitly wants conversion to
*reserve* available inventory, not consume it as a completed sale.
When reserved stock becomes a real deduction (at Production
completion, presumably) is an open design question explicitly
deferred to a future "order page revision" phase, per Sinag's
direction — not resolved here. Convert still blocks entirely on any
stock shortage (kept `confirm_order()`'s all-or-nothing guard) rather
than the BRS's "partial reserve, let shortfall ride," since that
partial-allocation UX doesn't exist yet either and depends on the same
deferred phase.

## D026

Order Module Improvement (`PROGRESS-ORDERS.md`, ORDER-1, migration
`0032_orders_module_improvement_schema`) — the deferred phase D025
pointed to. Four schema calls made:

- `orders.order_number` uses the exact same yearly-reset trigger
  pattern as `quotes.quote_number` (D... see QUOTE-1), just with
  prefix `SOD` instead of `SQT` (format `SOD<YY>-<MMDD>-<seq>`).
  Confirmed with Sinag 2026-07-06.
- `orders.target_date` (`NOT NULL`, no DB default) follows
  `quotes.valid_until`'s existing convention: since the value derives
  from a sibling column (order date + 5), which a column `DEFAULT`
  can't reference, application code must set it explicitly at insert
  time, not the database.
- `orders_status_check` was expanded **additively** — the 6 new
  statuses (`partially_completed`, `production_completed`,
  `ready_for_shipping`, `shipped`, `delivered`, `on_hold`) were added
  alongside the existing `completed`, not replacing it. Reason:
  Completed Orders, Production Report, and Order List/Production
  Queue all still filter on `'completed'` today — remapping or
  removing it in a schema-only phase would break currently-working
  pages before the phases that actually rework them (ORDER-4/6/7)
  land. Whether `completed` becomes a permanent alias for `delivered`
  or is migrated away entirely is still an open question.
- New `order_payments` table reuses the existing `payment_types`
  table via FK (`payment_type_id`, nullable, mirrors
  `orders.payment_type_id`) instead of a free-text payment-method
  column, to stay consistent with the Loyverse-synced payment-type
  list already used elsewhere. RLS allows admin-only `UPDATE`/`DELETE`
  for manual correction — the doc's "payment history must never be
  deleted" was read as prohibiting *automatic*/cascading deletion, not
  banning an admin fixing a data-entry mistake.

`order_items.reserved_qty`/`completed_qty` were added as
`NOT NULL default 0` and backfilled (`reserved_qty = quantity` for
existing rows) but are **not yet populated by any RPC** — `ORDER-2`
must land before new orders/edits get correct `reserved_qty` values.

## D027

`adjust_order_items()` rewritten (`PROGRESS-ORDERS.md` ORDER-2,
migrations `0033`-`0035`) to reserve stock (`available_qty` →
`reserved_qty` via `transfer_stock_status()`) instead of deducting
`in_stock` directly, and to support partial-reserve-on-shortage
instead of blocking the whole edit — the two things D025 explicitly
deferred to this phase. Also dropped `confirm_order()` (dead code
since QUOTE-5 narrowed `orders_status_check` to drop `'quote'`) and an
orphaned 4-param `adjust_order_items()` overload left over from 0025
(the app only ever called the 8-extra-param version).

Shortage-splitting policy (confirmed with Sinag): **greedy by line
order** — lines are processed in the order the caller submits them
(matches on-screen order in the edit form); an earlier line claims a
shared raw-material component in full before a later line, so when
the component runs short, the shortfall lands on the later line(s)
rather than blocking the whole order. Proportional splitting was the
rejected alternative (fairer but more complex, can leave rounding
remainders).

Implementation note: rather than adapting the old delta-based
temp-table approach, the edit flow now (1) releases the order's
*entire* current reservation footprint back to `available` — expanded
from each existing line's `reserved_qty`, not its ordered `quantity`,
since a prior edit may have only partially reserved a line on
shortage — then (2) deletes and reinserts `order_items` from the new
line list, then (3) loops the new lines in submitted order, computing
each line's feasible whole-unit reservation as the `MIN` across its
required components (BOM-expanded, or itself if not composite) of
`floor(available_qty / per_unit_ratio)`, and reserves that amount
before moving to the next line. `track_stock` lives on the *component*
item, never the composite/kit item itself (composites are always
`track_stock=false`), so the tracked/untracked check happens on the
expanded component rows, not the line's own item.

Known gap, not fixed here: the edit flow's delete+reinsert of
`order_items` means any manually-entered `completed_qty` (ORDER-3,
not yet built) would be wiped back to 0 by a subsequent line-item
edit. No data has `completed_qty > 0` yet since ORDER-3 doesn't exist,
so this is a documented follow-up for ORDER-3/6, not a live bug.

`confirm_order()` was retired rather than repurposed as the Method-2
(direct order creation) entry point — ORDER-5 needs different inputs
(no existing `order_items` to expand from; must set
`order_number`/`target_date`) so it gets its own RPC.

## D028

Order Detail page (`PROGRESS-ORDERS.md` ORDER-3) surfaced a mismatch
between the original kickoff decision text ("Completed Qty entry by
admin/manager") and the live RLS: `order_items_admin_update` and
`orders_admin_update` are both **admin-only** — no manager-level
UPDATE policy exists on either table. Per the `bms-supabase` skill's
preflight instruction (flag doc/system mismatches before proceeding),
this was surfaced to Sinag rather than assumed either way. Decision:
gate Completed Qty entry to **admin-only** in the UI, matching live
RLS exactly, rather than silently widening RLS as a side effect of a
UI-focused phase. Widening to admin+manager (a new RLS policy) is left
as an explicit, separate follow-up if still wanted.

Also added migration `0036_order_items_completed_qty_check`: additive
`CHECK (completed_qty <= quantity)` on `order_items`, enforcing
"Ordered Qty must never be less than Completed Qty" at the DB layer
(the UI also clamps client-side, but the DB is the authoritative
guard). `updateCompletedQty()` loops individual per-row `UPDATE`s
rather than a bulk `upsert`, per the ON-CONFLICT-checks-the-raw-INSERT-
row-before-redirecting-to-UPDATE gotcha already documented for
`adjust_stock` (see memory `project_adjust_stock_upsert_check_constraint_fix`)
— avoids re-hitting that class of bug for a second table.

Payment Status (Unpaid/Partially Paid/Paid/Overpaid) and Total
Paid/Remaining Balance/Change are computed client-side from
`sum(order_payments.amount)` vs `orders.total_money` — no new stored
column, since these are pure derived display values with no other
consumer yet.

Order Detail routing stays **UUID-based** (`[id]`), not
`order_number`-based like Quotes (QUOTE-7) — that migration remains
an open question tracked at the bottom of `PROGRESS-ORDERS.md`, not
decided in this phase.

## D030

ORDER-7 (`PROGRESS-ORDERS.md`, migration `0038_order_status_workflow`)
resolved the Shipping TBDs `MODULE_STATUS.md` and `PROGRESS-CUSTOMERS.md`
Part 2 had flagged as blocking since the Customer/Shipping build
(D022/D023): shipment status workflow, whether pickup orders get an
`order_shipments` row, and shipping-fee reconciliation. Confirmed with
Sinag before building:

- **Cancel** releases the full `reserved_qty` of every line back to
  available regardless of `completed_qty` — there is no separate
  "consumed" inventory bucket (Production consumption is out of scope
  for Inventory Phase 1). Allowed from `confirmed`/`in_production`/
  `partially_completed` only, admin-only (matches the existing
  admin-only `orders_admin_update` RLS, same gap D028 found).
- **On Hold** pauses only (inventory stays reserved, no transfer);
  allowed from `confirmed`/`in_production`/`partially_completed`/
  `production_completed`/`ready_for_shipping`, admin-only. A new
  `orders.on_hold_previous_status` column stores what to restore on
  Resume, since Resume can't be derived from data the way
  `recompute_order_status()` derives the production-family statuses.
- **Pickup vs delivery**: the Ready for Shipping → Shipped → Delivered
  chain (and `order_shipments`/`couriers`) applies to delivery orders
  only — pickup orders go `production_completed` → `delivered`
  directly, no `order_shipments` row created. Shipment actions
  (mark ready/ship/deliver) are admin+encoder, matching the existing
  `order_shipments` RLS exactly (no RLS change needed).
- **Shipping fees** (`shipping_cost`/`shipping_fee_charged`) are
  informational only on the shipment record — no effect on
  `orders.total_money` or Payment Status.

Blocker found and fixed as a prerequisite: `orders.fulfillment_method`
had existed as a column since migration `0023_shipping` (and
`create_order`/`adjust_order_items` already accepted a
`p_fulfillment_method` param) but no UI ever set it — every order had
it `NULL`, which would have made the pickup/delivery branch above
undecidable. Added a Fulfillment Method select (defaults to Pickup) to
both New Order and Edit Order, and wired the param through
`actions.ts`, which previously omitted it entirely (silently NULLing
it on every save even though the RPCs already supported it).

Also built: a Couriers management page
(`app/dashboard/orders/couriers/`), mirroring the existing Suppliers
page pattern — the `couriers` table existed since `0023_shipping` with
no admin UI at all, needed so staff can populate the courier picker in
the new Ship Order dialog. Admin-only write, matching `couriers`'
existing RLS (no manager/encoder write policy exists on that table).

## D029

ORDER-6's status matrix (`PROGRESS-ORDERS.md`) assumed a status-
transition mechanism that didn't exist in the code — nothing
previously set `partially_completed`/`production_completed`. Two
gaps surfaced and were resolved with Sinag before building, same
"flag doc/system mismatches" pattern as D028:

1. Order status **auto-derives from Completed Qty**, not a manual
   picker — recomputed from `sum(completed_qty)` vs `sum(quantity)`
   every time Completed Qty is saved, and reversible (dropping
   completed qty back to 0 reverts the status).
2. New line items can still be added through Confirmed, In
   Production, and Partially Completed — only Production Completed
   fully freezes the line list. The "restrictions" applied to In
   Production/Partially Completed are exactly the doc's other two
   rules (no removing a line with `completed_qty > 0`; quantity
   can't drop below `completed_qty`), not a separate new mechanic.

`adjust_order_items()`'s Production Completed branch never parses
`p_lines` at all, rather than validating submitted lines match the
existing set — simpler, and makes line-item changes structurally
impossible at that status instead of relying on a check. No new
UI was built for Notes/Shipping-only editing at Production
Completed; the existing Edit Order page is reused with its Line
Items card disabled, since Payments were already status-independent
via the pre-existing Add Payment dialog.

## D031

**Operations nav restructure (2026-07-06):** the sidebar's flat
Inventory/Purchasing/Orders subgroups under "Operations" were
reorganized into three subgroups — **Management** (master data:
Customer, Supplier, Item List, Item Category*, Product Modifier*,
Couriers, Stores*), **Orders** (Quotation, Active Orders, Production,
Shipping*, Payment*, Completed Orders), and **Inventory** (Inventory
Status*, Item Adjustment, Stock Movement, Purchase Orders, Receiving)
— per Sinag's request. `*` = new blank placeholder pages, not yet
built.

This was a **full physical restructure**, not just a nav relabel —
folders and URLs were moved to match:

- `orders/customers` → `management/customers`
- `inventory/suppliers` → `management/suppliers`
- `inventory/items` → `management/items`
- `orders/couriers` → `management/couriers`
- `orders/quotes` → `orders/quotation`
- `orders/order-list` → `orders/active-orders`
- `orders/production-queue` → `orders/production`
- `purchasing/purchase-orders` → `inventory/purchase-orders`
- `purchasing/receiving` → `inventory/receiving`
- `orders/completed`, `inventory/adjustment`, `inventory/stock-movement`
  stayed put — already in their target group.

The now-empty `app/dashboard/purchasing/` (a "Coming soon" stub hub
page, no real content) was deleted. All internal `href`/
`revalidatePath`/redirect references were updated to match; `tsc
--noEmit` is clean. Historical `PROGRESS-*.md` entries describing
work under the old paths were left as-is (they're append-only logs of
what was true at build time) — only `MODULE_STATUS.md` (a living
status doc) and each affected `PROGRESS-*.md`'s file list were
updated to the new paths, with a short dated note added.

## D032

**Orders subgroup reorder + new "Received" item (2026-07-06):** per
Sinag's follow-up request, the Orders sidebar subgroup order changed
to Active Orders, Quotation, Received*, Production, Shipping, Payment,
Completed (`*` = new blank placeholder). Also: "Completed Orders" →
"Completed" (label only, route unchanged — already
`/dashboard/orders/completed`).

New blank page `app/dashboard/orders/received/page.tsx` — not yet
defined what this represents business-wise (distinct from Inventory's
existing Receiving, which is PO/stock-side); flagged as TBD in
`MODULE_STATUS.md` until Sinag specifies scope.

## D033

**Production Orders introduced, formally superseding D030's
production-consumption scope-out (2026-07-07, PS-2):** D030 recorded
that "Production consumption is out of scope for Inventory Phase 1"
and that Cancel simply releases the full `reserved_qty` because "there
is no separate 'consumed' inventory bucket." `PROGRESS-PRODUCTION-
SHIPPING.md` (PS-2) is that deferred phase — a new `production_orders`
table now exists, and `start_production()` (replacing the old bare
`orders.status` flip) does a real Reserved→In Production stock
transfer per order line, BOM-expanded the same way `create_order`/
`adjust_order_items`/`cancel_order` already do. This is a partial
supersession only: the full `completed`/`delivered` alias resolution
D030 also touched on is deferred to PS-7, not resolved here.

Two build-time decisions, not pre-planned in the kickoff doc:

- **Numbering prefix is `SPR`, not `SPO`.** The kickoff doc's gap
  analysis cited "the yearly-reset numbering trigger pattern (SQT/
  SOD/SPO)" as reusable precedent, but `SPO` was already live —
  it's `purchase_orders.reference`'s prefix (`set_purchase_order_
  reference()`), unrelated to Production Orders. Caught by querying
  the live DB for existing prefixes before generating one, per this
  project's "verify against the live system, not the docs" convention.
  Production Order Number is `SPRYY-MMDD-0001`.
- **Order Items link to their Production Order via a plain FK
  column** (`order_items.production_order_id`, nullable, `ON DELETE
  SET NULL`), not a junction table. Kickoff decision #2's merge rule
  (duplicate SKU+modifier lines within one order collapse into one
  Production Order) is inherently one-to-many from `order_items`'
  side — each line ends up in exactly one Production Order — so a
  junction table would have added generality nothing needs yet.

Start Production stays **admin-only** (RPC-internal role check),
matching the existing `canAdvance` UI gate — not widened as part of
this phase.

## D034

**Production Order Detail UI + Completed Qty retirement (2026-07-07,
PS-3):** built the Production Orders list/detail screens on top of
D033's schema, and retired ORDER-3/D028's manual Completed Qty entry
now that Production Orders exist to derive it from.

- **"Complete Production Order" lives only on the Production Order
  Detail page**, not as an inline action in the list. This is a
  deliberate departure from the old Production Queue it replaces
  (which had "Mark Completed" directly in the list via a dialog) —
  the newer Quotes/Active Orders convention of putting mutating
  actions on the detail page and using the list purely for navigation
  (`onRowClick`) was followed instead, for consistency with those more
  recently built screens.
- **Completed Qty is now read-only** on Order Detail, showing a link
  to the owning Production Order instead of an editable input. The
  `update_completed_qty()` RPC was left in the database (not dropped,
  per the additive-migrations convention) but its only caller
  (`updateCompletedQty()` in `active-orders/actions.ts`) was deleted —
  no UI path calls it anymore.
- `recompute_order_status()` was rewritten in place (not a new
  function) to derive order status from `production_orders` completion
  counts instead of raw `sum(order_items.completed_qty)` — same
  function name/signature, different derivation logic.

Built alongside another session's in-flight PS-4 (Reserved Qty
override) work touching the same `order-detail.tsx`/`page.tsx` files;
edits were scoped narrowly and re-verified against the live file
immediately before each change to avoid clobbering concurrent work.

## D035

**Mark Shipped → Inventory Out, order-level shipping rollup, `completed`
retired (2026-07-07, PS-7):** closes the `completed`/`delivered` alias
question left open since D026 and deferred again by D033 — resolved in
favor of **`delivered`** as the single terminal `orders.status` for both
pickup and delivery orders. The 2 live rows previously at `'completed'`
were migrated to `'delivered'`, then `'completed'` was dropped from
`orders_status_check` entirely (additive-then-subtractive: data first,
constraint second, in the same migration).

- New `mark_shipment_shipped(p_shipment_id)` (admin/encoder) is the
  actual inventory-out step PS-6's `create_shipment()` deliberately
  didn't do. Product lines are BOM-expanded through `item_components`
  (same union-with-track_stock-filter pattern as `start_production`/
  `adjust_order_items`/`cancel_order`) and deducted In Production →
  Out via PS-5's `deduct_stock_out()`; packaging lines are deducted
  Available → Out directly.
- **Build-time fix, not pre-planned:** the first version raised on
  packaging lines whose item has `track_stock = false` (a real test
  item — `Pkg-Box, Medium 22.5x14x10.3` — configured that way), because
  `deduct_stock_out()` raises rather than no-ops on untracked items.
  Fixed by skipping untracked packaging lines in the loop instead of
  raising, matching the rest of the codebase's convention of silently
  excluding untracked items from stock movement (`start_production`'s
  BOM filter, `adjust_order_items`' `v_feasible is null` branch) —
  caught by testing against live data before assuming the RPC was
  correct, not by inspection.
- New `mark_shipment_delivered(p_shipment_id)` (admin/encoder) is the
  terminal per-shipment transition.
- New `recompute_shipping_status(p_order_id)` derives the order's
  status from **all** `order_shipments` rows, mirroring
  `recompute_order_status()`'s Production Order completion-count
  pattern: `shipped` once any shipment reaches shipped/delivered,
  `delivered` once every shipment does. Guarded to only act when the
  order is currently `ready_for_shipping`/`shipped`, same guard style
  as `recompute_order_status`, so it can't clobber `on_hold`/
  `cancelled`/pickup-track orders.
- Verified live (Supabase MCP, simulated admin JWT): ran
  `mark_shipment_shipped` on one of two `preparing` shipments against
  real order `SOD26-0707-0007` — confirmed BOM-expanded deduction
  (`in_production_qty` 42→12, `in_stock` 83→53), order rolled up to
  `shipped` (one shipment shipped, one still preparing); the second
  shipment's attempt correctly raised "Insufficient in_production
  quantity" (only 12 left, needed 20) and rolled back cleanly, no
  partial state; a null-role caller was correctly rejected. Separately
  ran `mark_shipment_delivered` on an already-`shipped` single-shipment
  order (`SSH26-0706-0002`) and confirmed the order rolled up to
  `delivered`. `ship_order()`/`mark_delivered()` (the pre-PS-6
  single-implicit-shipment RPCs) are left in the database untouched —
  PS-8 is what cuts the UI over to `create_shipment` +
  `mark_shipment_shipped` + `mark_shipment_delivered`.

`BUSINESS_RULES.md` gained `## Production Orders`, `## Shipments`,
`## Packaging Materials` sections and a rewritten `## Orders`/`## Quotes`
in this same phase — those were assigned to PS-2/PS-3/PS-6/PS-1
respectively in `PROGRESS-PRODUCTION-SHIPPING.md`'s docs table but had
been left undone through those phases; bundled into this pass rather
than left inconsistent, since PS-7 was already touching the file for
its own assigned changes.

## D037

**Auto-advance to Ready for Shipping on production completion (2026-07-07,
PS-13):** `recompute_order_status()` now sends delivery/null-fulfillment
orders straight to `ready_for_shipping` the moment every Production Order
finishes, instead of stopping at `production_completed` and waiting for a
manual "Mark Ready for Shipping" click. Sinag's explicit request — once
production is done, a delivery order genuinely has nothing left to decide,
so the manual gate was pure friction. Pickup orders are **excluded**: they
still stop at `production_completed` and require a manual `mark_picked_up()`
click, since that represents a real-world event (the customer physically
arriving) rather than a pure system state — Sinag confirmed this explicitly
rather than assuming symmetry with the delivery track.

- The now-permanently-unreachable "Mark Ready for Shipping" button/handler
  is removed from Order Detail (`order-detail.tsx`/`page.tsx`) and its
  `markReadyForShipping` wrapper removed from `active-orders/actions.ts`
  (no caller left) — same treatment `shipOrder`/`markDelivered` got in
  D036. The underlying `mark_ready_for_shipping()` RPC stays in the
  database untouched, per this project's additive-migrations convention.
- One-time backfill in the same migration (`ps13_auto_ready_for_shipping`)
  pushed the 2 live orders already stuck at `production_completed` with
  non-pickup fulfillment (`SOD26-0707-0010`, `SOD26-0707-0012`) forward to
  `ready_for_shipping`, so behavior is consistent for orders that completed
  production before this shipped.
- `recompute_order_status()` now writes an `activity_logs` row
  (`order_ready_for_shipping`) when it auto-advances an order, mirroring
  the log line the manual button used to write, so the Activity Log panel
  keeps showing this transition even though no human triggers it anymore.

## D036

**Shipping UI rework (2026-07-07, PS-8):** Order Detail's single
Shipment card + "Ship Order"/"Mark Delivered" buttons are replaced by a
Shipments list (`order-shipments.tsx`) showing every `order_shipments`
row for the order, each with its own Mark Shipped/Mark Delivered
action, plus an "Add Shipment" dialog wired to PS-6's `create_shipment`
RPC. `shipOrder`/`markDelivered` are removed from `active-orders/
actions.ts` (no caller left); the underlying `ship_order`/
`mark_delivered` RPCs stay in the database per the additive-migrations
convention (same treatment `update_completed_qty` got in D034).

- **"Add Shipment" only shows while `orders.status = 'ready_for_shipping'`
  exactly** — matching `create_shipment()`'s existing gate (PS-6)
  rather than loosening it. Once any shipment on the order is marked
  Shipped, the order rolls up to `shipped` and the UI stops offering
  Add Shipment, even if some order lines still have unshipped quantity
  left. This means every shipment for an order must be planned (though
  not necessarily executed) while it's still Ready for Shipping — a
  real workflow constraint inherited from PS-6's design, not loosened
  here. If Sinag wants to add shipments after the first is already
  shipped, that requires deliberately relaxing `create_shipment`'s gate
  — a future decision, not assumed here.
- **Packaging Materials sub-editor is a small purpose-built row editor**,
  not a literal reuse of `OrderLineItemsEditor` (ORDER-9) as the
  original spec's "same interface as the Order Items page" wording
  might suggest read literally — packaging lines have no price/
  discount/modifier concept, so reusing that component's full field set
  would have added dead UI. It mirrors that component's add/remove-row
  interaction instead (Add Row button, disabled Remove at one row).
- `lib/supabase/types.ts` regenerated — it predated PS-2 and was
  missing `shipment_items`/`shipment_packaging_items`/the new RPCs
  entirely; the new Order Detail queries wouldn't type-check without
  this.
- Verified live (Supabase MCP + browser, admin test account): full
  Add Shipment → Mark Shipped (BOM-expanded stock deduction confirmed
  via SQL on 3 underlying components) → Mark Delivered cycle, with the
  order status rolling up `ready_for_shipping → shipped → delivered`
  at each step. Separately confirmed (direct RPC call, not through the
  UI) that over-shipping correctly raises and rolls back — the
  automated preview tooling's `preview_eval`/`preview_click` calls hang
  behind a blocking native `alert()` on that error path specifically;
  this is a tooling limitation of the browser-preview harness, not an
  app bug, and was confirmed not to leave any partial DB state.

## D038

**Payment close semantics — note required for partial close, overpaid treated as tip
(2026-07-07, PS-16):** Closing an order's payment (`close_order_payment()`) is gated
by the derived Payment Status bucket, not by `orders.status` — payment closing is a
separate concept from the fulfillment lifecycle. `Unpaid` cannot be closed (nothing to
close). `Partially Paid` requires a non-blank note, both client-side and enforced in the
RPC — Sinag's explicit use case is writing off a balance once a customer stops
responding after shipment, and a bare close with no explanation would leave no record of
why. `Paid`/`Overpaid` close freely. Closing while `Overpaid` records the excess
(`total_paid - total_money`) into a new `orders.tip_amount` column rather than leaving it
as an ambiguous positive remaining-balance number — Sinag's explicit call that
overpayment in this business is a customer tip, not a credit to reconcile later.

- No reopen path is built — once closed, a payment stays closed. Flagged as a possible
  future follow-up if a close ever needs correcting, not built speculatively.
- New columns `orders.payment_closed_at`/`payment_closed_by`/`payment_close_note`/
  `tip_amount` (migration `ps16_close_payment`); `lib/supabase/types.ts` regenerated.
- The existing Payments card (Add Payment dialog + history) was extracted into a shared
  `OrderPayments` component (`active-orders/[orderNumber]/order-payments.tsx`), reused by
  both Order Detail and the new dedicated Payment page — same shared-component pattern
  `OrderShipments` established in PS-15, so there's one implementation of the payment UI,
  not two.
- The Payment list (`/dashboard/orders/payment`) row click now goes to a dedicated
  per-order Payment page instead of the full Order Detail — order/customer info and the
  Payments card only, no line items or shipping (see `MODULE_STATUS.md`'s rewritten
  Payment bullet). A read-only, print-friendly Payment Preview page (same convention as
  the Quotation view, PS-16) was added for showing a customer their itemized remaining
  balance.

## D039

**Fulfillment type moved from order-level to per-shipment (2026-07-08, PS-17); supersedes
D036.** Requested by Sinag directly: pickup and delivery should be decided per-shipment in
the Add Shipment dialog (defaulting to "Ship to Customer" = on), not once for the whole
order — because a single order can be split across multiple shipments with different
fulfillment types (some units picked up in person, the rest couriered later).

- New `order_shipments.fulfillment_type` column (`pickup`/`delivery`, default `delivery`)
  is now the single source of truth for how each shipment record is fulfilled.
  `orders.fulfillment_method` is **left in the table, unused, on purpose** — removing it
  was out of scope for this phase and no other code path still depends on it, but whether
  to repurpose or drop it later is an **open decision**, not resolved here.
- `recompute_order_status()`'s PS-13 special case (pickup orders stop at
  `production_completed`) is retired — every order now advances straight to
  `ready_for_shipping` once production completes, since it may need both pickup and
  delivery shipments allocated from the same page.
- New RPC `mark_shipment_picked_up()` — the pickup equivalent of `mark_shipment_shipped()`,
  but a single atomic step (`shipped_at = delivered_at = now()`) since a pickup is one
  real-world event, not ship-then-deliver. Reuses the same BOM-expanded stock-out logic
  (factored into a shared private `_deduct_shipment_stock()` helper) — this is what
  actually fixes the "pickup never deducts stock" gap the retired whole-order
  `mark_picked_up()` had (flagged during Quote→Shipping end-to-end testing the same day).
  The whole-order `mark_picked_up()` RPC and its Order Detail button are retired the same
  way `ship_order`/`shipOrder` were in D036 — RPC left in the database, UI caller removed.
- **Pickup shipment numbering uses a new `SSP` prefix**, distinct from delivery's existing
  `SSH` — Sinag's explicit call, so the two fulfillment types stay visually distinguishable
  in the numbering scheme itself, not just via a badge. Both prefixes coexist in the same
  `order_shipments` table going forward; existing `SSH`-numbered delivery rows are
  unaffected.
- **This explicitly supersedes D036's "must be planned while Ready for Shipping" gate** —
  `create_shipment()` now also accepts orders already at `shipped`, since the mixed
  pickup+delivery use case requires adding shipments incrementally (e.g. 3 units picked up
  today, the remaining 3 shipped by courier once arranged next week), not all planned
  up front. Per-line quantity validation inside the RPC already prevents over-allocation,
  so this introduces no new risk.
- **Bug caught during verification, fixed same phase:** `recompute_shipping_status()` only
  counted `order_shipments` rows, not whether the order's full line-item quantity had
  actually been allocated into a shipment. On a mixed order with one pickup shipment
  covering 3 of 6 units, marking that one shipment delivered rolled the *entire order* to
  `delivered` even though 3 units had never been allocated to any shipment. Fixed by also
  requiring zero remaining unshipped quantity (`sum(order_items.quantity) -
  sum(shipment_items.quantity_shipped)`) before reaching `delivered`; otherwise the order
  correctly stays `shipped`.

## D040

**Order-level receiver system retired in favor of per-shipment receiver (2026-07-08,
PS-18); SSP shipment-number prefix retired.** Requested by Sinag directly, as an
amendment to PS-17: fulfillment method should be an explicit dropdown (not an implicit
toggle), receiver should be decided per shipment with three conditions (deliver to the
registered customer / deliver to someone else / pick up — no receiver), and pickup should
no longer get a distinct `SSP` number prefix.

- `order_shipments` gains `ships_to_customer boolean` and `receiver_name/phone/
  address_line1/barangay/city/province/postal_code text`, all nullable, forced null on
  pickup shipments. `create_shipment()`/`update_shipment()` gained matching
  `p_ships_to_customer`/`p_receiver_*` params (old 9-arg overloads dropped explicitly —
  same orphaned-overload trap as D027/PS-17b).
- The "Ship to Customer" `Toggle` that PS-17 used to double as the fulfillment-type
  switch is replaced by an explicit `Select` ("Fulfillment Method": Delivery/Pick Up).
  For `delivery`, a separate "Ships to Customer?" `Toggle` (default on) picks between: a
  server-side snapshot of the order's registered customer (client input ignored; rejected
  with an explicit error if the order has no `customer_id`), or a manually entered
  receiver (name required). `pickup` shipments have no receiver UI at all.
- **This retires the older order-level receiver system** from the Customer/Shipping
  feature (`orders.same_as_customer`/`receiver_*`, shown on New/Edit Order and Order
  Detail) — removed from both forms and from Order Detail's display. The columns are
  **left in the schema, unused**, same precedent as `fulfillment_method` (D039) — not
  dropped, since other code paths don't depend on them and dropping was out of scope.
- **This reverses D039's "SSP is Sinag's explicit call"**: pickup shipments no longer get
  a distinct prefix — `set_shipment_number()` now always generates `SSH<YY>-<MMDD>-####`
  regardless of `fulfillment_type`. Existing `SSP`-numbered rows are left as historical
  records, not renumbered or migrated.
- Stock-out mechanics (`_deduct_shipment_stock`/`deduct_stock_out`, driven purely by
  `shipment_items`/`shipment_packaging_items`) are untouched — verified unaffected for
  all three receiver conditions (see PROGRESS-PRODUCTION-SHIPPING.md PS-18).

**Depends on:** PS-17/D039 (the fulfillment-type-per-shipment model this refines).
- **Also caught and fixed:** `create or replace function` with a widened parameter list
  creates a second overload instead of replacing the original when the signature differs.
  Dropped the orphaned 8-param `create_shipment`/`update_shipment` overloads (same class of
  issue ORDER-2/D027 hit with `adjust_order_items`).
- Verified live (browser, admin test account): a pickup-only shipment (`SSP26-0708-0001`,
  correct stock deduction, single-step Picked Up), a delivery-only shipment (regression,
  unchanged), and a mixed order (3 units picked up + 3 units delivered later once "Add
  Shipment" reappeared at `shipped` status) all rolled up to `delivered` only once truly
  complete, with stock deducted correctly for both fulfillment types. Editing a `preparing`
  shipment and flipping its type preserves already-entered product-line quantities (no
  lines lost on toggle).

## D041

**`adjust_order_items()` reconciles `production_orders` instead of orphaning them on
every post-`start_production()` edit (2026-07-08, INV-9).** `production_orders.quantity`
was a frozen snapshot taken once at `start_production()` time (D033); `order_items.
production_order_id` was the only live link back to it, and `adjust_order_items()`'s
delete-and-reinsert of `order_items` (D007) dropped that link on every edit, silently
breaking `complete_production_order()`'s `completed_qty` backfill for the rest of that
order's life. Found as a flagged-but-deferred item at the bottom of INV-7.

- **Sinag's call, given after three options were laid out**: relink-only (cheapest, still
  leaves `quantity` stale and new lines untracked), restrict edits entirely once production
  starts (reverses D007's existing editability), or full reconcile. Chose full reconcile.
- `production_orders.quantity` is now a **live rollup**, not a frozen snapshot — resynced
  to the sum of its linked `order_items.quantity` on every edit that touches those lines.
- New guard (no earlier equivalent existed): an edit that would drop an active Production
  Order's linked total below its own `completed_qty`, or to zero, is blocked outright.
  Necessary because `add_production_completed_qty`'s partial-completion progress lives only
  on `production_orders`, never synced back to `order_items.completed_qty` (that only
  happens on full completion) — so nothing upstream of this guard could have caught a
  shrink below partial progress.
- A line with no matching active Production Order (a genuinely new variant+modifier combo
  added after production started, or one whose only prior Production Order already
  completed/cancelled) gets a **new** Production Order auto-created for it, mirroring
  `start_production()`'s own grouping — **gated admin-only**, matching D033's existing
  restriction on `start_production()` itself, rather than letting a routine encoder/manager
  edit conjure a new Production Order through a side door. Relinking/resyncing an
  *existing* Production Order stays open to admin/manager/encoder, same as
  `adjust_order_items()` always has been.
- Verified live (Supabase MCP, admin + encoder test accounts, fresh order
  `SOD26-0708-0022`): quantity increase on a linked line resynced its Production Order and
  logged `production_order_quantity_adjusted`; a genuinely new line auto-created a new
  Production Order as admin and was blocked with a clear error as encoder; shrinking a
  line below its Production Order's partial `completed_qty`, and removing every line of a
  Production Order outright, were both blocked; `complete_production_order()` on the
  edited (quantity-resynced) Production Order correctly backfilled `order_items.
  completed_qty` again — the exact assertion that silently failed before this fix. Cleaned
  up via `cancel_production_order()`/`transfer_stock_status()`; `inventory_levels` for all
  4 touched variants matched their pre-test values exactly afterward.

## D042

**`cancel_order()` rewritten to resolve stock by actual current bucket instead of an
assumed one, and extended to `on_hold` (2026-07-09, PS-21).** Sinag asked to add a Cancel
button to the On Hold detail page (PS-20). Assessed first rather than just adding the
button: `hold_order()` is a pure status flip (D030) that never moves inventory, so an
On Hold order's stock sits wherever it was before the hold — still `reserved` if held from
`confirmed`, or already moved to `in_production` (via `start_production()`, PS-2) if held
from any later status, possibly split across several linked `production_orders` in
different states including fully `completed`. `cancel_order()`'s old logic hardcoded the
release source to `reserved`, which would either hard-fail ("Insufficient reserved
quantity") or — worse — silently drain an unrelated order's reserved stock of the same
variant, for any order that had actually entered production. This bug predates On Hold
entirely: it already affected the `in_production`/`partially_completed` statuses
`cancel_order()` claimed to support.

- **Sinag's calls, given three options laid out**: (1) support cancel from all five
  holdable prior-statuses vs. only `confirmed`-held orders — chose **all**; (2) reconcile
  linked `production_orders` by reusing `cancel_production_order()`'s existing split
  (uncompleted → available, completed portion → the `on_hold` stock bucket) vs. releasing
  everything straight to available — chose **reuse the existing split**; (3) fix the
  latent `in_production`/`partially_completed` bucket bug in the same pass vs. deferring
  it — chose **fix now**, same root cause and same function.
- New `cancel_order()` order of operations: walk every non-cancelled `production_orders`
  row for the order first. `not_started`/`wip`/`partially_completed` ones go through
  `cancel_production_order()` unchanged (safe to call even though the parent order's own
  status may still be `on_hold` — that function's tail-end order-status update and
  `recompute_order_status()` both only touch `orders.status` when it's in the
  in-production family, and `cancel_order()` overwrites `orders.status` to `cancelled`
  itself afterward regardless). `completed` production orders — a status
  `cancel_production_order()` itself refuses, since `complete_production_order()` never
  moves stock out of `in_production` on completion — get a new inline branch that parks
  the full quantity in the `on_hold` bucket, mirroring the existing "completed portion"
  rule rather than inventing a new one. Only after that does it release any `order_items`
  still purely in Reserved (never entered production), then flips `orders.status` and
  clears `on_hold_previous_status`.
- **Not touched, flagged only:** `order_shipments` isn't reconciled on cancel (its status
  CHECK constraint has no `'cancelled'` value) — an On Hold order held from
  `ready_for_shipping` with a shipment already `preparing` will leave it dangling after
  cancel. Same class of pre-existing gap as `order_payments` (cancelling never reverses a
  payment either); out of scope for this pass.
- Verified live (browser preview + direct Postgres, admin test account), three scenarios:
  held-from-`confirmed` (pure Reserved release), held-from-`in_production` with two linked
  POs in `not_started`/`partially_completed` (existing live orders `SOD26-0709-0023` /
  `SOD26-0708-0020`), and a freshly built order taken through Start Production → Mark
  Complete → Put On Hold from `ready_for_shipping` specifically to exercise the new
  `completed`-PO inline branch (`SOD26-0709-0024`) — all three matched hand-computed
  expected `inventory_levels` values exactly, with `production_orders`/`order_items`
  cleanup and the `activity_logs` chain all correct.

## D043

**`main` fast-forwarded past a 6-day merge gap; Management module (MGMT-2/3/4) WIP
reconciled onto the merged nav instead of merging its own branch (2026-07-09).** A "Post-
INV-16 view regression assessment" session, spun up to investigate why a fresh
worktree/session showed a stale sidebar, found the root cause was a merge gap rather than a
code bug: `main` (local and `origin`) had been stuck at `cb9b408` (CUST-1..4, 2026-07-03)
for six days while all real work — `INV-1..16`, the Order module rebuild, `QUOTE-1..7`,
`PS-18..22` — had been happening on `docs/inventory-status-phase1-kickoff`, never merged
back. Separately, a "Management pages population" session had built full CRUD for Item
Categories/Product Modifiers/Stores (`MGMT-0..5`, see `PROGRESS-MANAGEMENT.md`) against
that same stale `main`, at its own route names (`categories/`, `modifiers/`) and with its
own new top-level "Management" nav group.

- Local `main` fast-forwarded to the INV-16 tip (`0e23874`); pushed to `origin/main`
  (`cb9b408..8d0c4f9`).
- Cherry-picked an isolated Dialog-centering fix (`44d412e`, from sibling worktree
  `affectionate-gould-3f7f1d`) — landed as `ada1778`.
- **Sinag's call**: rather than merging the Management WIP branch as-is (which would have
  reintroduced its own top-level nav group and stale route names, conflicting with INV-16's
  merge — which had already restructured Management as a subgroup nested under Operations,
  with stub pages at `item-categories/` and `product-modifiers/`), the WIP implementations
  were ported onto the already-merged paths/exports instead. No functional changes — same
  CRUD, same RLS, same bugs-fixed — just re-homed onto current route/file names. Landed as
  `8d0c4f9`. The WIP session's own nav-group commit was left stashed (not merged, not
  deleted) in the `management-pages-populate-aa74ac` worktree.
- **Not touched, flagged only:** `docs/inventory-status-phase1-kickoff` (still ahead of its
  own `origin` copy) and sibling worktree `laughing-kilby-845118` (still based on the old
  `cb9b408`) were left as-is — out of scope for this pass, no unique work at risk.
