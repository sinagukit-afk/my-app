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
