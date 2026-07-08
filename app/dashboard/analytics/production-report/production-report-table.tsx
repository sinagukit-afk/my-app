"use client";

import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import {
  PRODUCTION_ORDER_STATUS_LABEL,
  PRODUCTION_ORDER_STATUS_VARIANT,
  type ProductionOrderStatus,
} from "@/lib/production-order-status";

export type { ProductionOrderStatus };

export type ProductionOrderRow = {
  id: string;
  productionOrderNumber: string;
  orderNumber: string;
  itemName: string;
  sku: string | null;
  modifiers: string[];
  quantity: number;
  status: ProductionOrderStatus;
  createdAt: string;
  updatedAt: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

const columns: Column<ProductionOrderRow>[] = [
  { key: "productionOrderNumber", header: "Production Order No.", sortable: true },
  { key: "orderNumber", header: "Customer Order", sortable: true },
  {
    key: "itemName",
    header: "Product",
    render: (_value, row) => (
      <div>
        <span className="text-(--color-text)">
          {row.itemName}
          {row.sku ? ` (${row.sku})` : ""}
        </span>
        {row.modifiers.length > 0 && (
          <p className="text-xs text-(--color-text-muted)">{row.modifiers.join(", ")}</p>
        )}
      </div>
    ),
  },
  { key: "quantity", header: "Quantity", sortable: true },
  {
    key: "status",
    header: "Status",
    sortable: true,
    render: (value) => {
      const status = value as ProductionOrderStatus;
      return (
        <Badge variant={PRODUCTION_ORDER_STATUS_VARIANT[status] ?? "neutral"}>
          {PRODUCTION_ORDER_STATUS_LABEL[status] ?? status}
        </Badge>
      );
    },
  },
  { key: "createdAt", header: "Created", sortable: true, render: (value) => formatDate(value as string) },
  { key: "updatedAt", header: "Last Updated", sortable: true, render: (value) => formatDate(value as string) },
];

export function ProductionOrdersTable({ data }: { data: ProductionOrderRow[] }) {
  const router = useRouter();

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Search production orders…"
      emptyMessage="No production orders"
      emptyDescription="No production orders were created in the selected date range."
      onRowClick={(row) => router.push(`/dashboard/orders/production/${row.productionOrderNumber}`)}
    />
  );
}
