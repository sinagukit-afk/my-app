import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnHoldOrderDetail, type OnHoldOrderData, type OnHoldOrderItem } from "./on-hold-order-detail";
import type {
  OrderShipmentRow,
  ShippableOrderItem,
} from "../../active-orders/[orderNumber]/order-shipments";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function OnHoldOrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, note, target_date, created_at, total_discount, total_money, customers(id, name, phone_number, email, address_line1, barangay, city, province), order_items(id, item_name_snapshot, sku_snapshot, quantity, unit_price, line_discount, reserved_qty, completed_qty, order_item_modifiers(name_snapshot, price_snapshot), production_orders(production_order_number, status, quantity, completed_qty))"
    )
    .eq("order_number", orderNumber)
    .single();

  if (!order || order.status !== "on_hold") notFound();

  const { data: shipmentsData } = await supabase
    .from("order_shipments")
    .select(
      "id, shipment_number, tracking_number, status, fulfillment_type, ships_to_customer, receiver_name, receiver_phone, receiver_address_line1, receiver_barangay, receiver_city, receiver_province, receiver_postal_code, courier_id, shipping_cost, shipping_fee_charged, shipped_at, delivered_at, note, couriers(name), shipment_items(order_item_id, quantity_shipped, order_items(item_name_snapshot, sku_snapshot)), shipment_packaging_items(variant_id, quantity_used, item_variants(option1_value, sku, items(name)))"
    )
    .eq("order_id", order.id)
    .order("created_at", { ascending: false });

  const customer = firstOf(order.customers);

  const shippedQtyByOrderItem = new Map<string, number>();
  for (const s of shipmentsData ?? []) {
    for (const si of s.shipment_items ?? []) {
      shippedQtyByOrderItem.set(
        si.order_item_id,
        (shippedQtyByOrderItem.get(si.order_item_id) ?? 0) + Number(si.quantity_shipped)
      );
    }
  }

  const canResume = role === "admin" && order.status === "on_hold";
  const canCancel = role === "admin" && order.status === "on_hold";
  const isShippingRole = ["admin", "encoder"].includes(role);

  const data: OnHoldOrderData = {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    note: order.note,
    targetDate: order.target_date,
    createdAt: order.created_at,
    totalDiscount: Number(order.total_discount),
    totalMoney: Number(order.total_money),
    customerName: customer?.name ?? null,
    customerPhone: customer?.phone_number ?? null,
    customerEmail: customer?.email ?? null,
    customerAddress:
      [customer?.address_line1, customer?.barangay, customer?.city, customer?.province].filter(Boolean).join(", ") ||
      null,
    shipmentCustomer: customer
      ? {
          name: customer.name,
          phone: customer.phone_number,
          address:
            [customer.address_line1, customer.barangay, customer.city, customer.province].filter(Boolean).join(", ") ||
            null,
        }
      : null,
    items: (order.order_items ?? []).map((it): OnHoldOrderItem => {
      const productionOrder = firstOf(it.production_orders);
      const poQuantity = productionOrder ? Number(productionOrder.quantity) : 0;
      const completedQty =
        productionOrder && poQuantity > 0
          ? Math.round((Number(productionOrder.completed_qty) * Number(it.quantity)) / poQuantity)
          : Number(it.completed_qty);
      return {
        id: it.id,
        name: it.item_name_snapshot ?? "",
        sku: it.sku_snapshot,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unit_price),
        discount: Number(it.line_discount),
        reservedQty: Number(it.reserved_qty),
        completedQty,
        modifiers: (it.order_item_modifiers ?? []).map((m) => ({
          name: m.name_snapshot ?? "",
          price: Number(m.price_snapshot),
        })),
        productionOrderNumber: productionOrder?.production_order_number ?? null,
        productionOrderStatus: productionOrder?.status ?? null,
      };
    }),
    shipments: (shipmentsData ?? []).map((s): OrderShipmentRow => {
      const courier = firstOf(s.couriers);
      return {
        id: s.id,
        shipmentNumber: s.shipment_number,
        status: s.status ?? "preparing",
        fulfillmentType: s.fulfillment_type === "pickup" ? "pickup" : "delivery",
        shipsToCustomer: s.ships_to_customer,
        receiverName: s.receiver_name,
        receiverPhone: s.receiver_phone,
        receiverAddressLine1: s.receiver_address_line1,
        receiverBarangay: s.receiver_barangay,
        receiverCity: s.receiver_city,
        receiverProvince: s.receiver_province,
        receiverPostalCode: s.receiver_postal_code,
        courierId: s.courier_id,
        courierName: courier?.name ?? null,
        trackingNumber: s.tracking_number,
        shippingCost: s.shipping_cost != null ? Number(s.shipping_cost) : null,
        shippingFeeCharged: s.shipping_fee_charged != null ? Number(s.shipping_fee_charged) : null,
        shippedAt: s.shipped_at,
        deliveredAt: s.delivered_at,
        note: s.note,
        productLines: (s.shipment_items ?? []).map((si) => {
          const orderItem = firstOf(si.order_items);
          return {
            orderItemId: si.order_item_id,
            name: orderItem?.item_name_snapshot ?? "",
            sku: orderItem?.sku_snapshot ?? null,
            quantityShipped: Number(si.quantity_shipped),
          };
        }),
        packagingLines: (s.shipment_packaging_items ?? []).map((pi) => {
          const variant = firstOf(pi.item_variants);
          const item = variant ? firstOf(variant.items) : null;
          return {
            variantId: pi.variant_id,
            name: variant?.option1_value ? `${item?.name ?? ""} — ${variant.option1_value}` : item?.name ?? "",
            quantityUsed: Number(pi.quantity_used),
          };
        }),
      };
    }),
    shippableItems: (order.order_items ?? []).map((it): ShippableOrderItem => ({
      orderItemId: it.id,
      name: it.item_name_snapshot ?? "",
      sku: it.sku_snapshot,
      remainingQty: Number(it.quantity) - (shippedQtyByOrderItem.get(it.id) ?? 0),
    })),
    packagingOptions: [],
    courierOptions: [],
    canResume,
    canCancel,
    isShippingRole,
  };

  return <OnHoldOrderDetail data={data} />;
}
