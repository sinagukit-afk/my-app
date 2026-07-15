"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { FilterBar } from "@/components/business/filter-bar";
import { formatDate } from "@/lib/utils/format-date";

export type ReviewRow = {
  id: string;
  entry_date: string;
  description: string;
  event_type: string;
  status: string;
  total: number;
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  sale_recognized: "Sale Recognized",
  cogs: "COGS",
  purchase_received: "Purchase Received",
  manual_incoming: "Manual Incoming",
  inventory_adjustment_gain: "Inventory Adjustment (Gain)",
  inventory_adjustment_loss: "Inventory Adjustment (Loss)",
  credit_card_installment_payment: "Credit Card Installment Payment",
  expense_recorded: "Expense Recorded",
  asset_acquired: "Asset Acquired",
  expense_payment: "Expense Payment",
  asset_payment: "Asset Payment",
  depreciation: "Depreciation",
  prepaid_amortization: "Prepaid Amortization",
  schedule_terminated: "Schedule Terminated",
};

const STATUS_VARIANT: Record<string, "warning" | "success" | "danger"> = {
  pending_review: "warning",
  posted: "success",
  rejected: "danger",
};

const STATUS_LABELS: Record<string, string> = {
  pending_review: "Pending Review",
  posted: "Posted",
  rejected: "Rejected",
};

const STATUS_FILTER_OPTIONS = [
  { label: "All", value: "" },
  { label: "Pending Review", value: "pending_review" },
  { label: "Posted", value: "posted" },
  { label: "Rejected", value: "rejected" },
];

type Props = {
  data: ReviewRow[];
};

export function ReviewTable({ data }: Props) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("");

  const filteredData = statusFilter ? data.filter((row) => row.status === statusFilter) : data;

  const columns: Column<ReviewRow>[] = [
    {
      key: "entry_date",
      header: "Date",
      sortable: true,
      render: (value) => formatDate(value as string),
    },
    {
      key: "description",
      header: "Description",
      sortable: true,
      className: "max-w-md truncate",
    },
    {
      key: "event_type",
      header: "Event Type",
      sortable: true,
      render: (value) => (
        <Badge variant="neutral">{EVENT_TYPE_LABELS[value as string] ?? (value as string)}</Badge>
      ),
    },
    {
      key: "total",
      header: "Amount",
      sortable: true,
      render: (value) => (
        <span className="font-medium text-(--color-text)">
          ₱{Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (value) => (
        <Badge variant={STATUS_VARIANT[value as string] ?? "neutral"}>
          {STATUS_LABELS[value as string] ?? (value as string)}
        </Badge>
      ),
    },
    {
      key: "id",
      header: "",
      render: (_value, row) => (
        <Link
          href={`/dashboard/accounting/review/${row.id}`}
          className="text-sm font-medium text-(--color-primary) hover:underline"
        >
          {row.status === "pending_review" ? "Review" : "View"}
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pending Review"
        description="Draft journal entries auto-generated from business events. Edit if needed, then approve to post them to the Journal."
      />

      <FilterBar options={STATUS_FILTER_OPTIONS} value={statusFilter} onChange={setStatusFilter} />

      <DataTable
        columns={columns}
        data={filteredData}
        searchPlaceholder="Search drafts…"
        emptyMessage="No draft journal entries"
        emptyDescription="Drafts appear automatically as sales, purchases, and stock adjustments happen."
        onRowClick={(row) => router.push(`/dashboard/accounting/review/${row.id}`)}
      />
    </div>
  );
}
