import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/format";
import { ItemsTable, type ItemRow } from "./items-table";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function arrayOf<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

export default async function ItemsPage() {
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
      `id, name, item_type, is_available_for_sale, deleted_at,
       categories(name),
       item_variants(id, sku, cost, default_price, pricing_type, deleted_at)`
    )
    .order("name");

  const compositeVariantIds = (data ?? [])
    .filter((item) => item.item_type === "composite")
    .flatMap((item) =>
      arrayOf(item.item_variants)
        .filter((v) => !v.deleted_at)
        .map((v) => v.id)
    );

  const { data: componentRows } = compositeVariantIds.length
    ? await supabase
        .from("item_components")
        .select(
          "composite_variant_id, quantity, component:item_variants!item_components_component_variant_id_fkey(cost)"
        )
        .in("composite_variant_id", compositeVariantIds)
    : { data: [] };

  const compositeCostByVariant = new Map<string, number>();
  for (const c of componentRows ?? []) {
    const component = firstOf(c.component);
    const lineCost = Number(c.quantity) * Number(component?.cost ?? 0);
    compositeCostByVariant.set(
      c.composite_variant_id,
      (compositeCostByVariant.get(c.composite_variant_id) ?? 0) + lineCost
    );
  }

  const rows: ItemRow[] = (data ?? []).map((item) => {
    const category = firstOf(item.categories);
    const variants = arrayOf(item.item_variants).filter((v) => !v.deleted_at);

    const skus = variants.map((v) => v.sku).filter((s): s is string => !!s);

    const fixedPrices = variants
      .filter((v) => v.pricing_type === "FIXED" && v.default_price !== null)
      .map((v) => Number(v.default_price));
    const hasVariable = variants.some(
      (v) => v.pricing_type !== "FIXED" || v.default_price === null
    );
    let priceLabel = "—";
    if (variants.length > 0) {
      if (fixedPrices.length === 0) {
        priceLabel = "Variable";
      } else {
        const min = Math.min(...fixedPrices);
        const max = Math.max(...fixedPrices);
        priceLabel = min === max ? formatCurrency(min) : `${formatCurrency(min)} – ${formatCurrency(max)}`;
        if (hasVariable) priceLabel += " · Variable";
      }
    }

    const costs =
      item.item_type === "composite"
        ? variants.map((v) => compositeCostByVariant.get(v.id) ?? null)
        : variants.map((v) => (v.cost !== null ? Number(v.cost) : null));
    const knownCosts = costs.filter((c): c is number => c !== null);
    let costLabel = "—";
    if (knownCosts.length > 0) {
      const min = Math.min(...knownCosts);
      const max = Math.max(...knownCosts);
      costLabel = min === max ? formatCurrency(min) : `${formatCurrency(min)} – ${formatCurrency(max)}`;
    }

    const status: ItemRow["status"] = item.deleted_at
      ? "archived"
      : item.is_available_for_sale
        ? "available"
        : "not_for_sale";

    return {
      id: item.id,
      name: item.name,
      category: category?.name ?? null,
      item_type: item.item_type,
      status,
      sku_list: skus.join(", "),
      sku_count: skus.length,
      price_label: priceLabel,
      cost_label: costLabel,
    };
  });

  return (
    <div className="space-y-6">
      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load items: {error.message}
          </CardContent>
        </Card>
      )}

      <ItemsTable data={rows} canWrite={canWrite} />
    </div>
  );
}
