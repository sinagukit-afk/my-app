import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ProductionOrderStatus } from "@/lib/production-order-status";
import {
  ProductionOrderDetail,
  type ProductionOrderDetailData,
  type ActivityLogRow,
  type ProductionComponentRow,
} from "./production-order-detail";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function ProductionOrderDetailPage({
  params,
}: {
  params: Promise<{ productionOrderNumber: string }>;
}) {
  const { productionOrderNumber } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";

  const { data: po } = await supabase
    .from("production_orders")
    .select(
      "id, production_order_number, variant_id, item_name_snapshot, sku_snapshot, modifiers_snapshot, quantity, completed_qty, status, notes, created_at, updated_at, orders(order_number)"
    )
    .eq("production_order_number", productionOrderNumber)
    .single();

  if (!po) notFound();

  const { data: logsData } = await supabase
    .from("activity_logs")
    .select("id, action, description, created_at, profiles(full_name, email)")
    .eq("entity_type", "production_order")
    .eq("entity_id", po.id)
    .order("created_at", { ascending: false });

  const logs: ActivityLogRow[] = (logsData ?? []).map((l) => {
    const actor = firstOf(l.profiles);
    return {
      id: l.id,
      action: l.action,
      description: l.description ?? "",
      createdAt: l.created_at,
      userName: actor?.full_name ?? actor?.email ?? "System",
    };
  });

  const { data: componentRows } = await supabase
    .from("item_components")
    .select("id, quantity, component:item_variants!item_components_component_variant_id_fkey(id, sku, items(name))")
    .eq("composite_variant_id", po.variant_id);

  const quantity = Number(po.quantity);
  const completedQty = Number(po.completed_qty ?? 0);
  const round4 = (n: number) => Math.round(n * 10000) / 10000;

  const components: ProductionComponentRow[] = (componentRows ?? []).map((row) => {
    const variant = firstOf(row.component);
    const item = variant ? firstOf(variant.items) : null;
    const ratio = Number(row.quantity);
    return {
      id: row.id,
      name: item?.name ?? "Unknown item",
      sku: variant?.sku ?? null,
      reservedQty: round4(ratio * quantity),
      completedQty: round4(ratio * completedQty),
    };
  });

  const order = firstOf(po.orders);
  const modifiers = Array.isArray(po.modifiers_snapshot)
    ? (po.modifiers_snapshot as { name_snapshot?: string }[]).map((m) => m.name_snapshot ?? "").filter(Boolean)
    : [];

  const status = po.status as ProductionOrderStatus;
  const isWritableRole = ["admin", "manager", "encoder"].includes(role);
  const isActive = status === "not_started" || status === "wip" || status === "partially_completed";

  const canStart = isWritableRole && status === "not_started";
  const canComplete = role === "admin" && isActive;
  const canAddCompletedQty = isWritableRole && (status === "wip" || status === "partially_completed");
  const canCancel = isWritableRole && isActive;

  const data: ProductionOrderDetailData = {
    id: po.id,
    productionOrderNumber: po.production_order_number,
    orderNumber: order?.order_number ?? "",
    itemName: po.item_name_snapshot ?? "",
    sku: po.sku_snapshot,
    modifiers,
    quantity,
    completedQty,
    status,
    notes: po.notes,
    createdAt: po.created_at,
    updatedAt: po.updated_at,
    canStart,
    canComplete,
    canAddCompletedQty,
    canCancel,
    components,
  };

  return (
    <div className="space-y-6">
      <ProductionOrderDetail data={data} logs={logs} />
    </div>
  );
}
