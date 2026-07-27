"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { FilterBar } from "@/components/business/filter-bar";
import { MonthFilter } from "@/components/business/month-filter";
import { YearFilter } from "@/components/business/year-filter";
import { formatDate } from "@/lib/utils/format-date";
import { formatCurrency } from "@/lib/utils/format";
import { QtyTile } from "./qty-tile";

export type OrderRow = {
  orderNumber: string;
  customerName: string | null;
  orderDate: string;
  targetDate: string;
  status: string;
  totalItems: number;
  totalMoney: number;
  paymentStatus: "Unpaid" | "Partially Paid" | "Paid" | "Overpaid";
  lastActivity: string;
};

const STATUS_VARIANT: Record<string, "success" | "default" | "danger" | "warning" | "neutral"> = {
  confirmed: "default",
  in_production: "warning",
  partially_completed: "warning",
  production_completed: "success",
  ready_for_shipping: "default",
  shipped: "default",
  delivered: "success",
  completed: "success",
  on_hold: "neutral",
  cancelled: "danger",
};

const STATUS_FILTER_OPTIONS = [
  { label: "All", value: "" },
  { label: "Confirmed", value: "confirmed" },
  { label: "In Production", value: "in_production" },
  { label: "Partially Completed", value: "partially_completed" },
  { label: "Production Completed", value: "production_completed" },
  { label: "Ready for Shipping", value: "ready_for_shipping" },
  { label: "Shipped", value: "shipped" },
  { label: "Delivered", value: "delivered" },
  { label: "Completed", value: "completed" },
  { label: "On Hold", value: "on_hold" },
  { label: "Cancelled", value: "cancelled" },
];

const PAYMENT_STATUS_VARIANT: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  Unpaid: "danger",
  "Partially Paid": "warning",
  Paid: "success",
  Overpaid: "neutral",
};

type StatusTile = "open" | "on_hold" | "completed" | "cancelled";

// Buckets the full order-status enum into the 4 tiles the user wants — everything
// mid-workflow (confirmed through delivered) counts as "Open". Mirrors Customer
// Payment's tile bucketing (app/dashboard/finance/payments/payment-table.tsx).
function statusTile(status: string): StatusTile {
  if (status === "on_hold") return "on_hold";
  if (status === "completed") return "completed";
  if (status === "cancelled") return "cancelled";
  return "open";
}

type Props = {
  data: OrderRow[];
  canCreate: boolean;
  year: number;
  month: number;
  years: number[];
  initialStatus?: string;
};

export function OrderListTable({ data, canCreate, year, month, years, initialStatus = "" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [tileFilter, setTileFilter] = useState<StatusTile | "">("");

  function toggleTileFilter(value: StatusTile) {
    setTileFilter((current) => (current === value ? "" : value));
  }

  function clearAllFilters() {
    setStatusFilter("");
    setTileFilter("");
    router.push(pathname);
  }

  const filtersActive =
    statusFilter !== "" || tileFilter !== "" || month !== 0 || year !== new Date().getUTCFullYear();

  const summary = useMemo(
    () => ({
      open: data.filter((r) => statusTile(r.status) === "open").length,
      onHold: data.filter((r) => statusTile(r.status) === "on_hold").length,
      completed: data.filter((r) => statusTile(r.status) === "completed").length,
      cancelled: data.filter((r) => statusTile(r.status) === "cancelled").length,
    }),
    [data]
  );

  const filteredData = data.filter((row) => {
    if (statusFilter && row.status !== statusFilter) return false;
    if (tileFilter && statusTile(row.status) !== tileFilter) return false;
    return true;
  });

  const columns: Column<OrderRow>[] = [
    {
      key: "orderNumber",
      header: "Order No.",
      sortable: true,
    },
    {
      key: "customerName",
      header: "Customer",
      sortable: true,
      render: (value) =>
        (value as string) || <span className="text-(--color-text-subtle)">Walk-in</span>,
      exportValue: (value) => (value as string) || "Walk-in",
    },
    {
      key: "orderDate",
      header: "Order Date",
      sortable: true,
      render: (value) => formatDate(value as string),
      exportValue: (value) => formatDate(value as string),
    },
    {
      key: "targetDate",
      header: "Target Date",
      sortable: true,
      render: (value) => formatDate(value as string),
      exportValue: (value) => formatDate(value as string),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (value) => (
        <Badge variant={STATUS_VARIANT[value as string] ?? "neutral"}>
          {(value as string).replace(/_/g, " ")}
        </Badge>
      ),
      exportValue: (value) => (value as string).replace(/_/g, " "),
    },
    {
      key: "totalItems",
      header: "Total Items",
      sortable: true,
    },
    {
      key: "totalMoney",
      header: "Order Total",
      sortable: true,
      render: (value) => formatCurrency(value as number),
    },
    {
      key: "paymentStatus",
      header: "Payment Status",
      sortable: true,
      render: (value) => (
        <Badge variant={PAYMENT_STATUS_VARIANT[value as string] ?? "neutral"}>{value as string}</Badge>
      ),
    },
    {
      key: "lastActivity",
      header: "Last Activity",
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Active Orders"
        description="Customer orders. Click a row to view details, edit, or move it into production."
        actions={
          <div className="flex items-center gap-2">
            <MonthFilter month={month ? String(month) : ""} />
            <YearFilter year={year} years={years} />
            {canCreate && (
              <Link href="/dashboard/orders/active-orders/new">
                <Button>New Order</Button>
              </Link>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QtyTile
          label="Open"
          value={summary.open.toLocaleString("en-PH")}
          variant="default"
          onClick={() => toggleTileFilter("open")}
          active={tileFilter === "open"}
        />
        <QtyTile
          label="On Hold"
          value={summary.onHold.toLocaleString("en-PH")}
          variant="neutral"
          onClick={() => toggleTileFilter("on_hold")}
          active={tileFilter === "on_hold"}
        />
        <QtyTile
          label="Completed"
          value={summary.completed.toLocaleString("en-PH")}
          variant="success"
          onClick={() => toggleTileFilter("completed")}
          active={tileFilter === "completed"}
        />
        <QtyTile
          label="Cancelled"
          value={summary.cancelled.toLocaleString("en-PH")}
          variant="danger"
          onClick={() => toggleTileFilter("cancelled")}
          active={tileFilter === "cancelled"}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-(--color-text-muted)">Status</span>
          <FilterBar
            options={STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onChange={setStatusFilter}
            aria-label="Status"
          />
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={clearAllFilters} disabled={!filtersActive}>
          Clear All Filters
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filteredData}
        searchPlaceholder="Search orders…"
        emptyMessage="No orders found"
        emptyDescription="Confirmed quotes will appear here."
        onRowClick={(row) => router.push(`/dashboard/orders/active-orders/${row.orderNumber}`)}
        exportFilename="active-orders"
      />
    </div>
  );
}
