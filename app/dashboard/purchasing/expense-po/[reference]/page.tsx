import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ExpensePODetail, type ExpensePODetailData, type ExpensePOItemRow } from "./expense-po-detail";

type Params = Promise<{ reference: string }>;

export default async function ExpensePurchaseOrderPage({ params }: { params: Params }) {
  const { reference } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const canWrite = ["admin", "manager"].includes(role);
  const canDelete = ["admin", "manager"].includes(role);
  const canReceive = ["admin", "manager", "encoder"].includes(role);

  const { data: po, error } = await supabase
    .from("purchase_orders")
    .select(
      "id, reference, status, order_date, expected_date, subtotal, shipping_fee, discount_amount, total, note, supplier_id, suppliers(name)"
    )
    .eq("reference", reference)
    .eq("po_type", "expense")
    .single();

  if (error || !po) {
    notFound();
  }

  const [{ data: itemsData }, { data: suppliers }, { data: categories }] = await Promise.all([
    supabase
      .from("purchase_order_items")
      .select("id, expense_category_id, expense_categories(name), description, quantity_ordered, quantity_received, unit_cost, discount_amount, line_total")
      .eq("purchase_order_id", po.id)
      .order("created_at"),
    supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
    supabase.from("expense_categories").select("id, name").eq("is_active", true).order("name"),
  ]);

  const supplier = Array.isArray(po.suppliers) ? po.suppliers[0] : po.suppliers;

  const detail: ExpensePODetailData = {
    id: po.id,
    reference: po.reference,
    status: po.status,
    order_date: po.order_date,
    expected_date: po.expected_date,
    subtotal: po.subtotal,
    shipping_fee: po.shipping_fee,
    discount_amount: po.discount_amount,
    total: po.total,
    note: po.note,
    supplier_id: po.supplier_id,
    supplier_name: supplier?.name ?? "—",
  };

  const items: ExpensePOItemRow[] = (itemsData ?? []).map((it) => {
    const category = Array.isArray(it.expense_categories) ? it.expense_categories[0] : it.expense_categories;
    return {
      id: it.id,
      category_name: category?.name ?? "—",
      description: it.description ?? "",
      quantity_ordered: Number(it.quantity_ordered),
      quantity_received: Number(it.quantity_received),
      unit_cost: Number(it.unit_cost),
      discount_amount: Number(it.discount_amount),
      line_total: Number(it.line_total),
    };
  });

  return (
    <ExpensePODetail
      po={detail}
      items={items}
      suppliers={suppliers ?? []}
      categories={categories ?? []}
      canWrite={canWrite}
      canDelete={canDelete}
      canReceive={canReceive}
    />
  );
}
