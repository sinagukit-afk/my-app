---
name: erp-app
description: Conventions for building/editing Sinag Ukit ERP frontend pages (Next.js 16 App Router, React 19, Tailwind v4). Use when adding or modifying dashboard screens, forms, tables, or server actions in D:\my-app.
---

# ERP App Conventions

Read `node_modules/next/dist/docs/` for this Next.js version's breaking changes before writing App Router code — this is NOT the Next.js you already know (per AGENTS.md).

## Screen structure (the established CRUD pattern)

Every wired module screen (Suppliers, Stock Movement, Purchase Orders, Quotes, etc.) follows the same file split — copy this shape for new screens:

- `page.tsx` — server component. Fetches data + the current user's `profiles.role`, passes plain serializable props down. Never builds `DataTable` columns here (functions can't cross the server/client boundary — this broke once in Phase 13's `receiving/page.tsx`).
- `<feature>-table.tsx` — client component wrapping the shared `DataTable<T>` (`components/ui/data-table.tsx`). Owns column definitions, row actions, search/sort/filter UI.
- `actions.ts` — `'use server'` functions (create/update/delete/status-transition). Thin wrappers: call Supabase, `revalidatePath`, return `{ error }` on failure instead of throwing where the UI needs to show a friendly message (e.g. FK-violation → "Deactivate it instead").
- `<feature>-form.tsx` — client form, usually inside a `Dialog` (add/edit) or its own `new/`/`[reference]/edit/` route for multi-line-item forms (POs, Quotes).

Multi-line-item creation (POs, Quotes) uses a **single-step page**, not a header-dialog + separate add-item flow: dynamic add/remove rows, item picker, live subtotal preview, one server action that inserts the header + all items together. This replaced an earlier two-step design per user feedback (Phase 13 follow-up) — prefer single-step for any new "create with line items" screen.

## Role gating in the UI

Mirror RLS exactly — don't invent new gating logic. Convention: SELECT = any authenticated user; INSERT/UPDATE = admin/manager/encoder; DELETE = admin/manager only. Some screens are tighter (e.g. Production Orders' "Complete Production Order" is admin-only, matching the retired Production Queue's equally admin-only "Mark Completed" it replaced — see `PROGRESS-PRODUCTION-SHIPPING.md` PS-3). **Finance and Accounting screens are a whole-category exception, not a one-off:** every table under Finance (`income`, `expenses`) and Accounting (`accounts`, `journal_entries`, `journal_entry_lines`, `fixed_assets`, `depreciation_entries`) is admin+manager only end-to-end — encoder gets none of SELECT/INSERT/UPDATE, unlike the general convention above. Gate at three layers, matching the Finance precedent (D016): the RLS policy itself, the sidebar `NavGroup.roles` filter in `AppShell`, and a page-level `hasAccess` check. When adding a gated action, check the actual RLS policy on the table first, don't assume the general convention applies.

## Tailwind v4 gotcha

This project is on Tailwind v4.3.1. CSS-variable arbitrary values need **parentheses**, not brackets: `bg-(--color-surface)`, not `bg-[--color-surface]`. The bracket form silently produces no CSS rule (transparent surfaces, invisible modals) — this was a real app-wide bug fixed in Phase 11. Always use the parenthesis form for any `--color-*` / `--shadow-*` token reference.

## Supabase typed-query gotchas (client-side/page code)

- Build `.select("...")` strings as a single string literal, not via `string + string` concatenation — concatenation degrades the whole result type to `GenericStringError`.
- One-to-one embedded relations (e.g. `items(name)` off a variant row) still type as `T | T[]`. Normalize with a small `firstOf<T>()` helper before reading nested fields.

## Browser-preview testing gotcha

Never target `button[type=submit]` generically with `preview_click`/`preview_eval`. `AppShell` (`components/layout/app-shell.tsx`) renders a Sign Out `<button type="submit">` in the header, before `<main>`, so a generic selector matches Sign Out first and silently logs out the session. Target the exact button text, or the `data-testid="sign-out-button"` attribute to exclude it. See the Claude Code test account credentials in memory (`claude-code@sinagukit.internal`, role `admin`) for authenticated preview sessions.

## Delete actions are always soft deletes

No "Delete" button/server action should issue a real Supabase `DELETE`. It should update a soft-delete column (`deleted_at`, or an existing `is_active`-style flag) instead — see the `erp-supabase` skill for the schema-side convention. On the list/query side, don't rely solely on the UI to hide deleted rows: the underlying query (and ideally RLS) should already exclude them, so a soft-deleted row can never leak into a table, dropdown, or picker even if a new screen forgets to add the filter itself.

## Stock-affecting UI logic

Never write inventory math in a page/action directly. If a UI action changes stock (adjustment, receiving, order confirm/edit), it should call an existing or new Postgres RPC (see the `erp-supabase` skill) — client code should only call the RPC and handle its error/shortfall response, never compute the stock delta itself.
