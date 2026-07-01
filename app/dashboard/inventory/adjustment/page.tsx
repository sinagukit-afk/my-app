import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { AdjustmentForm, type VariantOption } from "./adjustment-form";
import { RecentAdjustments, type AdjustmentRow } from "./recent-adjustments";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function ItemAdjustmentPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const canAdjust = ["admin", "manager", "encoder"].includes(role);

  const { data: itemData, error: variantError } = await supabase
    .from("items")
    .select("name, item_variants(id, sku, option1_value, inventory_levels(in_stock))")
    .eq("track_stock", true)
    .order("name");

  const variants: VariantOption[] = (itemData ?? []).flatMap((item) => {
    const itemVariants = item.item_variants ?? [];
    return itemVariants.map((v) => {
      const level = Array.isArray(v.inventory_levels) ? v.inventory_levels[0] : v.inventory_levels;
      return {
        id: v.id,
        label: v.option1_value ? `${item.name} — ${v.option1_value}` : item.name,
        sku: v.sku,
        in_stock: level?.in_stock ?? 0,
      };
    });
  });

  const { data: recentData } = await supabase
    .from("inventory_movements")
    .select(
      `id, quantity_change, quantity_after, note, occurred_at,
       item_variants(sku, option1_value, items(name))`
    )
    .eq("movement_type", "manual_adjustment")
    .order("occurred_at", { ascending: false })
    .limit(25);

  const recent: AdjustmentRow[] = (recentData ?? []).map((m) => {
    const variant = firstOf(m.item_variants);
    const item = variant ? firstOf(variant.items) : null;
    return {
      id: m.id,
      item_name: item?.name ?? "Unknown item",
      variant_label: variant?.option1_value ?? variant?.sku ?? null,
      quantity_change: m.quantity_change,
      quantity_after: m.quantity_after,
      note: m.note,
      occurred_at: m.occurred_at,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Item Adjustment"
        description="Manually correct stock levels to reflect physical counts or write-offs."
      />

      {variantError && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load items: {variantError.message}
          </CardContent>
        </Card>
      )}

      {canAdjust ? (
        <AdjustmentForm variants={variants} />
      ) : (
        <Card className="max-w-lg">
          <CardContent className="p-4 text-sm text-(--color-text-muted)">
            Your role does not have permission to adjust stock. Contact an admin or manager.
          </CardContent>
        </Card>
      )}

      <RecentAdjustments data={recent} />
    </div>
  );
}
