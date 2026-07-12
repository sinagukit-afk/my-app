import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewShipmentForm } from "./new-shipment-form";
import type { ShippableOrderItem, PackagingVariantOption, ShipmentCustomer } from "../../order-shipments";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function NewShipmentPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const isShippingRole = ["admin", "encoder"].includes(role);

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, customers(name, phone_number, address_line1, barangay, city, province), order_items(id, item_name_snapshot, sku_snapshot, quantity)"
    )
    .eq("order_number", orderNumber)
    .single();

  if (!order) notFound();

  // create_shipment() allows Ready for Shipping or Shipped (PS-17 supersedes D036) — mixed
  // pickup+delivery orders need shipments addable incrementally as each portion is arranged.
  const canAddShipment = isShippingRole && ["ready_for_shipping", "shipped"].includes(order.status);
  if (!canAddShipment) redirect(`/dashboard/orders/active-orders/${orderNumber}`);

  const { data: shipmentsData } = await supabase
    .from("order_shipments")
    .select("shipment_items(order_item_id, quantity_shipped)")
    .eq("order_id", order.id);

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

  const shippableItems: ShippableOrderItem[] = (order.order_items ?? []).map((it) => ({
    orderItemId: it.id,
    name: it.item_name_snapshot ?? "",
    sku: it.sku_snapshot,
    remainingQty: Number(it.quantity) - (shippedQtyByOrderItem.get(it.id) ?? 0),
  }));

  const packagingOptions: PackagingVariantOption[] = (packagingCategoryData ?? []).flatMap((cat) =>
    (cat.items ?? []).flatMap((item) =>
      (item.item_variants ?? []).map((v) => ({
        id: v.id,
        label: v.option1_value ? `${item.name} — ${v.option1_value}` : item.name,
        sku: v.sku,
      }))
    )
  );

  const shipmentCustomer: ShipmentCustomer | null = customer
    ? {
        name: customer.name,
        phone: customer.phone_number,
        address:
          [customer.address_line1, customer.barangay, customer.city, customer.province].filter(Boolean).join(", ") ||
          null,
      }
    : null;

  return (
    <NewShipmentForm
      orderId={order.id}
      orderNumber={order.order_number}
      shippableItems={shippableItems.filter((si) => si.remainingQty > 0)}
      packagingOptions={packagingOptions}
      courierOptions={(courierData ?? []).map((c) => ({ id: c.id, name: c.name }))}
      customer={shipmentCustomer}
    />
  );
}
