"use client";

import { useState } from "react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { FilterBar } from "@/components/business/filter-bar";
import { DateRangeFilter } from "@/components/business/date-range-filter";
import { formatDate } from "@/lib/utils/format-date";
import { formatQty, formatCurrency } from "@/lib/utils/format";

export type ReceivingLogRow = {
  id: string;
  reference: string;
  date_received: string;
  item_name_snapshot: string;
  variant_label: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  total_payable: number;
  shipping_fee: number;
  supplier_name: string | null;
  purchase_order_reference: string | null;
  notes: string | null;
  received_by_email: string | null;
  payment_status: "unpaid" | "partial" | "paid";
};

const PAYMENT_STATUS_VARIANT: Record<ReceivingLogRow["payment_status"], "danger" | "warning" | "success"> = {
  unpaid: "danger",
  partial: "warning",
  paid: "success",
};

const SOURCE_FILTER_OPTIONS = [
  { label: "All Sources", value: "" },
  { label: "Manual", value: "manual" },
  { label: "Purchase Order", value: "po" },
];

const PAYMENT_FILTER_OPTIONS = [
  { label: "All Payment Statuses", value: "" },
  { label: "Unpaid", value: "unpaid" },
  { label: "Partial", value: "partial" },
  { label: "Paid", value: "paid" },
];

type Props = {
  data: ReceivingLogRow[];
  from: string;
  to: string;
};

export function ReceivingLogTable({ data, from, to }: Props) {
  const [sourceFilter, setSourceFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");

  const filteredData = data.filter((row) => {
    if (sourceFilter === "manual" && row.purchase_order_reference) return false;
    if (sourceFilter === "po" && !row.purchase_order_reference) return false;
    if (paymentFilter && row.payment_status !== paymentFilter) return false;
    return true;
  });

  const columns: Column<ReceivingLogRow>[] = [
    {
      key: "reference",
      header: "Receiving No.",
      sortable: true,
      render: (value) => <span className="font-medium text-(--color-text)">{String(value)}</span>,
    },
    {
      key: "date_received",
      header: "Date",
      sortable: true,
      render: (value) => (
        <span className="text-(--color-text-muted) text-sm">{formatDate(value as string)}</span>
      ),
    },
    {
      key: "item_name_snapshot",
      header: "Item",
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-(--color-text)">{String(value)}</p>
          {row.variant_label && (
            <p className="text-xs text-(--color-text-muted)">{row.variant_label}</p>
          )}
        </div>
      ),
    },
    {
      key: "quantity",
      header: "Qty",
      sortable: true,
      render: (value) => <span className="tabular-nums">{formatQty(value as number)}</span>,
    },
    {
      key: "total_payable",
      header: "Total",
      sortable: true,
      render: (value, row) => (
        <div>
          <span className="tabular-nums font-medium">{formatCurrency(value as number)}</span>
          {row.shipping_fee > 0 && (
            <p className="text-xs text-(--color-text-muted)">
              incl. {formatCurrency(row.shipping_fee)} shipping
            </p>
          )}
        </div>
      ),
    },
    {
      key: "purchase_order_reference",
      header: "Source",
      render: (value) =>
        value ? (
          <span className="text-sm text-(--color-text)">PO: {String(value)}</span>
        ) : (
          <Badge variant="neutral">Manual</Badge>
        ),
    },
    {
      key: "supplier_name",
      header: "Supplier",
      render: (value) =>
        value ? (
          <span>{String(value)}</span>
        ) : (
          <span className="text-(--color-text-subtle)">—</span>
        ),
    },
    {
      key: "payment_status",
      header: "Payment Status",
      sortable: true,
      render: (value) => (
        <Badge variant={PAYMENT_STATUS_VARIANT[value as ReceivingLogRow["payment_status"]]}>
          {(value as string).charAt(0).toUpperCase() + (value as string).slice(1)}
        </Badge>
      ),
    },
    {
      key: "received_by_email",
      header: "Received By",
      render: (value) => (
        <span className="text-(--color-text-muted) text-sm">
          {value ? String(value) : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <DateRangeFilter from={from} to={to} />
        <div className="flex flex-wrap gap-3">
          <FilterBar
            aria-label="Filter by source"
            options={SOURCE_FILTER_OPTIONS}
            value={sourceFilter}
            onChange={setSourceFilter}
          />
          <FilterBar
            aria-label="Filter by payment status"
            options={PAYMENT_FILTER_OPTIONS}
            value={paymentFilter}
            onChange={setPaymentFilter}
          />
        </div>
      </div>
      <DataTable
        columns={columns}
        data={filteredData}
        searchPlaceholder="Search receiving log…"
        emptyMessage="No receiving entries yet"
        emptyDescription="Received purchase orders and manual receipts will appear here."
      />
    </div>
  );
}
