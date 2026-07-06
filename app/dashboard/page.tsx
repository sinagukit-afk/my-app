import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

// ── Types ────────────────────────────────────────────────────────
type ReceiptRow = { total_money: number | null; receipt_date: string };
type OrderRow = { id: string; status: string };

type ItemForValue = { track_stock: boolean; deleted_at: string | null };
type VariantForValue = {
  cost: number | null;
  deleted_at: string | null;
  items: ItemForValue | ItemForValue[] | null;
};
type InventoryValueRow = { in_stock: number; item_variants: VariantForValue | VariantForValue[] | null };

type ItemForLowStock = { name: string };
type VariantForLowStock = {
  sku: string | null;
  option1_value: string | null;
  items: ItemForLowStock | ItemForLowStock[] | null;
};
type LowStockRow = {
  id: string;
  in_stock: number;
  low_stock_threshold: number | null;
  item_variants: VariantForLowStock | VariantForLowStock[] | null;
};

type ActivityRow = { id: string; action: string; description: string | null; created_at: string };

// ── Quick Actions (static) ──────────────────────────────────────
const QUICK_ACTIONS = [
  { label: "New Order", href: "/dashboard/orders", variant: "primary" },
  { label: "Add Inventory", href: "/dashboard/inventory", variant: "secondary" },
  { label: "New Purchase", href: "/dashboard/purchasing", variant: "secondary" },
  { label: "View Finance", href: "/dashboard/finance", variant: "secondary" },
] as const;

// ── Formatting helpers ──────────────────────────────────────────
function peso(v: number): string {
  return `₱ ${v.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatAction(action: string): string {
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type BadgeVariant = "default" | "success" | "warning" | "danger" | "neutral";
const ACTION_BADGE: Record<string, BadgeVariant> = {
  login: "neutral",
  logout: "neutral",
  create_receipt: "success",
  add_incoming: "success",
  create_item: "success",
  create_category: "success",
  update_item: "warning",
  view_report: "default",
  quote_edited: "warning",
};

function WarnIcon() {
  return <span className="text-(--color-warning) text-sm font-medium">!</span>;
}

// ── Page ─────────────────────────────────────────────────────────
export default async function DashboardPage() {
  const supabase = await createClient();

  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthLabel = now.toLocaleDateString("en-PH", { month: "long", year: "numeric", timeZone: "UTC" });
  const todayLabel = now.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

  const [receiptsRes, ordersRes, openQuotesRes, inventoryRes, lowStockRes, activityRes] = await Promise.all([
    supabase
      .from("receipts")
      .select("total_money, receipt_date")
      .is("cancelled_at", null)
      .gte("receipt_date", monthStart.toISOString())
      .returns<ReceiptRow[]>(),
    supabase
      .from("orders")
      .select("id, status")
      .in("status", ["confirmed", "in_production"])
      .returns<OrderRow[]>(),
    supabase.from("quotes").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase
      .from("inventory_levels")
      .select("in_stock, item_variants(cost, deleted_at, items(track_stock, deleted_at))")
      .returns<InventoryValueRow[]>(),
    supabase
      .from("inventory_levels")
      .select("id, in_stock, low_stock_threshold, item_variants(sku, option1_value, items(name))")
      .not("low_stock_threshold", "is", null)
      .returns<LowStockRow[]>(),
    supabase
      .from("activity_logs")
      .select("id, action, description, created_at")
      .order("created_at", { ascending: false })
      .limit(8)
      .returns<ActivityRow[]>(),
  ]);

  // Today's sales / monthly revenue
  const receipts = receiptsRes.data ?? [];
  const monthlyRevenue = receipts.reduce((sum, r) => sum + Number(r.total_money ?? 0), 0);
  const todaysReceipts = receipts.filter((r) => new Date(r.receipt_date) >= todayStart);
  const todaysSales = todaysReceipts.reduce((sum, r) => sum + Number(r.total_money ?? 0), 0);

  // Pending orders (open quotes + confirmed/in-production sales orders)
  const pendingOrders = ordersRes.data ?? [];
  const pendingCount = pendingOrders.length + (openQuotesRes.count ?? 0);
  const inProductionCount = pendingOrders.filter((o) => o.status === "in_production").length;

  // Inventory value (tracked, non-deleted items/variants only)
  const inventoryRows = inventoryRes.data ?? [];
  let inventoryValue = 0;
  let skuCount = 0;
  for (const row of inventoryRows) {
    const variant = firstOf(row.item_variants);
    if (!variant || variant.deleted_at) continue;
    const item = firstOf(variant.items);
    if (!item || !item.track_stock || item.deleted_at) continue;
    skuCount += 1;
    inventoryValue += Number(row.in_stock ?? 0) * Number(variant.cost ?? 0);
  }

  // Low stock (only rows with a configured threshold)
  const lowStockRows = (lowStockRes.data ?? [])
    .filter((r) => r.low_stock_threshold != null && Number(r.in_stock) <= Number(r.low_stock_threshold))
    .sort((a, b) => Number(a.in_stock) - Number(b.in_stock))
    .slice(0, 5)
    .map((r) => {
      const variant = firstOf(r.item_variants);
      const item = variant ? firstOf(variant.items) : null;
      return {
        id: r.id,
        name: item?.name ?? variant?.sku ?? "Unknown item",
        variantLabel: variant?.option1_value ?? null,
        stock: Number(r.in_stock),
        min: Number(r.low_stock_threshold),
      };
    });

  const activity = activityRes.data ?? [];

  const KPI_CARDS = [
    {
      id: "today-sales",
      label: "Today's Sales",
      value: peso(todaysSales),
      sub: `${todaysReceipts.length} sale${todaysReceipts.length === 1 ? "" : "s"} — ${todayLabel}`,
    },
    {
      id: "monthly-revenue",
      label: "Monthly Revenue",
      value: peso(monthlyRevenue),
      sub: monthLabel,
    },
    {
      id: "pending-orders",
      label: "Pending Orders",
      value: String(pendingCount),
      sub: inProductionCount > 0 ? `${inProductionCount} in production` : "None in production",
      warn: inProductionCount > 0,
    },
    {
      id: "inventory-value",
      label: "Inventory Value",
      value: peso(inventoryValue),
      sub: `Across ${skuCount} SKUs`,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description={`Business overview for Sinag Ukit — ${todayLabel}`} />

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KPI_CARDS.map((kpi) => (
          <Card key={kpi.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-(--color-text-muted)">{kpi.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold text-(--color-text)">{kpi.value}</span>
                {kpi.warn && <WarnIcon />}
              </div>
              <p className="mt-1 text-xs text-(--color-text-subtle)">{kpi.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main 2-col layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Activity — 2/3 width */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <p className="py-6 text-center text-sm text-(--color-text-subtle)">No recent activity.</p>
            ) : (
              <ul className="divide-y divide-(--color-border)">
                {activity.map((item) => (
                  <li key={item.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <span className="text-sm text-(--color-text)">{item.description ?? formatAction(item.action)}</span>
                    <div className="flex items-center gap-3 ml-4 shrink-0">
                      <Badge variant={ACTION_BADGE[item.action] ?? "default"}>{formatAction(item.action)}</Badge>
                      <span className="text-xs text-(--color-text-subtle) w-14 text-right">{timeAgo(item.created_at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Low Stock — 1/3 width */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Low Stock Items</CardTitle>
              <Badge variant="danger">{lowStockRows.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {lowStockRows.length === 0 ? (
              <p className="py-6 text-center text-sm text-(--color-text-subtle)">No low stock items.</p>
            ) : (
              <ul className="divide-y divide-(--color-border)">
                {lowStockRows.map((item) => (
                  <li key={item.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <span className="text-sm text-(--color-text) truncate pr-2">
                      {item.name}
                      {item.variantLabel ? ` (${item.variantLabel})` : ""}
                    </span>
                    <span className="text-sm font-semibold text-(--color-danger) shrink-0">
                      {item.stock} <span className="text-xs text-(--color-text-subtle) font-normal">/ {item.min} min</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {QUICK_ACTIONS.map((action) => (
              <Button key={action.label} variant={action.variant} asChild>
                <Link href={action.href}>{action.label}</Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
