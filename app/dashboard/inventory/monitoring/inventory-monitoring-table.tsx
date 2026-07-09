"use client";

import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import type { StockStatus } from "@/lib/inventory/calculations";

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
  threshold: number | null;
  status: StockStatus;
};

const STATUS_BADGE: Record<StockStatus, { label: string; variant: "success" | "warning" | "danger" }> = {
  ok: { label: "OK", variant: "success" },
  low: { label: "Low Stock", variant: "warning" },
  out: { label: "Out of Stock", variant: "danger" },
};

function formatQty(value: number) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 3 }).format(value);
}

type Props = {
  data: InventoryMonitoringRow[];
};

export function InventoryMonitoringTable({ data }: Props) {
  const router = useRouter();

  function openMovements(row: InventoryMonitoringRow) {
    const slug = row.sku ?? row.variant_id;
    router.push(`/dashboard/inventory/monitoring/${encodeURIComponent(slug)}?store=${encodeURIComponent(row.store_id)}`);
  }

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
    {
      key: "threshold",
      header: "Threshold",
      sortable: true,
      render: (v) => (v == null ? <span className="text-(--color-text-subtle)">—</span> : formatQty(Number(v))),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (v) => {
        const status = STATUS_BADGE[v as StockStatus];
        return <Badge variant={status.variant}>{status.label}</Badge>;
      },
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventory Monitoring"
        description="Available, Reserved, In Production, On Hold, and Incoming stock per item. Click a row to open its full movement history."
      />

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search inventory…"
        emptyMessage="No tracked inventory found"
        emptyDescription="Items with stock tracking enabled will appear here."
        onRowClick={openMovements}
      />
    </div>
  );
}
