import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IncomingPaymentDetail, type IncomingPaymentDetailData, type PaymentRow } from "./incoming-payment-detail";

type Params = Promise<{ id: string }>;

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function IncomingPaymentDetailPage({ params }: { params: Params }) {
  const { id } = await params;
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

  const { data: item, error } = await supabase
    .from("incoming_items")
    .select(
      "id, reference, item_name_snapshot, quantity, unit_price, total_price, shipping_fee, discount_amount, payment_status, date_received, supplier, item_variants(option1_value, option2_value), suppliers(name), purchase_orders(reference)"
    )
    .eq("id", id)
    .single();

  if (error || !item) {
    notFound();
  }

  const [{ data: paymentsData }, { data: paymentTypes }] = await Promise.all([
    supabase
      .from("payable_payments")
      .select("id, amount, paid_date, notes, voided_at, void_reason, payment_types(name)")
      .eq("payable_type", "inventory")
      .eq("payable_id", id)
      .order("paid_date", { ascending: false }),
    supabase.from("payment_types").select("id, name").eq("is_active", true).order("name"),
  ]);

  const variant = firstOf(item.item_variants);
  const supplier = firstOf(item.suppliers);
  const po = firstOf(item.purchase_orders);

  const variantLabel = variant
    ? [variant.option1_value, variant.option2_value].filter(Boolean).join(" / ") || null
    : null;

  const shippingFee = Number(item.shipping_fee);
  // Line Cost (total_price) already IS the payable — discount_amount only adjusts
  // inventory valuation vs. registered cost, it doesn't reduce what's owed.
  const totalPayable = Number(item.total_price) + shippingFee;

  const detail: IncomingPaymentDetailData = {
    id: item.id,
    reference: item.reference,
    item_name_snapshot: item.item_name_snapshot,
    variant_label: variantLabel,
    quantity: Number(item.quantity),
    unit_price: Number(item.unit_price),
    shipping_fee: shippingFee,
    total_payable: totalPayable,
    payment_status: item.payment_status as IncomingPaymentDetailData["payment_status"],
    date_received: item.date_received,
    supplier_name: supplier?.name ?? item.supplier ?? null,
    purchase_order_reference: po?.reference ?? null,
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
    <IncomingPaymentDetail
      item={detail}
      payments={payments}
      remainingBalance={Math.max(0, totalPayable - paidSoFar)}
      paymentTypes={paymentTypes ?? []}
      canPay={canPay}
      canVoid={canVoid}
    />
  );
}
