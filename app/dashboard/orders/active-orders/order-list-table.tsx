"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { FilterBar } from "@/components/business/filter-bar";
import { DateRangeFilter } from "@/components/business/date-range-filter";

export type OrderRow = {
  orderNumber: string;
  customerName: string | null;
  orderDate: string;
  createdAt: string;
  updatedAt: string;
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
  { label: "On Hold", value: "on_hold" },
  { label: "Cancelled", value: "cancelled" },
];

const PAYMENT_STATUS_VARIANT: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  Unpaid: "danger",
  "Partially Paid": "warning",
  Paid: "success",
  Overpaid: "neutral",
};

function peso(n: number) {
  return `₱${n.toFixed(2)}`;
}

type Props = {
  data: OrderRow[];
  canCreate: boolean;
  from: string;
  to: string;
};

export function OrderListTable({ data, canCreate, from, to }: Props) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("");

  const filteredData = statusFilter ? data.filter((row) => row.status === statusFilter) : data;

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
    },
    {
      key: "orderDate",
      header: "Order Date",
      sortable: true,
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      render: (value) => new Date(value as string).toLocaleString(),
    },
    {
      key: "updatedAt",
      header: "Modified",
      sortable: true,
      render: (value) => new Date(value as string).toLocaleString(),
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
      render: (value) => peso(value as number),
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
          canCreate ? (
            <Link href="/dashboard/orders/active-orders/new">
              <Button>New Order</Button>
            </Link>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <DateRangeFilter from={from} to={to} />
        <FilterBar options={STATUS_FILTER_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
      </div>

      <DataTable
        columns={columns}
        data={filteredData}
        searchPlaceholder="Search orders…"
        emptyMessage="No orders found"
        emptyDescription="Confirmed quotes will appear here."
        onRowClick={(row) => router.push(`/dashboard/orders/active-orders/${row.orderNumber}`)}
      />
    </div>
  );
}
