import { createClient } from "@/lib/supabase/server";
import { ProductionQueueTable, type OrderRow } from "./production-queue-table";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function ProductionQueuePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const canComplete = role === "admin";

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, status, note, total_money, created_at, customers(name), order_items(id, item_name_snapshot, quantity, unit_price, line_discount)"
    )
    .eq("status", "in_production")
    .order("created_at", { ascending: true });

  const rows: OrderRow[] = (data ?? []).map((o) => {
    const customer = firstOf(o.customers);
    return {
      id: o.id,
      customerName: customer?.name ?? null,
      note: o.note,
      totalMoney: Number(o.total_money),
      createdAt: o.created_at,
      items: (o.order_items ?? []).map((it) => ({
        id: it.id,
        name: it.item_name_snapshot ?? "",
        quantity: Number(it.quantity),
        unitPrice: Number(it.unit_price),
        discount: Number(it.line_discount),
      })),
    };
  });

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-(--color-danger)">Failed to load orders: {error.message}</p>
      )}
      <ProductionQueueTable data={rows} canComplete={canComplete} />
    </div>
  );
}
