import { createClient } from "@/lib/supabase/server";
import { PaymentOrdersTable, type OrderRow } from "./payment-table";

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

type SearchParams = Promise<{ from?: string; to?: string }>;

export default async function PaymentOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const { from = "", to = "" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select(
      "id, order_number, status, total_money, created_at, customers(name), order_payments(amount)"
    )
    .neq("status", "cancelled");

  if (from) query = query.gte("created_at", `${from}T00:00:00`);
  if (to) query = query.lte("created_at", `${to}T23:59:59.999`);

  const { data, error } = await query.order("created_at", { ascending: false });

  const rows: OrderRow[] = (data ?? []).map((o) => {
    const customer = firstOf(o.customers);
    const totalMoney = Number(o.total_money);
    const totalPaid = (o.order_payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
    return {
      orderNumber: o.order_number,
      customerName: customer?.name ?? null,
      status: o.status,
      orderDate: o.created_at.slice(0, 10),
      totalMoney,
      totalPaid,
      remainingBalance: totalMoney - totalPaid,
      paymentStatus: paymentStatus(totalPaid, totalMoney),
    };
  });

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-(--color-danger)">Failed to load orders: {error.message}</p>
      )}
      <PaymentOrdersTable data={rows} from={from} to={to} />
    </div>
  );
}
