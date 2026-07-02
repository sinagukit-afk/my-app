## Phase 19 — Account: Profile Screen

### Preflight (do first, before any code)
Follow the Preflight section in the `bms-supabase` skill. Confirm
`app/dashboard/account/profile` is still a stub, and confirm the
`profiles` table's columns (`full_name`, `role`, etc.) haven't
changed since Phase 10.

### Objective
Self-service profile page for the logged-in user.

### Scope
- View own name, email, role (read-only for role)
- Edit own `full_name`
- Link to Supabase Auth's password-change/reset flow

### Requirements
- Follow SKILL.md
- Follow ARCHITECTURE.md
- Follow BUSINESS_RULES.md
- Follow DECISIONS.md

### Do Not
- Allow editing your own `role` — that's a privilege-escalation risk;
  role changes only happen through the Administration Users screen
  (Phase 16), admin-only
- Touch the Administration module
- Add password-entry fields directly — use Supabase Auth's own
  reset/change mechanism, don't handle raw passwords in app code

### Deliverables
- Profile page showing name/email/role
- Edit-name action
- Password change link

### Verification
- npm run build
- Browser tested
- Update PROGRESS.md
- Update MODULE_STATUS.md (flip Account > Profile to 🟩)
