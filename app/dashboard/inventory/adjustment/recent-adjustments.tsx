"use client";

import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/utils/format-date";

export type AdjustmentRow = {
  id: string;
  item_name: string;
  variant_label: string | null;
  quantity_change: number;
  quantity_after: number | null;
  note: string | null;
  occurred_at: string;
};

type Props = {
  data: AdjustmentRow[];
};

export function RecentAdjustments({ data }: Props) {
  const columns: Column<AdjustmentRow>[] = [
    {
      key: "occurred_at",
      header: "Date",
      sortable: true,
      render: (value) => formatDate(value as string),
    },
    {
      key: "item_name",
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
      key: "quantity_change",
      header: "Change",
      sortable: true,
      render: (value) => {
        const v = Number(value);
        return (
          <span className={v >= 0 ? "text-(--color-success)" : "text-(--color-danger)"}>
            {v > 0 ? `+${v}` : v}
          </span>
        );
      },
    },
    {
      key: "quantity_after",
      header: "Resulting Stock",
      render: (value) => (value === null ? "—" : String(value)),
    },
    {
      key: "note",
      header: "Reason / Note",
      className: "max-w-sm truncate",
      render: (value) => (value as string) || <span className="text-(--color-text-subtle)">—</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Recent Adjustments" description="The latest manual stock adjustments." />
      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search adjustments…"
        emptyMessage="No adjustments yet"
        emptyDescription="Adjustments you submit will appear here."
        pageSize={10}
      />
    </div>
  );
}
