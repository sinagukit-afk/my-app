import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/format";
import { ProductBomTable, type ProductBomRow } from "./product-bom-table";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function arrayOf<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

export default async function ProductBomPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const canWrite = ["admin", "manager"].includes(role);

  const { data, error } = await supabase
    .from("items")
    .select(
      `id, name, deleted_at,
       categories(name),
       item_variants(id, sku, deleted_at)`
    )
    .eq("item_type", "composite")
    .is("deleted_at", null)
    .order("name");

  const variantIds = (data ?? []).flatMap((item) =>
    arrayOf(item.item_variants)
      .filter((v) => !v.deleted_at)
      .map((v) => v.id)
  );

  const { data: componentRows } = variantIds.length
    ? await supabase
        .from("item_components")
        .select(
          "composite_variant_id, quantity, component:item_variants!item_components_component_variant_id_fkey(cost)"
        )
        .in("composite_variant_id", variantIds)
    : { data: [] };

  const costByVariant = new Map<string, number>();
  const componentCountByVariant = new Map<string, number>();
  for (const c of componentRows ?? []) {
    const component = firstOf(c.component);
    const lineCost = Number(c.quantity) * Number(component?.cost ?? 0);
    costByVariant.set(c.composite_variant_id, (costByVariant.get(c.composite_variant_id) ?? 0) + lineCost);
    componentCountByVariant.set(c.composite_variant_id, (componentCountByVariant.get(c.composite_variant_id) ?? 0) + 1);
  }

  const rows: ProductBomRow[] = (data ?? []).map((item) => {
    const category = firstOf(item.categories);
    const variants = arrayOf(item.item_variants).filter((v) => !v.deleted_at);
    const skus = variants.map((v) => v.sku).filter((s): s is string => !!s);

    const totalComponents = variants.reduce((sum, v) => sum + (componentCountByVariant.get(v.id) ?? 0), 0);
    const costs = variants.map((v) => costByVariant.get(v.id) ?? 0);
    const missingBom = variants.some((v) => (componentCountByVariant.get(v.id) ?? 0) === 0);

    let costLabel = "—";
    if (costs.length > 0) {
      const min = Math.min(...costs);
      const max = Math.max(...costs);
      costLabel = min === max ? formatCurrency(min) : `${formatCurrency(min)} – ${formatCurrency(max)}`;
    }

    return {
      id: item.id,
      name: item.name,
      category: category?.name ?? null,
      sku_list: skus.join(", "),
      variant_count: variants.length,
      component_count: totalComponents,
      cost_label: costLabel,
      missing_bom: missingBom,
    };
  });

  return (
    <div className="space-y-6">
      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load composite items: {error.message}
          </CardContent>
        </Card>
      )}

      <ProductBomTable data={rows} canWrite={canWrite} />
    </div>
  );
}
