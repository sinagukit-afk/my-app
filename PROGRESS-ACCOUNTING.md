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
core ERP `PROGRESS.md` so phase numbers don't collide between the two build
threads.

Migration files share one global sequence with core ERP migrations
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
| ACCT-7 | Event-driven auto-posting (rewritten — see `docs/ACCT-7-v2-Business-Events-Kickoff.md`) | Done, extended | `acct7_reseed_chart_of_accounts`, `acct7_item_accounting_mappings`, `acct7_2_incoming_items_payment_method`, `acct7_4_business_events`, `acct7_4_wire_close_order_payment`, `acct7_4_wire_incoming_items_trigger`, `acct7_4_wire_adjust_stock`, `acct7_4_release_to_scrap`, `acct7_4_wire_shipment_cogs`, `acct7_5_payment_type_accounting_mappings`, `acct7_5_enrich_close_order_payment_payload`, `acct7_5_journal_entry_drafts`, `acct7_5_generate_draft_journal_entries`, `acct7_5_wire_business_events_trigger`, `acct7_5_revoke_public_execute_drafts_trigger`, `acct7_6_draft_review_rpcs`, `acct7_6_extend_journal_entries_source_type_check`, `acct7_6_restore_approve_and_post_final`, `acct7_7_reverse_journal_entry`, `acct7_8_credit_card_installment_payments`, `acct7_8_widen_business_events_event_type_check`, `acct7_8_widen_journal_entries_source_type_check`, `finpur_7_widen_event_type_checks`, `finpur_8_expense_asset_po_rpcs`, `finpur_11_rule_engine_expense_asset_events` | Original scope assumed `confirm_order()`, retired by D027 — full rescope done 2026-07-10, split into ACCT-7.1..7.8, **all 8 sub-phases done same day**; **7.9 added 2026-07-11** (Finance & Purchasing restructure, D044) with 4 more event types (`expense_recorded`/`asset_acquired`/`expense_payment`/`asset_payment`, all posting through `SCA-2000 Accounts payable`) and the new Category Mapping page — see session log. 7.1 done (COA re-seeded + admin-only edit UI); 7.2 done (Purchasing payment-method capture); 7.3 done (Sinag reviewed Claude's first pass + mapped the 4 `Pkg-*` items himself; last gap — 4 `Srv-*`/`Shp-*` service items — closed by adding `SCA-4043 Service & Shipping Revenue`, 59/62 mapped, 3 intentionally-unmapped dev/test rows remain); 7.4 done (`business_events` table + all 6 trigger RPCs wired — see session log for the RPC-graph corrections found along the way); 7.5 done (`journal_entry_drafts`/`journal_entry_draft_lines` + `generate_draft_journal_entries()` rule engine, auto-fired via `AFTER INSERT` trigger on `business_events` — see session log); 7.6 done (`/dashboard/accounting/review` Review & Approve/Post UI + 3 RPCs, browser-verified with a real post and a real reject); 7.7 done (`reverse_journal_entry()` RPC + Reverse Entry action on the journal detail page, browser-verified with a real reversal); 7.8 done (`log_credit_card_installment_payment()` + `/dashboard/accounting/credit-card-payable`, browser-verified end-to-end with a real credit-card purchase paid down by a real installment); 7.9 done (see above) |

> **Migration renumber (2026-07-02, ACCT-3):** ACCT-3 wasn't originally assigned a migration, but the Rent/Transportation decision added account `6015 Rent Expense`, which needed one. Created during ACCT-3 (chronologically before ACCT-4..7, none of which exist yet), it correctly takes the next free label `0015` — so the reserved labels for ACCT-4 (`0015→0016`), ACCT-5 (`0016→0017`), ACCT-6 (`0017→0018`), and ACCT-7 (`0018→0019`) each shift up by one, preserving the "lower label = created earlier" invariant the earlier amendments established.
| ACCT-8 | BIR tax estimate calculator | Not started | — | Lowest priority, optional |
| ACCT-9 | Module restructure — COA hierarchy, Financial Settings nav, mapping generalization, foundation-only Taxes | **All 7 sub-phases done** | `acct9_1_chart_of_accounts_hierarchy`, `acct9_3_system_account_mappings`, `acct9_4_bank_accounts`, `acct9_5_sales_purchase_inventory_mapping`, `acct9_6_taxes_foundation`, `acct9_7_hierarchical_reports`, `acct9_7_hierarchical_reports_own_vs_rollup`, `acct9_7_revoke_anon_execute` | Kickoff plan (assessment + 7 sub-phases) in the 2026-07-15 session log entry below. **9.6 was done by a concurrent session** (not this workstream's own doc — see the ACCT-9.7 session log entry's note on discovering it) while 9.7 was being worked in this session; no schema conflict between the two (9.6 touched `system_account_mappings`/`close_order_payment`/`generate_draft_journal_entries`, 9.7 touched only the report RPCs). |
| SP | Supplier Payment — rename `Payments` → `Customer Payment`; new `Supplier Payment` covering Inventory PO, Expense PO, Asset PO, Manual Incoming (+ Direct Expense, per Sinag) | **All 8 sub-phases done** | `finpur_13_supplier_payment_schema`, `finpur_14_supplier_payment_rpcs` | Full kickoff plan + Sinag's 3 decisions in the first 2026-07-16 session log entry below; SP-5..SP-8 (Fixed Assets payment UI, Inventory/Manual payable detail page, unified Supplier Payment list + nav, end-to-end verification) in the second. Also fixed a pre-existing gap found along the way: `log_payable_payment('asset', ...)` had no status-recompute branch at all before this session. |

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

**Bug found by Sinag in that other session's live browser, fixed same session:** the initial `page.tsx` defined the `DataTable` `columns` array (with `render` functions for date/currency/badge formatting) inline inside the server component and passed it as a prop to the client `DataTable` — Next.js threw "Functions cannot be passed directly to Client Components." `npm run build`'s type-check did not catch this; it's a runtime-only RSC boundary violation. The rest of the Accounting module already had the correct pattern (`journal-table.tsx`, `trial-balance-table.tsx` — `"use client"` wrapper components that own `columns` internally and take only a plain `data` prop) but it wasn't followed here. Fixed by extracting `fixed-assets-table.tsx` as a `"use client"` component following that exact pattern; `page.tsx` now only fetches/shapes data and passes `rows` down. Rebuilt clean after the fix. Saved as a standing memory (`feedback_datatable_columns_client_boundary`) so future Accounting/ERP pages don't repeat it. Sinag has not yet re-confirmed the fix in-browser as of this log entry.

No git commit (standing project rule — stopped at DoD for manual review). Next: the doc's "Final check after ACCT-5" balance query was run directly (0 rows, `difference` trivially null/0) — ledger is clean, ready for ACCT-6 (Historical Import) whenever Sinag wants to proceed; ACCT-7 remains gated on core ERP order/PO stabilization.

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

No git commit (standing project rule — stopped at DoD for manual review). ACCT-7 remains gated on core ERP order/PO stabilization; ACCT-8 (BIR tax estimate) not started.

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

### 2026-07-10 — ACCT-7.5 (`journal_entry_drafts` + rule engine)

**Real design gap found before writing any code:** the kickoff doc's event
catalog says event #1 posts `Cr Sales Revenue [order total]` as one lump
line, but the real Chart of Accounts has no single generic "Sales Revenue"
account — only 7 distinct per-product-line ones (`SCA-4001`..`4020`, plus
`4043` for services), which is exactly the granularity Sinag confirmed by
hand in the ACCT-7.3 mapping pass. The catalog phrasing predates that
mapping table's real shape. Resolved by splitting `sale_recognized`
revenue per order line (same pattern COGS already uses), which required
going back into `close_order_payment()` (shipped in 7.4) and enriching its
event payload — safe, since zero real `sale_recognized` rows existed yet.
Second gap: no field anywhere recorded which Chart-of-Accounts asset
account (`Cash on hand` vs `Bank Account`) a given payment method actually
settles to. Asked Sinag directly (same pattern as the ACCT-3 Rent/
Transportation and ACCT-7.3 Service&Shipping confirms) — decision: **Cash
→ Cash on hand; BDO/BPI/Gcash/Maribank/Other → Bank Account** (all
electronic/e-wallet payments treated as bank funds).

**Built:**
- `payment_type_accounting_mappings` (new table, one row per
  `payment_types` row → asset `account_id`). RLS mirrors
  `item_accounting_mappings` (select admin+manager, insert/update
  admin-only). Seeded with Sinag's confirmed mapping above. Used by both
  the sale (`sale_recognized`) and purchase (`purchase_received`/
  `manual_incoming`, non-credit-card branch) draft rules.
- `close_order_payment()` re-`CREATE OR REPLACE`d, same signature — added
  `lines` (per order-item revenue breakdown: `item_id`, `quantity`,
  `unit_price`, `line_discount`, `modifier_total` from
  `order_item_modifiers`, `line_total`) and `payments` (order_payments
  grouped by `payment_type_id`) to the `sale_recognized` payload. Keeps
  the event payload fully self-contained per the kickoff doc's own
  "accounting never re-reads live operational tables" principle, instead
  of having the rule engine join back to `order_items`/`order_payments`
  live.
- `journal_entry_drafts` / `journal_entry_draft_lines` — mutable staging
  tables mirroring `journal_entries`/`journal_entry_lines`, plus `status`
  (`pending_review`/`posted`/`rejected`, default `pending_review`),
  `source_event_id` (unique FK → `business_events`), `posted_journal_
  entry_id` (nullable, for ACCT-7.6 to fill in later), `reviewed_by`/
  `reviewed_at`. RLS: select-only admin+manager, zero insert/update/delete
  policies — same "writes only through a `SECURITY DEFINER` RPC"
  convention as `journal_entries` itself. No edit RPC yet (that's 7.6's
  Review UI); 7.5 only ever inserts.
- `generate_draft_journal_entries()` — the rule engine. Scans
  `business_events where processed_at is null for update skip locked`,
  branches per `event_type`, resolves accounts via
  `item_accounting_mappings`/`payment_type_accounting_mappings`, and
  writes balanced draft lines (deduped/summed by account — e.g. multiple
  COGS component lines mapping to the same Inventory/Expense pair collapse
  into one draft line each, not one row per component). **If any line's
  item/payment-type has no mapped account, the whole event is skipped
  (left with `processed_at = null`, no draft created)** — never guesses an
  account for real money; it just waits until the mapping gets filled in,
  same conservative instinct as ACCT-3/7.3's "confirm with Sinag, don't
  guess" pattern. Revenue-line allocation for `sale_recognized` is
  proportional-by-line-total with the **last line absorbing the rounding
  remainder**, guaranteeing the credit side always sums to `total_money`
  to the centavo. Two payload key-naming inconsistencies from 7.4 handled
  defensively rather than re-touched: `adjust_stock`'s gain/loss events use
  `qty_delta` (signed), `release_to_scrap`'s loss events use `quantity`
  (unsigned) — the engine does `abs(coalesce(qty_delta, quantity))` rather
  than normalizing the two already-shipped RPCs.
- **No role check inside `generate_draft_journal_entries()`** — deliberate.
  It runs automatically via an `AFTER INSERT ... FOR EACH STATEMENT`
  trigger on `business_events`, inside whatever transaction the
  *originating* RPC opened (`adjust_stock`, `close_order_payment`, etc.),
  which can legitimately be an **encoder** for several of the 6 event
  paths. An internal `admin`/`manager`-only gate here would have aborted
  the encoder's entire underlying transaction (e.g. their stock
  adjustment) purely because the accounting side-effect re-checked a role
  the outer RPC already cleared — same reasoning as why
  `_deduct_shipment_stock()` doesn't re-check role either. Locked down the
  other way instead: `REVOKE EXECUTE ... FROM public, anon, authenticated`
  / `GRANT ... TO postgres, service_role` on both
  `generate_draft_journal_entries()` and the trigger shim
  `_business_events_generate_drafts_trigger()`, so neither is reachable as
  a public RPC — only the trigger (and direct DB access) can invoke them.
  `get_advisors(security)` flagged the trigger shim as anon/authenticated-
  reachable before this revoke (a real, fixed finding, not the usual
  baseline noise); re-ran clean after.

**Verified — all rolled back or self-contained, nothing left mutated
beyond the one real backfill below:**
- Synthetic multi-branch test (role-impersonated as admin, one
  transaction, `ROLLBACK` at the end): 9 events covering `sale_recognized`
  paid/overpaid/partially_paid, `cogs` (2 components → 1 deduped account
  pair), `purchase_received` (credit card branch → `SCA-2020`),
  `manual_incoming` (bank branch), `inventory_adjustment_gain`/`loss`
  (both `qty_delta` and `quantity` payload shapes), and one deliberately
  **unmapped** item — every resulting draft's debits equaled its credits
  exactly, and the unmapped-item event correctly produced no draft at all.
- Trigger-wiring check (role-impersonated as the real **encoder** test
  account, rolled back): called `adjust_stock()` directly — no
  authorization error, and the resulting `inventory_adjustment_gain`
  event came back `processed_at`-set with a matching balanced draft
  already attached, confirming the no-role-check design actually works
  for a non-admin caller.
- Real end-to-end check against a genuine unclosed order
  (`SOD26-0709-0026`, admin-impersonated, rolled back): inserted a real
  `order_payments` row, called the real `close_order_payment()` RPC (not
  a synthetic event) — produced `Dr Cash on hand 714.00 / Cr Sales
  Revenue - Coaster 714.00`, correctly resolving the order's one mapped
  line item.
- **Real backfill, not rolled back:** ran `generate_draft_journal_entries()`
  for real once, which picked up the one pre-existing unprocessed
  `inventory_adjustment_loss` event left over from the ACCT-7.4 session
  (`Itm-Keychain Leather, Rectangle` scrap release) — produced `Dr
  Inventory Shrinkage/Scrap Expense 18.50 / Cr Inventory - Keychain with
  Leather 18.50`, now sitting in `journal_entry_drafts` as the first real
  draft in the system.
- `get_advisors(security)`: clean after the trigger-shim revoke fix above;
  no other new findings on any of the new tables/functions.

**Not built this session** (per phase breakdown, out of scope for 7.5):
any UI. Drafts are backend-only — nothing renders `journal_entry_drafts`
yet, and nothing can promote a draft into a real posted `journal_entries`
row (`post_journal_entry()` is untouched). That's ACCT-7.6.

No git commit (standing project rule — stopped for manual review). Next
up: ACCT-7.6 (Review & Approve/Post UI, admin/manager, + the RPC that
promotes a draft into `post_journal_entry()`).

---

### 2026-07-10 — ACCT-7.6 (Review & Approve/Post UI)

**Built:**
- 3 new RPCs, all `SECURITY DEFINER`, admin/manager-only, all requiring the
  target draft's `status = 'pending_review'` (raise otherwise): `update_
  journal_entry_draft(p_draft_id, p_description, p_lines)` (re-validates
  balance/line-count/account-existence exactly like `post_journal_entry()`,
  delete-and-reinsert on `journal_entry_draft_lines`); `approve_and_post_
  journal_entry_draft(p_draft_id)` (builds the lines array from the
  draft's current lines, calls the **existing** `post_journal_entry()`
  rather than duplicating its validation, passes the draft's `event_type`
  as `p_source_type` and `source_event_id` as `p_source_id` for full
  traceability back to the originating `business_events` row, then marks
  the draft `posted` + links `posted_journal_entry_id`); `reject_journal_
  entry_draft(p_draft_id, p_reason)` (marks `rejected`, stores the reason
  in a new nullable `review_note` column).
- `journal_entries.source_type` had a `CHECK` constraint hardcoded to the
  5 pre-existing values (`manual`/`order`/`purchase_order`/`depreciation`/
  `opening_balance`) — extended it to include the 6 new event types, since
  `post_journal_entry()` was rejecting every approve attempt otherwise.
  Purely additive (widens the allowed set).
- `/dashboard/accounting/review` — list page + `review-table.tsx`
  (Date/Description/Event Type badge/Amount/Status badge columns, same
  `DataTable` as Journal) and `/dashboard/accounting/review/[id]` — detail
  page that renders **editable** line rows (same UX as `NewJournalForm`:
  account picker + debit/credit + memo, add/remove rows, live balance
  check) when `status = 'pending_review'`, or a **read-only** static table
  (same shape as the Journal detail page) once `posted`/`rejected`. Three
  actions on the editable view: Save Changes, Approve & Post, Reject — the
  latter two open a `Dialog` confirmation (not a native `confirm()` — see
  bug note below). New nav item `Review` added to the Accounting
  `NavGroup` in `app-shell.tsx`, between Chart of Accounts and Journal.
  Extended the Journal list/detail pages' `SOURCE_LABELS` maps with the 6
  new event types so posted entries from this pipeline display a friendly
  badge instead of a raw enum string.

**Two real bugs found and fixed while building this:**
1. `journal_entry_drafts.reviewed_by references auth.users(id)` (copied
   from the `updated_by` pattern on `item_accounting_mappings`/`payment_
   type_accounting_mappings`) — not `public.profiles(id)`. The detail
   page's `.select("...reviewer:profiles(full_name)...")` silently failed
   (no FK for PostgREST to embed on) and the query's `error` was never
   checked, so `!draft` fired `notFound()` on every single draft — the
   route 404'd for real despite the server access log showing `200`.
   Fixed by dropping the embed and doing a plain second query keyed off
   `reviewed_by` when it's set, and by actually checking `error` this
   time.
2. **Not a real bug, but ate a lot of debugging time**: testing `approve_
   and_post_journal_entry_draft()` via `SELECT (fn()).*` in raw SQL made
   it look like the function was broken — it kept raising "already
   posted" against a draft that a plain `SELECT` proved was still
   `pending_review`. Root cause: `(fn()).*` on a **volatile**,
   composite-returning function is a documented Postgres gotcha — Postgres
   can invoke the function once per output column instead of once, so a
   7-column return type meant the function ran ~7 times in one statement,
   and the 2nd+ call legitimately saw the 1st call's own write. Fixed the
   *tests* (`SELECT * FROM fn(...)` instead), not the function — real app
   code calls RPCs once via `supabase.rpc()`, so this was never reachable
   from the UI. Worth remembering for any future single-call verification
   of a volatile RPC that returns a composite type.

**Also swapped a native `window.confirm()` for a `Dialog`** on the Approve
& Post button after it hung the browser-preview tooling completely
(blocking native dialogs aren't visible to screenshots and have no
programmatic dismiss in the available tools) — better UX consistency with
the rest of the app anyway (Reject already used a `Dialog`), not just a
workaround.

**Verified — real browser session, admin test account, both real
outcomes left in place (not rolled back):**
- Approved and posted the one real draft from 7.5 (`Itm-Keychain Leather,
  Rectangle` scrap loss) end-to-end through the actual UI — landed on the
  new Journal Entry detail page showing the correct balanced lines, and
  confirmed it now shows `Posted` back on the Review list and appears
  correctly labeled ("Inventory Adjustment (Loss)") on the Journal list.
  **This is the first entry ever posted through the new auto-posting
  pipeline**, not manually via `post_journal_entry()`.
- Inserted a second synthetic `inventory_adjustment_gain` event directly
  (to get a fresh `pending_review` draft since the only real one was now
  posted), confirmed the trigger auto-drafted it immediately, then
  rejected it through the real UI with a reason — confirmed `Rejected`
  status and the stored reason.
- One real mistake mid-session: a generic `button[data-testid="sign-out-
  button"]` habit accidentally hit the real Sign Out button — exactly the
  documented pitfall this project already has a memory note about (never
  target Sign Out generically). Re-logged in with no other consequence.

No git commit (standing project rule — stopped for manual review). Next
up: ACCT-7.7 (`reverse_journal_entry()` RPC + UI action on the journal
detail page) or ACCT-7.8 (credit card installment event).

---

### 2026-07-11 — ACCT-7.7 (`reverse_journal_entry()` RPC + UI)

Built the reversal mechanism the design doc's decision 11 called for
(never edit/delete a posted entry, always reverse). One migration,
`acct7_7_reverse_journal_entry`:

- Widened `journal_entries_source_type_check` to add `'reversal'` (same
  pattern as the 7.6 widen for draft-sourced event types).
- New RPC `reverse_journal_entry(p_entry_id uuid, p_reason text)` —
  admin/manager only (matches `post_journal_entry()`'s tier), requires a
  non-blank reason, locks the original row (`for update`), rejects if the
  entry has already been reversed (checked via an existing `source_type =
  'reversal' and source_id = p_entry_id` row — one reversal per entry).
  Builds the mirror line set (debit/credit swapped per line, same
  accounts) and posts it through the **existing** `post_journal_entry()`
  rather than duplicating its balance/account validation — same reuse
  pattern `approve_and_post_journal_entry_draft()` established in 7.6.
  The reversal posts at `current_date`, not backdated to the original
  entry's date, so prior-period reports stay untouched (standard
  reversing-entry practice). Reversing a reversal entry is intentionally
  still allowed (only the *target* id is checked, not the source entry's
  own `source_type`) — needed to undo a mistaken reversal without a
  special case.

UI: `/dashboard/accounting/journal/[id]` gained a "Reverse Entry" button
(admin/manager, hidden once the entry has already been reversed) opening
a `Dialog` with a required reason `TextArea` — mirrors the Reject dialog
pattern from 7.6, not a native `confirm()`. The detail page now also
shows a "Reverses →" link (on a reversal entry, back to the original) and
a "Reversed by →" link (on an original entry, forward to its reversal).
Added `reversal: "Reversal"` to both journal pages' `SOURCE_LABELS` maps.

**Verified — real browser session, admin test account, real reversal left
in place (not rolled back):** reversed the one real posted entry in the
system (the 7.6 scrap-loss entry) with a reason, confirmed the new
reversal entry shows swapped debit/credit lines that still balance
(₱18.50/₱18.50), the "Reverses →" link back to the original, and correct
labeling on the Journal list. Confirmed the original entry now shows
"Reversed by →" and no longer offers a Reverse Entry button. Also
DB-verified (rolled-back impersonated transactions) before touching the
UI: blank-reason rejection, double-reversal rejection, and encoder-role
rejection all raise the expected `plpgsql` exceptions. `get_advisors
(security)` flagged `reverse_journal_entry` as anon/authenticated
`EXECUTE`-able — confirmed this is the same pre-existing pattern as
`post_journal_entry`/`approve_and_post_journal_entry_draft` (internal
role check gates it, not a `REVOKE`), not a new gap.

No git commit yet (standing project rule — stopped for manual review).
Next up: ACCT-7.8 (Credit Card Payable installment event/RPC) — the last
sub-phase in the ACCT-7 rewrite.

---

### 2026-07-11 — ACCT-7.8 (Credit Card Payable installment event/RPC) — ACCT-7 complete

Closed out the last sub-phase of the ACCT-7 rewrite. New table
`credit_card_installment_payments` (one row per real payment — not an
amortization schedule, the design doc explicitly ruled that out; select-only
RLS admin+manager, writes only via RPC, same convention as `business_events`/
`journal_entry_drafts`). New RPC `log_credit_card_installment_payment(
p_payment_type_id, p_principal_amount, p_interest_amount, p_paid_date,
p_notes)` — admin/manager only, validates principal > 0, interest >= 0, a
real payment type, and that principal doesn't exceed the outstanding
`SCA-2020` balance computed live from **posted** `journal_entry_lines`
(pending drafts don't count). Writes its own audit row, then a
`business_events` row (`credit_card_installment_payment`) for the rule
engine to pick up. Extended `generate_draft_journal_entries()` with event
#7's rule: `Dr Credit Card Payable [principal] + Dr Credit Card Interest
Expense [interest, if any] / Cr Cash/Bank [principal + interest]`, resolved
via the existing `payment_type_accounting_mappings` table (same Cash→Cash on
hand / else→Bank Account mapping from 7.5). New page
`/dashboard/accounting/credit-card-payable` (outstanding-balance stat card +
Log Payment dialog + payment history table, modeled on the Fixed Assets /
Run Depreciation Dialog pattern), new nav link between Product Mapping and
Fixed Assets.

**Two real check-constraint gaps found and fixed, both the same class of
mistake:** `business_events.event_type` and `journal_entries.source_type`
both have `CHECK` constraints enumerating known values — missed on the
first migration attempt (rolled-back SQL testing caught the `business_events`
one before it hit the UI; the `journal_entries` one only surfaced when
actually clicking Approve & Post in the browser, which hit a real native
`alert()` that blocked the browser-preview tooling until dismissed with a
keyboard Enter — screenshotting it directly was what caught the bug, get_
page_text alone didn't surface it). Both fixed with a widening migration
each (`acct7_8_widen_business_events_event_type_check`,
`acct7_8_widen_journal_entries_source_type_check`). Lesson for any future
event type: grep for **both** check constraints, not just one — 7.6 already
widened `journal_entries_source_type_check` once for the draft-sourced event
types, so it's an easy one to remember but still missed on the newer
`business_events` one this time.

**Verified — real browser session, admin test account, both real
transactions left in place (not rolled back):** logged a real ₱200
credit-card manual-incoming purchase (`Itm-Addon Box, Bottle opener`, Gcash
+ credit card), approved its auto-drafted entry (`Dr SCA-1212 Inventory-
Packaging 200 / Cr SCA-2020 Credit Card Payable 200`) — first real balance
ever on the Credit Card Payable account. Logged a real ₱120 principal + ₱5
interest installment payment via BDO, approved its auto-drafted entry (`Dr
SCA-2020 120 + Dr SCA-6092 Interest 5 / Cr SCA-1020 Bank Account 125`).
Confirmed the Credit Card Payable page's outstanding balance tracked
correctly at every step: ₱0 → ₱200 (after purchase posted) → ₱80 (after
payment posted, `200 - 120`). Also DB-verified in rolled-back impersonated
transactions before touching the UI: blank/zero principal, negative
interest, unknown payment type, principal exceeding outstanding balance
(₱0 at the time), and encoder-role all correctly rejected with the
expected `plpgsql` exceptions.

**ACCT-7 is now fully complete — all 8 sub-phases done.** Only ACCT-8 (BIR
tax estimate calculator, lowest priority, untouched by this rewrite) remains
open in the Accounting module.

No git commit yet (standing project rule — stopped for manual review).

---

### 2026-07-11 — ACCT-7.9 (Expense/Asset events + Category Mapping)

Extends the ACCT-7 event pipeline for the Finance & Purchasing restructure
(`DECISIONS.md` D044, `PROGRESS-PURCHASING.md` PUR-1, `PROGRESS-FINANCE.md`
FIN-1) rather than forking a second posting mechanism — same
`business_events` → `generate_draft_journal_entries()` → `journal_entry_
drafts` → Review → `post_journal_entry()` pipeline ACCT-7.4/7.5/7.6 already
built.

**4 new event types**, widened onto the existing `business_events.event_type`
and `journal_entries.source_type` CHECK constraints (grep for **both**, per
the standing lesson from ACCT-7.8's own near-miss): `expense_recorded`
(Direct Entry or Expense-PO receipt), `asset_acquired` (Asset-PO receipt),
`expense_payment`/`asset_payment` (settling a `payable_payments` row). All
four route through the existing `SCA-2000 Accounts payable` account —
already present in the seeded Chart of Accounts, no new account needed:

- `expense_recorded` → `Dr <category's default expense account> / Cr
  SCA-2000`, resolved via the new `expense_categories` table (same "skip if
  unmapped" conservative behavior as every other branch — never guesses).
- `asset_acquired` → `Dr <asset account, already resolved into the event
  payload at receiving time by `receive_asset_purchase_order()`> / Cr
  SCA-2000`.
- `expense_payment`/`asset_payment` → `Dr SCA-2000 / Cr <Cash/Bank via the
  existing `payment_type_accounting_mappings` table>` — same shape as
  ACCT-7.8's `credit_card_installment_payment` branch, just against a
  different payable.

**New `/dashboard/accounting/category-mapping` page** (admin-only edit,
admin/manager view — mirrors Product Mapping's pattern exactly): two
sections, Expense Categories (name → expense account) and Asset Categories
(name → asset/accum.-depreciation/depreciation-expense account triplet +
default useful-life-months), each with inline "Add Category" + "Save
Mappings." New nav item between Product Mapping and Credit Card Payable.

**Bug caught during this pass, not by `npm run build`:** the page's client
table component seeded `useState` from server props once and never resynced
— adding a new category via `router.refresh()` correctly refetched server
data but the already-mounted component kept its stale initial state, so the
new row silently didn't appear until a full reload. Fixed with a `useEffect`
resync. Full detail and the sibling latent instance in `product-mapping-
table.tsx` are in `PROGRESS-FINANCE.md` FIN-1.

**Verified (browser preview, Claude admin test account, real entries left in
place per this project's standing convention):** mapped a real expense
category and a real asset category to real Chart-of-Accounts rows, then
drove a Direct Expense and a full Asset PO receipt through to a posted,
balanced Journal Entry each (`Dr <expense/asset account> / Cr SCA-2000`,
detail in PUR-1/FIN-1). DB-level role tests (rolled-back transactions,
admin + real encoder test account): `receive_expense_purchase_order`/
`receive_asset_purchase_order` allow encoder (matches Inventory PO's
existing receiving precedent); `record_direct_expense`/`update_direct_
expense`/`delete_expense`/`add_expense_attachment`/`log_payable_payment` all
correctly reject encoder ("Not authorized..."). `get_advisors(security)`
shows only the standard baseline WARN (anon/authenticated can execute
`SECURITY DEFINER` — internal role checks are the real gate), no new
categories of finding.

No git commit yet (standing project rule — stopped for manual review).

---

### 2026-07-15 — ACCT-9 kickoff (Module Restructure — plan only, no code)

Sinag brought a target IA for the Accounting module (Chart of Accounts /
Financial Settings [Bank Accounts, Payment Methods, Taxes, Product Account
Mapping, Expense Categories, Sales Mapping, Purchase Mapping, Inventory
Mapping] / Journal Entries / Trial Balance / Balance Sheet / Profit & Loss)
plus requirements: unlimited parent-child COA hierarchy with parent accounts
grouping-only and only leaves postable, every mapping FK'd to `accounts`
(never by name), Journal Entries auto-using those mappings, and readiness for
future payroll/fixed-assets/bank-reconciliation/multi-company/multi-currency
modules. This session assessed the live schema + code against that target
and produced a plan — **no migrations or code changes were made**, this is
design-only, same as ACCT-7's original kickoff pattern
(`docs/ACCT-7-v2-Business-Events-Kickoff.md`).

**Key findings (current state vs. target):**

- **`accounts` is completely flat today** — no `parent_account_id`, no
  postable/leaf concept, just a `category` text enum (asset/liability/equity/
  revenue/expense). 109 rows. Every report (`trial-balance`, `balance-sheet`,
  `income-statement`) groups by that flat `category` only — this is the
  single biggest structural gap vs. the hierarchy requirement.
- **The FK-mapping requirement is already violated in the live rule engine.**
  `generate_draft_journal_entries()` (built across ACCT-7.5–7.9) has 7 spots
  that resolve an account by hardcoded `account_number` string instead of a
  mapping row: `'SCA-4041'` (Tip Income), `'SCA-6090'` (Write-off Expense),
  `'SCA-2020'` (Credit Card Payable), `'SCA-6092'` (CC Interest Expense),
  `'SCA-4042'`/`'SCA-6091'` (Inventory Adjustment Gain/Loss), `'SCA-2000'`
  (used as both default Cash and Accounts Payable depending on branch —
  pre-existing naming quirk, not touched by this plan). Renumbering any of
  these accounts today would silently break posting.
- Mappings that **already exist and are FK-based** (keep as-is, just
  re-home in nav): `item_accounting_mappings` (Product Account Mapping,
  per-item revenue/inventory/expense — 100% manual per item today, 59/62
  items mapped), `payment_type_accounting_mappings` (Payment Methods),
  `expense_categories` + `asset_categories` (Expense Categories, feeds
  [[project_expense_treatment_engine]]).
- **Bank Accounts and Taxes don't exist as entities at all.** No
  `bank_accounts` table (Cash/Bank destinations only reachable today via
  `payment_type_accounting_mappings` straight to a GL account — no
  reconciliation-ready entity). No `tax_rates`/tax mapping — `orders/
  quotes/receipts.total_tax` is a raw numeric column that **isn't even
  posted separately today**: `sale_recognized`'s draft-generation branch
  never reads `total_tax` from the event payload, so tax collected is
  currently bundled into revenue-account credits rather than split into a
  tax-liability line. Real GL-correctness gap, not just a missing settings
  screen.
- Found a **pre-existing duplicate**: `/dashboard/finance/profit-loss`
  (legacy, computed from raw `orders` + a stale `expenses` table that's a
  different table from the one actually in use, `opex_expenses`) vs. the
  GL-correct `/dashboard/accounting/income-statement`. **Sinag's call:
  leave Finance's Profit & Loss untouched, add the new one in Accounting**
  (rename existing `income-statement` page's label to "Profit & Loss", no
  dedup of the Finance one for now).

**Decisions Sinag confirmed this session:**
1. Keep **both** `/dashboard/accounting/review` and `/dashboard/accounting/
   credit-card-payable` as their own top-level Accounting nav items (not
   folded into Journal Entries or Financial Settings) — Review just gets
   relabeled **"Pending Review."**
2. Taxes = **foundation-only** this round (rate/mapping config + correct GL
   posting of existing `total_tax`), not a full tax-calculation engine.
3. `/dashboard/finance/profit-loss` (legacy) stays untouched/unmerged; the
   new GL-correct Profit & Loss lives under Accounting only.
4. Renames confirmed: **Journal → Journal Entries**, **Income Statement →
   Profit & Loss**.

**Finalized target nav** (Accounting group in `app-shell.tsx`):

```
Accounting
├── Chart of Accounts
├── Financial Settings                 (new "subgroup" — same nav primitive already used for Management/Orders/Inventory under Operations)
│   ├── Bank Accounts
│   ├── Payment Methods
│   ├── Taxes
│   ├── Product Account Mapping
│   ├── Expense Categories
│   ├── Sales Mapping
│   ├── Purchase Mapping
│   └── Inventory Mapping
├── Pending Review                     (renamed from "Review")
├── Journal Entries                    (renamed from "Journal")
├── Credit Card Payable                (unchanged position)
├── Trial Balance
├── Balance Sheet
└── Profit & Loss                      (renamed from "Income Statement")
```

**Sub-phase breakdown (ACCT-9.1–9.7, no code yet):**

- **9.1 — COA hierarchy.** `accounts` gains `parent_account_id uuid
  references accounts(id)` and `is_postable boolean default true`
  (additive, all 109 existing rows stay leaf/postable — zero disruption).
  New triggers: reject journal-line inserts against a non-postable account;
  reject a child whose `category` mismatches its parent's; reject a
  `parent_account_id` that would create a cycle. `chart-of-accounts-table.tsx`
  becomes a tree (indent by depth, expand/collapse); `account-form.tsx` gains
  a Parent Account picker + an "Allow journal entries" toggle.
- **9.2 — Financial Settings shell + relocation.** New
  `/dashboard/accounting/financial-settings/` route group. Move
  `accounting/product-mapping` → `financial-settings/product-mapping` and
  `accounting/category-mapping` → `financial-settings/expense-categories`
  (folder renames, update `revalidatePath` calls). Nav gets the renames +
  the new Financial Settings subgroup.
- **9.3 — `system_account_mappings`.** New table (`mapping_key` unique,
  `label`, `account_id → accounts`), seeded with the 7 keys currently
  hardcoded (see Key Findings above). Rewrite `generate_draft_journal_
  entries()` (`CREATE OR REPLACE`, signature unchanged — no `DROP FUNCTION`
  needed) to read every one via `mapping_key` instead of `account_number`
  literals. Highest-value phase for the FK-only requirement.
- **9.4 — Bank Accounts.** New `bank_accounts` table (name, bank, masked
  account #, `gl_account_id → accounts`, currency, active).
  `payment_type_accounting_mappings` gains optional `bank_account_id →
  bank_accounts` (Cash keeps mapping straight to a GL account; BDO/BPI/
  GCash/etc. route through a bank account instead). New Financial Settings
  ▸ Bank Accounts page.
- **9.5 — Sales / Purchase / Inventory Mapping screens** (needs 9.3). Thin
  admin pages filtering `system_account_mappings`: Sales Mapping shows
  `tip_income`/`write_off_expense`/(later `output_tax_payable`); Purchase
  Mapping shows `credit_card_payable`/`credit_card_interest_expense`;
  Inventory Mapping shows `inventory_adjustment_gain`/
  `inventory_adjustment_loss`. `categories` gains
  `default_revenue_account_id`/`default_inventory_account_id`/
  `default_expense_account_id` so new items inherit sane defaults instead of
  needing 100% manual per-item mapping.
- **9.6 — Taxes, foundation-only** (needs 9.3). New `tax_rates` table +
  `output_tax_payable` key added to `system_account_mappings`. Extend the
  `sale_recognized` branch to split each sale's `total_tax` into its own
  credit line against the mapped liability account — requires widening the
  `sale_recognized` event payload (same pattern ACCT-7.5 already used once
  for per-line revenue splitting). No tax-rate calculation engine wired into
  POS/Orders this round, per Sinag's explicit scope call.
- **9.7 — Reports** (needs 9.1). Trial Balance / Balance Sheet / Profit &
  Loss replace flat `category`-only grouping with a recursive rollup from
  the new hierarchy (indented rows + parent subtotals).

**Not started — no migrations, no RPC changes, no UI changes made this
session.** Sinag asked for this to be logged so a future session can pick up
ACCT-9 without re-deriving the assessment. **How to apply:** before starting
any ACCT-9.x sub-phase, re-verify `generate_draft_journal_entries()`'s
current body against live schema first (standing lesson from every ACCT-7.x
session — RPC bodies drift). See [[project_acct7_v2_event_architecture]] and
[[project_expense_treatment_engine]] for the pipeline this extends.

---

### 2026-07-15 — ACCT-9.1 (Chart of Accounts hierarchy)

Re-verified the live `accounts` schema and `post_journal_entry()` body
directly (both via Supabase MCP and a parallel Explore agent) before
touching anything, per the prior session's own "re-verify before starting"
note — both matched the kickoff assessment exactly, no drift.

**Migration `acct9_1_chart_of_accounts_hierarchy`:** additive only —
`accounts` gains `parent_account_id uuid references accounts(id)` and
`is_postable boolean not null default true`. All 109 existing rows
confirmed to stay leaf/postable (`parent_account_id` null, `is_postable`
true) — zero disruption, as planned. New index on `parent_account_id`.

Two new triggers, both intentionally **not** `SECURITY DEFINER` (matches
`set_updated_at`'s existing convention on this table — they run inside
whichever context fired the write, which already has the needed `accounts`
access via RLS or via a `SECURITY DEFINER` caller's elevated context; no
need to widen the `SECURITY DEFINER` surface the 2026-07-14 security audit
was tightening):
- `accounts_validate_hierarchy` (`before insert or update of
  parent_account_id, category`) — rejects self-parenting, a child whose
  `category` doesn't match its parent's, and any parent assignment that
  would create a cycle (walks the ancestor chain, 100-hop guard against a
  corrupt loop).
- `journal_entry_lines_validate_postable` (`before insert`) — rejects a
  journal line against an account with `is_postable = false`. Deliberately
  a table-level trigger rather than a `post_journal_entry()` body edit, so
  the guard holds even for a direct-SQL insert (same class of write ACCT-6
  used for the opening balance) not just the RPC path.

All four guard behaviors verified live in rolled-back-by-hand test blocks
(category mismatch rejected, self-parent rejected, valid same-category
parent succeeds, cycle attempt on that same pair rejected, non-postable
journal-line insert rejected) — all cleaned up afterward, confirmed via a
follow-up count query (0 parented accounts, 0 non-postable accounts, 0
leftover test journal entries). `get_advisors(security)` shows no new
findings tied to the migration (the two trigger functions aren't
`SECURITY DEFINER`, so they don't add to the existing anon/authenticated
baseline WARN either).

**UI** (`app/dashboard/accounting/chart-of-accounts/`): `chart-of-accounts-table.tsx`
rebuilt as a tree — parent/child grouping via a `parent_account_id` map,
indent-by-depth rendering, per-row expand/collapse chevron, "Expand
all"/"Collapse all" buttons, and a "Group" badge on non-postable rows.
Dropped the shared `DataTable` component for this page specifically (its
sort/paginate model doesn't compose with contiguous parent-child ordering)
in favor of a bespoke table matching the same visual language; no mobile
card-fallback equivalent was built for the tree specifically (scope trim —
this is an admin/manager-only settings screen, kept usable on narrow
screens via horizontal scroll instead). Search/category/status filters
still work: any active filter now shows matches plus their ancestor chain
(so a matched child's parent stays visible for context) and force-expands
across that path. `account-form.tsx` gained a Parent Account `<select>`
(same category enforced server-side by the trigger, client-side just
excludes the account itself) and a native "Allow journal entries" checkbox
bound to `is_postable` (native, not the shared `Checkbox` component — this
form is already fully uncontrolled/FormData-driven, matching the precedent
`feedback_create_or_replace_function_signature_change`-adjacent choice
made in ACCT-7.2's `manual-incoming-form.tsx`). `actions.ts` threads both
new fields through create/update and maps Postgres `23503` (bad parent FK)
to a friendly message.

`lib/supabase/types.ts` regenerated (worked around the MCP tool's
oversized-response limit the same way as the SCA-prefix session — raw JSON
dump to a file, unescaped via a one-off Node script). `npm run build`
passes zero errors.

**Browser-verified end-to-end** (admin `claude-code@sinagukit.internal`,
own session's own dev server, no other-session lock conflict this time):
created a real group account (`SCA-9001`, "Allow journal entries"
unchecked) and a real child under it (`SCA-9002`, same category, parent =
SCA-9001) through the actual dialogs — tree rendered with correct
indentation, chevron, and "Group" badge; collapse-while-filtering
auto-expand behavior confirmed (searching "900" kept the child visible
even after clicking the parent's collapse chevron); clearing the search
returned to the full flat 109-row view with no console errors. Both test
accounts hard-deleted afterward via direct SQL (same cleanup precedent as
ACCT-7.1's `SCA-9999`) — confirmed back to 109 rows.

**Not done / left for later phases, on purpose:** no existing account was
actually re-parented (that's real data entry, Sinag's to do once Financial
Settings/9.2+ exists to make it useful); Trial Balance/Balance
Sheet/Income Statement still group by flat `category` only (9.7, needs
this phase, not done yet); the Journal Entries "new entry" account picker
still lists every active account undifferentiated by `is_postable` (a
manual entry against a group account would still be caught by the new
trigger, just with a raw Postgres exception message rather than the picker
filtering it out up front — acceptable for now, not in this sub-phase's
scope). No git commit (standing project rule — stopped at DoD for manual
review). Next per the plan: 9.2 (Financial Settings shell + relocating
Product/Category Mapping under it), or 9.3 (`system_account_mappings`,
highest-value for closing the hardcoded-`account_number` FK gap) — either
can go next, no ordering dependency between them.

---

### 2026-07-15 — ACCT-9.2 (Financial Settings shell + relocation) + ACCT-9.3 (`system_account_mappings`)

Both done in the same session, per Sinag's explicit "start 9.2 and 9.3" request. Re-verified `generate_draft_journal_entries()`'s live body via `pg_get_functiondef` before touching anything, per the standing "re-verify before starting" note — matched the kickoff assessment exactly (7 mapping keys, `SCA-2000` used consistently as Accounts Payable across all 3 of its call sites, not "default Cash" as an older note had speculated — confirmed by reading `SCA-2000`'s actual name, `Accounts payable`, live in the DB).

**9.2 — Financial Settings shell + relocation.** File moves only (`git mv`, preserving history), no schema changes:
- `app/dashboard/accounting/product-mapping/` → `app/dashboard/accounting/financial-settings/product-mapping/`
- `app/dashboard/accounting/category-mapping/` → `app/dashboard/accounting/financial-settings/expense-categories/` (folder renamed to match the confirmed nav label; the page still covers both Expense Category and Asset Category mappings in one screen, unchanged from before — the plan's target nav only lists "Expense Categories" as a Financial Settings child, so Asset Category mapping stays folded into that same screen for now, not split out)
- Both `actions.ts` `LIST_PATH` constants updated to the new routes; `PageHeader` titles updated (`Category Mapping` → `Expense Categories`).
- `components/layout/app-shell.tsx`: `Accounting` group's `children` restructured — inserted a new `Financial Settings` `NavSubGroup` (same primitive already used for Management/Orders/Inventory under Operations) right after Chart of Accounts, containing `Product Account Mapping` and `Expense Categories`. Applied the three renames Sinag confirmed in the kickoff session: `Journal` → `Journal Entries`, `Review` → `Pending Review`, `Income Statement` → `Profit & Loss` (nav labels only — routes unchanged, `/dashboard/accounting/journal` etc. stay as-is to avoid breaking bookmarks).
- **Bug caught mid-session:** the nav-label renames only covered the `PageHeader` inside each page's `hasAccess === false` fallback branch — the real admin/manager render path for Journal and Review renders `PageHeader` from inside the client `*-table.tsx` wrapper (`journal-table.tsx`, `review-table.tsx`), a second, separate hardcoded `title=` that the first pass missed. Caught by browser-verifying the actual authenticated view rather than trusting the build pass alone; fixed both.
- Grepped the whole app for the old route strings and old label strings before/after to confirm no stray references were left (nav config was the only other place besides the two `actions.ts` files).

**9.3 — `system_account_mappings`.** Migration `acct9_3_system_account_mappings`:
- New table `system_account_mappings` (`mapping_key text unique`, `label`, `account_id → accounts`, `updated_by`, `updated_at`). RLS mirrors the closest existing analog (`payment_type_accounting_mappings`) exactly: select admin+manager, insert/update admin-only (`TO authenticated`, matching the newest RLS convention on this table set — `journal_entry_drafts` — rather than the older `TO public` pattern still present on `accounts`/`item_accounting_mappings`). `set_updated_at` trigger reused as-is.
- Seeded with the 7 keys the kickoff assessment found hardcoded as `account_number` literals: `tip_income` (SCA-4041), `write_off_expense` (SCA-6090), `credit_card_payable` (SCA-2020), `credit_card_interest_expense` (SCA-6092), `inventory_adjustment_gain` (SCA-4042), `inventory_adjustment_loss` (SCA-6091), `accounts_payable_default` (SCA-2000 — one key covers all 3 of its call sites: `expense_recorded`/`asset_acquired` credit and `expense_payment`/`asset_payment` debit, since all 3 are the same "Accounts Payable" concept, confirmed live).
- `generate_draft_journal_entries()` rewritten via `CREATE OR REPLACE` (same `()` signature, no `DROP FUNCTION` needed — this one didn't hit the SCA-prefix/ACCT-7.2 "new params silently create a second overload" pitfall since no parameters changed). All 10 `where a.account_number = 'SCA-xxxx'` lookup sites (7 distinct keys, 3 reused) replaced with `select account_id from system_account_mappings where mapping_key = '...'`. Every existing null-check/skip-if-unmapped branch was left untouched — an admin de-configuring a mapping now correctly makes the affected event skip (same defensive behavior as before, just reading from a table instead of a literal).
- **Verified no behavior change**, not just "compiles": rolled-back-transaction test inserted 3 synthetic `business_events` (`inventory_adjustment_gain`, `credit_card_installment_payment`, `expense_recorded`) using real existing item/payment-type/opex rows, ran `generate_draft_journal_entries()`, and confirmed every resulting draft line landed on the exact same account as the old hardcoded literal would have resolved to (joined back through `system_account_mappings.mapping_key` to prove the FK path, not just eyeballing account numbers) — all inside `begin...rollback`, no data left behind, including on 2 real pre-existing pending events that got swept up in the same run.
- RLS role-impersonation check: a no-profile/null-role caller sees 0 rows on `system_account_mappings`; the admin test account sees all 7.
- `get_advisors(security)`: no new findings tied to `system_account_mappings` or `generate_draft_journal_entries()` — same pre-existing baseline as every other `SECURITY DEFINER` RPC in the project.
- `lib/supabase/types.ts` regenerated (same oversized-MCP-response workaround as the SCA-prefix/ACCT-9.1 sessions — raw JSON dump to a file, unescaped via a one-off Node script).

**Browser-verified end-to-end**, same session (admin `claude-code@sinagukit.internal`): blocked initially by another session's `next dev` holding the single-instance dev lock (same recurring limitation as ACCT-5/ACCT-7.1/ACCT-7.2) — asked Sinag first this time rather than assuming; Sinag said kill it. Killed (PID 6404), cleared `.next/` per the standing stale-Turbopack-cache lesson, started clean. Confirmed: Chart of Accounts still renders all accounts; Financial Settings subgroup expands to show both relocated pages at their new URLs, both load with correct data and zero console errors; Journal Entries, Pending Review, and Profit & Loss pages all show the renamed titles (after the `*-table.tsx` fix above) with real data (Profit & Loss showed actual ₱6,211.00 revenue / ₱9,453.72 expense / -₱3,242.72 net — RPC still executing correctly post-migration).

`npm run build` passes zero errors both before and after the `*-table.tsx` title fix; all `/dashboard/accounting/financial-settings/*` routes registered, old `/product-mapping`/`/category-mapping` routes gone.

No git commit (standing project rule — stopped at DoD for manual review). Next per the plan: 9.4 (Bank Accounts) is next in order, but 9.5/9.6/9.7 are all now unblocked too since they only needed 9.3.

---

### 2026-07-15 — ACCT-9.4 (Bank Accounts + first-ever Payment Methods UI)

Sinag asked to start 9.4. Re-verified live schema first (standing "re-verify
before starting" note): `accounts`/`payment_type_accounting_mappings`/
`system_account_mappings` all matched the kickoff assessment, no drift.

**Scope gap surfaced before writing code:** the kickoff plan's 9.4 bullet
only specs a `bank_accounts` table + page, but also has `payment_type_
accounting_mappings` gain a `bank_account_id` FK — and no sub-phase in the
plan ever assigns building an admin UI for `payment_type_accounting_
mappings` itself (it's been seed-only via raw SQL since ACCT-7.5, despite
"Payment Methods" appearing as its own Financial Settings nav item in the
target IA). Flagged to Sinag rather than guessing which was intended; he
confirmed building both in this session, since the new `bank_account_id`
column would otherwise have no UI to set it.

**Migration `acct9_4_bank_accounts`:**
- New table `bank_accounts` (`name`, `bank`, `account_number_masked`
  nullable, `gl_account_id → accounts` not null, `currency` default
  `'PHP'`, `is_active` default true, `set_updated_at` trigger reused
  as-is). RLS mirrors `system_account_mappings`/`payment_type_accounting_
  mappings` exactly: select admin+manager, insert/update admin-only, `TO
  authenticated`, no delete policy (deactivate-via-`is_active`, same
  convention as `accounts` itself rather than a `deleted_at` column).
- `payment_type_accounting_mappings` gains nullable `bank_account_id →
  bank_accounts`. `account_id` (existing, not null) stays the sole account
  posting resolves through — deliberately did **not** touch `generate_
  draft_journal_entries()` this phase. `bank_account_id` is a reconciliation-
  reference link only (foundation for a future bank-reconciliation module,
  per the original target requirements), same "foundation-only, no engine
  wiring yet" shape as how 9.6 Taxes is scoped — not a behavior change to
  what currently posts.
- `get_advisors(security)`: no new findings tied to `bank_accounts` or the
  new column — same pre-existing baseline as every other table in the
  project.

**UI — two new pages** under `app/dashboard/accounting/financial-settings/`:
- `bank-accounts/` (`page.tsx`/`bank-accounts-table.tsx`/`bank-account-
  form.tsx`/`actions.ts`) — full CRUD, byte-for-byte following the Chart of
  Accounts precedent (Add/Edit dialog, Deactivate/Reactivate confirmation
  dialog, `friendlyError()` mapping `42501`/`23503`). GL Account picker
  filtered to `category = 'asset' AND is_active AND is_postable`. Admin
  write, manager read-only, others restricted — matches every other
  Accounting page's `hasAccess`/`canWrite` split.
- `payment-methods/` (`page.tsx`/`payment-methods-table.tsx`/`actions.ts`)
  — grid-edit + "Save All Mappings" pattern copied from Product Account
  Mapping, one row per active `payment_types` row with two selects: **GL
  Account** (required — same asset-account filter as Bank Accounts, upsert
  skips any row left unmapped rather than guessing, surfaces which
  payment types got skipped in the save-result message) and **Bank
  Account** (optional, `bank_accounts` active rows, placeholder "Direct to
  GL account"). `onConflict: 'payment_type_id'` (confirmed a real unique
  constraint exists on that column before relying on it).
- `app-shell.tsx`: added **Bank Accounts** and **Payment Methods** as the
  first two children of the Financial Settings subgroup (ahead of Product
  Account Mapping/Expense Categories, matching the plan's target nav
  order).
- `lib/supabase/types.ts` regenerated (same oversized-MCP-response
  workaround as every prior ACCT-9 session).

**Verified:**
- `npm run build` passes zero errors; both new routes registered.
- **Browser-verified end-to-end** (admin `claude-code@sinagukit.internal`)
  — killed another session's `next dev` (PID 4056, Sinag confirmed first)
  holding the single-instance dev lock, cleared `.next/` per the standing
  stale-Turbopack-cache lesson, started clean: created a real bank account
  (`BDO Main Checking`, BDO, `****1234`, GL account `SCA-1020 — Bank
  Account`, currency `PHP`) through the dialog — appeared correctly in the
  list; Edit re-opened with all fields pre-filled including the stripped
  GL Account selection; Deactivate → Reactivate round-tripped the status
  badge correctly. On Payment Methods, the 6 existing payment types (seeded
  back in ACCT-7.5) rendered with their real existing GL Account mappings
  intact (Cash → `SCA-1000 Cash on hand`, BDO/BPI/Gcash/Maribank/Other →
  `SCA-1020 Bank Account`); set BDO's Bank Account to the new `BDO Main
  Checking` row and saved — "Mappings saved" confirmation shown, and a
  direct DB query confirmed the join lands correctly (`BDO → SCA-1020 /
  BDO Main Checking`, all 5 other rows unchanged with `bank_account_id`
  still null). No console errors on either page at any step. Left both the
  real bank account and the real BDO↔bank-account mapping in place
  afterward, per this project's standing convention for self-contained
  verification data.
- **RLS role-impersonation checks** (rolled-back transactions against real
  manager/encoder profile rows): manager sees the 1 real `bank_accounts`
  row on select but a direct insert is rejected by RLS (`new row violates
  row-level security policy`); encoder sees 0 rows on select — matches the
  intended admin-write/manager-read/encoder-none shape exactly.

**Not built this session, on purpose:** no change to `generate_draft_
journal_entries()` — `bank_account_id` has no effect on posting yet (see
the design note above); that would be a deliberate future decision, not an
oversight. No git commit (standing project rule — stopped at DoD for
manual review). Next per the plan: 9.5 (Sales/Purchase/Inventory Mapping
screens) or 9.6 (Taxes, foundation-only) or 9.7 (Reports) — no ordering
dependency between them.

---

### 2026-07-15 — ACCT-9.5 (Sales/Purchase/Inventory Mapping + category default accounts)

Sinag asked to start 9.5. Re-verified live schema first (standing
"re-verify before starting" note): the 7 `system_account_mappings` keys,
`categories`, and `item_accounting_mappings` all matched the kickoff
assessment, no drift. Read `generate_draft_journal_entries()`'s live body
via `pg_get_functiondef` to confirm exactly how it resolves `item_
accounting_mappings` per item — this shaped the design decision below.

**Scope decision made before writing code, not in the kickoff plan's
explicit wording:** the plan's 9.5 bullet says categories should gain
default account columns "so new items inherit sane defaults instead of
needing 100% manual per-item mapping," but doesn't say *how* the
inheritance happens. Two options: (a) wire the defaults directly into
`generate_draft_journal_entries()` as a fallback when `item_accounting_
mappings` is empty for an item, or (b) auto-populate a real `item_
accounting_mappings` row from the category's defaults at the moment a new
item is created, leaving the posting RPC untouched. Chose **(b)** — same
"foundation-first, don't touch the live posting engine unless the plan
explicitly calls for it" discipline ACCT-9.4 used for `bank_account_id`.
Confirmed via `information_schema.triggers` and a grep for `.from('items').
insert`/`insert into items` that **items are never created by app code
directly** — the only two paths are the Loyverse n8n sync (raw SQL,
external) and `upsert_item()` (a real `insert into public.items`), so a
plain `AFTER INSERT ON items` trigger is the one place both paths pass
through, matching the precedent of `apply_incoming_item_inventory_
movement` (also `SECURITY DEFINER`, also a cross-table trigger writing
from one table's insert into a different table).

**Migration `acct9_5_sales_purchase_inventory_mapping`:**
- `categories` gains `default_revenue_account_id`/`default_inventory_
  account_id`/`default_expense_account_id` (all nullable `uuid references
  accounts(id)`, additive).
- New trigger function `items_apply_category_default_mappings()`
  (`SECURITY DEFINER`, `AFTER INSERT ON items FOR EACH ROW`): if the new
  item's category has any of the 3 defaults set, inserts one `item_
  accounting_mappings` row seeded from them (`on conflict (item_id) do
  nothing`, so it never clobbers a mapping that already exists); does
  nothing if the category has no defaults, or the item has no category.
- Verified live with real (non-CTE — a data-modifying CTE's sibling
  statements share one snapshot and won't see a trigger's cross-table
  writes, a dead end hit first) sequential statements inside a rolled-back
  transaction: temporarily set one real category's 3 defaults, inserted a
  real item under it — the trigger correctly created a matching `item_
  accounting_mappings` row; a second item inserted with `category_id =
  null` correctly got no mapping row and no error. Rolled back, 0 rows
  left behind.
- `get_advisors(security)`: only the expected new anon/authenticated
  "can execute `SECURITY DEFINER`" baseline WARN for the new trigger
  function — same pre-existing class as every other `SECURITY DEFINER`
  function in the project, no new class of finding.

**UI — three new thin Financial Settings pages**, each filtering
`system_account_mappings` to the plan's listed keys (per the plan's own
"thin admin pages" framing, `output_tax_payable` deferred to 9.6 since it
doesn't exist yet):
- `sales-mapping` — `tip_income` (revenue picker), `write_off_expense`
  (expense picker).
- `purchase-mapping` — `credit_card_payable` (liability picker), `credit_
  card_interest_expense` (expense picker).
- `inventory-mapping` — `inventory_adjustment_gain` (revenue picker),
  `inventory_adjustment_loss` (expense picker).

All three share one new component, `components/business/system-mapping-
table.tsx` (rows = `{mapping_key, label, account_id, account_category}`,
account picker filtered per-row to `account_category`, "Save Mappings"
button) rather than tripling the same ~130-line table across 3 folders —
each page's own `page.tsx`/`actions.ts` stays a thin per-screen wrapper
(data fetch + a `mapping_key`-scoped update), matching the established
per-screen-`actions.ts` convention elsewhere in this module. Since all 7
`system_account_mappings` rows are already seeded (ACCT-9.3) and `account_
id` is nullable, saves are plain `update ... where mapping_key = ...` (no
upsert/insert path needed or offered — these keys are system-managed, not
admin-creatable). The key→expected-account-category domain mapping lives
in one new shared file, `lib/accounting/system-mapping-keys.ts`, rather
than being hardcoded three times.

**UI — Category Defaults panel** added to the top of the existing
Product Account Mapping page (`category-defaults-table.tsx`, new
`saveCategoryDefaultMappings()` in that page's `actions.ts`): one row per
active category (6 rows: Item, Item(Pre-made), Packaging, Pre-Prod BOM,
Product(Pre-made), Services), same 3-picker/filter-by-account-category
shape as the per-item table below it, explicit copy clarifying it "only
affects newly created items, not existing mappings below" so it doesn't
read as a bulk-backfill tool for the 61 existing items.

`app-shell.tsx`: added **Sales Mapping**, **Purchase Mapping**, **Inventory
Mapping** as the last three children of the Financial Settings subgroup,
after Expense Categories — matches the kickoff plan's finalized nav order
exactly (Taxes is the only listed item still missing, deferred to 9.6).
`lib/supabase/types.ts` regenerated (same oversized-MCP-response
workaround as every prior ACCT-9 session — this time via a small Node
script since the raw dump had two layers of JSON-string wrapping instead
of one).

**Verified:**
- `npm run build` passes zero errors; all 3 new routes registered
  (`/dashboard/accounting/financial-settings/{sales,purchase,inventory}-
  mapping`).
- **RLS role-impersonation** (`set local role authenticated` + `request.
  jwt.claims`, rolled back): manager sees all 7 `system_account_mappings`
  rows on select but a direct `update` affects 0 rows (RLS-blocked, not
  erroring — matches the existing admin-only update policy from 9.3);
  encoder sees 0 rows on select.
- **Browser-verified end-to-end** (admin `claude-code@sinagukit.internal`)
  — asked Sinag first this time before touching another session's `next
  dev` (PID 6480) holding the single-instance dev lock; Sinag confirmed,
  killed it, cleared `.next/` per the standing stale-Turbopack-cache
  lesson, started clean. Sales/Purchase/Inventory Mapping pages all render
  with the correct existing values pre-selected (Tip Income → SCA-4041,
  Write-off → SCA-6090, Credit Card Payable → SCA-2020, CC Interest →
  SCA-6092, Adjustment Gain → SCA-4042, Adjustment Loss → SCA-6091) and
  each picker correctly filtered to only its expected account category.
  On Product Account Mapping, set a real category's 3 defaults through the
  new panel, got "Category defaults saved.", confirmed via direct DB query
  the row actually persisted, reloaded the page and confirmed the values
  survived a fresh server fetch, then reset all 3 back to "None" and saved
  again — confirmed back to `null` in the DB, leaving no dummy real-looking
  defaults in place (unlike some earlier ACCT-9 sessions' verification
  rows, category defaults aren't self-evidently-fake the way `SCA-9999` or
  a labeled test bank account are, so this one was cleaned up rather than
  left in place). No console errors on any of the 4 pages touched.

**Not built this session, on purpose:** `output_tax_payable` isn't on any
of the 3 new pages (doesn't exist until 9.6 adds it); no bulk "apply
category defaults to the 61 already-existing items" action (the panel's
copy explicitly scopes itself to new items only — backfilling existing
unmapped items stays a manual Product Account Mapping edit, same "Sinag
enters the real data" convention as the rest of this module). No git
commit (standing project rule — stopped at DoD for manual review). Next
per the plan: 9.6 (Taxes, foundation-only) or 9.7 (Reports) — no ordering
dependency between them.

---

### 2026-07-15 — ACCT-9.6 (Taxes, foundation-only)

Sinag asked to start 9.6. Re-verified live schema first (standing
"re-verify before starting" note): the 7 `system_account_mappings` keys and
`generate_draft_journal_entries()`'s `sale_recognized` branch both matched
the kickoff assessment exactly — confirmed `orders.total_tax` exists but is
currently always `0` app-wide (`quotation/actions.ts` hardcodes
`total_tax: 0`, no UI computes a nonzero value yet), and that
`close_order_payment()`'s `sale_recognized` payload didn't carry
`total_tax` at all — matching the kickoff finding that tax collected isn't
posted separately today.

**Migration `acct9_6_taxes_foundation`:**
- New table `tax_rates` (`name`, `rate_percent numeric(5,2)`, `is_active`,
  timestamps). RLS mirrors `bank_accounts`/`system_account_mappings`
  exactly: select admin+manager, insert/update admin-only, `TO
  authenticated`, no delete policy (deactivate via `is_active`,
  consistent with this whole mapping-table family).
- `system_account_mappings` gains an 8th key, `output_tax_payable`
  ("Output Tax Payable"), seeded unmapped (`account_id = null`) — same
  pattern as the original 7 keys before Sinag configures them.
- `close_order_payment()` widened (`CREATE OR REPLACE`, same `()`
  signature, no `DROP FUNCTION` needed): `sale_recognized` payload gains
  `'total_tax', coalesce(v_order.total_tax, 0)`.
- `generate_draft_journal_entries()`'s `sale_recognized` branch rewritten
  to split tax out of the revenue allocation instead of adding a parallel
  code path: introduced `v_tax_amount` and `v_revenue_total := total_money
  - tax_amount`, then allocate `v_revenue_total` (not raw `total_money`)
  proportionally across the revenue accounts exactly as before. When
  `tax_amount > 0`, one more credit line posts to the `output_tax_payable`
  mapped account at `line_order = 92` (after write-off's 90 and tip's 91).
  This keeps the invariant that total credits always equal `total_money +
  tip_amount` — tax is carved out of the revenue side, not added on top —
  so every existing branch (payments, write-off, tip) needed zero changes.
  Every other event-type branch in the function is byte-for-byte unchanged
  from the live `acct9_3` body.
- Followed the existing (not-fully-robust) precedent for `tip_income`/
  `write_off_expense` rather than inventing new guard logic:
  `output_tax_payable` is **not** added to the initial skip-check (which
  only validates revenue/payment mappings before generating a draft at
  all) — if tax is nonzero but the mapping is left unset, the insert would
  hit `journal_entry_draft_lines.account_id`'s `NOT NULL` constraint and
  raise, same latent risk tip/write-off already carry. Not fixed here
  (out of scope, consistency over new robustness), but worth flagging if
  it's ever addressed for one of the three it'd need addressing for all.
- `get_advisors(security)` and `get_advisors(performance)`: zero findings
  reference `tax_rates` in either — no missing-RLS or missing-index
  warnings, clean.

**Verified live** (rolled-back-transaction tests via Supabase MCP,
role-impersonated, no data left behind):
- Synthetic `sale_recognized` event (`total_money` 1120.00, `total_tax`
  120.00, one revenue line 1000.00, one payment 1120.00, tax mapped
  temporarily to a real liability account) → `generate_draft_journal_
  entries()` produced exactly 3 balanced lines: revenue credit 1000.00
  (= 1120 − 120, not the raw 1120), payment debit 1120.00, tax credit
  120.00 at `line_order` 92 on the mapped account. Total debit = total
  credit = 1120.00.
  interesting incidental finding: the liability account used for this test,
  `SCA-2010 "Income taxes payable"`, is a plausible real fit for the
  eventual `output_tax_payable` mapping — flagging for Sinag's actual
  decision, not set permanently by this session (reset to unmapped after
  the test, see below).
- RLS role-impersonation on `tax_rates`: admin insert succeeds; manager
  select returns the row but insert is rejected (`42501`); encoder sees 0
  rows on select.

**UI** — new `Taxes` page under
`app/dashboard/accounting/financial-settings/taxes/`
(`page.tsx`/`tax-rates-table.tsx`/`tax-rate-form.tsx`/`actions.ts`):
top panel reuses the existing `SystemMappingTable` component (from 9.5)
filtered to the new `output_tax_payable` key via a new `TAX_MAPPING_KEYS`
export in `lib/accounting/system-mapping-keys.ts`
(`MAPPING_KEY_ACCOUNT_CATEGORY.output_tax_payable = "liability"`); below
it, a full CRUD `Tax Rates` table byte-for-byte following the Bank
Accounts precedent (Add/Edit dialog with `NumberInput` for the
percentage, Deactivate/Reactivate confirmation dialog, `friendlyError()`
mapping `42501`/`23503`). Added **Taxes** to `app-shell.tsx`'s Financial
Settings subgroup between Payment Methods and Product Account Mapping,
matching the kickoff plan's finalized nav order exactly. `lib/supabase/
types.ts` regenerated (same oversized-MCP-response workaround as every
prior ACCT-9 session).

**Browser-verified end-to-end** (admin `claude-code@sinagukit.internal`,
own dev server, no lock conflict this session): Taxes page renders with
the Output Tax Payable picker correctly filtered to liability accounts
only (`SCA-2000`/`SCA-2010`/`SCA-2020`); set it to `SCA-2010`, saved,
confirmed persisted via direct DB query, then reset back to "Not mapped"
and saved again (a real GL-account decision is Sinag's to make, not
self-evidently fake the way a labeled test row is — same judgment call
ACCT-9.5 made for category defaults). Added a labeled test tax rate
("ACCT-9.6 verification (test)", 12.00%) through the dialog, edited its
rate to 12.50%, deactivated it (status flipped to "Inactive" + action
flipped to "Reactivate"), reactivated it — all four confirmed via server
logs showing the real `createTaxRate`/`updateTaxRate`/`setTaxRateActive`
calls firing, and via re-fetched page state. Hard-deleted the test row
afterward via direct SQL (self-evidently-fake, same cleanup convention as
`SCA-9999`/ACCT-9.1's test accounts). No console errors at any step.
`npm run build` passes zero errors; new route
`/dashboard/accounting/financial-settings/taxes` registered.

**Not built this session, on purpose:** no tax-rate calculation engine
wired into POS/Orders — `tax_rates` is a reference table only, and
`total_tax` still has to be populated by something upstream of
`close_order_payment()` before any of this actually posts a nonzero tax
line in practice (today it's always 0 app-wide). That wiring, and
`tax_rates`→order-line integration generally, is explicitly out of scope
per the kickoff plan's "foundation-only" framing.

**Concurrent-session note:** another session was working ACCT-9.7
(Reports) at the same time on a different dev server; see that session's
own log entry immediately below for the full account of how the two
sessions' changes were reconciled — no schema conflict (9.6 touched
`system_account_mappings`/`close_order_payment`/`generate_draft_journal_
entries`, 9.7 touched only the 3 report RPCs + 2 new internal helpers) —
and for the Status table update marking all 7 ACCT-9 sub-phases done.

No git commit (standing project rule — stopped at DoD for manual
review).

---

### 2026-07-15 — ACCT-9.7 (Reports — hierarchical rollup)

Sinag asked to start 9.7 directly (skipping 9.6, no ordering dependency
between them). Re-verified live schema first (standing "re-verify before
starting" note): `accounts.parent_account_id`/`is_postable` and all three
report RPC bodies matched the ACCT-9.1/kickoff assessment exactly, no
drift. Also found real live hierarchy data already in place beyond what
9.1's own session left behind — Sinag (or another session) has since
re-parented 28 accounts and created 3 group accounts, all under `asset`
(`SCA-1000 Asset` root → `SCA-1020 Bank Account`/`SCA-1200 Inventory`
subgroups → real leaf children); liability/equity/revenue/expense have no
hierarchy yet. This live data ended up mattering for a design decision
below, not just a sanity check.

**Migrations `acct9_7_hierarchical_reports` → `acct9_7_hierarchical_reports_own_vs_rollup` → `acct9_7_revoke_anon_execute`** (three passes, each fixing something the previous one's verification caught — see below):

- Two new internal helpers (naming convention: underscore prefix for
  internal/dispatcher functions, matching the existing
  `_record_expense_with_treatment()` precedent): `_account_tree()` returns
  every account's `depth` and a materialized `sort_path` (array of
  `account_number`s from root down) via a recursive CTE, so callers can
  `order by sort_path` and get parents immediately followed by their
  children at any depth. `_account_rollup(p_start, p_end)` returns, per
  account, both its **own** direct-posting sums and its **subtree**
  (self + all descendants) sums, via a recursive "ancestor closure" CTE
  (each account paired with every ancestor up to the root, itself included)
  joined back to summed `journal_entry_lines` — this is what makes a group
  account's subtotal correctly include a grandchild's postings without a
  fixed-depth assumption. Both helpers are `SECURITY INVOKER` (not
  DEFINER) — `accounts`/`journal_entries`/`journal_entry_lines`'s existing
  `TO public` + `current_user_role() = admin/manager` RLS policies already
  gate them correctly, no need to widen the DEFINER surface (same reasoning
  ACCT-9.1's two triggers used).
- `get_trial_balance`/`get_income_statement`/`get_balance_sheet` all
  `DROP FUNCTION` + recreated (return-column-set change, this project's
  standing `CREATE OR REPLACE` pitfall) with `account_id`/`depth`/
  `is_postable` added, ordered by `sort_path` instead of `account_number`.
  Row inclusion stays an inner-join-equivalent (only accounts with any
  activity in their own subtree appear), same as pre-9.7.
- **Design correction found during verification, before touching the
  frontend:** the first pass returned only ONE rolled-up figure per row.
  Cross-checked the rollup arithmetic by hand against a real group account
  (`SCA-1200 Inventory`, now non-postable) and found its reported subtotal
  didn't match the sum of its visible children — traced it to a real
  ₱280.00 direct credit posted to `SCA-1200` on 2026-07-11 (a COGS entry),
  from *before* it was reorganized into a group account. The `is_postable`
  trigger only blocks new postings against group accounts going forward; it
  doesn't retroactively hide history. This meant a single rolled-up figure
  per row would make the page-level "Total Debits/Total Credits" (etc.)
  stat cards ambiguous — summing only `is_postable = true` rows would
  silently drop that ₱280, while summing every row's rolled-up figure would
  double-count it against its children. Fixed by returning **two** figures
  per row: `debit_balance`/`credit_balance`/`amount` (the account's own,
  unrolled figure — bit-for-bit the same formula the pre-9.7 flat report
  used) alongside a new `rollup_debit_balance`/`rollup_credit_balance`/
  `rollup_amount` (subtree-inclusive, for the tree display only). This
  means **the three `page.tsx` files' existing `rows.reduce(...)` total
  computations needed zero changes** — they still sum the "own" field,
  which is a superset of the same accounts the old flat query would have
  summed, so the totals are provably unaffected by hierarchy. Verified by
  hand: own-debit total (₱42,150.72) exactly equals own-credit total
  (₱42,150.72) across the whole ledger, confirming the double-entry
  identity holds computed this way (it would NOT hold if totals were
  computed from rolled-up group subtotals instead — rolling up first then
  clipping to `greatest(x,0)` is a non-linear operation that can silently
  net offsetting sibling balances against each other before the total
  check, which is why "sum only the roots" was considered and rejected as
  a totaling strategy).
- **Second issue found by `get_advisors(security)` after the first two
  migrations:** all 5 new/changed functions showed up as `anon`-executable
  `SECURITY DEFINER` — worse than this project's usual accepted baseline
  WARN (anon+authenticated both flagged, accepted everywhere as "the
  internal role check is the real gate"). The pre-9.7 versions of the 3
  report RPCs had `anon` explicitly revoked (2026-07-14 security audit);
  `DROP FUNCTION` + `CREATE FUNCTION` resets grants to this Supabase
  project's default-privilege baseline, which grants `anon` execute
  *directly* (not via the `PUBLIC` pseudo-role), so `revoke all ... from
  public` in the first two migrations didn't remove it. Third migration
  explicitly `revoke execute ... from anon` on all 5 functions, confirmed
  via `information_schema.routine_privileges` back down to
  authenticated/postgres/service_role only, matching the pre-9.7 grant
  shape exactly.

**UI** — new shared `components/business/hierarchical-report-table.tsx`
(one component, used by all 3 report tables rather than tripling the same
tree-rendering logic): dropped the shared `DataTable` for these three pages
specifically, same reasoning ACCT-9.1 used for the Chart of Accounts page
("sort/paginate model doesn't compose with contiguous parent-child
ordering") — rows arrive from the RPC already in tree pre-order, so the
table just renders them in sequence, indenting by `depth * 20px` and
bolding/tinting non-`is_postable` (group) rows to read as branch subtotals.
No collapse/expand (unlike Chart of Accounts) — reports only show accounts
with actual activity, a much shorter list than the full 114-row Chart of
Accounts, so collapsing wasn't judged worth the complexity this round.
Kept a search box: since rows are already in pre-order, a row's ancestor
chain can be recovered client-side just by tracking, at each depth, the
most recently-seen row (no `parent_account_id` needed in the payload) —
searching keeps matched rows' ancestors visible for context, same idea as
Chart of Accounts' `visibleIds` filter. `trial-balance-table.tsx`/
`income-statement-table.tsx`/`balance-sheet-table.tsx` all became thin
wrappers passing `rollup_*` fields into the shared component's value
columns; none of the three `page.tsx` files changed at all.

**Verified:**
- `npx tsc --noEmit` passes zero errors (used in place of `npm run build`
  this session — another session's `next dev` held the port-3000
  single-instance lock; asked Sinag first, confirmed, killed PID 17524,
  cleared `.next/` per the standing stale-Turbopack-cache lesson, started
  clean, then ran the full browser verification below anyway).
- **DB-level, rolled-back-transaction role impersonation:** null-role
  caller blocked with the existing "Not authorized to view financial
  reports" message on all three RPCs (role check unchanged, still the
  first statement).
- `get_advisors(security)`: after the third migration, back to this
  project's standard pre-existing baseline WARN (anon+authenticated can
  execute `SECURITY DEFINER` — the internal role check is the real gate),
  no new class of finding, matching the pre-9.7 grant shape exactly.
- **Browser-verified end-to-end** (admin `claude-code@sinagukit.internal`,
  own session's own dev server): Trial Balance renders the real live
  hierarchy correctly — `SCA-1000` (root, bold, ₱31,037.28) →
  `SCA-1020`/`SCA-1200` (bold subgroups) → their leaf children indented
  further, `SCA-1300`/`SCA-1530` (plain leaves) at the middle indent level,
  every other category flat (no hierarchy exists there yet) — Total
  Debits/Total Credits both ₱42,150.72, "Balanced". Confirmed indentation
  and bolding via computed styles (`paddingLeft` 0/20/40px matching depth
  0/1/2, `font-weight` 600 for the 3 group rows vs 400 for every leaf).
  Search for "Keychain" correctly narrowed to the 1 matching leaf plus its
  2 ancestors (`SCA-1000`, `SCA-1200`), dropping the unrelated `SCA-1020`
  sibling branch. Balance Sheet renders the same hierarchy; "Balance
  Check" shows "Out of balance" by exactly ₱3,292.72 — cross-checked
  against Profit & Loss's Net Income (₱-3,292.72) for the same period,
  confirming this is the expected open-period accounting identity (Assets
  = Liabilities + Equity + Net Income for an unclosed period with no
  closing entry yet), not a regression from this session — the "own"
  formula is byte-for-byte the pre-9.7 formula, applied to the same
  account set. Profit & Loss itself renders flat (no revenue/expense
  hierarchy exists yet) with Total Revenue ₱6,211.00 / Total Expenses
  ₱9,503.72 / Net Income -₱3,292.72, matching pre-9.7 figures exactly (this
  session's own regression check, not just a design argument). No console
  errors on any of the 3 pages.

**Not built this session, on purpose:** no collapse/expand on the report
tables (see UI note above).

**Concurrent-session discovery, after the fact:** `list_migrations` at the
end of this session showed `acct9_6_taxes_foundation` (applied
2026-07-15 13:06:27) sitting between this session's own migrations and the
prior ACCT-9.5 one — **not done by this session.** A separate concurrent
session (almost certainly the one whose `next dev` was holding port 3000,
killed earlier this session with Sinag's go-ahead so this session's own
preview could start) completed ACCT-9.6 in parallel: new `tax_rates` table,
`output_tax_payable` system-mapping key, `close_order_payment()` widened to
carry `total_tax` in the `sale_recognized` payload, and
`generate_draft_journal_entries()`'s `sale_recognized` branch extended to
split it into its own credit line — plus a new
`financial-settings/taxes/` page and nav entry (confirmed via `git status`:
`components/layout/app-shell.tsx` and `lib/accounting/system-mapping-
keys.ts` modified, `financial-settings/taxes/` untracked, none of it this
session's own edits). **No schema conflict with 9.7** — 9.6 only touched
`system_account_mappings`/`close_order_payment`/
`generate_draft_journal_entries`; 9.7 only touched the 3 report RPCs plus
the 2 new internal helpers, no overlap. `lib/supabase/types.ts` as
regenerated by this session already includes 9.6's `tax_rates` table too
(regenerated after 9.6's migration had already landed). **Flagging for
Sinag:** two sessions' uncommitted changes are sitting together in the same
working tree right now (this session's ACCT-9.7 files + the other
session's ACCT-9.6 files) — nothing here conflicts, but worth knowing
before anyone commits, and the other session's dev server was killed so it
may need restarting on its end.

ACCT-9 module restructure is now **fully done, all 7 sub-phases** (per the
Status table above) — combining this session's 9.7 with the concurrent
session's 9.6. No git commit (standing project rule — stopped at DoD for
manual review).

---

### 2026-07-16 — Supplier Payment kickoff (assessment + SP-1..SP-4)

Sinag asked to rename Finance's `Payments` page to **Customer Payment** and
add a new **Supplier Payment** to cover Inventory PO, Expense PO, Asset PO,
and Manual Incoming. Assessed the live schema/RPCs (not just code) before
proposing a plan.

**What was found already in place:**
- **Expense PO / Direct Expense** (`opex_expenses`): full payment lifecycle
  already exists — `payment_status` column, `payable_payments` ledger,
  `log_payable_payment()` RPC, and a working Log Payment UI on
  `/dashboard/finance/expenses/[id]` (built in the 2026-07-15 Expense
  Treatment Engine session).
- **Asset PO** (`fixed_assets`): acquisition already posts to
  `SCA-2000 Accounts Payable` at `asset_acquired` (deferred by design since
  ACCT-7.9) — but `log_payable_payment('asset', ...)` was **silently
  incomplete**: it emits the `asset_payment` business event correctly, but
  has no branch to recompute a payment status, and `fixed_assets` has no
  `payment_status` column at all. No UI exists either. This was a real gap,
  not by design.
- **Inventory PO / Manual Incoming** (`incoming_items`): no liability concept
  at all — `receive_purchase_order()` and the manual-incoming insert capture
  `payment_type_id`/`is_credit_card` and the rule engine
  (`generate_draft_journal_entries()`) books cash/bank (or
  `SCA-2020 Credit Card Payable`) **immediately** at receiving. No unpaid
  state, no `payable_payments` rows, nothing to pay later.

**Decision (asked Sinag directly since it changes real GL posting behavior
on an active flow):** Inventory PO / Manual Incoming become a **deferred
liability** model, mirroring Expense PO exactly — receiving posts to AP,
Supplier Payment is where the real payment gets logged later. Sinag
confirmed (Recommended option).

**Sinag's 3 follow-up decisions:**
1. Include **Direct Expense** (not just Expense PO) in the Supplier Payment
   list — both already share `opex_expenses`/`payment_status`.
2. **Drop** `incoming_items.payment_type_id`/`is_credit_card` in the same
   migration (not kept for historical display) — new rows never populate
   them anyway once receiving stops asking.
3. Supplier Payment sits in the nav **directly below Customer Payment**
   (wiring deferred to SP-7, when the page itself is built).

**Full phase plan** (SP-1..SP-4 are this session's scope; SP-5..SP-8 later):
- **SP-1** — Rename `Payment` → `Customer Payment` (nav label +
  `PageHeader` title only, same route).
- **SP-2** (`finpur_13_supplier_payment_schema`) — `incoming_items` gets
  `payment_status` (default `'unpaid'`, then **backfill all existing rows to
  `'paid'`** since they were genuinely cash-settled under the old model);
  `fixed_assets` gets `payment_status` (default `'unpaid'`, no backfill —
  every asset has been AP-deferred since acquisition and never had a
  payment logged); widen `payable_payments_payable_type_check` and
  `business_events_event_type_check` to add `'inventory'`/
  `'inventory_payment'`; update the `apply_incoming_item_inventory_movement()`
  trigger to stop passing `payment_type_id`/`is_credit_card` into the
  `business_events` payload; then drop both columns from `incoming_items`
  (in that order, so the trigger never references a dropped column).
- **SP-3** (`finpur_14_supplier_payment_rpcs`) — `receive_purchase_order()`
  loses its 2 payment params (old 4-arg signature explicitly dropped first,
  per the standing `CREATE OR REPLACE`-with-new-params pitfall — see
  ACCT-7.2's incident above); `generate_draft_journal_entries()`'s
  `purchase_received`/`manual_incoming` branch always credits
  `accounts_payable_default` now (no more is_credit_card/payment_type_id
  branching), and its `expense_payment`/`asset_payment` branch widens to
  `inventory_payment` (identical Debit AP / Credit payment-type-account
  logic, no new branching needed); `log_payable_payment()` accepts
  `'inventory'`, gains the missing `'asset'` status-recompute branch (fixes
  the pre-existing gap above), and a new `'inventory'` branch keyed on
  `total_price + shipping_fee - discount_amount`.
- **SP-4** — Receiving UI: remove the Payment Method select + credit-card
  checkbox from the Inventory PO receive form and the Manual Incoming
  dialog; Receiving Log's Payment column becomes a Payment Status badge.
- **SP-5** (not started) — Fixed Assets gets a real `[id]` detail page with
  Log Payment, cloned from `expense-detail.tsx`.
- **SP-6** (not started) — New Inventory/Manual Incoming payable detail
  page (no per-row detail page exists today for `incoming_items`).
- **SP-7** (not started) — Unified Supplier Payment list
  (`/dashboard/finance/supplier-payments`, Select-based Type + Payment
  Status filters per the project's no-Tabs convention, `UNION ALL` across
  `opex_expenses` + `fixed_assets` + `incoming_items`), nav entry below
  Customer Payment.
- **SP-8** (not started) — End-to-end browser verification: receive an
  Inventory PO, confirm it posts to AP not cash, log a partial + full
  payment via Supplier Payment, confirm the journal entries are correct.

**Important consequence flagged to Sinag:** between SP-4 landing and SP-6/7
landing, Inventory PO / Manual Incoming receipts will correctly book to AP
as unpaid, but there is **no UI yet to pay them off** (`log_payable_payment
('inventory', ...)` is callable once SP-3 lands, just not wired to a page
until SP-6/7).

**SP-1..SP-4 implemented and verified this session.** Applied
`finpur_13_supplier_payment_schema` and `finpur_14_supplier_payment_rpcs` via
Supabase MCP exactly as planned above (trigger updated before the column
drop, old 4-arg `receive_purchase_order` explicitly dropped before the new
2-arg version per the ACCT-7.2 pitfall, grants re-checked post-recreate —
`pg_proc.proacl` confirmed identical to the pre-migration baseline, no
public/anon regression). Removed the Payment Method select + credit-card
checkbox from the Inventory PO receive form and the Manual Incoming dialog;
`receiving-log-table.tsx`'s Payment column is now a Payment Status badge.
Regenerated `lib/supabase/types.ts` (confirmed `payment_status` on both
`incoming_items`/`fixed_assets`, no more `payment_type_id`/`is_credit_card`
anywhere on `incoming_items`).

Verified live (`npx tsc --noEmit` clean, `npm run build` clean, browser as
the Claude admin test account): received real open PO `SPO-2026-07150001`
(2 lines, E-gosyo) through the updated receive form — no payment fields
shown. Receiving Log shows both new rows (`SRI26-0716-0026/0027`) as
**Unpaid**, while every pre-existing row backfilled correctly to **Paid**.
Confirmed the actual posted `journal_entry_draft_lines` for both events:
Debit the mapped Inventory account / Credit `2010 Accounts payable` — no
cash/bank or Credit Card Payable touched, exactly the deferred-liability
model Sinag approved. Customer Payment rename confirmed in both the page
title and the sidebar nav label, no console errors anywhere. No git commit
(standing project rule — stopped for manual review). Next: SP-5 (Fixed
Assets payment UI) through SP-8 (Supplier Payment list + nav wiring), not
started.

---

### 2026-07-16 — SP-5..SP-8 (Fixed Assets payment UI, Inventory/Manual detail page, unified list, verification)

Closed out the remaining Supplier Payment phases in the same session as
SP-1..SP-4.

**SP-5 — Fixed Assets payment parity.** New `/dashboard/finance/
fixed-assets/[id]` detail page (`asset-detail.tsx`), cloned from
`expense-detail.tsx`'s Payment History + Log Payment dialog pattern. New
`logAssetPayment()` action calling `log_payable_payment('asset', ...)`.
`fixed-assets-table.tsx` gained a Payment Status column and `onRowClick`
navigation to the new detail page — the existing Edit/Dispose buttons
needed `e.stopPropagation()` added (matching the established pattern in
`items-for-review-table.tsx`) so they don't also trigger row navigation.

**SP-6 — Inventory/Manual Incoming payable detail page.** New shared
`app/dashboard/finance/supplier-payments/actions.ts` (`logInventoryPayment()`
→ `log_payable_payment('inventory', ...)`) and new `/dashboard/finance/
supplier-payments/incoming/[id]` page — same Payment History + Log Payment
pattern, keyed on `total_price + shipping_fee - discount_amount` as the
payable amount (matching the RPC's own formula), shows item/qty/unit price,
supplier, and links back to the Inventory PO or "Manual Incoming".

**SP-7 — Unified Supplier Payment list.** New `/dashboard/finance/
supplier-payments` page — deliberately **not** a new SQL view/RPC; mirrors
the existing app-layer pattern (3 parallel Supabase queries merged in JS,
same shape as how `receiving/page.tsx` already merges 2 queries) since RLS
already permits admin/manager to read `opex_expenses`/`fixed_assets`/
`incoming_items`/`payable_payments` directly — no new RLS or migration
needed. Merges `opex_expenses` (both `direct` and `purchase_order` source,
per Sinag's decision to include Direct Expense), `fixed_assets`, and
`incoming_items` into one `SupplierPayableRow` shape, with a separate
`payable_payments` query reduced into a `payable_type:payable_id → paid sum`
map. Type + Payment Status filters are both `FilterBar` (dropdown) per
[[feedback_filters_must_be_dropdowns]] — no tabs. Nav entry added directly
below Customer Payment per Sinag's decision.

**Bug caught and fixed before shipping:** the list's Paid/Remaining columns
initially showed `Paid: ₱0.00` for rows already marked `payment_status =
'paid'` that predate the `payable_payments` ledger for their type (e.g. the
26 historical `incoming_items` rows backfilled to `'paid'` in SP-2, and any
`opex_expenses` row created with `payment_status = 'paid'` directly at
entry time, bypassing `log_payable_payment` entirely) — the ledger sum
alone under-reports "paid" for rows that were never logged through it.
Fixed by treating `payment_status` as the ground truth: when a row's status
is `'paid'`, `paid` is forced to `total` and `remaining` to `0` regardless
of what the ledger sums to; partial/unpaid rows still use the real ledger
sum (`paidAndRemaining()` helper in `page.tsx`). The existing per-row detail
pages (`expense-detail.tsx` and this session's new Asset/Incoming detail
pages) never had this bug since they already hide the remaining-balance
text entirely once `payment_status === 'paid'`.

**Verified live** (browser, Claude admin test account, real data — nothing
rolled back):
- Supplier Payment list loads 36 rows across all 5 types with correct
  Paid/Remaining after the fix above; Type filter and Payment Status filter
  both narrow correctly (tested "Partial" → exactly 1 row).
- Logged a real ₱200 Gcash partial payment against `SRI26-0716-0026`
  (₱525 total, one of SP-4's own test receipts) via its new detail page —
  status flipped Unpaid → Partial, ₱325 remaining, Payment History shows
  the entry. Confirmed the posted journal entry: Debit `2010 Accounts
  payable` ₱200 / Credit `1124 Gcash` ₱200.
- Logged a real ₱15,000 BDO full payment against the "Water Filtration
  Unit" fixed asset (previously Unpaid, no payments existed anywhere for
  any asset since the module was built) via its new detail page — status
  flipped Unpaid → **Paid**, Log Payment button correctly disappeared,
  confirmed in both the detail page and the Fixed Assets list. This is the
  first time `log_payable_payment('asset', ...)`'s status recompute has
  ever actually run — confirms the ACCT-7.9-era gap (flagged in the
  SP-1..4 session log entry above) is fixed, not just theoretically wired.
  Confirmed the posted journal entry: Debit `2010 Accounts payable`
  ₱15,000 / Credit `1121 Bank - BDO` ₱15,000.
- No console errors on any page throughout. `npx tsc --noEmit` and
  `npm run build` both clean after every change.

All 8 Supplier Payment phases (SP-1..SP-8) are now **done**. No git commit
(standing project rule — stopped for manual review).

---
