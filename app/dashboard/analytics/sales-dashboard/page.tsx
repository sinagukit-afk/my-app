import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/business/stat-card";
import { YearFilter } from "@/components/business/year-filter";
import { MonthFilter } from "@/components/business/month-filter";
import { SaleTypeFilter } from "@/components/business/sale-type-filter";
import { DonutChart } from "@/components/business/donut-chart";
import { RankedBarList } from "@/components/business/ranked-bar-list";
import { GroupedBarChart, type GroupedBarDatum } from "@/components/business/grouped-bar-chart";
import { Badge } from "@/components/ui/badge";
import { ORDER_SOURCE_OPTIONS } from "@/app/dashboard/orders/order-source";
import { formatCurrency, formatQty } from "@/lib/utils/format";

type SearchParams = Promise<{ year?: string; month?: string; source?: string }>;

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
  payment_closed_at: string | null;
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
  const { year: yearParam, month: monthParam, source: sourceParam } = await searchParams;
  const source = sourceParam ?? "";
  const month = Number(monthParam) || 0;

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
  const periodStart = month ? `${year}-${String(month).padStart(2, "0")}-01` : `${year}-01-01`;
  const periodEnd = month
    ? new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
    : `${year}-12-31`;

  let ordersQuery = supabase
    .from("orders")
    .select(
      "id, created_at, payment_closed_at, order_items(variant_id, quantity, unit_price, line_discount, item_name_snapshot, item_variants(items(category_id, categories(name))), order_item_modifiers(price_snapshot))"
    )
    .neq("status", "cancelled")
    .gte("created_at", `${periodStart}T00:00:00`)
    .lte("created_at", `${periodEnd}T23:59:59.999`);
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
      .gte("payment_date", periodStart)
      .lte("payment_date", periodEnd)
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
  // byItem/byCategory/monthlyByNumber/closedUnits are deliberately scoped to CLOSED orders only —
  // Units Sold, Top Product/Category, the monthly chart, and Top Products/Revenue by Category all
  // report on finalized (payment-closed) sales, not revenue still awaiting payment closure.
  const byItem = new Map<string, number>();
  const byCategory = new Map<string, number>();
  const monthlyByNumber = new Map<number, { sales: number; profit: number }>();
  let totalSale = 0;
  let totalCost = 0;
  let closedUnits = 0;
  let openSale = 0;
  let openCost = 0;
  let openOrderCount = 0;

  for (const order of orders) {
    const isOpen = order.payment_closed_at == null;
    if (isOpen) openOrderCount += 1;
    const month = new Date(order.created_at).getUTCMonth() + 1;

    for (const line of order.order_items ?? []) {
      const modifierTotal = (line.order_item_modifiers ?? []).reduce(
        (sum, m) => sum + Number(m.price_snapshot),
        0
      );
      const lineRevenue =
        Number(line.quantity) * (Number(line.unit_price) + modifierTotal) - Number(line.line_discount);
      const lineCost = Number(line.quantity) * resolveUnitCost(line.variant_id);
      const lineProfit = lineRevenue - lineCost;

      totalSale += lineRevenue;
      totalCost += lineCost;

      if (isOpen) {
        openSale += lineRevenue;
        openCost += lineCost;
        continue;
      }

      closedUnits += Number(line.quantity);
      byItem.set(line.item_name_snapshot, (byItem.get(line.item_name_snapshot) ?? 0) + lineRevenue);

      const variant = firstOf(line.item_variants);
      const item = variant ? firstOf(variant.items) : null;
      const category = item ? firstOf(item.categories) : null;
      const categoryName = category?.name ?? "Uncategorized";
      byCategory.set(categoryName, (byCategory.get(categoryName) ?? 0) + lineRevenue);

      const bucket = monthlyByNumber.get(month) ?? { sales: 0, profit: 0 };
      bucket.sales += lineRevenue;
      bucket.profit += lineProfit;
      monthlyByNumber.set(month, bucket);
    }
  }

  const totalProfit = totalSale - totalCost;
  const itemsSoldSkus = byItem.size;

  const openProfit = openSale - openCost;
  const closedSale = totalSale - openSale;
  const closedProfit = totalProfit - openProfit;
  const closedOrderCount = orders.length - openOrderCount;
  const profitPct = closedSale > 0 ? (closedProfit / closedSale) * 100 : 0;
  const avgOrderValue = closedOrderCount > 0 ? closedSale / closedOrderCount : 0;

  const periodLabel = month ? `${MONTH_LABELS[month - 1]} ${year}` : String(year);

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

  const paymentSplits = (uncollectedRows ?? []).map((o) => {
    const customer = firstOf(o.customers);
    const totalMoney = Number(o.total_money);
    const totalTax = Number(o.total_tax ?? 0);
    const dispatchedShipments = (o.order_shipments ?? []).filter(
      (s) => s.status === "shipped" || s.status === "delivered"
    );
    const shippingFeeTotal = dispatchedShipments.reduce((sum, s) => sum + Number(s.shipping_fee_charged ?? 0), 0);
    const productDue = totalMoney + totalTax;
    const totalDue = productDue + shippingFeeTotal;
    const totalPaid = (o.order_payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
    // Payments aren't recorded per product/shipping (one lump sum per order) — prorate by each
    // order's due-amount mix. Cap the base at totalDue so an overpaid "tip" isn't counted as
    // extra product/shipping revenue, mirroring how close_order_payment() treats overpayment.
    const paidTowardDue = Math.min(totalPaid, totalDue);
    return {
      id: o.id,
      orderNumber: o.order_number,
      customerName: customer?.name ?? null,
      orderDate: o.order_date,
      totalDue,
      totalPaid,
      productPaid: totalDue > 0 ? paidTowardDue * (productDue / totalDue) : 0,
      shippingPaid: totalDue > 0 ? paidTowardDue * (shippingFeeTotal / totalDue) : 0,
      remainingBalance: totalDue - totalPaid,
      status: paymentStatus(totalPaid, totalDue),
    };
  });

  const totalProductCollected = paymentSplits.reduce((sum, r) => sum + r.productPaid, 0);
  const totalShippingCollected = paymentSplits.reduce((sum, r) => sum + r.shippingPaid, 0);

  const uncollected = paymentSplits
    .filter((row) => row.status === "Unpaid" || row.status === "Partially Paid")
    .sort((a, b) => b.remainingBalance - a.remainingBalance);
  const uncollectedTotal = uncollected.reduce((sum, r) => sum + r.remainingBalance, 0);
  const uncollectedTop = uncollected.slice(0, UNCOLLECTED_TOP_N);

  const paymentCollectionData = [
    { label: "Payment to Product", value: totalProductCollected },
    { label: "Payment to Shipping", value: totalShippingCollected },
    { label: "Uncollected", value: uncollectedTotal },
  ];
  const totalCollected = totalProductCollected + totalShippingCollected;

  const loadError = ordersError || paymentsError || uncollectedError;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Dashboard"
        description="Live sales, gross profit, and product performance overview."
        actions={
          <div className="flex items-center gap-2">
            <MonthFilter month={month ? String(month) : ""} />
            <YearFilter year={year} years={years} />
          </div>
        }
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
        <StatCard
          label="Closed Sales"
          value={formatCurrency(closedSale)}
          delta={`${closedOrderCount} order${closedOrderCount === 1 ? "" : "s"} closed`}
        />
        <StatCard
          label="Closed Profit"
          value={formatCurrency(closedProfit)}
          trend={closedProfit >= 0 ? "up" : "down"}
        />
        <StatCard
          label="Profit %"
          value={`${profitPct.toFixed(1)}%`}
          trend={profitPct >= 0 ? "up" : "down"}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Open Sales"
          value={formatCurrency(openSale)}
          delta={`${openOrderCount} order${openOrderCount === 1 ? "" : "s"} awaiting close`}
        />
        <StatCard label="Projected Sales" value={formatCurrency(totalSale)} trend="up" delta={`${orders.length} orders`} />
        <StatCard
          label="Projected Profit"
          value={formatCurrency(totalProfit)}
          trend={totalProfit >= 0 ? "up" : "down"}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Units Sold" value={formatQty(closedUnits)} />
        <StatCard label="Avg. Order Value" value={formatCurrency(avgOrderValue)} />
        <StatCard label="Items Sold (SKUs)" value={itemsSoldSkus.toLocaleString("en-PH")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Top Product" value={topProduct?.label ?? "—"} delta={topProduct && formatCurrency(topProduct.value)} />
        <StatCard label="Top Category" value={topCategory?.label ?? "—"} delta={topCategory && formatCurrency(topCategory.value)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Sales &amp; Gross Profit — {periodLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <GroupedBarChart data={monthlyChartData} seriesNames={["Sales", "Gross Profit"]} valueFormatter={formatCurrency} />
        </CardContent>
      </Card>

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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Payment Collection</CardTitle>
            </div>
            <Link href="/dashboard/finance/payments" className="text-sm text-(--color-primary) hover:underline">
              View all in Customer Payment
            </Link>
          </CardHeader>
          <CardContent className="space-y-6">
            <DonutChart data={paymentCollectionData} valueFormatter={formatCurrency} centerLabel="Total Due" />
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-(--color-text-muted)">
              <span>
                Total Collected: <span className="font-medium text-(--color-text)">{formatCurrency(totalCollected)}</span>
              </span>
              <span>
                Uncollected: <span className="font-medium text-(--color-text)">{formatCurrency(uncollectedTotal)}</span>
              </span>
            </div>

            {uncollectedTop.length === 0 ? (
              <p className="text-sm text-(--color-text-muted)">Nothing unpaid or partially paid right now.</p>
            ) : (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-(--color-text)">Outstanding Orders</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-(--color-border) text-left text-(--color-text-muted)">
                        <th className="py-2 pr-4 font-medium">Order No.</th>
                        <th className="py-2 pr-4 font-medium">Customer</th>
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
          <CardHeader>
            <CardTitle>Payment Mode</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart data={paymentModeData} valueFormatter={formatCurrency} centerLabel="Collected" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How These Numbers Are Calculated</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-(--color-border) text-left text-(--color-text-muted)">
                  <th className="py-2 pr-4 font-medium align-top">Metric</th>
                  <th className="py-2 font-medium align-top">What it means</th>
                </tr>
              </thead>
              <tbody className="text-(--color-text-muted)">
                <tr className="border-b border-(--color-border)">
                  <td className="py-2 pr-4 align-top font-medium text-(--color-text) whitespace-nowrap">
                    Projected Sales / Projected Profit
                  </td>
                  <td className="py-2">
                    Every order status except cancelled (confirmed through completed, including in-flight
                    statuses like shipped and on hold) — not just a fixed subset. Profit uses each
                    item&apos;s current cost, expanded from its bill of materials (component costs ×
                    quantity) for build-to-order/composite products with no cost of their own — a
                    current-cost estimate, not a point-in-time snapshot at time of sale, so past periods
                    shift if costs change later. A dedicated accounting dashboard tied to the ledger is
                    planned separately; this page reflects live operational sales instead.
                  </td>
                </tr>
                <tr className="border-b border-(--color-border)">
                  <td className="py-2 pr-4 align-top font-medium text-(--color-text) whitespace-nowrap">
                    Open Sales
                  </td>
                  <td className="py-2">
                    The portion of Projected Sales whose payment hasn&apos;t been formally closed yet (the
                    Close Payment action on the order) — independent of how much has been paid. An order
                    can already show &ldquo;Paid&rdquo; on the Customer Payment page and still count as Open
                    here until Close Payment is actually clicked.
                  </td>
                </tr>
                <tr className="border-b border-(--color-border)">
                  <td className="py-2 pr-4 align-top font-medium text-(--color-text) whitespace-nowrap">
                    Closed Sales / Closed Profit
                  </td>
                  <td className="py-2">
                    The portion of Projected Sales/Profit that has been formally closed — Projected minus
                    Open.
                  </td>
                </tr>
                <tr className="border-b border-(--color-border)">
                  <td className="py-2 pr-4 align-top font-medium text-(--color-text) whitespace-nowrap">
                    Profit %
                  </td>
                  <td className="py-2">
                    Closed Profit ÷ Closed Sales — the margin actually locked in, not the margin on revenue
                    still awaiting close.
                  </td>
                </tr>
                <tr className="border-b border-(--color-border)">
                  <td className="py-2 pr-4 align-top font-medium text-(--color-text)">
                    Units Sold, Avg. Order Value, Items Sold (SKUs), Top Product, Top Category, the monthly
                    chart, Top Products, Revenue by Category
                  </td>
                  <td className="py-2">
                    All scoped to closed orders only, matching Closed Sales — an order still awaiting
                    payment closure doesn&apos;t contribute units or revenue to any of these breakdowns yet.
                  </td>
                </tr>
                <tr className="last:border-0">
                  <td className="py-2 pr-4 align-top font-medium text-(--color-text) whitespace-nowrap">
                    Payment Collection
                  </td>
                  <td className="py-2">
                    A live snapshot independent of the Year/Sale Type filters above. Since payments are
                    recorded as one lump sum per order rather than split by product/shipping, the Payment
                    to Product and Payment to Shipping slices are prorated from each order&apos;s
                    due-amount mix, not amounts collected item-by-item.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
