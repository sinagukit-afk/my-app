"use client";

import { useState } from "react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { MoveStockDialog, AdjustIncomingDialog } from "./stock-status-dialogs";

export type InventoryMonitoringRow = {
  id: string;
  variant_id: string;
  store_id: string;
  item_name: string;
  sku: string | null;
  category: string | null;
  store_name: string;
  available_qty: number;
  reserved_qty: number;
  in_production_qty: number;
  on_hold_qty: number;
  incoming_qty: number;
  on_hand: number;
  projected_stock: number;
};

function formatQty(value: number) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 3 }).format(value);
}

type Props = {
  data: InventoryMonitoringRow[];
  canAdjust: boolean;
};

export function InventoryMonitoringTable({ data, canAdjust }: Props) {
  const [moveStockRow, setMoveStockRow] = useState<InventoryMonitoringRow | null>(null);
  const [adjustIncomingRow, setAdjustIncomingRow] = useState<InventoryMonitoringRow | null>(null);

  const columns: Column<InventoryMonitoringRow>[] = [
    {
      key: "item_name",
      header: "Item",
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-(--color-text)">{String(value)}</p>
          {row.sku && <p className="text-xs text-(--color-text-muted)">{row.sku}</p>}
        </div>
      ),
    },
    { key: "category", header: "Category", sortable: true, render: (v) => (v as string) || <span className="text-(--color-text-subtle)">—</span> },
    { key: "store_name", header: "Store" },
    {
      key: "available_qty",
      header: "Available",
      sortable: true,
      render: (v) => <Badge variant="success">{formatQty(Number(v))}</Badge>,
    },
    {
      key: "reserved_qty",
      header: "Reserved",
      sortable: true,
      render: (v) => <Badge variant="info">{formatQty(Number(v))}</Badge>,
    },
    {
      key: "in_production_qty",
      header: "In Production",
      sortable: true,
      render: (v) => <Badge variant="default">{formatQty(Number(v))}</Badge>,
    },
    {
      key: "on_hold_qty",
      header: "On Hold",
      sortable: true,
      render: (v) => <Badge variant="warning">{formatQty(Number(v))}</Badge>,
    },
    {
      key: "incoming_qty",
      header: "Incoming",
      sortable: true,
      render: (v) => <Badge variant="neutral">{formatQty(Number(v))}</Badge>,
    },
    {
      key: "on_hand",
      header: "On Hand",
      sortable: true,
      render: (v) => <span className="font-medium">{formatQty(Number(v))}</span>,
    },
    {
      key: "projected_stock",
      header: "Projected",
      sortable: true,
      render: (v) => <span className="font-medium">{formatQty(Number(v))}</span>,
    },
  ];

  if (canAdjust) {
    columns.push({
      key: "variant_id",
      header: "",
      render: (_v, row) => (
        <div className="flex items-center gap-3">
          <Button variant="link" size="sm" onClick={() => setMoveStockRow(row)}>
            Move Stock
          </Button>
          <Button variant="link" size="sm" onClick={() => setAdjustIncomingRow(row)}>
            Adjust Incoming
          </Button>
        </div>
      ),
    });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventory Monitoring"
        description="Available, Reserved, In Production, On Hold, and Incoming stock per item."
      />

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search inventory…"
        emptyMessage="No tracked inventory found"
        emptyDescription="Items with stock tracking enabled will appear here."
      />

      <MoveStockDialog
        open={moveStockRow !== null}
        onOpenChange={(open) => !open && setMoveStockRow(null)}
        row={moveStockRow}
      />
      <AdjustIncomingDialog
        open={adjustIncomingRow !== null}
        onOpenChange={(open) => !open && setAdjustIncomingRow(null)}
        row={adjustIncomingRow}
      />
    </div>
  );
}
