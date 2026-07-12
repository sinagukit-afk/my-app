"use client";

import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/utils/format-date";

export type ProductionProgressRow = {
  productionOrderNumber: string;
  orderNumber: string;
  orderStatus: string;
  itemName: string;
  sku: string | null;
  modifiers: string[];
  quantity: number;
  shippedQty: number;
};

export type ShipmentItemLine = {
  name: string;
  sku: string | null;
  quantityShipped: number;
};

export type ShipmentRow = {
  id: string;
  shipmentNumber: string;
  orderNumber: string;
  status: string;
  fulfillmentType: "pickup" | "delivery";
  courierName: string | null;
  trackingNumber: string | null;
  items: ShipmentItemLine[];
  shippedAt: string | null;
};

const SHIPMENT_STATUS_VARIANT: Record<string, "success" | "default" | "neutral"> = {
  preparing: "neutral",
  shipped: "default",
  delivered: "success",
};

const ORDER_STATUS_VARIANT: Record<string, "success" | "default" | "danger" | "warning" | "neutral"> = {
  ready_for_shipping: "default",
  shipped: "warning",
};

type Props = {
  productionRows: ProductionProgressRow[];
  shipmentRows: ShipmentRow[];
};

export function ShippingTables({ productionRows, shipmentRows }: Props) {
  const router = useRouter();

  const productionColumns: Column<ProductionProgressRow>[] = [
    {
      key: "productionOrderNumber",
      header: "Production Order No.",
      sortable: true,
    },
    {
      key: "orderNumber",
      header: "Customer Order",
      sortable: true,
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
      key: "shippedQty",
      header: "Shipped",
      render: (_value, row) => `${row.shippedQty} / ${row.quantity}`,
    },
    {
      key: "orderStatus",
      header: "Order Status",
      sortable: true,
      render: (value) => (
        <Badge variant={ORDER_STATUS_VARIANT[value as string] ?? "neutral"}>
          {(value as string).replace(/_/g, " ")}
        </Badge>
      ),
    },
  ];

  const shipmentColumns: Column<ShipmentRow>[] = [
    {
      key: "shipmentNumber",
      header: "Shipment No.",
      sortable: true,
    },
    {
      key: "orderNumber",
      header: "Customer Order",
      sortable: true,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (value) => (
        <Badge variant={SHIPMENT_STATUS_VARIANT[value as string] ?? "neutral"}>{value as string}</Badge>
      ),
    },
    {
      key: "courierName",
      header: "Courier / Tracking",
      render: (_value, row) =>
        row.fulfillmentType === "pickup" ? (
          <Badge variant="neutral">Pickup</Badge>
        ) : (
          <div>
            <span className="text-(--color-text)">{row.courierName ?? "—"}</span>
            {row.trackingNumber && <p className="text-xs text-(--color-text-muted)">{row.trackingNumber}</p>}
          </div>
        ),
    },
    {
      key: "items",
      header: "Items",
      render: (_value, row) =>
        row.items.length > 0 ? (
          <div className="space-y-0.5">
            {row.items.map((it, i) => (
              <p key={i} className="text-(--color-text)">
                {it.name}
                {it.sku ? ` (${it.sku})` : ""} — {it.quantityShipped}
              </p>
            ))}
          </div>
        ) : (
          <span className="text-(--color-text-subtle)">—</span>
        ),
    },
    {
      key: "shippedAt",
      header: "Shipped",
      sortable: true,
      render: (value) => (value ? formatDate(value as string) : "—"),
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Shipping"
        description="Production progress and shipment contents for orders ready for or currently being shipped."
      />

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-(--color-text)">Production Progress</h2>
        <DataTable
          columns={productionColumns}
          data={productionRows}
          searchPlaceholder="Search production orders…"
          emptyMessage="No production orders in shipping"
          emptyDescription="Production orders on orders that are Ready for Shipping or Shipped will appear here."
          onRowClick={(row) => router.push(`/dashboard/orders/shipping/${row.orderNumber}`)}
        />
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-(--color-text)">Shipments</h2>
        <DataTable
          columns={shipmentColumns}
          data={shipmentRows}
          searchPlaceholder="Search shipments…"
          emptyMessage="No shipments yet"
          emptyDescription="Shipments created on orders that are Ready for Shipping or Shipped will appear here."
          onRowClick={(row) => router.push(`/dashboard/orders/shipping/${row.orderNumber}`)}
        />
      </div>
    </div>
  );
}
