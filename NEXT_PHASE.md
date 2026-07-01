# Next Phase

## Preflight (do first, before any code)

Follow the Preflight section in the `bms-supabase` skill: confirm via `list_tables`/`list_migrations` that `profiles`/`activity_logs` still match what's described below, and grep/open the actual Users/Roles/Activity Logs routes to confirm they're still literal stubs before building. Flag anything that doesn't match before proceeding.

## Objective

Complete the Administration module.

## Scope

-   Users — manage user accounts and assign roles
-   Roles — read-only role/permission reference (not a new roles system)
-   Activity Logs — viewer for the existing activity_logs table

## Scope Clarification (Role Model)

`user_role` stays a fixed Postgres enum, hardcoded into ~25 RLS
policies and 2+ RPCs (see the `bms-supabase` skill). This phase does
**not** introduce a roles/permissions table or any dynamic RBAC
system.

-   **Users screen**: list Supabase Auth users + their `profiles`
    row; invite a new user via the Auth admin API (server-side only
    — service-role key never reaches the client; same mechanism
    used for the Phase 12 Claude Code test account); edit
    `full_name`; assign one of the existing enum role values via a
    dropdown; deactivate/reactivate (soft-delete convention).
    **Role changes are admin-only**, regardless of the general
    admin/manager/encoder INSERT/UPDATE convention used elsewhere —
    granting access is more sensitive than an ordinary record edit.
-   **Roles screen**: read-only reference page listing the current
    enum values and what each can actually do, sourced from the
    real RLS policies (SELECT = any authenticated; INSERT/UPDATE =
    admin/manager/encoder; DELETE = admin/manager; plus documented
    per-table exceptions, e.g. Start/Complete Production being
    admin-only). No create/edit/delete of roles themselves.
-   **Permission UI** = the same capability matrix as the Roles
    screen, still read-only. Do not build an editable permissions
    system.
-   **Activity Logs viewer**: read-only, over the existing
    `activity_logs` table — it already has real rows from the
    Phase 14 follow-up's quote-edit snapshots (`action:
    'quote_edited'`, `metadata: { previous_order, previous_items
    }`). Build the viewer around that existing shape (filter by
    action/actor/date, expand a row to show the metadata diff)
    rather than designing a new schema.

## Requirements

-   Follow SKILL.md
-   Follow ARCHITECTURE.md
-   Follow BUSINESS_RULES.md
-   Follow DECISIONS.md

## Do Not

-   Modify inventory logic
-   Refactor unrelated modules
-   Change schema unless required
-   Add a new `user_role` enum value or a dynamic roles/permissions
    table — see Scope Clarification above
-   Expose the service-role key to client code

## Deliverables

-   Users CRUD (invite, edit, assign role, deactivate)
-   Roles reference screen (read-only)
-   Activity Logs Viewer
-   Permission UI (read-only capability matrix)

## Verification

-   npm run build
-   Browser tested
-   Update PROGRESS.md
-   Update MODULE_STATUS.md
-   Update DECISIONS.md if needed
