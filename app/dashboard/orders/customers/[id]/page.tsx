import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CustomerDetail, type LinkedSource, type HistoryEntry } from "./customer-detail";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const canWrite = ["admin", "manager", "encoder"].includes(role);

  const { data: customer } = await supabase
    .from("customers")
    .select(
      "id, name, phone_number, email, address_line1, barangay, city, province, postal_code, note, total_visits, total_spent, total_points"
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!customer) notFound();

  const { data: sourceData } = await supabase
    .from("customer_sources")
    .select("source, external_username, profile_url, linked_at")
    .eq("customer_id", id)
    .order("linked_at");

  const { data: orderData } = await supabase
    .from("orders")
    .select("id, status, total_money, created_at")
    .eq("customer_id", id)
    .order("created_at", { ascending: false });

  const { data: receiptData } = await supabase
    .from("receipts")
    .select("id, receipt_number, total_money, receipt_date, cancelled_at")
    .eq("customer_id", id)
    .order("receipt_date", { ascending: false });

  const orderHistory: HistoryEntry[] = (orderData ?? []).map((o) => ({
    id: o.id,
    kind: "order",
    label: o.status === "quote" ? "Quote" : "Order",
    status: o.status,
    total: Number(o.total_money),
    date: o.created_at,
  }));

  const receiptHistory: HistoryEntry[] = (receiptData ?? []).map((r) => ({
    id: r.id,
    kind: "receipt",
    label: r.receipt_number ? `POS Receipt ${r.receipt_number}` : "POS Receipt",
    status: r.cancelled_at ? "cancelled" : null,
    total: Number(r.total_money),
    date: r.receipt_date,
  }));

  const history = [...orderHistory, ...receiptHistory].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <CustomerDetail
      customer={{
        id: customer.id,
        name: customer.name ?? "",
        phone_number: customer.phone_number,
        email: customer.email,
        address_line1: customer.address_line1,
        barangay: customer.barangay,
        city: customer.city,
        province: customer.province,
        postal_code: customer.postal_code,
        note: customer.note,
        total_visits: Number(customer.total_visits),
        total_spent: Number(customer.total_spent),
        total_points: Number(customer.total_points),
      }}
      sources={(sourceData ?? []) as LinkedSource[]}
      history={history}
      canWrite={canWrite}
    />
  );
}
