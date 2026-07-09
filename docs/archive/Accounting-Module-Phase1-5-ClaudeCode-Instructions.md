# Sinag Ukit BMS — Accounting Module (Option A)
## Claude Code Instructions: ACCT-1 through ACCT-6

> **ARCHIVED (2026-07-09).** ACCT-1 through ACCT-6 are all built and live.
> **The ACCT-6 opening-balance figures below (₱142,532.17 Retained Earnings,
> ₱332.40 credit for account 2010) are superseded and wrong** — they were
> disproven mid-session after Sinag supplied an updated source workbook; the
> real posted figures (₱413,896.16 Retained Earnings, no 2010 line) are in
> `PROGRESS-ACCOUNTING.md`'s ACCT-6 session log. Durable conventions (RLS
> pattern, `numeric(12,2)` rationale, nav gating, category mappings) were
> moved to `PROGRESS-ACCOUNTING.md`'s "Module conventions" section. Kept
> here for historical reference (original SQL bodies, seed data) only —
> the module itself is paused, see `PROGRESS-ACCOUNTING.md`.

**Context for Claude Code:** This extends the existing Sinag Ukit BMS (Supabase project `glwskmtworldifydsihc`, Next.js frontend). These phases are self-contained — they do not touch `orders`, `purchase_orders`, or any confirm/receive RPC. Run one phase per session. Update `PROGRESS-ACCOUNTING.md` after each phase — **not** the core BMS `PROGRESS.md`. This module uses its own `ACCT-1`...`ACCT-8` phase labels specifically to avoid colliding with the core BMS's own phase numbering in `PROGRESS.md`. Migration file numbers (`0013_...` onward) remain a single shared sequence across both workstreams — only the phase *labels* are namespaced. Do not commit to git automatically — stop at the Definition of Done for manual review, per standing project rules. No new dependencies without approval.

---

## Amendments (2026-07-02 review, applied before ACCT-1 kickoff)

A documentation review against the live schema and the rest of the project's docs turned up six fixes, all folded into the sections below — noted here as a changelog so it's clear this version differs from the first draft:

1. **`accounts_delete` RLS policy removed from ACCT-1.** Conflicted with the project's soft-delete-only convention (D003). Deactivation is `is_active = false` via the existing `accounts_update` policy — no hard-delete surface on Chart of Accounts data.
2. **ACCT-4 now has an assigned migration number** (`0015_accounting_reports`), slotted between ACCT-2's `0014` and ACCT-5's `0016` — ACCT-4 runs chronologically *before* ACCT-5 in this doc's own phase order, so it needs the lower number, not a higher one (an earlier pass of this fix mistakenly assigned `0017`, which would have made a lower-numbered migration get created after a higher-numbered one). `PROGRESS-ACCOUNTING.md`'s ACCT-4 row is updated to match, and ACCT-7's placeholder (previously `0015`, now freed up) moves to `0018` since ACCT-7 is gated and runs well after ACCT-6. ACCT-6's own conditional follow-up migration (the `3099 Opening Balance Adjustment` account, only if a plug is needed) is now `0017`.
3. **ACCT-4's role check is now inline in the SQL**, not a "required before shipping" footnote — see each function body below.
4. **Nav placement and gating are now specified**: a new top-level `app/dashboard/accounting/` section, with a `NavGroup.roles: ["admin","manager"]` sidebar filter and page-level `hasAccess` checks, mirroring Finance's three-layer D016 pattern exactly.
5. **ACCT-3's category-mapping now covers Expenses, not just Income** — including two categories (`Rent`, `Transportation`) that have no matching Chart of Accounts entry and need your call before that phase runs.
6. **Money columns in ACCT-2 and ACCT-5 now use `numeric(12,2)`** instead of bare `numeric`. This is a deliberate, scoped deviation from the rest of the schema (`income.amount`, `orders.total_money`, etc. are all bare `numeric` codebase-wide) — flagged explicitly here so a future session doesn't read it as an unexplained inconsistency. Given this module's whole purpose is precision-sensitive double-entry bookkeeping, and the reason ACCT-6 is blocked at all is a rounding-drift-style imbalance in the source data, a DB-level scale constraint seemed worth the inconsistency. Revert to bare `numeric` if you'd rather stay uniform with the rest of the app.

---

## Global conventions (apply to every phase below)

- Migration naming continues the existing series: `0013_...`, `0014_...`, etc.
- snake_case identifiers, UUID PKs via `gen_random_uuid()`.
- Every new table gets `created_at timestamptz not null default now()` and, where rows are mutable, `updated_at timestamptz not null default now()` with a `before update` trigger calling the **existing** `public.set_updated_at()` function — do not create a new trigger function, reuse this one.
- Money-bearing columns (`journal_entry_lines.debit`/`credit`, `fixed_assets.cost`, `depreciation_entries.amount`) use `numeric(12,2)`, not bare `numeric`. This is a deliberate exception to the rest of the schema (see Amendments above) — don't propagate bare `numeric` from `income`/`expenses`/`orders` into this module.
- Enable RLS on every new table. Role checks use the **existing** `public.current_user_role()` function (returns the `user_role` enum: `admin`, `encoder`, `manager`, `cashier`, `viewer`).
- **Precedent to follow:** the `income`/`expenses` tables (migration `0010`) restrict select/insert/update to `admin` + `manager` only — encoder is excluded. Apply the same restriction to every new accounting table (`accounts`, `journal_entries`, `journal_entry_lines`, `fixed_assets`, `depreciation_entries`). Financial data is more sensitive than operational data like suppliers/POs, which is why those allow encoder and this shouldn't.
- Policy naming: `{table}_select`, `{table}_insert`, `{table}_update`, `{table}_delete`.
- RPCs follow the existing `confirm_order()` / `adjust_stock()` pattern: `LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'`, explicit role check as the first statement (`raise exception` if not authorized), single atomic transaction, no partial writes.
- Optional but encouraged: log postings and depreciation runs into the existing `activity_logs` table (`user_id`, `action`, `entity_type`, `entity_id`, `description`) for an audit trail — this table already exists and is already used elsewhere.
- `npm run build` must pass with zero errors before a phase is considered done.

---

## ACCT-1 — Chart of Accounts

**Migration:** `0013_accounting_chart_of_accounts`

```sql
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  account_number integer not null unique,
  name text not null,
  category text not null check (category in ('asset','liability','equity','revenue','expense')),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_accounts_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

alter table public.accounts enable row level security;

create policy accounts_select on public.accounts
  for select using (current_user_role() = any (array['admin','manager']::user_role[]));

create policy accounts_insert on public.accounts
  for insert with check (current_user_role() = 'admin'::user_role);

create policy accounts_update on public.accounts
  for update using (current_user_role() = 'admin'::user_role);
```

Note: insert/update is **admin-only** (tighter than the select policy) — Chart of Accounts structure should change rarely and deliberately. Select is admin+manager so managers can see account names when building reports later. **No delete policy is defined, on purpose** — per the project's soft-delete-only convention (D003 / `BUSINESS_RULES.md`), an account is deactivated via `is_active = false` through the existing `accounts_update` policy, never hard-deleted. `journal_entry_lines.account_id` references `accounts(id)`, so a real DELETE on a referenced account would either fail with a raw FK-violation error or (worse, if a cascade were ever added later) destroy permanent ledger history — there's no scenario where exposing a hard-delete RLS policy on Chart of Accounts data is worth that risk.

**Seed data** — extracted and corrected from your Chart of Accounts sheet. Two corrections were made and should be confirmed with you before running:
1. Excluded 6 rows that were section headers in the spreadsheet, not real accounts (account numbers `1` ASSETS, `2` LIABILITIES, `3` EQUITY, `4` REVENUES, `5` PRODUCTION EXPENSES, `6` OTHER OPERATING EXPENSE) — the `category` column on each real account already encodes this grouping, so these header rows aren't needed as rows.
2. Account `4014` was listed as "Sales Revenue - Paddle Hair Brush- Large" — a duplicate of `4013`. Cross-checked against your `Sheet2` lookup tab and the matching expense account `5014` ("Material Expense - Phone Stand"), this should be **"Sales Revenue - Phone Stand"**. Corrected below — flag to Sinag if this assumption is wrong.

```sql
insert into public.accounts (account_number, name, category) values
  (1000, 'Cash on hand', 'asset'),
  (1020, 'Bank Account', 'asset'),
  (1100, 'Accounts receivable', 'asset'),
  (1200, 'Inventory - Wood for Ref Magnet', 'asset'),
  (1201, 'Inventory - Coaster', 'asset'),
  (1202, 'Inventory - Keychain with Metal', 'asset'),
  (1203, 'Inventory - Keychain with Leather', 'asset'),
  (1204, 'Inventory - Paddle Hair Brush', 'asset'),
  (1205, 'Inventory - Magnet', 'asset'),
  (1206, 'Inventory - Kraft Paper', 'asset'),
  (1207, 'Inventory - Plastic', 'asset'),
  (1208, 'Inventory Phone Stand', 'asset'),
  (1209, 'Inventory - Bottle Opener', 'asset'),
  (1300, 'Paid expenses for the following year', 'asset'),
  (1500, 'Furniture', 'asset'),
  (1501, 'Accumulated depreciation-Furniture', 'asset'),
  (1520, 'Office Equipment', 'asset'),
  (1521, 'Accumulated depreciation-Office equipment', 'asset'),
  (1530, 'Machinery', 'asset'),
  (1531, 'Accumulated depreciation-Machinery', 'asset'),
  (1540, 'Tools and Equipment', 'asset'),
  (1541, 'Accumulated depreciation-Tools and Equipment', 'asset'),
  (1550, 'Room Improvement', 'asset'),
  (1551, 'Accumulated depreciation-Room', 'asset'),
  (2000, 'Accounts payable', 'liability'),
  (2010, 'Income taxes payable', 'liability'),
  (3000, 'Owner''s Capital', 'equity'),
  (3010, 'Owner''s Withdrawals', 'equity'),
  (3020, 'Retained Earnings', 'equity'),
  (4001, 'Sales Revenue - Ref Magnet - Round', 'revenue'),
  (4002, 'Sales Revenue - Ref Magnet - Square', 'revenue'),
  (4003, 'Sales Revenue - Ref Magnet - ATM', 'revenue'),
  (4004, 'Sales Revenue - Coaster - Round', 'revenue'),
  (4005, 'Sales Revenue - Coaster - Square', 'revenue'),
  (4006, 'Sales Revenue - Keychain Metal - Round', 'revenue'),
  (4007, 'Sales Revenue - Keychain Metal - Rectangle', 'revenue'),
  (4008, 'Sales Revenue - Keychain Metal - Oblong', 'revenue'),
  (4009, 'Sales Revenue - Keychain Metal - Square', 'revenue'),
  (4010, 'Sales Revenue - Keychain Leather', 'revenue'),
  (4011, 'Sales Revenue - Paddle Hair Brush- Small', 'revenue'),
  (4012, 'Sales Revenue - Paddle Hair Brush- Medium', 'revenue'),
  (4013, 'Sales Revenue - Paddle Hair Brush- Large', 'revenue'),
  (4014, 'Sales Revenue - Phone Stand', 'revenue'),
  (4015, 'Sales Revenue - Bottle Opener', 'revenue'),
  (4020, 'Sales Revenue - Frame', 'revenue'),
  (4030, 'Sales returns and allowances', 'revenue'),
  (4031, 'Sales discounts', 'revenue'),
  (4032, 'Commission to third parties', 'revenue'),
  (4040, 'Other Income', 'revenue'),
  (5001, 'Material Expense - Ref Magnet - Round', 'expense'),
  (5002, 'Material Expense - Ref Magnet - Square', 'expense'),
  (5003, 'Material Expense - Ref Magnet - ATM', 'expense'),
  (5004, 'Material Expense - Coaster - Round', 'expense'),
  (5005, 'Material Expense - Coaster - Square', 'expense'),
  (5006, 'Material Expense - Keychain Metal - Round', 'expense'),
  (5007, 'Material Expense - Keychain Metal - Rectangle', 'expense'),
  (5008, 'Material Expense - Keychain Metal - Oblong', 'expense'),
  (5009, 'Material Expense - Keychain Metal - Square', 'expense'),
  (5010, 'Material Expense - Keychain Leather', 'expense'),
  (5011, 'Material Expense - Paddle Hair Brush- Small', 'expense'),
  (5012, 'Material Expense - Paddle Hair Brush- Medium', 'expense'),
  (5013, 'Material Expense - Paddle Hair Brush- Large', 'expense'),
  (5014, 'Material Expense - Phone Stand', 'expense'),
  (5015, 'Material Expense - Bottle Opener', 'expense'),
  (5020, 'Material Expense - Frame', 'expense'),
  (5021, 'Material Expense - Others', 'expense'),
  (5030, 'Supplier Discounts', 'expense'),
  (5040, 'Sampling Materials', 'expense'),
  (5050, 'Wood Sheets', 'expense'),
  (5060, 'Packaging Expense', 'expense'),
  (5070, 'Shipping expense- in', 'expense'),
  (5071, 'Shipping expense- out', 'expense'),
  (6000, 'Depreciation expense-Furniture', 'expense'),
  (6001, 'Depreciation expense-Office equipment', 'expense'),
  (6002, 'Depreciation expense-Machinery', 'expense'),
  (6003, 'Depreciation expense-Tools', 'expense'),
  (6004, 'Depreciation expense-Room improvements', 'expense'),
  (6005, 'Labor Expense', 'expense'),
  (6010, 'MRR for Furniture', 'expense'),
  (6011, 'MRR for Office Equipment', 'expense'),
  (6012, 'MRR for Machinery', 'expense'),
  (6013, 'MRR for Room Improvement', 'expense'),
  (6014, 'Small tools and furnitures and fixtures', 'expense'),
  (6020, 'Electricty', 'expense'),
  (6030, 'Office Supplies', 'expense'),
  (6031, 'Postage', 'expense'),
  (6040, 'IT Licenses', 'expense'),
  (6041, 'Other IT Expenses', 'expense'),
  (6050, 'Advertising Expenses', 'expense'),
  (6051, 'Printed Ads', 'expense'),
  (6052, 'Other Marketing expenses', 'expense'),
  (6060, 'Permits and Licenses', 'expense'),
  (6070, 'Customer Gifts', 'expense'),
  (6080, 'Other Expenses', 'expense'),
  (7000, 'Income Taxes', 'expense');
```

**Definition of Done**
- [ ] Migration applied, 95 accounts present
- [ ] `select category, count(*) from accounts group by category` matches expected counts (24 asset, 2 liability, 3 equity, 20 revenue, 46 expense — verify against source)
- [ ] Manager-role test user can `select` but not `insert`/`update`
- [ ] Encoder-role test user gets zero rows on select (RLS blocks, not an error)
- [ ] `npm run build` passes

---

## ACCT-2 — Journal Core

This is the load-bearing phase — recommend running with Opus given the correctness requirements (matches your own model-split preference for architecture-critical work).

**Migration:** `0014_accounting_journal_core`

```sql
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null default current_date,
  description text not null,
  source_type text not null default 'manual'
    check (source_type in ('manual','order','purchase_order','depreciation','opening_balance')),
  source_id uuid,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references public.journal_entries(id) on delete cascade,
  account_id uuid not null references public.accounts(id),
  debit numeric(12,2) not null default 0 check (debit >= 0),
  credit numeric(12,2) not null default 0 check (credit >= 0),
  memo text,
  line_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint journal_entry_lines_one_side check (
    (debit = 0 and credit > 0) or (debit > 0 and credit = 0)
  )
);

create index on public.journal_entry_lines (journal_entry_id);
create index on public.journal_entry_lines (account_id);
create index on public.journal_entries (entry_date);
create index on public.journal_entries (source_type, source_id);

alter table public.journal_entries enable row level security;
alter table public.journal_entry_lines enable row level security;

-- Read access for admin/manager. No direct INSERT/UPDATE/DELETE policies —
-- all writes must go through post_journal_entry() below (SECURITY DEFINER
-- bypasses RLS, so the RPC is the only write path). This mirrors how
-- confirm_order() is the only way inventory_movements gets written for orders.
create policy journal_entries_select on public.journal_entries
  for select using (current_user_role() = any (array['admin','manager']::user_role[]));

create policy journal_entry_lines_select on public.journal_entry_lines
  for select using (current_user_role() = any (array['admin','manager']::user_role[]));
```

**The posting RPC** — the only path by which journal entries can be created. Takes lines as JSONB so both the UI (ACCT-3) and later automated posting (order confirmation, depreciation) can call it the same way.

```sql
create or replace function public.post_journal_entry(
  p_entry_date date,
  p_description text,
  p_lines jsonb,            -- [{"account_number": 1020, "debit": 500, "credit": 0, "memo": "..."}, ...]
  p_source_type text default 'manual',
  p_source_id uuid default null
)
returns public.journal_entries
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_entry        public.journal_entries;
  v_total_debit  numeric;
  v_total_credit numeric;
  v_line_count   integer;
  v_bad_account  text;
begin
  if current_user_role() not in ('admin','manager') then
    raise exception 'Not authorized to post journal entries';
  end if;

  select count(*) into v_line_count from jsonb_array_elements(p_lines);
  if v_line_count < 2 then
    raise exception 'A journal entry needs at least 2 lines';
  end if;

  select sum((l->>'debit')::numeric), sum((l->>'credit')::numeric)
  into v_total_debit, v_total_credit
  from jsonb_array_elements(p_lines) l;

  if round(coalesce(v_total_debit,0), 2) <> round(coalesce(v_total_credit,0), 2) then
    raise exception 'Entry does not balance: debits % vs credits %', v_total_debit, v_total_credit;
  end if;

  select string_agg((l->>'account_number'), ', ')
  into v_bad_account
  from jsonb_array_elements(p_lines) l
  where not exists (
    select 1 from public.accounts a
    where a.account_number = (l->>'account_number')::integer and a.is_active
  );
  if v_bad_account is not null then
    raise exception 'Unknown or inactive account number(s): %', v_bad_account;
  end if;

  insert into public.journal_entries (entry_date, description, source_type, source_id, created_by)
  values (p_entry_date, p_description, p_source_type, p_source_id, auth.uid())
  returning * into v_entry;

  insert into public.journal_entry_lines (journal_entry_id, account_id, debit, credit, memo, line_order)
  select v_entry.id,
         a.id,
         coalesce((l->>'debit')::numeric, 0),
         coalesce((l->>'credit')::numeric, 0),
         l->>'memo',
         ord - 1
  from jsonb_array_elements(p_lines) with ordinality as t(l, ord)
  join public.accounts a on a.account_number = (l->>'account_number')::integer;

  return v_entry;
end;
$function$;
```

**Definition of Done**
- [ ] Balanced test entry (e.g. Dr Bank Account 1020 / Cr Owner's Capital 3000, ₱50,000 each) posts successfully
- [ ] Unbalanced entry is rejected with a clear error, no partial rows left behind (check `journal_entries` and `journal_entry_lines` are both empty after a failed attempt)
- [ ] Entry with an invalid account number is rejected before any insert happens
- [ ] Encoder-role user cannot call `post_journal_entry` (gets the authorization exception)
- [ ] `npm run build` passes

---

## ACCT-3 — Manual Entry UI + Retire income/expenses

**Route & nav placement (decided in the 2026-07-02 review):** new top-level `app/dashboard/accounting/` section — not nested under Finance. Add an `Accounting` `NavGroup` to `components/layout/app-shell.tsx` with `roles: ["admin","manager"]`, mirroring the Finance group's filter exactly. Every new page also needs its own page-level `hasAccess` check (don't rely on the sidebar filter alone) — this is the same three-layer pattern D016 already established for Finance. Finance's own nav group and its `income`/`expenses` pages stay in place per the retirement plan below; don't delete or merge them into Accounting.

**UI**
- A posting form: entry date, description, and a dynamic list of lines (account picker searching by number or name, debit amount, credit amount, memo).
- Running balance indicator showing `sum(debit) - sum(credit)` live; disable submit until it's exactly 0.
- On submit, call `post_journal_entry()` with the assembled JSONB payload.
- A simple journal list/detail view (admin+manager) to browse posted entries — this doubles as your first real report.

**Retiring `income` / `expenses`**

The existing rows use a free-text `category` field that doesn't map cleanly to account numbers. Confirm both mapping tables with Sinag before converting — especially the two Expense categories flagged below with no clean match.

*Income* — current live values as of this writing: `"Sales2"`, `"Service Revenue"`, `"Sales"` — these look like test data from earlier verification, not real transactions, but confirm with Sinag before converting/discarding.

| Income category | Account |
|---|---|
| `Sales` / `Sales2` | 4040 Other Income (or a more specific revenue account if the real category is known) |
| `Service Revenue` | 4040 Other Income, unless a dedicated account is wanted |

*Expenses* — Phase 20 defined a fixed 8-value category list for the Expenses form; live rows already exist against at least two of them (`Salaries & Wages` ₱500, `Utilities` ₱400, per Phase 25's verification data). Proposed mapping against the ACCT-1 Chart of Accounts:

| Expense category | Account | Note |
|---|---|---|
| Supplies | 6030 Office Supplies | |
| Utilities | 6020 Electricty *(sic — matches the existing account's name/typo)* | confirm this account should cover "Utilities" broadly, not just electricity |
| Rent | **no matching account exists** | needs a decision: add a new account (e.g. `6090 Rent Expense`) via a small follow-up migration, or map to 6080 Other Expenses if rent isn't a real recurring cost |
| Salaries & Wages | 6005 Labor Expense | |
| Marketing | 6052 Other Marketing expenses | or split into 6050 Advertising / 6051 Printed Ads per-row if the original note makes the split traceable |
| Transportation | **no clean match** | 6080 Other Expenses, unless Sinag wants a dedicated account |
| Equipment & Maintenance | 6010–6013 (MRR-for-Furniture/Office Equipment/Machinery/Room) | no single bucket — needs per-row judgment based on which asset category the entry relates to |
| Taxes & Fees | 6060 Permits and Licenses, or 7000 Income Taxes | per-row judgment depending on which the entry actually is |
| Other | 6080 Other Expenses | |

**Do not run the conversion until Sinag has confirmed the `Rent` and `Transportation` rows above** — everything else in both tables is a reasonably confident default.

1. For each `income` row: call `post_journal_entry()` with `source_type = 'manual'`, lines `[Dr 1020 Bank Account: amount, Cr <mapped revenue account>: amount]`.
2. For each `expenses` row: `[Dr <mapped expense account>: amount, Cr 1020 Bank Account: amount]`.
3. Do **not** drop the `income`/`expenses` tables. Stop writing to them (remove/redirect their UI entry points to the new journal form) but keep them as read-only historical reference. Add a code comment noting they're deprecated in favor of `journal_entries`.

**Definition of Done**
- [ ] Both category-mapping tables (Income and Expenses) confirmed with Sinag, including the Rent/Transportation decision
- [ ] Manual entry form posts a balanced entry end-to-end through the UI
- [ ] Submit is disabled while the entry is unbalanced
- [ ] All existing `income`/`expenses` rows have a corresponding `journal_entries` row (spot-check amounts match)
- [ ] Old income/expense entry points in the UI are removed or redirect to the new form
- [ ] New `Accounting` sidebar `NavGroup` is admin/manager-only and every new page has its own `hasAccess` check
- [ ] `npm run build` passes

---

## ACCT-4 — Financial Reports

**Migration:** `0016_accounting_reports` *(was `0015`; renumbered 2026-07-02 when ACCT-3 consumed `0015` for the `6015 Rent Expense` account — see PROGRESS-ACCOUNTING.md)*

These read `journal_entries`/`journal_entry_lines` directly — they work the same whether entries came from manual posting (ACCT-1 through ACCT-3) or later automated posting (ACCT-7, order/PO integration). No dependency on that later phase.

**Note on the role check:** the original draft of this phase specified these as `language sql` functions with the role check "added before shipping" as a footnote. That doesn't actually work — a plain SQL function body is just a `select`, it can't contain an `if`/`raise exception`. Converted to `language plpgsql` below with `return query` and an explicit role check as the first statement, matching the `post_journal_entry()` pattern from ACCT-2. This is the only change from the original draft; the query logic itself is unchanged.

```sql
create or replace function public.get_trial_balance(p_as_of date default current_date)
returns table (
  account_number integer,
  account_name text,
  category text,
  debit_balance numeric,
  credit_balance numeric
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if current_user_role() not in ('admin','manager') then
    raise exception 'Not authorized to view financial reports';
  end if;

  return query
    select a.account_number, a.name, a.category,
           greatest(sum(l.debit) - sum(l.credit), 0) as debit_balance,
           greatest(sum(l.credit) - sum(l.debit), 0) as credit_balance
    from public.accounts a
    join public.journal_entry_lines l on l.account_id = a.id
    join public.journal_entries e on e.id = l.journal_entry_id
    where e.entry_date <= p_as_of
    group by a.account_number, a.name, a.category
    order by a.account_number;
end;
$function$;

create or replace function public.get_income_statement(p_start date, p_end date)
returns table (
  account_number integer,
  account_name text,
  category text,
  amount numeric
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if current_user_role() not in ('admin','manager') then
    raise exception 'Not authorized to view financial reports';
  end if;

  return query
    select a.account_number, a.name, a.category,
           case when a.category = 'revenue' then sum(l.credit) - sum(l.debit)
                else sum(l.debit) - sum(l.credit) end as amount
    from public.accounts a
    join public.journal_entry_lines l on l.account_id = a.id
    join public.journal_entries e on e.id = l.journal_entry_id
    where a.category in ('revenue','expense')
      and e.entry_date between p_start and p_end
    group by a.account_number, a.name, a.category
    order by a.category desc, a.account_number;
end;
$function$;

create or replace function public.get_balance_sheet(p_as_of date default current_date)
returns table (
  account_number integer,
  account_name text,
  category text,
  amount numeric
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if current_user_role() not in ('admin','manager') then
    raise exception 'Not authorized to view financial reports';
  end if;

  return query
    select a.account_number, a.name, a.category,
           case when a.category = 'asset' then sum(l.debit) - sum(l.credit)
                else sum(l.credit) - sum(l.debit) end as amount
    from public.accounts a
    join public.journal_entry_lines l on l.account_id = a.id
    join public.journal_entries e on e.id = l.journal_entry_id
    where a.category in ('asset','liability','equity')
      and e.entry_date <= p_as_of
    group by a.account_number, a.name, a.category
    order by a.category, a.account_number;
end;
$function$;
```

**UI:** three read-only report pages (Trial Balance, Income Statement with date range picker, Balance Sheet with as-of date picker), under the `app/dashboard/accounting/` section established in ACCT-3 — same `Accounting` `NavGroup` (admin/manager-only) and page-level `hasAccess` check, no separate gating setup needed here.

**Definition of Done**
- [ ] All three functions are `language plpgsql` with the role check as their first statement — confirmed a `viewer`/`cashier`/`encoder` test call raises the authorization exception, not just returns empty rows
- [ ] Trial balance total debits = total credits (sanity check on the whole ledger)
- [ ] Income Statement net income matches a hand-calculated total from your ACCT-3 test entries
- [ ] Balance Sheet: assets = liabilities + equity, verified on test data
- [ ] `npm run build` passes

---

## ACCT-5 — Fixed Assets & Depreciation

**Migration:** `0017_accounting_fixed_assets` *(was `0016`; +1 from the ACCT-3 renumber)*

```sql
create table public.fixed_assets (
  id uuid primary key default gen_random_uuid(),
  asset_account_id uuid not null references public.accounts(id),
  accum_depreciation_account_id uuid not null references public.accounts(id),
  depreciation_expense_account_id uuid not null references public.accounts(id),
  name text not null,
  purchased_date date not null,
  cost numeric(12,2) not null check (cost > 0),
  useful_life_months integer not null check (useful_life_months > 0),
  disposed_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_fixed_assets_updated_at
  before update on public.fixed_assets
  for each row execute function public.set_updated_at();

create table public.depreciation_entries (
  id uuid primary key default gen_random_uuid(),
  fixed_asset_id uuid not null references public.fixed_assets(id),
  period_month date not null,   -- store as first-of-month for uniqueness
  amount numeric(12,2) not null check (amount >= 0),
  journal_entry_id uuid references public.journal_entries(id),
  created_at timestamptz not null default now(),
  unique (fixed_asset_id, period_month)
);

alter table public.fixed_assets enable row level security;
alter table public.depreciation_entries enable row level security;

create policy fixed_assets_select on public.fixed_assets
  for select using (current_user_role() = any (array['admin','manager']::user_role[]));
create policy fixed_assets_insert on public.fixed_assets
  for insert with check (current_user_role() = 'admin'::user_role);
create policy fixed_assets_update on public.fixed_assets
  for update using (current_user_role() = 'admin'::user_role);

create policy depreciation_entries_select on public.depreciation_entries
  for select using (current_user_role() = any (array['admin','manager']::user_role[]));
```

**Seed data**, from your Depreciation Table sheet (both assets show a 24-month useful life: `=D4/24` style formulas):

```sql
insert into public.fixed_assets
  (asset_account_id, accum_depreciation_account_id, depreciation_expense_account_id,
   name, purchased_date, cost, useful_life_months)
select a1.id, a2.id, a3.id, v.name, v.purchased_date, v.cost, v.useful_life_months
from (values
  ('Canon Printer',        date '2024-05-19', 3339.00, 24, 1520, 1521, 6001),
  ('Sculpfan S30 Pro Max',  date '2024-03-10', 22900.00, 24, 1530, 1531, 6002),
  ('RK Royal Kludge',       date '2024-03-10', 2050.00, 24, 1530, 1531, 6002)
) as v(name, purchased_date, cost, useful_life_months, asset_no, accum_no, exp_no)
join public.accounts a1 on a1.account_number = v.asset_no
join public.accounts a2 on a2.account_number = v.accum_no
join public.accounts a3 on a3.account_number = v.exp_no;
```

This only covers the two Depreciation Table entries with concrete purchase dates/costs visible in the sheet — Sinag should confirm whether Furniture (1500), Tools and Equipment (1540), and Room Improvement (1550) have assets to add too; the sheet structure suggests those categories exist but weren't populated with line items yet.

**Monthly depreciation RPC:**

```sql
create or replace function public.run_monthly_depreciation(p_period date)
returns setof public.depreciation_entries
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_period_start date := date_trunc('month', p_period)::date;
  v_asset record;
  v_monthly numeric;
  v_entry public.journal_entries;
  v_dep public.depreciation_entries;
begin
  if current_user_role() <> 'admin'::user_role then
    raise exception 'Not authorized to run depreciation';
  end if;

  for v_asset in
    select fa.*, aa.account_number as asset_no,
           ada.account_number as accum_no, dea.account_number as exp_no
    from public.fixed_assets fa
    join public.accounts aa on aa.id = fa.asset_account_id
    join public.accounts ada on ada.id = fa.accum_depreciation_account_id
    join public.accounts dea on dea.id = fa.depreciation_expense_account_id
    where fa.disposed_at is null
      and fa.purchased_date <= v_period_start
      and not exists (
        select 1 from public.depreciation_entries de
        where de.fixed_asset_id = fa.id and de.period_month = v_period_start
      )
  loop
    v_monthly := round(v_asset.cost / v_asset.useful_life_months, 2);

    select coalesce(sum(amount), 0) into v_monthly
    from (select v_monthly as amount) x
    where (
      select coalesce(sum(amount), 0) from public.depreciation_entries
      where fixed_asset_id = v_asset.id
    ) + v_monthly <= v_asset.cost;
    -- if this asset is already fully depreciated, v_monthly comes back 0; skip posting

    if v_monthly > 0 then
      v_entry := public.post_journal_entry(
        p_entry_date   => (v_period_start + interval '1 month - 1 day')::date,
        p_description  => format('Depreciation - %s - %s', v_asset.name, to_char(v_period_start, 'Mon YYYY')),
        p_lines         => jsonb_build_array(
          jsonb_build_object('account_number', v_asset.exp_no, 'debit', v_monthly, 'credit', 0),
          jsonb_build_object('account_number', v_asset.accum_no, 'debit', 0, 'credit', v_monthly)
        ),
        p_source_type  => 'depreciation',
        p_source_id    => v_asset.id
      );

      insert into public.depreciation_entries (fixed_asset_id, period_month, amount, journal_entry_id)
      values (v_asset.id, v_period_start, v_monthly, v_entry.id)
      returning * into v_dep;

      return next v_dep;
    end if;
  end loop;
  return;
end;
$function$;
```

Note: `post_journal_entry()` currently requires `admin` or `manager`; since this function requires `admin` and calls it internally, that's satisfied. The fully-depreciated check above is a simple guard — worth having Claude Code double-check the rounding logic against a couple of manual examples before trusting it, since off-by-one-cent errors compound over 24 months.

**UI:** a single admin-only "Run Depreciation" button for the current (or a selected) month, showing a preview of what will be posted before confirming. No scheduled/automated run yet — manual trigger only, per the earlier decision to avoid n8n cron until the module is proven.

**Definition of Done**
- [ ] Running for a given month posts one balanced journal entry per active fixed asset
- [ ] Running the same month twice does not double-post (unique constraint holds, function skips already-posted assets)
- [ ] An asset that has reached its full cost in accumulated depreciation stops generating entries
- [ ] Balance Sheet accumulated depreciation balance for each asset matches what your Excel Depreciation Table shows for the same period
- [ ] `npm run build` passes

---

## Final check after ACCT-5

Run this to confirm the whole ledger is internally consistent before moving to ACCT-6 (historical import) or ACCT-7 (order/PO auto-posting):

```sql
select
  sum(debit) as total_debits,
  sum(credit) as total_credits,
  sum(debit) - sum(credit) as difference
from public.journal_entry_lines;
```

`difference` should always be exactly `0`. If it isn't, something bypassed `post_journal_entry()` — check for direct table writes anywhere in the codebase.

---

## ACCT-6 — Historical Import (Opening Balance)

**Do not run this until Sinag has reviewed the reconciliation findings below.** This isn't boilerplate caution — checking the actual numbers turned up a real imbalance in the source spreadsheet that needs a human decision, not a script.

### What I found checking your General Ledger directly

Summing all 1,711 rows' Debit and Credit columns per account (not trusting the sheet's own SUMIF formulas, which reference a derived helper column that may not be populated consistently across all rows):

- **Total debits: ₱3,055,957.67 — Total credits: ₱3,053,173.64 — difference: ₱2,784.03.** The raw ledger itself doesn't balance. This is separate from, and more fundamental than, any formula issue in the Balance Statement tab.
- **Owner's Capital (3000)** nets to ₱0 across the ledger, even though the very first two GL rows show a clean ₱50,000 capital investment (Dr Bank / Cr Owner's Capital). Something later in the 1,711 rows debits account 3000 by ₱50,000 again — possibly an owner's withdrawal that was booked against the wrong account (there's a dedicated `3010 Owner's Withdrawals` account that shows zero activity at all, which supports this theory).
- **Retained Earnings (3020)** has only two entries in the raw ledger — a ₱1,392.02 debit ("to close RE fy2024") and a ₱141,140.15 credit ("to close 2025 RE") — netting to ₱139,748.14. The Balance Statement tab shows ₱414,228.56 for this row instead, a ~₱275K gap. That tab's formula almost certainly isn't summing what's actually posted to 3020.
- **Machinery (1530) / Accum. Depreciation (1531)** net to exactly ₱0 in the ledger, because of a "closing of equipment and machine" entry in March 2025 that reversed the original asset cost entirely. But your separate Depreciation Table sheet shows the same two machines (Sculpfan S30 Pro Max + RK Royal Kludge, ₱24,950 combined cost) still being depreciated on schedule through April 2026, where they become **fully depreciated**. The GL and the Depreciation Table disagree with each other — they were never actually linked. Good news: this is already handled correctly, since ACCT-5 seeds these assets from the Depreciation Table (the trustworthy source), not from the GL.
- Everything else — all the inventory, revenue, and expense accounts — nets to sensible, internally consistent values with no red flags.

### Resolution (confirmed by Sinag, 2026-07-02)

1. **Ledger imbalance — root cause found, not a plug.** The GL row dated 01-Jan-25, account 3020 Retained Earnings, "to close RE fy2024" (spreadsheet cell E316) was entered as a **debit** of 1,392.01666666667 (displays as ₱1,392.02) but belongs in the **credit** column (F316) — confirmed against the source spreadsheet. Moving it: `2,784.03 − (2 × 1,392.01666666667) ≈ −₱0.0033`. The ledger-wide imbalance closes to a third of a centavo, which rounds to exactly ₱0.00 once posted through `post_journal_entry()`'s `numeric(12,2)` columns. **No `3099 Opening Balance Adjustment` plug account is needed** — struck from the build steps and table below.
   - Knock-on effect: 3020 Retained Earnings' true net is **₱142,532.17 credit** (₱141,140.15 + ₱1,392.02 once both entries are credits), not the ₱139,748.14 originally computed from the ledger with the row still mis-signed.
2. **Owner's Capital / Withdrawals — confirmed.** The ₱50,000 debit that offset the original Dr Bank / Cr Owner's Capital investment in account 3000 is a misclassified owner's withdrawal. Reclassified to **3010 Owner's Withdrawals**.
   - 3000 Owner's Capital nets to **₱50,000.00 credit**.
   - 3010 Owner's Withdrawals nets to **₱50,000.00 debit**.

Both figures are folded into the opening balance table below; no open items remain for this phase.

### Recommended cutover date

**June 30, 2026** — this is the last transaction date in your GL (entries run 2024-03-01 through 2026-06-30), so it's a clean cutoff with no partial-month gap, and it's before today (July 2).

### Recommended opening balance entry (pending the two confirmations above)

Real, non-zero balances as of June 30, 2026, computed directly from the ledger:

| Account | Debit | Credit |
|---|---:|---:|
| 1020 Bank Account | 392,976.12 | |
| 1200 Inventory - Wood for Ref Magnet | 7,457.90 | |
| 1201 Inventory - Coaster | 884.00 | |
| 1202 Inventory - Keychain with Metal | 2,204.00 | |
| 1203 Inventory - Keychain with Leather | 9,620.87 | |
| 1204 Inventory - Paddle Hair Brush | 390.69 | |
| 1208 Inventory Phone Stand | 92.18 | |
| 1209 Inventory - Bottle Opener | 270.40 | |
| 1520 Office Equipment (gross cost, from Depreciation Table) | 3,339.00 | |
| 1521 Accum. Depreciation - Office Equipment (fully depreciated) | | 3,339.00 |
| 1530 Machinery (gross cost, from Depreciation Table) | 24,950.00 | |
| 1531 Accum. Depreciation - Machinery (fully depreciated) | | 24,950.00 |
| 2010 Income taxes payable | | 332.40 |
| 3000 Owner's Capital | | 50,000.00 |
| 3010 Owner's Withdrawals | 50,000.00 | |
| 3020 Retained Earnings | | 142,532.17 |

All accounts with a genuine ₱0.00 net (Cash on hand, Accounts receivable, Inventory - Magnet/Kraft Paper/Plastic, Furniture, Tools and Equipment, Room Improvement, Accounts payable) are omitted — no line needed for a zero balance. No `3099 Opening Balance Adjustment` line either — per the Resolution above, the ledger balances to within ₱0.0033 (rounds to ₱0.00) once the 3020 debit/credit fix is applied, so no plug is required.

**Check before posting:** the table assumes the ₱50,000 debit against 3000 is a single GL entry, not several smaller ones summing to ₱50,000 — spot-check the source sheet for that before running step 3 below.

### Build steps for Claude Code

1. ~~Confirm the two open items with Sinag~~ — done 2026-07-02, see Resolution above. Table is finalized.
2. ~~Add `3099 Opening Balance Adjustment`~~ — not needed. The `0018_accounting_opening_balance_adjustment` migration is **skipped**; no new account required.
3. Call `post_journal_entry()` once with `entry_date => '2026-06-30'`, `source_type => 'opening_balance'`, and all lines from the finalized table — it will reject the call automatically if it doesn't balance, which is exactly the safety net this data needs.
4. Do **not** attempt to import all 1,711 individual GL rows — the source data's own internal imbalance makes row-by-row import more risky than valuable. One clean opening entry, going forward everything is captured properly by ACCT-2/ACCT-3/ACCT-7.

**Definition of Done**
- [x] Both open items confirmed with Sinag (2026-07-02) — see Resolution above
- [ ] Opening balance entry posts as a single balanced journal entry
- [ ] Post-import Trial Balance (ACCT-4) matches the finalized table above exactly
- [ ] Global balance check (query above) still returns `difference = 0`
- [ ] `npm run build` passes
