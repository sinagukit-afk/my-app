# PROGRESS-ACCOUNTING.md

Tracking file for the Accounting Module workstream only. Kept separate from the
core BMS `PROGRESS.md` so phase numbers don't collide between the two build
threads. Full spec/instructions for each phase: see
`Accounting-Module-Phase1-5-ClaudeCode-Instructions.md`.

Migration files share one global sequence with core BMS migrations
(`0013_...` onward) — only the phase *labels* below are namespaced to this
workstream.

## Status

| Phase | Description | Status | Migration(s) | Notes |
|---|---|---|---|---|
| ACCT-1 | Chart of Accounts | Done | `0013_accounting_chart_of_accounts` | |
| ACCT-2 | Journal core (`journal_entries`, `post_journal_entry()`) | Done | `0014_accounting_journal_core` | |
| ACCT-3 | Manual entry UI + retire income/expenses | Done | `0015_accounting_rent_expense_account` | Rent Expense account (6015) added for the expenses mapping; consumed migration label `0015`, shifting ACCT-4..7 up by one (see note below) |
| ACCT-4 | Financial reports (trial balance, income statement, balance sheet) | Done | `0016_accounting_reports` | Runs before ACCT-5 — hence the lower migration number |
| ACCT-5 | Fixed assets & depreciation | Not started | `0017_accounting_fixed_assets` | |
| ACCT-6 | Historical import / opening balance | Ready | — (no plug account needed) | Both decisions confirmed by Sinag (2026-07-02): (1) ₱50,000 reclassified 3000→3010 Owner's Withdrawals; (2) ₱2,784.03 imbalance traced to GL row 01-Jan-25 acct 3020 "to close RE fy2024" — debit/credit swap closes it to ~₱0.003, rounds to ₱0.00. `0018_accounting_opening_balance_adjustment` migration and 3099 plug account are skipped. See Resolution section in the instructions doc. |
| ACCT-7 | Auto-posting from `confirm_order()` / PO receiving | Gated | `0019_accounting_order_posting` | Waiting on core BMS order/PO flow to stabilize — do not start until confirmed |

> **Migration renumber (2026-07-02, ACCT-3):** ACCT-3 wasn't originally assigned a migration, but the Rent/Transportation decision added account `6015 Rent Expense`, which needed one. Created during ACCT-3 (chronologically before ACCT-4..7, none of which exist yet), it correctly takes the next free label `0015` — so the reserved labels for ACCT-4 (`0015→0016`), ACCT-5 (`0016→0017`), ACCT-6 (`0017→0018`), and ACCT-7 (`0018→0019`) each shift up by one, preserving the "lower label = created earlier" invariant the earlier amendments established.
| ACCT-8 | BIR tax estimate calculator | Not started | — | Lowest priority, optional |

## Session log

*(Claude Code: append a dated entry here after each session — what was done, what was decided, anything left open.)*

### 2026-07-02 — ACCT-1

Applied migration `0013_accounting_chart_of_accounts` via Supabase MCP (`accounts` table, RLS: select admin+manager, insert/update admin-only, no delete policy per D003). Seeded all 95 accounts from the doc's corrected Chart of Accounts (including the `4014` Phone Stand fix and the 6 header-row exclusions).

Verified Definition of Done directly against the live DB:
- Category counts match exactly: 24 asset, 2 liability, 3 equity, 20 revenue, 46 expense (95 total)
- RLS confirmed via `SET LOCAL role authenticated` + `request.jwt.claims` impersonation (rolled back, no data changes): manager (`Maria Santos`) sees all 95 rows on select, insert is rejected by RLS; encoder (`Claude Code (Encoder Test)`) gets 0 rows on select
- `npm run build` passes (DB-only phase, no UI to build)

No open items. ACCT-2 (Journal Core) is next, per the doc's recommendation to run it with a higher-capability model given the correctness requirements.

---

### 2026-07-02 — ACCT-2

Applied migration `0014_accounting_journal_core` via Supabase MCP: tables `journal_entries` and `journal_entry_lines` (money columns `numeric(12,2)` per the module's deliberate deviation), four indexes, RLS **select-only** for admin+manager on both tables (no direct insert/update/delete — writes go exclusively through the RPC), and the `post_journal_entry(p_entry_date, p_description, p_lines jsonb, p_source_type, p_source_id)` `SECURITY DEFINER` RPC. Applied verbatim from the doc.

Verified Definition of Done directly against the live DB, all via `request.jwt.claims` role impersonation inside rolled-back transactions (no persisted test data — confirmed both tables back to 0 rows afterward):
- **Balanced entry** (Dr 1020 Bank 50,000 / Cr 3000 Owner's Capital 50,000) posts: 2 lines, debit=credit=50000.00, `line_order` [0,1], `created_by` = caller's uid, `source_type` = manual.
- **Unbalanced entry** rejected before any insert: `Entry does not balance: debits 50000 vs credits 49999`. No partial rows.
- **Invalid account** (9999) rejected before any insert: `Unknown or inactive account number(s): 9999`.
- **Encoder** (`Claude Code (Encoder Test)`) blocked: `Not authorized to post journal entries` (role check is the RPC's first statement).
- Bonus: manager (`Maria Santos`) can post; `journal_entry_lines_one_side` CHECK rejects a line with both debit and credit > 0.
- `get_advisors(security)`: `post_journal_entry` shows the same anon/authenticated "can execute SECURITY DEFINER" WARN as every existing project RPC (`confirm_order`, `adjust_stock`, `receive_purchase_order`) — the internal role check is the established gate; not a regression.
- `npm run build` passes.

Note on scope: the doc's ACCT-2 header said "Chart of Accounts" in the kickoff request, but ACCT-1 (Chart of Accounts) was already Done and ACCT-2 is Journal Core — processed ACCT-2 (Journal Core) only, as instructed ("Only ACCT-2 should be processed"). No git commit (per standing project rule — stopped at DoD for manual review). ACCT-3 (Manual Entry UI + retire income/expenses) is next but has open decisions requiring Sinag (Income/Expense category mappings, Rent/Transportation accounts).

---

### 2026-07-02 — ACCT-3

Manual journal-entry UI + retirement of the `income`/`expenses` write paths.

**Decisions confirmed by Sinag before starting:** Rent → new account `6015 Rent Expense`; Transportation → `6080 Other Expenses`.

**Migration `0015_accounting_rent_expense_account`** (via Supabase MCP): inserts account `6015 Rent Expense` (category `expense`), slotted between 6014 and 6020. `accounts` now 96 rows. This consumed migration label `0015`; ACCT-4..7's reserved labels shift up by one (see the renumber note in the Status table).

**UI — new top-level `app/dashboard/accounting/` section** (mirrors Finance's D016 three-layer gating):
- `Accounting` `NavGroup` in `components/layout/app-shell.tsx` with `roles: ["admin","manager"]`, placed after Finance; one child **Journal** (`/dashboard/accounting/journal`).
- `journal/new` — posting form: entry date, description, dynamic lines (native account picker "number — name", one-sided debit/credit inputs, memo). Live Total Debits/Credits/Difference computed in integer centavos; **Post Entry disabled until balanced and > 0**. Submits assembled JSONB to `post_journal_entry()`.
- `journal` — list of posted entries (date, description, source badge, line count, amount, View), admin/manager `hasAccess` + redirect.
- `journal/[id]` — read-only entry detail with per-line debit/credit table and totals footer.
- `accounting/page.tsx` redirects to the journal list.

**Retired `income`/`expenses`:** deleted the create/edit/delete server actions and the add/edit dialog forms (`income-form.tsx`, `expense-form.tsx`, both `actions.ts`). The two pages are now **read-only archives** — a banner links to Accounting → Journal, no add/edit/delete controls remain. Tables are **not** dropped (historical data stays queryable); deprecation comments added to both page components and table components. Finance nav group and its pages stay in place per the retirement plan.

**Data conversion — deliberately NOT run.** All 7 rows (`income`: Sales2 1500, Service Revenue 950, Sales 1000, Service Revenue 500; `expenses`: Supplies 300, Utilities 400, Salaries & Wages 500) were Finance-module verification test data (tiny round amounts, all created within a ~1-hour window on 2026-07-02) — Sinag confirmed. Importing them would have polluted the clean ledger that ACCT-6 needs for the real opening balance. Per Sinag's follow-up instruction, the 4 remaining live rows were **soft-deleted** (`deleted_at = now()`, matching the other 3 already soft-deleted earlier) — rows are preserved for audit history but no longer appear in the read-only archive pages (both filter `deleted_at IS NULL`). `income` and `expenses` are now 0 live rows each. This is the one ACCT-3 Definition-of-Done item intentionally left unchecked (no data to convert), with reason.

**Verified in browser preview** (admin `claude-code@sinagukit.internal`):
- Balanced entry (Dr 1020 Bank 50,000 / Cr 3000 Owner's Capital 50,000) posts through the UI → redirects to detail, appears in the journal list, both lines correct. **Test entry deleted afterward** — `journal_entry_lines` back to sum 0/0, ledger clean for ACCT-6.
- Running balance: at 5,000 vs 3,000 the Difference shows ₱2,000 (red) and Post Entry is disabled; at 50,000/50,000 it enables. No console errors.
- Both Finance pages render as read-only archives with the journal banner and no write controls.
- `npm run build` passes with zero errors (new `/dashboard/accounting/*` routes registered).

No git commit (standing project rule — stopped at DoD for manual review). Next: ACCT-4 (Financial Reports, migration `0016_accounting_reports`) — no open decisions.

---

### 2026-07-02 — ACCT-4

Financial reports: Trial Balance, Income Statement, Balance Sheet.

**Migration `0016_accounting_reports`** (via Supabase MCP): three `SECURITY DEFINER` `language plpgsql` functions — `get_trial_balance(p_as_of)`, `get_income_statement(p_start, p_end)`, `get_balance_sheet(p_as_of)` — applied verbatim from the doc, role check (`admin`/`manager`) as the first statement in each.

**UI — three new pages under `app/dashboard/accounting/`**, added to the existing `Accounting` `NavGroup` (no new gating setup needed, same admin/manager filter):
- `trial-balance` — `AsOfDateFilter` (new reusable component, `components/business/as-of-date-filter.tsx`, URL-driven single-date picker paired with `DateRangeFilter`'s existing pattern) + `StatCard`s for Total Debits/Credits/Ledger Check + a `DataTable` listing.
- `income-statement` — reuses the existing `DateRangeFilter`; `StatCard`s for Total Revenue/Expenses/Net Income. `get_income_statement()` has no default bounds, so an empty "All Time" range from the filter is substituted with `2000-01-01`..today before calling the RPC.
- `balance-sheet` — `AsOfDateFilter` + `StatCard`s for Total Assets/Liabilities/Equity/Balance Check.

All three page-level `hasAccess` checks mirror the Journal pages exactly (admin/manager, restricted-access fallback card for other roles).

Verified directly against the live DB (role impersonation, rolled back) and in browser preview (admin `claude-code@sinagukit.internal`):
- Encoder role blocked on all three RPCs: `Not authorized to view financial reports` (role check fires before any query).
- Trial Balance on real data (a "Test only" entry already in the ledger: Dr 1000 Cash 300 / Cr 1501 Accum. Dep. 200 / Cr 1300 Prepaid 100): Total Debits = Total Credits = ₱300.00, Ledger Check "Balanced".
- Income Statement: ₱0.00 revenue/expense/net (correct — the test entry only touches asset accounts, no revenue/expense lines exist yet).
- Balance Sheet: Total Assets ₱0.00 (300 − 200 − 100), Liabilities ₱0.00, Equity ₱0.00, Balance Check "Balanced" — assets = liabilities + equity holds.
- No console errors on any of the three pages.
- `npm run build` passes with zero errors; all three new routes registered (`/dashboard/accounting/trial-balance`, `/income-statement`, `/balance-sheet`).

Note: a stray "Test only" journal entry (₱300, dated 2026-07-02) was found already posted in `journal_entries` at the start of this session — not left over from ACCT-3 (that session's test entry was explicitly deleted). The three report figures above were verified against it while it existed, then Sinag asked for it to be removed. Deleted via direct SQL (`delete from journal_entries where id = '8bce9076-...'`, `journal_entry_lines` cascaded) — `journal_entries` and `journal_entry_lines` are both back to 0 rows, ledger clean for ACCT-6's opening balance import.

Committed to git this session (Sinag's explicit request). Next: ACCT-5 (Fixed Assets & Depreciation, migration `0017_accounting_fixed_assets`) — no open decisions, though Sinag should confirm whether Furniture/Tools/Room Improvement have unlisted assets per the doc's note.

---
