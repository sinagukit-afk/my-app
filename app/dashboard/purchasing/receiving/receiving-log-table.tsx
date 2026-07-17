"use client";

import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/format-date";
import { formatQty, formatCurrency } from "@/lib/utils/format";

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
