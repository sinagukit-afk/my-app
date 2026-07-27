"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/business/filter-bar";
import { formatDate } from "@/lib/utils/format-date";
import { QtyTile } from "./qty-tile";

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
  shipment_shipping_cost: "Shipping",
  purchase_received: "Purchase Received",
  manual_incoming: "Manual Incoming",
  inventory_adjustment_gain: "Inventory Adjustment (Gain)",
  inventory_adjustment_loss: "Inventory Adjustment (Loss)",
  credit_card_installment_payment: "Credit Card Installment Payment",
  expense_recorded: "Expense Recorded",
  asset_acquired: "Asset Acquired",
  expense_payment: "Expense Payment",
  asset_payment: "Asset Payment",
  inventory_payment: "Inventory Payment",
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

const DEFAULT_STATUS_FILTER = "pending_review";

export function ReviewTable({ data }: Props) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState(DEFAULT_STATUS_FILTER);
  const [eventTypeFilter, setEventTypeFilter] = useState("");

  // Tiles always summarize the pending-review bucket itself, independent of the
  // status dropdown above, so counts stay stable while switching between tiles.
  const eventTypeSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of data) {
      if (row.status !== "pending_review") continue;
      counts.set(row.event_type, (counts.get(row.event_type) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([eventType, count]) => ({ eventType, count }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  function toggleEventTypeFilter(eventType: string) {
    setEventTypeFilter((current) => (current === eventType ? "" : eventType));
    setStatusFilter(DEFAULT_STATUS_FILTER);
  }

  function clearAllFilters() {
    setStatusFilter(DEFAULT_STATUS_FILTER);
    setEventTypeFilter("");
  }

  const filtersActive = statusFilter !== DEFAULT_STATUS_FILTER || eventTypeFilter !== "";

  const filteredData = data.filter((row) => {
    if (statusFilter && row.status !== statusFilter) return false;
    if (eventTypeFilter && row.event_type !== eventTypeFilter) return false;
    return true;
  });

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
      <div>
        <h2 className="text-lg font-semibold text-(--color-text)">Pending Review</h2>
        <p className="mt-1 text-sm text-(--color-text-muted)">
          Draft journal entries auto-generated from business events. Edit if needed, then approve to post them to the Journal.
        </p>
      </div>

      {eventTypeSummary.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {eventTypeSummary.map(({ eventType, count }) => (
            <QtyTile
              key={eventType}
              label={EVENT_TYPE_LABELS[eventType] ?? eventType}
              value={count.toLocaleString("en-PH")}
              onClick={() => toggleEventTypeFilter(eventType)}
              active={eventTypeFilter === eventType}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterBar options={STATUS_FILTER_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
        <Button type="button" variant="ghost" size="sm" onClick={clearAllFilters} disabled={!filtersActive}>
          Clear All Filters
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filteredData}
        pageSize={5}
        searchPlaceholder="Search drafts…"
        emptyMessage="No draft journal entries"
        emptyDescription="Drafts appear automatically as sales, purchases, and stock adjustments happen."
        onRowClick={(row) => router.push(`/dashboard/accounting/review/${row.id}`)}
      />
    </div>
  );
}
