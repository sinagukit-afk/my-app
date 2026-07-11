# PROGRESS-PURCHASING.md

Tracks the **Purchasing module** for Sinag Ukit BMS. Follows the same convention as `PROGRESS-ITEMS.md`/`PROGRESS-CUSTOMERS.md`/`PROGRESS-INVENTORY.md`/`PROGRESS-QUOTES.md`: `RECV-` prefixed phases, kept separate from the core `PROGRESS.md` numbering. Append-only.

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
