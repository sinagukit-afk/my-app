import { createClient } from "@/lib/supabase/server";
import type { ProductionOrderStatus } from "@/lib/production-order-status";
import { ProductionOrdersTable, type ProductionOrderRow } from "./production-orders-table";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function ProductionOrdersPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("production_orders")
    .select(
      "id, production_order_number, item_name_snapshot, sku_snapshot, modifiers_snapshot, quantity, status, created_at, orders(order_number, customers(name))"
    )
    .in("status", ["not_started", "wip", "partially_completed"])
    .order("created_at", { ascending: true });

  const rows: ProductionOrderRow[] = (data ?? []).map((po) => {
    const order = firstOf(po.orders);
    const customer = order ? firstOf(order.customers) : null;
    const modifiers = Array.isArray(po.modifiers_snapshot)
      ? (po.modifiers_snapshot as { name_snapshot?: string }[]).map((m) => m.name_snapshot ?? "").filter(Boolean)
      : [];
    return {
      id: po.id,
      productionOrderNumber: po.production_order_number,
      orderNumber: order?.order_number ?? "",
      customerName: customer?.name ?? null,
      itemName: po.item_name_snapshot ?? "",
      sku: po.sku_snapshot,
      modifiers,
      quantity: Number(po.quantity),
      status: po.status as ProductionOrderStatus,
      createdAt: po.created_at,
    };
  });

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-(--color-danger)">Failed to load production orders: {error.message}</p>
      )}
      <ProductionOrdersTable data={rows} />
    </div>
  );
}
