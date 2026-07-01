## Phase 17 — Dashboard: Wire to Real Data

### Preflight (do first, before any code)
Follow the Preflight section in the `bms-supabase` skill. Confirm the
dashboard page is still on mock data (grep for hardcoded arrays in
`app/dashboard/page.tsx`), and confirm `activity_logs` has real rows
(it should, since Phase 14 follow-up started writing `quote_edited`
entries).

### Objective
Replace the Phase 5 mock dashboard with live Supabase queries.

### Scope
- 4 KPI cards: today's sales, monthly revenue, pending orders count,
  inventory value
- Low Stock list
- Recent Activity feed, sourced from `activity_logs`
- Quick Actions stays as static links (no change needed)

### Requirements
- Follow SKILL.md
- Follow ARCHITECTURE.md
- Follow BUSINESS_RULES.md
- Follow DECISIONS.md

### Do Not
- Add new tables or migrations — this should be pure read queries
  against existing tables
- Touch inventory RPC logic
- Refactor unrelated modules

### Deliverables
- All 4 KPI cards wired to real data
- Low Stock list wired
- Recent Activity feed wired to `activity_logs`

### Verification
- npm run build
- Browser tested
- Update PROGRESS.md
- Update MODULE_STATUS.md (flip Dashboard to 🟩)
