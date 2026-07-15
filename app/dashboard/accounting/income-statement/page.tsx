import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/business/stat-card";
import { DateRangeFilter } from "@/components/business/date-range-filter";
import { IncomeStatementTable, type IncomeStatementRow } from "./income-statement-table";

type SearchParams = Promise<{ from?: string; to?: string }>;

function money(v: number) {
  return `₱${v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function IncomeStatementPage({ searchParams }: { searchParams: SearchParams }) {
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
          description="Revenue and expenses for a date range, netting to profit or loss."
        />
        <Card className="max-w-lg">
          <CardContent className="p-4 text-sm text-(--color-text-muted)">
            Accounting records are restricted to Admin and Manager roles. Contact an
            administrator if you need access.
          </CardContent>
        </Card>
      </div>
    );
  }

  // get_income_statement() has no default bounds — "All Time" from the shared
  // date-range filter maps to the ledger's earliest possible / today's date.
  const start = from || "2000-01-01";
  const end = to || new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase.rpc("get_income_statement", { p_start: start, p_end: end });
  const rows = (data ?? []) as IncomeStatementRow[];

  const totalRevenue = rows.filter((r) => r.category === "revenue").reduce((s, r) => s + Number(r.amount), 0);
  const totalExpense = rows.filter((r) => r.category === "expense").reduce((s, r) => s + Number(r.amount), 0);
  const netIncome = totalRevenue - totalExpense;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profit & Loss"
        description="Revenue and expenses for a date range, netting to profit or loss."
      />

      <DateRangeFilter from={from} to={to} />

      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load income statement: {error.message}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Revenue" value={money(totalRevenue)} trend="up" />
        <StatCard label="Total Expenses" value={money(totalExpense)} trend="down" />
        <StatCard
          label="Net Income"
          value={money(netIncome)}
          trend={netIncome >= 0 ? "up" : "down"}
        />
      </div>

      <Card>
        <CardContent className="p-4">
          <IncomeStatementTable data={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
