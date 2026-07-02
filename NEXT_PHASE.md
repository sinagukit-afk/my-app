## Phase 20 — Finance: Income & Expenses (manual entry)

### Preflight (do first, before any code)
Follow the Preflight section in the `bms-supabase` skill. Run
`list_tables` to confirm `income`/`expenses` tables don't already
exist, and confirm the Finance routes are still stubs.

### Objective
Add manual income/expense tracking as the foundation for Phase 21's
reports.

### Scope
- New additive migration: `income` and `expenses` tables (`date`,
  `category`, `amount`, `note`, `created_by`, soft-delete column)
- Basic CRUD screens for both

### Requirements
- Follow SKILL.md
- Follow ARCHITECTURE.md
- Follow BUSINESS_RULES.md
- Follow DECISIONS.md

### Access note (deviates from the general convention — confirm with
the user before building if you disagree)
Financial records are more sensitive than typical operational data.
Unlike the standard "SELECT = any authenticated" convention, scope
both tables to **admin/manager only** for SELECT, INSERT, UPDATE, and
soft-delete. Encoder and other roles should not see Finance data at
all — gate the sidebar links too, not just the RLS.

### Do Not
- Build the Cash Flow / P&L reports yet — that's Phase 21
- Touch `orders`, `inventory_levels`, or any existing schema
- Make these tables readable by encoder/cashier/viewer roles

### Deliverables
- Migration for `income` + `expenses` tables (additive, RLS applied)
- Income CRUD screen
- Expenses CRUD screen

### Verification
- npm run build
- Browser tested as both admin and a non-finance role (confirm the
  latter is blocked)
- Update PROGRESS.md
- Update MODULE_STATUS.md (flip Finance > Income, Expenses to 🟩)
- Update DECISIONS.md with the admin/manager-only access scoping
