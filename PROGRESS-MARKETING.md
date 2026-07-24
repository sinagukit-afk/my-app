# PROGRESS-MARKETING.md

Tracks the **Marketing module** build (Quote Requests, Website Products + Modifiers, FAQs,
Testimonials) for Sinag Ukit ERP. Follows the same convention as
`PROGRESS-MANAGEMENT.md`/`PROGRESS-CUSTOMERS.md`: `MKT-` prefixed phases, kept separate from the
core `PROGRESS.md` numbering. Append-only.

Source: verbal kickoff from Sinag 2026-07-24 — *"I have these tables connected on my website.
Now I want a dedicated Nav panel on the app. This is my Marketing data, no connection yet to
other ERP data."* No separate kickoff doc — this file is self-contained. Shipped in commit
`7555259` (single session, direct to `main`).

The five tables back the public site **sinagukit.com** and were previously written/read only by
that site via the Supabase anon (publishable) key — none had any ERP UI. This module gives staff
an in-app management surface for them.

---

## Locked decisions (read this before touching any phase)

- **New top-level "Marketing" nav group**, admin/manager only, placed between Analytics and
  Settings in `components/layout/app-shell.tsx`. Gated three ways (RLS + `NavGroup.roles` +
  page-level `canManageMarketing()`), matching the Finance/Accounting precedent — not the general
  admin/manager/encoder convention — because every write policy on the five `web_*` tables is
  admin/manager. Structure: **Quote Requests** (leaf, with a nav badge) + a **Website Content**
  subgroup (Products, FAQs, Testimonials). See D051.
- **Content vs. operational split.** Four tables are pure CMS (`web_products`,
  `web_productmodifier`, `web_faqs`, `web_testimonials`) — flat CRUD with a publish toggle and
  archive/restore. The fifth (`web_quote_requests`) is an *operational* lead inbox with a status
  workflow, so it gets its own leaf + a detail page, not a content-style table.
- **Modifiers edit inline on the product detail page**, not as their own nav entry —
  `web_productmodifier` is a per-product child (`product_id` FK, `ON DELETE CASCADE`), so it
  follows the Product BOM pattern (list row → detail → child editor), same instinct as
  `PROGRESS-MANAGEMENT.md` MGMT-3's inline modifier options.
- **`converted_quote_id` is deliberately left unwired.** It is the *only* FK from any marketing
  table into ERP data (`web_quote_requests.converted_quote_id → quotes.id`) and is currently
  unused (0 converted). Per Sinag's "no connection yet to other ERP data" framing, the UI is
  **read-only + status workflow only**: `new → contacted → closed` (and back). `status='converted'`
  is **not** offered as a manual transition and the action refuses to set it — that value belongs
  to a future real conversion flow that creates a `public.quotes` row and populates the FK. The
  detail page *displays* a linked quote if one ever exists, but never creates one. See D051.
- **Soft delete, never hard delete** — matches the app-wide convention. Added `deleted_at` to the
  four content tables (`web_quote_requests` has no archive; leads are closed via status, not
  deleted). Archived rows are filtered at the RLS layer, not just in page queries. See MKT-1.
- **Publish toggle is the primary content lever.** `published=false` hides a row from the public
  site (anon RLS requires `published=true`) without archiving it — the everyday "take it down"
  action. Archive is the heavier "remove and forget (but restorable)" action.
- **These tables have no `updated_at` trigger**, unlike most of this schema — every server action
  stamps `updated_at` by hand. Don't assume a trigger will catch it.

---

## MKT-0 — Current-state audit (this session) ✅ DONE

**Status:** Complete 2026-07-24, before any code. Findings via `list_tables`/`execute_sql`/
`pg_policies`/`pg_constraint`:

- **No `/dashboard/marketing` route and no "Marketing" nav group existed.** The only reference to
  any `web_*` table anywhere in the app repo was in `lib/supabase/types.ts` — and that file was
  **stale**: `web_products` and `web_productmodifier` were missing from it entirely (added by
  Django/website migrations after the types were last generated).
- Row counts (all test/seed data per `project_test_data_status`): `web_products` 7 (all
  published, 3 categories), `web_productmodifier` 21, `web_faqs` 25 (10 categories),
  `web_testimonials` 2, `web_quote_requests` 1 (`status='new'`).
- **RLS insert gap found:** `web_products_ins` and `web_productmodifier_ins` had
  `WITH CHECK (true)` — *any* authenticated user (incl. `viewer`/`cashier`) could insert rows into
  the public catalog, while UPDATE/DELETE on the same tables were correctly admin/manager only.
  `web_faqs`/`web_testimonials` gated their inserts correctly, so this was an oversight in just
  those two. Fixed in MKT-1.
- **`web_quote_requests` has no anon SELECT policy** — anon can INSERT (the website form) but not
  read back. So lead PII (names/phones/addresses/IPs) is *not* publicly readable even though the
  table is exposed to the Data API. Verified empirically post-migration via `set local role anon`
  (returns 0 rows). This was already correct; noted so it isn't "helpfully" opened up later.
- `web_quote_requests` also carries a `check_quote_request_rate_limit()` BEFORE INSERT trigger and
  a `quote_requests_status_check` CHECK constraint (`new`/`contacted`/`converted`/`closed`).
- `web_productmodifier.product_id → web_products(id) ON DELETE CASCADE`; `web_products.slug` is
  `UNIQUE`; `web_testimonials.rating` is CHECK 1–5.
- Some `web_faqs.answer` values contain **raw HTML** (`<a href="/contact/">…</a>`) meant for the
  website. The ERP renders it escaped as literal text — intentional, do not "fix" by adding HTML
  rendering to an admin table.

---

## MKT-1 — Schema: soft-delete + RLS hardening ✅ DONE

**Status:** Complete 2026-07-24. Applied directly to the shared Supabase project (SinagUkitData,
`glwskmtworldifydsihc`) via MCP as migration `marketing_tables_soft_delete_and_rls_hardening`
(additive/policy-only, no data touched). **Not captured as a local migration file** — this project
applies migrations through the Supabase MCP, not a local CLI stack (see Open items).

- Added `deleted_at timestamptz` to `web_products`, `web_productmodifier`, `web_faqs`,
  `web_testimonials`.
- Baked `deleted_at IS NULL` into the SELECT policies of all four (both `..._anon_sel` and the
  authenticated `..._sel`), so an archived row is unreachable from the public site even if a
  website/page query forgets the filter — the admin/manager branch of the authenticated policy
  stays unfiltered so archived rows remain visible/restorable in the ERP.
- Closed the insert gap: `web_products_ins` / `web_productmodifier_ins` `WITH CHECK` changed from
  `true` to admin/manager, matching UPDATE/DELETE on the same tables.
- Wrapped `current_user_role()` in `(select …)` on the three `web_quote_requests` staff policies,
  per the RLS consolidation convention (evaluate once per statement, not per row).
- `get_advisors` (security): no new findings beyond the pre-existing set.

Also updated `lib/supabase/types.ts` by hand (not regenerated): added the two missing table
definitions (`web_products`, `web_productmodifier`) and the new `deleted_at` column to
`web_faqs`/`web_testimonials`/`web_products`/`web_productmodifier`.

---

## MKT-2 — Quote Requests (lead inbox) ✅ DONE

**Status:** Complete 2026-07-24.

`app/dashboard/marketing/quote-requests/{page.tsx,quote-requests-table.tsx,actions.ts,statuses.ts}`
+ `[id]/{page.tsx,quote-request-detail.tsx}`
- List: Name (+ email/phone subline), Product, Qty, Needed By, Received (datetime), Status badge.
  Status filter dropdown (default "New"). Row click → detail page.
- Detail: read-only contact/order/customization fields, submitter IP + user agent, an "ERP Quote"
  card (shows the linked quote if `converted_quote_id` is set, else an explanatory "not linked"
  note), and context-aware status transition buttons.
- `setQuoteRequestStatus(id, status)` — gated to admin/manager, refuses `converted`, and refuses
  to move a request that already has a `converted_quote_id` (that row's status is owned by its
  quote). Transitions: `new → contacted | closed`, `contacted → closed | new`, `closed → new`.
- Nav badge: `webQuoteRequests` countKey counts `status='new'`, wired in `app/dashboard/layout.tsx`
  alongside the existing nav counts.

## MKT-3 — Website Products + inline Modifiers ✅ DONE

**Status:** Complete 2026-07-24.

`app/dashboard/marketing/products/{page.tsx,products-table.tsx,product-form.tsx,actions.ts}`
+ `[id]/{page.tsx,product-detail.tsx,modifier-form.tsx}`
- List: Product (+ `/slug`), Category, From (starting price), MOQ, Lead Time (+ rush), Modifier
  count, Status (Live/Draft/Archived). Status filter (default "Live on website"). Row click →
  detail. Category is a free-text field with a `<datalist>` of existing categories (not a locked
  enum — the website treats it as free text).
- Product form (dialog): name, auto-slugified URL slug (editable, validated
  `^[a-z0-9]+(?:-[a-z0-9]+)*$`, unique-violation surfaced as a friendly field error), category,
  description, starting price, MOQ, lead time, rush option, pricing notes, sort order, publish
  toggle.
- Product detail: summary card + an inline **Modifiers** table (the `web_productmodifier` editor),
  same list/filter/publish/archive shape. Modifier form: name, description, price add-on
  (`+₱`/`₱`), sort order, publish toggle.
- Actions (`products/actions.ts`): full product CRUD + `setProductPublished` + archive/restore,
  and a parallel set for modifiers (`createModifier`/`updateModifier`/`setModifierPublished`/
  archive/restore), all admin/manager-gated and `revalidatePath`-scoped to the list and/or the
  specific product detail.

## MKT-4 — FAQs + Testimonials ✅ DONE

**Status:** Complete 2026-07-24.

- **FAQs** `app/dashboard/marketing/faqs/{page.tsx,faqs-table.tsx,faq-form.tsx,actions.ts}` —
  list: Question (+ answer preview), Category, Sort, Status. Two filters: status + category
  (category options derived from live data). Form: question, answer (textarea), category
  (free-text + datalist), sort order, publish toggle. Full CRUD + publish + archive/restore.
- **Testimonials**
  `app/dashboard/marketing/testimonials/{page.tsx,testimonials-table.tsx,testimonial-form.tsx,actions.ts}`
  — list: Author (+ role), Quote (clamped), Rating (★ display, nullable), Sort, Status. Status
  filter. Form: author name, author role, quote, rating (optional 1–5 select), avatar URL
  (validated `http(s)://`), sort order, publish toggle. Full CRUD + publish + archive/restore.
- Shared gate: every marketing page and server action calls `canManageMarketing()` /
  `getMarketingRole()` from `app/dashboard/marketing/access.ts`. Actions check it explicitly (not
  just RLS) because an RLS-denied UPDATE affects zero rows *without raising*, so leaning on RLS
  alone would report false success to the UI.

---

## Verification

- `npx tsc --noEmit` clean; `npx next build` compiles all six new routes.
- Browser-verified via the Claude Code admin test account (`project_claude_test_account`): walked
  all five screens against real data; ran a full create → edit → archive round trip on a
  throwaway **unpublished** FAQ (never visible to the public site), each step DB-confirmed; ran a
  quote-request status transition `new → contacted → new`. Checked console + server logs.
- **Bug caught by verification that `tsc` missed** — see D052 / `feedback_use_server_only_async_exports`
  memory: `SETTABLE_STATUSES` was originally exported from the `'use server'` `actions.ts`. A
  `"use server"` file may only export async functions, so every visit to the quote-request detail
  page 500'd (`A "use server" file can only export async functions, found object`) even though
  `tsc` passed clean. Fixed by moving the constant to a plain sibling `statuses.ts`. `next build`
  (not just `tsc`) catches this class of error.
- Anon exposure re-checked empirically after MKT-1 via `set local role anon`: products 7 /
  modifiers 21 / faqs 25 / testimonials 2 readable, **quote_requests 0** — lead PII stays private;
  archived-row filtering confirmed live.
- The one throwaway test FAQ was hard-deleted afterward (test env, per
  `feedback_test_env_hard_delete_authorization`); the seed quote request was left in `new`. DB back
  to its pre-session state.

---

## Open items / not built

- **Migration not in git.** `marketing_tables_soft_delete_and_rls_hardening` was applied to
  SinagUkitData via MCP only — there is no local migration file, so a from-scratch schema rebuild
  won't replay it. Consistent with how this project has always handled migrations, but worth
  knowing.
- **Production DB not migrated.** The app is still wired to the test env
  (`project_prod_data_migration_batches`); the RLS/`deleted_at` changes only hit SinagUkitData.
  Whenever this ships to `erp.sinagukit.com`, the production DB (SinagUkitProd,
  `project_supabase_prod_project_hands_off`) needs the same migration or the Marketing pages will
  error on the missing `deleted_at` column.
- **Quote → ERP conversion is unbuilt** by design (see locked decisions). `converted_quote_id` and
  `status='converted'` remain reserved for a future flow that would create a `public.quotes` row,
  likely needing a customer match-or-create decision + an RPC.
- **No `sort_order` reorder UI** — sort is an editable number field per row, not drag-to-reorder.
  Fine for the current handful of rows; revisit if lists grow.
- **FAQ answers with embedded HTML render as escaped text** in the ERP (intentional) — if inline
  formatting ever needs to be previewed here, that's a deliberate future addition, not a bug.
