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

## ITEM-5 — Add/Edit form

**Objective:** the form itself, matching Loyverse field-for-field per the locked decisions.

**Tasks:**
1. Core fields: name, category, description, item_type (simple/composite), sold_by (each/weight), track_stock (disabled when composite), is_available_for_sale, primary_supplier_id, pricing_type.
2. Variant matrix editor: option name/value inputs (up to 3 options) → auto-generates variant rows with editable SKU/barcode/cost/price per combination, matching Loyverse's own variant generation behavior.
3. Composite component sub-editor: pick component variant + quantity, reusing `item_components`. Enforce max 3-level nesting to match Loyverse.
4. Modifier assignment picker: multi-select from existing `modifiers` (read-only list, no create) → writes to `item_modifiers`.
5. `default_purchase_cost` shown read-only (grey/disabled) when present.
6. Initial stock quantity input — visible only on create, only when `track_stock = true`; hidden entirely on edit (replaced by a link to the future Stock Movement screen — stub/disabled link acceptable until Phase 12 exists).
7. Cost field visible and editable for all roles per the locked decision (no role-based hiding here, unlike other financial forms).

**Manual commit gate:** full round trip — create item with variants + composite components + modifier assignment, edit it, confirm sync_status updates correctly, confirm role restrictions (viewer/cashier/encoder cannot reach the form at all).

---

## ITEM-6 — Permissions, archive & audit

**Tasks:**
1. Confirm RLS (not just UI) blocks writes for encoder/cashier/viewer — test directly against the DB, not just through the app.
2. Archive action (soft delete via `deleted_at`) available from the Item List screen for admin/manager.
3. Log create/edit/archive actions to `activity_logs` (or whatever the established audit table is — confirm name before wiring).

**Manual commit gate:** attempt writes as each non-privileged role and confirm rejection at the RLS layer; confirm activity log entries appear correctly.

---

## ITEM-7 — Testing & docs

**Tasks:**
1. Full round-trip test: create item in BMS → confirm correct in Loyverse → sell via POS → confirm receipt/stock movement syncs back correctly.
2. Update `MODULE_STATUS.md`.
3. Update `DECISIONS.md` — lock in the push-sync direction decision and the composite/no-Production decision (both are meaningful architectural calls that should be discoverable later, not just buried in this doc).
4. Update `ROADMAP.md` — mark this feature complete, confirm no conflicts with Phase 11/12 as originally flagged.

**Manual commit gate:** final sign-off, ready to start Phase 11 (Suppliers) on a clean base.

---

## Open / deferred (not blocking this build)

- `reference_id` / `reference_variant_id` — unmodeled, uninvestigated.
- Tax (`tax_ids`) — deferred, no populated example seen yet.
- Images — deferred.
- Bulk CSV import/export — deferred.
- `discounts` table — pulled as a side effect of ITEM-0, unused. Decide later if/how it's used.
- Production/Disassembly workflow (Loyverse Advanced Inventory) — explicitly out of scope, revisit only if the Advanced Inventory subscription is ever purchased.
