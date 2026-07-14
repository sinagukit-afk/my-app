import { createClient } from "@/lib/supabase/server";
import type { OrderRow } from "./order-list-table";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function paymentStatus(totalPaid: number, totalMoney: number): OrderRow["paymentStatus"] {
  if (totalPaid <= 0) return "Unpaid";
  if (totalPaid < totalMoney) return "Partially Paid";
  if (totalPaid > totalMoney) return "Overpaid";
  return "Paid";
}

export async function fetchOrderRows(
  from: string,
  to: string
): Promise<{ rows: OrderRow[]; error: string | null }> {
  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select(
      "id, order_number, status, total_money, created_at, target_date, customers(name), order_items(quantity), order_payments(amount)"
    );

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
    const totalMoney = Number(o.total_money);
    const totalPaid = (o.order_payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
    return {
      orderNumber: o.order_number,
      customerName: customer?.name ?? null,
      orderDate: o.created_at.slice(0, 10),
      targetDate: o.target_date,
      status: o.status,
      totalItems: (o.order_items ?? []).reduce((sum, it) => sum + Number(it.quantity), 0),
      totalMoney,
      paymentStatus: paymentStatus(totalPaid, totalMoney),
      lastActivity: lastActivityByOrder.get(o.id) ?? "—",
    };
  });

  return { rows, error: error?.message ?? null };
}
