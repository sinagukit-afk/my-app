import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/business/stat-card";
import { DateRangeFilter } from "@/components/business/date-range-filter";
import { BarChart, type BarChartDatum } from "@/components/business/bar-chart";
import { ProductionOrdersTable, type ProductionOrderRow, type OrderStage } from "./production-report-table";

type SearchParams = Promise<{ from?: string; to?: string }>;

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatDayLabel(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

const STAGES: OrderStage[] = ["quote", "confirmed", "in_production", "completed", "cancelled"];

const STAGE_LABEL: Record<OrderStage, string> = {
  quote: "Quotes",
  confirmed: "Confirmed",
  in_production: "In Production",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default async function ProductionReportPage({ searchParams }: { searchParams: SearchParams }) {
  const { from = "", to = "" } = await searchParams;

  const supabase = await createClient();

  let ordersQuery = supabase
    .from("orders")
    .select("id, status, created_at, updated_at, customers(name)");

  if (from) ordersQuery = ordersQuery.gte("created_at", `${from}T00:00:00`);
  if (to) ordersQuery = ordersQuery.lte("created_at", `${to}T23:59:59.999`);

  let completedQuery = supabase
    .from("orders")
    .select("id, updated_at")
    .eq("status", "completed");

  if (from) completedQuery = completedQuery.gte("updated_at", `${from}T00:00:00`);
  if (to) completedQuery = completedQuery.lte("updated_at", `${to}T23:59:59.999`);

  const [{ data: orderRows, error }, { data: completedRows, error: completedError }] = await Promise.all([
    ordersQuery.order("created_at", { ascending: false }),
    completedQuery.order("updated_at"),
  ]);

  const orders = orderRows ?? [];

  const stageCounts: Record<OrderStage, number> = {
    quote: 0,
    confirmed: 0,
    in_production: 0,
    completed: 0,
    cancelled: 0,
  };

  const tableRows: ProductionOrderRow[] = orders.map((order) => {
    const status = order.status as OrderStage;
    stageCounts[status] = (stageCounts[status] ?? 0) + 1;
    const customer = firstOf(order.customers);
    return {
      id: order.id,
      customer: customer?.name ?? "Walk-in / unspecified",
      status,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    };
  });

  const completedByDay = new Map<string, number>();
  for (const row of completedRows ?? []) {
    const date = row.updated_at.slice(0, 10);
    completedByDay.set(date, (completedByDay.get(date) ?? 0) + 1);
  }
  const completedChartData: BarChartDatum[] = Array.from(completedByDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ label: formatDayLabel(date), value: count }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production Report"
        description="Order counts by stage and completion throughput, within current data limits."
      />

      <DateRangeFilter from={from} to={to} />

      {(error || completedError) && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load production data: {(error ?? completedError)?.message}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-5">
        {STAGES.map((stage) => (
          <StatCard key={stage} label={STAGE_LABEL[stage]} value={stageCounts[stage].toLocaleString("en-PH")} />
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-(--color-text)">Completed Orders per Day</h2>
          </div>
          <p className="mb-3 text-xs text-(--color-text-muted)">
            {(completedRows ?? []).length.toLocaleString("en-PH")} orders completed in range
          </p>
          <BarChart data={completedChartData} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-(--color-text)">
            Orders Created in Range — Current Stage
          </h2>
          <ProductionOrdersTable data={tableRows} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 text-xs text-(--color-text-muted)">
          Stage counts reflect orders created in the selected range, grouped by their current status —
          not a snapshot of every order ever created. Completed-per-day uses each order&apos;s{" "}
          <code>updated_at</code> timestamp as a proxy for completion time, since orders have no dedicated
          status-change log; this is reliable for completed orders specifically because nothing updates a
          completed order afterward. There is currently no way to measure average time-in-stage (e.g. how
          long an order sits in production before completion) — that would require a dedicated
          status-change history table, which is out of scope for this report.
        </CardContent>
      </Card>
    </div>
  );
}
