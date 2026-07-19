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
import { formatDate } from "@/lib/utils/format-date";
import { formatCurrency } from "@/lib/utils/format";

export type QuoteRow = {
  id: string;
  quoteNumber: string;
  customerName: string | null;
  status: string;
  quoteDate: string;
  validUntil: string;
  totalMoney: number;
  lastActivity: string;
};

const STATUS_VARIANT: Record<string, "success" | "default" | "danger" | "warning" | "neutral"> = {
  open: "success",
  converted: "default",
  cancelled: "danger",
  expired: "warning",
};

const STATUS_FILTER_OPTIONS = [
  { label: "All", value: "" },
  { label: "Open", value: "open" },
  { label: "Converted", value: "converted" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Expired", value: "expired" },
];

type Props = {
  data: QuoteRow[];
  canCreate: boolean;
  from: string;
  to: string;
};

export function QuotesTable({ data, canCreate, from, to }: Props) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("");

  const filteredData = statusFilter ? data.filter((row) => row.status === statusFilter) : data;

  const columns: Column<QuoteRow>[] = [
    {
      key: "quoteNumber",
      header: "Quote No.",
      sortable: true,
    },
    {
      key: "customerName",
      header: "Customer",
      sortable: true,
      render: (value) => (value as string) || "Walk-in",
    },
    {
      key: "quoteDate",
      header: "Quote Date",
      sortable: true,
      render: (value) => formatDate(value as string),
    },
    {
      key: "validUntil",
      header: "Valid Until",
      sortable: true,
      render: (value) => formatDate(value as string),
    },
    {
      key: "status",
      header: "Status",
      render: (value) => {
        const status = value as string;
        return (
          <Badge variant={STATUS_VARIANT[status] ?? "neutral"}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        );
      },
    },
    {
      key: "totalMoney",
      header: "Total Amount",
      sortable: true,
      render: (value) => formatCurrency(value as number),
    },
    {
      key: "lastActivity",
      header: "Last Activity",
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Quotation"
        description="Prepare quotations for customers. Converting a quote reserves stock and creates a Sales Order."
        actions={
          canCreate ? (
            <Link href="/dashboard/orders/quotation/new">
              <Button>New Quote</Button>
            </Link>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <FilterBar options={STATUS_FILTER_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
        <DateRangeFilter from={from} to={to} />
      </div>

      <DataTable
        columns={columns}
        data={filteredData}
        searchPlaceholder="Search quotes…"
        emptyMessage="No quotes yet"
        emptyDescription="Create a quote to get started."
        onRowClick={(row) => router.push(`/dashboard/orders/quotation/${row.quoteNumber}`)}
        exportFilename="quotations"
      />
    </div>
  );
}
