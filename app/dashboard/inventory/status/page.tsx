import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { getOnHand, getProjectedStock } from "@/lib/inventory/calculations";
import { InventoryMonitoringTable, type InventoryMonitoringRow } from "./inventory-monitoring-table";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function arrayOf<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

export default async function InventoryStatusPage() {
  const supabase = await createClient();

  const [{ data, error }, { data: poItemsData, error: poError }] = await Promise.all([
    supabase
      .from("items")
      .select(
        `name, categories(name),
         item_variants(id, sku, option1_value, deleted_at,
           inventory_levels(id, store_id, available_qty, reserved_qty, in_production_qty, on_hold_qty, stores(name)))`
      )
      .eq("track_stock", true)
      .is("deleted_at", null)
      .is("item_variants.deleted_at", null)
      .order("name"),

    supabase
      .from("purchase_order_items")
      .select("variant_id, quantity_ordered, quantity_received, purchase_orders!inner(status)")
      .in("purchase_orders.status", ["sent", "partial"]),
  ]);

  const incomingByVariant = new Map<string, number>();
  for (const line of poItemsData ?? []) {
    const outstanding = Number(line.quantity_ordered) - Number(line.quantity_received);
    if (outstanding <= 0) continue;
    incomingByVariant.set(line.variant_id, (incomingByVariant.get(line.variant_id) ?? 0) + outstanding);
  }

  const rows: InventoryMonitoringRow[] = (data ?? []).flatMap((item) => {
    const category = firstOf(item.categories);
    const variants = arrayOf(item.item_variants).filter((v) => !v.deleted_at);

    return variants.flatMap((variant) =>
      arrayOf(variant.inventory_levels).map((level) => {
        const store = firstOf(level.stores);
        const quantities = {
          available_qty: Number(level.available_qty),
          reserved_qty: Number(level.reserved_qty),
          in_production_qty: Number(level.in_production_qty),
          on_hold_qty: Number(level.on_hold_qty),
          incoming_qty: incomingByVariant.get(variant.id) ?? 0,
        };
        return {
          id: level.id,
          variant_id: variant.id,
          store_id: level.store_id,
          item_name: variant.option1_value ? `${item.name} — ${variant.option1_value}` : item.name,
          sku: variant.sku,
          category: category?.name ?? null,
          store_name: store?.name ?? "—",
          ...quantities,
          on_hand: getOnHand(quantities),
          projected_stock: getProjectedStock(quantities),
        };
      })
    );
  });

  return (
    <div className="space-y-6">
      {(error || poError) && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load inventory: {error?.message ?? poError?.message}
          </CardContent>
        </Card>
      )}

      <InventoryMonitoringTable data={rows} />
    </div>
  );
}
