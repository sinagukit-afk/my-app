import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PurchaseOrderDetail, type PurchaseOrderDetailData, type PurchaseOrderItemRow } from "./po-detail";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function PurchaseOrderDetailPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const canWrite = ["admin", "manager", "encoder"].includes(role);
  const canDelete = ["admin", "manager"].includes(role);

  const { data: po, error } = await supabase
    .from("purchase_orders")
    .select(
      "id, reference, status, order_date, expected_date, subtotal, shipping_fee, discount_amount, total, note, supplier_id, suppliers(name)"
    )
    .eq("reference", reference)
    .single();

  if (error || !po) notFound();

  const { data: itemsData } = await supabase
    .from("purchase_order_items")
    .select(
      "id, quantity_ordered, quantity_received, unit_cost, discount_amount, line_total, item_name_snapshot, item_variants(sku, option1_value, items(name))"
    )
    .eq("purchase_order_id", po.id)
    .order("created_at");

  const items: PurchaseOrderItemRow[] = (itemsData ?? []).map((row) => {
    const variant = firstOf(row.item_variants);
    const item = variant ? firstOf(variant.items) : null;
    const label = [item?.name ?? row.item_name_snapshot ?? "Unknown item", variant?.option1_value]
      .filter(Boolean)
      .join(" — ");
    return {
      id: row.id,
      label,
      sku: variant?.sku ?? null,
      quantity_ordered: row.quantity_ordered,
      quantity_received: row.quantity_received,
      unit_cost: row.unit_cost,
      discount_amount: row.discount_amount,
      line_total: row.line_total,
    };
  });

  const { data: supplierData } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  const { data: itemData } = await supabase
    .from("items")
    .select("name, item_variants(id, sku, option1_value, cost)")
    .eq("track_stock", true)
    .is("deleted_at", null)
    .is("item_variants.deleted_at", null)
    .order("name");

  const variantOptions = (itemData ?? []).flatMap((item) =>
    (item.item_variants ?? []).map((v) => ({
      id: v.id,
      label: v.option1_value ? `${item.name} — ${v.option1_value}` : item.name,
      sku: v.sku,
      cost: v.cost,
    }))
  );

  const supplier = firstOf(po.suppliers);

  const detail: PurchaseOrderDetailData = {
    id: po.id,
    reference: po.reference,
    status: po.status,
    order_date: po.order_date,
    expected_date: po.expected_date,
    subtotal: po.subtotal,
    shipping_fee: po.shipping_fee,
    discount_amount: po.discount_amount,
    total: po.total,
    note: po.note,
    supplier_id: po.supplier_id,
    supplier_name: supplier?.name ?? "Unknown supplier",
  };

  return (
    <PurchaseOrderDetail
      po={detail}
      items={items}
      suppliers={supplierData ?? []}
      variantOptions={variantOptions}
      canWrite={canWrite}
      canDelete={canDelete}
    />
  );
}
