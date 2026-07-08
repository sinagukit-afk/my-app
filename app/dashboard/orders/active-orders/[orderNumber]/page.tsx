import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrderDetail, type OrderDetailData, type ActivityLogRow } from "./order-detail";
import type { OrderShipmentRow, ShippableOrderItem, PackagingVariantOption } from "./order-shipments";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function OrderDetailPage({ params }: { params: Promise<{ orderNumber: string }> }) {
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
      "id, order_number, status, note, target_date, created_at, subtotal, total_discount, total_money, payment_closed_at, payment_close_note, tip_amount, payment_closed_by_profile:profiles!orders_payment_closed_by_fkey(full_name, email), customers(id, name, phone_number, email, address_line1, barangay, city, province), order_items(id, item_name_snapshot, sku_snapshot, quantity, unit_price, line_discount, reserved_qty, completed_qty, order_item_modifiers(name_snapshot, price_snapshot), production_orders(production_order_number, status))"
    )
    .eq("order_number", orderNumber)
    .single();

  if (!order) notFound();

  const { data: paymentsData } = await supabase
    .from("order_payments")
    .select("id, payment_date, amount, reference_no, created_at, payment_types(name)")
    .eq("order_id", order.id)
    .order("payment_date", { ascending: false });

  const { data: paymentTypesData } = await supabase
    .from("payment_types")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  const { data: shipmentsData } = await supabase
    .from("order_shipments")
    .select(
      "id, shipment_number, tracking_number, status, fulfillment_type, ships_to_customer, receiver_name, receiver_phone, receiver_address_line1, receiver_barangay, receiver_city, receiver_province, receiver_postal_code, courier_id, shipping_cost, shipping_fee_charged, shipped_at, delivered_at, note, couriers(name), shipment_items(order_item_id, quantity_shipped, order_items(item_name_snapshot, sku_snapshot)), shipment_packaging_items(variant_id, quantity_used, item_variants(option1_value, sku, items(name)))"
    )
    .eq("order_id", order.id)
    .order("created_at", { ascending: false });

  const { data: courierData } = await supabase
    .from("couriers")
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

  const { data: logsData } = await supabase
    .from("activity_logs")
    .select("id, action, description, created_at, profiles(full_name, email)")
    .eq("entity_type", "order")
    .eq("entity_id", order.id)
    .order("created_at", { ascending: false });

  const logs: ActivityLogRow[] = (logsData ?? []).map((l) => {
    const actor = firstOf(l.profiles);
    return {
      id: l.id,
      action: l.action,
      description: l.description ?? "",
      createdAt: l.created_at,
      userName: actor?.full_name ?? actor?.email ?? "System",
    };
  });

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

  const canEdit =
    ["admin", "manager", "encoder"].includes(role) &&
    ["confirmed", "in_production", "partially_completed", "production_completed"].includes(order.status);
  const canAdvance = role === "admin" && order.status === "confirmed";
  const canOverrideReservedQty = ["admin", "manager", "encoder"].includes(role) && order.status === "confirmed";
  const canAddPayment = ["admin", "manager", "encoder"].includes(role);
  const canClosePayment = ["admin", "manager", "encoder"].includes(role);

  const canCancel = role === "admin" && ["confirmed", "in_production", "partially_completed"].includes(order.status);
  const canHold =
    role === "admin" &&
    ["confirmed", "in_production", "partially_completed", "production_completed", "ready_for_shipping"].includes(
      order.status
    );
  const canResume = role === "admin" && order.status === "on_hold";
  const isShippingRole = ["admin", "encoder"].includes(role);
  // create_shipment() allows Ready for Shipping or Shipped (PS-17 supersedes D036) — mixed
  // pickup+delivery orders need shipments addable incrementally as each portion is arranged,
  // not all planned up front. Blocked only once the order is fully Delivered.
  const canAddShipment = isShippingRole && ["ready_for_shipping", "shipped"].includes(order.status);

  const data: OrderDetailData = {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    note: order.note,
    targetDate: order.target_date,
    createdAt: order.created_at,
    subtotal: Number(order.subtotal),
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
    items: (order.order_items ?? []).map((it) => {
      const productionOrder = firstOf(it.production_orders);
      return {
        id: it.id,
        name: it.item_name_snapshot ?? "",
        sku: it.sku_snapshot,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unit_price),
        discount: Number(it.line_discount),
        reservedQty: Number(it.reserved_qty),
        completedQty: Number(it.completed_qty),
        modifiers: (it.order_item_modifiers ?? []).map((m) => ({ name: m.name_snapshot ?? "", price: Number(m.price_snapshot) })),
        productionOrderNumber: productionOrder?.production_order_number ?? null,
        productionOrderStatus: productionOrder?.status ?? null,
      };
    }),
    payments: (paymentsData ?? []).map((p) => {
      const paymentType = firstOf(p.payment_types);
      return {
        id: p.id,
        paymentDate: p.payment_date,
        amount: Number(p.amount),
        paymentTypeName: paymentType?.name ?? null,
        referenceNo: p.reference_no,
        createdAt: p.created_at,
      };
    }),
    paymentTypeOptions: (paymentTypesData ?? []).map((pt) => ({ id: pt.id, name: pt.name })),
    canClosePayment,
    isPaymentClosed: order.payment_closed_at != null,
    paymentClosedAt: order.payment_closed_at,
    paymentClosedByName:
      firstOf(order.payment_closed_by_profile)?.full_name ?? firstOf(order.payment_closed_by_profile)?.email ?? null,
    paymentCloseNote: order.payment_close_note,
    tipAmount: Number(order.tip_amount),
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
    canEdit,
    canAdvance,
    canOverrideReservedQty,
    canAddPayment,
    canCancel,
    canHold,
    canResume,
    canAddShipment,
    isShippingRole,
  };

  return (
    <div className="space-y-6">
      <OrderDetail data={data} logs={logs} />
    </div>
  );
}
