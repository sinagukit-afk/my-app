import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConfirmedOrderDetail, type ConfirmedOrderData, type ActivityLogRow } from "./confirmed-order-detail";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function ConfirmedOrderDetailPage({
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
      "id, order_number, status, note, order_date, target_date, created_at, same_as_customer, receiver_name, receiver_phone, receiver_address_line1, receiver_barangay, receiver_city, receiver_province, total_discount, total_money, customers(name, phone_number, email, address_line1, barangay, city, province), order_items(id, item_name_snapshot, sku_snapshot, quantity, unit_price, line_discount, reserved_qty, order_item_modifiers(name_snapshot, price_snapshot))"
    )
    .eq("order_number", orderNumber)
    .single();

  if (!order || order.status !== "confirmed") notFound();

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

  const canAdvance = role === "admin" && order.status === "confirmed";
  const canOverrideReservedQty = ["admin", "manager", "encoder"].includes(role) && order.status === "confirmed";
  const canCancel = role === "admin" && order.status === "confirmed";
  const canHold = role === "admin" && order.status === "confirmed";

  const data: ConfirmedOrderData = {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    note: order.note,
    orderDate: order.order_date,
    createdAt: order.created_at,
    targetDate: order.target_date,
    sameAsCustomer: order.same_as_customer,
    receiverName: order.receiver_name,
    receiverPhone: order.receiver_phone,
    receiverAddress:
      [order.receiver_address_line1, order.receiver_barangay, order.receiver_city, order.receiver_province]
        .filter(Boolean)
        .join(", ") || null,
    totalDiscount: Number(order.total_discount),
    totalMoney: Number(order.total_money),
    customerName: customer?.name ?? null,
    customerPhone: customer?.phone_number ?? null,
    customerEmail: customer?.email ?? null,
    customerAddress:
      [customer?.address_line1, customer?.barangay, customer?.city, customer?.province].filter(Boolean).join(", ") ||
      null,
    items: (order.order_items ?? []).map((it) => ({
      id: it.id,
      name: it.item_name_snapshot ?? "",
      sku: it.sku_snapshot,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unit_price),
      discount: Number(it.line_discount),
      reservedQty: Number(it.reserved_qty),
      modifiers: (it.order_item_modifiers ?? []).map((m) => ({
        name: m.name_snapshot ?? "",
        price: Number(m.price_snapshot),
      })),
    })),
    canAdvance,
    canOverrideReservedQty,
    canHold,
    canCancel,
  };

  return <ConfirmedOrderDetail data={data} logs={logs} />;
}
