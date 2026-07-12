import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { ItemForm, type ExistingVariant } from "../../item-form";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
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

  if (!canWrite) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-(--color-danger)">
          You don&apos;t have permission to edit items. Only admins and managers can create or edit items.
        </CardContent>
      </Card>
    );
  }

  const { data: item } = await supabase
    .from("items")
    .select(
      `id, name, category_id, description, ai_match_keywords, item_type, sold_by, is_available_for_sale, track_stock,
       primary_supplier_id, option1_name, option2_name, option3_name`
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!item) notFound();

  const [{ data: variantRows }, { data: modifierRows }, { data: categories }, { data: suppliers }, { data: modifiers }] =
    await Promise.all([
      supabase
        .from("item_variants")
        .select(
          "id, sku, barcode, option1_value, option2_value, option3_value, cost, default_price, pricing_type, default_purchase_cost, inventory_levels(in_stock, low_stock_threshold)"
        )
        .eq("item_id", id)
        .is("deleted_at", null)
        .order("created_at"),
      supabase.from("item_modifiers").select("modifier_id").eq("item_id", id),
      supabase.from("categories").select("id, name").order("name"),
      supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
      supabase
        .from("modifiers")
        .select("id, name, modifier_options(name)")
        .is("deleted_at", null)
        .order("name"),
    ]);

  const variantIds = (variantRows ?? []).map((v) => v.id);

  const { data: componentRows } = variantIds.length
    ? await supabase
        .from("item_components")
        .select(
          "composite_variant_id, quantity, component:item_variants!item_components_component_variant_id_fkey(id, sku, items(name))"
        )
        .in("composite_variant_id", variantIds)
    : { data: [] };

  const { data: allVariantRows } = await supabase
    .from("item_variants")
    .select("id, sku, items(name)")
    .is("deleted_at", null)
    .order("sku");

  const componentOptions = (allVariantRows ?? []).map((v) => {
    const parent = firstOf(v.items);
    return { id: v.id, label: parent?.name ?? "Unknown item", sku: v.sku };
  });

  const modifierOptions = (modifiers ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    options: (m.modifier_options ?? []).map((o: { name: string }) => o.name),
  }));

  const variants: ExistingVariant[] = (variantRows ?? []).map((v) => ({
    id: v.id,
    sku: v.sku,
    barcode: v.barcode,
    option1_value: v.option1_value,
    option2_value: v.option2_value,
    option3_value: v.option3_value,
    cost: v.cost !== null ? Number(v.cost) : null,
    default_price: v.default_price !== null ? Number(v.default_price) : null,
    pricing_type: v.pricing_type as "FIXED" | "VARIABLE",
    default_purchase_cost: v.default_purchase_cost !== null ? Number(v.default_purchase_cost) : null,
    in_stock: firstOf(v.inventory_levels)?.in_stock ?? 0,
    low_stock_threshold: firstOf(v.inventory_levels)?.low_stock_threshold ?? null,
    components: (componentRows ?? [])
      .filter((c) => c.composite_variant_id === v.id)
      .map((c) => ({
        component_variant_id: (firstOf(c.component) as { id: string } | null)?.id ?? "",
        quantity: Number(c.quantity),
      })),
  }));

  return (
    <ItemForm
      mode="edit"
      itemId={item.id}
      categories={categories ?? []}
      suppliers={suppliers ?? []}
      modifiers={modifierOptions}
      componentOptions={componentOptions}
      initial={{
        name: item.name,
        category_id: item.category_id,
        description: item.description,
        ai_match_keywords: item.ai_match_keywords,
        item_type: item.item_type as "simple" | "composite",
        sold_by: item.sold_by as "each" | "weight",
        is_available_for_sale: item.is_available_for_sale,
        track_stock: item.track_stock,
        primary_supplier_id: item.primary_supplier_id,
        option1_name: item.option1_name,
        option2_name: item.option2_name,
        option3_name: item.option3_name,
        variants,
        modifier_ids: (modifierRows ?? []).map((m) => m.modifier_id),
      }}
    />
  );
}
