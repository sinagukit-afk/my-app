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

## ITEM-1 — Schema additions

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

**Manual commit gate:** migration applied, RLS verified per role (test as admin, manager, encoder, cashier, viewer), backfill row counts sanity-checked against the 59 existing items.

---

## ITEM-2 — Loyverse push integration (n8n)

**Objective:** when an item is created/edited in the BMS, push it to Loyverse and keep sync state honest. Build via the connected n8n MCP in Claude Code — no manual workflow scaffolding needed outside that.

**Tasks:**
0. Confirmed with Sinag: build as an added branch inside the existing `Loyverse Sync - Modifiers & Discounts` workflow (id `F6CfXnxji98Y75JJ`), not a new standalone workflow — despite that workflow currently being inactive (test phase) and having a known unfixed bug in unrelated upsert nodes (missing `=` expression prefix, per the `bms-supabase` skill). Don't let the new branch depend on or attempt to fix that pre-existing bug unless it's directly in the way.
1. n8n workflow, webhook-triggered (matching existing pattern): receives item/variant payload from BMS on save, calls Loyverse's item/variant create & update endpoints.
2. On success: write back `loyverse_item_id` / `loyverse_variant_id`, set `sync_status = 'synced'`, `loyverse_synced_at = now()`.
3. On failure: set `sync_status = 'failed'`, populate `sync_error`, surface this in the Item List UI (built in ITEM-4) so failed pushes are visible, not silent.
4. **Switch existing pull-sync from polling to webhook-driven.** This is the critical race-condition guard: without it, a poll cycle could overwrite a just-pushed BMS item before Loyverse's copy settles. Confirm Loyverse supports outbound webhooks for item changes; if not, fall back to an `updated_at`-newer guard on the pull-upsert (skip incoming record if local `updated_at` is more recent).
5. Composite item push: components pushed as part of the same payload, respecting Loyverse's 3-level nesting limit.
6. Modifier assignment is **not** pushed — read-only in BMS, so no push logic needed for `item_modifiers`.

**Manual commit gate:** create a test item in BMS, confirm it appears correctly in Loyverse backoffice with matching fields; edit it in BMS, confirm the update lands; confirm pull-sync no longer clobbers a freshly-pushed item.

---

## ITEM-3 — Backend CRUD

**Objective:** transactional create/update covering `items` + `item_variants` + `item_components` (composite) + initial stock, in one atomic operation.

**Tasks:**
1. Create RPC (or Next.js server action + single transaction) that upserts `items`, then `item_variants` (all variant combinations from the option matrix), then `item_components` if composite.
2. On create with `track_stock = true`: call existing `adjust_stock(p_variant_id, p_qty_delta, p_reason, p_store_id, p_note)` with `source_id` referencing the `manual` row in `inventory_sources`, not a raw `inventory_levels` insert. Confirm exact `p_reason`/movement-type mapping by reading the function body before wiring this up — signature is known, internal reason-code handling should be verified, not assumed.
3. Enforce `track_stock = false` server-side whenever `item_type = 'composite'` — don't rely on the UI alone to prevent this.
4. Enforce SKU/barcode uniqueness at the application layer with a clear error, backed by the ITEM-1 partial unique indexes.
5. `default_price` validation: required and enforced only when `pricing_type = 'FIXED'`.
6. On edit: stock quantity fields are excluded from the update payload entirely (not just disabled in UI) — the backend should not accept a stock write from this endpoint at all.

**Manual commit gate:** create a simple item, a variant item, and a composite item end-to-end via the RPC/action directly (bypassing UI), confirm all child rows land correctly and RLS blocks non-admin/manager callers.

---

## ITEM-4 — Item List screen

**Objective:** the main list view.

**Tasks:**
1. Table columns: name, category, SKU(s), price (or price range if multi-variant), stock (if tracked), item_type, sync status.
2. Filters: name search, category, status, item_type. Status derived from `is_available_for_sale` + `deleted_at` — no new status column needed.
3. Surface `sync_status = 'failed'` items visibly (e.g. a badge), matching ITEM-2's error visibility requirement.
4. Pagination.
5. Role-gated "Add Item" button (admin/manager only) — but list itself visible to all roles per the locked read-access decision.

**Manual commit gate:** filters verified against real data (all 59+ items), sync-failure state visible when deliberately triggered.

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
