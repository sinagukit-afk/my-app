import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/business/stat-card";
import { YearFilter } from "@/components/business/year-filter";
import { SaleTypeFilter } from "@/components/business/sale-type-filter";
import { DonutChart } from "@/components/business/donut-chart";
import { RankedBarList } from "@/components/business/ranked-bar-list";
import { GroupedBarChart, type GroupedBarDatum } from "@/components/business/grouped-bar-chart";
import { Badge } from "@/components/ui/badge";
import { ORDER_SOURCE_OPTIONS } from "@/app/dashboard/orders/order-source";
import { formatCurrency } from "@/lib/utils/format";
import { formatDate } from "@/lib/utils/format-date";

type SearchParams = Promise<{ year?: string; source?: string }>;

const REVENUE_STATUSES = ["confirmed", "in_production", "delivered", "completed"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CATEGORY_TOP_N = 5;
const UNCOLLECTED_TOP_N = 10;

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

type CategoryRef = { name: string } | { name: string }[] | null;
type ItemRef = { category_id: string | null; categories: CategoryRef } | { category_id: string | null; categories: CategoryRef }[] | null;
type VariantRef = { items: ItemRef } | { items: ItemRef }[] | null;

type OrderRow = {
  id: string;
  created_at: string;
  order_items: {
    variant_id: string;
    quantity: number;
    unit_price: number;
    line_discount: number;
    item_name_snapshot: string;
    item_variants: VariantRef;
    order_item_modifiers: { price_snapshot: number }[];
  }[];
};

const MAX_BOM_DEPTH = 3;

/**
 * Composite/build-to-order items (D021) carry no cost of their own — item_variants.cost is
 * null and the real cost lives on their BOM components (item_components), possibly nested.
 * Falls back to 0 for a raw-material item with no recorded purchase cost either (a real,
 * separate data gap, not a bug here).
 */
function makeCostResolver(
  costByVariant: Map<string, number | null>,
  componentsByComposite: Map<string, { componentId: string; qty: number }[]>
) {
  const cache = new Map<string, number>();
  function resolve(variantId: string, depth = 0): number {
    if (depth > MAX_BOM_DEPTH) return 0;
    const cached = cache.get(variantId);
    if (cached !== undefined) return cached;
    const directCost = costByVariant.get(variantId);
    let result: number;
    if (directCost != null) {
      result = Number(directCost);
    } else {
      const components = componentsByComposite.get(variantId) ?? [];
      result = components.reduce((sum, c) => sum + c.qty * resolve(c.componentId, depth + 1), 0);
    }
    cache.set(variantId, result);
    return result;
  }
  return resolve;
}

type PaymentRow = {
  amount: number;
  payment_date: string;
  payment_types: { name: string } | { name: string }[] | null;
  orders: { order_source: string | null } | { order_source: string | null }[] | null;
};

type UncollectedOrderRow = {
  id: string;
  order_number: string;
  order_date: string;
  total_money: number;
  total_tax: number | null;
  customers: { name: string } | { name: string }[] | null;
  order_payments: { amount: number }[];
  order_shipments: { shipping_cost: number | null; shipping_fee_charged: number | null; status: string }[];
};

type PaymentStatus = "Unpaid" | "Partially Paid" | "Paid" | "Overpaid";

function paymentStatus(totalPaid: number, totalDue: number): PaymentStatus {
  if (totalPaid <= 0) return "Unpaid";
  if (totalPaid < totalDue) return "Partially Paid";
  if (totalPaid > totalDue) return "Overpaid";
  return "Paid";
}

const PAYMENT_STATUS_VARIANT: Record<PaymentStatus, "success" | "danger" | "warning" | "neutral"> = {
  Unpaid: "danger",
  "Partially Paid": "warning",
  Paid: "success",
  Overpaid: "neutral",
};

export default async function SalesDashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const { year: yearParam, source: sourceParam } = await searchParams;
  const source = sourceParam ?? "";

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
          title="Sales Dashboard"
          description="Live sales, gross profit, and product performance overview."
        />
        <Card className="max-w-lg">
          <CardContent className="p-4 text-sm text-(--color-text-muted)">
            The Sales Dashboard surfaces order and payment figures and is restricted to Admin
            and Manager roles. Contact an administrator if you need access.
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentYear = new Date().getUTCFullYear();
  const year = Number(yearParam) || currentYear;
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  let ordersQuery = supabase
    .from("orders")
    .select(
      "id, created_at, order_items(variant_id, quantity, unit_price, line_discount, item_name_snapshot, item_variants(items(category_id, categories(name))), order_item_modifiers(price_snapshot))"
    )
    .in("status", REVENUE_STATUSES)
    .gte("created_at", `${yearStart}T00:00:00`)
    .lte("created_at", `${yearEnd}T23:59:59.999`);
  if (source) ordersQuery = ordersQuery.eq("order_source", source);

  const [
    { data: orderYearsRaw },
    { data: orderRows, error: ordersError },
    { data: paymentRows, error: paymentsError },
    { data: uncollectedRows, error: uncollectedError },
    { data: variantCostRows },
    { data: componentRows },
  ] = await Promise.all([
    supabase.from("orders").select("created_at"),
    ordersQuery.returns<OrderRow[]>(),
    supabase
      .from("order_payments")
      .select("amount, payment_date, payment_types(name), orders(order_source)")
      .gte("payment_date", yearStart)
      .lte("payment_date", yearEnd)
      .returns<PaymentRow[]>(),
    supabase
      .from("orders")
      .select(
        "id, order_number, order_date, total_money, total_tax, customers(name), order_payments(amount), order_shipments(shipping_cost, shipping_fee_charged, status)"
      )
      .neq("status", "cancelled")
      .returns<UncollectedOrderRow[]>(),
    supabase.from("item_variants").select("id, cost"),
    supabase.from("item_components").select("composite_variant_id, component_variant_id, quantity"),
  ]);

  const years = Array.from(
    new Set([currentYear, ...((orderYearsRaw ?? []).map((r) => new Date(r.created_at).getUTCFullYear()))])
  ).sort((a, b) => b - a);

  const costByVariant = new Map((variantCostRows ?? []).map((v) => [v.id, v.cost != null ? Number(v.cost) : null]));
  const componentsByComposite = new Map<string, { componentId: string; qty: number }[]>();
  for (const c of componentRows ?? []) {
    const arr = componentsByComposite.get(c.composite_variant_id) ?? [];
    arr.push({ componentId: c.component_variant_id, qty: Number(c.quantity) });
    componentsByComposite.set(c.composite_variant_id, arr);
  }
  const resolveUnitCost = makeCostResolver(costByVariant, componentsByComposite);

  const orders = orderRows ?? [];
  const byItem = new Map<string, number>();
  const byCategory = new Map<string, number>();
  const monthlyByNumber = new Map<number, { sales: number; profit: number }>();
  let totalSale = 0;
  let totalCost = 0;

  for (const order of orders) {
    const month = new Date(order.created_at).getUTCMonth() + 1;
    const bucket = monthlyByNumber.get(month) ?? { sales: 0, profit: 0 };

    for (const line of order.order_items ?? []) {
      const modifierTotal = (line.order_item_modifiers ?? []).reduce(
        (sum, m) => sum + Number(m.price_snapshot),
        0
      );
      const lineRevenue =
        Number(line.quantity) * (Number(line.unit_price) + modifierTotal) - Number(line.line_discount);
      const variant = firstOf(line.item_variants);
      const lineCost = Number(line.quantity) * resolveUnitCost(line.variant_id);
      const lineProfit = lineRevenue - lineCost;

      byItem.set(line.item_name_snapshot, (byItem.get(line.item_name_snapshot) ?? 0) + lineRevenue);

      const item = variant ? firstOf(variant.items) : null;
      const category = item ? firstOf(item.categories) : null;
      const categoryName = category?.name ?? "Uncategorized";
      byCategory.set(categoryName, (byCategory.get(categoryName) ?? 0) + lineRevenue);

      totalSale += lineRevenue;
      totalCost += lineCost;
      bucket.sales += lineRevenue;
      bucket.profit += lineProfit;
    }

    monthlyByNumber.set(month, bucket);
  }

  const totalProfit = totalSale - totalCost;
  const profitPct = totalSale > 0 ? (totalProfit / totalSale) * 100 : 0;

  const monthlyChartData: GroupedBarDatum[] = MONTH_LABELS.map((label, i) => {
    const bucket = monthlyByNumber.get(i + 1);
    return {
      label,
      series: [
        { name: "Sales", value: bucket?.sales ?? 0 },
        { name: "Gross Profit", value: bucket?.profit ?? 0 },
      ],
    };
  });

  const topProducts = Array.from(byItem.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const categoryEntries = Array.from(byCategory.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  const topCategories = categoryEntries.slice(0, CATEGORY_TOP_N);
  const otherCategoryTotal = categoryEntries.slice(CATEGORY_TOP_N).reduce((sum, c) => sum + c.value, 0);
  const categoryBreakdown = otherCategoryTotal > 0 ? [...topCategories, { label: "Other", value: otherCategoryTotal }] : topCategories;

  const payments = (paymentRows ?? []).filter((p) => !source || firstOf(p.orders)?.order_source === source);
  const byPaymentType = new Map<string, number>();
  for (const p of payments) {
    const type = firstOf(p.payment_types);
    const name = type?.name ?? "Other";
    byPaymentType.set(name, (byPaymentType.get(name) ?? 0) + Number(p.amount));
  }
  const paymentModeData = Array.from(byPaymentType.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const topProduct = topProducts[0];
  const topCategory = categoryEntries[0];

  const uncollected = (uncollectedRows ?? [])
    .map((o) => {
      const customer = firstOf(o.customers);
      const totalMoney = Number(o.total_money);
      const totalTax = Number(o.total_tax ?? 0);
      const dispatchedShipments = (o.order_shipments ?? []).filter(
        (s) => s.status === "shipped" || s.status === "delivered"
      );
      const shippingFeeTotal = dispatchedShipments.reduce((sum, s) => sum + Number(s.shipping_fee_charged ?? 0), 0);
      const totalDue = totalMoney + totalTax + shippingFeeTotal;
      const totalPaid = (o.order_payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
      return {
        id: o.id,
        orderNumber: o.order_number,
        customerName: customer?.name ?? null,
        orderDate: o.order_date,
        totalDue,
        totalPaid,
        remainingBalance: totalDue - totalPaid,
        status: paymentStatus(totalPaid, totalDue),
      };
    })
    .filter((row) => row.status === "Unpaid" || row.status === "Partially Paid")
    .sort((a, b) => b.remainingBalance - a.remainingBalance);
  const uncollectedTotal = uncollected.reduce((sum, r) => sum + r.remainingBalance, 0);
  const uncollectedTop = uncollected.slice(0, UNCOLLECTED_TOP_N);

  const loadError = ordersError || paymentsError || uncollectedError;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Dashboard"
        description="Live sales, gross profit, and product performance overview."
        actions={<YearFilter year={year} years={years} />}
      />

      {loadError && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load dashboard data: {ordersError?.message ?? paymentsError?.message ?? uncollectedError?.message}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-(--color-text-muted)">Sale Type</span>
        <SaleTypeFilter source={source} options={ORDER_SOURCE_OPTIONS} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Sale" value={formatCurrency(totalSale)} trend="up" delta={`${orders.length} orders`} />
        <StatCard
          label="Total Profit"
          value={formatCurrency(totalProfit)}
          trend={totalProfit >= 0 ? "up" : "down"}
        />
        <StatCard
          label="Profit %"
          value={`${profitPct.toFixed(1)}%`}
          trend={profitPct >= 0 ? "up" : "down"}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Top Product" value={topProduct?.label ?? "—"} delta={topProduct && formatCurrency(topProduct.value)} />
        <StatCard label="Top Category" value={topCategory?.label ?? "—"} delta={topCategory && formatCurrency(topCategory.value)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Monthly Sales &amp; Gross Profit — {year}</CardTitle>
          </CardHeader>
          <CardContent>
            <GroupedBarChart data={monthlyChartData} seriesNames={["Sales", "Gross Profit"]} valueFormatter={formatCurrency} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Mode</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart data={paymentModeData} valueFormatter={formatCurrency} centerLabel="Collected" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
          </CardHeader>
          <CardContent>
            <RankedBarList data={topProducts} valueFormatter={formatCurrency} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <RankedBarList data={categoryBreakdown} valueFormatter={formatCurrency} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Not Yet Collected</CardTitle>
          </div>
          <Link href="/dashboard/finance/payments" className="text-sm text-(--color-primary) hover:underline">
            View all in Customer Payment
          </Link>
        </CardHeader>
        <CardContent>
          {uncollectedTop.length === 0 ? (
            <p className="text-sm text-(--color-text-muted)">Nothing unpaid or partially paid right now.</p>
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-(--color-border) text-left text-(--color-text-muted)">
                      <th className="py-2 pr-4 font-medium">Order No.</th>
                      <th className="py-2 pr-4 font-medium">Customer</th>
                      <th className="py-2 pr-4 font-medium">Order Date</th>
                      <th className="py-2 pr-4 font-medium">Remaining</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uncollectedTop.map((row) => (
                      <tr key={row.id} className="border-b border-(--color-border) last:border-0">
                        <td className="py-2 pr-4">
                          <Link
                            href={`/dashboard/finance/payments/${row.orderNumber}`}
                            className="font-medium text-(--color-primary) hover:underline"
                          >
                            {row.orderNumber}
                          </Link>
                        </td>
                        <td className="py-2 pr-4 text-(--color-text)">
                          {row.customerName ?? <span className="text-(--color-text-subtle)">Walk-in</span>}
                        </td>
                        <td className="py-2 pr-4 text-(--color-text-muted)">{formatDate(row.orderDate)}</td>
                        <td className="py-2 pr-4 font-medium text-(--color-text)">{formatCurrency(row.remainingBalance)}</td>
                        <td className="py-2 pr-4">
                          <Badge variant={PAYMENT_STATUS_VARIANT[row.status]}>{row.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between text-sm text-(--color-text-muted)">
                <span>
                  {uncollected.length} order{uncollected.length === 1 ? "" : "s"} outstanding
                  {uncollected.length > uncollectedTop.length ? ` (showing top ${UNCOLLECTED_TOP_N})` : ""}
                </span>
                <span className="font-medium text-(--color-text)">Total: {formatCurrency(uncollectedTotal)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 text-xs text-(--color-text-muted)">
          Total Sale, Total Profit, and Profit % are computed directly from order and payment records
          (same convention as the Sales Report). Total Profit uses each item&apos;s current cost — for
          build-to-order/composite products with no cost of their own, cost is expanded from their bill of
          materials (component costs × quantity) instead of counted as ₱0 — but this is still a current-cost
          estimate, not a point-in-time snapshot at the time of sale, so past periods will shift if item or
          component costs change later. A dedicated accounting dashboard tied to the ledger is planned
          separately; this page reflects live operational sales instead. &ldquo;Not Yet Collected&rdquo; is a
          live snapshot independent of the Year/Sale Type filters above.
        </CardContent>
      </Card>
    </div>
  );
}
