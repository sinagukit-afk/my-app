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

---

## QUOTE-7 — List/Detail UX fixes + Quote-No. routing + filters (Sinag's post-launch feedback, kickoff 2026-07-06)

Five fixes requested after using the shipped Phase 1 module:

1. **Duplicate navigation on the list row** — the Customer column had its own `<Link>` to the detail page, on top of the row's own `onRowClick` going to the same place. Remove the link; keep the row click as the sole navigation.
2. **Route by Quote No. instead of raw id** — `/dashboard/orders/quotes/[id]` (and `/edit`, `/view`) will become `/dashboard/orders/quotes/[quoteNumber]`, so the address bar reads `SQT26-0706-0001` instead of a UUID. Chosen deliberately over just fixing a page header — Sinag confirmed this is about the URL itself. Note: **Sales Orders (`order-list/[id]`) keep UUID routing** — the app already has precedent for human-readable routing (`purchase-orders/[reference]`, `receiving/[reference]`), so Quotes joins that pattern rather than inventing a new one; Sales Orders just haven't been migrated to it. Verified `quotes.quote_number` already has a unique index (`quotes_quote_number_key`, not a named constraint but enforced) — safe to use as a lookup key, no migration needed. Pages resolve by `quote_number` then use the real id internally for mutations/RPCs; updated every internal link that pointed at `data.id`/`row.id` (list row, Details page's View/Edit buttons, View page's Back button, Customer History row-click) to use the quote number instead.
3. **Discount/Modifier selects can't be reset to "No Discount"/"None"** — root cause: the shared `Select` component's placeholder `<option>` is `disabled`, so once a real value is picked the empty option can never be reselected. Fixed at the component level (`components/ui/select.tsx`), not just in Quotes — it's a genuine bug anywhere a `Select` has a `placeholder`.
4. **Modifier select label unclear** — shows just the modifier-group name (e.g. "Coaster"); changed to `Modifier(Coaster)` in the line-item editor (shared by New and Edit forms).
5. **Filters** — date-of-creation range filter matching the Sales Report's `DateRangeFilter` (presets + from/to, server-side on `quotes.created_at`), plus a client-side status `FilterBar` (All/Open/Converted/Cancelled/Expired) matching the Item List page's pattern.

**Status: ✅ DONE**

**Verification (browser preview, Claude admin test account, 2026-07-06):**
- List page: Customer column is plain text (no link), row click navigates by quote number; date-range presets (This Month/Last Month/This Year/All Time) plus manual From/To filter `created_at` server-side — confirmed "Last Month" correctly returns zero rows against July-dated test quotes; status `FilterBar` (All/Open/Converted/Cancelled/Expired) correctly narrowed to just the one Cancelled quote.
- Clicked a row → URL is `/dashboard/orders/quotes/SQT26-0706-0004` (not the UUID); breadcrumb and page title show the quote number; Edit button link resolves to `.../SQT26-0706-0004/edit` and loads the correct quote.
- Edit form: set Discount to "10% Discount" then back to "No discount" — value correctly clears to `""` (previously stuck once a real value was picked, since the placeholder `<option>` was `disabled`); same reset check passed on the per-line Modifier select, now labeled `Modifier(Keychain)` instead of just `Keychain`.
- No console errors during the walkthrough. `npm run build` clean (full type-check, all quote routes generated under the new `[quoteNumber]` segment).

**Also fixed while here (not customer-detail-page code but touched for correctness):** `quotes.quote_number` turned out to already have a unique index (`quotes_quote_number_key`) even though no named constraint showed in `pg_constraint` — verified via direct query before relying on it as a routing key, no migration needed. `actions.ts`'s per-quote `revalidatePath` calls were switched from `${LIST_PATH}/${quoteId}` (stale now that the URL uses quote_number, not id) to `revalidatePath(LIST_PATH, 'layout')`, which invalidates all nested quote routes regardless of slug.
