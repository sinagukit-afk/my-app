import { createClient } from "@/lib/supabase/server";
import { CustomersTable, type CustomerRow, type CustomerSource } from "./customers-table";

export default async function CustomersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const canWrite = ["admin", "manager", "encoder"].includes(role);

  const { data, error } = await supabase
    .from("customers")
    .select(
      "id, customer_code, name, phone_number, email, total_visits, total_spent, customer_sources(source, external_username, linked_at)"
    )
    .is("deleted_at", null)
    .order("name");

  const { data: orderDates } = await supabase
    .from("orders")
    .select("customer_id, created_at")
    .not("customer_id", "is", null);

  const { data: receiptDates } = await supabase
    .from("receipts")
    .select("customer_id, receipt_date")
    .not("customer_id", "is", null)
    .is("cancelled_at", null);

  const lastOrderByCustomer = new Map<string, string>();
  for (const row of [...(orderDates ?? []), ...(receiptDates ?? [])]) {
    const customerId = row.customer_id as string;
    const date = ("created_at" in row ? row.created_at : row.receipt_date) as string;
    const existing = lastOrderByCustomer.get(customerId);
    if (!existing || date > existing) lastOrderByCustomer.set(customerId, date);
  }

  const rows: CustomerRow[] = (data ?? []).map((c) => ({
    id: c.id,
    customer_code: c.customer_code,
    name: c.name ?? "",
    phone_number: c.phone_number,
    email: c.email,
    totalVisits: Number(c.total_visits),
    totalSpent: Number(c.total_spent),
    lastOrderDate: lastOrderByCustomer.get(c.id) ?? null,
    sources: (c.customer_sources ?? []) as CustomerSource[],
  }));

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-(--color-danger)">Failed to load customers: {error.message}</p>
      )}
      <CustomersTable data={rows} canWrite={canWrite} />
    </div>
  );
}
