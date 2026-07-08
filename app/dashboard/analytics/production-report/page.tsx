import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/business/stat-card";
import { DateRangeFilter } from "@/components/business/date-range-filter";
import { BarChart, type BarChartDatum } from "@/components/business/bar-chart";
import {
  ProductionOrdersTable,
  type ProductionOrderRow,
  type ProductionOrderStatus,
} from "./production-report-table";

type SearchParams = Promise<{ from?: string; to?: string }>;

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatDayLabel(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

export default async function ProductionReportPage({ searchParams }: { searchParams: SearchParams }) {
  const { from = "", to = "" } = await searchParams;

  const supabase = await createClient();

  let productionOrdersQuery = supabase
    .from("production_orders")
    .select(
      "id, production_order_number, item_name_snapshot, sku_snapshot, modifiers_snapshot, quantity, status, created_at, updated_at, orders(order_number)"
    );

  if (from) productionOrdersQuery = productionOrdersQuery.gte("created_at", `${from}T00:00:00`);
  if (to) productionOrdersQuery = productionOrdersQuery.lte("created_at", `${to}T23:59:59.999`);

  let completedQuery = supabase
    .from("production_orders")
    .select("id, updated_at")
    .eq("status", "completed");

  if (from) completedQuery = completedQuery.gte("updated_at", `${from}T00:00:00`);
  if (to) completedQuery = completedQuery.lte("updated_at", `${to}T23:59:59.999`);

  const [{ data: poRows, error }, { data: completedRows, error: completedError }] = await Promise.all([
    productionOrdersQuery.order("created_at", { ascending: false }),
    completedQuery.order("updated_at"),
  ]);

  const productionOrders = poRows ?? [];

  let inProductionCount = 0;
  let completedCount = 0;
  let inProductionUnits = 0;
  let completedUnits = 0;

  const tableRows: ProductionOrderRow[] = productionOrders.map((po) => {
    const status = po.status as ProductionOrderStatus;
    const quantity = Number(po.quantity);
    if (status === "completed") {
      completedCount += 1;
      completedUnits += quantity;
    } else if (status !== "cancelled") {
      // not_started / wip / partially_completed all still count as "in production"
      inProductionCount += 1;
      inProductionUnits += quantity;
    }

    const order = firstOf(po.orders);
    const modifiers = Array.isArray(po.modifiers_snapshot)
      ? (po.modifiers_snapshot as { name_snapshot?: string }[]).map((m) => m.name_snapshot ?? "").filter(Boolean)
      : [];

    return {
      id: po.id,
      productionOrderNumber: po.production_order_number,
      orderNumber: order?.order_number ?? "",
      itemName: po.item_name_snapshot ?? "",
      sku: po.sku_snapshot,
      modifiers,
      quantity,
      status,
      createdAt: po.created_at,
      updatedAt: po.updated_at,
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
        description="Production Order counts by status and completion throughput, within current data limits."
      />

      <DateRangeFilter from={from} to={to} />

      {(error || completedError) && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load production data: {(error ?? completedError)?.message}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="In Production" value={inProductionCount.toLocaleString("en-PH")} />
        <StatCard label="Completed" value={completedCount.toLocaleString("en-PH")} />
        <StatCard label="Units In Production" value={inProductionUnits.toLocaleString("en-PH")} />
        <StatCard label="Units Completed" value={completedUnits.toLocaleString("en-PH")} />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-(--color-text)">Completed Production Orders per Day</h2>
          </div>
          <p className="mb-3 text-xs text-(--color-text-muted)">
            {(completedRows ?? []).length.toLocaleString("en-PH")} production orders completed in range
          </p>
          <BarChart data={completedChartData} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-(--color-text)">
            Production Orders Created in Range
          </h2>
          <ProductionOrdersTable data={tableRows} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 text-xs text-(--color-text-muted)">
          Counts reflect individual Production Orders (one per product+modifier grouping within a
          customer order, see the Production Orders page), not customer orders themselves — one
          customer order can span several Production Orders. A Production Order only exists once its
          customer order enters production, so orders still awaiting production (Confirmed) don&apos;t
          appear here. Completed-per-day uses each Production Order&apos;s <code>updated_at</code>{" "}
          timestamp as a proxy for completion time, since Production Orders have no dedicated
          status-change log; this is reliable for completed rows specifically because nothing updates a
          completed Production Order afterward. There is currently no way to measure average
          time-in-production — that would require a dedicated status-change history table, which is out
          of scope for this report.
        </CardContent>
      </Card>
    </div>
  );
}
