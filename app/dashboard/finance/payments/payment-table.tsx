"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { FilterBar } from "@/components/business/filter-bar";
import { DateRangeFilter } from "@/components/business/date-range-filter";
import { formatDate } from "@/lib/utils/format-date";
import { formatCurrency } from "@/lib/utils/format";
import { QtyTile } from "./qty-tile";

export type OrderItemLine = {
  name: string;
  sku: string | null;
  quantity: number;
};

export type OrderRow = {
  orderNumber: string;
  customerName: string | null;
  status: string;
  orderDate: string;
  totalMoney: number;
  shippingFeeTotal: number;
  hasPendingShippingFee: boolean;
  totalPaid: number;
  remainingBalance: number;
  paymentStatus: "Unpaid" | "Partially Paid" | "Paid" | "Overpaid";
  items: OrderItemLine[];
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

type StatusTile = "open" | "on_hold" | "completed" | "cancelled";

// Buckets the full order-status enum (see order-list-table.tsx's STATUS_VARIANT) into
// the 4 tiles the user wants — everything mid-workflow (confirmed through delivered)
// counts as "Open".
function statusTile(status: string): StatusTile {
  if (status === "on_hold") return "on_hold";
  if (status === "completed") return "completed";
  if (status === "cancelled") return "cancelled";
  return "open";
}

type Props = {
  data: OrderRow[];
  from: string;
  to: string;
};

export function PaymentOrdersTable({ data, from, to }: Props) {
  const router = useRouter();
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");
  const [tileFilter, setTileFilter] = useState<StatusTile | "">("");

  function toggleTileFilter(value: StatusTile) {
    setTileFilter((current) => (current === value ? "" : value));
  }

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
    if (paymentStatusFilter && row.paymentStatus !== paymentStatusFilter) return false;
    if (tileFilter && statusTile(row.status) !== tileFilter) return false;
    return true;
  });

  const columns: Column<OrderRow>[] = [
    {
      key: "orderNumber",
      header: "Order No.",
      sortable: true,
      render: (value, row) => (
        <div>
          <span className="text-(--color-text)">{value as string}</span>
          {row.items.length > 0 && (
            <div className="mt-0.5 space-y-0.5">
              {row.items.map((it, i) => (
                <p key={i} className="text-xs text-(--color-text-muted)">
                  {it.name}
                  {it.sku ? ` (${it.sku})` : ""} × {it.quantity}
                </p>
              ))}
            </div>
          )}
        </div>
      ),
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
      render: (value) => formatDate(value as string),
    },
    {
      key: "totalMoney",
      header: "Order Total",
      sortable: true,
      render: (value) => formatCurrency(value as number),
    },
    {
      key: "shippingFeeTotal",
      header: "Shipping Fee",
      sortable: true,
      render: (value, row) => {
        if (row.hasPendingShippingFee) {
          return (
            <Badge variant="warning" title="Courier cost was recorded but no shipping fee was charged to the customer">
              Fee not set
            </Badge>
          );
        }
        return value ? (
          formatCurrency(value as number)
        ) : (
          <span className="text-(--color-text-subtle)">—</span>
        );
      },
    },
    {
      key: "totalPaid",
      header: "Total Paid",
      sortable: true,
      render: (value) => formatCurrency(value as number),
    },
    {
      key: "remainingBalance",
      header: "Remaining Balance",
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
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customer Payment"
        description="Orders from confirmation through completion. Click a row to record or review payments."
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
        pageSize={50}
        searchPlaceholder="Search orders…"
        emptyMessage="No orders to display"
        emptyDescription="Confirmed orders will appear here until they are completed."
        onRowClick={(row) => router.push(`/dashboard/finance/payments/${row.orderNumber}`)}
        exportFilename="customer-payments"
      />
    </div>
  );
}
