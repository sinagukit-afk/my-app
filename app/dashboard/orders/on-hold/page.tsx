import { createClient } from "@/lib/supabase/server";
import { OnHoldOrdersTable, type OrderRow } from "./on-hold-table";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

type SearchParams = Promise<{ from?: string; to?: string }>;

export default async function OnHoldOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const { from = "", to = "" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select(
      "id, order_number, created_at, updated_at, customers(name), order_items(item_name_snapshot, quantity)"
    )
    .eq("status", "on_hold");

  if (from) query = query.gte("created_at", `${from}T00:00:00`);
  if (to) query = query.lte("created_at", `${to}T23:59:59.999`);

  const { data, error } = await query.order("created_at", { ascending: false });

  const { data: logsData } = await supabase
    .from("activity_logs")
    .select("entity_id, description, action, created_at")
    .eq("entity_type", "order")
    .order("created_at", { ascending: false });

  const lastActivityByOrder = new Map<string, string>();
  for (const log of logsData ?? []) {
    if (log.entity_id && !lastActivityByOrder.has(log.entity_id)) {
      lastActivityByOrder.set(log.entity_id, log.description || log.action);
    }
  }

  const rows: OrderRow[] = (data ?? []).map((o) => {
    const customer = firstOf(o.customers);
    return {
      orderNumber: o.order_number,
      customerName: customer?.name ?? null,
      orderDate: o.created_at.slice(0, 10),
      createdAt: o.created_at,
      updatedAt: o.updated_at,
      items: (o.order_items ?? []).map((it) => `(${Number(it.quantity)}) ${it.item_name_snapshot ?? ""}`),
      lastActivity: lastActivityByOrder.get(o.id) ?? "—",
    };
  });

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-(--color-danger)">Failed to load orders: {error.message}</p>
      )}
      <OnHoldOrdersTable data={rows} from={from} to={to} />
    </div>
  );
}
