import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  type OrderShipmentRow,
  type ShippableOrderItem,
  type PackagingVariantOption,
} from "@/app/dashboard/orders/active-orders/[orderNumber]/order-shipments";
import { ShippingOrderDetail, type ShippingOrderData } from "./shipping-order-detail";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function ShippingOrderPage({ params }: { params: Promise<{ orderNumber: string }> }) {
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
      "id, order_number, status, fulfillment_method, customers(name, phone_number, address_line1, barangay, city, province), order_items(id, item_name_snapshot, sku_snapshot, quantity)"
    )
    .eq("order_number", orderNumber)
    .single();

  if (!order) notFound();

  const { data: shipmentsData } = await supabase
    .from("order_shipments")
    .select(
      "id, shipment_number, tracking_number, status, fulfillment_type, ships_to_customer, receiver_name, receiver_phone, receiver_address_line1, receiver_barangay, receiver_city, receiver_province, receiver_postal_code, courier_id, shipping_cost, shipping_fee_charged, courier_payment_type_id, shipped_at, delivered_at, note, couriers(name), shipment_items(order_item_id, quantity_shipped, order_items(item_name_snapshot, sku_snapshot)), shipment_packaging_items(variant_id, quantity_used, item_variants(option1_value, sku, items(name)))"
    )
    .eq("order_id", order.id)
    .order("created_at", { ascending: false });

  const { data: courierData } = await supabase
    .from("couriers")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  const { data: paymentTypesData } = await supabase
    .from("payment_types")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  const { data: packagingCategoryData } = await supabase
    .from("categories")
    .select("items(id, name, item_variants(id, sku, option1_value))")
    .eq("category_type", "packaging")
    .is("deleted_at", null)
    .is("items.deleted_at", null)
    .is("items.item_variants.deleted_at", null);

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

  const isShippingRole = ["admin", "encoder"].includes(role);
  // create_shipment() allows Ready for Shipping or Shipped (PS-17 supersedes D036) — mixed
  // pickup+delivery orders need shipments addable incrementally as each portion is arranged.
  const canAddShipment = isShippingRole && ["ready_for_shipping", "shipped"].includes(order.status);

  const data: ShippingOrderData = {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    customerName: customer?.name ?? null,
    shipmentCustomer: customer
      ? {
          name: customer.name,
          phone: customer.phone_number,
          address:
            [customer.address_line1, customer.barangay, customer.city, customer.province].filter(Boolean).join(", ") ||
            null,
        }
      : null,
    canAddShipment,
    isShippingRole,
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
        courierPaymentTypeId: s.courier_payment_type_id,
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
    packagingOptions: (packagingCategoryData ?? []).flatMap((cat) =>
      (cat.items ?? []).flatMap((item) =>
        (item.item_variants ?? []).map((v): PackagingVariantOption => ({
          id: v.id,
          label: v.option1_value ? `${item.name} — ${v.option1_value}` : item.name,
          sku: v.sku,
        }))
      )
    ),
    courierOptions: (courierData ?? []).map((c) => ({ id: c.id, name: c.name })),
    paymentTypeOptions: (paymentTypesData ?? []).map((pt) => ({ id: pt.id, name: pt.name })),
  };

  return (
    <div className="space-y-6">
      <ShippingOrderDetail data={data} />
    </div>
  );
}
