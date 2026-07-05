import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { MovementsTable, type MovementRow } from "./movements-table";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function StockMovementPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("inventory_movements")
    .select(
      `id, movement_type, status, quantity_change, quantity_before, quantity_after, counterpart_status, note, occurred_at,
       item_variants(sku, option1_value, items(name)), stores(name)`
    )
    .order("occurred_at", { ascending: false })
    .limit(500);

  const rows: MovementRow[] = (data ?? []).map((m) => {
    const variant = firstOf(m.item_variants);
    const item = variant ? firstOf(variant.items) : null;
    const store = firstOf(m.stores);
    return {
      id: m.id,
      movement_type: m.movement_type,
      status: m.status,
      quantity_change: m.quantity_change,
      quantity_before: m.quantity_before,
      quantity_after: m.quantity_after,
      counterpart_status: m.counterpart_status,
      note: m.note,
      occurred_at: m.occurred_at,
      item_name: item?.name ?? "Unknown item",
      variant_label: variant?.option1_value ?? variant?.sku ?? null,
      store_name: store?.name ?? "—",
    };
  });

  return (
    <div className="space-y-6">
      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load stock movements: {error.message}
          </CardContent>
        </Card>
      )}

      <MovementsTable data={rows} />
    </div>
  );
}
