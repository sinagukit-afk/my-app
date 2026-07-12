import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/business/stat-card";
import { DateRangeFilter } from "@/components/business/date-range-filter";
import { ExpenseBreakdownTable, type ExpenseCategoryRow } from "./expense-breakdown-table";

type SearchParams = Promise<{ from?: string; to?: string }>;

const REVENUE_STATUSES = ["confirmed", "in_production", "delivered"];

function money(v: number) {
  return `₱${v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function ProfitLossPage({ searchParams }: { searchParams: SearchParams }) {
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
          title="Profit & Loss"
          description="Review net profit against total income and expenses for any period."
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

  let revenueQuery = supabase
    .from("orders")
    .select("total_money, status, created_at")
    .in("status", REVENUE_STATUSES);
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
    revenueQuery,
    expenseQuery,
  ]);

  const orders = orderRows ?? [];
  const expenses = expenseRows ?? [];

  const revenue = orders.reduce((sum, r) => sum + Number(r.total_money), 0);
  const totalExpenses = expenses.reduce((sum, r) => sum + Number(r.amount), 0);
  const netProfit = revenue - totalExpenses;
  const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  const expenseByCategory = new Map<string, number>();
  for (const e of expenses) {
    expenseByCategory.set(e.category, (expenseByCategory.get(e.category) ?? 0) + Number(e.amount));
  }
  const expenseRowsGrouped: ExpenseCategoryRow[] = Array.from(expenseByCategory.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profit & Loss"
        description="Review net profit against total income and expenses for any period."
      />

      <DateRangeFilter from={from} to={to} />

      {(revenueError || expenseError) && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load profit & loss data: {revenueError?.message ?? expenseError?.message}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Revenue" value={money(revenue)} trend="up" delta={`${orders.length} orders`} />
        <StatCard label="Expenses" value={money(totalExpenses)} trend="down" />
        <StatCard
          label="Net Profit"
          value={money(netProfit)}
          trend={netProfit >= 0 ? "up" : "down"}
          delta={`${margin.toFixed(1)}% margin`}
        />
      </div>

      <Card>
        <CardContent className="p-4 text-xs text-(--color-text-muted)">
          Revenue includes orders with status confirmed, in production, or completed, dated by
          order creation time — the database does not track a separate order-confirmation
          timestamp, so orders created in a period but confirmed later are still counted here.
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-(--color-text)">Expense Breakdown by Category</h2>
          <ExpenseBreakdownTable data={expenseRowsGrouped} />
        </CardContent>
      </Card>
    </div>
  );
}
