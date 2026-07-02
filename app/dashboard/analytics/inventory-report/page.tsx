import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/business/stat-card";
import { DateRangeFilter } from "@/components/business/date-range-filter";
import { BarChart, type BarChartDatum } from "@/components/business/bar-chart";
import { InventoryStockTable, type StockRow } from "./inventory-report-table";

type SearchParams = Promise<{ from?: string; to?: string }>;

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function money(v: number) {
  return `₱${v.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}

function formatDayLabel(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

export default async function InventoryReportPage({ searchParams }: { searchParams: SearchParams }) {
  const { from = "", to = "" } = await searchParams;

  const supabase = await createClient();

  const stockQuery = supabase
    .from("inventory_levels")
    .select(
      "id, in_stock, low_stock_threshold, item_variants(sku, option1_value, cost, deleted_at, items(name, track_stock, deleted_at, categories(name)))"
    );

  let movementsQuery = supabase
    .from("inventory_movements")
    .select("id, quantity_change, occurred_at");

  if (from) movementsQuery = movementsQuery.gte("occurred_at", `${from}T00:00:00`);
  if (to) movementsQuery = movementsQuery.lte("occurred_at", `${to}T23:59:59.999`);

  const [{ data: stockData, error: stockError }, { data: movementData, error: movementError }] = await Promise.all([
    stockQuery,
    movementsQuery.order("occurred_at"),
  ]);

  const stockRows: StockRow[] = [];
  let totalStockValue = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  for (const row of stockData ?? []) {
    const variant = firstOf(row.item_variants);
    if (!variant || variant.deleted_at) continue;
    const item = firstOf(variant.items);
    if (!item || !item.track_stock || item.deleted_at) continue;

    const inStock = Number(row.in_stock ?? 0);
    const threshold = row.low_stock_threshold != null ? Number(row.low_stock_threshold) : null;
    const unitCost = Number(variant.cost ?? 0);
    const stockValue = inStock * unitCost;
    totalStockValue += stockValue;

    const isOut = inStock <= 0;
    const isLow = !isOut && threshold != null && inStock <= threshold;
    if (isOut) outOfStockCount += 1;
    if (isLow) lowStockCount += 1;

    const category = firstOf(item.categories);

    stockRows.push({
      id: row.id,
      item: item.name ?? "Unnamed item",
      variant: variant.option1_value ?? variant.sku ?? "—",
      category: category?.name ?? "Uncategorized",
      inStock,
      threshold,
      unitCost,
      stockValue,
      status: isOut ? "out" : isLow ? "low" : "ok",
    });
  }

  stockRows.sort((a, b) => a.inStock - b.inStock);

  const movements = movementData ?? [];
  const movementsByDate = new Map<string, number>();
  for (const m of movements) {
    const date = m.occurred_at.slice(0, 10);
    movementsByDate.set(date, (movementsByDate.get(date) ?? 0) + Math.abs(Number(m.quantity_change)));
  }

  const movementChartData: BarChartDatum[] = Array.from(movementsByDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, qty]) => ({ label: formatDayLabel(date), value: qty }));

  const totalMovementQty = movements.reduce((sum, m) => sum + Math.abs(Number(m.quantity_change)), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Report"
        description="Stock levels, valuation, and movement volume across items and variants."
      />

      {(stockError || movementError) && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load inventory data: {(stockError ?? movementError)?.message}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Tracked SKUs" value={stockRows.length.toLocaleString("en-PH")} />
        <StatCard label="Stock Value" value={money(totalStockValue)} />
        <StatCard
          label="Low Stock"
          value={lowStockCount.toLocaleString("en-PH")}
          trend={lowStockCount > 0 ? "down" : "neutral"}
        />
        <StatCard
          label="Out of Stock"
          value={outOfStockCount.toLocaleString("en-PH")}
          trend={outOfStockCount > 0 ? "down" : "neutral"}
        />
      </div>

      <Card>
        <CardContent className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-(--color-text)">Current Stock by Item / Variant</h2>
          <InventoryStockTable data={stockRows} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-sm font-semibold text-(--color-text)">Movement Volume</h2>
            <DateRangeFilter from={from} to={to} />
          </div>
          <p className="mb-3 text-xs text-(--color-text-muted)">
            {movements.length.toLocaleString("en-PH")} movements, {totalMovementQty.toLocaleString("en-PH")} units
            moved in range
          </p>
          <BarChart data={movementChartData} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 text-xs text-(--color-text-muted)">
          Stock value is each variant&apos;s cost × current on-hand quantity, matching the Dashboard&apos;s
          Inventory Value KPI. Only items with stock tracking enabled are included; movement volume reflects
          all recorded inventory movements (incoming, sales, adjustments) in the selected range.
        </CardContent>
      </Card>
    </div>
  );
}
