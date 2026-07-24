"use client";

import { useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { FilterBar } from "@/components/business/filter-bar";
import { formatDate, formatDateTime } from "@/lib/utils/format-date";

export type QuoteRequestRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  product_category: string | null;
  quantity: string | null;
  needed_by_date: string | null;
  status: string;
  converted_quote_id: string | null;
  created_at: string;
};

type Props = {
  data: QuoteRequestRow[];
};

const STATUS_OPTIONS = [
  { label: "New", value: "new" },
  { label: "Contacted", value: "contacted" },
  { label: "Converted", value: "converted" },
  { label: "Closed", value: "closed" },
  { label: "All statuses", value: "all" },
];

const STATUS_STYLE: Record<string, { label: string; variant: "default" | "info" | "success" | "neutral" }> = {
  new: { label: "New", variant: "default" },
  contacted: { label: "Contacted", variant: "info" },
  converted: { label: "Converted", variant: "success" },
  closed: { label: "Closed", variant: "neutral" },
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLE[status] ?? { label: status, variant: "neutral" as const };
  return <Badge variant={style.variant}>{style.label}</Badge>;
}

export function QuoteRequestsTable({ data }: Props) {
  const [statusFilter, setStatusFilter] = useState("new");

  const filtered = useMemo(
    () => (statusFilter === "all" ? data : data.filter((r) => r.status === statusFilter)),
    [data, statusFilter]
  );

  const columns: Column<QuoteRequestRow>[] = [
    {
      key: "full_name",
      header: "Name",
      sortable: true,
      render: (value, row) => (
        <div className="flex flex-col">
          <span className="font-medium text-(--color-text)">{String(value)}</span>
          <span className="text-xs text-(--color-text-subtle)">
            {row.email ?? row.phone ?? "No contact details"}
          </span>
        </div>
      ),
    },
    {
      key: "product_category",
      header: "Product",
      sortable: true,
      render: (value) =>
        value ? (
          <Badge variant="neutral">{String(value)}</Badge>
        ) : (
          <span className="text-(--color-text-subtle)">—</span>
        ),
    },
    {
      key: "quantity",
      header: "Qty",
      render: (value) => (value ? String(value) : <span className="text-(--color-text-subtle)">—</span>),
    },
    {
      key: "needed_by_date",
      header: "Needed By",
      sortable: true,
      render: (value) =>
        value ? formatDate(value as string) : <span className="text-(--color-text-subtle)">—</span>,
      exportValue: (value) => (value as string | null) ?? "",
    },
    {
      key: "created_at",
      header: "Received",
      sortable: true,
      render: (value) => formatDateTime(value as string),
      exportValue: (value) => value as string,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (value) => <StatusBadge status={String(value)} />,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Quote Requests"
        description="Request-a-quote submissions from sinagukit.com. These are website leads — they don't create ERP quotes until someone does it manually."
      />

      <div className="flex items-center gap-2">
        <FilterBar
          aria-label="Filter by status"
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={setStatusFilter}
        />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        searchPlaceholder="Search by name, email, or product…"
        emptyMessage="No quote requests found"
        emptyDescription="New submissions from the website's Request a Quote form land here."
        rowHref={(row) => `/dashboard/marketing/quote-requests/${row.id}`}
        exportFilename="website-quote-requests"
      />
    </div>
  );
}
