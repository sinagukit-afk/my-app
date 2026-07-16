"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { FilterBar } from "@/components/business/filter-bar";
import { DateRangeFilter } from "@/components/business/date-range-filter";
import { formatDate } from "@/lib/utils/format-date";

export type SupplierPayableType = "inventory_po" | "manual_incoming" | "expense_po" | "direct_expense" | "asset_po";

export type SupplierPayableRow = {
  key: string;
  type: SupplierPayableType;
  reference: string;
  supplier_name: string | null;
  date: string;
  total: number;
  paid: number;
  remaining: number;
  payment_status: "unpaid" | "partial" | "paid";
  detail_href: string;
};

const TYPE_LABEL: Record<SupplierPayableType, string> = {
  inventory_po: "Inventory PO",
  manual_incoming: "Manual Incoming",
  expense_po: "Expense PO",
  direct_expense: "Direct Expense",
  asset_po: "Asset PO",
};

const PAYMENT_STATUS_VARIANT: Record<SupplierPayableRow["payment_status"], "danger" | "warning" | "success"> = {
  unpaid: "danger",
  partial: "warning",
  paid: "success",
};

const TYPE_FILTER_OPTIONS = [
  { label: "All Types", value: "" },
  { label: "Inventory PO", value: "inventory_po" },
  { label: "Expense PO", value: "expense_po" },
  { label: "Asset PO", value: "asset_po" },
  { label: "Manual Incoming", value: "manual_incoming" },
  { label: "Direct Expense", value: "direct_expense" },
];

const PAYMENT_STATUS_FILTER_OPTIONS = [
  { label: "All Statuses", value: "" },
  { label: "Unpaid", value: "unpaid" },
  { label: "Partial", value: "partial" },
  { label: "Paid", value: "paid" },
];

function peso(n: number) {
  return `₱${n.toFixed(2)}`;
}

type Props = {
  data: SupplierPayableRow[];
  from: string;
  to: string;
};

export function SupplierPaymentTable({ data, from, to }: Props) {
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filteredData = data
    .filter((row) => !typeFilter || row.type === typeFilter)
    .filter((row) => !statusFilter || row.payment_status === statusFilter);

  const columns: Column<SupplierPayableRow>[] = [
    { key: "reference", header: "Reference", sortable: true },
    {
      key: "type",
      header: "Type",
      sortable: true,
      render: (value) => <Badge variant="neutral">{TYPE_LABEL[value as SupplierPayableType]}</Badge>,
    },
    {
      key: "supplier_name",
      header: "Supplier",
      sortable: true,
      render: (value) => (value as string) || <span className="text-(--color-text-subtle)">—</span>,
    },
    {
      key: "date",
      header: "Date",
      sortable: true,
      render: (value) => formatDate(value as string),
    },
    { key: "total", header: "Total", sortable: true, render: (value) => peso(value as number) },
    { key: "paid", header: "Paid", sortable: true, render: (value) => peso(value as number) },
    { key: "remaining", header: "Remaining", sortable: true, render: (value) => peso(value as number) },
    {
      key: "payment_status",
      header: "Payment Status",
      sortable: true,
      render: (value) => (
        <Badge variant={PAYMENT_STATUS_VARIANT[value as SupplierPayableRow["payment_status"]]}>
          {(value as string).charAt(0).toUpperCase() + (value as string).slice(1)}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Supplier Payment"
        description="Inventory PO, Expense PO, Asset PO, and Manual Incoming payables. Click a row to record or review payments."
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <DateRangeFilter from={from} to={to} />
        <div className="flex flex-wrap items-center gap-2">
          <FilterBar
            aria-label="Filter by type"
            options={TYPE_FILTER_OPTIONS}
            value={typeFilter}
            onChange={setTypeFilter}
          />
          <FilterBar
            aria-label="Filter by payment status"
            options={PAYMENT_STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredData}
        searchPlaceholder="Search supplier payables…"
        emptyMessage="No supplier payables to display"
        emptyDescription="Inventory receipts, expense/asset POs, and manual incoming logs will appear here."
        onRowClick={(row) => router.push(row.detail_href)}
      />
    </div>
  );
}
