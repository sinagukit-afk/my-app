import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  InventoryPOPaymentDetail,
  type InventoryPOPaymentDetailData,
  type ReceivedLineRow,
  type PaymentRow,
} from "./inventory-po-payment-detail";

type Params = Promise<{ reference: string }>;

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function InventoryPOPaymentDetailPage({ params }: { params: Params }) {
  const { reference } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const canPay = ["admin", "manager"].includes(role);
  const canVoid = role === "admin";

  const { data: po, error } = await supabase
    .from("purchase_orders")
    .select("id, reference, payment_status, order_date, supplier_id, suppliers(name)")
    .eq("reference", reference)
    .single();

  if (error || !po) {
    notFound();
  }

  const [{ data: linesData }, { data: paymentsData }, { data: paymentTypes }] = await Promise.all([
    supabase
      .from("incoming_items")
      .select(
        "id, reference, item_name_snapshot, quantity, unit_price, total_price, shipping_fee, discount_amount, date_received, item_variants(option1_value, option2_value)"
      )
      .eq("purchase_order_id", po.id)
      .order("date_received", { ascending: true }),
    supabase
      .from("payable_payments")
      .select("id, amount, paid_date, notes, voided_at, void_reason, payment_types(name)")
      .eq("payable_type", "purchase_order")
      .eq("payable_id", po.id)
      .order("paid_date", { ascending: false }),
    supabase.from("payment_types").select("id, name").eq("is_active", true).order("name"),
  ]);

  const supplier = firstOf(po.suppliers);

  const lines: ReceivedLineRow[] = (linesData ?? []).map((row) => {
    const variant = firstOf(row.item_variants);
    const variantLabel = variant
      ? [variant.option1_value, variant.option2_value].filter(Boolean).join(" / ") || null
      : null;
    return {
      id: row.id,
      reference: row.reference,
      item_name: row.item_name_snapshot,
      variant_label: variantLabel,
      quantity: Number(row.quantity),
      unit_price: Number(row.unit_price),
      total_price: Number(row.total_price),
      shipping_fee: Number(row.shipping_fee),
      discount_amount: Number(row.discount_amount),
      date_received: row.date_received,
    };
  });

  // Line Cost (total_price) already IS the payable — discount_amount only adjusts
  // inventory valuation vs. registered cost, it doesn't reduce what's owed.
  const totalPayable = lines.reduce((s, l) => s + l.total_price + l.shipping_fee, 0);

  const detail: InventoryPOPaymentDetailData = {
    id: po.id,
    reference: po.reference,
    payment_status: po.payment_status as InventoryPOPaymentDetailData["payment_status"],
    order_date: po.order_date,
    supplier_name: supplier?.name ?? null,
    total_payable: totalPayable,
  };

  const paidSoFar = (paymentsData ?? [])
    .filter((p) => !p.voided_at)
    .reduce((s, p) => s + Number(p.amount), 0);

  const payments: PaymentRow[] = (paymentsData ?? []).map((p) => {
    const pt = firstOf(p.payment_types);
    return {
      id: p.id,
      amount: Number(p.amount),
      paid_date: p.paid_date,
      notes: p.notes,
      payment_type_name: pt?.name ?? null,
      voided_at: p.voided_at,
      void_reason: p.void_reason,
    };
  });

  return (
    <InventoryPOPaymentDetail
      po={detail}
      lines={lines}
      payments={payments}
      remainingBalance={Math.max(0, totalPayable - paidSoFar)}
      paymentTypes={paymentTypes ?? []}
      canPay={canPay}
      canVoid={canVoid}
    />
  );
}
