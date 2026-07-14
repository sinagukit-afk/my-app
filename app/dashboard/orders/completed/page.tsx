import { createClient } from "@/lib/supabase/server";
import { CompletedOrdersTable, type OrderRow } from "./completed-table";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function CompletedOrdersPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, note, total_money, created_at, updated_at, loyverse_receipt_number, customers(name), order_items(id, item_name_snapshot, quantity, unit_price, line_discount)"
    )
    .eq("status", "completed")
    .order("updated_at", { ascending: false });

  const rows: OrderRow[] = (data ?? []).map((o) => {
    const customer = firstOf(o.customers);
    return {
      id: o.id,
      customerName: customer?.name ?? null,
      note: o.note,
      totalMoney: Number(o.total_money),
      createdAt: o.created_at,
      completedAt: o.updated_at,
      loyverseReceiptNumber: o.loyverse_receipt_number,
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
      <CompletedOrdersTable data={rows} />
    </div>
  );
}
