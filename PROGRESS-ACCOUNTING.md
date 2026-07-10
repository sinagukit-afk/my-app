# PROGRESS-ACCOUNTING.md

> **▶ RESUMED — clean restart (2026-07-10).** Sinag lifted the 2026-07-02
> pause and asked for a clean restart: keep the existing ACCT-1–6
> schema/RPCs/UI as-is (it works), but wipe all data so the module starts
> from zero — `accounts`, `journal_entries`, `journal_entry_lines`,
> `fixed_assets`, `depreciation_entries` are all **0 rows** as of this
> session. Flows come first; Sinag will manually input the real chart of
> accounts and opening data later (no historical-import redo planned).
> ACCT-7 (auto-posting) and ACCT-8 (BIR calculator) remain **out of
> scope** for this restart — do not start either without Sinag
> explicitly asking. See the 2026-07-10 session log entry below for full
> detail, including the security fix applied in the same session.

Tracking file for the Accounting Module workstream only. Kept separate from the
core BMS `PROGRESS.md` so phase numbers don't collide between the two build
threads.

Migration files share one global sequence with core BMS migrations
(`0013_...` onward) — only the phase *labels* below are namespaced to this
workstream.

## Module conventions

**Retired 2026-07-09** — this section replaces `Accounting-Module-Phase1-5-ClaudeCode-Instructions.md`
(moved to `docs/archive/`), which specified ACCT-1 through ACCT-6 and was fully
realized by the sessions logged below. Its per-phase SQL bodies are no longer
needed as a reference (they're live in the database — see `list_migrations`/
`pg_get_functiondef` for the real, current definitions); the durable
conventions worth keeping are:

- **Money columns use `numeric(12,2)`**, not bare `numeric` like the rest of
  the schema (`income.amount`, `orders.total_money`, etc.) — a deliberate,
  scoped deviation. Double-entry bookkeeping is precision-sensitive, and
  ACCT-6 hit a real rounding-drift imbalance in the source ledger, so a
  DB-level scale constraint was judged worth the inconsistency. Applies to
  `journal_entry_lines.debit`/`credit`, `fixed_assets.cost`,
  `depreciation_entries.amount`.
- **RLS pattern:** `accounts`/`fixed_assets` — select admin+manager, insert/
  update admin-only, **no delete policy** (soft-delete-only convention, D003;
  deactivate via `is_active = false`). `journal_entries`/`journal_entry_lines`/
  `depreciation_entries` — **select-only** RLS for admin+manager, zero direct
  insert/update/delete policies; all writes go exclusively through
  `post_journal_entry()`/`run_monthly_depreciation()` (`SECURITY DEFINER`,
  explicit role check as the first statement, same pattern as
  `confirm_order()`/`adjust_stock()`). Encoder is excluded from every
  Accounting table (tighter than the general Suppliers/POs/Inventory
  convention — financial data is treated as more sensitive, see D016).
- **Nav/gating:** top-level `Accounting` `NavGroup` in `app-shell.tsx`,
  `roles: ["admin","manager"]`, mirroring Finance's three-layer D016 pattern
  (sidebar filter + page-level `hasAccess` check on every route).
- **Chart of Accounts (95 seed accounts, ACCT-1):** corrected from the source
  spreadsheet before seeding — excluded 6 section-header rows (`1`/`2`/`3`/
  `4`/`5`/`6`, not real accounts) and fixed account `4014` from a duplicate
  "Paddle Hair Brush-Large" to "Sales Revenue - Phone Stand" (cross-checked
  against the matching expense account `5014`). Full current list: query the
  live `accounts` table, not this doc.
- **Income/Expense category → account mapping (ACCT-3):** `Rent` had no
  matching account — Sinag chose to add a new one (`6015 Rent Expense`, which
  is why migration numbers `0015`→`0019` each shifted up by one from the
  original doc's plan). `Transportation` had no clean match either — mapped
  to `6080 Other Expenses`. Both confirmed with Sinag before the ACCT-3
  conversion ran.
- **ACCT-5 depreciation rounding caveat (still open):** `round(cost/24, 2)`
  rounds up for all 3 seeded assets, so 24 consecutive monthly runs actually
  post only 23 periods — each asset stops one month short of its true cost,
  never reaching exactly ₱0.00 book value (Canon ₱139.01 short, RK Royal
  Kludge ₱85.34 short, Sculpfan ₱954.09 short, confirmed via a 25-month
  simulation). No resolution decided (e.g. a final-period "plug to zero"
  rule) — flag before relying on Fixed Assets → Book Value hitting exactly
  zero at end of useful life.
- **ACCT-5 open question, still unanswered:** whether Furniture (1500),
  Tools & Equipment (1540), or Room Improvement (1550) have real unlisted
  assets to seed beyond the 3 assets already seeded (Canon Printer, Sculpfan
  S30 Pro Max, RK Royal Kludge) — asked once, no answer received.

## Status

| Phase | Description | Status | Migration(s) | Notes |
|---|---|---|---|---|
| ACCT-1 | Chart of Accounts | Done | `0013_accounting_chart_of_accounts` | |
| ACCT-2 | Journal core (`journal_entries`, `post_journal_entry()`) | Done | `0014_accounting_journal_core` | |
| ACCT-3 | Manual entry UI + retire income/expenses | Done | `0015_accounting_rent_expense_account` | Rent Expense account (6015) added for the expenses mapping; consumed migration label `0015`, shifting ACCT-4..7 up by one (see note below) |
| ACCT-4 | Financial reports (trial balance, income statement, balance sheet) | Done | `0016_accounting_reports` | Runs before ACCT-5 — hence the lower migration number |
| ACCT-5 | Fixed assets & depreciation | Done | `0017_accounting_fixed_assets` | Rounding caveat found — see session log |
| ACCT-6 | Historical import / opening balance | Done | — (no plug account needed) | Posted 2026-07-02 as `journal_entries.id = 61d13de0-99a0-4c90-9296-1ded0b2ca823`. The doc's own Resolution section (₱142,532.17 Retained Earnings, ₱332.40 credit for 2010) did not actually balance — recomputed from an updated source workbook Sinag supplied mid-session; see session log for the corrected figures actually posted. `0018_accounting_opening_balance_adjustment` migration and 3099 plug account confirmed still not needed. |
| ACCT-7 | Event-driven auto-posting (rewritten — see `docs/ACCT-7-v2-Business-Events-Kickoff.md`) | In progress | `acct7_reseed_chart_of_accounts`, `acct7_item_accounting_mappings` | Original scope assumed `confirm_order()`, retired by D027 — full rescope done 2026-07-10, split into ACCT-7.1..7.8. 7.1 partial (COA re-seeded, edit UI not built yet); 7.3 tooling built (mapping page live, Sinag's confirmation pass not done yet) |

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

### 2026-07-02 — ACCT-5

Fixed Assets & Depreciation.

**Open item not resolved this session:** asked Sinag (via question prompt) whether Furniture (1500), Tools and Equipment (1540), or Room Improvement (1550) have real assets to seed beyond the 3 the doc already specifies — no answer came back, so per the doc's own fallback ("this only covers the two Depreciation Table entries with concrete purchase dates/costs visible in the sheet") only the 3 known assets were seeded. Still an open question for Sinag before more assets are added.

**Migration `0017_accounting_fixed_assets`** (via Supabase MCP): tables `fixed_assets` and `depreciation_entries` (money columns `numeric(12,2)`), RLS (select admin+manager on both; insert/update admin-only on `fixed_assets`, no direct writes on `depreciation_entries` — same "RPC is the only write path" pattern as `journal_entry_lines`), applied verbatim from the doc. Seeded 3 assets: Canon Printer (₱3,339.00, Office Equipment 1520/1521/6001), Sculpfan S30 Pro Max (₱22,900.00, Machinery 1530/1531/6002), RK Royal Kludge (₱2,050.00, Machinery 1530/1531/6002) — all 24-month useful life, confirmed against the live DB. `run_monthly_depreciation(p_period)` RPC applied verbatim, admin-only, calls `post_journal_entry()` internally per asset.

Verified directly against the live DB via `request.jwt.claims` role impersonation inside rolled-back transactions (confirmed `journal_entries`/`journal_entry_lines`/`depreciation_entries` all back to 0 rows afterward — ledger untouched):
- Admin run for `2026-07-01` posts 3 balanced entries, one per asset: ₱139.13 (Canon), ₱85.42 (RK Royal Kludge), ₱954.17 (Sculpfan) — each `round(cost/24, 2)`. Ledger-wide `sum(debit) - sum(credit) = 0` afterward.
- Running the same month twice: second call returns 0 rows (the `not exists` guard on `depreciation_entries` holds) — no double-post.
- Manager role blocked: `Not authorized to run depreciation` (the RPC requires `admin` specifically, tighter than `post_journal_entry()`'s admin+manager, as the doc specifies).
- **Rounding caveat confirmed by direct 25-month simulation** — flagged in the doc as something to double-check: because `round(cost/24, 2)` rounds up for these three assets' costs, running 24 consecutive months causes the 24th run to skip (existing total + monthly would exceed `cost`), so all three assets stop 1 month short (23 posted periods) and never reach exactly ₱0.00 book value — Canon ends ₱139.01 short, RK Royal Kludge ₱85.34 short, Sculpfan ₱954.09 short. The RPC was implemented exactly as specified in the doc (no logic changes made), but this residual-book-value behavior is a real, confirmed limitation worth Sinag's attention before relying on Fixed Assets → Book Value hitting exactly zero at end of useful life. Not fixed in this session since the doc didn't specify a resolution (e.g. a final-period "plug to zero" rule) — flagging for a future decision.

**UI — new `Fixed Assets` page** under `/dashboard/accounting/fixed-assets`, added as a child of the existing `Accounting` `NavGroup` (`components/layout/app-shell.tsx`, same admin/manager filter, no new gating setup needed):
- Asset list (name, asset account #, purchased date, useful life, cost, accumulated depreciation, book value, status badge) with Total Cost / Accum. Depreciation / Book Value summary cards. Same page-level `hasAccess` check pattern as the other Accounting pages.
- Admin-only "Run Depreciation" button (`run-depreciation-dialog.tsx`) opens a dialog: month picker, live preview of what will post (queried read-only, mirrors the RPC's selection + rounding logic exactly so the preview matches what actually posts), Confirm & Post calls the RPC via a server action and refreshes the list.
- `actions.ts`: `previewDepreciation()` (read-only) and `runDepreciation()` (calls `run_monthly_depreciation` RPC, `revalidatePath`).

`npm run build` passes with zero errors; `/dashboard/accounting/fixed-assets` registered.

**Browser preview verification not performed via this session's own tooling** — blocked by another active session's `next dev` server holding this project directory's single-instance dev lock (confirmed via `node_modules/next/dist/build/lockfile.js`, a documented breaking change in this Next.js version per `AGENTS.md`); `preview_start` refused to start a second instance regardless of port. Compensated with build/typecheck passing and the DB-level role-impersonation verification above.

**Bug found by Sinag in that other session's live browser, fixed same session:** the initial `page.tsx` defined the `DataTable` `columns` array (with `render` functions for date/currency/badge formatting) inline inside the server component and passed it as a prop to the client `DataTable` — Next.js threw "Functions cannot be passed directly to Client Components." `npm run build`'s type-check did not catch this; it's a runtime-only RSC boundary violation. The rest of the Accounting module already had the correct pattern (`journal-table.tsx`, `trial-balance-table.tsx` — `"use client"` wrapper components that own `columns` internally and take only a plain `data` prop) but it wasn't followed here. Fixed by extracting `fixed-assets-table.tsx` as a `"use client"` component following that exact pattern; `page.tsx` now only fetches/shapes data and passes `rows` down. Rebuilt clean after the fix. Saved as a standing memory (`feedback_datatable_columns_client_boundary`) so future Accounting/BMS pages don't repeat it. Sinag has not yet re-confirmed the fix in-browser as of this log entry.

No git commit (standing project rule — stopped at DoD for manual review). Next: the doc's "Final check after ACCT-5" balance query was run directly (0 rows, `difference` trivially null/0) — ledger is clean, ready for ACCT-6 (Historical Import) whenever Sinag wants to proceed; ACCT-7 remains gated on core BMS order/PO stabilization.

---

### 2026-07-02 — ACCT-6

Historical Import / Opening Balance. Pre-flight check confirmed `journal_entries`/`journal_entry_lines`/`depreciation_entries` were all still 0 rows and migrations `0013`–`0017` applied — no double-posting risk from ACCT-3/ACCT-5.

**The doc's own Resolution section did not actually balance.** Summed the doc's proposed opening-balance table by hand: total debits ₱492,185.16 vs. total credits ₱221,153.57 — off by ₱271,031.59, not the "~₱0.003, rounds to ₱0.00" the doc claimed. `post_journal_entry()` would have hard-rejected it. Flagged this plus one unverifiable assumption (whether the ₱50,000 3000→3010 reclass was a single GL row) to Sinag before touching the DB.

Sinag supplied an **updated source workbook** (`Sinag- Ukit_2026.xlsx`) mid-session. Re-derived the opening balance directly from it (via a scratch Node/`xlsx` script — no Python interpreter available in this environment, only the WindowsApps stub):
- The updated General Ledger now balances exactly at the raw-row level (total debit = total credit = ₱3,057,137.71 across all 1,675 data rows) — the fy2024 RE debit/credit sign issue the original doc flagged is already fixed at the source.
- Account 3000 Owner's Capital now has only its original ₱50,000 credit (Capital Investment) — no offsetting debit exists anymore, so the 3000→3010 reclass the doc proposed is moot; 3010 already carries its own independent ₱50,000 debit.
- **Retained Earnings was still wrong even in the updated numbers**, by ₱271,696.39: the doc derived 3020 from only the two direct-posted closing entries (₱142,532.17), missing that 2026's revenue/expense accounts carry live, unclosed year-to-date activity (the last closing entry was FY2025, dated 2025-12-31). Summed all revenue/expense account balances directly from the GL and got ₱271,696.39 net income — matched the workbook's own Income Statement "Net income" cell (row 84) to the cent. True Retained Earnings as of 2026-06-30: **₱414,228.56 credit**, which is also exactly what the workbook's own Balance Statement tab formula computes (`1392.02+141140.15+'Income Statement'!C84`) — the same figure the original doc's "What I found" section had dismissed as unreliable.
- **Account 2010 Income Taxes Payable was on the wrong side.** The doc listed it as a ₱332.40 credit; the GL has exactly one entry for that account, a ₱332.40 **debit** dated 2025-04-28 with memo "sales... 831pcs ref magnet ATM- Enomoto" — clearly a misclassified sales transaction, not a tax payment. Sinag's call: reclassify it into Other Expense (6080) to close out 2010 entirely, rather than carry it as a payable. Since the original transaction falls in FY2025 (already closed to RE), the reclass reduces the derived Retained Earnings by ₱332.40 instead of appearing as its own line: final 3020 = ₱414,228.56 − ₱332.40 = **₱413,896.16 credit**.

**Final posted entry** (`entry_date` 2026-06-30, `source_type` opening_balance, 15 lines, total ₱492,185.16 both sides): 1020 Bank Dr 392,976.12; 1200–1209 inventory accounts Dr (7,457.90 / 884.00 / 2,204.00 / 9,620.87 / 390.69 / 92.18 / 270.40); 1520 Office Equipment Dr 3,339.00 / 1521 Accum. Dep. Cr 3,339.00; 1530 Machinery Dr 24,950.00 / 1531 Accum. Dep. Cr 24,950.00; 3000 Owner's Capital Cr 50,000.00; 3010 Owner's Withdrawals Dr 50,000.00; 3020 Retained Earnings Cr 413,896.16. No 2010 line (folded into 3020 per the reclass above).

**Posting mechanism:** the ACCT-3 Manual Entry UI's server action hardcodes `p_source_type: 'manual'` with no way to pass `opening_balance`, and `post_journal_entry()`'s role check reads `auth.uid()` (null under direct `execute_sql`, since there's no session). Posted via Supabase MCP `execute_sql` with an explicit transaction that locally sets `request.jwt.claim.sub` to the Claude test account's UUID (`2dc12fbd-75a1-4c13-a9a5-4f926643335a`, `role = admin`) before calling `post_journal_entry(..., p_source_type => 'opening_balance')` — gives a real `auth.uid()`/`created_by` and the correct `source_type` without a UI change. Worth a follow-up decision on whether `source_type` should become a form field if opening-balance-style entries recur.

Verified Definition of Done directly against the live DB:
- Entry posted as a single balanced call — `post_journal_entry()` would have rejected the doc's original ₱271K-off table outright.
- `journal_entry_lines` sums to exactly the finalized table, account-by-account.
- Global check: `sum(debit) - sum(credit) = 0.00` across the whole ledger.
- `get_trial_balance('2026-06-30')` output matches the finalized table exactly.
- `npm run build` passes with zero errors.

No git commit (standing project rule — stopped at DoD for manual review). ACCT-7 remains gated on core BMS order/PO stabilization; ACCT-8 (BIR tax estimate) not started.

---

### 2026-07-10 — Clean restart

Sinag asked to resume the module with a clean restart: keep the ACCT-1–6
schema/RPCs/UI exactly as built (it works), but remove all existing data so
the module starts from zero. Flows first; real chart of accounts and
opening balances to be entered manually by Sinag later — no repeat of the
ACCT-6 historical-import exercise.

**Security fix applied first** (migration `acct_fix_null_role_bypass`): the
5 Accounting RPCs flagged in the 2026-07-07 sweep (`post_journal_entry`,
`get_trial_balance`, `get_income_statement`, `get_balance_sheet`,
`run_monthly_depreciation`) still had the null-role auth bypass —
`current_user_role() not in (...)` / `<> 'admin'` evaluates to `NULL` (not
true) for an unauthenticated/no-profile caller, so the check silently
no-opped. Rewrote all 5 to the established `v_role := current_user_role();
if v_role is null or v_role not in (...)` pattern, matching `adjust_stock`
etc. Verified in rolled-back transactions: empty JWT claims now reject all
5 with the expected "Not authorized..." error; a real admin (`sub` =
Claude test account) still reaches the business logic. `get_advisors
(security)` shows only the pre-existing baseline WARN (anon/authenticated
can execute `SECURITY DEFINER` — expected, same as every other RPC in the
project; the internal role check is the gate).

**Data wipe** (direct `DELETE`, FK-safe order — not a migration, no schema
change): `journal_entry_lines` → `depreciation_entries` →
`journal_entries` → `fixed_assets` → `accounts`. All 5 tables confirmed at
**0 rows** afterward. This removed the ACCT-6 opening-balance entry (1
entry / 15 lines) and the 3 seeded fixed assets (Canon Printer, Sculpfan
S30 Pro Max, RK Royal Kludge) — along with them, the open depreciation
rounding caveat (round-up drift never hitting exactly ₱0 book value) is
moot until assets are re-seeded and should be revisited then. The 96-row
Chart of Accounts was also wiped per Sinag's choice (full clean slate, not
data-only) — there is currently **no seed data and no Chart-of-Accounts
entry UI**; accounts will need to be re-created (migration/SQL, same as
ACCT-1) before any journal entry can be posted.

**Verified in browser preview** (admin `claude-code@sinagukit.internal`):
Journal list shows "No journal entries yet", Trial Balance shows
₱0.00/₱0.00 "Balanced", Fixed Assets shows "No fixed assets yet" — all
three render cleanly with no console errors. Note: the Fixed Assets empty
state itself says "Assets are added via migration seed data for now — no
add-asset UI yet" — if Sinag's later manual data entry is expected to
include fixed assets, that gap (no add-asset form) will need addressing
before then.

**Explicitly out of scope this session** (confirmed with Sinag): ACCT-7
(auto-posting) and ACCT-8 (BIR calculator) stay deferred. No git commit
(standing project rule — stopped for manual review).

---

### 2026-07-10 — ACCT-7 rescoped (design only, no code)

Sinag brought a draft "Business Events → Accounting Snapshot → Rule Engine
→ Journal Draft → Review → Post" architecture proposal for review. Checked
it against the live schema/`DECISIONS.md` rather than taking it at face
value:

- **ACCT-7's original scope was dead on arrival** — it assumed a
  `confirm_order()` hook, which D027 retired 2026-07-06. The order
  lifecycle is now an 8-status state machine across ~8 RPCs; any
  auto-posting design has to target that, not the doc's assumption.
- The proposal's bottom half (Snapshot → Rules → Draft → Review → Approve
  → Post → GL → Reports) was mostly **already built** for the GL/Reports
  end (`journal_entries`, `get_trial_balance`/etc.) but **completely
  missing** for the event/snapshot/rule-engine/draft/review front end —
  today every journal entry is 100% hand-typed through the Journal UI,
  with no draft state and no reversal mechanism (the one time a posted
  entry needed fixing, in ACCT-4, it was fixed via a raw SQL `DELETE` —
  flagged as the anti-pattern this workstream should replace).
- Walked Sinag through the gaps (no invoice/AR concept in Sales, no
  supplier-invoice concept in Purchasing, inventory bucket transfers vs.
  real financial events, GR/IR clearing complexity with nothing to pair
  against) and got explicit decisions on all of them — see the full list
  in `docs/ACCT-7-v2-Business-Events-Kickoff.md`. Highlights: revenue
  recognizes at `close_order_payment()` (not order confirmation, no AR
  used); COGS posts separately at actual stock-out; Purchasing assumes
  already-paid except credit card, which gets its own `Credit Card
  Payable` liability + installment-payment event (Option B, chosen over
  the simpler "ignore the installment" option); Review+Approve is
  admin+manager, collapsed from the original doc's 4-stage flow to 2
  human checkpoints (Snapshot/Draft auto, Review/Approve&Post manual).
- **New doc:** `docs/ACCT-7-v2-Business-Events-Kickoff.md` — full event
  catalog (7 events, each mapped to its real triggering RPC), 7 proposed
  new Chart-of-Accounts entries (`1210 Inventory - Frame` fills a gap next
  to the existing `4020`/`5020` Frame pair; `2020 Credit Card Payable`;
  `4041 Tip Income`; `4042 Inventory Adjustment Gain`; `6090 Bad Debts/
  Write-off Expense`; `6091 Inventory Shrinkage/Scrap Expense`; `6092
  Credit Card Interest/Finance Charges`), and a phase breakdown ACCT-7.1
  through ACCT-7.8.
- **New prerequisite surfaced:** `purchase_orders` has no payment-method
  field at all (unlike `orders.payment_type_id`) — needed before the
  credit-card-vs-ordinary-payment branch can work. Folded into ACCT-7.2.
- **No schema, RPC, or UI changes made this session** — Sinag explicitly
  asked to stop at the kickoff doc, no coding yet. `PROGRESS-ACCOUNTING.md`'s
  status table and `MODULE_STATUS.md`'s Accounting section were updated to
  point at the new doc and to correct a stale "⏸ PAUSED (2026-07-02)"
  banner in `MODULE_STATUS.md` that predated the 2026-07-10 restart.

Still open before ACCT-7.1 can start: confirm the 7 proposed account
numbers, and do the item/category → account mapping pass with Sinag
(same shape as ACCT-3's Rent/Transportation resolution) — see the "Still
open" section of the new doc.

---

### 2026-07-10 — ACCT-7.1 (partial) + ACCT-7.3 tooling built

Sinag confirmed the 7 proposed accounts and asked for an easy way to do
the item/category → account mapping pass, rather than raw SQL — built as
a real page this session (first actual code for ACCT-7, everything before
this was design-only).

**Migration `acct7_reseed_chart_of_accounts`:** re-seeded the Chart of
Accounts (0 rows since the 2026-07-10 restart) with the original 96-account
list (95 from ACCT-1 + `6015 Rent Expense` from ACCT-3) plus the 7 new
accounts from the kickoff doc. Verified live: 103 accounts total (25
asset, 3 liability, 3 equity, 22 revenue, 50 expense).

**Migration `acct7_item_accounting_mappings`:** new table
`item_accounting_mappings` (`item_id` FK→`items`, unique; `revenue_
account_id`/`inventory_account_id`/`expense_account_id` FK→`accounts`,
all nullable; `updated_by`, timestamps). RLS mirrors `accounts` exactly —
select admin+manager, insert/update admin-only, no delete policy.
Confirmed via `pg_policy` inspection the expressions match byte-for-byte.

**New page `/dashboard/accounting/product-mapping`** (added to the
Accounting nav group, between Journal and Fixed Assets): one row per
non-deleted item (62 rows), with Item/Category/Type columns plus three
account-picker `<select>`s (Revenue/Inventory/COGS-Expense, each filtered
to the matching account category) reusing the shared `DataTable` for
search/sort/pagination/mobile-card-fallback for free. Admin sees editable
selects + a "Save All Mappings" button (upserts the full 62-row state in
one call — simpler than per-row dirty tracking at this scale); manager
sees the same table read-only (disabled selects); other roles get the
standard restricted-access card.

**What this surfaced about the real product catalog** (useful context for
Sinag's upcoming mapping pass, not previously documented anywhere): items
split cleanly into `Itm-*` raw materials/components (`category = "Item"`,
`item_type = simple`, has a real `cost` — these are what `Inventory
Account`/`COGS Account` should map to) and `Pro-*` finished sellable
products (`category = "Product(Custom)"`, `item_type = composite` — these
are what `Revenue Account` should map to). `Pkg-*` (packaging assemblies)
and `Srv-*`/`Shp-*` (services/shipping fee) are smaller groups that may
only need one of the three columns filled in, or none. The page doesn't
enforce this split — all three selects are always shown on every row — so
Sinag can just leave irrelevant columns as "Not mapped."

Verified live (browser, admin test account): page loads, search filters
correctly, setting a mapping (`Itm-Ref Magnet Beechwood, Round 7cm` →
`1200 Inventory - Wood for Ref Magnet` / `5001 Material Expense - Ref
Magnet - Round`) and clicking Save persisted correctly to the DB — left
in place as a working example rather than reverted. `npm run build`
passes zero errors; `lib/supabase/types.ts` regenerated.

**Not done:** the Chart of Accounts edit UI (admin-only) from ACCT-7.1
is still unbuilt — accounts can only be added/changed via migration/SQL
for now. The actual item→account mapping pass (filling in all 62 rows)
is Sinag's to do using the new page, not done by Claude per the
established "flows first, Sinag enters the real data" convention from
the 2026-07-10 restart.

---
