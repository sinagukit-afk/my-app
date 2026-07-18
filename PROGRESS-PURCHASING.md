# PROGRESS-PURCHASING.md

Tracks the **Purchasing module** for Sinag Ukit ERP. Follows the same convention as `PROGRESS-ITEMS.md`/`PROGRESS-CUSTOMERS.md`/`PROGRESS-INVENTORY.md`/`PROGRESS-QUOTES.md`: `RECV-` prefixed phases, kept separate from the core `PROGRESS.md` numbering. Append-only.

---

## RECV-1 — Consolidate "Incoming Inventory" into Receiving ✅ DONE

**Status:** Complete 2026-07-06.

**Ask (Sinag):** eliminate the standalone "Incoming Inventory" screen (`/dashboard/inventory/incoming`, Phase 18). Move its manual-entry capability into the Purchasing "Receiving" screen as a "Log Manual Incoming" button/dialog. Every receiving event — manual or PO-sourced — gets its own human-facing receiving number (`SRIYY-MMDD-0001`, matching the Quotes/Orders yearly-reset numbering convention, not the daily-reset PO convention) and an automatic `status = 'received'`.

**What was built (migration `0039_receiving_reference_and_status`):**
- `incoming_items` +2 columns: `reference` (`text NOT NULL UNIQUE`), `status` (`text NOT NULL DEFAULT 'received'`, no check constraint yet — only one value exists today, add one if a second status is ever needed). Backfilled the 10 pre-existing rows in `created_at` order.
- `set_incoming_item_reference()` — `BEFORE INSERT` trigger, same shape as `set_quote_number()`/`set_order_number()`: `'SRI' || YY || '-' || MMDD || '-' || seq`, sequence resets yearly (counts `where reference like 'SRI'||YY||'%'`, not scoped to the day). Applies to **every** `incoming_items` insert, so PO-sourced receipts (via `receive_purchase_order()`) now get numbered too, not just manual ones.

**App changes:**
- Deleted `app/dashboard/inventory/incoming/` (page, table, form, actions) and its sidebar entry in `components/layout/app-shell.tsx`.
- `app/dashboard/purchasing/receiving/manual-incoming-form.tsx` — the old `IncomingForm` dialog, renamed/moved, unchanged fields (supplier, item, variant, quantity, unit price, date received, notes).
- `app/dashboard/purchasing/receiving/actions.ts` (new, separate from the existing `[reference]/actions.ts` which still owns `receivePurchaseOrder`) — `createManualIncoming`, same validation/insert shape as the old `createIncomingItem`, inserts with `purchase_order_id: null`; `reference`/`status` are left for the DB trigger/default to fill in.
- `app/dashboard/purchasing/receiving/receiving-header.tsx` (new, client) — owns the `PageHeader` + "Log Manual Incoming" button + dialog open state, since `page.tsx` is a server component and can't own interactive state itself.
- `app/dashboard/purchasing/receiving/receiving-log-table.tsx` (new, client) — history table across **all** `incoming_items` rows (manual and PO-sourced), columns: Receiving No., Date, Item, Qty, Total, Source (`Manual` badge or `PO: <reference>` text), Supplier, Status badge, Received By.
- `app/dashboard/purchasing/receiving/page.tsx` rewritten — now renders `ReceivingHeader`, the existing "Open Purchase Orders" table (unchanged query/behavior), and the new "Receiving Log" table, joining `incoming_items` → `item_variants`, `suppliers`, `purchase_orders(reference)`.

**Bug found and fixed in the same pass (migration `0040_fix_incoming_item_movement_quantity_before`):** `apply_incoming_item_inventory_movement()` (the trigger every `incoming_items` insert relies on to post stock) has been inserting into `inventory_movements` without `quantity_before` since migration `0026_inventory_status_foundation` (2026-07-05) made that column `NOT NULL`. Every `incoming_items` insert — both this new manual-incoming path and the pre-existing PO `receive_purchase_order()` path — has been hard-failing with `null value in column "quantity_before" ... violates not-null constraint` since 2026-07-05, caught live during this phase's own browser verification (the open PO `SPO-2026-07060001` created 2026-07-06 had never actually been received against, which is why this had gone unnoticed). Fixed by capturing the pre-update `in_stock` value (`select ... for update` before the upsert) and passing it through, same pattern as `adjust_stock()`. This was a pre-existing regression, not introduced by this phase, but had to be fixed here since it blocked the very feature being built.

**Known gap surfaced, not fixed (out of scope, flagged for follow-up):** `apply_incoming_item_inventory_movement()` only updates `in_stock`, never `available_qty` — confirmed live: after the verification receipt, `in_stock` moved 69→76 but `available_qty` stayed at 68, a real divergence. This matches the Inventory Status Phase 1 non-goal ("PO receiving (Incoming→Available)" — see `PROGRESS-INVENTORY.md`), so left alone per that existing decision, but worth a dedicated follow-up phase since it now visibly affects the Receiving screen's own numbers, not just an abstract future concern.

**Closed 2026-07-08 by `PROGRESS-INVENTORY.md` INV-12** (migration `inv10_receive_po_bumps_available_qty`): `apply_incoming_item_inventory_movement()` now upserts `available_qty` alongside `in_stock` on every PO receipt, same pattern as `adjust_stock()`. No longer an open gap.

**Verification (browser preview, Claude admin test account):**
- Confirmed "Incoming Inventory" no longer appears in the sidebar; `/dashboard/inventory/incoming` routes are gone.
- Confirmed Receiving page renders "Log Manual Incoming" button, Open Purchase Orders table (unchanged), and the new Receiving Log table populated with all 10 pre-existing entries correctly numbered/badged (`Manual` vs `PO: SPO-...`).
- Logged a real manual receipt (Itm-Bottle Opener-Long 14cm, qty 7, ₱12.50/unit, note "Receiving consolidation verification entry") through the new dialog. First attempt surfaced the `quantity_before` bug above (rolled back automatically, no partial row written — confirmed via direct query). After the fix, resubmitted successfully: got reference `SRI26-0706-0011`, `status = 'received'`, appeared at the top of the Receiving Log, and a correct `inventory_movements` row (`quantity_before=69, quantity_change=7, quantity_after=76, movement_type='incoming'`). This verification entry was left in the database (clearly labeled via its note), consistent with the Phase 18/20/21 convention of leaving labeled verification data in place rather than rolling it back by default.

---

**2026-07-06 — path update (D031):** `app/dashboard/purchasing/purchase-orders`
and `app/dashboard/purchasing/receiving` moved to `app/dashboard/inventory/
purchase-orders` and `app/dashboard/inventory/receiving` as part of the
Operations nav restructure — the Purchasing sidebar group was retired,
folded into Inventory. File names/contents unchanged, only routes +
physical folders moved. See `DECISIONS.md` D031.

---

## PUR-1 — Purchasing recreated as a top-level module: Expense PO + Asset PO ✅ DONE

**Status:** Complete 2026-07-11. See `DECISIONS.md` D044 for the cross-cutting schema
decisions (shared here in brief) and `PROGRESS-FINANCE.md` FIN-1 /
`PROGRESS-ACCOUNTING.md` ACCT-7.9 for the Finance/Accounting halves of this same build.

**Ask (Sinag):** split Finance into real Expenses/Fixed Assets/Payments, and make
Purchasing a real top-level module again — this time routing to three destinations by PO
type instead of the single Inventory-only flow D031 folded away: Inventory PO → Inventory
(unchanged), Expense PO → Finance → Expenses, Asset PO → Finance → Fixed Assets. Recurring
OPEX (rent/utilities/internet/salaries) skips the PO entirely via Direct Expense Entry.

**Schema (migrations `finpur_1`..`finpur_12`):**
- `purchase_orders.po_type` (`inventory`/`expense`/`asset`, default `inventory`) — one
  shared table/reference series/status workflow across all three types, not three schemas.
- `purchase_order_items.variant_id` made nullable; added `description`,
  `expense_category_id`, `asset_category_id` — Expense/Asset lines aren't SKU-based.
- New `expense_categories`/`asset_categories` (category → default Chart-of-Accounts
  mapping, same shape as `item_accounting_mappings`) — asset categories also carry
  `default_useful_life_months`, pre-filled at receiving time and overridable per line.
- `purchase_orders.supplier_id` dropped its `NOT NULL` (was Inventory-only-shaped; Expense/
  Asset POs need an optional supplier) — caught live in browser verification, not before.
- New RPCs: `receive_expense_purchase_order()` / `receive_asset_purchase_order()` (mirror
  `receive_purchase_order()`'s partial-receiving shape; route to `opex_expenses`/
  `fixed_assets` instead of `incoming_items`, one `fixed_assets` row per Asset-PO *line*
  — not per unit, matching how each asset is depreciated individually), `record_direct_
  expense()`, `log_payable_payment()`. All four insert a `business_events` row for
  Accounting to pick up — see ACCT-7.9 for the posting side.

**App (`app/dashboard/purchasing/`):**
- `inventory-po/`, `receiving/` — physically moved back from `app/dashboard/inventory/`
  (D031 reversed), file contents otherwise unchanged; list/receiving queries scoped to
  `po_type = 'inventory'` since the table is now shared.
- `expense-po/`, `asset-po/` — new, same file shape as Inventory PO (`page.tsx` list,
  `new/` create form, `[reference]/` detail+receive) but with a category+description line
  picker instead of a variant picker, and an inline Receive dialog on the detail page
  itself rather than routing through the shared Receiving screen (Expense/Asset receiving
  has no `incoming_items`-equivalent log to share with Inventory's).
- Role tier: PO creation/header-edit is page-gated to admin/manager for Expense/Asset PO
  (narrower than the underlying `purchase_orders` table RLS, which still allows encoder for
  all types) — matches "approval before purchasing"; **Receiving** stays admin/manager/
  encoder for all three types, same as Inventory PO always was.
- New top-level `Purchasing` `NavGroup` in `app-shell.tsx` (Inventory PO, Expense PO, Asset
  PO, Receiving), removed from the Inventory subgroup. `dashboard/layout.tsx`'s nav-badge
  counts split by `po_type` (previously counted all `purchase_orders` rows as inventory).

**Verified (browser preview, Claude admin test account, left in place as labeled real
data per this project's standing verification convention):**
- Created an Expense PO with no supplier → hit the `supplier_id NOT NULL` bug live, fixed
  the schema, retried successfully.
- Full Asset PO round trip: created "Machinery & Equipment" category (mapped to
  `SCA-1530`/`1531`/`6002`, 24mo default life) via the new Accounting → Category Mapping
  page → raised `SPO-2026-07110002` → Approve & Send → Receive (useful life/salvage
  pre-filled from the category, both overridable) → landed in Finance → Fixed Assets as
  "Laser Engraving Machine," ₱25,000, Active.
- Full Expense PO / Direct Entry round trip documented in FIN-1 (same session).
- `npm run build` passes, all `/dashboard/purchasing/*` routes registered;
  `get_advisors(security)` shows only the standard baseline WARN, no new categories.

---

## PUR-2 — AI Form Auto-Fill module, piloted on Expense PO + Asset PO ✅ DONE

**Status:** Complete 2026-07-12. See `DECISIONS.md` D045 for the cross-cutting
architecture calls (shared here in brief) — this entry covers the Purchasing-side
integration.

**Ask (Sinag):** a reusable "AI Form Auto-Fill" module any ERP form could use — user
uploads/photographs a document, the system reads it and pre-fills the form, every field
stays editable, nothing auto-saves or auto-submits. Design was reviewed before any code
was written; user picked the pilot form (Purchasing PO, over New Expense or a
no-form-yet option) and the fallback-endpoint approach (a new Route Handler, over
raising the Server Action body-size limit globally) via two direct questions.

**What was built:**
- `lib/ai-autofill/` — provider-agnostic core: `types.ts` (`DocumentSchema`/
  `FieldSchema`/`ExtractionResult`), `schemas/` (5 document types registered —
  `receipt`, `supplier_invoice`, `delivery_receipt`, `shipping_label`,
  `official_receipt` — only `supplier_invoice` wired to a real form so far),
  `match-dropdown.ts` (local Levenshtein-based fuzzy match, used by the free local OCR
  path only), `ocr/` (Tesseract.js client wrapper + cheap regex/keyword local extractor
  + a confidence check deciding whether to escalate), `providers/openai-vision.ts`
  (OpenAI structured-outputs call, dropdown fields sent as JSON-schema enums so the
  model can only return a real option value or `null` — never invents one).
- `app/api/ai-autofill/extract/route.ts` — the OpenAI Vision fallback endpoint, and the
  **first Route Handler in the whole app** (every other mutation is a Server Action).
  Requires an authenticated Supabase session before calling OpenAI, otherwise it would
  be an open proxy anyone could hit to spend the project's API credits.
- `components/ai-autofill/` — `use-auto-fill.ts` (idle → reading-locally → asking-ai →
  done/error), `use-ai-filled-keys.ts` (tracks which fields are still AI-filled and
  unedited), `auto-fill-panel.tsx` (Manual Entry / Upload-Capture toggle UI),
  `ai-field-highlight.tsx` (ring + "AI" badge, clears the instant the user edits that
  field).
- Hybrid OCR flow: Tesseract.js runs client-side first (dynamically imported, only
  loads if the user picks Upload). A cheap regex pass tries to fill header fields for
  free. Escalates to the paid OpenAI Vision route whenever OCR confidence is low, a
  required header field is still empty, or the schema has line items at all — table/
  layout extraction needs real vision, so `supplier_invoice` (used by both PO forms)
  always escalates.

**Purchasing-side integration:** [new-expense-po-form.tsx](app/dashboard/purchasing/expense-po/new/new-expense-po-form.tsx)
and the near-identical Asset PO twin. Both forms map the generic `supplier_invoice`
schema's `category_id` line-item key to their own `expense_category_id`/
`asset_category_id` at the call site — the same schema drives both forms, proving the
module's reusability goal without any Purchasing-specific code inside `lib/ai-autofill`.
New deps: `tesseract.js`, `openai`. New env var `OPENAI_API_KEY` (unprefixed —
server-only, read only inside the Route Handler, matching the existing
`SUPABASE_SERVICE_ROLE_KEY`/`N8N_WEBHOOK_BASE_URL` convention).

**Verification (browser preview, Claude admin test account):**
- Before `OPENAI_API_KEY` was configured: uploaded a synthetic invoice image, confirmed
  local OCR ran client-side without error, correctly determined AI was needed (line
  items present), and the route gracefully returned 503 ("AI Auto-Fill is not
  configured") — the form stayed fully usable, Clear reset the panel, no crash.
- After Sinag added a real `OPENAI_API_KEY`: re-ran the same flow against a synthetic
  "Test" supplier invoice (supplier name, invoice date, one line item, shipping fee).
  Every field extracted correctly — supplier matched to the real existing dropdown
  option (not a lookalike string), order date, shipping fee, description, quantity, and
  unit cost all correct, subtotal recalculated correctly (₱1,500). The expense category
  wasn't printed on the document at all, yet the model correctly inferred "Repairs &
  Maintenance" from the line-item description and returned one of the real category
  values. Confirmed the ring+"AI" badge renders on filled fields and disappears the
  instant a field is edited (tested by overwriting Shipping Fee).
- `npx tsc --noEmit` clean. Committed `82d070b`, pushed to `origin/main`.

**Notes for next phase (superseded by PUR-2.1 below for the inventory-item-picker point):**
only `supplier_invoice` is wired to a form. The other 4 schemas exist in the registry for
extensibility but have no consuming form yet — natural next candidates are Receipt
(Direct Expense Entry) and Delivery Receipt (Receiving). No searchable/combobox dropdown
component exists anywhere in the app (`components/ui/select.tsx` is a plain native
`<select>`) — fine for today's short option lists (suppliers, categories), but would need
a new component before this module could target a long list (e.g. an inventory item
picker).

---

### PUR-2.1 — Extended to Inventory PO + item-alias matching + two real accuracy fixes ✅ DONE

**Status:** Complete 2026-07-12 (same day as PUR-2, follow-up session). See `DECISIONS.md`
D046 for the cross-cutting architecture calls; this entry covers the Purchasing-side
integration and live verification.

**Ask (Sinag):** wire the same AI Form Auto-Fill concept into the Inventory Purchase
Order form — upload a photo of a supplier delivery/order (a real Shopee order-history
screenshot from supplier "E-Gosyo," used as the live test image throughout), have the AI
match photographed line items against registered items even when the document's wording
doesn't match the registered name.

**What was built:**
- New `inventory_purchase` document schema (`lib/ai-autofill/schemas/inventory-purchase.ts`)
  reusing `supplierInvoiceSchema`'s header fields, with its own line-item shape matching
  against `variant_id` (a dropdown) instead of a free-text description + category.
  Wired into [new-po-form.tsx](app/dashboard/purchasing/inventory-po/new/new-po-form.tsx)
  following the exact same controlled-state / `AiFieldHighlight` / `useAiFilledKeys`
  pattern PUR-2 established.
- `items.ai_match_keywords` (new nullable text column, migration
  `add_items_ai_match_keywords`) — an alias/keywords field editable on the Item form
  (Management > Items), deliberately kept separate from `items.description` because
  `description` is genuinely pushed to Loyverse on save (`upsertItem` triggers
  `loyverse-item-push`) — `ai_match_keywords` is app-only. `DropdownOption` gained an
  optional `keywords` field that both the local fuzzy matcher and the AI prompt check, so
  an item like "Itm-Ref Magnet Beechwood, ATM" tagged with "Pinewood Beechwood Blank
  Craft, ATM size, rectangle, E-Gosyo Shopee" can match a document using none of its
  registered wording.
- **Bug fix — dropdown matching broke down past a handful of options:** D045's original
  design (enum-of-ids constrained JSON schema) is correct for the Expense/Asset PO's
  short supplier/category lists, but with 32 registered items the model reasoned about
  the right item correctly and then emitted the *wrong id* from the enum (confirmed live:
  matched a wood ref-magnet blank to "Itm-Keychain Metal, Rectangle"). Fixed by having
  the model return the option's label text (unconstrained) and resolving that back to a
  value via the existing `matchDropdownOption` fuzzy matcher — moves the "never invent a
  value" guarantee from the model's enum recall to an app-layer lookup, which holds at
  any list size. See D046 for why this doesn't regress PUR-2's short-list cases.
- **Bug fix — bundle/pack price mistaken for a per-unit rate:** a real cart screenshot
  ("50 pcs ... ₱650") caused the AI to use 650 as a per-piece cost while also using 50 as
  quantity, inflating a real ₱1,980 cart to a computed ₱78,600 subtotal. Fixed with a new
  `FieldSchema.totalDividedBy` — for `inventory_purchase`'s `unit_cost` (→ `"quantity"`),
  the AI is asked for the line's TOTAL price instead of a rate, and
  `openai-vision.ts`'s `resolveTotals()` divides by the referenced field's value in code
  (deterministic, not asked-for model arithmetic). Scoped to `inventory_purchase` only,
  not `supplier-invoice.ts` — Expense/Asset PO invoices are already unit-priced with
  qty=1 in the common case, so applying this there would trade a working path for an
  unverified one.
- **New, unrelated-to-AI safety net:** `costVarianceWarning()` in `new-po-form.tsx` shows
  a small red warning under any line whose unit cost is more than 50% below/above the
  selected item's registered `cost`, plus a summary notice when "Create Purchase Order"
  is clicked. Non-blocking by design — the order still submits either way.

**Verification (browser preview, Claude admin test account, real E-Gosyo/Ref-Magnet-Beechwood
data — not synthetic):**
- Order-history screenshot (3 lines, all "Beechwood" ref-magnet variants): supplier
  correctly resolved to the real "E-gosyo" row; item matching went from 0/3 correct
  (pre-fix, all 3 resolved to the same wrong unrelated variant) to 3/3 correct
  post-fix, with one re-run later mismatching the near-identical ATM-vs-Square alias
  pair — flagged as a residual, likely-not-fully-fixable model-accuracy limit rather than
  a code defect (see D046).
- Cart screenshot (3 lines incl. an unrelated Bamboo Coaster, "50 pcs"/"20 pcs" pack
  wording): item matching 3/3 correct including the coaster with zero aliases set (base
  name alone was enough); pre-`totalDividedBy`-fix subtotal was ₱78,600, post-fix exactly
  ₱1,980.00 — matching the real receipt total.
- Cost-variance warning: selected "Ref Magnet Beechwood, ATM" (registered ₱14), forced
  unit cost to ₱2, confirmed both the per-row and submit-time warnings rendered and the
  purchase order still submitted successfully (test PO created then deleted directly via
  SQL — `purchase_orders`/`purchase_order_items` have no soft-delete column).
- `npx tsc --noEmit` and `eslint` clean on every touched file. Committed `909fe5c`, pushed
  to `origin/main`.

**Notes for next phase:** the inventory-item-picker gap PUR-2 flagged is resolved by the
label-then-resolve matching fix, not by adding a real combobox — the item list is still
small (32 SKUs) so a plain `<select>` remains fine; revisit if the catalog grows much
larger. The residual ATM-vs-Square-style alias confusion (very similar keyword wording
across near-identical variants) wasn't chased further — every AI-filled row stays
ring-highlighted and editable specifically so this class of miss gets caught before
submit, not silently trusted.

---

### PUR-2.2 — Extended AI Auto-Fill to Manual Incoming + converted it to a multi-row page ✅ DONE

**Status:** Complete 2026-07-12 (same day as PUR-2/PUR-2.1, follow-up session).

**Ask (Sinag):** wire AI Form Auto-Fill (with the same item-alias keyword matching as
Inventory PO) into "Log Manual Incoming", and add multi-row line-item creation to it,
matching how Inventory PO's "New Purchase Order" already works.

**What was built:**
- New `manual_incoming` document schema (`lib/ai-autofill/schemas/manual-incoming.ts`) —
  header fields `supplier_id`/`date_received`/`note`, line items `variant_id` (dropdown)
  / `quantity` / `unit_price` (with `totalDividedBy: "quantity"`, same pack-price guard
  as `inventory_purchase`, since these are the same kind of delivery/marketplace
  screenshot). Registered in `lib/ai-autofill/schemas/index.ts` and
  `lib/ai-autofill/types.ts`'s `DocumentType` union. No changes needed to
  `openai-vision.ts` or the `/api/ai-autofill/extract` route — both are already fully
  schema-driven from D045/D046.
- **The old `manual-incoming-form.tsx` dialog was deleted and replaced with a full page**
  at `app/dashboard/purchasing/receiving/new/` (`page.tsx` + `new-manual-incoming-form.tsx`),
  built as a line-item-rows form following the exact same pattern as Inventory PO's
  `new-po-form.tsx` — `AutoFillPanel`, `AiFieldHighlight`/`useAiFilledKeys` on the header
  fields, a `rows` array with Add Row/Remove, and AI-extracted items replacing the whole
  `rows` array on a successful extraction. Reasoned this was truer to "same as creating
  new Inventory PO" than trying to cram an image-upload panel and a growing item table
  into the existing `max-w-lg` `Dialog` — Expense PO/Asset PO/Inventory PO's own "New X"
  screens are all full pages for the same reason, not dialogs, so Manual Incoming was the
  odd one out. `receiving-header.tsx` now just links to `/receiving/new`;
  `receiving/page.tsx` dropped the supplier/item/payment-type queries it only fetched for
  the old dialog's props.
- The item dropdown lists individual **variants** flattened (`"{Item} — {Option}"`, same
  as Inventory PO's `variantOptions`), not a two-level item-then-variant picker like the
  old dialog had — each row independently resolves its own `item_id` (required, not
  null, on `incoming_items`) from the selected variant's parent item at submit time.
  `item_name_snapshot` is deliberately kept as the bare item name (not the combined
  "Item — Option" label Inventory PO uses for its own snapshot) because
  `receiving-log-table.tsx` already renders `variant_label` as a separate line under the
  item name — combining them would have duplicated the variant text.
- New action `createManualIncomingWithItems` (`actions.ts`) replaces the old single-row
  `createManualIncoming` — takes shared header fields once (supplier, date received,
  payment method, credit-card flag, notes — payment method is "captured once per
  receiving action, not per line" per D-ACCT7.2's own framing) plus an `items_json` array,
  and does one `.insert([...])` of multiple `incoming_items` rows. Verified via direct SQL
  inspection of `incoming_items`' two triggers before writing this
  (`set_incoming_item_reference_trigger` computes each row's `reference` off a live
  `count(*)` at BEFORE-ROW time, `incoming_items_apply_inventory_movement` moves stock
  AFTER-ROW) — both are `FOR EACH ROW`, so a multi-row insert in one statement is
  equivalent to submitting the old single-row dialog N times, just batched: each row gets
  its own sequential reference and its own inventory movement/`business_events` row, with
  no schema or trigger changes required.

**Verification (browser preview, Claude admin test account):** filled the new page with
2 line items (Ref Magnet Beechwood ATM ×5 @ ₱14, Keychain Metal Rectangle ×2 @ ₱30),
supplier "Test", a note; confirmed the subtotal computed live (₱130.00) before submit.
Submitted once — both rows landed in the Receiving Log with distinct sequential
references (`SRI26-0712-0024`/`-0025`), correct item/variant/qty/price snapshots, shared
supplier and note, and `payment_type_id`/`is_credit_card` both correctly left at their
unset defaults. Confirmed directly in the DB (`incoming_items`, `inventory_movements`,
`inventory_levels`) that both rows' stock moves applied correctly, then reversed the
stock deltas and deleted the two test rows plus their `inventory_movements`/
`business_events` rows via SQL — no soft-delete column on `incoming_items`, same cleanup
approach as PUR-2.1's test PO. `npx tsc --noEmit` and `npm run build` both clean.

**Not done / out of scope:** no cost-variance warning like Inventory PO's
`costVarianceWarning()` — Manual Incoming has no "registered cost" comparison surfaced
elsewhere in this flow and it wasn't asked for; add it later only if it turns out to be
wanted here too.

## PUR-3 — Purchasing/AP UX audit: all 14 items implemented ✅ DONE

**Commits `e78c815` (items 1–10) + `4d1cadd` (items 11–14), 2026-07-18.** A structured
ERP-UX audit of the Inventory PO → Receiving → Supplier Payment flow (code review +
live browser walkthrough at desktop/mobile widths) produced 14 approved improvements,
all shipped and live-verified the same day:

1. **`log_payable_payment` discount mismatch fixed** — the RPC's paid/partial threshold
   still subtracted `discount_amount` for `inventory`/`purchase_order` payables after
   commit `31b06cb` fixed the display side; an underpaid PO could silently show as fully
   paid. Migration `fix_log_payable_payment_discount_and_overpayment`; SQL-verified that
   paying (owed − discount) now leaves `partial`.
2. **Overpayment guard** — same migration rejects payments above the remaining balance
   (all four payable types, payable + paid-so-far resolved *before* the insert); both
   Log Payment dialogs also check client-side first.
3. **PO ↔ payment cross-link** — PO detail's Status card shows a Payment badge once
   receipts exist, plus a "View payments →" link (admin/manager) to the AP detail page.
4. **Payment Method required** in both Log Payment dialogs. Follow-up finding: a payment
   logged with no method generates *no journal draft at all* (`generate_draft_journal_entries`
   skips events whose payment type has no account mapping), so this is data-integrity, not
   cosmetics.
5. **PO list filters** — `DateRangeFilter` (server-side `?from/&to` on `order_date`) +
   status dropdown incl. "Open (Draft/Sent/Partial)".
6. **AP summary cards** — Outstanding Balance / Unpaid / Partially Paid above the
   Supplier Payment list (headline ignores the status filter by design); status filter
   now defaults to "Open (Unpaid + Partial)". Headline SQL-cross-checked to the peso.
7. **Supplier dropdown filter** on the AP list; summary cards respect it ("what do we
   owe supplier X" in one pick).
8. **Void payments** — soft-void via `void_payable_payment(p_payment_id, p_reason)`
   (admin-only, reason required) + `voided_at/voided_by/void_reason` columns. Unwinds the
   journal at whichever stage the payment reached: unprocessed event → consumed;
   `pending_review` draft → rejected; posted → `reverse_journal_entry()`. Emits a
   pre-processed `payment_voided` audit event; all payment readers exclude voided rows;
   Payment History shows a Voided badge + reason + per-row Void dialog. Verified at all
   three journal stages via rolled-back SQL plus a real UI round-trip.
9. **`formatCurrency` sweep** — PO list/detail + both payment detail pages; no inline
   `₱…toFixed(2)` left in the flow.
10. **DataTable accessibility** — sortable headers are real `<button>`s with `aria-sort`;
    new `rowHref` prop renders the first cell as a real `Link` (PO list + AP list), with a
    tabIndex/Enter fallback for tables that only pass `onRowClick`.
11. **Breadcrumbs** — friendly labels (`CRUMB_LABELS` + `crumbLabel()` in
    `app-shell.tsx`; identifiers pass verbatim) and de-linked page-less intermediates
    (`/dashboard/purchasing`, `/dashboard/management`, `financial-settings`,
    `supplier-payments/{incoming,inventory-po}` all 404'd before).
12. **Export to Excel** enabled on the PO list + AP list (AP Type column exports its
    friendly label).
13. **Searchable item picker** — new `components/ui/combobox.tsx` (type-to-filter incl.
    SKU/alias keywords, arrow/Enter/Escape keys, hidden-input `name` support for FormData
    forms, `React.useId` for SSR-stable ids) replaces the native item `<select>` in the
    New PO form and the Add Line Item dialog. Gotcha: deriving a DOM id from
    `randomId()` row state caused a hydration mismatch — fixed by `useId`, don't key DOM
    ids off client-random state.
14. **Draft → Sent without confirm** — benign transition runs directly (inline error
    surface); Cancel keeps its dialog and is relabeled "Cancel Order" (previously both
    dialog buttons read "Cancel").

**Pre-existing bug found and fixed along the way:** `journal_entries_source_type_check`
was never extended for `inventory_payment` / `purchase_order_payment` / `inventory_scrap`
/ `shipment_shipping_cost` — approving any such draft 500'd, and 7 real drafts were stuck
in `pending_review`. Fixed via migration `journal_entries_source_type_allow_newer_event_types`
(the 7 drafts left pending for manual review). See PROGRESS-ACCOUNTING.md session log
2026-07-18 for the accounting-side detail.

**Verification residue (test env):** a voided ₱100 BDO payment on `SPO26-0717-0005`
(demo of the void flow) and cancelled test PO `SPO26-0718-0009` (created through the new
combobox, marked sent without a dialog, cancelled through the confirm path).
