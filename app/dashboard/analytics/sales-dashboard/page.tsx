import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/business/stat-card";
import { YearFilter } from "@/components/business/year-filter";
import { DonutChart } from "@/components/business/donut-chart";
import { RankedBarList } from "@/components/business/ranked-bar-list";
import { GroupedBarChart, type GroupedBarDatum } from "@/components/business/grouped-bar-chart";
import { formatCurrency } from "@/lib/utils/format";

type SearchParams = Promise<{ year?: string }>;

const REVENUE_STATUSES = ["confirmed", "in_production", "delivered", "completed"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CATEGORY_TOP_N = 5;
const SALE_TYPES = ["Direct", "Online", "Wholesaler"] as const;

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
    quantity: number;
    unit_price: number;
    line_discount: number;
    item_name_snapshot: string;
    item_variants: VariantRef;
  }[];
};

type PaymentRow = {
  amount: number;
  payment_date: string;
  payment_types: { name: string } | { name: string }[] | null;
};

type GrossProfitRow = { revenue: number; cogs: number; gross_profit: number; gross_margin_pct: number };
type MonthlyGrossProfitRow = { month: number; revenue: number; cogs: number; gross_profit: number };

export default async function SalesDashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const { year: yearParam } = await searchParams;

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
          description="Ledger-tied sales, gross profit, and product performance overview."
        />
        <Card className="max-w-lg">
          <CardContent className="p-4 text-sm text-(--color-text-muted)">
            The Sales Dashboard ties into Accounting&apos;s ledger for gross profit and is
            restricted to Admin and Manager roles. Contact an administrator if you need access.
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentYear = new Date().getUTCFullYear();
  const year = Number(yearParam) || currentYear;
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const [
    { data: entryYearsRaw },
    { data: grossProfitRows, error: grossProfitError },
    { data: monthlyRows, error: monthlyError },
    { data: orderRows, error: ordersError },
    { data: paymentRows, error: paymentsError },
  ] = await Promise.all([
    supabase.from("journal_entries").select("entry_date"),
    supabase.rpc("get_gross_profit_summary", { p_start: yearStart, p_end: yearEnd }),
    supabase.rpc("get_monthly_gross_profit", { p_year: year }),
    supabase
      .from("orders")
      .select(
        "id, created_at, order_items(quantity, unit_price, line_discount, item_name_snapshot, item_variants(items(category_id, categories(name))))"
      )
      .in("status", REVENUE_STATUSES)
      .gte("created_at", `${yearStart}T00:00:00`)
      .lte("created_at", `${yearEnd}T23:59:59.999`)
      .returns<OrderRow[]>(),
    supabase
      .from("order_payments")
      .select("amount, payment_date, payment_types(name)")
      .gte("payment_date", yearStart)
      .lte("payment_date", yearEnd)
      .returns<PaymentRow[]>(),
  ]);

  const years = Array.from(
    new Set([currentYear, ...((entryYearsRaw ?? []).map((r) => new Date(r.entry_date).getUTCFullYear()))])
  ).sort((a, b) => b - a);

  const gpRows = (grossProfitRows ?? []) as GrossProfitRow[];
  const gp = gpRows[0] ?? { revenue: 0, cogs: 0, gross_profit: 0, gross_margin_pct: 0 };

  const monthlyByNumber = new Map(((monthlyRows ?? []) as MonthlyGrossProfitRow[]).map((r) => [r.month, r]));
  const monthlyChartData: GroupedBarDatum[] = MONTH_LABELS.map((label, i) => {
    const row = monthlyByNumber.get(i + 1);
    return {
      label,
      series: [
        { name: "Sales", value: Number(row?.revenue ?? 0) },
        { name: "Gross Profit", value: Number(row?.gross_profit ?? 0) },
      ],
    };
  });

  const orders = orderRows ?? [];
  const byItem = new Map<string, number>();
  const byCategory = new Map<string, number>();
  for (const order of orders) {
    for (const line of order.order_items ?? []) {
      const lineRevenue = Number(line.quantity) * Number(line.unit_price) - Number(line.line_discount);
      byItem.set(line.item_name_snapshot, (byItem.get(line.item_name_snapshot) ?? 0) + lineRevenue);

      const variant = firstOf(line.item_variants);
      const item = variant ? firstOf(variant.items) : null;
      const category = item ? firstOf(item.categories) : null;
      const categoryName = category?.name ?? "Uncategorized";
      byCategory.set(categoryName, (byCategory.get(categoryName) ?? 0) + lineRevenue);
    }
  }

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

  const payments = paymentRows ?? [];
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

  const loadError = grossProfitError || monthlyError || ordersError || paymentsError;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Dashboard"
        description="Ledger-tied sales, gross profit, and product performance overview."
        actions={<YearFilter year={year} years={years} />}
      />

      {loadError && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load dashboard data:{" "}
            {grossProfitError?.message ?? monthlyError?.message ?? ordersError?.message ?? paymentsError?.message}
          </CardContent>
        </Card>
      )}

      {/* Sale Type — no sales-channel field exists on orders yet; kept as a static placeholder. */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-(--color-text-muted)">Sale Type</span>
        <div className="flex gap-2">
          {SALE_TYPES.map((label) => (
            <span
              key={label}
              className="cursor-not-allowed rounded-full border border-(--color-border) px-3 py-1 text-xs text-(--color-text-subtle)"
            >
              {label}
            </span>
          ))}
        </div>
        <span className="text-xs text-(--color-text-subtle)">— sales-channel tracking coming soon</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Sale" value={formatCurrency(gp.revenue)} trend="up" delta={`${orders.length} orders`} />
        <StatCard
          label="Total Profit"
          value={formatCurrency(gp.gross_profit)}
          trend={gp.gross_profit >= 0 ? "up" : "down"}
        />
        <StatCard
          label="Profit %"
          value={`${Number(gp.gross_margin_pct).toFixed(1)}%`}
          trend={gp.gross_margin_pct >= 0 ? "up" : "down"}
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
        <CardContent className="p-4 text-xs text-(--color-text-muted)">
          Total Sale, Total Profit, and Profit % come from the accounting ledger (Revenue account 4000
          minus Cost of Goods Sold account 5000, journaled entries only) — the same source Accounting&apos;s
          Profit &amp; Loss report uses. Top Products, Top Category, Revenue by Category, and Payment Mode
          are computed from order and payment records directly (same convention as the Sales Report), so
          their totals won&apos;t necessarily reconcile exactly against Total Sale above.
        </CardContent>
      </Card>
    </div>
  );
}
