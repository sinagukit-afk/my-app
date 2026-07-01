"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ── Mock data ────────────────────────────────────────────────────
const KPI_CARDS = [
  {
    id: "today-sales",
    label: "Today's Sales",
    value: "₱ 12,450",
    sub: "+8% vs yesterday",
    trend: "up",
  },
  {
    id: "monthly-revenue",
    label: "Monthly Revenue",
    value: "₱ 284,300",
    sub: "June 2026",
    trend: "up",
  },
  {
    id: "pending-orders",
    label: "Pending Orders",
    value: "7",
    sub: "3 require attention",
    trend: "warn",
  },
  {
    id: "inventory-value",
    label: "Inventory Value",
    value: "₱ 1,062,000",
    sub: "Across 142 SKUs",
    trend: "neutral",
  },
] as const;

const LOW_STOCK_ITEMS = [
  { id: 1, name: "Kutsara (Stainless)", stock: 4, min: 20 },
  { id: 2, name: "Plato (10 inch)", stock: 2, min: 15 },
  { id: 3, name: "Baso (Regular)", stock: 6, min: 25 },
  { id: 4, name: "Tray (Rectangular)", stock: 1, min: 10 },
  { id: 5, name: "Sabitan (Small)", stock: 8, min: 30 },
];

const RECENT_ACTIVITY = [
  { id: 1, type: "sale",     text: "Order #1042 completed",          time: "5m ago",  badge: "success" },
  { id: 2, type: "stock",    text: "Baso (Regular) low stock alert",  time: "22m ago", badge: "warning" },
  { id: 3, type: "purchase", text: "PO #201 received from supplier",  time: "1h ago",  badge: "default" },
  { id: 4, type: "sale",     text: "Order #1041 completed",          time: "2h ago",  badge: "success" },
  { id: 5, type: "stock",    text: "Plato (10 inch) restocked (+50)", time: "3h ago",  badge: "default" },
  { id: 6, type: "sale",     text: "Order #1040 completed",          time: "4h ago",  badge: "success" },
];

const QUICK_ACTIONS = [
  { label: "New Order",       href: "/dashboard/orders",     variant: "primary"   },
  { label: "Add Inventory",   href: "/dashboard/inventory",  variant: "secondary" },
  { label: "New Purchase",    href: "/dashboard/purchasing", variant: "secondary" },
  { label: "View Finance",    href: "/dashboard/finance",    variant: "secondary" },
] as const;

// ── Trend arrow ──────────────────────────────────────────────────
function TrendIcon({ trend }: { trend: string }) {
  if (trend === "up") return (
    <span className="text-(--color-success) text-sm font-medium flex items-center gap-0.5">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
        <path d="M7 3l5 5H2l5-5z" />
      </svg>
    </span>
  );
  if (trend === "warn") return (
    <span className="text-(--color-warning) text-sm">!</span>
  );
  return null;
}

// ── Badge variant helper ─────────────────────────────────────────
type BadgeVariant = "default" | "success" | "warning" | "danger" | "neutral";
function activityBadgeVariant(v: string): BadgeVariant {
  if (v === "success") return "success";
  if (v === "warning") return "warning";
  return "default";
}

// ── Page ─────────────────────────────────────────────────────────
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Business overview for Sinag Ukit — June 30, 2026"
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KPI_CARDS.map((kpi) => (
          <Card key={kpi.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-(--color-text-muted)">
                {kpi.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold text-(--color-text)">{kpi.value}</span>
                <TrendIcon trend={kpi.trend} />
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
            <ul className="divide-y divide-(--color-border)">
              {RECENT_ACTIVITY.map((item) => (
                <li key={item.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <span className="text-sm text-(--color-text)">{item.text}</span>
                  <div className="flex items-center gap-3 ml-4 shrink-0">
                    <Badge variant={activityBadgeVariant(item.badge)}>
                      {item.badge === "success" ? "Done" : item.badge === "warning" ? "Alert" : "Info"}
                    </Badge>
                    <span className="text-xs text-(--color-text-subtle) w-14 text-right">{item.time}</span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Low Stock — 1/3 width */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Low Stock Items</CardTitle>
              <Badge variant="danger">{LOW_STOCK_ITEMS.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-(--color-border)">
              {LOW_STOCK_ITEMS.map((item) => (
                <li key={item.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                  <span className="text-sm text-(--color-text) truncate pr-2">{item.name}</span>
                  <span className="text-sm font-semibold text-(--color-danger) shrink-0">
                    {item.stock} <span className="text-xs text-(--color-text-subtle) font-normal">/ {item.min} min</span>
                  </span>
                </li>
              ))}
            </ul>
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
