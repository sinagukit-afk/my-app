import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ItemDetail, type ItemDetailData, type DetailVariant } from "./item-detail";
import type { ItemRow } from "../items-table";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function arrayOf<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const canWrite = ["admin", "manager"].includes(role);

  const { data: item } = await supabase
    .from("items")
    .select(
      `id, name, description, item_type, sold_by, is_available_for_sale, track_stock, deleted_at,
       sync_status, sync_error,
       categories(name),
       supplier:suppliers!items_primary_supplier_id_fkey(name)`
    )
    .eq("id", id)
    .single();

  if (!item) notFound();

  const [{ data: variantRows }, { data: modifierRows }] = await Promise.all([
    supabase
      .from("item_variants")
      .select(
        "id, sku, barcode, option1_value, option2_value, option3_value, cost, default_price, pricing_type, default_purchase_cost, inventory_levels(in_stock, low_stock_threshold)"
      )
      .eq("item_id", id)
      .is("deleted_at", null)
      .order("created_at"),
    supabase.from("item_modifiers").select("modifiers(name)").eq("item_id", id),
  ]);

  const variantIds = (variantRows ?? []).map((v) => v.id);

  const { data: componentRows } =
    item.item_type === "composite" && variantIds.length
      ? await supabase
          .from("item_components")
          .select(
            "composite_variant_id, quantity, component:item_variants!item_components_component_variant_id_fkey(sku, cost, items(name))"
          )
          .in("composite_variant_id", variantIds)
      : { data: [] };

  const category = firstOf(item.categories);
  const supplier = firstOf(item.supplier);

  const status: ItemRow["status"] = item.deleted_at
    ? "archived"
    : item.is_available_for_sale
      ? "available"
      : "not_for_sale";

  const variants: DetailVariant[] = (variantRows ?? []).map((v) => {
    const options = [v.option1_value, v.option2_value, v.option3_value].filter(Boolean).join(" / ");
    const inventory = firstOf(v.inventory_levels);
    const components = (componentRows ?? [])
      .filter((c) => c.composite_variant_id === v.id)
      .map((c) => {
        const component = firstOf(c.component);
        const parent = component ? firstOf(component.items) : null;
        return {
          name: parent?.name ?? "Unknown item",
          sku: component?.sku ?? null,
          quantity: Number(c.quantity),
          cost: component?.cost !== null && component?.cost !== undefined ? Number(component.cost) : null,
        };
      });
    const cost =
      item.item_type === "composite"
        ? components.length > 0
          ? components.reduce((sum, c) => sum + c.quantity * (c.cost ?? 0), 0)
          : null
        : v.cost !== null
          ? Number(v.cost)
          : null;
    return {
      id: v.id,
      sku: v.sku,
      barcode: v.barcode,
      options: options || null,
      cost,
      default_price: v.default_price !== null ? Number(v.default_price) : null,
      pricing_type: v.pricing_type as "FIXED" | "VARIABLE",
      default_purchase_cost: v.default_purchase_cost !== null ? Number(v.default_purchase_cost) : null,
      in_stock: item.track_stock ? Number(inventory?.in_stock ?? 0) : null,
      low_stock_threshold: inventory?.low_stock_threshold ?? null,
      components,
    };
  });

  const itemData: ItemDetailData = {
    id: item.id,
    name: item.name,
    category: category?.name ?? null,
    description: item.description,
    item_type: item.item_type as "simple" | "composite",
    sold_by: item.sold_by as "each" | "weight",
    track_stock: item.track_stock,
    supplier: supplier?.name ?? null,
    status,
    sync_status: item.sync_status ?? "synced",
    sync_error: item.sync_error,
  };

  return (
    <div className="space-y-6">
      <ItemDetail
        item={itemData}
        variants={variants}
        modifiers={(modifierRows ?? []).map((m) => firstOf(m.modifiers)?.name).filter((n): n is string => !!n)}
        canWrite={canWrite}
      />
    </div>
  );
}
