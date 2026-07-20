import { createClient } from "@/lib/supabase/server";
import { CancelledOrdersTable, type OrderRow } from "./cancelled-table";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function CancelledOrdersPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, created_at, updated_at, total_money, customers(name), order_items(item_name_snapshot, quantity)"
    )
    .eq("status", "cancelled")
    .order("updated_at", { ascending: false });

  const orders = data ?? [];

  const { data: logsData } = await supabase
    .from("activity_logs")
    .select("entity_id, description, action, created_at")
    .eq("entity_type", "order")
    .in("entity_id", orders.map((o) => o.id))
    .order("created_at", { ascending: false });

  const lastActivityByOrder = new Map<string, string>();
  for (const log of logsData ?? []) {
    if (log.entity_id && !lastActivityByOrder.has(log.entity_id)) {
      lastActivityByOrder.set(log.entity_id, log.description || log.action);
    }
  }

  const rows: OrderRow[] = orders.map((o) => {
    const customer = firstOf(o.customers);
    return {
      orderNumber: o.order_number,
      customerName: customer?.name ?? null,
      orderDate: o.created_at.slice(0, 10),
      cancelledAt: o.updated_at,
      totalMoney: Number(o.total_money),
      items: (o.order_items ?? []).map((it) => `(${Number(it.quantity)}) ${it.item_name_snapshot ?? ""}`),
      lastActivity: lastActivityByOrder.get(o.id) ?? "—",
    };
  });

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-(--color-danger)">Failed to load orders: {error.message}</p>
      )}
      <CancelledOrdersTable data={rows} />
    </div>
  );
}
