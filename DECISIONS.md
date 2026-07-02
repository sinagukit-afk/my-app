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
