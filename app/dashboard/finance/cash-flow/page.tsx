import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/business/stat-card";
import { DateRangeFilter } from "@/components/business/date-range-filter";
import { CashFlowTable, type CashFlowRow } from "./cash-flow-table";

type SearchParams = Promise<{ from?: string; to?: string }>;

function money(v: number) {
  return `₱${v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function CashFlowPage({ searchParams }: { searchParams: SearchParams }) {
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
          title="Cash Flow"
          description="Monitor money moving in and out of the business over time."
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

  let incomeQuery = supabase.from("income").select("date, category, amount, note").is("deleted_at", null);
  let expenseQuery = supabase.from("expenses").select("date, category, amount, note").is("deleted_at", null);
  if (from) {
    incomeQuery = incomeQuery.gte("date", from);
    expenseQuery = expenseQuery.gte("date", from);
  }
  if (to) {
    incomeQuery = incomeQuery.lte("date", to);
    expenseQuery = expenseQuery.lte("date", to);
  }

  const [{ data: incomeRows, error: incomeError }, { data: expenseRows, error: expenseError }] = await Promise.all([
    incomeQuery.order("date"),
    expenseQuery.order("date"),
  ]);

  const income = incomeRows ?? [];
  const expenses = expenseRows ?? [];
  const totalIn = income.reduce((sum, r) => sum + Number(r.amount), 0);
  const totalOut = expenses.reduce((sum, r) => sum + Number(r.amount), 0);
  const net = totalIn - totalOut;

  const timeline: CashFlowRow[] = [
    ...income.map((r) => ({ date: r.date, type: "in" as const, category: r.category, amount: Number(r.amount), note: r.note })),
    ...expenses.map((r) => ({ date: r.date, type: "out" as const, category: r.category, amount: Number(r.amount), note: r.note })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .reduce<CashFlowRow[]>((rows, entry) => {
      const prevBalance = rows.length ? rows[rows.length - 1].balance : 0;
      const balance = entry.type === "in" ? prevBalance + entry.amount : prevBalance - entry.amount;
      rows.push({ ...entry, balance });
      return rows;
    }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cash Flow"
        description="Monitor money moving in and out of the business over time."
      />

      <DateRangeFilter from={from} to={to} />

      {(incomeError || expenseError) && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load cash flow data: {incomeError?.message ?? expenseError?.message}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Inflow" value={money(totalIn)} trend="up" />
        <StatCard label="Total Outflow" value={money(totalOut)} trend="down" />
        <StatCard
          label="Net Cash Flow"
          value={money(net)}
          trend={net >= 0 ? "up" : "down"}
          delta={net >= 0 ? "Positive" : "Negative"}
        />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-(--color-text)">Timeline</h2>
            <Badge variant="neutral">{timeline.length} entries</Badge>
          </div>
          <CashFlowTable data={timeline} />
        </CardContent>
      </Card>
    </div>
  );
}
