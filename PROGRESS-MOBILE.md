# PROGRESS-MOBILE.md

Tracks the **mobile-responsiveness retrofit** for Sinag Ukit BMS. Follows the same convention as
`PROGRESS-AUTH.md`/`PROGRESS-MANAGEMENT.md`: `MOBILE-` prefixed phases, kept separate from the
core `PROGRESS.md` numbering. Append-only.

Source: verbal ask from Sinag 2026-07-10 — "Make my-app mobile-responsive without changing
desktop behavior." No separate kickoff doc — this file is self-contained. An assessment pass was
run this session (read-only, no code written) to scope the work before any implementation; its
findings are recorded below so a future session can start MOBILE-1 directly without re-auditing
the codebase.

**How to resume:** tell Claude "run MOBILE-N" (or just "next mobile phase"). Read this whole file
first — the Locked decisions and Assessment findings sections below give a fresh session enough
context to start MOBILE-1/2/3 without re-exploring the codebase. MOBILE-4 onward should still do
a fresh look at the specific pages in scope, since other workstreams (Orders, Quotes, Inventory)
touch those files independently and may have moved since this doc was written.

---

## Locked decisions (read this before starting any phase)

- **Desktop must not change, at all.** Every change in this workstream is additive at `sm`/`md`
  and below using Tailwind's mobile-first prefixes — base (unprefixed) classes only change where
  they're demonstrably mobile-only today, and any existing `md:`/`lg:`+ class is left alone. This
  is Sinag's explicit constraint, not a default — treat any change that alters desktop layout,
  spacing, or behavior as a bug, even if it "looks like a minor improvement."
- **No implementation happened in the assessment session (2026-07-10).** Everything below MOBILE-0
  is scoped but not started. Do not treat any phase as done because it's described in detail here.
- **Prefer CSS breakpoints over JS viewport detection** where possible (matches the codebase's
  existing pattern — no `use-mobile`/`matchMedia` hook exists anywhere today, and introducing one
  risks SSR/CSR hydration-mismatch flicker). The one exception is the sidebar open/closed state in
  MOBILE-1, which already lives in client-side React state (`AppShell` is `"use client"`) — that's
  fine to extend, not a new pattern.
- **Breakpoint convention — confirmed by Sinag in MOBILE-0 (2026-07-10):** the sidebar
  drawer/off-canvas treatment applies below **`lg` (1024px)** — i.e. phones **and** tablets
  (including iPad portrait ~768px) get the hide/show drawer nav. Only `≥1024px` (real
  desktop/laptop widths) keeps today's persistent sidebar, completely unchanged. Chosen over the
  narrower `md`(768px) option specifically because this app's nav is deep (group > subgroup >
  item) and staff may access the BMS from a tablet, not just a phone. **Every `lg:` class in
  `app-shell.tsx` (MOBILE-1) is the practical enforcement of this decision** — build the drawer to
  activate `<1024px` and the persistent sidebar at `≥1024px`, matching Tailwind's existing `lg:`
  prefix (no custom breakpoint needed). Other phases (MOBILE-2/3/4) should default to the same
  `lg:` cutoff for any "is this mobile or desktop" class decision, for consistency, unless a
  specific page has a concrete reason to diverge (note it in that phase's log entry if so).
- **`AGENTS.md` applies:** this is a non-standard Next.js build (16.2.9) with its own docs under
  `node_modules/next/dist/docs/`. Already spot-checked `generate-viewport.md` this session — the
  standard `viewport` export API is unchanged in this build, so no custom breaking-change risk
  there. Still check the relevant doc before writing code in any phase that touches something
  version-sensitive (routing, middleware/`proxy.ts`, client/server component boundaries).

---

## Assessment findings (2026-07-10) — read before starting MOBILE-1/2/3

Stack: Next.js 16.2.9 (App Router), React 19, Tailwind v4. No `tailwind.config.js` breakpoint
overrides found (`design/theme/tailwind.config.additions.ts` is color/token-only) — default
Tailwind breakpoint scale applies.

**Scope size:** 73 `page.tsx` files under `app/`, 35 `*-table.tsx`/`*-list.tsx` client wrapper
files. Only 62 `sm:`/`md:`/`lg:`/`xl:` breakpoint-prefixed classes exist across 30 of those 73
page files today — coverage is thin and inconsistent. Newer modules (`item-form.tsx`,
`customer-detail.tsx`, `order-line-items.tsx`) already use `sm:grid-cols-*` responsibly — **use
these as the reference pattern**, don't invent a new convention.

**#1 blocker — [components/layout/app-shell.tsx](components/layout/app-shell.tsx):** the sidebar
(`<aside>`, line ~425) renders as a permanent flex child at every viewport width — `w-56` expanded
/ `w-14` collapsed, never hidden. There is no off-canvas/overlay pattern. The mobile hamburger
button (`flex md:hidden`, line ~569) toggles the *same* `collapsed` state used for the desktop
icon-only mode — so on a phone, tapping it only shrinks the sidebar to a 56px icon rail, it never
fully hides. On a 375px screen that permanently leaves ~319px for content. **Nothing else in this
plan matters until this is fixed** — it's the reason the app is currently unusable on a phone.
Also in this file: header user-info block already hides pieces at `sm:` (lines ~577, ~583), which
is a fine pattern to keep; breadcrumb bar (line ~598) has no overflow handling for deep paths on
narrow screens; `main` content padding is a flat `p-6` (line ~603) with no mobile reduction.

**[components/ui/data-table.tsx](components/ui/data-table.tsx):** already has `overflow-x-auto`
(line ~143) so it won't break page layout, but there's no card/stacked-row fallback — dense tables
(8+ columns, common in inventory/order lists) will still require heavy horizontal scrolling on a
phone. This one component is used by all 35 table/list wrapper files, so a fix here cascades
everywhere without touching individual pages.

**[components/ui/page-header.tsx](components/ui/page-header.tsx):** title+actions row
(`flex items-start justify-between gap-4`, no `flex-wrap`) — pages with 3+ header action buttons
(common on detail pages) will overflow horizontally on narrow screens.

**[components/ui/dialog.tsx](components/ui/dialog.tsx):** `DialogContent` is `w-full max-w-lg`
centered with a flat `p-6` (line ~36) and no small-screen height cap — tall forms opened in a
modal on a short phone viewport have no internal scroll handling.

**Grid audit:** 15 instances of `grid-cols-2` or higher with **no** `sm:`/`md:`/`lg:` responsive
variant found via `grep -rn "grid-cols-[2-9]"` excluding lines that already have a responsive
prefix. Not individually enumerated here — re-run that grep at the start of MOBILE-3, since other
workstreams touch these files independently and the list will drift.

**Line-item editors** (`order-line-items.tsx`, `quote-line-items.tsx`, and similar) already use
`sm:grid-cols-[2fr_1fr_1fr_auto]`-style responsive column templates — partially responsive-aware
already, but these are the most interaction-heavy UI in the app (multiple inputs per row) and
deserve dedicated manual testing in MOBILE-4 rather than a blind class sweep.

**Low priority, not blocking:** buttons default to `h-8`/`h-9` (32/36px, see
`components/ui/button.tsx`), below the ~44px touch-target guideline. Legitimate density tradeoff
for a B2B admin UI — only revisit if real usage surfaces mis-taps, not proactively.

---

## Status

| Phase | Description | Status | Notes |
|---|---|---|---|
| MOBILE-0 | Confirm breakpoint convention + viewport meta live-check | ✅ Done 2026-07-10 | Drawer breakpoint = `lg` (1024px); viewport meta confirmed live |
| MOBILE-1 | App shell & navigation — off-canvas sidebar drawer, header, breadcrumb, content padding | ✅ Done 2026-07-10 | Off-canvas drawer below `lg`, verified at 375/768/1280px + desktop regression check |
| MOBILE-2 | Shared primitives — `DataTable`, `PageHeader`, `Dialog` | ✅ Done 2026-07-10 | Card/stacked-row fallback for tables, header wrap, dialog scroll cap — all at `lg` cutoff |
| MOBILE-3 | Form & grid audit — the fixed `grid-cols-N` sweep + create/edit screens | ✅ Done 2026-07-10 | 15 bare `grid-cols-2`/`3` divs fixed with `grid-cols-1 sm:grid-cols-N`; found bracket-template grids (`grid-cols-[2fr_1fr_...]`) in detail pages, deferred to MOBILE-4 |
| MOBILE-4 | Complex detail & line-item pages (order/quote/PO/customer/production detail, line-item editors) | ✅ Done 2026-07-10 | Card fallback for 4 read-only line-item grids; found + fixed a real `PageHeader` wrap bug (`shrink-0`) during manual testing |
| MOBILE-5 | Auth pages (login, forgot-password, update-password) | ✅ Done 2026-07-10 | Confirmed already mobile-safe by construction, zero code changes |
| MOBILE-6 | QA sweep — cross-module verification + desktop regression check | ✅ Done 2026-07-10 | Found + fixed 2 more real bugs (dashboard activity feed, `StatCard` label truncation) not caught by the earlier static audits |

## Session log

*(Claude Code: append a dated entry here after each session — what was done, what was decided,
anything left open.)*

### 2026-07-10 — MOBILE-6

Walked one representative page per sidebar module not yet visually covered by MOBILE-1..5, at
375×812, 768×1024, and 1280×800, checking console errors and page-level horizontal overflow at
each: Dashboard home, Management/Items (list + the "Add Item" create form — the app's most complex
form), Inventory/Monitoring, Inventory/Purchase Orders (list + "New Purchase Order"), Finance/
Profit & Loss, Accounting/Balance Sheet + a Journal Entry detail page, Analytics/Sales Report,
Administration/Users, Administration/Roles, Administration/Activity Logs. Re-tested the off-canvas
drawer at 768px tablet width as part of this pass too (still correct).

**Two more real bugs found and fixed, neither caught by the earlier static `grep`-based audits
because both only manifest at runtime with real data/content, not from reading the JSX in
isolation:**

1. **[app/dashboard/page.tsx:249](app/dashboard/page.tsx:249) — Recent Activity feed.** Each `<li>` was `flex items-center justify-between` with no wrap-awareness. Once a description string is long enough to wrap to 2+ lines on a narrow screen (e.g. "Production Order SPR26-0709-0034 created from order SOD26-0709-0026 — qty 15"), `items-center` centers the badge+timestamp block against the *whole wrapped block's* height, so it visually floats mid-paragraph instead of sitting next to the first line — reads as broken/disconnected. Fixed with `items-start ... lg:items-center` (`gap-4` added to replace the redundant `ml-4` on the badge block) — below `lg` the meta block aligns to the top of the entry; at `lg:` and up the original center-alignment is restored exactly (verified no visible difference at 1280px, since real activity descriptions are short enough to stay single-line at that width anyway).

2. **[components/business/stat-card.tsx:35](components/business/stat-card.tsx:35) — `StatCard` label truncation.** The label `<p>` had an unconditional `truncate`, and the optional icon slot is a fixed 40×40px block that doesn't shrink. Only 3 pages pass an `icon` (Users, Roles, Activity Logs, all in Administration), and only Activity Logs' "Total Events" (the longest of the three icon-paired labels) actually hit the crowding at 375px in a 2-column stat grid, truncating to "Total Eve…". Fixed by changing to `sm:truncate` (i.e. no truncation below the `sm` breakpoint, restored at `sm:` and up) — the label now wraps to 2 lines on the narrowest phones instead of clipping mid-word. Verified Users and Roles (same icon + 2-col-grid shape) still render correctly post-fix, and confirmed desktop (1280px) is pixel-identical to before (all current labels are short enough to stay single-line there regardless).

**Confirmed acceptable as-is, not fixed:** [accounting/journal/[id]/page.tsx:101](app/dashboard/accounting/journal/[id]/page.tsx:101) — the Journal Entry "Lines" ledger is a one-off plain `<table>` (not the shared `DataTable`), already wrapped in its own `overflow-x-auto` div. At 375px it scrolls horizontally within its own card instead of breaking page layout (`document.documentElement.scrollWidth` confirmed still 375, no page-level overflow) — same contained-scroll tradeoff the assessment originally accepted for `DataTable` before MOBILE-2's card fallback. Didn't build a bespoke card fallback for this single low-traffic Accounting display page — disproportionate effort for a paused module ([[project_accounting_module_paused]]), and a debit/credit ledger scrolling horizontally is a normal, expected pattern in financial software.

**Verified in browser preview** (Claude Code test account, real data throughout): all pages listed
above at 375/768/1280px, no console errors on any page, `tsc --noEmit` clean after all fixes.

This closes out the full MOBILE-0 through MOBILE-6 plan. Total real bugs found across the whole
workstream that a pure static-analysis pass would have missed: the MOBILE-1 sidebar drawer
(planned, not a "found" bug), the MOBILE-4 `PageHeader` `shrink-0` wrap failure, and these two
MOBILE-6 findings — all three of the *found* bugs turned up only when actually clicking through the
app at real widths, not from reading class names. Worth remembering for any future mobile/responsive
work in this codebase: static grep sweeps catch the "obviously missing a breakpoint" cases, but
shared-component interaction bugs (flex-shrink fighting flex-wrap, text-wrap changing block height
and breaking sibling alignment) need actual runtime verification to surface.

---

### 2026-07-10 — MOBILE-5

Reviewed all three auth pages: [login/page.tsx](app/login/page.tsx), [forgot-password/page.tsx](app/forgot-password/page.tsx), [auth/update-password/page.tsx](app/auth/update-password/page.tsx). All three already use the same pattern — a `flex min-h-screen items-center justify-center ... px-4` outer wrapper around a `w-full max-w-sm` card, single-column stacked fields, no fixed pixel widths or multi-column grids anywhere. This is inherently mobile-safe by construction (matches the assessment's "expected low-risk" prediction) — **zero code changes made**.

**Verified in browser preview** at 375×812 and 768×1024: signed out to reach `/login` (screenshots
confirmed centered card, no overflow, "Forgot password?" link stays inline), `/forgot-password`
(same layout, clean), `/auth/update-password` (tested the "invalid/expired link" state, since a
real recovery-token session wasn't available in this session — the password-entry form beneath it
uses the identical single-column field pattern already proven on the other two pages, so didn't
chase a token for a structurally-identical form). No console errors either width.

**Aside, not a code issue:** the update-password screenshot at 768px showed what looked like a
narrow mis-tinted strip along the right edge. Checked `getBoundingClientRect()`/computed styles on
`html`, `body`, and the page's own wrapper div — all reported exactly 768px wide with no
`scrollWidth` overflow and the correct background color filling the full width. Treating this as a
screenshot-capture rendering artifact (DOM/computed-style evidence is authoritative over the
screenshot pixels here), not a real layout bug — noting it in case it resurfaces.

Next step: MOBILE-6 (final QA sweep — walk one representative page per sidebar module at
phone/tablet widths, plus a full desktop regression pass across everything touched in MOBILE-1
through MOBILE-5).

---

### 2026-07-10 — MOBILE-4

Fixed the bracket-template grids flagged as out-of-scope at the end of MOBILE-3 — all read-only
"Line Items"/"Components" summary displays on order/production detail pages that had zero
responsive variant on a fixed multi-column template (`grid-cols-[2fr_1fr_1fr_1fr_1fr]` etc.):
[order-detail.tsx:224](app/dashboard/orders/active-orders/[orderNumber]/order-detail.tsx:224) (5 cols, includes an editable Reserved-qty `NumberInput` when `canOverrideReservedQty`), [confirmed-order-detail.tsx:182](app/dashboard/orders/confirmed/[orderNumber]/confirmed-order-detail.tsx:182) (4 cols, same editable field), [on-hold-order-detail.tsx:145](app/dashboard/orders/on-hold/[orderNumber]/on-hold-order-detail.tsx:145) (5 cols, read-only Reserved), and [production-order-detail.tsx:214](app/dashboard/orders/production/[productionOrderNumber]/production-order-detail.tsx:214) (Components sub-table, 3 cols, fully read-only).

**Pattern used (matches MOBILE-2's `DataTable` card-fallback convention exactly):** each row is
now two sibling blocks sharing one `key`-ed wrapper — `hidden lg:grid lg:grid-cols-[...]` (the
original grid, byte-for-byte unchanged content, just wrapped) and a new `lg:hidden` block that
stacks the same fields as inline-labeled `flex justify-between` rows (Ordered/Reserved/Completed/
Line Total each get their own labeled row instead of being unreadable bare numbers in a 5-up
mobile grid). The one editable field (`NumberInput` for Reserved qty override) is duplicated
between both blocks bound to the same state — CSS-only visibility toggle, not two independent
inputs — same double-render approach `DataTable`'s card mode already uses for row actions, so this
isn't a new pattern for the codebase.

Also fixed the two form-input grids in [order-shipments.tsx:559,578](app/dashboard/orders/active-orders/[orderNumber]/order-shipments.tsx:559) (shippable-item qty row, packaging-material row) with the simpler `grid-cols-1 sm:grid-cols-[...] sm:items-end` stacking — these already have contextual labels (item name inline, or their own field labels), so no card treatment was needed, just the same stacking convention as `order-line-items.tsx`.

**Left alone, confirmed fine as-is:** `receive-form.tsx:61`'s `grid-cols-[1fr_auto]` (label absorbs remaining width, no overflow risk at any size); `production-order-detail.tsx:61`'s `InfoRow` `grid-cols-[140px_1fr]` (short labels, 140px never crowds out the value column even at 375px); `quote-detail.tsx`'s Line Items block (already a `flex justify-between` per row, not a rigid grid, so inherently responsive); `po-detail.tsx`'s line items (already uses the shared `DataTable`, which got its own card fallback in MOBILE-2).

**Bug found and fixed during manual testing, not part of the original audit:** [page-header.tsx:23](components/ui/page-header.tsx:23) — the actions wrapper had `shrink-0` applied unconditionally. A `flex-shrink: 0` flex item pins to its unwrapped max-content width and never shrinks, so its own `flex-wrap` never actually gets triggered — any page with 3 buttons whose combined width exceeds the viewport (e.g. Production Order Detail's "Start Production" / "Mark as Complete" / "Cancel Order") overflowed off the right edge at 375px instead of wrapping, even though MOBILE-2 believed this was already handled. Confirmed via `getBoundingClientRect()` that the button was rendered ~57px past the 375px viewport edge with no page-level scroll (i.e. actually clipped, not just off-canvas-scrollable). Fixed by changing to `w-full flex-wrap ... lg:w-auto lg:shrink-0 lg:flex-nowrap` — below `lg` the actions row now claims the full width to wrap its buttons within; at `lg:` and up, `shrink-0`+`flex-nowrap` are restored exactly as before (confirmed pixel-identical at 1280px). This is a shared component, so this fix applies to every page using `PageHeader` actions, not just Production Order Detail — worth remembering that MOBILE-2's "verified" note for this file was based on a button set that happened to fit by coincidence, not on an actual wrap-trigger test.

**Verified in browser preview** (Claude Code test account, real data — `SOD26-0709-0026` active
order, `SPR26-0709-0034` production order, `SOD26-0708-0022` shipment form): 375×812/900 (all four
card-fallback grids read cleanly with labels; PageHeader action buttons wrap onto their own lines
and fit within viewport with zero clipping), 768×1024 (production order detail: 3 buttons fit one
row within the full-width action area, Components card renders correctly), 1280×800/900 (all four
grids and the PageHeader actions row are byte-for-byte the same layout as before this session's
changes — confirmed via screenshot comparison, not just class inspection). `tsc --noEmit` clean, no
console errors.

Next step: MOBILE-5 (auth pages — login, forgot-password, update-password). Expected low-risk per
the original scoping, but give it an explicit pass rather than assuming.

---

### 2026-07-10 — MOBILE-3

Re-ran the `grep -rn "grid-cols-[2-9]"` sweep from the assessment (excluding lines that already
carry a responsive prefix) across `app/`. Found 15 bare offenders — same count as the assessment
estimated, though the exact file list had drifted since other workstreams touched some of these
files in between: [manual-incoming-form.tsx:127](app/dashboard/inventory/receiving/manual-incoming-form.tsx:127), [po-detail.tsx:271](app/dashboard/inventory/purchase-orders/[reference]/po-detail.tsx:271), [item-form.tsx:85](app/dashboard/inventory/purchase-orders/[reference]/item-form.tsx:85) (PO line-item add dialog), three spots in [order-shipments.tsx](app/dashboard/orders/active-orders/[orderNumber]/order-shipments.tsx:486) (receiver name/phone, barangay/city/province, shipping cost/fee), [new-order-form.tsx:94](app/dashboard/orders/active-orders/new/new-order-form.tsx:94), [edit-quote-form.tsx:94](app/dashboard/orders/quotation/[quoteNumber]/edit/edit-quote-form.tsx:94), [new-quote-form.tsx:92](app/dashboard/orders/quotation/new/new-quote-form.tsx:92), [supplier-form.tsx:72](app/dashboard/management/suppliers/supplier-form.tsx:72), two spots in [customer-form.tsx](app/dashboard/management/customers/customer-form.tsx:84) (phone/email, barangay/city/province), [store-form.tsx:60](app/dashboard/management/stores/store-form.tsx:60), [category-form.tsx:83](app/dashboard/management/item-categories/category-form.tsx:83), and [journal/[id]/page.tsx:80](app/dashboard/accounting/journal/[id]/page.tsx:80) (Accounting — UI-only class change, no schema/logic touched, so left alone by the [[project_accounting_module_paused]] freeze).

Fix pattern (matches the existing `item-form.tsx` reference convention): bare `grid-cols-2` →
`grid-cols-1 sm:grid-cols-2`, bare `grid-cols-3` → `grid-cols-1 sm:grid-cols-3`. Every field
already stacked correctly in DOM order (label above input) so no reordering was needed, just the
column-count fix.

**New finding, out of this phase's grep pattern:** a second grep for `grid-cols-\[` (bracket
template columns like `grid-cols-[2fr_1fr_1fr]`) turned up several *detail* pages with hardcoded
multi-column templates and zero responsive variant: [on-hold-order-detail.tsx:145,155](app/dashboard/orders/on-hold/[orderNumber]/on-hold-order-detail.tsx:145) (5 cols), [confirmed-order-detail.tsx:182,191](app/dashboard/orders/confirmed/[orderNumber]/confirmed-order-detail.tsx:182) (4 cols), [order-detail.tsx:224,234](app/dashboard/orders/active-orders/[orderNumber]/order-detail.tsx:224) (5 cols), [production-order-detail.tsx:214,222](app/dashboard/orders/production/[productionOrderNumber]/production-order-detail.tsx:214) (3 cols), and [order-shipments.tsx:559,578](app/dashboard/orders/active-orders/[orderNumber]/order-shipments.tsx:559) (2-3 cols). These are exactly the "line-item editors" MOBILE-4 is scoped for, so left untouched here — noting them now so MOBILE-4 doesn't have to rediscover them via its own audit. (Checked `receive-form.tsx:61`'s `grid-cols-[1fr_auto]` too — that one's fine as-is at any width since `1fr` absorbs the space and `auto` is a fixed 128px input, no fix needed.)

**Verified in browser preview** (Claude Code test account; had to stop another chat session's dev
server on PID 16764 first — Next.js only allows one instance per directory, confirmed with Sinag
before killing it): supplier-create dialog and customer-create dialog at 375×812 (Phone/Email and
Barangay/City/Province each stack to one column, full width) and 1280×800 (byte-for-byte same
side-by-side layout as before — desktop regression check passed). `tsc --noEmit` clean.

Next step: MOBILE-4 (complex detail & line-item pages) — start with the bracket-template grids
found above, then the line-item editors (`order-line-items.tsx`, `quote-line-items.tsx` already
have `sm:` variants per the assessment, so focus manual testing there rather than class edits).

---

### 2026-07-10 — MOBILE-2

Fixed the three shared-primitive gaps identified in the assessment, all cascading to every page that uses them.

**[components/ui/data-table.tsx](components/ui/data-table.tsx):** added a stacked-row/card fallback below `lg` — the existing `<table>` is now wrapped in `hidden lg:block`, and a new sibling block (`lg:hidden`) renders each row as a card instead: the first column becomes the card's title (no label), remaining columns with a non-empty `header` render as label/value rows (label left, value right, `items-start` so multi-line values like the sync-error text don't clip), and any column with an empty `header` (the `id`/actions column convention already used by every `*-table.tsx` wrapper, e.g. [items-table.tsx:203-226](app/dashboard/management/items/items-table.tsx:203)) renders bottom-right below a divider, matching how it reads in the desktop table. `col.className` (mostly `max-w-xs truncate` / `min-w-[…]` table-cell sizing) is intentionally **not** applied in card mode — those are table-cell concerns that would wrongly truncate values when the card has the full row width to itself. Loading skeletons and the empty state got mobile equivalents too; extracted the empty-state markup into a local `EmptyState` component shared by both the table and card paths instead of duplicating the SVG. Search bar and pagination footer are unchanged/shared — already worked fine at all widths.

**[components/ui/page-header.tsx](components/ui/page-header.tsx):** title/description row and the actions row both got `flex-wrap` + `lg:flex-nowrap`, so a title plus 3+ action buttons wraps onto its own line below `lg` instead of overflowing horizontally, with zero change at `lg:` and up (verified — desktop stays single-row).

**[components/ui/dialog.tsx](components/ui/dialog.tsx):** `DialogContent` now caps at `max-h-[85vh] overflow-y-auto` below `lg`, reverting to `lg:max-h-none lg:overflow-visible` (i.e. today's uncapped behavior) at `lg:` and up. Tall forms (tested with the 8-field customer-create dialog) now scroll internally on a short phone viewport instead of overflowing top/bottom off-screen; desktop dialogs are byte-for-byte unchanged (confirmed `overflow-y: visible`, `max-height: none` computed at 1280px).

**Verified in browser preview** (Claude Code test account): 375×812/700 (item list cards, active-orders cards with filters/date-pickers, customer-create dialog internal scroll + reaching Save/Cancel), 768×1024 (cards still apply, per the locked `lg` cutoff — no attempt made to fit tables at tablet width since horizontal scroll there was already acceptable per the assessment, but stacking is strictly better and free at no extra cost since the component doesn't special-case `md`), 1280×800 (table view returns, pagination/header/dialog all pixel-identical to pre-change — spot-checked via computed styles, not just eyeballing). No console errors. `tsc --noEmit` clean.

**Aside, unrelated to this phase's changes:** hit a transient dev-server issue mid-session where every nested `/dashboard/**` route 404'd (both authenticated and not) while `/dashboard` itself worked — root-level `app-paths-manifest.json` had the routes registered but the running process wasn't serving them. A plain stop/restart of the dev server resolved it immediately and it didn't recur. Noting it here only in case it resurfaces in a future session — not a code bug, nothing was changed to fix it.

**Left alone / out of scope for this phase:** the fixed `grid-cols-N` sweep (MOBILE-3) and dense line-item editors (MOBILE-4) still need their own passes.

Next step: MOBILE-3 (form & grid audit — re-run the `grid-cols-[2-9]` grep first, since other workstreams have likely touched these files since the assessment).

---

### 2026-07-10 — Assessment (no code)

Read-only audit of the codebase's current responsive posture, at Sinag's request, before any
implementation. No files were changed. Findings written up above and presented to Sinag as a
per-phase plan; this file was created afterward, at Sinag's request, so the plan can be resumed
from a fresh session via `MOBILE-N` phase codes instead of re-deriving it from conversation
history. Next step: MOBILE-0, whenever Sinag starts the next session on this workstream.

---

### 2026-07-10 — MOBILE-1

Built the off-canvas sidebar drawer in [components/layout/app-shell.tsx](components/layout/app-shell.tsx), the blocking fix identified in the assessment.

**What changed:**
- New `mobileOpen` state (separate from the existing desktop `collapsed` icon-rail state). The hamburger button (`lg:hidden`, was `md:hidden`) now toggles `mobileOpen` instead of `collapsed`.
- `<aside>` is `fixed` + `-translate-x-full` (off-canvas) below `lg`, `translate-x-0` when `mobileOpen`; reverts to the original `static` in-flow sidebar at `lg:` via `lg:static lg:translate-x-0`. Width is a fixed `w-64` on mobile (always full nav, never the icon rail) and keeps the original `lg:w-14`/`lg:w-56` collapsed-driven width at desktop.
- Added a click-to-dismiss backdrop (`fixed inset-0 z-30 bg-black/50 lg:hidden`), auto-close on route change, Escape-key dismiss, and body-scroll lock while open.
- **Correctness fix worth flagging for future phases:** the sidebar's desktop `collapsed` (icon-only rail) state is plain React state, so it persists independent of viewport width — if a user collapses the sidebar on desktop then later opens the mobile drawer, the drawer must NOT render icon-only (it's always full-width on mobile). Fixed by deriving `effectiveCollapsed = collapsed && !mobileOpen` and using that (not raw `collapsed`) for every JS-conditional in the nav tree that decides whether to render labels/chevrons/badges vs. icon-only. The `lg:`-prefixed width/position classes still key off raw `collapsed` since those only ever apply at `≥1024px`, where `mobileOpen` is always false anyway. This pattern (a derived boolean combining two pieces of existing client state, no `matchMedia`) is the template if a later phase needs similar mobile/desktop-state disambiguation.
- Desktop-only collapse-toggle button at the bottom of the sidebar is now `hidden` below `lg` (it drove a state that had no visible effect on the mobile drawer anyway).
- Breadcrumb bar: `px-6` → `px-4 lg:px-6`, added `overflow-x-auto` so deep paths scroll horizontally instead of breaking layout (the parent's `overflow-x-auto` + child `nav`'s default `min-width:auto` means it scrolls rather than squishes — verified, not just assumed).
- Main content: `p-6` → `p-4 lg:p-6`.

**Verified in browser preview** (logged in as the Claude Code test account): 375px (drawer opens/closes via hamburger, backdrop click, and route navigation; nested group/subgroup expand-collapse works; labels render even after toggling `collapsed` from a prior desktop session), 768px tablet (drawer treatment applies here too, per the locked `lg` cutoff — no header crowding between the hamburger and the "Sinag Ukit BMS" title), 1280px desktop (persistent sidebar, icon-rail collapse toggle, byte-for-byte the same layout as before this change). No console errors, no page-level horizontal scroll on mobile, `tsc --noEmit` clean.

**Left alone / out of scope for this phase:** `DataTable` still has no card/stacked fallback (tables scroll horizontally inside their own container on mobile — that's MOBILE-2). The "Sinag Ukit BMS" header title block's `hidden md:block` was left as-is (not flagged as broken in the assessment; still looked fine at 768px in testing).

Next step: MOBILE-2 (shared primitives — `DataTable`, `PageHeader`, `Dialog`).

---

### 2026-07-10 — MOBILE-0

**Viewport meta tag — confirmed live, no action needed.** Fetched the rendered HTML from the
already-running dev server (`curl http://localhost:3000/login`, another session's server per this
project's documented one-dev-server-per-directory constraint — did not start or touch it beyond a
GET request) and confirmed `<meta name="viewport" content="width=device-width, initial-scale=1"/>`
is present in `<head>`. This is Next.js's own default injection (no explicit `viewport` export
exists in `app/layout.tsx`, and none is needed) — matches the `generate-viewport.md` doc check
from the assessment session. Nothing to fix here.

**Sidebar drawer breakpoint — asked Sinag directly (`md`/768px vs `lg`/1024px), confirmed
`lg`(1024px).** Recorded in Locked decisions above. Sinag's reasoning: staff may access the BMS
from a tablet, and this app's nav is deep enough (group > subgroup > item, see `app-shell.tsx`)
that a squeezed 768px sidebar-plus-content layout was judged not worth keeping the persistent
sidebar for — tablets get the same drawer treatment as phones. Only real desktop/laptop widths
(`≥1024px`) keep the current behavior.

No files were changed this phase — MOBILE-0 was decisions + verification only, per its scope. Next
step: MOBILE-1 (App shell & navigation), which is the blocking phase — build the off-canvas drawer
in `components/layout/app-shell.tsx` using the `lg:` cutoff locked in here.
