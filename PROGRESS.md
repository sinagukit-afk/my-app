# Sinag Ukit BMS — Build Progress

## Phase Log

### Phase 0 — Project Audit — 2026-06-30
- What was built: Audit completed, PROGRESS.md created.
- Key files/locations:
  - `lib/supabase/client.ts` — browser-side Supabase client (createBrowserClient)
  - `lib/supabase/server.ts` — server-side Supabase client (createServerClient, reads/writes cookies)
  - `proxy.ts` — session-refresh helper; has the correct middleware shape but is named `proxy.ts` instead of `middleware.ts`, so Next.js does NOT load it as middleware. Token refresh at the edge is currently non-functional.
  - `app/layout.tsx` — root layout
  - `app/page.tsx` — landing page; redirects authenticated users to /dashboard
  - `app/login/page.tsx` + `app/login/actions.ts` — email/password login form and server action
  - `app/logout/actions.ts` — sign-out server action
  - `app/auth/update-password/page.tsx` — client-side password reset form
  - `app/dashboard/layout.tsx` — dashboard shell; auth guard (redirects to /login if no user); fetches profile role; inline nav with Sales / Inventory / Incoming links
  - `app/dashboard/page.tsx` — sales dashboard (receipt_line_items query)
  - `app/dashboard/inventory/page.tsx` — inventory levels table
  - `app/dashboard/incoming/page.tsx` — incoming items data fetch
  - `app/dashboard/incoming/IncomingItemForm.tsx` — client form component
  - `app/dashboard/incoming/actions.ts` — addIncomingItem server action
  - `supabase/*.sql` — raw SQL migration files (4 files; kept for reference)
- Notes for next phase: Removal list for Phase 1 is:
  1. `components/Header.tsx` — never imported anywhere; dead code
  2. `components/Footer.tsx` — never imported anywhere; dead code
  3. `public/file.svg` — Next.js scaffold asset, not referenced in the app
  4. `public/globe.svg` — Next.js scaffold asset, not referenced in the app
  5. `public/next.svg` — Next.js scaffold asset, not referenced in the app
  6. `public/vercel.svg` — Next.js scaffold asset, not referenced in the app
  7. `public/window.svg` — Next.js scaffold asset, not referenced in the app
  8. `README.md` — default Next.js boilerplate README, not project-specific documentation
  - **Note — NOT proposed for removal yet:** `proxy.ts` is currently disconnected (not wired as middleware), but it contains the correct session-refresh logic. Recommend renaming it to `middleware.ts` in a future phase rather than deleting it.

### Phase 1 — Project Foundation — 2026-06-30
- What was built: Removed 8 scaffold/dead-code files; created clean folder skeleton for future modules; `npm run build` passes with zero errors and zero TypeScript errors.
- Key files/locations: Deleted `components/Header.tsx`, `components/Footer.tsx`, `public/*.svg` (5 files), `README.md`; created `components/ui/`, `lib/types/`, `lib/utils/` (each with `.gitkeep`).
- Notes for next phase: Login flow and all existing routes are untouched. `proxy.ts` still exists but is not wired as middleware — Phase 2 should rename it to `middleware.ts` to activate session refresh. New folders are empty placeholders ready for module code.

### Phase 2 — Design System & Providers — 2026-06-30
- What was built: Global CSS design tokens (colors, typography, spacing, radius, shadows); `cn()` utility; 9 UI components (Button, Card, Input, Badge, Dialog, Skeleton, Container, Section, PageHeader); 5 providers (ThemeProvider functional, RoleProvider/PermissionProvider/NotificationProvider/AIProvider placeholders); root layout updated with full provider tree.
- Key files/locations: `app/globals.css` (tokens), `lib/utils/cn.ts`, `components/ui/` (9 files), `components/providers/` (6 files including index), `app/layout.tsx` (providers wired).
- Dependencies added: `class-variance-authority`, `clsx`, `tailwind-merge`, `@radix-ui/react-dialog`, `@radix-ui/react-slot`.
- Notes for next phase: All components are plain Tailwind CSS variables — no `tailwind.config.js` needed (Tailwind v4). ThemeProvider sets `data-theme` / `.dark` on `<html>` — dark mode CSS overrides can hook into that. `proxy.ts` still needs renaming to `middleware.ts`.

### Phase 3 — Application Shell — 2026-06-30
- What was built: `AppShell` client component with collapsible left sidebar, top header (app title + user info + sign out), breadcrumb bar, and scrollable main content area; dashboard layout updated to use AppShell (server auth guard passes user/role as props + `logout` server action); dashboard page replaced with welcome message.
- Key files/locations: `components/layout/app-shell.tsx` (new), `app/dashboard/layout.tsx` (rewritten), `app/dashboard/page.tsx` (replaced with welcome).
- Notes for next phase: Sidebar nav items include placeholder routes (`/dashboard/sales`) that don't exist yet — Phase 4 should add real module pages. Breadcrumb derives labels from URL segments; pages can override with their own `<PageHeader>`. `proxy.ts` still needs renaming to `middleware.ts`.

### Phase 4 — Navigation Framework — 2026-06-30
- What was built: Rewrote `AppShell` sidebar nav with expandable group (Operations → Inventory, Purchasing, Orders), per-item inline SVG icons, active-route highlighting, and auto-open of the group containing the current route; created 6 stub pages for all new routes.
- Key files/locations: `components/layout/app-shell.tsx` (rewritten); `app/dashboard/purchasing/page.tsx`, `orders/page.tsx`, `finance/page.tsx`, `analytics/page.tsx`, `administration/page.tsx`, `account/page.tsx` (new stubs).
- Notes for next phase: All nav routes exist and build. `proxy.ts` still needs renaming to `middleware.ts`. Existing `/dashboard/incoming` page is still reachable but not in the new nav — decide whether to keep, rename, or fold into Purchasing/Orders.

### Phase 5 — Dashboard — 2026-06-30
- What was built: Full dashboard page with 7 widgets — 4 KPI stat cards (Today's Sales, Monthly Revenue, Pending Orders, Inventory Value), Recent Activity feed, Low Stock Items list, and Quick Actions bar; all mock data, no real DB queries.
- Key files/locations: `app/dashboard/page.tsx` (rewritten, client component).
- Notes for next phase: All widgets use design-system components (Card, Badge, Button, PageHeader). Quick Actions link to existing stub routes. `proxy.ts` still needs renaming to `middleware.ts`.

### Phase 6a — Module Stubs: Operations — 2026-06-30
- What was built: 10 stub pages for Operations sub-modules (Inventory ×4, Purchasing ×2, Orders ×4); sidebar nav expanded with a `NavSubGroup` type that renders labelled sections inside the Operations group.
- Key files/locations: `app/dashboard/inventory/{incoming,adjustment,stock-movement,suppliers}/page.tsx`; `app/dashboard/purchasing/{purchase-orders,receiving}/page.tsx`; `app/dashboard/orders/{quotes,order-list,production-queue,completed}/page.tsx`; `components/layout/app-shell.tsx` (nav types + render updated).
- Notes for next phase: Existing `/dashboard/inventory`, `/dashboard/purchasing`, `/dashboard/orders` parent pages still exist but are no longer in the sidebar nav — decide whether to repurpose as section overviews or remove. `proxy.ts` still needs renaming to `middleware.ts`.

### Phase 6b — Module Stubs: Finance & Analytics — 2026-06-30
- What was built: 8 stub pages for Finance (Income, Expenses, Cash Flow, Profit & Loss) and Analytics (Sales Report, Inventory Report, Production Report, Financial Report); both sections converted from flat nav items to expandable `NavGroup` entries in the sidebar.
- Key files/locations: `app/dashboard/finance/{income,expenses,cash-flow,profit-loss}/page.tsx`; `app/dashboard/analytics/{sales-report,inventory-report,production-report,financial-report}/page.tsx`; `components/layout/app-shell.tsx` (Finance and Analytics nav entries updated).
- Notes for next phase: Existing `/dashboard/finance` and `/dashboard/analytics` parent pages still exist but are no longer nav items — same decision needed as for Operations parents. `proxy.ts` still needs renaming to `middleware.ts`.

### Phase 6c — Module Stubs: Administration & Account — 2026-06-30
- What was built: 4 stub pages — Administration (Users, Roles, Activity Logs) and Account (Profile); both sections converted from flat nav items to expandable NavGroup entries; all 22 sidebar links across the full app now resolve to real, rendering pages.
- Key files/locations: `app/dashboard/administration/{users,roles,activity-logs}/page.tsx`; `app/dashboard/account/profile/page.tsx`; `components/layout/app-shell.tsx` (Administration and Account nav entries updated).
- Notes for next phase: Orphaned parent pages (`/dashboard/administration`, `/dashboard/account`, and the Operations/Finance/Analytics parents) are still reachable by direct URL but not linked from the nav — Phase 7 should decide whether to repurpose or remove them. `proxy.ts` still needs renaming to `middleware.ts`.

### Phase 7 — Shared Business Components — 2026-06-30
- What was built: 9 reusable business components (StatCard, PlaceholderCard, EmptyState, SearchBar, FilterBar, NotificationBell, UserMenu, Breadcrumb, DataToolbar); all client-side where needed, no real data connections.
- Key files/locations: `components/business/` — one file per component plus `index.ts` barrel export.
- Notes for next phase: Components are ready to drop into module pages. `proxy.ts` still needs renaming to `middleware.ts`. Orphaned parent stub pages still unresolved.

### Phase 8 — Reusable Forms & Tables — 2026-06-30
- What was built: 7 form input components (TextArea, NumberInput, CurrencyInput, DatePicker, Select/Dropdown, Toggle, Checkbox) plus a fully-featured DataTable (search, column sorting, pagination, empty state, loading skeleton rows); existing `Input` from Phase 2 covers TextInput.
- Key files/locations: `components/ui/textarea.tsx`, `number-input.tsx`, `currency-input.tsx`, `date-picker.tsx`, `select.tsx`, `toggle.tsx`, `checkbox.tsx`, `data-table.tsx` — all use design-system CSS tokens.
- Notes for next phase: All components are drop-in ready for module pages. DataTable is generic (`DataTable<T>`) — pass typed `columns` + `data` arrays. CurrencyInput defaults to ₱ symbol, configurable via `currency` prop. `proxy.ts` still needs renaming to `middleware.ts`.

### Phase 9 — Future Readiness — 2026-06-30
- What was built: 11 extension-point placeholder files (no implementation, no credentials) across 7 new folders; each file contains a step-by-step wiring plan for its feature.
- Key files/locations: `lib/supabase/types.ts`; `lib/ai/index.ts`; `lib/integrations/n8n/index.ts`; `lib/uploads/index.ts`; `lib/scanner/barcode.ts`, `qr.ts`; `lib/print/index.ts`; `lib/export/excel.ts`, `pdf.ts`; `lib/audit/index.ts`.
- Notes for next phase: Project is now ready for real feature development. Wire Supabase types (`lib/supabase/types.ts`) and audit logs (`lib/audit/index.ts`) as the first real integrations.

### Fix — Middleware activation — 2026-06-30
- What was fixed: `proxy.ts` renamed to `middleware.ts`; exported function renamed from `proxy` to `middleware`. Next.js now loads it as edge middleware on every request, enabling session token refresh via `@supabase/ssr`.
- Key files/locations: `middleware.ts` (was `proxy.ts`).
- Notes: `npm run build` confirms middleware is active (shown as `ƒ Proxy (Middleware)` in build output).

### Theme — Sinag Ukit brand tokens — 2026-06-30
- Applied Sinag Ukit brand theme tokens (globals.css + tailwind.config.ts) per design/theme/THEME.md.

### Phase 10 — Operations Backend Schema — 2026-07-01
- What was built: Applied migration `0004_operations_schema` directly to Supabase (SinagUkitData, project `glwskmtworldifydsihc`) via the Supabase MCP connector. Added the tables and functions the Operations UI (Phase 6a stubs) will need. Inventory model decided: **stock is controlled locally**; Loyverse is receipt-only; the n8n sync is disabled.
- Key files/locations (database, not app repo):
  - `public.suppliers` — new master table. Backfilled 2 rows from existing free-text `incoming_items.supplier` values.
  - `public.purchase_orders` + `public.purchase_order_items` — new; status enum draft/sent/partial/received/closed/cancelled.
  - `public.incoming_items` — added `supplier_id`, `purchase_order_id` FK columns (existing auto-movement trigger `apply_incoming_item_inventory_movement` untouched — it already upserts `inventory_levels` and posts a movement on insert; this is the pattern to follow for all future stock writes).
  - `public.orders.status` — remodelled to a pure business lifecycle: `quote` → `confirmed` → `in_production` → `completed` (+ `cancelled`). Loyverse sync state stays in the separate `orders.sync_status` column.
  - `public.inventory_movements.movement_type` — added `'order'` value, for stock consumed when a quote is confirmed.
  - RPC `public.adjust_stock(p_variant_id, p_qty_delta, p_reason, p_store_id, p_note)` — for the Item Adjustment screen; upserts `inventory_levels` then posts a `manual_adjustment` movement in one transaction; blocks negative stock; role-gated to admin/manager/encoder.
  - RPC `public.confirm_order(p_order_id)` — for the Quotes → Order List transition; expands composite lines one level via `item_components` (BOM), sums required qty per component, checks availability, deducts `inventory_levels`, posts `'order'` movements, flips `orders.status` to `confirmed`, all atomically (raises and rolls back the whole transaction on any shortfall). Single-level BOM only; skips variants where `items.track_stock = false`.
  - Local copies of the migration SQL and this log: `/mnt/user-data/outputs/0004_operations_schema.sql`.
- Notes for next phase: This was a **database-only** change — no app code was touched yet, so the Phase 6a stub pages (`app/dashboard/inventory/*`, `purchasing/*`, `orders/*`) still render placeholders. Phase 11 should wire the Suppliers stub to real Supabase queries — simplest CRUD, good pattern-proving phase before the RPC-dependent screens. `proxy.ts`/`middleware.ts` item is resolved (see Fix entry above); no longer needs repeating.
- Open decisions to resolve before wiring Quotes/Order List (Phase 14 below):
  1. Verify no existing app code reads/writes the old `orders.status` values (`draft`, `synced`, `failed`) before deploying — Phase 10 assumed the table was empty (0 rows) and changed the constraint.
  2. Decide whether `adjust_stock` should stay open to the `encoder` role or be tightened to admin/manager only.

## Operations Backend — Reference (for Phases 11–15)

Screen → data source mapping, now that Phase 10's schema is live:

| Screen | Table / RPC |
|---|---|
| Stock Movement | read `inventory_movements` (join variant/item names) |
| Item Adjustment | call `adjust_stock(variant_id, qty_delta, reason[, store_id, note])` |
| Incoming Inventory | insert `incoming_items` (movement auto-posts); set `supplier_id` / `purchase_order_id` |
| Suppliers | CRUD `suppliers` |
| Purchase Orders | CRUD `purchase_orders` + `purchase_order_items` |
| Receiving | insert `incoming_items` against a PO; bump `quantity_received` + PO `status` |
| Quotes | `orders` where `status = 'quote'` |
| Order List | `orders` where `status in ('confirmed','in_production')` |
| Production Queue | `orders` where `status = 'in_production'` |
| Completed Orders | `orders` where `status = 'completed'` |
| Confirm a quote | call `confirm_order(order_id)` → deducts BOM, sets `status = 'confirmed'` |

Stock-change pattern to follow everywhere: upsert `inventory_levels` (on conflict `variant_id, store_id`), **then** insert an `inventory_movements` row with `quantity_after` set to the resulting level. Never edit a level directly outside an RPC or the existing incoming trigger — there is deliberately no generic movements→levels trigger, to avoid double-counting against the incoming-item trigger.

RLS convention used on all new tables: SELECT = any authenticated user; INSERT/UPDATE = admin/manager/encoder; DELETE = admin/manager only. Both RPCs are `SECURITY DEFINER` and check `current_user_role()` internally.

### Phase 11 — Suppliers Screen — 2026-07-01
- What was built: `app/dashboard/inventory/suppliers/page.tsx` wired to real CRUD against `public.suppliers`, replacing the "Coming Soon" stub. Server component reads suppliers + the current user's `profiles.role`; a client table renders them via the Phase 8 `DataTable`, with an Add/Edit dialog (Dialog + Input/TextArea) and inline Deactivate/Activate + Delete row actions. Role gating in the UI mirrors the live RLS policies: Add/Edit/Deactivate show only for admin/manager/encoder, Delete only for admin/manager. `deleteSupplier` catches Postgres FK-violation errors (suppliers referenced by `incoming_items`/`purchase_orders` have `ON DELETE NO ACTION`) and surfaces a friendly "Deactivate it instead" message rather than a raw DB error.
- Key files/locations:
  - `app/dashboard/inventory/suppliers/page.tsx` — server component; fetches suppliers + role, renders `SuppliersTable`.
  - `app/dashboard/inventory/suppliers/suppliers-table.tsx` — client `DataTable` wrapper; columns, row actions, add/edit dialog trigger.
  - `app/dashboard/inventory/suppliers/supplier-form.tsx` — client Add/Edit dialog form (Input/TextArea, Dialog from Phase 2/8).
  - `app/dashboard/inventory/suppliers/actions.ts` — server actions `createSupplier`, `updateSupplier`, `setSupplierActive`, `deleteSupplier`; same `'use server'` + `revalidatePath` pattern as `app/dashboard/account/profile/actions.ts` (the `app/dashboard/incoming/actions.ts` referenced in the task no longer exists — that route was replaced by `inventory/incoming` in Phase 6a — so this phase's server-action shape was pattern-matched from the profile actions instead).
  - `.claude/launch.json` — added (didn't exist yet) so the dev server can be previewed via the preview tool.
- Verification: `npm run build` passes with zero TypeScript errors. Confirmed via curl that `/dashboard/inventory/suppliers` compiles and redirects unauthenticated requests to `/login` (no server crash). Follow-up: verified the authenticated UI in the browser (see Fix entry below) — the Suppliers table, Add/Edit dialog, and row actions all render and open correctly once the app-wide transparent-surface bug was fixed.
- Notes for next phase: This is the reference pattern for Phase 12–13's simpler CRUD needs — role-gated actions, FK-aware delete with a soft-deactivate fallback, dialog-based add/edit form. No destructive SQL was run this phase (schema was already live from Phase 10).

### Fix — Tailwind v4 arbitrary CSS-variable syntax (transparent surfaces app-wide) — 2026-07-01
- What was fixed: Every themed color/shadow utility across the app used Tailwind v3's CSS-variable arbitrary-value shorthand, e.g. `bg-[--color-surface]`, `border-[--color-border]`, `shadow-[--shadow-lg]`. The project is on **Tailwind v4.3.1**, where that bracket shorthand no longer auto-wraps in `var(...)` — v4 requires parentheses (`bg-(--color-surface)`) to reference a CSS custom property as an arbitrary value. Brackets around a bare `--variable` produced no CSS rule at all, so every surface/border/text/shadow utility silently resolved to nothing (confirmed via `getComputedStyle` returning `rgba(0, 0, 0, 0)`). This was invisible on most pages because everything was uniformly transparent against the same page background, but became obvious as a see-through modal when the Suppliers Add/Edit dialog (Phase 11) was opened over the table. Ran a scripted regex pass converting `-[--foo]` → `-(--foo)` across all 58 affected files (`components/ui/*`, `components/business/*`, `components/layout/app-shell.tsx`, nearly every `app/dashboard/**/page.tsx`) — pure syntax substitution, no visual/behavioral intent changes, no changes to `app/globals.css` token definitions.
- Key files/locations: 58 `.tsx` files under `app/` and `components/`; see `git diff --stat` for the full list. `app/globals.css` untouched (it only defines variables, doesn't consume them via this shorthand).
- Verification: `npm run build` passes with zero TypeScript errors, same route list as before. Re-grepped for `\[--` across `app`/`components` — zero remaining matches. Verified live in the browser (already-authenticated session via the connected Chrome tab): Suppliers Edit dialog now renders as an opaque white card over a dimmed backdrop; spot-checked the Administration → Users page (stat cards, role badges, table) and the sidebar/header chrome — all now show correct surface colors, borders, and shadows instead of blending into the page background. Confirmed via `getComputedStyle` that background-color now resolves to real values (e.g. `rgb(255, 255, 255)`) instead of `rgba(0, 0, 0, 0)`.
- Notes for next phase: This was a global, pre-existing bug fixed opportunistically while validating Phase 11's dialog, not itself a Phase 11 scope item. All future components should use the parenthesis form (`bg-(--color-x)`) for CSS-variable arbitrary values — the bracket form silently no-ops on this Tailwind version.

## Upcoming Phases (planned, continuing from Phase 10)

- [ ] **Phase 12 — Stock Movement + Item Adjustment.** Wire `stock-movement/page.tsx` as a read-only ledger view; wire `adjustment/page.tsx` to call `adjust_stock()`.
- [ ] **Phase 13 — Purchase Orders + Receiving.** Wire `purchasing/purchase-orders/page.tsx` (CRUD) and `purchasing/receiving/page.tsx` (insert `incoming_items` against a PO; update `quantity_received` + PO status).
- [ ] **Phase 14 — Quotes + Order List.** Wire `orders/quotes/page.tsx` and `orders/order-list/page.tsx`; wire the confirm action to `confirm_order()`. Resolve the two open decisions from Phase 10 first. Highest-complexity phase.
- [ ] **Phase 15 — Production Queue + Completed Orders.** Status-board views over `orders`; decide the Loyverse receipt-on-completion flow now that n8n sync is disabled (manual entry, a re-enabled targeted workflow, or a different integration point).
