"use client";

import { useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";

export type MovementRow = {
  id: string;
  movement_type: string;
  quantity_change: number;
  quantity_after: number | null;
  note: string | null;
  occurred_at: string;
  item_name: string;
  variant_label: string | null;
  store_name: string;
};

const TYPE_BADGE: Record<string, "default" | "success" | "warning" | "danger" | "neutral"> = {
  initial_sync: "neutral",
  incoming: "success",
  sale: "default",
  adjustment: "warning",
  manual_adjustment: "warning",
  order: "default",
};

const TYPE_LABEL: Record<string, string> = {
  initial_sync: "Initial Sync",
  incoming: "Incoming",
  sale: "Sale",
  adjustment: "Adjustment",
  manual_adjustment: "Manual Adjustment",
  order: "Order",
};

type Props = {
  data: MovementRow[];
};

export function MovementsTable({ data }: Props) {
  const [typeFilter, setTypeFilter] = useState("");

  const types = useMemo(
    () => Array.from(new Set(data.map((r) => r.movement_type))).sort(),
    [data]
  );

  const filtered = useMemo(
    () => (typeFilter ? data.filter((r) => r.movement_type === typeFilter) : data),
    [data, typeFilter]
  );

  const columns: Column<MovementRow>[] = [
    {
      key: "occurred_at",
      header: "Date",
      sortable: true,
      render: (value) =>
        new Date(value as string).toLocaleString("en-PH", {
          dateStyle: "medium",
          timeStyle: "short",
        }),
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
      key: "store_name",
      header: "Store",
    },
    {
      key: "movement_type",
      header: "Type",
      sortable: true,
      render: (value) => (
        <Badge variant={TYPE_BADGE[value as string] ?? "neutral"}>
          {TYPE_LABEL[value as string] ?? String(value)}
        </Badge>
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
      header: "Note",
      className: "max-w-xs truncate",
      render: (value) => (value as string) || <span className="text-(--color-text-subtle)">—</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stock Movement"
        description="A chronological log of every stock movement across all locations."
        actions={
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            options={[
              { value: "", label: "All types" },
              ...types.map((t) => ({ value: t, label: TYPE_LABEL[t] ?? t })),
            ]}
            className="w-48"
          />
        }
      />

      <DataTable
        columns={columns}
        data={filtered}
        searchPlaceholder="Search movements…"
        emptyMessage="No stock movements found"
        emptyDescription="Movements will appear here once items are received, adjusted, or sold."
      />
    </div>
  );
}
