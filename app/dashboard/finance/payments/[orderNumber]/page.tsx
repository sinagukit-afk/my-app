import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PaymentOrderDetail, type PaymentOrderData, type ActivityLogRow } from "./payment-order-detail";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function PaymentOrderPage({ params }: { params: Promise<{ orderNumber: string }> }) {
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
      "id, order_number, status, target_date, created_at, fulfillment_method, total_money, total_tax, payment_closed_at, payment_close_note, tip_amount, payment_closed_by_profile:profiles!orders_payment_closed_by_fkey(full_name, email), customers(name, phone_number, email, address_line1, barangay, city, province), order_items(id, quantity)"
    )
    .eq("order_number", orderNumber)
    .single();

  if (!order) notFound();

  const { data: shipmentsData } = await supabase
    .from("order_shipments")
    .select("status, shipping_fee_charged, shipment_items(order_item_id, quantity_shipped)")
    .eq("order_id", order.id);

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
  const closedByProfile = firstOf(order.payment_closed_by_profile);
  const canAddPayment = ["admin", "manager", "encoder"].includes(role) && order.status !== "cancelled";
  const canClosePayment = ["admin", "manager", "encoder"].includes(role) && order.status !== "cancelled";

  // Mirrors close_order_payment()'s own dispatch gate: the final shipping fee isn't
  // known until every order item has been allocated to a shipment and none is still Preparing.
  const totalOrderedQty = (order.order_items ?? []).reduce((sum, it) => sum + Number(it.quantity), 0);
  const totalShippedQty = (shipmentsData ?? []).reduce(
    (sum, s) => sum + (s.shipment_items ?? []).reduce((qSum, si) => qSum + Number(si.quantity_shipped), 0),
    0
  );
  const hasPreparingShipment = (shipmentsData ?? []).some((s) => s.status === "preparing");
  const allShipmentsDispatched = totalOrderedQty - totalShippedQty <= 0 && !hasPreparingShipment;
  const shippingFeeTotal = (shipmentsData ?? [])
    .filter((s) => s.status === "shipped" || s.status === "delivered")
    .reduce((sum, s) => sum + (s.shipping_fee_charged != null ? Number(s.shipping_fee_charged) : 0), 0);

  const data: PaymentOrderData = {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    targetDate: order.target_date,
    createdAt: order.created_at,
    fulfillmentMethod: order.fulfillment_method,
    totalMoney: Number(order.total_money),
    totalTax: Number(order.total_tax ?? 0),
    shippingFeeTotal,
    allShipmentsDispatched,
    customerName: customer?.name ?? null,
    customerPhone: customer?.phone_number ?? null,
    customerAddress:
      [customer?.address_line1, customer?.barangay, customer?.city, customer?.province].filter(Boolean).join(", ") ||
      null,
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
    canAddPayment,
    canClosePayment,
    isPaymentClosed: order.payment_closed_at != null,
    paymentClosedAt: order.payment_closed_at,
    paymentClosedByName: closedByProfile?.full_name ?? closedByProfile?.email ?? null,
    paymentCloseNote: order.payment_close_note,
    tipAmount: Number(order.tip_amount),
  };

  return (
    <div className="space-y-6">
      <PaymentOrderDetail data={data} logs={logs} />
    </div>
  );
}
