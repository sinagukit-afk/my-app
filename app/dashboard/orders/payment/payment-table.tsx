"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { FilterBar } from "@/components/business/filter-bar";
import { DateRangeFilter } from "@/components/business/date-range-filter";

export type OrderRow = {
  orderNumber: string;
  customerName: string | null;
  status: string;
  orderDate: string;
  totalMoney: number;
  totalPaid: number;
  remainingBalance: number;
  paymentStatus: "Unpaid" | "Partially Paid" | "Paid" | "Overpaid";
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
};

const PAYMENT_STATUS_VARIANT: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  Unpaid: "danger",
  "Partially Paid": "warning",
  Paid: "success",
  Overpaid: "neutral",
};

const PAYMENT_STATUS_FILTER_OPTIONS = [
  { label: "All", value: "" },
  { label: "Unpaid", value: "Unpaid" },
  { label: "Partially Paid", value: "Partially Paid" },
  { label: "Paid", value: "Paid" },
  { label: "Overpaid", value: "Overpaid" },
];

function peso(n: number) {
  return `₱${n.toFixed(2)}`;
}

type Props = {
  data: OrderRow[];
  from: string;
  to: string;
};

export function PaymentOrdersTable({ data, from, to }: Props) {
  const router = useRouter();
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");

  const filteredData = paymentStatusFilter
    ? data.filter((row) => row.paymentStatus === paymentStatusFilter)
    : data;

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
      key: "orderDate",
      header: "Order Date",
      sortable: true,
    },
    {
      key: "totalMoney",
      header: "Order Total",
      sortable: true,
      render: (value) => peso(value as number),
    },
    {
      key: "totalPaid",
      header: "Total Paid",
      sortable: true,
      render: (value) => peso(value as number),
    },
    {
      key: "remainingBalance",
      header: "Remaining Balance",
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
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Payment"
        description="Orders from confirmation through completion. Click a row to record or review payments."
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <DateRangeFilter from={from} to={to} />
        <FilterBar
          options={PAYMENT_STATUS_FILTER_OPTIONS}
          value={paymentStatusFilter}
          onChange={setPaymentStatusFilter}
        />
      </div>

      <DataTable
        columns={columns}
        data={filteredData}
        searchPlaceholder="Search orders…"
        emptyMessage="No orders to display"
        emptyDescription="Confirmed orders will appear here until they are completed."
        onRowClick={(row) => router.push(`/dashboard/orders/payment/${row.orderNumber}`)}
      />
    </div>
  );
}
