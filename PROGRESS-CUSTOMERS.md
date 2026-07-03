# PROGRESS-CUSTOMERS.md

Tracks the **Customer Management + Shipping** feature build for Sinag Ukit BMS. Follows the
same convention as `PROGRESS-ITEMS.md`/`PROGRESS-ACCOUNTING.md`: `CUST-` prefixed phases, kept
separate from the core `PROGRESS.md` numbering. Append-only.

Source brief: `CUSTOMER-AND-SHIPPING-KICKOFF.md` (given to Claude Code 2026-07-03, not checked
into this repo — key decisions and the Part 2 TBD list are captured below so this file is
self-contained).

---

## Locked decisions (read this before starting any phase)

- **`customers` stays the single BMS profile per person**, still pull-synced from Loyverse.
  Gained shipping-address columns (`address_line1`, `barangay`, `city`, `province`,
  `postal_code` — all nullable, so the form doesn't force an address on walk-ins).
- **`customer_sources`** links a `customers.id` to any number of external identities
  (`source`: `loyverse` | `facebook` | `instagram` | `manual` | `walkin`), so new platforms are
  a new `source` value, not a new migration. All 65 pre-existing Loyverse customers were
  backfilled with a `source = 'loyverse'` row before this feature's UI landed.
- **Facebook/Instagram are schema-ready but not built.** `source` accepts those values; no
  sync, no matching logic, no "Link Facebook" action — that button exists in the UI as a
  disabled stub only.
- **Manual customer creation is BMS-only, one-way.** No push back to Loyverse for
  BMS-created customers. Whether that should change later (would need `sync_status` columns
  on `customers`, same pattern as `items`) is an open decision — not needed now.
- **Receiver info lives on `orders`, not `customers`.** Souvenir/giveaway orders often ship to
  someone other than the paying customer, and that can change order to order — so
  `same_as_customer`/`receiver_*` are snapshotted per-order (same pattern as
  `order_items.item_name_snapshot`), never overwritten by later orders.
- **Not synced to Loyverse.** `same_as_customer`, `receiver_*`, `fulfillment_method`, and
  everything in `order_shipments` are excluded from the `loyverse_receipt_id` push path. There
  is no automated Loyverse push for orders/receipts today (confirmed by grep — only the manual
  "Loyverse Receipt #" field in Production Queue's complete-order dialog writes
  `loyverse_receipt_number` by hand), so this is a forward-looking guard, not a fix to
  existing code.
- **Shipping (Part 2) is schema-only, not built.** `order_shipments`/`couriers` tables exist
  (migration `0023_shipping`) but the page is intentionally deferred — see the TBD list below.

---

## CUST-0 — Schema (applied directly by Sinag, not this session) ✅ DONE

**Status:** Complete 2026-07-03, before this feature's app-code build started.

Migrations applied directly to Supabase (confirmed live via `list_migrations`/`list_tables`,
column-for-column against the kickoff brief — no drift):

- `0020_customer_sources` — new `customer_sources` table.
- `0021_customer_address` — `customers` gains `address_line1`/`barangay`/`city`/`province`/`postal_code`.
- `0022_order_receiver` — `orders` gains `same_as_customer` (bool, default `true`),
  `receiver_name`/`receiver_phone`/`receiver_address_line1`/`receiver_barangay`/`receiver_city`/
  `receiver_province`/`receiver_postal_code`, plus check constraint `orders_receiver_required_check`
  (`same_as_customer = true OR receiver_name IS NOT NULL`).
- `0023_shipping` — `orders` gains `fulfillment_method` (`pickup`|`delivery`, nullable, no
  default — check constraint `orders_fulfillment_method_check`); new `order_shipments` table
  (one-to-many with `orders`); new `couriers` reference table (empty, no rows added yet).

No local `supabase/migrations` folder exists in this repo — schema changes are applied
directly against the linked Supabase project via the Supabase MCP and tracked remotely, not
via local migration files.

---

## CUST-1 — RLS gap found and fixed before building ✅ DONE

**Status:** Complete 2026-07-03, this session, before any UI code.

**Preflight finding:** `pg_policies` showed `customers` SELECT restricted to admin+encoder
only (no manager) and INSERT/UPDATE/DELETE restricted to **admin only** (no manager, no
encoder) — contradicting both the kickoff brief's own claim ("encoder read/insert/update") and
this project's general RLS convention (`BUSINESS_RULES.md` > Security). Real consequences if
left as-is: manager can't see customer names anywhere, including the pre-existing Quotes/Order
List screens' `customers(name)` embed (a latent bug from before this feature, exposed by it,
not introduced by it); encoder would hit a raw RLS denial trying to use Add/Edit Customer.

Confirmed with Sinag before changing RLS (see D022) — chose to widen to match the general
convention rather than build around the gap.

**What was built:**
- Migration `0024_customers_manager_rls` — widened `customers`/`customer_sources` SELECT to
  admin/manager/encoder, INSERT/UPDATE to admin/manager/encoder. DELETE stays admin-only via
  the existing `Admin full access` `ALL` policies on both tables — untouched.
- `get_advisors` (security) confirmed no new findings — same pre-existing warning set before/after.

See D022 in `DECISIONS.md`.

---

## CUST-2 — Customer Management page ✅ DONE

**Status:** Complete 2026-07-03.

**What was built:**
- **List** (`app/dashboard/orders/customers/page.tsx` + `customers-table.tsx`) — Name, Phone,
  Email, Sources (badge per source, ✓/— per `loyverse`/`facebook`/`instagram`/`manual`), Total
  Visits, Total Spent (both already-rollup columns on `customers`, not recomputed), Last Order
  Date (computed by combining `orders.created_at` + `receipts.receipt_date` per customer, since
  no rollup column exists for this). Search (built into the shared `DataTable`) + a source
  filter `Select` above the table.
- **Detail** (`app/dashboard/orders/customers/[id]/page.tsx` + `customer-detail.tsx`, own route,
  not a drawer) — Profile card (phone/email/shipping address/note), Loyalty card (visits/spent/
  points), Linked Accounts (one row per `customer_sources` entry + a disabled "Link Facebook"
  stub), Order History (union of `orders` + `receipts` by `customer_id`, most recent first).
  Edit Customer button reuses the same dialog as Add.
- **Add Customer** (`customer-form.tsx`, dual add/edit mode; `actions.ts`) — `createCustomer`
  inserts `customers` then a `customer_sources` row with `source = 'manual'`; `updateCustomer`
  writes contact/address/note fields only (never touches `customer_sources`).
- **Nav:** added `Customers` under Orders in `components/layout/app-shell.tsx`, above Quotes —
  chosen over a top-level item since top-level sidebar groups in this app are reserved for
  whole departments (Finance, Accounting, Analytics, Administration), and Customers is exactly
  where customer context is already used day-to-day (creating quotes/orders).
- Followed the Item List screen's page/table/actions split per the kickoff brief's own
  instruction, matching the `bms-app` skill's established CRUD pattern (Suppliers as the
  reference).

Key files: `app/dashboard/orders/customers/{page.tsx,customers-table.tsx,customer-form.tsx,actions.ts,[id]/{page.tsx,customer-detail.tsx}}`, `components/layout/app-shell.tsx`.

**Verification:** `npm run build` — zero TypeScript errors, both new routes compiled. Browser-
verified via the Claude Code test account: list search/source-filter (narrowed correctly to 1
row on "Manual"), created a real walk-in customer end-to-end (redirected to detail page, shows
a "Manual — Linked" badge, phone saved), detail page's Order History showed a real existing
order (₱150, completed) for a Loyverse-synced customer. No console errors.

**Left in database for inspection** (not rolled back): one test customer, "Test Walkin
Customer" (`customer_sources.source = 'manual'`).

---

## CUST-3 — Receiver toggle on Quotes/Order List forms ✅ DONE

**Status:** Complete 2026-07-03.

**What was built:**
- A "Ships to customer?" `Toggle` added to `new-quote-form.tsx`, `[id]/edit/edit-quote-form.tsx`
  (Quotes), and `order-list/[id]/edit/edit-order-form.tsx` (Order List) — off reveals
  `receiver_name`(required)/`receiver_phone`/`receiver_address_line1`/`receiver_barangay`/
  `receiver_city`/`receiver_province`/`receiver_postal_code` inputs. Client-side validation
  blocks submit if the toggle is off and receiver name is blank, matching
  `orders_receiver_required_check`.
- `quotes/actions.ts` (`createQuoteWithItems`/`updateQuoteWithItems`) — both are plain
  `orders` table insert/update, already covered by existing RLS, so the receiver fields were
  added directly to the insert/update payload via a shared `readReceiverFields()` helper.
- `order-list/actions.ts` (`adjustOrderItems`) — this path goes through the `adjust_order_items`
  RPC (`SECURITY DEFINER`, the only way encoder/manager can write to a confirmed/in_production
  order, since direct table UPDATE on `orders` is admin-only past `quote` status). The RPC
  itself needed extending — see CUST-4/D023 below — since receiver fields can't be set through
  a plain table update on this path without hitting RLS.
- `fulfillment_method` was **not** exposed in any of these forms — out of scope per the brief
  (Part 2 TBD #1/#2 haven't been decided yet), so it stays `null` on every order created via
  this feature, same as before.

Key files: `app/dashboard/orders/quotes/new/new-quote-form.tsx`,
`app/dashboard/orders/quotes/[id]/edit/edit-quote-form.tsx`,
`app/dashboard/orders/order-list/[id]/edit/edit-order-form.tsx`, both corresponding `page.tsx`
files (fetch + pass the new `receiver` prop), `app/dashboard/orders/quotes/actions.ts`,
`app/dashboard/orders/order-list/actions.ts`.

**Verification:** `npm run build` — zero TypeScript errors. Browser-verified end-to-end: created
a real quote with the toggle off (Jane Receiver, 09179998888, Quezon City) — confirmed via
direct DB query the row saved with `same_as_customer = false` and all receiver fields set.
Opened it in Edit Quote — confirmed the toggle and fields pre-filled correctly from the saved
row. Confirmed the quote to Order List, then edited the receiver phone from Order List's edit
form (the RPC path) — confirmed via DB query the phone updated (09170001111) while
`receiver_name`/`receiver_city`/`same_as_customer` were preserved, not blanked. No console errors.

**Left in database for inspection:** one test quote/order (receiver "Jane Receiver", ₱0 —
no real line item quantity/price was set during the test — now `confirmed`).

---

## CUST-4 — `adjust_order_items` RPC extended for receiver fields ✅ DONE

**Status:** Complete 2026-07-03, alongside CUST-3 (same session, required by it).

**What was built:** Migration `0025_adjust_order_items_receiver_fields` — `CREATE OR REPLACE`
on `adjust_order_items(p_order_id, p_lines, p_customer_id, p_note, ...)` adding 9 new
**trailing optional** parameters (`p_same_as_customer` default `true`, `p_receiver_name`
through `p_receiver_postal_code` and `p_fulfillment_method`, all default `NULL`) so the
existing named-parameter call site kept working unchanged until `order-list/actions.ts` was
updated in the same session to pass them explicitly. The function body's final `orders` UPDATE
now also sets these columns, directly overwriting (not `COALESCE`), matching how
`customer_id`/`note` are already handled on this same UPDATE — the caller always submits the
full current form state, not a partial patch.

**Why extend this RPC instead of a second one:** `adjust_order_items` is the only write path
into a confirmed/in_production `orders` row available to non-admin roles (direct table UPDATE
past `quote` status is admin-only per `orders_admin_update`). A separate plain-table receiver
update from the client would work for admin but silently fail RLS for encoder/manager editing
their own confirmed orders. See D023.

See D023 in `DECISIONS.md`.

---

## Part 2 — Shipping — schema-only, **not started**

Not scoped for this build. `order_shipments`/`couriers` tables exist and are empty (no
couriers seeded yet). Do not build the Shipping page until the TBDs below are resolved — at
minimum #1 and #2, per the original brief.

**Open TBDs (unresolved as of this writing):**
1. **Shipment status workflow** — `order_shipments.status` has no check constraint yet. Needs
   a decided state list (rough guess in the brief: `pending → shipped → delivered`, plus
   `failed`/`returned`) before the status dropdown/constraint can be built.
2. **Pickup orders and `order_shipments`** — current assumption is pickup orders get no
   `order_shipments` row at all (status lives on the order itself). Not decided for real.
3. **Shipping fee reconciliation** — `order_shipments.shipping_fee_charged` vs.
   `orders.total_money` — unclear whether a shipping charge is a separate field or folded into
   the order total. Must be decided before any reporting touches it, to avoid double-counting.
4. **Linking to Accounting** — `journal_entries.source_type = 'order'` exists but is unused;
   posting `shipping_cost` as a courier expense is an ACCT-side integration, not scoped here,
   and Accounting is separately paused (see `MODULE_STATUS.md`).
5. **Split shipments to different receivers** — today `order_shipments` has no receiver
   override of its own; a single order shipping to multiple different people/venues across
   batches isn't supported. Flag if it turns out to be a real need.

**Do-not-yet reminder for whoever builds Part 2:** exclude `fulfillment_method`,
`order_shipments`, and every `receiver_*`/`same_as_customer` field on `orders` from any future
Loyverse push payload (same guard as CUST-3).
