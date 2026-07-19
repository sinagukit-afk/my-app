# PROGRESS-FINANCE.md

Tracks the **Finance module** for Sinag Ukit ERP. Follows the same convention as
`PROGRESS-PURCHASING.md`/`PROGRESS-INVENTORY.md`: dated phases kept separate from the
core `PROGRESS.md` numbering. Append-only.

---

## FIN-1 — Real Expenses/Fixed Assets/Payments, replacing the deprecated Finance shell ✅ DONE

**Status:** Complete 2026-07-11. See `DECISIONS.md` D044 for the cross-cutting schema
decisions shared with this build and `PROGRESS-PURCHASING.md` PUR-1 /
`PROGRESS-ACCOUNTING.md` ACCT-7.9 for the Purchasing/Accounting halves of the same pass.

**Starting state, found during review before any code was written:** `finance/income` and
`finance/expenses` were retired in ACCT-3 (2026-07-02) — read-only archives over the old
flat `income`/`expenses` tables, explicitly marked "do not reintroduce create/edit/delete
here," 0 live rows in either table. `finance/cash-flow`/`finance/profit-loss` still read
those same now-empty tables (untouched by this phase — flagged, not fixed). `finance/
page.tsx` was a bare "Coming soon" stub. Fixed Assets already existed and worked, but under
**Accounting**, not Finance — real asset list + `run_monthly_depreciation()`, but **no
add/edit-asset UI at all** ("Assets are added via migration seed data for now," per
ACCT-5's original session log). Orders → Payment was an outstanding-balance view, not a
payment ledger.

**What was built:**

- **Expenses** (`app/dashboard/finance/expenses/`) — wholesale replacement of the
  deprecated archive with real CRUD over a new `opex_expenses` table (not the retired
  `expenses` — see D044 for why): Create (Direct Entry dialog), Edit/Delete (direct-entry
  rows only — PO-sourced rows stay tied to what was actually received, same principle as
  not editing a posted journal entry), category picker + inline "Manage Categories"
  dialog, optional supplier, payment-status badge (unpaid/partial/paid, derived from
  `payable_payments`), Source badge (Direct Entry vs. Expense PO with a link back to the
  PO), attachments (new Supabase Storage bucket `expense-attachments`, private, admin/
  manager RLS; upload + signed-URL-on-view), and a Log Payment dialog. Recurring OPEX
  (rent/utilities/internet/salaries) uses Direct Entry per the spec; PO-sourced expenses
  come from Purchasing → Expense PO (PUR-1).
- **Fixed Assets** (`app/dashboard/finance/fixed-assets/`) — moved intact from `app/
  dashboard/accounting/fixed-assets/` (component/RPC logic unchanged apart from the new
  columns below). Closed the long-standing "no add-asset UI" gap: new Add/Edit Asset
  dialog (admin-only, matches the existing `fixed_assets` RLS tier — tighter than Expenses'
  admin/manager, unchanged from what ACCT-5 originally set). New `category_id` (from
  Purchasing's `asset_categories`) and `salvage_value` columns;
  `run_monthly_depreciation()`'s monthly-amount calc updated to `(cost - salvage_value) /
  useful_life_months` (was `cost / useful_life_months`) — the client-side depreciation
  *preview* helper (`previewDepreciation()`, mirrors the RPC's own selection/rounding logic
  so the dialog shows what will actually post) had to be updated to match or it would have
  silently drifted from the real RPC's math.
- **Payments** (`app/dashboard/finance/payments/`) — physically moved from `app/
  dashboard/orders/payment/`, all three routes (`page.tsx`, `[orderNumber]/`, `[orderNumber]/
  preview/`) and every internal cross-reference (`active-orders/[orderNumber]/order-
  payments.tsx`, `active-orders/actions.ts`'s `revalidatePath` calls). `close_order_
  payment()`/`order_payments` themselves untouched — this phase is a relocation only.
  **Not built, flagged for later:** the spec's "central payment hub" framing is explicitly
  future work — once `payable_payments` (expense/asset settlements) has real volume, this
  page is the natural place to add a unified transactions tab spanning customer/expense/
  asset/credit-card payments, but that wasn't in this phase's scope.
- **Nav** (`app-shell.tsx`): Finance gained Fixed Assets and Payments; Income/Cash Flow/
  Profit & Loss untouched (out of scope — already-known stale reads of the old `income`/
  `expenses` tables). Accounting lost Fixed Assets (moved out) and gained **Category
  Mapping** (see ACCT-7.9) next to the existing Product Mapping.

**Two real bugs found and fixed during browser verification (neither caught by
`npm run build`):**
1. `previewDepreciation()`'s hand-rolled monthly-amount formula (a deliberate duplicate of
   `run_monthly_depreciation()`'s math, kept in sync by convention rather than by calling
   the RPC read-only) still used `cost / useful_life_months` after the RPC itself was
   updated to subtract `salvage_value` — caught by re-reading the file while adding the
   column, not by any automated check, since nothing exercises the preview against the RPC
   directly.
2. Category Mapping's `CategoryMappingTable` held `expenseRows`/`assetRows` in `useState`
   seeded from server props with no resync — adding a new category via `router.refresh()`
   correctly refetched the server data but the client component's `useState` initial value
   is only read once on mount, so the new row never appeared until a full page reload.
   Fixed with a `useEffect` resyncing local state from props. Same pattern already exists
   unfixed in `product-mapping-table.tsx` (that page never adds/removes rows at runtime, so
   the bug is latent there, not exercised) — worth a look if Product Mapping ever gains a
   similar "add new" affordance.

**Verified (browser preview, Claude admin test account, left in place as labeled real
data per this project's standing verification convention):**
- Created expense category "Repairs & Maintenance" → `SCA-6014` via Manage Categories.
- Logged Direct Expense "July Aircon Repair," ₱1,500, category Repairs & Maintenance →
  `EXP-2026-07110001`, Unpaid, correctly numbered by the new reference trigger.
- Confirmed the matching `expense_recorded` draft in Accounting → Review (`Dr SCA-6014 /
  Cr SCA-2000`, both ₱1,500) → Approve & Post → real Journal Entry, Reverse Entry available.
- Asset PO round trip (raised in Purchasing, received into Fixed Assets) documented in
  PUR-1 — same session, same Category Mapping setup.
- `npm run build` passes, all `/dashboard/finance/*` routes registered including the moved
  `payments/[orderNumber]/preview`; `get_advisors(security)` clean (standard baseline only).

---

## FIN-2 — Customer Payment audit findings ✅ DONE (2026-07-19)

**Status:** Audited, then all 9 findings implemented same-session per Sinag's follow-up
("proceed to 1-9"). Cross-referenced from `PROGRESS-ORDERS.md` (2026-07-19 entry) and
`PROGRESS-PRODUCTION-SHIPPING.md` PS-25, since the affected code spans all three modules —
`Total Due` was (and still is) computed independently in 5 places: the `order-detail` page,
this Finance list (`payments/page.tsx`), this Finance order detail
(`payments/[orderNumber]/page.tsx`), this Finance print preview
(`payments/[orderNumber]/preview/page.tsx`), and `close_order_payment()` itself — each was
fixed individually rather than centralized (see "Still open" below).

**Confirmed live bug that triggered this audit — shipping fee charged to customer was
optional and unrecoverable after shipping:** `order-shipments.tsx` let staff enter "Shipping
Cost (paid to courier)" without requiring "Shipping Fee Charged (to customer)," and once a
shipment was Shipped/Delivered there was no way to fix a missed fee. Verified via direct SQL
against live data before any fix: 3 delivered shipments had real courier cost but ₱0 charged
to the customer — SSH26-0707-0006 (₱500 cost, order SOD26-0707-0009), SSH26-0707-0009 (₱69,
SOD26-0707-0011), SSH26-0708-0023 (₱55, SOD26-0708-0019).

**What was built (all 9 items):**

1. **Fee required at entry** — `order-shipments.tsx`'s Add/Edit Shipment form now blocks
   submit if Shipping Cost > 0 and Shipping Fee Charged is empty (enter 0 explicitly if a
   shipment is free to the customer). Mirrored server-side in `create_shipment()` and
   `update_shipment()` — verified by calling `create_shipment()` directly via SQL with
   `p_shipping_fee_charged => null`, which correctly raised the exception even bypassing the
   client.
2. **Post-ship correction** — new RPC `update_shipment_fee(p_shipment_id, p_shipping_cost,
   p_shipping_fee_charged, p_courier_payment_type_id)`: only touches those 3 columns (items/
   stock stay locked), requires the calling shipment to be delivery + Shipped/Delivered, and
   refuses if `orders.payment_closed_at` is already set. New `updateShipmentFee` server
   action; a narrow "Edit Fee" button/dialog appears on Shipped/Delivered delivery shipments
   in `order-shipments.tsx` whenever the order's payment isn't closed (new `isPaymentClosed`
   prop, threaded through all 3 pages that render `OrderShipments`: Orders active-order
   detail, Orders Shipping detail, Orders On Hold detail — the latter hardcodes `false` since
   an On Hold order can never have a Shipped/Delivered shipment, matching that file's existing
   `canAddShipment={false}` shortcut). Used this live to fix SSH26-0707-0006 (now ₱500/₱500)
   as part of verification; the other 2 historical shipments are intentionally left for Sinag
   to fix via the same "Edit Fee" button once the actual customer-facing amount is decided —
   not a call this session should make unilaterally.
3. **Payment-insert guard** — `order_payments_insert_encoder_manager_admin` RLS policy now
   also requires `payment_closed_at IS NULL AND status <> 'cancelled'` on the referenced
   order (`ALTER POLICY`, no drop/recreate needed); `addOrderPayment` pre-checks the same
   condition for a friendly error message before hitting RLS. Verified by attempting a raw
   insert as the authenticated test user against a payment-closed order via `set local role
   authenticated` + `request.jwt.claims` — correctly rejected with "new row violates
   row-level security policy."
4. **Cancel-with-payments warning** — Cancel Order dialog now shows "This order has ₱X in
   recorded payments. Cancelling does not reverse or refund them" when `data.payments` sums
   to more than 0 (pure client-side, no new query). Verified live against SOD26-0714-0033
   (₱600 paid, still in a cancellable status) — warning rendered correctly; not actually
   cancelled during verification.
5. **Tax wired into Total Due** — `orders.total_tax` now added into the due calculation in
   all 5 duplicated locations plus `close_order_payment()`'s `v_total_due`; a conditional
   "Tax" line was added next to the existing conditional "Shipping Fee" line in the Payments
   card and the print preview. Still 0 on every real order today, so no visible change yet —
   this closes the latent gap for whenever tax is populated.
6. **Pay Full Remaining Balance** — quick-fill link under the Amount field in Add Payment,
   sets the field to the exact current `remainingBalance`. Verified live: filled the field to
   ₱2,330 correctly (matching order total + the just-corrected shipping fee).
7. **Pending-fee indicator** — Finance → Customer Payment list computes
   `hasPendingShippingFee` per order (any dispatched shipment with cost > 0 and fee = 0) and
   shows a "Fee not set" warning badge in the Shipping Fee column instead of a silent "—".
   Verified live: badge showed for SOD26-0707-0009 before the fix, disappeared immediately
   after correcting SSH26-0707-0006's fee.
8. **Change → Overpayment wording** — relabelled with a sub-line: "Becomes a recorded tip if
   closed without returning change." Verified live on SOD26-0714-0033 (already-closed,
   overpaid order).
9. **Cancelled-but-paid surfaced** — Finance list query no longer hard-excludes
   `status = 'cancelled'`; rows are filtered client-side to drop cancelled orders only when
   `totalPaid === 0`, so a cancelled order with real payments stays visible. Badge map gained
   `cancelled: "danger"`. `canAddPayment`/`canClosePayment` also now require
   `status !== "cancelled"` in both order-detail pages (Orders module and Finance module), on
   top of the RLS/action guard from #3. No cancelled order currently has a payment recorded,
   so the positive case wasn't exercisable live without fabricating data — verified by code
   review instead (the filter is a one-line, directly-readable predicate).

**Still open (flagged, not part of the 9 requested items):** the `Total Due` formula remains
duplicated across 5 independent call sites rather than centralized into one shared helper —
each copy is now individually correct (tax included), but a future change still has to touch
all 5 (6 counting the RPC) by hand. Also: the 2 remaining historical underbilled shipments
(SSH26-0707-0009 / order SOD26-0707-0011, SSH26-0708-0023 / order SOD26-0708-0019) are
fixable via the new Edit Fee button whenever Sinag decides what to charge.

**Verification:** `npx tsc --noEmit` and `eslint` clean across every touched file. Browser-
verified end-to-end (Claude admin test account) as detailed above, including two server-side
bypass tests run directly via SQL (RLS policy rejection, RPC-level validation) that a
UI-only test wouldn't have caught.
