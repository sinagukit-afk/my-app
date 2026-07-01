# Testing Standard

## Build

-   [ ] npm run build
-   [ ] No TypeScript errors
-   [ ] No console errors

## CRUD

-   [ ] Create
-   [ ] Read
-   [ ] Update
-   [ ] Delete
-   [ ] Validation

## Permissions

-   [ ] Admin
-   [ ] Manager
-   [ ] Encoder

## Inventory

-   [ ] Inventory updated
-   [ ] Movement logged
-   [ ] No negative stock

## Database

-   [ ] RLS verified
-   [ ] RPC verified

## Regression

-   [ ] Navigation
-   [ ] Login
-   [ ] Theme
-   [ ] Existing modules

## Known Gotchas (check every phase)

-   [ ] Tailwind v4: CSS-variable arbitrary values need parentheses
    — `bg-(--color-surface)`, not `bg-[--color-surface]`. The
    bracket form silently produces no CSS rule (this caused an
    app-wide invisible-modal bug).
-   [ ] `DataTable` columns (with `render` closures) must be defined
    in the client wrapper component, never built in the server
    component and passed down — Next.js rejects functions crossing
    the server/client boundary.
-   [ ] Never target `button[type=submit]` generically in browser
    tests — `AppShell`'s Sign Out button matches first and silently
    logs out the session. Target exact text or `data-testid`.
-   [ ] Build `.select("...")` strings as a single string literal,
    not via concatenation — concatenation degrades the result type
    to `GenericStringError`. One-to-one embedded relations still
    type as `T | T[]`; normalize with `firstOf<T>()`.
-   [ ] Any destructive SQL (deletes, drops, backfills on existing
    rows) — stop and ask the user first, even if it looks
    reversible. A same-session incident showed "reversible" is a
    judgment call that shouldn't be made unilaterally.
