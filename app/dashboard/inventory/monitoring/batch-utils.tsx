import { Badge } from "@/components/ui/badge";
import type { Column } from "@/components/ui/data-table";
import { formatDate } from "@/lib/utils/format-date";
import { formatQty } from "@/lib/utils/format";

export type BatchRow = {
  id: string;
  reference: string;
  date_received: string;
  quantity: number;
  lot_available_qty: number;
  lot_reserved_qty: number;
  lot_in_production_qty: number;
  lot_on_hold_qty: number;
  shipped_qty: number;
};

export const BATCH_SELECT =
  `id, reference, date_received, quantity, lot_available_qty, lot_reserved_qty, lot_in_production_qty, lot_on_hold_qty`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapBatchRow(b: any): BatchRow {
  const available = Number(b.lot_available_qty);
  const reserved = Number(b.lot_reserved_qty);
  const inProduction = Number(b.lot_in_production_qty);
  const onHold = Number(b.lot_on_hold_qty);
  return {
    id: b.id,
    reference: b.reference,
    date_received: b.date_received,
    quantity: Number(b.quantity),
    lot_available_qty: available,
    lot_reserved_qty: reserved,
    lot_in_production_qty: inProduction,
    lot_on_hold_qty: onHold,
    shipped_qty: Number(b.quantity) - (available + reserved + inProduction + onHold),
  };
}

export function batchColumns(): Column<BatchRow>[] {
  return [
    {
      key: "reference",
      header: "Batch",
      sortable: true,
      render: (value) => <span className="font-medium text-(--color-text)">{String(value)}</span>,
    },
    {
      key: "date_received",
      header: "Received Date",
      sortable: true,
      render: (value) => formatDate(value as string),
    },
    {
      key: "quantity",
      header: "Qty Received",
      sortable: true,
      render: (value) => formatQty(value as number),
    },
    {
      key: "lot_available_qty",
      header: "Available",
      sortable: true,
      render: (value) => <Badge variant="success">{formatQty(value as number)}</Badge>,
    },
    {
      key: "lot_reserved_qty",
      header: "Reserved",
      sortable: true,
      render: (value) => <Badge variant="info">{formatQty(value as number)}</Badge>,
    },
    {
      key: "lot_in_production_qty",
      header: "In Production",
      sortable: true,
      render: (value) => <Badge variant="default">{formatQty(value as number)}</Badge>,
    },
    {
      key: "lot_on_hold_qty",
      header: "On Hold",
      sortable: true,
      render: (value) => <Badge variant="warning">{formatQty(value as number)}</Badge>,
    },
    {
      key: "shipped_qty",
      header: "Shipped",
      sortable: true,
      render: (value) => <span className="font-medium text-(--color-text)">{formatQty(value as number)}</span>,
    },
  ];
}
