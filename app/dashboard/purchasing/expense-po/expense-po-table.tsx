"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { FilterBar } from "@/components/business/filter-bar";
import { DateRangeFilter } from "@/components/business/date-range-filter";
import { formatDate } from "@/lib/utils/format-date";
import { formatCurrency } from "@/lib/utils/format";

export type ExpensePORow = {
  id: string;
  reference: string;
  status: string;
  order_date: string;
  expected_date: string | null;
  total: number;
  supplier_name: string;
  item_count: number;
};

type Props = {
  data: ExpensePORow[];
  canWrite: boolean;
  from: string;
  to: string;
};

const STATUS_VARIANT: Record<string, "neutral" | "success" | "warning" | "danger" | "default"> = {
  draft: "neutral",
  sent: "default",
  partial: "warning",
  received: "success",
  cancelled: "danger",
};

const STATUS_FILTER_OPTIONS = [
  { label: "All Statuses", value: "" },
  { label: "Open (Draft/Sent/Partial)", value: "open" },
  { label: "Draft", value: "draft" },
  { label: "Sent", value: "sent" },
  { label: "Partial", value: "partial" },
  { label: "Received", value: "received" },
  { label: "Cancelled", value: "cancelled" },
];

const OPEN_STATUSES = new Set(["draft", "sent", "partial"]);

export function ExpensePOTable({ data, canWrite, from, to }: Props) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("");

  const filteredData = data.filter((row) => {
    if (!statusFilter) return true;
    if (statusFilter === "open") return OPEN_STATUSES.has(row.status);
    return row.status === statusFilter;
  });

  const columns: Column<ExpensePORow>[] = [
    { key: "reference", header: "Reference", sortable: true },
    { key: "supplier_name", header: "Supplier", sortable: true },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (value) => <Badge variant={STATUS_VARIANT[value as string] ?? "neutral"}>{String(value)}</Badge>,
    },
    { key: "order_date", header: "Order Date", sortable: true, render: (value) => formatDate(value as string) },
    {
      key: "expected_date",
      header: "Expected",
      render: (value) => (value ? formatDate(value as string) : <span className="text-(--color-text-subtle)">—</span>),
    },
    { key: "item_count", header: "Lines" },
    {
      key: "total",
      header: "Total",
      sortable: true,
      render: (value) => formatCurrency(value as number),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Expense Purchase Orders"
        description="Request approval to purchase operating expenses before buying — routes to Finance → Expenses on receipt. Click a row to view details."
        actions={
          canWrite ? (
            <Link href="/dashboard/purchasing/expense-po/new">
              <Button>New Expense PO</Button>
            </Link>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <DateRangeFilter from={from} to={to} />
        <FilterBar
          aria-label="Filter by status"
          options={STATUS_FILTER_OPTIONS}
          value={statusFilter}
          onChange={setStatusFilter}
        />
      </div>

      <DataTable
        columns={columns}
        data={filteredData}
        exportFilename="expense-purchase-orders"
        searchPlaceholder="Search expense purchase orders…"
        emptyMessage="No expense purchase orders found"
        emptyDescription="Create your first expense PO to get started."
        onRowClick={(row) => router.push(`/dashboard/purchasing/expense-po/${row.reference}`)}
        rowHref={(row) => `/dashboard/purchasing/expense-po/${row.reference}`}
      />
    </div>
  );
}
