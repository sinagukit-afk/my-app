# PROGRESS-FINANCE.md

Tracks the **Finance module** for Sinag Ukit BMS. Follows the same convention as
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
