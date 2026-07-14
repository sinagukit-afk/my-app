import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/business/stat-card";
import { DateRangeFilter } from "@/components/business/date-range-filter";
import { BarChart, type BarChartDatum } from "@/components/business/bar-chart";
import {
  ExpenseBreakdownTable,
  type ExpenseCategoryRow,
} from "@/app/dashboard/finance/profit-loss/expense-breakdown-table";

type SearchParams = Promise<{ from?: string; to?: string }>;

const REVENUE_STATUSES = ["confirmed", "in_production", "delivered", "completed"];

function money(v: number) {
  return `₱${v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDayLabel(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

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

  // Same revenue definition/filter as Finance > Profit & Loss (Phase 21) and
  // Analytics > Sales Report (Phase 22): confirmed+ orders, dated by created_at.
  let revenueQuery = supabase
    .from("orders")
    .select("total_money, created_at")
    .in("status", REVENUE_STATUSES);
  // Same expense query as Finance > Cash Flow / Profit & Loss (Phase 20/21).
  let expenseQuery = supabase.from("expenses").select("date, category, amount").is("deleted_at", null);

  if (from) {
    revenueQuery = revenueQuery.gte("created_at", `${from}T00:00:00`);
    expenseQuery = expenseQuery.gte("date", from);
  }
  if (to) {
    revenueQuery = revenueQuery.lte("created_at", `${to}T23:59:59.999`);
    expenseQuery = expenseQuery.lte("date", to);
  }

  const [{ data: orderRows, error: revenueError }, { data: expenseRows, error: expenseError }] = await Promise.all([
    revenueQuery.order("created_at"),
    expenseQuery.order("date"),
  ]);

  const orders = orderRows ?? [];
  const expenses = expenseRows ?? [];

  const revenue = orders.reduce((sum, r) => sum + Number(r.total_money), 0);
  const totalExpenses = expenses.reduce((sum, r) => sum + Number(r.amount), 0);
  const netMargin = revenue - totalExpenses;
  const marginPct = revenue > 0 ? (netMargin / revenue) * 100 : 0;

  const revenueByDate = new Map<string, number>();
  for (const order of orders) {
    const date = order.created_at.slice(0, 10);
    revenueByDate.set(date, (revenueByDate.get(date) ?? 0) + Number(order.total_money));
  }
  const revenueChartData: BarChartDatum[] = Array.from(revenueByDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ label: formatDayLabel(date), value: amount }));

  const expenseByDate = new Map<string, number>();
  const expenseByCategory = new Map<string, number>();
  for (const e of expenses) {
    expenseByDate.set(e.date, (expenseByDate.get(e.date) ?? 0) + Number(e.amount));
    expenseByCategory.set(e.category, (expenseByCategory.get(e.category) ?? 0) + Number(e.amount));
  }
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
          order creation time — same convention as the Profit &amp; Loss and Sales reports, since
          the database has no separate order-confirmation timestamp. This page is restricted to
          Admin/Manager (matching Finance), even though the Analytics sidebar group itself has no
          role restriction.
        </CardContent>
      </Card>
    </div>
  );
}
