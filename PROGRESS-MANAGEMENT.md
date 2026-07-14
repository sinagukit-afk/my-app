# PROGRESS-MANAGEMENT.md

Tracks the **Management module** build (Item Categories, Product Modifiers, Stores) for Sinag
Ukit ERP. Follows the same convention as `PROGRESS-ITEMS.md`/`PROGRESS-CUSTOMERS.md`: `MGMT-`
prefixed phases, kept separate from the core `PROGRESS.md` numbering. Append-only.

Source: verbal kickoff from Sinag 2026-07-09 — "populate management/Product Modifier,
management/item category, and management/stores; should work the same way Loyverse populates
these pages; details should be modifiable." No separate kickoff doc — this file is
self-contained.

**Recovery note (2026-07-09):** MGMT-0 through MGMT-5 were built in worktree
`management-pages-populate-aa74ac` (session "Management pages population") but this file was
never committed to any branch — it only survived as untracked content in that worktree's stash.
The code itself was separately ported onto current `main` by the "Post-INV-16 view regression
assessment" session (MGMT-6 below), which changed the nav/route decisions this file originally
recorded. Recovered and reconciled against the actual shipped state on `main` (commit `8d0c4f9`)
below — MGMT-2/3/4's file paths and the MGMT-5 nav bullet have been corrected from their original
text; see MGMT-6 for what actually shipped and why.

---

## Locked decisions (read this before starting any phase)

- **Management stays a subgroup nested under Operations** (alongside Customer, Supplier, Item
  List, Couriers) — **not** a new top-level nav group. *(Corrected 2026-07-09 — see MGMT-6. The
  original MGMT-5 build added its own top-level group; that was superseded before merge because
  INV-16's merge into `main` had already restructured Management as an Operations subgroup with
  stub pages in place.)* Routes: `/dashboard/management/{item-categories,product-modifiers,stores}`.
- **Write access widened to admin/manager/encoder** (INSERT/UPDATE), admin/manager (DELETE) —
  matches `BUSINESS_RULES.md`'s general convention and the precedent CUST-1 set for `customers`.
  All three tables (`categories`, `modifiers`, `modifier_options`, `stores`) had **admin-only**
  RLS (`Admin full access ALL`) predating this feature, never brought in line with the general
  convention. Confirmed with Sinag before changing — see MGMT-1 below.
- **ERP-local only — no Loyverse push-back**, confirmed with Sinag (explicitly reverted from an
  initial "two-way push" answer mid-session). Categories and Modifiers stay one-way pull-synced
  exactly like `customers`. **Known risk, accepted:** if a category/modifier edited in ERP is
  later edited in Loyverse itself, the next nightly pull-sync (`Loyverse-Supabase` workflow,
  `Upsert Categories to Supabase` / `Upsert Modifiers and Options to Supabase` nodes) will
  overwrite the ERP edit with Loyverse's version. This only fires when Loyverse's own copy of
  that specific record changes — not on every sync run. Revisit if this becomes a real problem;
  the pattern to copy is `upsert_item` + `loyverse-item-push` webhook (see PROGRESS-ITEMS.md).
- **Stores has no Loyverse sync path at all today** — confirmed by inspecting the
  `Loyverse-Supabase` n8n workflow: there is no store pull-sync trigger and no store push. The
  single existing row (`CPR-B13L82`) was seeded outside this workflow. Loyverse's own API has no
  create/update endpoint for stores (list/read only), so this isn't a phase-1-vs-later scoping
  choice like categories/modifiers — **store edits in ERP can never sync to Loyverse**, full
  stop. The Store page is ERP-local by necessity, not by choice.
- **Archive, not hard delete, for categories and modifiers** — both already have `deleted_at`,
  matching the Items convention (ITEM-6). **`modifier_options` is missing `deleted_at`** despite
  sitting right next to `modifiers` in the same sync path — a small migration adds it (MGMT-1)
  so a stale option can be hidden without a dead-end: `order_item_modifiers`/
  `quote_item_modifiers` both hold a plain (non-cascading) FK to `modifier_options.id`, so
  hard-deleting an option ever used on a real order/quote would fail with `23503` anyway.
- **Stores keeps `is_active` toggle, no soft-delete column** — matches the existing column and
  the Suppliers pattern. Hard delete is offered too (guarded by catching `23503`, same as
  Suppliers), for a ERP-only store created by mistake.
- **No activity-log entries for these three** — matches the Suppliers/Customers tier (no
  logging), not the Items tier (which logs create/update/archive). These are lower-frequency
  master-data edits; add logging later if traceability turns out to matter.
- **`category_type` stays a required `product` / `packaging` choice** on the form — existing
  CHECK constraint (`categories_category_type_check`), unchanged; this is how the Items form
  already distinguishes sellable-item categories from packaging-component categories.
- **Modifier options are edited inline as repeatable rows on the Modifier form** (name + price),
  matching the variant-matrix UX already built for Items (ITEM-5) rather than a separate screen.

---

## MGMT-0 — Current-state audit (this session) ✅ DONE

**Status:** Complete 2026-07-09, before any code.

Findings (via `list_tables`/`execute_sql`/`pg_policies`/n8n `get_workflow_details`):

- No `/dashboard/management` route exists yet; no "Management" nav group in `app-shell.tsx`.
- `categories` (6 rows), `modifiers` (3 rows) + `modifier_options` (9 rows), `stores` (1 row) —
  all already populated by the daily Loyverse pull-sync (except `stores`, seeded once outside
  any workflow — see locked decisions above).
- No RPCs exist for any of the three tables — unlike `items`, which routes writes through
  `upsert_item`. Given the simplicity here (no stock/variant-matrix logic), plain server-action
  table writes (the Suppliers/Customers pattern) are the right fit, not a new RPC.
- RLS on all three (+ `modifier_options`) is `Admin full access ALL` only — no manager/encoder
  write policy, unlike the documented general convention. Same class of gap CUST-1 found on
  `customers`.
- `modifiers.raw` (jsonb) carries Loyverse's nested `modifier_options` with a `position` field,
  but the normalized `modifier_options` table has no `position` column — display order isn't
  currently controllable from ERP. Not blocking (no push-back in this phase to need it), noted
  for whoever adds Loyverse push-back later.
- Items' Add/Edit form (`app/dashboard/inventory/items/{new,[id]/edit}/page.tsx`) already reads
  `categories`/`modifiers` directly from these tables for its dropdowns — anything created here
  shows up there immediately, no wiring needed.

---

## MGMT-1 — Schema: RLS widen + `modifier_options.deleted_at` ✅ DONE

**Status:** Complete 2026-07-09.

Migration `mgmt1_categories_modifiers_stores_rls`:
- `categories`, `modifiers`, `modifier_options`, `stores`: added INSERT/UPDATE policies for
  admin/manager/encoder, DELETE policy for admin/manager. Existing `Admin full access ALL` /
  `Encoder read` / `Public read active` policies untouched.
- `modifier_options`: added `deleted_at timestamptz null`; updated `Public read active
  modifier_options` policy to also require `modifier_options.deleted_at IS NULL`.
- `get_advisors` (security): no new findings — same pre-existing SECURITY DEFINER +
  leaked-password-protection warnings as before.

Applied directly to the shared Supabase project (not branch-specific), so it was already live
before MGMT-6's port — no re-migration needed.

---

## MGMT-2 — Item Categories page ✅ DONE

**Status:** Complete 2026-07-09; ported onto its current path by MGMT-6.

`app/dashboard/management/item-categories/{page.tsx,item-categories-table.tsx,category-form.tsx,actions.ts}`
- List: Name (+ color swatch), Type (Product/Packaging badge), Source (Loyverse-synced vs
  ERP-only, based on `loyverse_category_id`), Status (Active/Archived), Actions.
- Form: Name (required), Type (Select, required), Color (Select from a fixed palette).
- Actions: `createCategory`, `updateCategory`, `archiveCategory`/`restoreCategory`
  (`deleted_at`) — no hard delete, matching Items.

**Verification:** Browser-tested via the Claude Code admin account — created, edited (color),
archived, and restored a real "Test Category MGMT" row end-to-end; DB-confirmed at each step.
No console errors.

## MGMT-3 — Product Modifiers page ✅ DONE

**Status:** Complete 2026-07-09; ported onto its current path by MGMT-6.

`app/dashboard/management/product-modifiers/{page.tsx,product-modifiers-table.tsx,modifier-form.tsx,actions.ts}`
- List: Name, Options (name + price badges), Source (Loyverse-synced vs ERP-only), Status,
  Actions.
- Form: Name (required) + repeatable Options rows (name + price, add/remove), matching the
  Items variant-matrix UX.
- Actions: `createModifier`/`updateModifier` (upserts the modifier row, then reconciles its
  `modifier_options` rows: insert new, update changed, soft-delete removed), `archiveModifier`/
  `restoreModifier`. Reconciliation only ever soft-deletes (never a hard `DELETE`), so the
  `order_item_modifiers`/`quote_item_modifiers` FK-restrict concern from MGMT-0 never fires in
  practice through this form.

**Two real bugs found and fixed during browser verification (not just test-harness noise):**
1. **Stale option rows on Edit** — `ModifierForm`'s option-rows state was initialized via
   `useState(() => seedRows(modifier))` in the outer component, which never re-runs when a
   different modifier is opened (only Radix's `DialogContent` children remount on open/close,
   not the outer form component holding the state). Editing any modifier showed "No options
   yet" instead of its real options. Fixed by giving `<ModifierForm key={editing?.id ?? "new"}>`
   in `product-modifiers-table.tsx`, forcing a full remount per modifier/add-mode.
2. **`modifiers.loyverse_modifier_id` and `modifier_options.loyverse_modifier_option_id` were
   `NOT NULL`** with no default — unlike `categories.loyverse_category_id` and
   `stores.loyverse_store_id`, which already allow null. This silently blocked creation of any
   ERP-only modifier (the exact scenario the "ERP-only" source badge exists for). Fixed via
   migration `mgmt2_modifiers_loyverse_id_nullable` (`DROP NOT NULL` on both columns; uniqueness
   preserved since Postgres allows multiple NULLs under a UNIQUE constraint).

**Verification:** Browser-tested via the Claude Code admin account — edited Keychain (added
then removed an option, confirmed soft-delete via DB, not hard-delete), created a real
"Test Modifier MGMT" with two options end-to-end, archived it. All steps DB-confirmed. No
console errors after the two fixes above.

## MGMT-4 — Stores page ✅ DONE

**Status:** Complete 2026-07-09; ported onto its current path (unchanged — `stores/` was
already the right route name) by MGMT-6.

`app/dashboard/management/stores/{page.tsx,stores-table.tsx,store-form.tsx,actions.ts}`
- List: Name, Address, Phone, Email, Source (Loyverse-linked vs ERP-only), Active toggle,
  Actions.
- Form: Name (required), Address, Phone, Email. `loyverse_store_id` shown read-only when
  present, never editable (external identifier, no Loyverse write path exists).
- Actions: `createStore`, `updateStore`, `setStoreActive`, `deleteStore` (guard `23503`,
  matching Suppliers — `receipts.store_id` references `stores`).

**Verification:** Browser-tested via the Claude Code admin account — created, deactivated, and
hard-deleted a real "Test Store MGMT" row end-to-end; DB-confirmed at each step. No console
errors.

## MGMT-5 — Nav + verification ✅ DONE (nav decision later superseded — see MGMT-6)

**Status:** Complete 2026-07-09, in the `management-pages-populate-aa74ac` worktree, against
`main` as it stood at `cb9b408` (2026-07-03).

- Added a new top-level "Management" nav group to `components/layout/app-shell.tsx` (new
  `TagIcon`): Item Categories, Product Modifiers, Stores — placed between Operations and
  Finance. **This nav change was never merged** — see MGMT-6; it was left stashed in the
  worktree once MGMT-6 reused the equivalent, already-merged Operations subgroup instead.
- `npm run build` — zero TypeScript errors, all three new routes compiled.
- Browser-verified all three pages end-to-end as the Claude Code **admin** account (see
  MGMT-2/3/4 above), then re-verified as the **encoder** test account: Edit is visible (Archive/
  Delete correctly hidden, admin/manager-only), and a real edit on "Test Category MGMT" saved
  successfully — confirms the widened RLS from MGMT-1 actually grants write access to a non-admin
  role, not just that the UI renders a button.
- **Left in database for inspection** (not rolled back, matching this project's convention):
  one test category ("Test Category MGMT", active) and one test modifier ("Test Modifier MGMT",
  archived, one option "Small +₱10").

## MGMT-6 — Port onto merged `main` ✅ DONE

**Status:** Complete 2026-07-09, session "Post-INV-16 view regression assessment"
(worktree `inv-16-view-regression-47fc89`, branch `claude/inv-16-view-regression-47fc89`),
landed as commit `8d0c4f9`.

**Context:** MGMT-0 through MGMT-5 were built against `main` as it stood at `cb9b408`
(2026-07-03) — six days stale, missing `INV-1..16`, the Order module rebuild, `QUOTE-1..7`, and
`PS-18..22`, none of which that worktree ever saw. Separately, this "view regression" session was
investigating why a fresh worktree/session showed a stale sidebar and diagnosed the root cause as
a **merge gap, not a code regression**: `main` (local and `origin`) had never been fast-forwarded
past `cb9b408`, while all real work since had been happening on a different branch
(`docs/inventory-status-phase1-kickoff`) that was never merged back. See
`project_main_branch_merge_gap_2026_07_09` memory for the full fix.

As part of fixing that gap, this session:
1. Fast-forwarded local `main` to the INV-16 tip (`0e23874`).
2. Cherry-picked the isolated Dialog-centering fix (`44d412e`, from sibling worktree
   `affectionate-gould-3f7f1d`) — landed as `ada1778`.
3. **Reconciled this module's WIP onto the now-current `main`** instead of merging the WIP
   branch as-is, because INV-16's own merge had already restructured Management as a subgroup
   nested under Operations (alongside Customer, Supplier, Item List, Couriers), with stub pages
   already scaffolded at `item-categories/` and `product-modifiers/` (`stores/` was already a
   stub at the matching path).

**Decision — supersedes the MGMT-5 nav bullet:** keep the already-merged nav as-is. Management
stays a subgroup under Operations, not a new top-level group. Route names are
`/dashboard/management/item-categories` and `/dashboard/management/product-modifiers` (not this
doc's original `/categories`/`/modifiers` — `stores` was already correct). The full CRUD
implementations (`actions.ts`, `*-form.tsx`, `*-table.tsx`) were ported onto these existing
paths/exports with no functional changes from MGMT-2/3/4 above — just re-homed onto the current
file/route names. `management-pages-populate-aa74ac`'s own nav-group commit (the one described in
MGMT-5) was left stashed rather than merged, since `main` already had the equivalent, better-
organized navigation.

4. Pushed `main` to `origin/main` (`cb9b408..8d0c4f9`) — now current through INV-16 + the Dialog
   fix + MGMT-2/3/4.

**Not yet done:**
- `DECISIONS.md` has no entry for this port/reconciliation decision — should be added (D043).
- `MODULE_STATUS.md` still describes Item Categories/Product Modifiers/Stores as read-only or
  not-yet-built placeholders — stale, needs updating to reflect MGMT-2/3/4/6.

---

## Open items / not built

- **No display-order control for modifier options** — `modifiers.raw` (Loyverse's jsonb copy)
  carries a `position` field per option, but the normalized `modifier_options` table has no
  `position` column. Not blocking today (no Loyverse push-back in this phase), but whoever adds
  push-back later needs it.
- **Two test rows left live in the database** — "Test Category MGMT" (active) and
  "Test Modifier MGMT" (archived, one option) — intentionally not rolled back, matching this
  project's verification convention, but worth a cleanup pass before this data is shown to a
  real user.
- **No activity-log entries for categories/modifiers/stores edits** — accepted tradeoff (see
  locked decisions), revisit only if traceability becomes a real need.
