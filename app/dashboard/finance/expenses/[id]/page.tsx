import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ExpenseDetail, type ExpenseDetailData, type AttachmentRow, type PaymentRow } from "./expense-detail";

type Params = Promise<{ id: string }>;

export default async function ExpenseDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const canWrite = ["admin", "manager"].includes(role);
  const canPay = ["admin", "manager"].includes(role);

  const { data: expense, error } = await supabase
    .from("opex_expenses")
    .select(
      "id, expense_number, description, amount, expense_date, payment_status, source, category_id, supplier_id, purchase_order_id, expense_categories(name), suppliers(name), purchase_orders(reference)"
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error || !expense) {
    notFound();
  }

  const [{ data: attachmentsData }, { data: paymentsData }, { data: categories }, { data: suppliers }, { data: paymentTypes }] =
    await Promise.all([
      supabase
        .from("expense_attachments")
        .select("id, file_name, file_path, created_at")
        .eq("expense_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("payable_payments")
        .select("id, amount, paid_date, notes, payment_types(name)")
        .eq("payable_type", "expense")
        .eq("payable_id", id)
        .order("paid_date", { ascending: false }),
      supabase.from("expense_categories").select("id, name").eq("is_active", true).order("name"),
      supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
      supabase.from("payment_types").select("id, name").eq("is_active", true).order("name"),
    ]);

  const category = Array.isArray(expense.expense_categories) ? expense.expense_categories[0] : expense.expense_categories;
  const supplier = Array.isArray(expense.suppliers) ? expense.suppliers[0] : expense.suppliers;
  const po = Array.isArray(expense.purchase_orders) ? expense.purchase_orders[0] : expense.purchase_orders;

  const detail: ExpenseDetailData = {
    id: expense.id,
    expense_number: expense.expense_number,
    description: expense.description,
    amount: Number(expense.amount),
    expense_date: expense.expense_date,
    payment_status: expense.payment_status,
    source: expense.source,
    category_id: expense.category_id,
    category_name: category?.name ?? "—",
    supplier_id: expense.supplier_id,
    supplier_name: supplier?.name ?? null,
    purchase_order_reference: po?.reference ?? null,
  };

  const paidSoFar = (paymentsData ?? []).reduce((s, p) => s + Number(p.amount), 0);

  const attachments: AttachmentRow[] = attachmentsData ?? [];
  const payments: PaymentRow[] = (paymentsData ?? []).map((p) => {
    const pt = Array.isArray(p.payment_types) ? p.payment_types[0] : p.payment_types;
    return {
      id: p.id,
      amount: Number(p.amount),
      paid_date: p.paid_date,
      notes: p.notes,
      payment_type_name: pt?.name ?? null,
    };
  });

  return (
    <ExpenseDetail
      expense={detail}
      attachments={attachments}
      payments={payments}
      remainingBalance={Math.max(0, detail.amount - paidSoFar)}
      categories={categories ?? []}
      suppliers={suppliers ?? []}
      paymentTypes={paymentTypes ?? []}
      canWrite={canWrite}
      canPay={canPay}
    />
  );
}
