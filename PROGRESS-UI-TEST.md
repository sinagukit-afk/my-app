# PROGRESS-UI-TEST.md

Tracks a **full-app UI smoke test** for Sinag Ukit BMS — every page navigated in the browser
preview, checked for console/network errors and broken rendering, with findings logged here as a
severity-ranked bug list plus suggested fixes. Follows the same convention as
`PROGRESS-MOBILE.md`/`PROGRESS-ACCOUNTING.md`: `UITEST-` prefixed phases, kept separate from the
core `PROGRESS.md` numbering. Append-only — do not delete past findings, mark them Fixed/Won't-fix
instead.

Source: verbal ask from Sinag 2026-08-12 — "list all bugs and possible fix" via a UI test run by
Claude in the browser preview. Scope/depth confirmed via clarifying questions this same session.

**How to resume:** tell Claude "run UITEST-N" (or "next UI test phase", or "continue the UI
test"). Read this whole file first — the Locked decisions section below has everything needed to
resume a phase without re-asking scope questions. Check off each page as it's tested and log
findings in the Bug Log section immediately, not batched at the end, so nothing is lost if the
session compacts mid-sweep.

---

## Locked decisions (read before starting any phase)

- **Scope: full app sweep** — all ~100 `page.tsx` routes across every module. Not limited to
  recently-changed areas.
- **Depth: smoke test, not full CRUD.** Per page: navigate, check console errors, check network
  4xx/5xx, verify real content rendered (no blanks/stuck skeletons/raw "undefined"/error text),
  exercise one obvious interaction (open a row/detail, open+cancel a dialog, toggle a filter).
  Do **not** submit forms that persist data unless confirming a specific suspected bug requires
  it — this is a smoke pass, not a data-creation pass. If test data is created to confirm a bug,
  note it in that finding so it can be cleaned up.
- **Extra pass 1 — Encoder-role permission check:** re-visit permission-sensitive pages signed in
  as the encoder test account, verify gating matches the Roles Permission Matrix
  (`/dashboard/administration/roles` — hand-maintained, not derived from live RLS per
  memory `project_manager_production_widen_d053`).
- **Extra pass 2 — Mobile viewport (375px):** re-check layout-sensitive pages (Quotation/Invoice
  view+print, Payment preview, dashboard home, key list pages) at mobile width.
- **Accounts:**
  - Admin: `claude-code@sinagukit.internal` (memory `project_claude_test_account`)
  - Encoder: `claude-code-encoder@sinagukit.internal` (memory `project_claude_encoder_test_account`)
- **Dev server:** `.claude/launch.json` config `"dev"` → `npm run dev`, port 3000 (autoPort).
- **Before flagging anything, cross-check `MEMORY.md`** — some odd-looking behavior is documented
  as intentional, e.g. the deactivated-item Combobox blank-label on order/quote **edit** pages is
  by design (see `project_item_deactivate_reactivate_2026_08_10`), not a bug.
- **`AGENTS.md` applies:** non-standard Next.js build — check
  `node_modules/next/dist/docs/` before treating any framework-level oddity as an app bug.

---

## Per-page checklist

1. Navigate to page (as admin unless the phase says otherwise).
2. `read_console_messages` (errors) — any JS errors/warnings?
3. `read_network_requests` — any 4xx/5xx?
4. `read_page` — key content rendered? No blank states, stuck skeletons, raw error text?
5. Exercise one obvious primary interaction if present.
6. Log findings immediately in the Bug Log below.

## Severity taxonomy

- **Blocker** — crash/white-screen, core action totally broken, data-corruption risk
- **High** — feature doesn't work as intended, wrong data shown, permission bypass/wrongly blocked
- **Medium** — console error but still usable, incorrect minor state, confusing UX
- **Low** — cosmetic/layout only

---

## Phases

- [x] **UITEST-0** Setup — start dev server, sign in admin, sanity check. Clean: no console
      errors, dashboard renders live data correctly. Note: dashboard "Low Stock Items" widget
      shows several items as "0 / 0 min" (zero current, zero minimum) — flagged as-is on the
      home page; worth checking during UITEST-3 (Inventory) whether a 0-minimum item should be
      counted as low stock at all.
- [x] **UITEST-1** Orders & Quotes — all pages clean (no console/network errors, arithmetic
      checked out on order/quote totals, header-card counts matched list counts). Confirmed
      `/active-orders/[n]/edit` correctly notFound()s for non-editable statuses and the Edit link
      is correctly hidden on the order detail page in that case (not a bug, verified by source +
      live UI). Quote view/print page (recent feature) renders correctly with header/address and
      correct subtotal/discount/grand-total math.
- [x] **UITEST-2** Purchasing — all pages clean. Confirmed `expense-po` (list) intentionally
      `redirect()`s into the unified `purchase-orders` list (matches the Inventory/Accounting
      module-home pattern, correct). Confirmed receiving log rows (`SRI...`) are plain table rows,
      not links — `/purchasing/receiving/[reference]` is only for receiving against an open PO
      (`SPO...`), so it 404s on an `SRI...` id as expected; no UI control actually points there
      incorrectly. Did not exercise `asset-po/[reference]` or `expense-po/[reference]` (no asset
      or expense PO exists in current test data) — only 1 PO total exists, already covered via
      `inventory-po/[reference]`.
- [x] **UITEST-3** Inventory — found 2 real bugs (High: Dashboard Low Stock widget includes
      archived items; Medium/informational: historical negative `reserved` bucket ledger, since
      self-corrected, confirmed via direct DB query). `/status` and `/stock-movement` both
      intentionally redirect to `/monitoring`. All pages otherwise clean.
- [x] **UITEST-4** Management — found 1 Low bug (breadcrumb raw-UUID display). Items
      (list/new/detail/edit), Product BOM (list), Item Categories, Product Modifiers, Stores,
      Suppliers, Couriers, Customers (list/detail) all otherwise clean.
- [x] **UITEST-5** Finance — found 1 Low bug (Invoice vs Quote print Subtotal/Discount
      terminology inconsistency). Payments (list/detail/preview), Supplier Payments, Expenses,
      Income (read-only archive, intentional), Fixed Assets, Expense Schedule, Credit Card
      Payable all otherwise clean. Amounts/overpaid-negative-balance math checked out across the
      payments list.
- [x] **UITEST-6** Accounting — the most productive phase: 1 Blocker (orphaned journal drafts,
      ~₱6,000 phantom gain risk), 1 High (Cash Flow report broken — queries deprecated tables),
      1 Medium (Balance Sheet always "Out of balance", no period-close), 1 Medium (Furniture
      asset category mismapped), 1 Low (Taxes page mapped-count contradiction). Journal
      (pending/posted/review-draft/new), Trial Balance (balanced, confirms ledger itself is
      healthy), Chart of Accounts, and 6 of 8 financial-settings sub-pages otherwise clean.
- [x] **UITEST-7** Marketing — all clean. Quote Requests, Products, FAQs, Testimonials lists all
      render correctly with no console/network errors.
- [x] **UITEST-8** Administration & Analytics — found 1 more instance of the deprecated-tables
      bug (Financial Report expenses, folded into the Cash Flow finding above) plus confirmed the
      hydration-error finding is systemic (2nd confirmed page: Inventory Report). Administration
      home, Users, Roles (permission matrix captured for the encoder pass), Activity Logs,
      Production Report all otherwise clean.
- [x] **UITEST-9** Auth & misc — found 1 more instance of the breadcrumb dead-end bug (Account,
      folded into the existing finding). Login, Forgot Password, Update Password, root
      (authenticated → dashboard / unauthenticated → login), Account/Profile all clean.
      `/logout` "Page not found" is correct/expected — it's a directory holding only a shared
      server action (`actions.ts`, no `page.tsx`/`route.ts`), invoked by the sidebar's Sign Out
      button via form action, not a navigable URL.
- [x] **UITEST-10** Encoder-role pass — found 1 new Medium bug (Users admin page has no role
      gate, reachable by encoder) + 1 corroborating detail on the existing Low Stock finding
      ("Unknown item" under encoder RLS). Confirmed correct: Finance pages show a proper
      restricted-access message; Suppliers list correctly hides Delete; editing a quote not
      owned by the encoder redirects instead of allowing edit; "Last Activity"/Activity Logs
      correctly scope to the encoder's own actions only; Finance/Accounting nav groups are
      correctly absent from the encoder's sidebar entirely; Roles page (explicitly "read-only
      reference") is intentionally open to all roles.
- [x] **UITEST-11** Mobile viewport pass (375px) — no horizontal-overflow bugs found. Checked
      `document.documentElement.scrollWidth === clientWidth` (no overflow) on Dashboard, Quote
      print view, Invoice/Payment preview, Active Orders list, and Sales Dashboard (charts) — all
      375, no overflow. Confirmed 3rd instance of the breadcrumb "Coming soon" dead-end
      (Analytics), already covered by the existing finding.
      **Inconclusive, not reported as a bug:** attempted to verify the mobile hamburger drawer
      (`components/layout/app-shell.tsx:501,738`, `setMobileOpen((o) => !o)`) actually opens on
      tap — 3 independent methods (`computer` ref-click, plain JS `.click()`, and a manual
      pointerdown/pointerup/click event sequence) all left the `<aside>` at
      `-translate-x-full` (closed). However `computer` clicks also twice hard-timed-out in this
      session specifically in mobile-emulation mode ("Browser pane is currently hidden... may be
      stuck"), and the source handler itself is trivially correct with no obvious bug — so this
      reads more like a tooling/environment limitation (no screenshot available all session to
      visually confirm either way) than a confirmed defect. Flagging as a gap in this test's
      coverage, not a finding — worth a real-device or visual-screenshot check before trusting
      either way.
- [x] **UITEST-12** Compiled final severity-ranked report, published as an Artifact:
      https://claude.ai/code/artifact/eaabd8d1-c68b-44f8-83b4-872b5e56d3ed — 12 findings total
      (1 Blocker, 2 High, 5 Medium, 4 Low). Full sweep complete.

---

## Bug Log

_(populated during execution — one entry per finding)_

### Template

```
#### [SEVERITY] Page — short title
- **Page:** /dashboard/...
- **Role/viewport:** admin, desktop (or encoder / 375px)
- **Expected:** ...
- **Actual:** ...
- **Evidence:** console error / network status / screenshot note
- **Suspected file:** path:line
- **Suggested fix:** ...
- **Status:** Open / Fixed / Won't fix
```

#### [Low] Finance, Analytics & Account breadcrumbs dead-end at "Coming soon"
- **Page:** `/dashboard/finance`, `/dashboard/analytics`, `/dashboard/account` (reached via the
  breadcrumb's module-name segment from any subpage, e.g. clicking "Finance" while on
  `/dashboard/finance/expenses`, or "Account" while on `/dashboard/account/profile`)
- **Role/viewport:** admin, desktop
- **Expected:** clicking the module breadcrumb crumb lands somewhere useful — all three modules
  have multiple fully-built subpages (Finance: Payments/Supplier Payments/Income/Expenses/Credit
  Card Payable; Analytics: Sales/Inventory/Production/Financial reports; Account: Profile).
  `/dashboard/inventory` and `/dashboard/accounting` solve this the same way: they `redirect()` to
  their real landing subpage. Purchasing/Management/Marketing solve it differently but correctly:
  they have no `page.tsx` at all and are listed in `app-shell.tsx`'s `NON_ROUTABLE_PATHS`, so the
  breadcrumb renders their segment as plain text, not a link.
- **Actual:** `app/dashboard/finance/page.tsx`, `app/dashboard/analytics/page.tsx`, and
  `app/dashboard/account/page.tsx` are all static "Coming soon" stubs, and none of the three paths
  is in `NON_ROUTABLE_PATHS` — so the breadcrumb renders them as real links (confirmed live:
  clicked "Finance" breadcrumb from `/dashboard/finance/expenses` and inspected the "Account"
  breadcrumb link from `/dashboard/account/profile` — both are genuine `<a href>` links landing on
  a dead "Coming soon" page with none of the module's actual content).
- **Evidence:** live click-through / DOM inspection; `app/dashboard/finance/page.tsx:1-7`,
  `app/dashboard/analytics/page.tsx:1-7`, `app/dashboard/account/page.tsx:1-7`,
  `components/layout/app-shell.tsx:381-390` (`NON_ROUTABLE_PATHS` set omits all three paths).
- **Suspected file:** `app/dashboard/finance/page.tsx`, `app/dashboard/analytics/page.tsx`,
  `app/dashboard/account/page.tsx`
- **Suggested fix:** match the Inventory/Accounting pattern — replace the stub bodies with
  `redirect("/dashboard/finance/payments")`, `redirect("/dashboard/analytics/sales-dashboard")`,
  and `redirect("/dashboard/account/profile")` respectively (or whichever subpage is the intended
  module home). Simpler alternative: add all three paths to `NON_ROUTABLE_PATHS` in
  `app-shell.tsx:382` to just un-link the crumb, but that's a worse UX than giving the user
  somewhere real to land.
- **Status:** Open

#### [High] Dashboard "Low Stock Items" widget includes archived/deactivated items — **FIXED**
- **Page:** `/dashboard` (Low Stock Items card)
- **Role/viewport:** admin, desktop
- **Expected:** matches `/dashboard/inventory/monitoring`'s behavior, which correctly excludes
  archived (`deleted_at` set) and deactivated (`is_active = false`) items —
  `app/dashboard/inventory/monitoring/page.tsx:35-37` filters `.eq("is_active", true)`,
  `.is("deleted_at", null)`, `.is("item_variants.deleted_at", null)`.
- **Actual:** live on 2026-08-12, the Dashboard's Low Stock Items widget listed
  "Itm-Addon Box, Bottle opener — 0 / 0 min", but that item does not appear at all in Inventory
  Monitoring's 35-item list — because its Recent Activity entry ("Item 'Itm-Addon Box, Bottle
  opener' archived", 1d ago) confirms it's soft-deleted. The Dashboard still surfaces it as
  needing restock even though it's no longer for sale.
- **Evidence:** `app/dashboard/page.tsx:116-126` — the same file's *other* inventory query
  (`inventoryRes`, lines 116-121, powers the Inventory Value tile) selects `item_variants(...,
  deleted_at, items(..., deleted_at))` and correctly skips deleted rows in its loop
  (`app/dashboard/page.tsx:152,154`: `if (!variant || variant.deleted_at) continue;` /
  `if (!item || !item.track_stock || item.deleted_at) continue;`). The `lowStockRes` query right
  next to it (lines 122-126) selects `item_variants(sku, option1_value, items(name))` — no
  `deleted_at`/`is_active` fields at all — and its filter/map at lines 169-183 has no equivalent
  skip. Two queries in the same file, one correct, one not.
- **Suspected file:** `app/dashboard/page.tsx:122-126` (query) and `:169-183` (filter/map)
- **Suggested fix:** add `deleted_at` (and `is_active` — need to also select it on `items`, not
  currently selected by either query in this file) to the `lowStockRes` select, mirroring
  `inventoryRes`'s shape, then skip rows where the item is deleted/inactive or the variant is
  deleted inside the existing `.filter()` at line 169-170, same pattern as lines 150-154.
- **Additional evidence (encoder role):** signed in as the encoder test account
  (`claude-code-encoder@sinagukit.internal`) — the same widget shows this row's item name as
  literally **"Unknown item"** instead of the (stale) archived name admin sees. Consistent with
  RLS: encoder's `items`/`item_variants` read policy likely excludes archived rows entirely, so
  the dashboard's un-filtered low-stock query joins to nothing for that row and falls back to the
  "Unknown item" placeholder — a second, role-dependent symptom of the same missing filter.
- **Fix applied 2026-08-12:** `app/dashboard/page.tsx` — added `deleted_at` to the
  `item_variants` select and `is_active`/`deleted_at` to the nested `items` select in the
  `lowStockRes` query (mirroring `inventoryRes`'s shape exactly), then added a
  `.filter(...)` step before the existing threshold filter that drops any row whose variant or
  item is deleted, or whose item is `is_active = false` — same skip condition as the
  `inventoryRes` loop right above it. **Verified live:** "Itm-Addon Box, Bottle opener"
  (archived) no longer appears in Low Stock Items; the widget now correctly shows the next
  real low-stock item in its place. No console errors.
- **Status:** Fixed

#### [Medium] `reserved` bucket ledger for a BOM component sat ~-1,957 for weeks (self-corrected, root cause unconfirmed)
- **Page:** surfaced via `/dashboard/inventory/monitoring/SIM-0016` (Recent Movements table),
  confirmed against the DB directly (Supabase MCP, project `glwskmtworldifydsihc`, confirmed test
  data per memory `project_test_data_status`).
- **Role/viewport:** admin, desktop
- **Expected:** per `project_inv16_available_qty_reconciliation` (memory) and this repo's
  `TESTING.md` checklist ("No negative stock"), no inventory bucket should go negative — and
  `inventory_levels` currently satisfies this: **live query confirms 0 rows** with any negative
  bucket (`available_qty`/`reserved_qty`/`in_production_qty`/`on_hold_qty`/`incoming_qty`) across
  the whole table right now. So this is not a live-data bug today.
- **Actual:** `inventory_movements` for `Itm-Magnetic Sheet A4 1mm w/ adhesive (SIM-0016)`,
  `status = 'reserved'`, shows a running balance that was already at **-1,957.24** at the earliest
  row queried (2026-07-22 03:17, "Order create ...") and stayed clustered between -1,935 and
  -1,957 through 2026-08-07 07:01 (last "reserved"-status row) via a long chain of "Order
  create"/"Order edit reserve"/"Order edit release"/"Start production" entries — each pair of
  entries nets to zero correctly (the *deltas* are internally consistent), but the **baseline**
  they're all orbiting is deeply negative. `inventory_levels.reserved_qty` for this variant is
  `0.000` right now, so something reset it to 0 after 08/07 — but no corresponding `reserved`-status
  row in `inventory_movements` shows that correction, meaning whatever fixed it bypassed the
  normal audit-logged path (a direct SQL correction, or a reconciliation process that doesn't log
  to `inventory_movements`).
- **Evidence:** SQL run this session —
  `select ... from inventory_levels where variant_id = '55db3e10-a4f5-4fdd-9030-a1f58170b38f'`
  → `reserved_qty: 0.000` (healthy, current);
  `select ... from inventory_movements where variant_id = '...' and status = 'reserved' order by occurred_at asc`
  → earliest row's `quantity_before = -1957.240`; and a table-wide check
  (`select count(*) from inventory_levels where available_qty < 0 or reserved_qty < 0 or ...`)
  → `0` negative rows anywhere, confirming this is historical, not current.
- **Suspected file:** not identified — likely relates to the reservation math for BOM-composite
  items (per-component fractional reserve amounts like `0.042`, `1.05`, `4.2` match this repo's
  BOM-expansion pattern, see `project_sales_dashboard_live_data_2026_07_27`: "composite items need
  BOM-expanded cost"). Root cause of the original -1957 excursion (which predates the earliest row
  in this 50-row window) not identified — would need to pull the full un-truncated history for
  this variant, or check whether this predates a known past incident (memory
  `project_inv16_available_qty_reconciliation` mentions "4/33 rows where a test poke bypassed
  `adjust_stock`" — plausibly the same root cause, already partially investigated once).
- **Suggested fix:** not a live bug to fix right now (current state is clean). Worth a follow-up
  session to (a) confirm no other variant has a similar deeply-negative historical baseline that
  *hasn't* self-corrected, and (b) if this does trace back to the same test-poke incident as
  `project_inv16_available_qty_reconciliation`, close the loop by confirming this variant was one
  of the affected rows.
- **2026-08-12 — no fix applied, on purpose:** when asked to fix the remaining Medium bugs,
  skipped this one deliberately — there's no live defect to fix (re-confirmed: 0 negative rows
  anywhere in `inventory_levels`, right now). It's a closed historical incident, not an open bug;
  the only remaining action is the optional investigation noted above, not a code/data change.
- **Status:** Open — informational/historical, current live state verified clean; not actionable
  as a "fix," only as a follow-up investigation

#### [Medium] Users admin page has no role gate — reachable by encoder (and likely any role), unlike every other restricted page — **FIXED**
- **Page:** `/dashboard/administration/users`
- **Role/viewport:** encoder (test account `claude-code-encoder@sinagukit.internal`), desktop
- **Expected:** per the Roles page itself, "Manage Users & Roles" is an **Admin-only** capability
  (not granted to Manager/Encoder/Cashier/Viewer in the Permission Matrix). Every other
  admin/manager-restricted page checked this session (`/dashboard/finance/*`,
  `/dashboard/accounting/*`, `/dashboard/analytics/financial-report`) enforces this with an
  explicit page-level check that shows a clear "Finance records are restricted to Admin and
  Manager roles" message (confirmed live on `/dashboard/finance/expenses` as encoder).
- **Actual:** navigating directly to `/dashboard/administration/users` as encoder **succeeds** —
  the page renders normally (no restricted-access message), just showing a degraded view:
  "Total Users: 1" (only the encoder's own row, via RLS row-scoping on `profiles`), no "Invite
  User" button, no Edit/Deactivate actions column. Functionally harmless (no other user's data
  leaks, no mutation capability exposed), but structurally inconsistent — a user landing here sees
  a half-empty user-management screen instead of a clear "you don't have access" message, and the
  page only avoids leaking data because RLS happens to scope the underlying query, not because
  the page itself checked the role.
- **Evidence:** `app/dashboard/administration/users/page.tsx:8-22` has no `hasAccess`/role-gate
  return at all — `isAdmin` (line 17) is only used at line 25 to decide whether to additionally
  call `createAdminClient().auth.admin.listUsers(...)` for ban status; the main `profiles` query
  (line 19-22) runs unconditionally for every role with no `.eq("role", ...)` or early return.
- **Suspected file:** `app/dashboard/administration/users/page.tsx`
- **Suggested fix:** add the same `hasAccess`/restricted-message pattern already used by
  `app/dashboard/finance/expenses/page.tsx` and similar pages — gate the whole page on
  `role === "admin"` before running any query, rather than relying solely on RLS to degrade the
  result set for non-admins.
- **Fix applied 2026-08-12:** `app/dashboard/administration/users/page.tsx` — added an
  `if (!isAdmin) return <restricted message>` block right after the existing `isAdmin` check
  (which was already being computed for the banned-user lookup, just never used to gate the
  page), matching the exact wording/component pattern used by Finance pages. **Verified live**
  both directions: signed in as encoder → now shows "User management is restricted to Admins" —
  no user list, no PII. Signed back in as admin → page works exactly as before (all 6 users,
  full Invite/Edit/Deactivate controls). No console errors either way.
- **Status:** Fixed

#### [Low] Breadcrumb shows raw UUID instead of a name on UUID-keyed pages
- **Page:** any detail/edit page keyed by a database UUID rather than a human-readable code —
  confirmed on `/dashboard/management/items/[id]` (edit) and
  `/dashboard/management/customers/[id]` (detail).
- **Role/viewport:** admin, desktop
- **Expected:** breadcrumb shows something readable, e.g. the item/customer name, matching how
  Orders/Quotes/Purchase Orders breadcrumbs show their human-readable codes (`SOD26-...`,
  `SQT26-...`) since those routes are keyed by code, not UUID.
- **Actual:** live-confirmed via `document.querySelector('nav[aria-label="Breadcrumb"]').innerText`
  on the customer detail page: `"Dashboard / Management / Customers / a4371edb-a68d-4825-b3ac-348aa59c040e"`.
  Same pattern confirmed on the item edit page, where the UUID additionally renders as a
  *clickable* breadcrumb link (since it's not the last segment there).
- **Evidence:** `components/layout/app-shell.tsx:392-401` — `crumbLabel()` has no data-fetching
  path; it only maps known static segment names (`CRUMB_LABELS`) or, for anything containing a
  digit/uppercase letter, returns the raw URL segment verbatim (`if (/[0-9A-Z]/.test(seg)) return seg;`).
  That rule works for order/quote/PO codes (meant to be shown verbatim) but also catches raw
  UUIDs, which aren't meant to be shown to a user at all.
- **Suspected file:** `components/layout/app-shell.tsx:392-401` (`crumbLabel`) /
  `403-` (`Breadcrumb` component)
- **Suggested fix:** low priority, cosmetic only. Would need the breadcrumb to receive an optional
  resolved label per page (e.g. via a route-level context or a data attribute set by each
  `page.tsx`) rather than deriving purely from the URL, since a UUID can't be turned into a name
  client-side without a fetch. Given the small blast radius (only shows on UUID-keyed pages'
  breadcrumbs, not the page content itself), likely not worth fixing unless doing a broader
  breadcrumb rework.
- **Status:** Open

#### [Low] Invoice preview and Quote preview use "Subtotal"/"Total Discount" inconsistently
- **Page:** `/dashboard/finance/payments/[orderNumber]/preview` (Invoice) vs.
  `/dashboard/orders/quotation/[quoteNumber]/view` (Quotation) — both recent print-preview
  features.
- **Role/viewport:** admin, desktop
- **Expected:** the same labels mean the same thing in both customer-facing documents, since a
  Quote and the Invoice it becomes are naturally compared side by side.
- **Actual:** on the **Quote** preview (`SQT26-0810-0002`): Subtotal `₱6,560.00` is the
  *pre-discount* sum of gross line amounts; `Total Discount -₱318.00` is then subtracted to reach
  `Grand Total ₱6,242.00`. On the **Invoice** preview (`SOD26-0806-0019`): Subtotal `₱4,560.00` is
  already the *post-discount* net sum (matches the Line Total column, which is itself net — unit
  price ₱48 × 100 = ₱4,800 gross, minus the ₱240 discount shown = ₱4,560 net); `Total Discount
  -₱240.00` is then shown again but is *not* subtracted a second time — `Order Total ₱4,560.00`
  equals Subtotal unchanged. Both documents land on a correct final number, but "Subtotal" means
  gross-before-discount on one and net-after-discount on the other, and "Total Discount" is
  "subtract this" on one and purely informational on the other.
- **Evidence:** live page reads of both preview pages, numbers above taken directly from each.
- **Suspected file:** `app/dashboard/orders/quotation/[quoteNumber]/view/page.tsx` vs.
  `app/dashboard/finance/payments/[orderNumber]/preview/page.tsx`
- **Suggested fix:** pick one convention for customer-facing print documents (a true
  pre-discount Subtotal shown on both, discount subtracted visibly on both) and align the other
  template to match.
- **Status:** Open

#### [Blocker] Deleting an `incoming_items` row orphans its journal draft — 30 of 32 "Pending Review" entries were phantom (~₱6,000 in fake inventory gain) — **FIXED (data cleanup)**
- **Page:** `/dashboard/accounting/journal` (Pending Review section)
- **Role/viewport:** admin, desktop
- **Expected:** every entry in Pending Review corresponds to a real, currently-existing business
  event, and the "32" badge means 32 real transactions genuinely awaiting approval.
- **Actual:** all 32 pending-review drafts were `event_type = 'inventory_adjustment_gain'`.
  **Correction to the original write-up:** they were not all one item — re-verification during
  the fix found **two** items affected, 16 drafts each: "Itm-Plastic - 4.0x6.0 KC with card
  sleeve" and "Itm-Shipping box - Medium 20.5x12x9", both created at the exact same microsecond
  per item-batch (`2026-08-09 13:01:07.566018+00`), same underlying cause. Verified live against
  the database (Supabase MCP, project `glwskmtworldifydsihc`, confirmed test data):
  - **32 `business_events`** rows exist (`event_type = 'inventory_adjustment_gain'`), each
    referencing a *different* `incoming_items.id` in its payload, but with identical quantity/cost
    per item-batch — i.e. two separate 16x-duplicate bulk submissions (source
    `inventory_adjustment`, consistent with the Item Adjustment page's "Bulk Physical Count"
    feature).
  - **Only 2 of the 32 `incoming_items` rows still existed** (1 per item) — the other 30 had been
    deleted at some point.
  - **30 of the 32 `journal_entry_drafts`** referenced a `source_event_id` whose
    `incoming_item_id` payload pointed at a row that no longer existed (confirmed via join query
    → exactly `30` orphaned, 15 per item). Pre-fix `pending_review` count system-wide: **32** —
    **94% of the entire Pending Review queue was orphaned**, not real transactions.
  - Root cause confirmed by reading the trigger function `apply_incoming_item_inventory_movement()`
    (fires `AFTER INSERT` on `incoming_items`): it inserts into `inventory_levels`,
    `inventory_movements`, and `business_events` on every insert, but there is **no corresponding
    DELETE-side trigger or cleanup path anywhere** (searched
    `information_schema.routines` for any function referencing `delete ... incoming_items` —
    found none) — so deleting an `incoming_items` row (however that happened here — looks like a
    manual fix for an accidental 32x bulk-adjustment submission) silently leaves its
    `inventory_movements`/`business_events`/`journal_entry_drafts` behind with no way to tell,
    from the Journal UI, that they're now orphaned.
- **Impact:** if an admin approves and posts these drafts (nothing in the UI distinguishes them
  from real ones), the ledger gets a phantom ~₱6,000 inventory-gain credit for stock that doesn't
  exist. This is the accounting module's core promise (`TESTING.md`: "RLS verified / RPC
  verified", memory `project_acct7_v2_event_architecture`) being violated by a real, reproducible
  gap.
- **Evidence:** SQL run this session — counts and joins listed above; trigger source via
  `pg_get_functiondef` on `apply_incoming_item_inventory_movement`.
- **Suspected file:** the `incoming_items` deletion path (wherever "undo"/"delete" for a
  manual-incoming or bulk-adjustment row lives — not yet located, would need a broader grep for
  `delete from incoming_items` in application code/RPCs beyond what a `LIKE` search over
  `information_schema.routines` covers, e.g. embedded in a larger multi-statement RPC) needs to
  also cancel/delete the associated `journal_entry_drafts` (and reverse the `inventory_movements`
  it created) when an `incoming_items` row is removed — mirroring the reversal pattern already
  used elsewhere per memory `project_acct7_v2_event_architecture` ("reversal RPC ... live
  browser-verified").
- **Suggested fix:** (1) immediate/data cleanup: reject or delete the 30 orphaned pending-review
  drafts so the Journal queue reflects reality. (2) code fix: add a `BEFORE DELETE` trigger on
  `incoming_items` (mirroring `apply_incoming_item_inventory_movement`'s `AFTER INSERT`) that
  reverses the inventory movement and cancels any non-posted `journal_entry_drafts` referencing
  that event — or, if `incoming_items` rows should never be hard-deleted at all, add a guard
  (foreign-key `ON DELETE RESTRICT` or an explicit check) forcing any correction to go through a
  proper reversal RPC instead of a raw delete.
- **Root-cause fix applied 2026-08-12:** added `handle_incoming_item_deletion()`, a
  `BEFORE DELETE FOR EACH ROW` trigger on `incoming_items` (migration
  `incoming_items_before_delete_cleanup` + `incoming_items_before_delete_cleanup_finalize`),
  mirroring `apply_incoming_item_inventory_movement()`'s `AFTER INSERT` counterpart. For each
  `business_events` row the deleted `incoming_items` row spawned (matched via
  `source_table='incoming_items' AND source_id = OLD.id`, not the JSON payload key): if a
  `journal_entry_drafts` row exists and is `pending_review`, auto-rejects it (same `rejected`
  status/audit fields a human reject would set, `reviewed_by = null` to distinguish
  system-triggered from a human decision); if the draft was already `posted`, **blocks the
  delete outright** with a clear error — silently orphaning a posted GL entry would be worse
  than the original bug, that case needs a proper reversal entry first; if no draft exists yet
  (the `manual_incoming`/`purchase_received` event types that `generate_draft_journal_entries()`
  only processes once their payment closes), marks the event `processed_at` so it can never
  later spawn a draft citing a deleted row. Deliberately does **not** touch `inventory_levels`/
  `inventory_movements` — `inventory_movements.lot_id` already has a `NO ACTION` FK to
  `incoming_items(id)` that blocks the delete outright while a movement still references the
  row, so by the time this trigger runs, whoever is deleting has already removed the movement
  themselves (confirmed via research: no app feature or RPC deletes `incoming_items` at all —
  RLS has no DELETE policy for it — so this can only ever fire from a manual admin SQL
  statement, same as what caused the original bug).
  **Verified in rolled-back transactions** (real insert → real delete, using the actual
  production trigger chain, nothing persisted): (1) pending-review case — draft correctly
  flips to `rejected` with the auto-generated note; (2) posted case — delete correctly raises
  `Cannot delete incoming item ...: its accounting entry ... has already been posted ...` and
  the row survives. One test-harness false alarm along the way: an earlier attempt to simulate
  an authenticated session via `set_config('role', 'authenticated', true)` actually switched the
  live Postgres role, which silently made the DELETE itself match 0 rows under RLS (no DELETE
  policy exists for `authenticated`) — looked exactly like "the trigger doesn't fire," but was a
  flaw in the test, not the trigger; resolved by only setting `request.jwt.claims` (enough for
  `auth.uid()`) without changing the actual role. Confirmed via a temporary debug-logging version
  of the function (removed after) that the real function was never even invoked during that
  false alarm. Test data (`00000000-0000-4000-8000-00000000000{4,5,6}`, one of which briefly
  posted a real ₱1.00 test journal entry `SJR26-0812-0109` while diagnosing) was fully reversed —
  `inventory_levels` restored to its exact prior value, no leftover rows anywhere, confirmed via
  query afterward.
- **Data cleanup applied 2026-08-12 (same session, done first):** called the app's own `reject_journal_entry_draft(p_draft_id, p_reason)`
  RPC for all 30 confirmed-orphaned drafts (re-verified the orphan condition immediately before
  acting, scoped to `status = 'pending_review' AND business_events.payload ? 'incoming_item_id' AND
  NOT EXISTS (matching incoming_items row)` — exactly 30 rows matched, no more, no less). Ran via
  Supabase MCP with the session impersonating the admin test account
  (`set_config('request.jwt.claims', ...)` so `auth.uid()`/`current_user_role()` resolve correctly
  and the RPC's own admin/manager role check and audit fields — `reviewed_by`, `reviewed_at`,
  `review_note` — are populated exactly as if done through the UI). Did not touch
  `business_events`, `inventory_movements`, or `inventory_levels` — scope was limited to what was
  asked (clean up the drafts), not the underlying schema gap. **Verified after:** DB — 30 rows now
  `status = 'rejected'`, exactly 2 `pending_review` remain (the 2 legitimate ones, 1 per item)
  system-wide `pending_review` count dropped 32 → 2. Live UI — `/dashboard/accounting/journal`
  Pending Review badge now reads "2"; Rejected filter shows 31 (the 30 just rejected + 1
  pre-existing unrelated rejected draft, untouched).
- **Status:** Fixed — both the phantom-draft data cleanup and the root-cause `BEFORE DELETE`
  trigger are done and verified. The same bulk-adjustment-then-delete sequence can no longer
  silently recreate this: a future accidental delete either auto-rejects the resulting draft
  (pending case) or is blocked outright (posted case).

#### [Medium] Balance Sheet always reads "Out of balance" — no period-close sweeps net income into Equity — **FIXED (display-only)**
- **Page:** `/dashboard/accounting/balance-sheet`
- **Role/viewport:** admin, desktop
- **Expected:** a balance sheet should satisfy Assets = Liabilities + Equity when the underlying
  ledger is balanced.
- **Actual:** live: Total Assets ₱64,783.97, Total Liabilities ₱47,571.82, **Total Equity
  ₱0.00**, "Balance Check: **Out of balance**" (difference ₱17,212.15). The Trial Balance page
  (same session, same data) confirms the underlying double-entry ledger genuinely balances
  (Total Debits = Total Credits = ₱165,652.77, "Ledger Check: Balanced") — so this isn't corrupt
  data, it's a report-level gap.
- **Evidence:** `select account_number, name, category from accounts where category = 'equity'`
  → 5 real equity accounts exist (3000 Equity, 3010 Owner's Capital, 3020 Owner's Drawings, 3030
  Retained Earnings, 3100 Current Year Earnings) but none has ever received a posting — accumulated
  net income (Revenue − COGS − Expenses) is sitting unclosed in the temporary Revenue/Expense
  accounts instead of being swept into an equity account, which is why `totalEquity` in
  `app/dashboard/accounting/balance-sheet/page.tsx:51` (`rows.filter(r => r.category === "equity")`)
  sums to 0 and the balance check at line 52 fails.
- **Suspected file:** `app/dashboard/accounting/balance-sheet/page.tsx:51-52`, and more broadly —
  no "run period close" / "sweep net income to Retained Earnings" feature appears to exist
  anywhere in the Accounting module (not found in the journal, chart-of-accounts, or
  financial-settings pages checked this session).
- **Confirmed precisely:** Profit & Loss page (`/dashboard/accounting/income-statement`, All Time)
  shows **Net Income ₱17,212.15** — exactly the Balance Sheet's shortfall (₱64,783.97 −
  ₱47,571.82). This nails the root cause: the missing balancing figure is unclosed net income,
  not a data error.
- **Suggested fix:** needs a product decision, not just a code fix — either (a) add a period-close
  action that posts a closing journal entry (debit/credit Revenue and Expense accounts to zero,
  credit/debit the difference to Current Year Earnings), matching how `Run Depreciation`
  (Expense Schedule) already works as a similar scheduled-posting pattern, or (b) if closing
  entries are intentionally out of scope for now, have the Balance Sheet compute an implied
  "Current Year Earnings" figure on the fly (Assets − Liabilities − recorded Equity) instead of
  showing a permanently alarming "Out of balance" for a books state that's actually fine.
- **Fix applied 2026-08-12 (deliberately the display-only option, not the period-close
  option):** these two options represent a real product decision — actually posting a closing
  entry would change how "All Time" reports read for every future period, which isn't something
  to decide unilaterally while fixing a UI bug. Implemented the safe, reversible option instead:
  `app/dashboard/accounting/balance-sheet/page.tsx` now computes
  `impliedCurrentYearEarnings = totalAssets - totalLiabilities - recordedEquity` and, when
  non-zero, inserts a client-side-only display row — `3100 — Current Year Earnings (unposted)` —
  into the equity section (using the Chart of Accounts' own pre-existing 3100 account, which
  exists for exactly this purpose but has never been posted to, confirmed via
  `get_balance_sheet()` returning zero rows for it before this fix). Nothing is written to the
  database; `totalEquity` for the "Balanced" check simply includes this computed figure. The row
  is clearly labeled "(unposted)" so it reads as a calculated figure, not a real ledger entry.
  **Verified live:** Balance Sheet now shows Total Equity ₱17,212.15 and "Balance Check:
  Balanced" — the ₱17,212.15 exactly matches Income Statement's Net Income for the same period,
  and the new row sits correctly between the Asset and Liability sections. No console errors.
  A real period-close feature (posting an actual closing journal entry) remains a separate,
  open product decision if wanted.
- **Status:** Fixed (display), period-close feature itself remains a product decision

#### [High] Cash Flow AND Financial Report both show ₱0 for expenses — query deprecated `income`/`expenses` tables instead of the Journal — **FIXED**
- **Page:** `/dashboard/accounting/cash-flow`, and separately `/dashboard/analytics/financial-report`
- **Role/viewport:** admin, desktop
- **Expected:** shows real cash movement — this business clearly has substantial cash activity
  (Trial Balance shows ₱52,444.95 Bank Account, ₱65,453.95 Gcash, ₱18,368.90 Credit Card Payable,
  Journal has 106 posted entries including many `inventory_payment`/`Expense Payment`/`Sale
  Recognized` transactions).
- **Actual:** shows "Total Inflow ₱0.00 / Total Outflow ₱0.00 / Net Cash Flow ₱0.00 / 0 entries"
  no matter what — tested with no filter, with the "All Time" quick-range option, and with an
  explicit manual range (`01/01/2020` to `12/31/2026`, which covers every date seen anywhere else
  in the app this session). All three returned the identical empty result.
- **Evidence:** `app/dashboard/accounting/cash-flow/page.tsx:47-48` queries
  `supabase.from("income")...` and `supabase.from("expenses")...` directly — the exact same two
  tables that `/dashboard/finance/income` (tested this session) explicitly labels "This page is
  now a read-only archive. Income is recorded as balanced double-entry transactions in Accounting
  → Journal" and shows "Total recorded: ₱0.00" for. Nothing writes to `income`/`expenses` anymore
  post-migration to the journal-draft architecture (see memory
  `project_acct9_module_restructure_kickoff`, `project_expense_treatment_engine`) — every other
  financial report checked this session (Trial Balance, Balance Sheet, Profit & Loss) correctly
  derives its numbers from `journal_entries`/`journal_entry_lines` instead, so Cash Flow is the
  one report that was never migrated off the old tables.
- **Second occurrence confirmed:** `/dashboard/analytics/financial-report` shows "Expenses
  ₱0.00", "No expenses in range", and consequently an impossible "Margin % 100.0%" — same root
  cause: `app/dashboard/analytics/financial-report/page.tsx:63` also queries
  `supabase.from("expenses")...`. Notably this page's *Revenue* figure is correct — its footnote
  explains Revenue is deliberately derived straight from `orders` (a different, documented
  methodology than Accounting's ledger-based P&L) — so only the Expenses side was left pointing
  at the dead table, most likely an incomplete migration rather than an intentional design choice
  (nothing documents the Expenses side as intentionally different, unlike Revenue).
- **Suspected file:** `app/dashboard/accounting/cash-flow/page.tsx:47-67` and
  `app/dashboard/analytics/financial-report/page.tsx:63` (and its downstream expense-breakdown
  rendering).
- **Suggested fix:** rewrite both queries to derive inflow/outflow (Cash Flow) and expense totals
  (Financial Report) from posted `journal_entries` / `journal_entry_lines` — filtered to
  cash/bank-category accounts (1020/1025/1035/1040) for Cash Flow, and expense-category accounts
  for Financial Report — the same way Trial Balance/Balance Sheet/Income Statement already source
  their numbers, not from the deprecated `income`/`expenses` tables.
- **Fix applied 2026-08-12:**
  - **Cash Flow** (`app/dashboard/accounting/cash-flow/page.tsx`): "cash accounts" are now
    resolved dynamically — every `bank_accounts` row with `type != 'credit_card'` (excludes the
    BPI Credit Card row, a payable not cash) joined to its `gl_account_id`, plus the "Cash on
    hand" account (`account_number = '1010'`, not in `bank_accounts` since it's physical till
    cash, not a bank/wallet) — rather than a hardcoded account-number list, so it stays correct
    if bank accounts are added/removed later. Queries `journal_entries` (embedding
    `journal_entry_lines`) in the date range, flattens to only lines touching a cash account:
    a debit line is an inflow, a credit line is an outflow, `category` = the entry's
    description, `note` = the line's memo. Same running-balance/table code as before, just fed
    by the new source.
  - **Financial Report** (`app/dashboard/analytics/financial-report/page.tsx`): expense side
    only (revenue untouched, still intentionally derived from `orders`). Queries
    `journal_entries` (embedding `journal_entry_lines(debit, credit, accounts(name, category))`)
    in range, sums `debit - credit` for every line whose account has `category = 'expense'`,
    grouped by day (chart) and by account name (breakdown table — a real GL account name now,
    replacing the old free-text category field). Updated the page's own footnote to reflect that
    expenses now share Profit & Loss's methodology (only revenue has a documented mismatch risk).
  - **Verified live, cross-checked against independent reports, not just "a number appeared":**
    Cash Flow All Time — Total Inflow ₱83,839.00, Outflow ₱31,394.05, Net ₱52,444.95. Confirmed
    against the database directly: summing all-time debit/credit per real cash account
    (BDO +₱2,418, BPI ₱0, Maribank -₱15,427, Gcash +₱65,453.95) nets to exactly ₱52,444.95 —
    matches. Financial Report All Time — Expenses ₱65,489.85, which is an **exact match** to
    Accounting's own Profit & Loss total expense figure for the same range (independently
    verified during the original UI test). Date-range filtering re-tested on both pages
    (Aug 1–12 window) — correctly scoped subsets, math still consistent. No console/network
    errors on any of it.
- **Status:** Fixed

#### [Low] Taxes settings page: "1 of 1 mapped" header contradicts the row showing "Not mapped"
- **Page:** `/dashboard/accounting/financial-settings/taxes`
- **Role/viewport:** admin, desktop
- **Expected:** the "N of M mapped" summary count matches what the table actually shows.
- **Actual:** header reads "1 of 1 mapped." but the single row underneath ("Output Tax Payable")
  shows its GL Account as "Not mapped". Page is explicitly labeled "Foundation-only... not yet
  wired into POS/Orders", so this is low-stakes, but the counter logic is inconsistent with the
  row it's counting.
- **Evidence:** live page read.
- **Suspected file:** `app/dashboard/accounting/financial-settings/taxes/page.tsx` (mapped-count
  calculation likely counts the row as mapped based on a different condition than what the cell
  itself renders — same class of bug as the mapping-parent-account guard work in memory
  `project_mapping_parent_account_guard_2026_07_17`, worth checking if a similar off-by-condition
  issue applies here).
- **Suggested fix:** make the summary count and the cell's "mapped?" check use the same condition.
- **Status:** Open

#### [Medium] "Furniture" asset category is mapped to the wrong GL accounts — **FIXED**
- **Page:** `/dashboard/accounting/financial-settings/expense-categories` (Asset Categories table)
- **Role/viewport:** admin, desktop
- **Expected:** each asset category's Asset Account / Accum. Depreciation Account / Depreciation
  Expense Account should be self-consistent, matching the other 4 categories' pattern (e.g.
  "Machinery & Equipment" → Asset 1530 Machinery / Accum Dep 1630 Accumulated
  depreciation-Machinery / Dep Expense 6730 Depreciation - Machinery — all correctly for the same
  underlying asset type).
- **Actual:** confirmed via direct DB query (`asset_categories` joined to `accounts`) — the
  **Furniture** row alone is wrong: `default_asset_account_id` → **1540 "Tools and Equipment"**
  (should be 1510 "Furniture"), `default_accum_depreciation_account_id` → **1510 "Furniture"**
  (an *asset* account, not an accumulated-depreciation account at all — should be 1610
  "Accumulated Depreciation-Furniture", which isn't referenced by any category). Only
  `default_depreciation_expense_account_id` (6710, correctly "Depreciation - Furniture") is
  right. The other 4 categories (Machinery & Equipment, Office Equipment, Room Improvement, Tools
  and Equipment) are all correctly self-consistent.
- **Evidence:** SQL join of `asset_categories`/`accounts` this session — Furniture row:
  `asset_acct: 1540/"Tools and Equipment", accum_dep_acct: 1510/"Furniture", dep_expense_acct: 6710/"Depreciation - Furniture"`.
- **Suspected file:** data-only issue in the `asset_categories` table (row for "Furniture"), not
  application code — likely a manual-entry mistake during initial CoA/mapping setup.
- **Suggested fix:** edit the Furniture row on this page (Asset Account → 1510 Furniture, Accum.
  Depreciation Account → 1610 Accumulated Depreciation-Furniture) and Save. Real risk if left as-is:
  adding a Furniture fixed asset and running depreciation would debit/credit the wrong accounts,
  mixing Furniture and Tools-and-Equipment book values.
- **Fix applied 2026-08-12:** `UPDATE asset_categories SET default_asset_account_id = <1510
  Furniture>, default_accum_depreciation_account_id = <1610 Accumulated
  Depreciation-Furniture> WHERE name = 'Furniture'` — a pure data correction, no code change
  (`default_depreciation_expense_account_id` was already correct, left untouched). **Verified
  live:** Financial Settings → Expense Categories → Asset Categories now shows Furniture's three
  accounts self-consistent with the same pattern as the other 4 categories (1510 / 1610 / 6710).
- **Status:** Fixed

#### [Medium] React hydration error on the Sales Dashboard's donut chart — **FIXED**
- **Page:** `/dashboard/analytics/sales-dashboard` (Payment Collection donut chart)
- **Role/viewport:** admin, desktop
- **Expected:** no hydration mismatch — server-rendered HTML should match what React computes on
  the client on first render.
- **Actual:** every load of this page threw an uncaught "Hydration failed because the server
  rendered HTML didn't match the client" error. React discarded and re-rendered the affected
  subtree client-side, a visible flicker on a page managers likely check daily.
- **Correction to the original write-up:** initially reported as "systemic, confirmed on 2
  pages" (also `/dashboard/analytics/inventory-report`'s bar chart) based on the locale-formatter
  hypothesis below and console errors seen on both pages. Re-investigation while fixing this
  found that hypothesis was wrong (see Evidence), and — checked properly this time, in a fresh
  browser tab with no prior navigation history to leave stale console/overlay state — Inventory
  Report has **no hydration error at all**. The earlier "2nd confirmed page" was a false positive
  from Next's dev-mode error overlay persisting across client-side navigation, not a real bug in
  `bar-chart.tsx`. This was a single-component bug, not a systemic one.
- **Evidence:** the dev-overlay diff pinpointed `components/business/donut-chart.tsx:60`, an SVG
  `<title>` element — but the real cause needed fetching the raw server-rendered HTML directly
  (`fetch(url, {credentials:'same-origin'})` from the browser console, bypassing hydration
  entirely) to see: `<circle...><title></title></circle>` — the server emitted a **completely
  empty** `<title>` tag, while the legend directly below it (built from the exact same `data`
  array, same formatter call) rendered its text correctly. Node's `toLocaleString("en-PH")` was
  directly tested and confirmed to produce byte-identical output to the browser's for the same
  number, ruling out the original locale-mismatch hypothesis entirely. The real cause: React's
  server renderer mishandles an SVG `<title>` element when given multiple interpolated JSX
  children (`{d.label}: {valueFormatter(d.value)} ({pct}%)` as three separate expressions) —
  it can serialize as empty, while the client always renders the real text, a guaranteed,
  deterministic mismatch on every load (not a live-data race — reproduced identically when
  tested completely idle, no concurrent writes). Confirmed via `grep '<title>' components/` that
  `donut-chart.tsx` was the *only* file in the codebase using this pattern — `bar-chart.tsx` uses
  `title={...}` as a plain HTML attribute (already a single template-literal string), a
  completely different, unaffected code path.
- **Fix applied 2026-08-12:** `components/business/donut-chart.tsx:60` — collapsed the three
  interpolated expressions into one template-literal string:
  `<title>{`${d.label}: ${valueFormatter(d.value)} (${pct}%)`}</title>`. **Verified live** two
  ways: (1) fetched the raw server HTML directly again — `<title>` now contains the real text
  server-side; (2) opened a completely fresh browser tab (no stale state possible) and loaded the
  page — zero console errors.
- **Status:** Fixed
