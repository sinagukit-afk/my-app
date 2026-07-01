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
