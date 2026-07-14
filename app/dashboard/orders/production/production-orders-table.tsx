"use client";

import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import {
  PRODUCTION_ORDER_STATUS_LABEL,
  PRODUCTION_ORDER_STATUS_VARIANT,
  type ProductionOrderStatus,
} from "@/lib/production-order-status";
import { formatDate } from "@/lib/utils/format-date";
import { formatQty } from "@/lib/utils/format";

export type ProductionOrderRow = {
  id: string;
  productionOrderNumber: string;
  orderNumber: string;
  customerName: string | null;
  itemName: string;
  sku: string | null;
  modifiers: string[];
  quantity: number;
  status: ProductionOrderStatus;
  createdAt: string;
};

type Props = {
  data: ProductionOrderRow[];
};

export function ProductionOrdersTable({ data }: Props) {
  const router = useRouter();

  const columns: Column<ProductionOrderRow>[] = [
    {
      key: "productionOrderNumber",
      header: "Production Order No.",
      sortable: true,
      render: (value, row) => (
        <div>
          <span className="text-(--color-text)">{value as string}</span>
          <p className="text-xs text-(--color-text-muted)">{row.orderNumber}</p>
        </div>
      ),
    },
    {
      key: "customerName",
      header: "Customer",
      sortable: true,
      render: (value) =>
        (value as string) || <span className="text-(--color-text-subtle)">Walk-in</span>,
    },
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
    {
      key: "quantity",
      header: "Quantity",
      sortable: true,
      render: (value) => formatQty(value as number),
    },
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
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      render: (value) => formatDate(value as string),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Production"
        description="Pending Production Orders — Not Started, WIP, or Partially Completed. Completed and Cancelled orders are on the Production Report."
      />

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search production orders…"
        emptyMessage="No pending production orders"
        emptyDescription="Starting production on an Active Order will create Production Orders here."
        onRowClick={(row) => router.push(`/dashboard/orders/production/${row.productionOrderNumber}`)}
      />
    </div>
  );
}
