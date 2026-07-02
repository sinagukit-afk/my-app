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
| ACCT-1 | Chart of Accounts | Not started | `0013_accounting_chart_of_accounts` | |
| ACCT-2 | Journal core (`journal_entries`, `post_journal_entry()`) | Not started | `0014_accounting_journal_core` | |
| ACCT-3 | Manual entry UI + retire income/expenses | Not started | — | |
| ACCT-4 | Financial reports (trial balance, income statement, balance sheet) | Not started | `0015_accounting_reports` | Runs before ACCT-5 — hence the lower migration number |
| ACCT-5 | Fixed assets & depreciation | Not started | `0016_accounting_fixed_assets` | |
| ACCT-6 | Historical import / opening balance | Blocked | `0017_accounting_opening_balance_adjustment` (conditional) | Needs Sinag's decision on: (1) ₱50,000 Owner's Capital vs Owner's Withdrawals reclass, (2) how to absorb ₱2,784.03 ledger imbalance. Migration only needed if a plug account is required. |
| ACCT-7 | Auto-posting from `confirm_order()` / PO receiving | Gated | `0018_accounting_order_posting` | Waiting on core BMS order/PO flow to stabilize — do not start until confirmed |
| ACCT-8 | BIR tax estimate calculator | Not started | — | Lowest priority, optional |

## Session log

*(Claude Code: append a dated entry here after each session — what was done, what was decided, anything left open.)*

---
