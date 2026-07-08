"use client";

import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

export type ReceivingLogRow = {
  id: string;
  reference: string;
  status: string;
  date_received: string;
  item_name_snapshot: string;
  variant_label: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  supplier_name: string | null;
  purchase_order_reference: string | null;
  notes: string | null;
  received_by_email: string | null;
};

type Props = {
  data: ReceivingLogRow[];
};

export function ReceivingLogTable({ data }: Props) {
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
        <span className="text-(--color-text-muted) text-sm">
          {new Date(value as string).toLocaleDateString("en-PH", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </span>
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
      render: (value) => <span className="tabular-nums">{Number(value).toLocaleString()}</span>,
    },
    {
      key: "total_price",
      header: "Total",
      sortable: true,
      render: (value) => (
        <span className="tabular-nums font-medium">
          ₱{Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
        </span>
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
      key: "status",
      header: "Status",
      render: (value) => <Badge variant="success">{String(value)}</Badge>,
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
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Search receiving log…"
      emptyMessage="No receiving entries yet"
      emptyDescription="Received purchase orders and manual receipts will appear here."
    />
  );
}
