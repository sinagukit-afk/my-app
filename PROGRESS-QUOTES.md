# PROGRESS-QUOTES.md

Tracks the **Quote Module rebuild** for Sinag Ukit BMS. Follows the same convention as `PROGRESS-ITEMS.md`/`PROGRESS-CUSTOMERS.md`/`PROGRESS-INVENTORY.md`: `QUOTE-` prefixed phases, kept separate from the core `PROGRESS.md` numbering. Append-only.

Source doc: `Quote_Module_Business_Requirements_Specification.md` (handed over by Sinag), audited against the live app before any build — see the audit + kickoff-plan conversation for the full conflict list. Two architectural conflicts were found and resolved before building:

1. **BRS assumed Quote and Sales Order are two separate linked documents.** The app modeled both as one `orders` row differentiated only by `status` (`quote|confirmed|...`). Resolved: split into a standalone `quotes`/`quote_items` table pair; `orders` keeps the confirmed-and-beyond lifecycle only.
2. **BRS wants "Convert to Order" to reserve stock; the app's `confirm_order()` deducted it outright.** Resolved: new `convert_quote_to_order()` RPC reserves (`available_qty` → `reserved_qty` via the existing `transfer_stock_status()`), leaving `in_stock` untouched. When reserved stock becomes a real deduction (at Production completion) is explicitly **out of scope** here — deferred to a future "order page revision" phase per Sinag's direction.

Also resolved during kickoff (Sinag's explicit calls, not open questions): shipping/receiver fields removed from Quotes entirely (stay on Sales Orders); discounts/modifiers must be picked from the Loyverse-synced `discounts`/`modifiers` tables, mirroring Loyverse's own resolution rules; quote numbering adopts the BRS format now (`SQTYY-MMDD-0001`, yearly reset) with a full renumbering pass across all document types deferred to project end; Quote Details is a plain view page, not printable (printable/PDF is a separate future phase); Cancellation Reason and Expired status are both new; Convert blocks entirely on stock shortage (BRS's "partial reserve" is deferred to the same future order-page-revision phase); Expired is computed live (no cron), matching this project's existing compute-don't-schedule pattern.

---

## QUOTE-1 — Migration + `convert_quote_to_order()` RPC ✅ DONE

**What was built** (migration `0028_quotes_module_foundation`):
- New tables `quotes`, `quote_items`, `quote_item_modifiers` — see the plan doc for full column list. `quotes` has no shipping/receiver columns (removed per decision).
- `set_quote_number()` trigger — format `SQT<YY>-<MMDD>-<seq>`, sequence resets **yearly** (not daily like the PO reference in D010) — counts `where quote_number like 'SQT'||YY||'%'` across the whole year.
- RLS on all three new tables, mirroring the existing `orders`/`order_items` policy shapes (`_select_all`, `_insert_encoder_manager_admin`, `_admin_delete`, `_admin_update`, `_encoder_update_own_quote` scoped to `status = 'open'`).
- Migrated the only 2 existing `orders.status = 'quote'` rows (test data) into the new `quotes`/`quote_items` tables, then deleted them from `orders`/`order_items`.
- `convert_quote_to_order(p_quote_id)` — modeled directly on `confirm_order()` (same BOM-expansion-via-`item_components` pattern, same `admin|manager|encoder` auth check), with two changes: reserves via `transfer_stock_status(..., 'available', 'reserved', ...)` instead of deducting `in_stock`/`available_qty` directly; creates a **new** `orders` row (`status='confirmed'`) and copies `quote_items` → `order_items`, rather than flipping status in place. Guards: quote must be `open`, not expired (`valid_until >= current_date`), and blocks entirely (no partial reserve) on any component shortage. On success, locks the quote (`status='converted'`, `converted_order_id`, `converted_at`, `converted_by`) and logs a `quote_converted` activity entry.

**Verification (direct SQL, JWT claim set to the Claude admin test account):**
- Successful convert: BOM-expanded reserve on a real composite item — `available_qty` and `reserved_qty` moved by the exact required amount, `in_stock` **unchanged** (confirms reserve-not-deduct). Resulting `orders`/`order_items` rows correct.
- Guard checks: re-converting an already-converted quote → `'... is not open (status=converted)'`. Expired quote (`valid_until` in the past) → `'... has expired'`. Insufficient stock (qty 999 against 8 available) → `'Insufficient stock: ...'`.
- All test rows/movements deleted and inventory levels reset to pre-test state afterward.

**Also found (unrelated, flagged separately, not fixed here):** `inventory_levels` has two duplicate unique indexes on `(variant_id, store_id)` (`inventory_levels_variant_id_store_id_key` and `inventory_levels_variant_store_key`), which breaks `adjust_stock()`'s upsert for negative deltas against an existing row (Postgres validates the raw candidate INSERT values against CHECK constraints before the `ON CONFLICT` arbiter redirects to UPDATE). Spawned as a separate background task; worked around it here via direct `UPDATE`s instead of `adjust_stock()` wherever a negative test-cleanup delta was needed.

---

## QUOTE-2 — Quotes List + New/Edit forms + Cancel-with-reason ✅ DONE

**What was built:**
- `app/dashboard/orders/quotes/quote-line-items.tsx` (new, shared client component + pure calc functions) — reused by both New and Edit forms. Discount resolution: `FIXED_PERCENT`/`FIXED_AMOUNT` auto-compute from the discount's stored `percentage`/`money_amount`; `VARIABLE_AMOUNT`/`VARIABLE_PERCENT` prompt for a manual value at add-time (mirrors how a Loyverse cashier applies a variable discount). `DISCOUNT_BY_POINTS` excluded — no points-redemption system exists in this app. Modifier picker: per selected line's item, looks up assigned modifier groups via `item_modifiers` → `modifiers` → `modifier_options` (single-select per group — live data confirmed no min/max-select metadata exists in the synced modifiers). Line total = `qty × (unit price + modifier total) − line discount`, extending the existing app-wide convention (`line_discount` as an already-resolved line-level dollar amount) rather than reinterpreting BRS's formula as fully per-unit.
- `actions.ts` rewritten for `quotes`/`quote_items`/`quote_item_modifiers` — `createQuoteWithItems`, `updateQuoteWithItems` (blocks edit once status leaves `open` or `valid_until` has passed; keeps the pre-edit activity-log snapshot pattern from D006), `convertQuote` (thin wrapper over the RPC), `cancelQuote(quoteId, reason)` (new — sets `cancellation_reason`/`cancelled_at`/`cancelled_by`, same open/not-expired guard). `deleteQuote`/`confirmQuote` removed — BRS has no Delete action; Convert now goes through the RPC.
- New/Edit forms: Shipping card removed entirely; added Quote Date (defaults today) + Valid Until (defaults `quote_date + 30`, editable) date pickers.

## QUOTE-3 — Quote Details (internal) page ✅ DONE

New `app/dashboard/orders/quotes/[id]/page.tsx` + `quote-detail.tsx` — read-only header/summary, line items (with modifier/discount breakdown), Activity Log panel, link to the converted Sales Order when present, and the View/Edit/Convert/Cancel action buttons gated exactly per the BRS §5 status matrix (computed against `effectiveStatus`, see QUOTE-6). Cancel opens a dialog with an optional reason textarea. Replaces the old dialog-based "View" on the list.

## QUOTE-4 — Quote customer-facing view page ✅ DONE

New `app/dashboard/orders/quotes/[id]/view/page.tsx` — plain (non-printable) page rendering Company/Quote/Customer/Line Items/Summary/Notes sections per BRS §6. Printable/PDF export is explicitly a separate future phase.

## QUOTE-5 — Downstream fixups + drop `'quote'` from `orders` ✅ DONE

Migration `0029_quotes_module_orders_cleanup`: dropped the now-dead `orders_encoder_update_own_quote`/`order_items_encoder_update_own_quote` RLS policies (verified dead — their `using` clause required `status='quote'`, which no `orders` row can be anymore) and narrowed `orders_status_check` to `confirmed|in_production|completed|cancelled`.

Code fixups: Dashboard "Pending Orders" KPI now counts `quotes(status='open')` + `orders(status in confirmed,in_production)` instead of a single `orders` query; Customer detail page's order history unions `quotes` alongside `orders`/receipts; Production Report's `OrderStage` type/stage list/badges dropped `"quote"`; Roles permission-matrix copy updated ("Edit or cancel own quotes only while still Open"). Sales/Financial reports needed no change — their `REVENUE_STATUSES` never included `quote`.

Regenerated `lib/supabase/types.ts` via the Supabase MCP `generate_typescript_types` tool (the file was stale — missing the new tables entirely, which surfaced as a `tsc` error before regeneration).

## QUOTE-6 — Expired-status live-compute wiring ✅ DONE

No cron job — `effectiveStatus` is computed wherever quote status is read or guarded: List and Details pages (`status === 'open' && valid_until < today ? 'expired' : status`), Customer history union, and all three mutating actions/RPC (`updateQuoteWithItems`, `cancelQuote`, `convert_quote_to_order`) independently re-check `valid_until` and reject with a clear error if expired. The Edit route's server-side guard (`notFound()`) also checks `valid_until` so an expired quote's edit URL 404s directly.

---

## Verification (full pass, 2026-07-06)

- `npm run build` — clean compile, full type-check, all 5 new routes generated (`/quotes`, `/quotes/[id]`, `/quotes/[id]/edit`, `/quotes/[id]/view`, `/quotes/new`).
- Browser-preview walkthrough (Claude admin test account): List (correct columns, no Actions column, customer-name links) → Details page (status badges, action-button gating) → customer-facing View page (all BRS sections) → created a new quote with a `FIXED_PERCENT` discount + a modifier selection (math verified live: `4 × (₱100 + ₱0) − 5%×₱400 = ₱380`) → **Convert to Order**, first correctly blocked on insufficient stock (composite item's BOM-expanded raw materials all at 0 available — real data, not a bug), then succeeded after a temporary stock bump, confirming `available_qty`/`reserved_qty` moved by the exact BOM-expanded amount while `in_stock` stayed constant, and the linked Sales Order (Order List edit page) showed the correctly-copied line items → **Cancel with reason** on a separate quote, confirming the reason/activity-log/status-lock all landed correctly and the Edit route 404s afterward → Customer detail page shows the quote in the unioned history → Dashboard "Pending Orders" KPI math confirmed correct → Production Report renders cleanly with the new confirmed-order stage, no `"quote"` stage.
- All test data (quotes, the one test Sales Order, inventory movements, stock levels) created during verification was cleaned up afterward and confirmed back to the pre-test baseline.

**Not built (explicitly out of scope, per the kickoff decisions):**
- Reserved → deducted-at-completion stock transition, and partial-reservation-on-shortage — both deferred to a future "order page revision" phase.
- Printable/PDF Quote document, and BRS §13's cross-document reusable template architecture.
