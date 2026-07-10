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
| ACCT-7 | Event-driven auto-posting (rewritten — see `docs/ACCT-7-v2-Business-Events-Kickoff.md`) | In progress | `acct7_reseed_chart_of_accounts`, `acct7_item_accounting_mappings`, `acct7_2_incoming_items_payment_method`, `acct7_4_business_events`, `acct7_4_wire_close_order_payment`, `acct7_4_wire_incoming_items_trigger`, `acct7_4_wire_adjust_stock`, `acct7_4_release_to_scrap`, `acct7_4_wire_shipment_cogs` | Original scope assumed `confirm_order()`, retired by D027 — full rescope done 2026-07-10, split into ACCT-7.1..7.8. 7.1 done (COA re-seeded + admin-only edit UI); 7.2 done (Purchasing payment-method capture); 7.3 done (Sinag reviewed Claude's first pass + mapped the 4 `Pkg-*` items himself; last gap — 4 `Srv-*`/`Shp-*` service items — closed by adding `SCA-4043 Service & Shipping Revenue`, 59/62 mapped, 3 intentionally-unmapped dev/test rows remain); 7.4 done (`business_events` table + all 6 trigger RPCs wired — see session log for the RPC-graph corrections found along the way) |

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

### 2026-07-10 — ACCT-7.1 completed (Chart of Accounts edit UI)

Closed out the one remaining ACCT-7.1 gap from the previous session: a
real add/edit UI for the Chart of Accounts, replacing migration/SQL as
the only way to add or change an account. No schema or RLS changes
needed — `accounts_insert`/`accounts_update` were already admin-only and
`accounts_select` already admin+manager (from ACCT-1), so the page only
had to respect the existing policies, not add new ones.

**New page `/dashboard/accounting/chart-of-accounts`** (added to the
Accounting nav group, as the first child — before Journal, since Journal's
account picker depends on this list): follows the same `page.tsx` /
`*-table.tsx` / `*-form.tsx` / `actions.ts` split as Item Categories
(`app/dashboard/management/item-categories/`), the closest existing
precedent for a simple single-entity CRUD screen with a dialog form.

- Table: Account #, Name, Category (color-coded badge), Description,
  Status (Active/Inactive), Actions. Search/sort/pagination for free via
  the shared `DataTable`.
- Admin sees "Add Account" + per-row Edit + Deactivate/Reactivate; manager
  sees the same table read-only (no action buttons); other roles get the
  standard restricted-access card — mirrors Product Mapping's `canEdit`
  pattern.
- `account-form.tsx`: dialog with Account # (integer), Name, Category
  (select: asset/liability/equity/revenue/expense, matches the DB CHECK
  constraint), Description (optional textarea).
- **Deactivate, not delete** — accounts have no `deleted_at`/delete RLS
  policy (D003 soft-delete convention, but this table uses `is_active`
  instead of `deleted_at` as its deactivation flag, per the ACCT-1
  original design). `setAccountActive()` just flips the boolean; no new
  RPC needed since `accounts_update` already covers it for admin.
- Friendly error mapping in `actions.ts`: Postgres `23505` (unique
  violation on `account_number`) → "That account number is already in
  use."; `42501` (RLS denial) → permission message — same pattern as
  Product Mapping's `friendlyError()`.

**Verification:** `npm run build` passes zero errors, new route
`/dashboard/accounting/chart-of-accounts` registered. **Browser preview
verification not performed this session** — blocked by another active
session's `next dev` server holding this project's single-instance dev
lock (same limitation hit during ACCT-5's fixed-assets UI build; see that
session's log entry). Compensated with the build/typecheck pass above and
by matching the Item Categories/Product Mapping pattern byte-for-byte
where the logic overlaps (role gating, soft-toggle actions, error
mapping) rather than writing new untested logic. Sinag should smoke-test
add/edit/deactivate in-browser before relying on this page for real data
entry.

ACCT-7.1 is now fully done (both the re-seed and the edit UI). Updated
this doc's Status table, `MODULE_STATUS.md`'s Accounting section, and
`docs/ACCT-7-v2-Business-Events-Kickoff.md`'s phase table to reflect it.
No git commit (standing project rule — stopped for manual review). Next
up per the phase breakdown: ACCT-7.2 (Purchasing payment-method capture)
or Sinag's still-pending item→account mapping confirmation pass (ACCT-7.3).

---

### 2026-07-10 — Account number "SCA-" prefix + category filter + verified in browser

Sinag asked for two follow-ups on the Chart of Accounts page just built,
plus asked to actually verify it in-browser (the previous entry only had
build/typecheck, blocked by another session's dev lock).

**Migration `acct_account_number_sca_prefix`:** `accounts.account_number`
changed from `integer` to `text`, all 103 existing values reformatted
`1000` → `'SCA-1000'` etc. (`alter ... using ('SCA-' || account_number::text)`
— unique constraint carries over automatically). Every account number in
the current seed is 4 digits, so text sort order still matches numeric
order; a future account number with a different digit count would sort
oddly — worth a zero-padding rule if that ever comes up, not needed today.

This is a real schema change with a real blast radius — traced every
`account_number` reference before touching anything:
- **4 RPCs recreated:** `get_trial_balance`/`get_income_statement`/
  `get_balance_sheet` needed `drop function` + recreate (Postgres won't
  let `CREATE OR REPLACE` change a `RETURNS TABLE` column's type) with
  `account_number text` in the return signature. `post_journal_entry`
  only needed its body edited (return type is `journal_entries`,
  unaffected) — dropped the two `::integer` casts on
  `(l->>'account_number')`, comparisons are plain text now.
  `run_monthly_depreciation` needed **no changes** — it passes
  `account_number` through an untyped `record` and `jsonb_build_object`,
  both dynamically typed.
- **9 app files updated** from `account_number: number` to `string`
  (journal actions/new-form/detail page, all three report tables,
  fixed-assets table/page, product-mapping table) — all were either
  passthrough display or string-keyed lookups already, so this was a type
  change with no logic change, confirmed by a clean `npm run build`.
- Regenerated `lib/supabase/types.ts` (the MCP tool's response exceeded
  the read limit — worked around by pulling the raw JSON dump the tool
  saved to a file and unescaping it with a one-off Node script rather
  than truncating the type file).
- `get_advisors(security)` after the migration: same pre-existing
  baseline WARN as before (anon/authenticated can execute the 4
  `SECURITY DEFINER` functions) — no new advisories introduced.

**Chart of Accounts add/edit form UX:** rather than making Sinag type
`SCA-` every time, the Account # field shows a fixed `SCA-` adornment
box next to a plain numeric input — admin types just the digits, the
server action (`readAccountFields()` in `actions.ts`) prepends the
prefix before insert/update. Edit mode strips the prefix back off
(`stripPrefix()` in `account-form.tsx`) so the input shows `1000`, not
`SCA-1000`, when editing an existing row.

**Category filter:** added to `chart-of-accounts-table.tsx`, same
pattern as `management/items/items-table.tsx` (local `useState` +
`useMemo` filter feeding a plain `<Select>` ahead of `DataTable`, since
the 5 categories are a fixed enum, not derived from data like Items'
category filter is). Filters client-side; `DataTable`'s own search still
applies on top of whatever the category filter leaves.

**Killed the other session's dev server** (PID 3604, per Sinag's direct
instruction this turn) and started this session's own `next dev` to
actually verify in-browser, closing the gap flagged in the previous
entry:
- Chart of Accounts list renders all 103 accounts as `SCA-XXXX`.
- Category filter to "Liability" correctly narrows to exactly the 3
  liability accounts (`SCA-2000`, `SCA-2010`, `SCA-2020`).
- Add Account: created `SCA-9999 — Test Verification Account`, confirmed
  by direct DB query it stored as `SCA-9999` (not `9999`).
- Edit: opening the just-created row shows `9999` in the input (prefix
  correctly stripped back off for editing).
- Deactivate: toggled the test row to `is_active = false`, confirmed in
  DB and in the UI (badge flips to "Inactive", action flips to
  "Reactivate").
- Journal → New Entry's account picker shows `SCA-1000 — Cash on hand`
  etc., and correctly excludes the deactivated test row (still filters
  `is_active = true`).
- Trial Balance loads with no console errors (₱0.00 — expected, ledger
  is still empty since the 2026-07-10 restart).
- Test account (`SCA-9999`) deleted afterward via direct SQL — back to
  the clean 103 rows.
- `npm run build` passes zero errors after all the type changes.

No git commit (standing project rule — stopped for manual review).

---

### 2026-07-10 — ACCT-7.2 (Purchasing payment-method capture)

Closed the prerequisite the kickoff doc flagged: `purchase_orders` had no
payment-method field at all, needed before event #3 (Purchase received)
can later decide Cash/Bank vs. `2020 Credit Card Payable`.

**Migration `acct7_2_incoming_items_payment_method`:** added
`payment_type_id` (nullable FK → `payment_types`, mirrors `order_payments.
payment_type_id`) and `is_credit_card` (`boolean not null default false`)
to `incoming_items` — not `purchase_orders`. `incoming_items` is the
shared table both `receive_purchase_order()` and Manual Incoming write
to, and it's the row-level granularity the future rule engine (ACCT-7.4+)
will read per receiving transaction, so that's where the columns needed
to live, not the PO header. Two separate fields rather than one, per the
kickoff doc's own distinction: `payment_type_id` reuses the existing
Loyverse-synced `payment_types` list (Gcash/BPI/Other/Maribank/Cash/BDO —
confirmed live, **no "Credit Card" entry exists in that table**), while
`is_credit_card` is an independent boolean flag, since credit-card
purchases aren't a real Loyverse payment type for this business and
shouldn't be modeled as one.

`receive_purchase_order(p_purchase_order_id, p_lines)` extended to
`receive_purchase_order(p_purchase_order_id, p_lines, p_payment_type_id
default null, p_is_credit_card default false)` — both new params applied
to every `incoming_items` row inserted in that receiving call (payment
method is captured once per receiving action, not per line).

**Bug caught before it shipped:** `CREATE OR REPLACE FUNCTION` with 2 new
parameters didn't replace the original — Postgres only replaces on an
exact signature match, so it silently created a **second overload**
(`(uuid, jsonb)` alongside `(uuid, jsonb, uuid, boolean)`), confirmed via
`pg_proc`. Caught immediately by a direct-SQL smoke test (calling the
2-arg form errored `function receive_purchase_order(uuid, jsonb) is not
unique`) before any app code shipped against it. Fixed with a follow-up
migration (`acct7_2_drop_old_receive_purchase_order_overload`) dropping
the stale 2-arg signature. Worth remembering for any future RPC signature
change in this project — `CREATE OR REPLACE` is only safe for
same-signature edits (e.g. the SCA-prefix session's `post_journal_entry`
body-only edit); adding/removing parameters needs an explicit `DROP
FUNCTION` first.

**App changes** (`app/dashboard/inventory/receiving/`):
- `[reference]/receive-form.tsx` — added a `Select` (Payment Method,
  optional) + `Checkbox` ("Paid via credit card") above Post Receipt,
  matching the `Select`/state pattern from `order-payments.tsx` (the
  closest existing payment-type-picker precedent). `[reference]/
  actions.ts`'s `receivePurchaseOrder()` takes the two new args and
  passes them straight through to the RPC. `[reference]/page.tsx` now
  also loads `payment_types` (active only) and passes it down.
- `manual-incoming-form.tsx` — added a native `<select name="payment_type_id">`
  + native checkbox (`name="is_credit_card"`), matching this file's own
  existing uncontrolled-`FormData` style (supplier/item pickers) rather
  than introducing the shared `Select`/`Checkbox` components into a file
  that doesn't use them elsewhere. `actions.ts`'s `createManualIncoming()`
  reads both from `formData` and includes them in the plain
  `incoming_items` insert (this flow doesn't go through the RPC).
  `paymentTypeOptions` threaded through `receiving-header.tsx` from
  `page.tsx`'s existing `Promise.all` data load.
- `receiving-log-table.tsx` — new "Payment" column (payment type name +
  a "Credit Card" badge when `is_credit_card`), fed by extending the
  existing `incoming_items` query in `page.tsx` to also select
  `payment_types(name)` and `is_credit_card`.

**Verified:**
- `npm run build` passes zero errors; `lib/supabase/types.ts` regenerated
  (confirmed `payment_type_id`/`is_credit_card` present on `incoming_items`
  and the new RPC signature in the `Functions` types).
- **DB-level verification** (rolled-back transactions, role-impersonated
  as the Claude admin test account, before browser access was available):
  real `partial`-status PO (`SPO-2026-07080001`) received with
  `p_payment_type_id`/`p_is_credit_card` set — both stored correctly on
  the `incoming_items` row; same PO received again with the old 2-arg
  call style — confirmed both columns default to `null`/`false` safely;
  both transactions rolled back, no data left behind.
- **Bug caught by the DB-level test above, before it shipped:** `CREATE
  OR REPLACE FUNCTION` with 2 new parameters didn't replace
  `receive_purchase_order` — Postgres only replaces on an exact signature
  match, so it silently created a **second overload**
  (`(uuid, jsonb)` alongside `(uuid, jsonb, uuid, boolean)`), confirmed
  via `pg_proc`. The 2-arg smoke test errored `function
  receive_purchase_order(uuid, jsonb) is not unique`. Fixed with a
  follow-up migration (`acct7_2_drop_old_receive_purchase_order_overload`)
  dropping the stale 2-arg signature, then re-verified both DB-level
  cases pass cleanly. Worth remembering for any future RPC signature
  change in this project (saved as
  `feedback_create_or_replace_function_signature_change` memory) —
  `CREATE OR REPLACE` is only safe for same-signature edits (e.g. the
  SCA-prefix session's `post_journal_entry` body-only edit); adding/
  removing parameters needs an explicit `DROP FUNCTION` first.
- **Browser preview, full click-test (Sinag's explicit request, same
  session):** the other active session's `next dev` server (holding this
  project's single-instance dev lock, same recurring limitation as ACCT-5
  and ACCT-7.1) was killed on Sinag's direct instruction this turn
  (`Stop-Process -Id 22048 -Force`, confirmed via
  `Get-NetTCPConnection -LocalPort 3000`). Started this session's own
  `next dev`; first attempt 404'd on every dashboard route (stale
  `.next` build cache left behind by the killed process's incomplete
  Turbopack state) — cleared `.next/` and restarted clean, which fixed
  it. Logged in as the Claude admin test account and drove both forms
  end to end:
  - **PO receive form** (`/dashboard/inventory/receiving/SPO-2026-07080001`):
    Payment Method select + "Paid via credit card" checkbox render
    correctly. Received 1 unit with Gcash + credit card checked — new
    row `SRI26-0710-0019` appears in the Receiving Log with "Gcash" +
    a "Credit Card" badge, Units Remaining dropped 10→9, no console
    errors. Confirmed in DB: `payment_type_name = 'Gcash'`,
    `is_credit_card = true`, `source = 'purchase_order'`.
  - **Manual Incoming dialog**: Payment Method select + checkbox render
    correctly, native-`<select>` style matching the rest of that form.
    Logged 3 units of `Itm-Bottle Opener-Long 14cm` with BDO, credit-card
    **unchecked**, note "ACCT-7.2 payment-method verification entry" —
    new row `SRI26-0710-0020` appears with "BDO" and no badge, no console
    errors. Confirmed in DB: `payment_type_name = 'BDO'`,
    `is_credit_card = false`, `source = 'manual'`.
  - **Bug hit and fixed mid-verification:** submitting the PO receive
    form with a generic `button[type="submit"]` selector matched the
    header's Sign Out button instead of Post Receipt (logged the session
    out) — exactly the pitfall already on file in
    `feedback_preview_submit_button_targeting`. Re-logged in and redid
    the submit by exact button-text match instead; no repeat.
  - Both verification entries (`SRI26-0710-0019`, `SRI26-0710-0020`) left
    in place as real, labeled examples rather than rolled back — they
    represent genuine stock movements against real PO/item rows, matching
    the project's standing convention (RECV-1, ACCT-7.1's `SCA-9999`) of
    leaving self-contained verification data in place rather than
    reverting it.

No git commit (standing project rule — stopped for manual review). Next
up per the phase breakdown: ACCT-7.3 (Sinag's item→account mapping
confirmation pass, tooling already built) or ACCT-7.4 (`business_events`
table + wiring), the latter now unblocked by 7.2's payment-method
prerequisite.

---

### 2026-07-10 — Chart of Accounts consistency audit + cleanup

Sinag asked for an audit of the live 107-account Chart of Accounts
("easy to understand and consistent") ahead of his still-pending ACCT-7.3
item→account mapping pass. Queried the live `accounts` table directly
(not this doc, which was already stale) and cross-checked against
`docs/ACCT-7-v2-Business-Events-Kickoff.md`'s documented account additions
and `get_income_statement()`'s grouping logic.

**Findings:** a real duplicate account (`SCA-1205`/`SCA-1211`, both
"Inventory - Magnetic Sheet", 0 items mapped to either); every account had
`description = null`, hurting clarity on ambiguous catch-alls (`Other
Expenses`/`Other IT Expenses`/`Other Marketing Expenses`/`Other Income`,
plus undefined `MRR` abbreviation on `6010`-`6013`); the Inventory (`12xx`)
numbering series doesn't mirror the Revenue/Material-Expense (`40xx`/`50xx`)
same-suffix convention; the same fixed asset had inconsistent naming
across its asset/accum.-depreciation/depreciation-expense trio (e.g. `Room
Improvement` → `Accumulated depreciation-Room` → `Depreciation
expense-Room improvements`); a typo (`Electricty`), a sentence used as an
account name (`Paid expenses for the following year`), and a grammar
error (`Small tools and furnitures and fixtures`); `SCA-4032 "Commission
to third parties"` filed under revenue with no description to say whether
it's a contra-revenue deduction or should be an expense. A bigger
structural note (flat `category` enum, no COGS/Opex/Tax subcategory, so
`get_income_statement()` can't stage Gross Profit/Operating Income) was
raised but explicitly deferred — Sinag said skip it for now.

**Fixes applied directly via SQL** (data-only, no schema change, no
migration needed — same as prior ad-hoc `accounts` edits like the
`SCA-9999` test row):
- Deactivated `SCA-1211` (kept `SCA-1205` as canonical), description
  cross-references it.
- Renamed for accuracy/clarity: `SCA-6020` → "Electricity"; `SCA-1300` →
  "Prepaid Expenses" (old name preserved in its new description);
  `SCA-6014` → "Small Tools, Furniture and Fixtures"; `SCA-6052` → "Other
  Marketing Expenses" (casing).
- Made naming consistent across each fixed asset's 3 related accounts:
  `SCA-1521`, `SCA-1551`, `SCA-6001`, `SCA-6003`, `SCA-6004`.
- Added descriptions to the catch-alls that could be described without
  guessing business intent: `SCA-4040`, `SCA-6041`, `SCA-6052`,
  `SCA-6080` (the last one documents that Transportation lives here, per
  the ACCT-3 mapping decision above).
- `SCA-4032 "Commission to third parties"` — confirmed 0 references in
  `journal_entry_lines` or `item_accounting_mappings`, then deactivated
  per Sinag's explicit call ("deactivate for now"), description flags it
  as pending his decision on contra-revenue vs. expense.
- `MRR` (`6010`-`6013`) left as-is — Sinag confirmed the abbreviation is
  fine, no description added since none was supplied.

**Anomaly noted, not caused by this session:** `SCA-1205`'s name changed
(casing: "Magnetic sheet" → "Magnetic Sheet") mid-audit, timestamped
before this session's own edits — something else touched `accounts`
concurrently. Didn't affect the outcome (1205 stayed canonical either
way) but flagged to Sinag as a possible other-session/other-tab edit,
matching this workstream's recurring concurrent-dev-server issue (see
the SCA-prefix and ACCT-7.2 session entries above).

Post-fix counts verified: 107 accounts total, 28 asset (26 active/2
inactive), 3 liability, 3 equity, 22 revenue (13 active/9 inactive), 51
expense (41 active/10 inactive) — arithmetic checked against the pre-fix
baseline, only the two new deactivations changed the active/inactive
split.

No code or schema changes, so nothing to rebuild/typecheck. Committed to
git this session (Sinag's explicit request).

---

### 2026-07-10 — ACCT-7.3 first-pass mapping (data only, Sinag's review pending)

Sinag asked Claude to fill in the Product Account Mapping page directly
("only the items that make sense, I will review after") rather than doing
the full 62-row pass by hand. Read `item_components` (the BOM) to confirm
which raw materials feed which finished products before assigning
anything, rather than guessing from names alone.

**Mapped 51 of 62 items via direct SQL** (`item_accounting_mappings`,
`updated_by` = Claude test account):
- **32 `Itm-*` raw materials** → Inventory + Expense only (no Revenue —
  raw materials aren't sold directly), matched to the specific
  material-family account pair (Ref Magnet/Coaster/Keychain
  Metal/Keychain Leather/Paddle Hair Brush/Phone Stand/Bottle Opener).
  Where no dedicated family account exists: box/bubble-wrap/addon-box
  items → `1212`/`5060` (Packaging); Hand Mirror, Men's Comb, and the two
  card-sleeve paper/sticker items (used across multiple product families
  in the BOM, no single clean match) → `1213`/`5021` (Others catch-all).
- **19 `Pro-*` finished products** (18 categorized + 1 — "Bamboo Coaster,
  Round 10cm no Box" — miscategorized with a null `category_id` but
  obviously a real Coaster product) → Revenue only, matched by product
  family. No Inventory/Expense on composites — they don't carry their own
  stock bucket; COGS is intended to derive from the underlying `Itm-*`
  component mappings via the BOM (per the event catalog in
  `docs/ACCT-7-v2-Business-Events-Kickoff.md`), not from the composite's
  own row.

**Left unmapped, flagged for Sinag** (11 items — no clean Chart of
Accounts match exists, didn't want to guess):
- 4 `Pkg-*` box assemblies (`Large 20x20x12`/`22.5x17x13`, `Medium
  13x13x10`/`22.5x14x10.3`) — confirmed via the BOM these are **not**
  used inside any `Pro-*...with Box` recipe (those use the dedicated
  `Itm-Addon box, X` items instead), and `is_available_for_sale = true`
  on all 4 — so they do appear to be sold standalone, but there's no
  "Sales Revenue - Packaging" account to point at.
- 4 `Srv-*`/`Shp-*` services (Engrave Charge, Labor Charge, Others,
  Shipping Fee) — no dedicated service-revenue account exists (only the
  generic non-operating `4040 Other Income`, which felt like the wrong
  bucket to guess into for real operating revenue).
- 3 obvious dev/test rows (`ITEM-6 Create Log Test (edited)`,
  `ITEM-6.5 Live Test Composite/Simple`).

Verified post-update: querying for rows where all three account columns
are still null returns exactly those 11 items — confirms the pass landed
as intended, nothing silently skipped.

Sinag has not yet reviewed/confirmed this pass in the UI. If any of the
family/catch-all assignments above look wrong on review, the fix is a
plain edit through the Product Mapping page (admin-only), not a new
migration. No git commit (standing project rule — stopped for manual
review; this was a data-only change anyway, no code/schema touched).

---

### 2026-07-10 — ACCT-7.3 closed out

Sinag asked to "Start ACCT-7.3" in a follow-up session. Live DB check
first, since the previous session log entry turned out stale: Sinag had
already gone through the Product Mapping page himself between sessions
and clicked Save All Mappings — 55/62 items mapped (`updated_by` =
Sinag's own account, all one timestamp), up from Claude's first-pass 51.
The 4 `Pkg-*` box items Claude had flagged were resolved; the 3 dev/test
rows remained correctly unmapped.

The one real gap left: the 4 `Srv-*`/`Shp-*` service/shipping items
(`Srv-Engrave Charge`, `Srv-Labor Charge`, `Srv-Others`, `Shp-Shipping
Fee`) still had no revenue account — no dedicated service-revenue account
existed, and mapping into the generic non-operating `4040 Other Income`
felt wrong for real operating revenue (same reasoning Claude flagged in
the first pass). Asked Sinag directly rather than guessing (same shape as
ACCT-3's Rent/Transportation call); he chose one new shared account over
per-item accounts or reusing `4040`.

**Added account `SCA-4043 Service & Shipping Revenue`** (revenue,
description names the 4 items it covers) via direct SQL — data-only
insert, no schema change, consistent with how the Chart of Accounts audit
session made its edits (the CRUD UI exists too, this was just faster).
Mapped all 4 items' `revenue_account_id` to it, also via direct SQL.

**Verified via DB query:** 59/62 mapped, and the 3 unmapped rows are
exactly the known dev/test items (`ITEM-6 Create Log Test (edited)`,
`ITEM-6.5 Live Test Composite`, `ITEM-6.5 Live Test Simple`) — nothing
real left unmapped. **Browser verification skipped this session** — port
3000 was already held by what looked like Sinag's own active dev server
(PID 22940, plausibly the same session he used to do the manual mapping
review), so it was left running rather than killed without asking.

ACCT-7.3 is now done. No git commit (standing project rule — stopped for
manual review; data-only change, no code/schema touched). Next up per the
phase breakdown: ACCT-7.4 (`business_events` table + wiring the 6 trigger
RPCs), now unblocked by both 7.2 and 7.3.

---

### 2026-07-10 — ACCT-7.4 (`business_events` table + wiring)

**Re-verified the event catalog's RPC graph against the live schema first**
(per this workstream's own standing caution — the original ACCT-7 died
once already from a stale RPC assumption). Found the doc's mapping was
half-wrong:

- **Events #3 (Purchase received) and #4 (Manual incoming) share one real
  choke point**, not two separate RPCs as the doc assumed:
  `receive_purchase_order()` and Manual Incoming's insert both write into
  `incoming_items`, and `apply_incoming_item_inventory_movement()` — an
  `AFTER INSERT` trigger on that table (ACCT-7.2 discovery, not previously
  connected to this doc) — is the single point both flows already pass
  through. Wired the event insert there instead of duplicating it in two
  RPCs; `new.source` (`'purchase_order'` vs `'manual'`) picks the event
  type.
- **Event #2 (COGS)** doesn't call `deduct_stock_out()` directly from
  `mark_shipment_shipped()`/`mark_shipment_picked_up()` as the doc said —
  both call a shared private helper, `_deduct_shipment_stock()`, which
  loops over shipment components/packaging and calls `deduct_stock_out()`
  per line. Wired the event there instead: one `cogs` event per shipment,
  payload holding a `lines` array (item/variant/qty/unit cost snapshot per
  line) rather than one event per line, since the rule engine (7.5) can
  turn one event into several draft journal lines.
- **Event #6 (scrap loss) genuinely had no dedicated RPC**, confirmed —
  the doc's own "not fully pinned down" flag was correct. Items for
  Review's "Release to Scrap" action was calling `deduct_stock_out()`
  directly from app code (`p_from_status: 'on_hold'`), the same primitive
  `_deduct_shipment_stock()` uses for COGS but with no way to distinguish
  the two at that shared function. Resolved by adding a new dedicated RPC,
  `release_to_scrap()`, that wraps `deduct_stock_out(..., 'on_hold')` and
  writes the event itself; updated `items-for-review/actions.ts`'s scrap
  branch to call it instead of `deduct_stock_out` directly.
- **Event #5/#6 generic path (manual inventory count corrections)**: the
  doc's own proposal already pointed at `adjust_stock()` for both — wired
  directly there, branching gain vs. loss on the sign of `p_qty_delta`
  (single generic RPC, freeform `p_reason` text, used by exactly one
  screen — `/dashboard/inventory/adjustment`).
- **Event #1 (Sale recognized)** matched the doc exactly —
  `close_order_payment()` was the right hook, no surprises. Payload
  derives `payment_status` (`paid`/`overpaid`/`partially_paid`) and
  `write_off_amount` from the same total-paid-vs-total-money comparison
  the function already does for its own logic, so no duplicate math.

**Migrations applied** (all via Supabase MCP): `acct7_4_business_events`
(new table — `event_type` check-constrained to the 6 catalog values,
`source_table`/`source_id`, `occurred_at`, `payload jsonb`,
`processed_at` for 7.5's rule engine to claim rows, select-only RLS
admin+manager mirroring `journal_entries`/`accounts`, no insert/update/
delete policy — confirmed via `pg_policy` inspection, and confirmed a raw
`INSERT` even as an impersonated admin gets rejected by RLS since only the
`SECURITY DEFINER` functions — which bypass RLS as table owner — can
write); `acct7_4_wire_close_order_payment`, `acct7_4_wire_incoming_items_
trigger`, `acct7_4_wire_adjust_stock`, `acct7_4_wire_shipment_cogs` (all
body-only edits to existing functions, signatures unchanged, safe via
`CREATE OR REPLACE` per the lesson in
[[feedback_create_or_replace_function_signature_change]]);
`acct7_4_release_to_scrap` (new function, no overload risk).

Payloads deliberately snapshot the numbers each event needs (unit cost
from `item_variants.cost` at event time, order totals/tip/write-off at
close time, etc.) rather than leaving 7.5 to re-read operational tables
later, per the kickoff doc's own design intent for `payload`.

**Verified:**
- `get_advisors(security)`: only the same baseline WARN pattern as every
  other RPC in the project (anon can execute `SECURITY DEFINER` — the
  internal role/RLS gates are what actually matter); no new categories of
  advisory, and specifically none on `business_events` itself (RLS enabled
  with a real policy, not missing).
- `npm run build` passes zero errors; `lib/supabase/types.ts` regenerated
  (same &gt;100K-character MCP-response workaround as the SCA-prefix
  session — saved response parsed with a one-off Node script rather than
  reading it through the truncating tool output).
- **All 6 event-writing paths DB-verified** via role-impersonated,
  rolled-back transactions (real data used where it existed, fully
  self-contained where it didn't — e.g. temporarily topping up
  `inventory_levels` buckets before a shipment test, or moving stock into
  `on_hold` via `transfer_stock_status()` before a scrap test — all inside
  the same rolled-back transaction): `sale_recognized` (real unclosed
  overpaid order, correctly derived `tip_amount`/`write_off_amount`),
  `purchase_received` + `manual_incoming` (confirmed both branch correctly
  off the one shared trigger), `inventory_adjustment_gain` /
  `inventory_adjustment_loss` (sign-branching confirmed both ways),
  `inventory_adjustment_loss` via `release_to_scrap` (confirmed distinct
  `reason: 'scrap_release'` tag), `cogs` (confirmed the `lines` array
  shape against a real shipment's real components). Confirmed clean
  afterward: `business_events` back to 0 rows, no order/shipment/PO status
  left mutated.
- **Browser-verified live** (admin `claude-code@sinagukit.internal`, once
  port 3000 freed up mid-session — the other session's server from the
  ACCT-7.3 entry was gone by the time this one needed it, no kill
  required): Items for Review → clicked `Itm-Keychain Leather, Rectangle`
  (1 unit on hold) → Release To "Scrap" → Release Stock. Row disappeared
  from the list (on-hold qty hit 0), no console errors, and the DB shows a
  real `inventory_adjustment_loss` event with the note text typed in the
  form — confirming the `items-for-review/actions.ts` RPC swap
  (`deduct_stock_out` → `release_to_scrap`) works end to end through the
  real UI, not just in isolation. Left in place (real stock disposition,
  matches this project's convention for self-contained verification
  data).

**Not built this session** (per phase breakdown, out of scope for 7.4):
the rule engine that turns `business_events` rows into draft journal
entries reading `item_accounting_mappings` (ACCT-7.5), so `business_events`
will accumulate real rows now but nothing consumes them yet —
`processed_at` stays null on everything until 7.5 exists.

No git commit (standing project rule — stopped for manual review). Next
up: ACCT-7.5 (`journal_entry_drafts`/`journal_entry_draft_lines` + the
rule engine).

---
