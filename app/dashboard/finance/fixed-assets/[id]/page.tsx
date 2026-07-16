import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AssetDetail, type AssetDetailData, type PaymentRow } from "./asset-detail";

type Params = Promise<{ id: string }>;

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function AssetDetailPage({ params }: { params: Params }) {
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

  const { data: asset, error } = await supabase
    .from("fixed_assets")
    .select(
      "id, name, cost, payment_status, purchased_date, supplier_id, purchase_order_id, asset_categories(name), suppliers(name), purchase_orders(reference)"
    )
    .eq("id", id)
    .single();

  if (error || !asset) {
    notFound();
  }

  const [{ data: paymentsData }, { data: paymentTypes }] = await Promise.all([
    supabase
      .from("payable_payments")
      .select("id, amount, paid_date, notes, payment_types(name)")
      .eq("payable_type", "asset")
      .eq("payable_id", id)
      .order("paid_date", { ascending: false }),
    supabase.from("payment_types").select("id, name").eq("is_active", true).order("name"),
  ]);

  const category = firstOf(asset.asset_categories);
  const supplier = firstOf(asset.suppliers);
  const po = firstOf(asset.purchase_orders);

  const detail: AssetDetailData = {
    id: asset.id,
    name: asset.name,
    category_name: category?.name ?? "—",
    supplier_name: supplier?.name ?? null,
    cost: Number(asset.cost),
    payment_status: asset.payment_status as AssetDetailData["payment_status"],
    purchased_date: asset.purchased_date,
    purchase_order_reference: po?.reference ?? null,
  };

  const paidSoFar = (paymentsData ?? []).reduce((s, p) => s + Number(p.amount), 0);

  const payments: PaymentRow[] = (paymentsData ?? []).map((p) => {
    const pt = firstOf(p.payment_types);
    return {
      id: p.id,
      amount: Number(p.amount),
      paid_date: p.paid_date,
      notes: p.notes,
      payment_type_name: pt?.name ?? null,
    };
  });

  return (
    <AssetDetail
      asset={detail}
      payments={payments}
      remainingBalance={Math.max(0, detail.cost - paidSoFar)}
      paymentTypes={paymentTypes ?? []}
      canPay={canPay}
    />
  );
}
