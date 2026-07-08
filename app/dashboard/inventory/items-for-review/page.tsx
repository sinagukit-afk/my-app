import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { ItemsForReviewTable, type ReviewRow } from "./items-for-review-table";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function ItemsForReviewPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const canRelease = ["admin", "manager", "encoder"].includes(role);

  const { data, error } = await supabase
    .from("inventory_levels")
    .select(
      `variant_id, store_id, on_hold_qty, available_qty, in_production_qty,
       item_variants(sku, option1_value, items(name))`
    )
    .gt("on_hold_qty", 0)
    .order("on_hold_qty", { ascending: false });

  const rows: ReviewRow[] = (data ?? []).map((level) => {
    const variant = firstOf(level.item_variants);
    const item = variant ? firstOf(variant.items) : null;
    return {
      variant_id: level.variant_id,
      store_id: level.store_id,
      item_name: item?.name ?? "Unknown item",
      variant_label: variant?.option1_value ?? null,
      sku: variant?.sku ?? null,
      on_hold_qty: level.on_hold_qty,
      available_qty: level.available_qty,
      in_production_qty: level.in_production_qty,
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

      <ItemsForReviewTable data={rows} canRelease={canRelease} />
    </div>
  );
}
