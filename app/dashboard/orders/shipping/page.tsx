import { createClient } from "@/lib/supabase/server";
import {
  ShippingTables,
  type ProductionProgressRow,
  type ShipmentRow,
} from "./shipping-table";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const SHIPPING_STATUSES = ["ready_for_shipping", "shipped"];

export default async function ShippingPage() {
  const supabase = await createClient();

  const { data: productionData, error: productionError } = await supabase
    .from("production_orders")
    .select(
      "id, production_order_number, item_name_snapshot, sku_snapshot, modifiers_snapshot, quantity, status, orders!inner(order_number, status), order_items(quantity, shipment_items(quantity_shipped))"
    )
    .in("orders.status", SHIPPING_STATUSES)
    .order("created_at", { ascending: true });

  const { data: shipmentsData, error: shipmentsError } = await supabase
    .from("order_shipments")
    .select(
      "id, shipment_number, status, fulfillment_type, tracking_number, shipped_at, couriers(name), orders!inner(order_number, status), shipment_items(quantity_shipped, order_items(item_name_snapshot, sku_snapshot))"
    )
    .in("orders.status", SHIPPING_STATUSES)
    .order("created_at", { ascending: false });

  const productionRows: ProductionProgressRow[] = (productionData ?? [])
    .map((po) => {
      const order = firstOf(po.orders);
      const modifiers = Array.isArray(po.modifiers_snapshot)
        ? (po.modifiers_snapshot as { name_snapshot?: string }[]).map((m) => m.name_snapshot ?? "").filter(Boolean)
        : [];
      const shippedQty = (po.order_items ?? []).reduce(
        (sum, it) =>
          sum + (it.shipment_items ?? []).reduce((s, si) => s + Number(si.quantity_shipped), 0),
        0
      );
      return {
        productionOrderNumber: po.production_order_number,
        orderNumber: order?.order_number ?? "",
        orderStatus: order?.status ?? "",
        itemName: po.item_name_snapshot ?? "",
        sku: po.sku_snapshot,
        modifiers,
        quantity: Number(po.quantity),
        shippedQty,
        poStatus: po.status,
      };
    })
    // Only production orders not yet fully shipped — cancelled or fully-shipped rows drop off.
    .filter((row) => row.poStatus !== "cancelled" && row.shippedQty < row.quantity)
    .map(({ poStatus: _poStatus, ...row }) => row);

  const shipmentRows: ShipmentRow[] = (shipmentsData ?? []).map((s) => {
    const order = firstOf(s.orders);
    const courier = firstOf(s.couriers);
    return {
      id: s.id,
      shipmentNumber: s.shipment_number,
      orderNumber: order?.order_number ?? "",
      status: s.status ?? "preparing",
      fulfillmentType: s.fulfillment_type === "pickup" ? "pickup" : "delivery",
      courierName: courier?.name ?? null,
      trackingNumber: s.tracking_number,
      items: (s.shipment_items ?? []).map((si) => {
        const orderItem = firstOf(si.order_items);
        return {
          name: orderItem?.item_name_snapshot ?? "",
          sku: orderItem?.sku_snapshot ?? null,
          quantityShipped: Number(si.quantity_shipped),
        };
      }),
      shippedAt: s.shipped_at,
    };
  });

  return (
    <div className="space-y-6">
      {(productionError || shipmentsError) && (
        <p className="text-sm text-(--color-danger)">
          Failed to load shipping data: {productionError?.message ?? shipmentsError?.message}
        </p>
      )}
      <ShippingTables productionRows={productionRows} shipmentRows={shipmentRows} />
    </div>
  );
}
