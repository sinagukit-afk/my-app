import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/business/stat-card";
import { DateRangeFilter } from "@/components/business/date-range-filter";
import { BarChart, type BarChartDatum } from "@/components/business/bar-chart";
import {
  ExpenseBreakdownTable,
  type ExpenseCategoryRow,
} from "./expense-breakdown-table";

type SearchParams = Promise<{ from?: string; to?: string }>;

const REVENUE_STATUSES = ["confirmed", "in_production", "delivered", "completed"];

function money(v: number) {
  return `₱${v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDayLabel(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

type ExpenseLineRow = { debit: number; credit: number; accounts: { name: string; category: string } | { name: string; category: string }[] | null };
type ExpenseEntryRow = { entry_date: string; journal_entry_lines: ExpenseLineRow | ExpenseLineRow[] | null };

export default async function FinancialReportPage({ searchParams }: { searchParams: SearchParams }) {
  const { from = "", to = "" } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const hasAccess = ["admin", "manager"].includes(role);

  if (!hasAccess) {
    return (
      <div>
        <PageHeader
          title="Financial Report"
          description="Consolidated view of revenue, expenses, and margin across the business."
        />
        <Card className="max-w-lg">
          <CardContent className="p-4 text-sm text-(--color-text-muted)">
            Finance records are restricted to Admin and Manager roles. Contact an
            administrator if you need access.
          </CardContent>
        </Card>
      </div>
    );
  }

  // Same revenue definition/filter as Analytics > Sales Report (Phase 22):
  // confirmed+ orders, dated by created_at.
  let revenueQuery = supabase
    .from("orders")
    .select("total_money, created_at")
    .in("status", REVENUE_STATUSES);
  // Expenses now sourced from the posted ledger (journal_entries/journal_entry_lines),
  // same as Accounting's Profit & Loss — the old `expenses` table is a dead pre-migration
  // archive nothing writes to anymore (see /dashboard/finance/income for the same note on
  // its sibling `income` table).
  let expenseQuery = supabase
    .from("journal_entries")
    .select("entry_date, journal_entry_lines(debit, credit, accounts(name, category))")
    .returns<ExpenseEntryRow[]>();

  if (from) {
    revenueQuery = revenueQuery.gte("created_at", `${from}T00:00:00`);
    expenseQuery = expenseQuery.gte("entry_date", from);
  }
  if (to) {
    revenueQuery = revenueQuery.lte("created_at", `${to}T23:59:59.999`);
    expenseQuery = expenseQuery.lte("entry_date", to);
  }

  const [{ data: orderRows, error: revenueError }, { data: expenseEntryRows, error: expenseError }] = await Promise.all([
    revenueQuery.order("created_at"),
    expenseQuery.order("entry_date"),
  ]);

  const orders = orderRows ?? [];

  const revenue = orders.reduce((sum, r) => sum + Number(r.total_money), 0);

  const revenueByDate = new Map<string, number>();
  for (const order of orders) {
    const date = order.created_at.slice(0, 10);
    revenueByDate.set(date, (revenueByDate.get(date) ?? 0) + Number(order.total_money));
  }
  const revenueChartData: BarChartDatum[] = Array.from(revenueByDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ label: formatDayLabel(date), value: amount }));

  // Flatten every journal line posted to an expense-category account. An expense line is
  // always a debit (expenses increase with debit); net debit-credit handles the rare
  // contra/reversal line without double-counting.
  let totalExpenses = 0;
  const expenseByDate = new Map<string, number>();
  const expenseByCategory = new Map<string, number>();
  for (const entry of expenseEntryRows ?? []) {
    const lines = Array.isArray(entry.journal_entry_lines)
      ? entry.journal_entry_lines
      : entry.journal_entry_lines
        ? [entry.journal_entry_lines]
        : [];
    for (const line of lines) {
      const account = firstOf(line.accounts);
      if (!account || account.category !== "expense") continue;
      const amount = Number(line.debit) - Number(line.credit);
      if (amount === 0) continue;
      totalExpenses += amount;
      expenseByDate.set(entry.entry_date, (expenseByDate.get(entry.entry_date) ?? 0) + amount);
      expenseByCategory.set(account.name, (expenseByCategory.get(account.name) ?? 0) + amount);
    }
  }
  const netMargin = revenue - totalExpenses;
  const marginPct = revenue > 0 ? (netMargin / revenue) * 100 : 0;
  const expenseChartData: BarChartDatum[] = Array.from(expenseByDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ label: formatDayLabel(date), value: amount }));

  const expenseCategoryRows: ExpenseCategoryRow[] = Array.from(expenseByCategory.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Report"
        description="Consolidated view of revenue, expenses, and margin across the business."
      />

      <DateRangeFilter from={from} to={to} />

      {(revenueError || expenseError) && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load financial report data: {revenueError?.message ?? expenseError?.message}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Revenue" value={money(revenue)} trend="up" delta={`${orders.length} orders`} />
        <StatCard label="Expenses" value={money(totalExpenses)} trend="down" />
        <StatCard
          label="Net Margin"
          value={money(netMargin)}
          trend={netMargin >= 0 ? "up" : "down"}
        />
        <StatCard
          label="Margin %"
          value={`${marginPct.toFixed(1)}%`}
          trend={marginPct >= 0 ? "up" : "down"}
        />
      </div>

      <Card>
        <CardContent className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-(--color-text)">Revenue by Day</h2>
          <BarChart data={revenueChartData} valueFormatter={money} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-(--color-text)">Expenses by Day</h2>
          <BarChart data={expenseChartData} valueFormatter={money} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-(--color-text)">Expense Breakdown by Category</h2>
          <ExpenseBreakdownTable data={expenseCategoryRows} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 text-xs text-(--color-text-muted)">
          Revenue includes orders with status confirmed, in production, or completed, dated by
          order creation time — same convention as the Sales report, since the database has no
          separate order-confirmation timestamp, so it may not match Accounting&apos;s Profit &amp;
          Loss revenue exactly. Expenses are posted-ledger figures (the same source Profit &amp;
          Loss uses) and should match it for the same date range. This page is restricted to
          Admin/Manager (matching Accounting), even though the Analytics sidebar group itself
          has no role restriction.
        </CardContent>
      </Card>
    </div>
  );
}
