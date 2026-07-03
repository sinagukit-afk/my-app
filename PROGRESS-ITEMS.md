# PROGRESS-ITEMS.md

Tracks the **Item List** feature build for Sinag Ukit BMS. Follows the same convention as `PROGRESS-ACCOUNTING.md`: `ITEM-` prefixed phases, kept separate from the core `PROGRESS.md` numbering to avoid conflicts. Append-only. Each phase closes with a manual commit gate.

Note: this doc originally framed itself as a prerequisite for Phase 11 (Suppliers) and Phase 12 (Stock Movement/Item Adjustment) — both are already 🟩 Complete per `MODULE_STATUS.md`, so that framing is stale. This feature now stands on its own: it extends `items`/`item_variants` for full Loyverse parity and BMS-side write access, independent of those already-shipped screens.

Claude Code already has the n8n MCP connected (full read/write access, draft-save boundary confirmed) — any phase below that needs an n8n workflow should be built directly through that connection, not scaffolded as a separate manual step.

---

## Locked decisions (read this before starting any phase)

- **Sync direction:** BMS is source of truth for items going forward. Create/Edit in the BMS pushes to Loyverse via API. Existing pull-sync (Loyverse → Supabase) switches from polling to **webhook-driven** to avoid races with newly-pushed items. This scopes a confirmed exception to D001/D008 for items specifically — recorded as D020 in `DECISIONS.md`; D001/D008 still stand for everything else (e.g. receipts stay manual).
- **Variants:** multi-option support required now (option1/2/3 name + value), not deferred.
- **Images:** out of scope. `image_url` stays as-is (synced value or null). No upload UI.
- **Tax:** out of scope for this build. No `tax_ids` modeling yet.
- **Modifiers:** **read-only** in the BMS. Assign existing Loyverse-managed modifier lists to items only — no create/edit of modifier lists themselves (still managed in Loyverse backoffice). Loyverse-side modifier deletes must reflect as soft-delete in Supabase (`modifiers.deleted_at` already supports this).
- **Composite items:** simple auto-decompose-at-sale model only. No Production/Disassembly workflow (Loyverse's Advanced Inventory feature — not subscribed to). `track_stock` is disabled/forced-off for composite items in the BMS. `use_production` is pulled from Loyverse passively (read-only, informational) but no BMS logic acts on it.
- **Advanced Inventory fields** (`use_production`, `purchase_cost`/`default_purchase_cost`, primary-supplier auto-fill): pull-only sync from Loyverse, never pushed from BMS, no edit UI.
- **Cost fields:**
  - `item_variants.cost` — existing column, stays editable in BMS, maps to Loyverse's regular "Cost" field.
  - `item_variants.default_purchase_cost` — **new** column, pull-synced from Loyverse's `purchase_cost`, read-only in BMS UI, never pushed back.
  - `purchase_order_items.unit_cost` — existing column, already editable per PO line ("actual cost"). Prefill from `default_purchase_cost` when adding a line item, but leave fully editable. No schema change needed here.
- **Cost visibility:** shown to all roles including `viewer` — not restricted like other financial tables.
- **Required fields on Add/Edit:** `item_name`, `category_id`, SKU (confirmed required by Loyverse itself), `item_type`, `pricing_type`. `default_price` required only if `pricing_type = FIXED`. Composite items require at least one component row.
- **Stock editing boundary:** the item Add/Edit form can *set initial stock* on create (routed through `adjust_stock()`, not a raw insert). On edit, on-hand quantity is **read-only display only** — real adjustments happen through the Phase 12 Stock Movement screen, to preserve the `inventory_movements` audit trail.
- **Delete policy:** soft-delete/archive only. Items are FK'd from receipts, orders, and POs — no hard delete.
- **Permissions:** admin/manager write access enforced at the RLS level, not just hidden in the UI. All roles can read.
- **Bulk CSV import/export:** skipped for this build.
- **`reference_id` / `reference_variant_id`:** unresolved, not investigated, not modeled. Skip.

---

## ITEM-0 — Pull & audit real Loyverse data ✅ DONE

**Status:** Complete (2026-07-03).

Confirmed via `sync_state`: `modifiers` and `discounts` resources pulled successfully. New tables landed:
- `modifiers` (id, loyverse_modifier_id, name, raw jsonb, created_at, updated_at, **deleted_at**) — 9 rows
- `modifier_options` (id, modifier_id → modifiers.id, loyverse_modifier_option_id, name, price, created_at, updated_at) — no `deleted_at` yet, acceptable since options live under a parent list

Confirmed field-level findings from real `items.raw` payloads (59 items):
- `item_name` and SKU: always present (0 missing) → hard requirements
- `barcode`: never used (all 59 null) → optional, low priority
- `default_price`: null on 55/59 items → most items use `pricing_type: VARIABLE` (quote-based), confirming price cannot be a blanket-required field
- `cost`: missing on 22/59
- `tax_ids`: present as empty arrays, no populated example found — confirms deferring tax is safe, nothing to model against yet
- `modifier_ids`: confirmed array of Loyverse modifier IDs on items (e.g. multiple items share the same modifier), but only the reference existed pre-pull, not the definitions

**Note:** `discounts` was also pulled as a side effect of the same sync run. Not part of this feature — flag for a future decision on whether/how to use it, don't build against it here.

---

## ITEM-1 — Schema additions ✅ DONE

**Status:** Complete (2026-07-03). Migration `item1_schema_additions` applied.

**Objective:** extend existing tables so they can fully represent Loyverse item data plus BMS-specific sync/audit needs. Reminder: `items`, `item_variants`, `item_components`, `categories`, `modifiers`, `modifier_options` already exist — this phase is additive, not a fresh build.

**Tasks:**
1. `items` — add `option1_name`, `option2_name`, `option3_name` (text). Loyverse stores option *labels* at item level; variant-level `option1_value` etc. already exist.
2. `items` and `item_variants` — add sync tracking: `sync_status` (`local_only` / `pending` / `synced` / `failed`), `sync_error` (text), `loyverse_synced_at` (timestamptz).
3. `item_variants` — add `default_purchase_cost` (numeric, nullable) — pull-only from Loyverse's `purchase_cost`.
4. `items` — add `primary_supplier_id` (uuid, FK → `suppliers.id`, nullable).
5. `items` — add `use_production` (boolean, default false) — pull-only, informational.
6. New table `item_modifiers` — junction table: `item_id` (FK → items), `modifier_id` (FK → modifiers), `created_at`. Backfill from existing `items.raw->'modifier_ids'` matched against `modifiers.loyverse_modifier_id`.
7. Partial unique indexes: `item_variants.sku` and `item_variants.barcode`, where not null and not deleted — Loyverse enforces uniqueness, current schema doesn't.
8. RLS policies for all new/modified tables: `items_select` / `items_insert` / `items_update` following the `{table}_{action}` naming convention. Write restricted to `admin`/`manager` via `current_user_role() = any(array['admin','manager']::user_role[])`. Read open to all roles.
9. `item_modifiers` — read-only from the app's perspective (no insert/update policy needed beyond what the sync process uses), but still needs a select policy for all roles.

**Manual commit gate:** ✅ migration applied, RLS verified per role (test as admin, manager, encoder, cashier, viewer), backfill row counts sanity-checked against the 59 existing items.

**Results:**
- All 8 columns/tasks landed: `items.option1_name/2/3`, `items`+`item_variants` sync tracking (`sync_status`/`sync_error`/`loyverse_synced_at`), `item_variants.default_purchase_cost`, `items.primary_supplier_id` (FK → suppliers), `items.use_production`, new `item_modifiers` junction table.
- Backfill: all 59 items + 59 variants already had `loyverse_item_id`/`loyverse_variant_id` populated → backfilled to `sync_status = 'synced'`. `item_modifiers` backfilled from `raw->'modifier_ids'` matched to `modifiers.loyverse_modifier_id`: 9 rows across 9 items (all matched cleanly against the 3 existing modifiers, no orphans).
- Partial unique indexes on `item_variants.sku`/`barcode` (where not null, not deleted) — pre-checked, zero existing duplicates, applied clean.
- RLS: replaced the legacy `"Admin full access items"` / `"Encoder read items"` / `"Public read available items"` policies (which had no write path for `manager` at all, and restricted non-admin/encoder reads to available-for-sale only) with `items_select`/`items_insert`/`items_update` and the `item_variants` equivalents, per the `{table}_{action}` convention. `item_modifiers_select` added (read-only table, no write policy — sync writes go through service_role). Verified directly against Postgres per role: admin/manager insert succeeds, encoder/cashier/viewer insert blocked (`42501: new row violates row-level security policy`), viewer read returns all 59 items/variants + item_modifiers.
- `get_advisors` (security) run post-migration: no new findings introduced; all existing warnings are pre-existing SECURITY DEFINER RPC / leaked-password-protection items unrelated to this change.

---

## ITEM-2 — Loyverse push integration (n8n) ✅ DONE (branch-level; BMS not wired yet)

**Status:** Complete 2026-07-03. Workflow branch built and live-tested against the real Loyverse account in `Loyverse-Supabase` (id `F6CfXnxji98Y75JJ`, still inactive/test-phase — only this new branch was exercised, not the whole workflow). No BMS code calls this yet; that's ITEM-3's job, which is why "create a test item in BMS" in the commit gate below is marked as deferred rather than literally done — the equivalent (push a real item, confirm it lands in Loyverse) was verified directly against the webhook.

**Live test result (2026-07-03, item `Inv-Addon Box, Bottle opener`):** POSTed `{item_id}` to the test webhook → `200 {"status":"synced","item_id":"78a2938f-...","loyverse_item_id":"167975f3-...","error":null}`. Confirmed in Supabase: both `items` and `item_variants` rows show `sync_status='synced'`, `sync_error=null`, `loyverse_synced_at` populated, correct `loyverse_item_id`/`loyverse_variant_id`. This exercised the **update** path (item already had a `loyverse_item_id`) — the **create** path (no existing `loyverse_item_id`) is the same code path with `payload.id` omitted, not separately live-tested, but low-risk since it's the simpler branch.

**Bugs found and fixed via the live test (would not have been caught by code review alone):**
1. **Wrong HTTP method.** Used `PUT /items/{id}` for updates, assuming a REST-conventional route. Loyverse has no PUT/PATCH route for items at all — confirmed via the Loyverse PHP SDK source (`siarheipashkevich/loyverse-sdk`, `ManagesItems.php`): `createItem()` uses `POST /items` only, and the docblock explicitly says "Create or update a single item." Fixed: always `POST https://api.loyverse.com/v1.0/items`, with `payload.id` set to `loyverse_item_id` when updating (upsert-by-body-id semantics, not upsert-by-URL).
2. **The `=` expression-prefix bug documented as unfixed in the `bms-supabase` skill (and believed already-fixed based on an earlier read of this workflow) reappeared on 9 nodes**, including the new `Write Back Item Sync Result to Supabase` node — `query` params reading literal `"{{ $json.query }}"` instead of `"={{ $json.query }}"`. Root cause unclear (possibly a save-conflict when the n8n editor tab was open in the browser at the same time as an MCP edit — the tool returned "Cannot modify workflow while it is being edited by a user in the editor" right before this appeared). Fixed all 9 affected nodes. **Takeaway: re-check this class of bug after any session where the n8n editor UI was open concurrently with MCP edits — don't assume a previously-confirmed fix stays fixed.**

**Objective:** when an item is created/edited in the BMS, push it to Loyverse and keep sync state honest. Build via the connected n8n MCP in Claude Code — no manual workflow scaffolding needed outside that.

**What was built — new nodes in `Loyverse-Supabase`** (linear chain, no branching nodes — see "n8n tool limitation" below):
`Item Push Sync Trigger` (webhook, `POST /webhook/loyverse-item-push`) → `Fetch Item for Push` (reads the full item+variants+components row from Supabase by `item_id`) → `Build Loyverse Item Payload` (shapes the Loyverse upsert body; includes `id` = `loyverse_item_id` when one already exists) → `Push Item to Loyverse` (always `POST /v1.0/items` — Loyverse has no PUT/PATCH route, see bugs below; `onError: continueRegularOutput`) → `Build Sync Write-Back SQL` (branches in-code on `$json.error`, builds either a `sync_status='failed'` update or a `sync_status='synced'` update for the item + all its variants, matched back to Loyverse's returned variant IDs by SKU) → `Write Back Item Sync Result to Supabase` (executes it) → `Respond Item Push Result` (returns `{status, item_id, loyverse_item_id, error}` as the webhook response, 200 on success / 502 on failure).

**Webhook contract for ITEM-3:** after committing the create/edit transaction, POST `{ "item_id": "<items.id uuid>" }` to the `loyverse-item-push` webhook. The workflow does its own Supabase read (source of truth is the DB row, not whatever payload shape the caller sends) — ITEM-3 doesn't need to duplicate the Loyverse field mapping.

**n8n tool limitation discovered:** the n8n MCP's `update_workflow` `addConnection` operation cannot target a node's non-zero output port — `sourceOutput`/`targetInput` are silently ignored and every connection lands on output 0, confirmed by direct testing. This blocks the standard `onError: continueErrorOutput` dual-output pattern (and would equally block `IF`/`Switch` branching) when building via this operations API. Worked around by using `onError: continueRegularOutput` (single output, error surfaces as `$json.error`) and doing the success/failure branch *inside* a Code node instead of the node graph. Worth remembering for any future n8n workflow edits via this tool.

**Resolved during build:**
1. **Credential.** The MCP tool's `setNodeCredential` operation rejected the HTTP Request node's generic-auth credential type (`httpBearerAuth` via `genericCredentialType`) outright — couldn't be set via the tool. Sinag attached the `Loyverse Items` credential manually in the n8n editor (Credential dropdown on the node).
2. **Live test.** Run with Sinag's explicit go-ahead (this pushes to the real Loyverse catalog) — see "Live test result" above.
3. Pull-sync guard verified by code review (SQL semantics are unambiguous — see task 4 below) rather than by provoking a real race under timing; acceptable given the guard is a simple `WHERE local.updated_at < incoming.updated_at` comparison.

**Task 4 — pull-sync race guard: DONE, using the fallback (not full webhook migration).** Corrected finding: Loyverse's API *does* support outbound webhooks (confirmed via `developer.loyverse.com/docs/#section/Webhooks-overview`, `ITEM_UPDATED` event, since Jan 2021) — the original task text's "if not" framing was wrong to assume. Full webhook-driven pull-sync was **not** built this round: registering a webhook subscription with Loyverse and adding signature verification is a meaningfully bigger, separate piece of work with an external-service dependency (needs Sinag in the Loyverse dashboard). Instead, implemented the task's own documented fallback: `Build Items Upsert SQL` and `Build Variants Upsert SQL` now skip the `ON CONFLICT DO UPDATE` when the local `updated_at` is already newer than the incoming Loyverse item's own `updated_at` (`WHERE public.items.updated_at < <loyverse item.updated_at>::timestamptz`, same for `item_variants`). This fully satisfies the race-condition requirement (a stale poll payload can never clobber a fresher local row) without the external dependency. Revisit full webhook-driven pull as a fast-follow if the 15-minute poll window (worst case) ever becomes a real problem.

Composite item push (task 5) and modifier no-push (task 6) are handled as designed: `Build Loyverse Item Payload` includes a `components` array only for `item_type = 'composite'` items, and there's no `item_modifiers` push logic anywhere in the new branch.

**Manual commit gate:** ✅ satisfied at the branch level (live test above: pushed a real item, confirmed in Supabase it landed as `synced` with correct Loyverse IDs). Full gate as originally written ("create a test item **in BMS**") is deferred to ITEM-3/ITEM-5, once there's an actual form to create one through — re-verify the round trip once that exists, since this is currently only proven at the n8n-webhook layer, not the full BMS→n8n→Loyverse path.

---

## ITEM-3 — Backend CRUD ✅ DONE

**Status:** Complete (2026-07-03). Migration `item3_backend_crud` applied. Built as a `SECURITY DEFINER` RPC (`public.upsert_item`), per the project's stock-change convention, rather than a server-action transaction. The thin Next.js server action that calls this RPC and then POSTs `{item_id}` to the `loyverse-item-push` webhook is deferred to ITEM-5 (nothing calls the RPC from app code yet — that wrapper belongs with the form).

**Gap found & fixed during preflight:** `pricing_type` existed nowhere in the schema, even though the locked decisions require `default_price` validation conditional on it — missed in ITEM-1. Confirmed against real `items.raw` payloads that Loyverse models it **per-variant** (`default_pricing_type` on each variant), not per-item as this doc's original wording implied. Resolved (Sinag confirmed): added `item_variants.pricing_type` (`FIXED`/`VARIABLE`, default `VARIABLE`, check-constrained), backfilled from `raw->'variants'->default_pricing_type` — result matches the ITEM-0 audit exactly (4 FIXED all with prices, 55 VARIABLE all null-priced).

**What was built (migration `item3_backend_crud`):**
1. `item_variants.pricing_type` column + backfill (above).
2. `item_components` RLS rewrite — the legacy policies (`Admin full access` / `Encoder read` / `Service role only`) had no manager write path and blocked manager/cashier/viewer reads entirely, violating both locked decisions. Replaced with `item_components_{select,insert,update,delete}` per the `{table}_{action}` convention: read all roles, write admin/manager.
3. `public.upsert_item(...)` RPC — single transaction covering all six tasks:
   - Upserts `items`, then `item_variants` (matched by `id` on edit; new rows inserted; variants dropped from the matrix are **soft-deleted**), then `item_components` (replace-set per composite variant).
   - Initial stock on create routed through `adjust_stock()` per variant (verified the function body first: it does the level-upsert + movement insert as `movement_type='manual_adjustment'`, reason/note concatenated — acceptable, no raw `inventory_levels` writes anywhere).
   - `track_stock` forced `false` server-side when `item_type='composite'`, regardless of caller input.
   - SKU/barcode uniqueness enforced with clear errors (within-payload dupes and against existing live rows), backed by the ITEM-1 partial indexes.
   - `default_price` required per-variant iff `pricing_type='FIXED'`.
   - On edit, stock input is ignored entirely (`initial_stock` only read on create); sets `sync_status='pending'` + clears `sync_error` on item and touched variants, ready for the ITEM-2 webhook push.
   - Composite items require ≥1 component per variant; role check `admin`/`manager` inside the RPC (defense-in-depth on top of RLS).

**ITEM-2 follow-through:** the n8n push branch (`Fetch Item for Push` + `Build Loyverse Item Payload`) was built before `pricing_type` existed and pushed variants without `default_pricing_type` — a FIXED/VARIABLE mismatch would have landed in Loyverse. Both nodes updated via n8n MCP to carry it through. Post-edit re-scan of the whole workflow for the `=` expression-prefix bug class (per ITEM-2's takeaway): clean, no regressions.

**Manual commit gate:** ✅ all verified directly against Postgres via the RPC (bypassing UI), with JWT claims set per test account:
- Simple item (admin): created with initial stock 15 → `inventory_levels.in_stock=15` + one `manual_adjustment` movement. ✅
- Variant item (manager): 2-variant option matrix landed. ✅
- Composite item (admin): `track_stock=true` submitted → stored `false`; both component rows landed with quantities. ✅
- Edit: cost/price updated; `initial_stock: 999` in the edit payload ignored (stock stayed 15, no new movement); dropping a variant from the matrix soft-deleted it, adding one inserted it. ✅
- Rejections: FIXED-without-price, duplicate SKU (against live rows), composite-without-components all raise clear errors; encoder/cashier/viewer all blocked (`Not authorized`). ✅
- All test rows deleted afterward; table counts back to exactly 59 items / 59 variants. `get_advisors` (security): no new findings (only the pre-existing SECURITY DEFINER RPC warnings, which `upsert_item` now shares with `adjust_stock` et al. by design).

**Testing gotcha worth remembering:** calling the RPC as `SELECT (upsert_item(...)).*` evaluates the function **once per output column** in Postgres — the second implicit invocation saw the first's uncommitted SKU insert and raised a bogus "SKU already in use", then rolled everything back. Use `SELECT * FROM upsert_item(...)` when testing RPCs via `execute_sql`.

---

## ITEM-4 — Item List screen ✅ DONE (pending commit gate sign-off)

**Status:** Built and verified 2026-07-03. Awaiting Sinag's manual commit.

**Objective:** the main list view.

**Tasks:**
1. Table columns: name, category, SKU(s), price (or price range if multi-variant), stock (if tracked), item_type, sync status.
2. Filters: name search, category, status, item_type. Status derived from `is_available_for_sale` + `deleted_at` — no new status column needed.
3. Surface `sync_status = 'failed'` items visibly (e.g. a badge), matching ITEM-2's error visibility requirement.
4. Pagination.
5. Role-gated "Add Item" button (admin/manager only) — but list itself visible to all roles per the locked read-access decision.

**Manual commit gate:** filters verified against real data (all 59+ items), sync-failure state visible when deliberately triggered.

**Decisions made at phase start (Sinag, 2026-07-03):** nav placement = Inventory → "Item List", first entry (`/dashboard/inventory/items`); status filter defaults to all non-archived (Archived is an explicit filter chip); Add Item links to a live stub page at `/new` ("form ships with ITEM-5") so routing + role gating are testable now; sync-failure badge verified by temporarily flipping one real row and reverting.

**What was built:**
- `app/dashboard/inventory/items/page.tsx` (server: fetch + row mapping incl. price label and stock rollup) + `items-table.tsx` (client: columns, status chips via `FilterBar`, category/type `Select`s, sync badges) + `new/page.tsx` (role-gated ITEM-5 stub). Nav entry added to `AppShell`. Columns: name, category, SKU (+n more for multi-variant), price (FIXED price / range / "Variable"), stock (summed across variants; "—" when untracked, incl. composites), type, status, sync. Pagination via the shared `DataTable` (10/page).
- **Migration `item4_list_visibility_rls`** — two gaps found during preflight, same legacy-policy class as ITEM-1/3's findings:
  1. `items_select` / `item_variants_select` were hard-filtered to `deleted_at IS NULL` for *everyone* (admin included) — the spec's Archived status filter (and ITEM-6's archive/restore) would have been dead code. Now: non-archived visible to all roles, archived rows additionally visible to admin/manager only.
  2. `inventory_levels` SELECT was admin/encoder only — the stock column would have been blank for manager/cashier/viewer, violating the locked all-roles-read decision. Replaced legacy `"Encoder select inventory_levels"` with `inventory_levels_select` (all roles), per the `{table}_{action}` convention.
  - Because archived items/variants became visible to admin/manager, the six existing item pickers that relied purely on RLS to hide them (PO new/detail, adjustment, quotes new/edit, order edit) got explicit `.is("deleted_at", null)` + `.is("item_variants.deleted_at", null)` filters — no behavior change today (0 archived rows), just defense-in-depth per the app conventions.

**Gate verification (2026-07-03, browser preview + direct Postgres):**
- All 59 items render with correct columns; pagination footer paging works (11–20 of 59 on page 2).
- Filters against real data: category Product → 18; status Available → 27 (= 59 − 32 not-for-sale); type Composite → 22; search "bottle opener" → 4; Archived → empty state (0 archived rows exist).
- Sync-failure visibility: flipped one real item to `sync_status='failed'` with a test error → red "Failed" badge + truncated error text + full error in hover title; reverted to exact prior state (`synced`/`NULL`) and confirmed in UI.
- Roles: admin sees Add Item + Archived chip + stub page; encoder sees the full list incl. stock but no Add button, no Archived chip, and the stub page rejects with a permission message. Direct Postgres with per-role JWT claims: manager/cashier/viewer all see all 32 `inventory_levels` rows and all 59 items; a deliberately-inserted archived test item+variant visible to manager, invisible to viewer/cashier; test rows hard-deleted after, counts back to exactly 59/59.
- `npx tsc --noEmit` clean; patched picker pages (adjustment, quotes/new) re-loaded without errors; `get_advisors` (security): no new findings (only the pre-existing SECURITY DEFINER RPC + leaked-password-protection warnings).

---

## ITEM-5 — Add/Edit form ✅ DONE (pending commit gate sign-off)

**Status:** Built and verified 2026-07-03. Awaiting Sinag's manual commit.

**Objective:** the form itself, matching Loyverse field-for-field per the locked decisions.

**Tasks:**
1. Core fields: name, category, description, item_type (simple/composite), sold_by (each/weight), track_stock (disabled when composite), is_available_for_sale, primary_supplier_id, pricing_type.
2. Variant matrix editor: option name/value inputs (up to 3 options) → auto-generates variant rows with editable SKU/barcode/cost/price per combination, matching Loyverse's own variant generation behavior.
3. Composite component sub-editor: pick component variant + quantity, reusing `item_components`. Enforce max 3-level nesting to match Loyverse.
4. Modifier assignment picker: multi-select from existing `modifiers` (read-only list, no create) → writes to `item_modifiers`.
5. `default_purchase_cost` shown read-only (grey/disabled) when present.
6. Initial stock quantity input — visible only on create, only when `track_stock = true`; hidden entirely on edit (replaced by a link to the Stock Movement/adjustment screen).
7. Cost field visible and editable for all roles per the locked decision (no role-based hiding here, unlike other financial forms).

**Three conflicts found and resolved with Sinag before building (see plan/session):**
1. `primary_supplier_id` — Locked Decisions said pull-only/no-edit-UI; task list said it's a core editable field. **Resolved: editable** (Sinag's call).
2. Modifier assignment — `item_modifiers` had zero write RLS and the n8n push never sent `modifier_ids` to Loyverse, so a BMS assignment would never reach the POS. **Resolved: extended the push** (see below) so assignments actually take effect.
3. Composite nesting — no depth tracking existed in `item_components`, and 0 of the 59 real items nest a composite inside a composite today. **Resolved: built real recursive depth + cycle validation** per spec, not simplified away.

**What was built:**
- **Migration `item5_modifiers_and_nesting`** (+ a same-session follow-up fix, `item5_fix_upsert_item_overload_and_depth`) extends `upsert_item`:
  - New `p_modifier_ids uuid[]` param — replace-sets `item_modifiers` for the item in the same transaction as the rest of the save.
  - Recursive-CTE nesting validation on every composite component: rejects if the component's own subtree is already >2 deep (i.e. this save would exceed 3 total levels), and rejects any cycle back to a variant of the item being saved. Verified directly: a 3-level chain (composite → composite → simple) saves cleanly; a 4th level and a direct cycle (editing a composite to use its own descendant as a component) both raise clear errors.
  - **Gotcha hit and fixed during this migration:** `CREATE OR REPLACE FUNCTION` with a newly-appended parameter does **not** replace the old function — Postgres treats a different parameter-count signature as a new overload, silently leaving the old (no modifier/nesting logic) 15-arg version callable alongside the new 16-arg one. Had to explicitly `DROP FUNCTION` the stale signature. Also caught and fixed an off-by-one in the nesting-depth CTE on first pass (it under-counted by one level, which would have silently allowed 4-level nesting) — caught by tracing a concrete 4-item chain before trusting it, not just by inspection.
  - `item_modifiers_insert`/`item_modifiers_delete` RLS policies added (admin/manager), matching the `item_components` convention — the RPC is `SECURITY DEFINER` so this is defense-in-depth, not load-bearing.
- **n8n workflow (`F6CfXnxji98Y75JJ`):** `Fetch Item for Push` now also selects `modifier_ids` (joined through `item_modifiers`/`modifiers`, filtered to non-deleted); `Build Loyverse Item Payload` now includes `payload.modifier_ids` so BMS-assigned modifiers actually sync to Loyverse/POS, not just local bookkeeping.
  - **Recurring bug caught mid-session:** the `=` expression-prefix bug documented in ITEM-2/ITEM-3 (params reading literal `"{{ $json.query }}"` instead of `"={{ $json.query }}"`) had reappeared on **9 nodes**, including `Write Back Item Sync Result to Supabase` — which would have silently broken the entire push write-back path, not just something I touched. Fixed all 9. Per ITEM-2's own takeaway, this class of bug needs re-checking after any session with concurrent n8n editor + MCP access — confirmed again here.
- **`lib/integrations/n8n/index.ts`** — implemented the previously-stubbed `triggerWorkflow()`; added `N8N_WEBHOOK_BASE_URL` to `.env.local` (gitignored). Missing-env-var and fetch failures are soft-skips (logged, not thrown) since `sync_status` staying `pending` is a safe, retryable state.
- **`app/dashboard/inventory/items/actions.ts`** (new) — `upsertItem()` server action: calls the RPC, triggers the Loyverse push webhook on success, revalidates the list.
- **`app/dashboard/inventory/items/item-form.tsx`** (new) — shared create/edit client component modeled on the existing PO/adjustment form patterns (`ItemRow[]`-style dynamic rows, `Select`/`Checkbox`/`CurrencyInput`/`NumberInput`/`Input` from `components/ui`). Variant matrix generates cartesian-product rows from up to 3 option value-lists, diffing against existing rows by option-tuple on edit so unchanged combinations keep their `id`/data. Composite component sub-editor renders per variant row (schema keys components by `composite_variant_id`, not per-item). Modifier picker is a `Checkbox` list (no multi-select combobox exists in this codebase, so this matches the established pattern). `default_purchase_cost` shown as a disabled `CurrencyInput` only when present. Initial-stock input only on create when tracked; edit mode shows current stock + a link to the real `/dashboard/inventory/adjustment` screen (Phase 12 already shipped, so the "stub link" language in this doc's task 6 was stale).
  - **Bug caught before verification:** the shared `Checkbox` component doesn't forward a `name` prop to its underlying `<input>`, so `is_available_for_sale`/`track_stock` would have silently never reached `FormData` if left as originally written (uncontrolled + `name=`). Fixed by controlling both in state and setting them explicitly in the submit handler.
- **`app/dashboard/inventory/items/new/page.tsx`** — replaced the ITEM-4 stub with the real create form (categories/suppliers/modifiers/component-picker options fetched server-side).
- **`app/dashboard/inventory/items/[id]/edit/page.tsx`** (new route) — fetches the item, its variants (+ `inventory_levels`, `default_purchase_cost`), its components (disambiguated via the two named FKs on `item_components`, since PostgREST can't infer which one without a hint), and assigned modifiers. `items-table.tsx` gained an admin/manager-only "Edit" link per row.

**Gate verification (2026-07-03, browser preview + direct Postgres):**
- Created a simple item end-to-end through the browser as the admin test account: landed in Postgres with `sync_status='pending'`, correct category/SKU, showed correctly in the Item List (price "Variable", stock "—", "Pending" sync badge).
- Edited that same item through the browser: form pre-filled correctly (name, SKU, etc.), checked a modifier, saved — confirmed in Postgres the `item_modifiers` row landed correctly.
- Role check: signed in as the real `encoder` test account — both `/new` and `/edit` routes render the permission-denied message (no bypass), and calling `upsert_item` directly as encoder via SQL raises `Not authorized to create or edit items`.
- Nesting/cycle/modifier-replace-set logic verified directly against Postgres (see migration section above) with a real 4-item composite chain, not just unit-level reasoning.
- No real Loyverse push occurred during testing — confirmed the push workflow is still inactive (test-phase, per ITEM-2), so the webhook call the create/edit action fires is a harmless no-op right now. Full BMS→n8n→Loyverse live round trip (closing out ITEM-2's deferred gate too) still needs Sinag's explicit go-ahead before activating the workflow.
- All test rows cleaned up afterward; `items`/`item_variants` counts back to exactly 59/59. `npx tsc --noEmit` clean. `get_advisors` (security): no new findings (only the pre-existing SECURITY DEFINER RPC + leaked-password-protection warnings).

**Manual commit gate:** outstanding items before Sinag signs off — (1) decide when to activate the n8n push workflow for a real Loyverse round trip, (2) spot-check the variant-matrix generate/diff UX and composite component sub-editor directly (covered at the RPC level in this session, not yet clicked through in the browser for a multi-variant/composite item specifically).

---

## ITEM-6 — Permissions, archive & audit ✅ DONE (pending commit gate sign-off)

**Status:** Built and verified 2026-07-03. Awaiting Sinag's manual commit.

**⚠️ Side effect requiring Sinag's attention — a real Loyverse test item was created live during this phase's verification, see below.**

**Objective:** confirm write RLS, add an archive action, and audit-log item CRUD.

**Audit table confirmed:** `activity_logs` (existing table, already used by D006 for quote edits — `user_id`, `action`, `entity_type`, `entity_id` (text), `description`, `metadata` jsonb). No DB-level `log_activity()` helper exists anywhere; all existing call sites insert directly from the server action, so `items/actions.ts` follows that same pattern rather than introducing a new convention. The `activity-logs-table.tsx` UI already had dead `create_item`/`update_item` badge entries pre-built from ITEM-4-era planning — now live. Added an `archive_item` badge entry (danger/red).

**What was built:**
1. **Migration `item6_archive_item_rpc`** — new `public.archive_item(p_item_id uuid)` RPC, `SECURITY DEFINER`, same role-check pattern as `upsert_item` (`admin`/`manager` only, raises `Not authorized to archive items` otherwise). Sets `items.deleted_at = now()` and cascades to all still-live `item_variants` for that item in the same statement (soft-deleting the variants too, which frees their SKUs for reuse per D003 — leaving them live would keep the partial-unique-index SKU reservation dangling under an archived item). Raises a friendly error on double-archive (`Item is already archived`) or a missing item. **No restore RPC was built** — not in the task list as written, and un-archiving safely is ambiguous once variants have been cascaded (can't tell which variants were independently dropped-from-matrix vs. archived-by-cascade). Flagging as an open follow-up rather than silently building it.
2. **`app/dashboard/inventory/items/actions.ts`** — added `archiveItem(itemId)` server action (calls the RPC, logs `archive_item` to `activity_logs`, revalidates the list). Extended the existing `upsertItem()` to log `create_item`/`update_item` after a successful save (distinguished by whether `item_id` was present in the submitted form).
3. **`app/dashboard/inventory/items/items-table.tsx`** — added an "Archive" button (red, `canWrite`-gated, hidden once a row is already archived) next to "Edit" in the actions column, with a `confirm()` guard matching the existing suppliers-table pattern (no dropdown-menu convention exists in this codebase, so this follows the plain-inline-button precedent from `suppliers-table.tsx`).
4. **`app/dashboard/administration/activity-logs/activity-logs-table.tsx`** — added `archive_item: "danger"` to `ACTION_BADGE`.

**RLS/RPC verification (2026-07-03, direct Postgres, real per-role accounts from `profiles`):**
- Raw `UPDATE ... items`/`item_variants` (incl. setting `deleted_at`) as encoder, cashier, and viewer: all three affected 0 rows (RLS-filtered), confirming `items_update`/`item_variants_update` (admin/manager-only, from `item1_schema_additions`) still holds.
- `archive_item()` RPC called directly as encoder, cashier, viewer: all three rejected with `Not authorized to archive items`.
- `archive_item()` as manager: succeeded, cascaded to the variant, verified via direct Postgres read.
- Re-calling `archive_item()` on the same item as admin: rejected with `Item is already archived`.
- `get_advisors` (security): `archive_item` appears in the same pre-existing `SECURITY DEFINER`-callable-by-`anon`/`authenticated` warning bucket as every other RPC in this project (`upsert_item`, `adjust_stock`, etc.) — no new class of finding.

**Browser + activity-log verification (2026-07-03, Claude admin test account):**
- Created a throwaway item via direct RPC, archived it through the real Item List "Archive" button in the browser (with `confirm()` stubbed) — row disappeared from the default view, reappeared correctly under the "Archived" filter chip with the Archive button now hidden and only "Edit" showing. Confirmed in Postgres: `items.deleted_at` and the variant's `deleted_at` both set, exactly one `archive_item` row in `activity_logs`.
- Created a second test item through the actual Add Item form (not a direct RPC call) and edited it through the actual Edit form — confirmed `create_item` then `update_item` rows landed in `activity_logs` with correct descriptions, and the Activity Logs page renders the new "Archive Item" badge correctly (red).
- All test rows (items, variants, inventory_levels/movements, activity_logs) cleaned up afterward; `items`/`item_variants` counts back to exactly 59/59. `npx tsc --noEmit` clean.

**⚠️ Unintended live Loyverse push — needs Sinag's decision:** the `Loyverse-Supabase` n8n workflow was already `active: true` going into this session (per ITEM-6.5's prior status note), which this session didn't re-check before using the real Add/Edit item form to verify `create_item`/`update_item` logging. Both the create and edit of "ITEM-6 Create Log Test" fired real, successful webhook pushes (`n8n` executions `100` and `101`) to the live Loyverse catalog — confirmed via `get_execution`: a real Loyverse item now exists, `loyverse_item_id = faf8b40b-0470-4f42-a3e5-c1bb59f85951`, SKU `ITEM6-CREATE-LOG-001`, name `"ITEM-6 Create Log Test (edited)"`, category matching local "Product". The local Supabase row was deleted as part of this phase's test cleanup (as usual), but that item **still exists in the real Loyverse account** — nothing in this codebase can delete a Loyverse item (only upsert). This incidentally satisfies part of ITEM-6.5's task 1/2 (create + update path, real Loyverse round trip, never live-tested before) as an unplanned side effect, but the leftover item needs Sinag to either remove it via the Loyverse dashboard or decide to keep/relabel it as a standing test fixture. **Takeaway for future sessions: re-check `get_workflow_details` → `active` before any browser-based item create/edit test, not just before ITEM-6.5's dedicated tasks** — this phase didn't anticipate the workflow being live already.

**Sinag's decision (2026-07-03):** keep the test item in Loyverse as-is (no dashboard cleanup) — treat it as a standing test fixture rather than removing it.

**Manual commit gate:** ✅ satisfied — commit approved.

---

## ITEM-6.5 — Live n8n Workflow Test Run ✅ DONE (pending commit gate sign-off)

**Status:** All 4 tasks executed and verified 2026-07-03, including a real bug found and fixed via the live composite test. Awaiting Sinag's dashboard/POS confirmation to close the gate.

**Preflight confirmed:** `get_workflow_details` showed `active: true`, `isArchived: false`, `activeVersionId ad7a1521-...` before starting — matched the prior session's status note.

**Bug found and fixed (task 4, composite push — the one path ITEM-2 flagged as never live-tested with a real Loyverse response):** `Build Loyverse Item Payload` built a `components` array for composite items but never set `is_composite: true` in the payload. First live attempt (execution 105) was rejected outright by Loyverse: `"Bad request - please check your parameters" / "Components must not be set if is_composite is set to false or null"`. Confirmed harmless locally — `items.sync_status` landed as `failed` with that exact error, no `loyverse_item_id`, nothing bad reached Loyverse. **Fixed with Sinag's explicit go-ahead** (this edits the live/active workflow, not just runs it): added `payload.is_composite = true` inside the existing `if (row.item_type === 'composite' ...)` branch, then `publish_workflow`'d the change (edits land in a draft version — the active/production webhook path doesn't pick them up until published). Re-triggered the same composite item's push (execution 107): Loyverse's real response confirmed `is_composite: true` and `components: [{variant_id: "830a888c-...", quantity: 1}]` landed correctly, `sync_status` flipped to `synced` with a real `loyverse_item_id`.

**Results per task, all against the real Loyverse catalog:**
1. **Create path** — "ITEM-6.5 Live Test Simple" (SKU `ITEM65-SIMPLE-001`, FIXED pricing, ₱150/₱75 cost) created through the actual Add Item form as the admin test account. Landed `sync_status='synced'`, `loyverse_item_id`/`loyverse_variant_id` populated, `sync_error` null (item id `00ba8b25-...`, Loyverse item id `91ee08a0-...`). This closes the create-path gate ITEM-2 left open.
2. **Update path** — edited the same item through the Edit form (SKU → `ITEM65-SIMPLE-001-EDITED`, price → ₱175). Confirmed the *same* `loyverse_item_id`/`loyverse_variant_id` carried through (upsert-by-body-`id`, not a duplicate) — new SKU/price reflected in Loyverse's response.
3. **Modifier push** — assigned "Coaster" to the item via the Edit form's modifier checklist, saved. Confirmed `item_modifiers` row landed in Supabase, and via `get_execution` on the resulting n8n run (execution 104), Loyverse's real API response echoed back `modifier_ids: ["684de877-...]"` — the ITEM-5 modifier-push code path is now live-verified, not just built.
4. **Composite push** — see bug/fix above. "ITEM-6.5 Live Test Composite" (SKU `ITEM65-COMPOSITE-001`, FIXED ₱250) created with one component (the Simple test item's own variant, qty 1). After the fix, verified end-to-end.
5. **Cleanup** — Sinag's decision (2026-07-03): keep both new test items as standing fixtures in Loyverse and Supabase, same precedent as ITEM-6's leftover test item. No archive/delete performed.

**Side effect (unplanned, harmless):** an attempt to re-trigger the composite push via `execute_workflow` (rather than the real webhook) landed on the workflow's schedule trigger instead of the webhook trigger, firing the daily Items pull-sync early (execution 106). This pulled ITEM-6's standing Loyverse-only fixture ("ITEM-6 Create Log Test (edited)") back into Supabase as a new row — expected behavior given Sinag's ITEM-6 decision to keep that item in Loyverse, just triggered a few hours ahead of its 2:20 AM schedule. The pull-sync race guard (ITEM-2 task 4) meant no local data was overwritten. Item/variant counts after this session: 62/62 (59 baseline + 2 new test items + 1 re-pulled ITEM-6 fixture). Re-triggering a specific webhook-only branch by ID isn't supported by `execute_workflow` for multi-trigger workflows — use the real HTTP webhook (or the BMS form, as tasks 1-4 did) instead.

**Preview-tooling gotcha hit again this session:** `button[type="submit"]` matched the dashboard header's "Sign out" button before the form's own submit button, logging the test session out on every first attempt (confirmed via dev server logs showing `POST .../items/new → 303` routing to `logout()`, not `upsertItem`). Matches the existing `feedback_preview_submit_button_targeting` memory — scoping the selector to `main button[type="submit"]` fixed it. Worth a permanent reminder since this is the second time it's bitten a session.

**Manual commit gate:** outstanding — Sinag to confirm both test items (and the composite's component wiring) render correctly in the Loyverse dashboard/POS. Once confirmed, ITEM-2's and ITEM-5's deferred live-push gates close too.

---

## ITEM-6.6 — Minimum stock threshold + modifier option preview ✅ DONE (pending commit gate sign-off)

**Status:** built, live-tested, and one real bug caught+fixed via the live test, 2026-07-03. Awaiting Sinag's sign-off before ITEM-7.

**Objective:** two UX gaps spotted in review, not part of the original ITEM-0..6.5 task lists.

**Tasks:**
1. **Minimum stock threshold.** Loyverse tracks a per-store `low_stock` alert level on each variant (confirmed in every ITEM-6.5 live response's `stores[].low_stock` field, always null since nothing has ever set it). Locally this already exists as `inventory_levels.low_stock_threshold` — added in an earlier phase for the dashboard's "Low Stock Items" widget, but nothing writes to it. When "Track Stock" is ticked in the Add/Edit Item form, show a "Minimum Stock" number input (both create and edit — this is an alert threshold, not a quantity change, so it doesn't fall under the locked stock-editing-boundary decision that reserves quantity edits for the Stock Movement screen). When "Track Stock" is unticked, clear the threshold to `null` (Sinag's call, matching "doesn't apply if not tracked" rather than leaving a stale number behind). `upsert_item` RPC extended to accept it per variant and upsert directly into `inventory_levels` (not through `adjust_stock`, since `in_stock` itself is untouched). Pushed to Loyverse via a `stores: [{ store_id, low_stock }]` entry per variant.
2. **Modifier option preview.** Show each modifier's own options (`modifier_options.name`) inline under its checkbox in the Add/Edit form's Modifiers section (e.g. "Coaster" → "Simple text, Templated Design"), so assigning a modifier list doesn't require checking Loyverse backoffice first to know what it contains. Read-only display, no new write path — consistent with the existing read-only modifier-assignment decision.

**What was built:**
- **No schema migration needed** — `inventory_levels.low_stock_threshold` already existed (feeding the dashboard's Low Stock widget) but nothing wrote to it; `modifier_options.name` already existed from ITEM-0's pull.
- **Migration `item6_6_low_stock_threshold`** — `upsert_item` extended: each variant in `p_variants` now carries `low_stock_threshold`; when `track_stock` is true it's upserted directly into `inventory_levels` (not through `adjust_stock()`, since `in_stock` itself is untouched — this is an alert setting, not a quantity change); when `track_stock` is false, any existing threshold for the item's variants is cleared to `null`.
- **`item-form.tsx`** — "Minimum Stock" number input shown whenever Track Stock is ticked (both create and edit, unlike Initial Stock which stays create-only). Modifiers checklist now shows each modifier's own options as description text under its checkbox (e.g. "Coaster" → "Simple Text, Templated Design"), sourced from a new `modifier_options` join added to both `new/page.tsx` and `edit/page.tsx`.
- **n8n (`Loyverse-Supabase`, two node edits, each separately approved by Sinag before publishing):** `Fetch Item for Push`'s SQL now joins `inventory_levels` for the threshold and looks up the active store's `loyverse_store_id`; `Build Loyverse Item Payload` adds a `stores: [{ store_id, low_stock }]` entry per variant when a threshold is set.

**Bug found and fixed via the live retest:** the first version of the `stores[]` push sent only `store_id` + `low_stock`, and Loyverse's real response showed this **reset the variant's per-store price to `null`/`VARIABLE`** instead of inheriting `FIXED`/₱175 from the variant defaults (previously, with no `stores[]` sent at all, Loyverse auto-populated it correctly). Fixed by also mirroring `pricing_type`/`price` into the same `stores` object — re-verified via a second live push showing the correct `pricing_type: "FIXED", price: 175, low_stock: 5` together.

**Live verification (2026-07-03, real Loyverse catalog, ITEM-6.5's standing "ITEM-6.5 Live Test Simple" fixture):**
- Modifier options render correctly against real data: "Coaster" → "Simple Text, Templated Design", "Keychain" → its 4 real options, "Ref Magnet" → its 3 — confirms the join works against actual modifier_options rows, not just the 1 test modifier used in ITEM-6.5.
- Ticked Track Stock, set Minimum Stock to 5, saved: `inventory_levels.low_stock_threshold = 5`, `in_stock` stayed untouched at 0, item stayed `sync_status='synced'`. First Loyverse push exposed the price-reset bug (caught before this was considered done); after the fix, re-verified `stores: [{store_id, pricing_type: "FIXED", price: 175, low_stock: 5}]` landed correctly.
- Unticked Track Stock, saved again: `low_stock_threshold` cleared to `null` locally, confirming the "doesn't apply when untracked" behavior Sinag asked for.
- `npx tsc --noEmit` clean throughout.

**Manual commit gate:** Sinag confirms the Minimum Stock value and modifier option text render correctly in the Loyverse dashboard/POS, alongside ITEM-6.5's own gate.

---

## ITEM-7 — Testing & docs 🟨 IN PROGRESS

**Status:** Tasks 2-4 done 2026-07-03. Task 1 partially blocked — see below.

**Tasks:**
1. Full round-trip test: create item in BMS → confirm correct in Loyverse → sell via POS → confirm receipt/stock movement syncs back correctly. **Blocked on a real-world action:** ringing up an actual sale requires the physical/real Loyverse POS, which Claude Code has no access to — this step needs Sinag. Suggested target: sell the standing "ITEM-6.5 Live Test Simple" fixture (SKU `ITEM65-SIMPLE-001-EDITED`, already `sync_status='synced'` with a real `loyverse_item_id`) so no new item needs creating first. Once Sinag makes the sale, verification is: (a) `receipts`/`receipt_line_items`/`receipt_payments` show the new sale after the 2:35 AM PH `Receipts Sync Trigger` (or a manual `execute_workflow` re-trigger of that schedule node), (b) `inventory_levels`/`inventory_movements` reflect the decremented stock after the 2:25 AM PH `Inventory Sync Trigger`. Both pull-sync branches already exist in `Loyverse-Supabase` and are unmodified by this feature — this task is closing out the last unverified hop (a BMS-pushed item flowing all the way through a real POS sale and back), not building new sync logic.
2. Update `MODULE_STATUS.md`. ✅ Done — added an Item List line under Inventory, plus a clarifying note under Integrations (no dedicated screens exist, but Loyverse sync is functionally live via n8n under the hood).
3. Update `DECISIONS.md`. ✅ Done — added a closeout note to D020 (push-sync direction, now fully live-tested end to end) and a new **D021** locking in the composite/no-Production-workflow decision (`track_stock` forced off server-side, 3-level nesting cap, `use_production` pull-only).
4. Update `ROADMAP.md`. ✅ Done — added a closeout note confirming no conflict with Phase 11/12 (both were already complete before this feature started; it only touched `items`/`item_variants` plus the new Item List screen/n8n branch).

**Manual commit gate:** outstanding — task 1's live POS round trip needs Sinag to perform the sale, then a follow-up verification pass (per the checklist above) before final sign-off. Once closed, ready to start Phase 11 (Suppliers) — though note that phase is already 🟩 Complete per `MODULE_STATUS.md`, so this line in the original gate wording is stale (see the ROADMAP.md closeout note above).

---

## Open / deferred (not blocking this build)

- `reference_id` / `reference_variant_id` — unmodeled, uninvestigated.
- Tax (`tax_ids`) — deferred, no populated example seen yet.
- Images — deferred.
- Bulk CSV import/export — deferred.
- `discounts` table — pulled as a side effect of ITEM-0, unused. Decide later if/how it's used.
- Production/Disassembly workflow (Loyverse Advanced Inventory) — explicitly out of scope, revisit only if the Advanced Inventory subscription is ever purchased.
