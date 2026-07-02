import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/business/stat-card";
import { DateRangeFilter } from "@/components/business/date-range-filter";
import { BarChart, type BarChartDatum } from "@/components/business/bar-chart";
import { SalesByItemTable, type ItemSalesRow } from "./sales-report-table";

type SearchParams = Promise<{ from?: string; to?: string }>;

const REVENUE_STATUSES = ["confirmed", "in_production", "completed"];

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

export default async function SalesReportPage({ searchParams }: { searchParams: SearchParams }) {
  const { from = "", to = "" } = await searchParams;

  const supabase = await createClient();

  let ordersQuery = supabase
    .from("orders")
    .select(
      "id, created_at, order_items(quantity, unit_price, line_discount, item_name_snapshot, item_variants(item_id, items(category_id, categories(name))))"
    )
    .in("status", REVENUE_STATUSES);

  if (from) ordersQuery = ordersQuery.gte("created_at", `${from}T00:00:00`);
  if (to) ordersQuery = ordersQuery.lte("created_at", `${to}T23:59:59.999`);

  const { data: orderRows, error } = await ordersQuery.order("created_at");

  const orders = orderRows ?? [];

  let totalRevenue = 0;
  let totalUnits = 0;
  const revenueByDate = new Map<string, number>();
  const byItem = new Map<string, { category: string; qty: number; revenue: number }>();
  const byCategory = new Map<string, number>();

  for (const order of orders) {
    const date = order.created_at.slice(0, 10);
    for (const line of order.order_items ?? []) {
      const lineRevenue = Number(line.quantity) * Number(line.unit_price) - Number(line.line_discount);
      totalRevenue += lineRevenue;
      totalUnits += Number(line.quantity);

      revenueByDate.set(date, (revenueByDate.get(date) ?? 0) + lineRevenue);

      const variant = firstOf(line.item_variants);
      const item = variant ? firstOf(variant.items) : null;
      const category = item ? firstOf(item.categories) : null;
      const categoryName = category?.name ?? "Uncategorized";

      const itemKey = line.item_name_snapshot;
      const existing = byItem.get(itemKey);
      if (existing) {
        existing.qty += Number(line.quantity);
        existing.revenue += lineRevenue;
      } else {
        byItem.set(itemKey, { category: categoryName, qty: Number(line.quantity), revenue: lineRevenue });
      }

      byCategory.set(categoryName, (byCategory.get(categoryName) ?? 0) + lineRevenue);
    }
  }

  const totalOrders = orders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const dateChartData: BarChartDatum[] = Array.from(revenueByDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenue]) => ({ label: formatDayLabel(date), value: revenue }));

  const categoryChartData: BarChartDatum[] = Array.from(byCategory.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([category, revenue]) => ({ label: category, value: revenue }));

  const itemRows: ItemSalesRow[] = Array.from(byItem.entries())
    .map(([item, v]) => ({ item, category: v.category, quantitySold: v.qty, revenue: v.revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Report"
        description="Analyse sales performance across products, categories, and time periods."
      />

      <DateRangeFilter from={from} to={to} />

      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load sales data: {error.message}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Total Revenue" value={money(totalRevenue)} trend="up" delta={`${totalOrders} orders`} />
        <StatCard label="Units Sold" value={totalUnits.toLocaleString("en-PH")} />
        <StatCard label="Avg. Order Value" value={money(avgOrderValue)} />
        <StatCard label="Items Sold (SKUs)" value={byItem.size.toLocaleString("en-PH")} />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-(--color-text)">Revenue by Day</h2>
          </div>
          <BarChart data={dateChartData} valueFormatter={money} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-(--color-text)">Revenue by Category</h2>
          </div>
          <BarChart data={categoryChartData} valueFormatter={money} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-(--color-text)">
            Sales by Item — Top Sellers (sorted by revenue)
          </h2>
          <SalesByItemTable data={itemRows} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 text-xs text-(--color-text-muted)">
          Revenue includes orders with status confirmed, in production, or completed, dated by order
          creation time — the database does not track a separate order-confirmation timestamp, so
          orders created in a period but confirmed later are still counted here (same convention as
          the Profit &amp; Loss report).
        </CardContent>
      </Card>
    </div>
  );
}
