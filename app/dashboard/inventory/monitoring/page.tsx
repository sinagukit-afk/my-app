import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { getOnHand, getProjectedStock, getStockStatus } from "@/lib/inventory/calculations";
import { InventoryMonitoringTable, type InventoryMonitoringRow } from "./inventory-monitoring-table";
import { MovementsTable } from "./movements-table";
import { MOVEMENT_SELECT, mapMovementRow } from "./movement-utils";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function arrayOf<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

export default async function InventoryMonitoringPage() {
  const supabase = await createClient();

  const [
    { data, error },
    { data: storesData, error: storesError },
    { data: poItemsData, error: poError },
    { data: movementsData, error: movementsError },
  ] = await Promise.all([
    supabase
      .from("items")
      .select(
        `name, categories(name),
         item_variants(id, sku, option1_value, deleted_at,
           inventory_levels(id, store_id, available_qty, reserved_qty, in_production_qty, on_hold_qty, low_stock_threshold))`
      )
      .eq("track_stock", true)
      .is("deleted_at", null)
      .is("item_variants.deleted_at", null)
      .order("name"),

    supabase
      .from("stores")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),

    supabase
      .from("purchase_order_items")
      .select("variant_id, quantity_ordered, quantity_received, purchase_orders!inner(status)")
      .in("purchase_orders.status", ["sent", "partial"]),

    supabase
      .from("inventory_movements")
      .select(MOVEMENT_SELECT)
      .order("occurred_at", { ascending: false })
      .limit(500),
  ]);

  const stores = storesData ?? [];

  const incomingByVariant = new Map<string, number>();
  for (const line of poItemsData ?? []) {
    const outstanding = Number(line.quantity_ordered) - Number(line.quantity_received);
    if (outstanding <= 0) continue;
    incomingByVariant.set(line.variant_id, (incomingByVariant.get(line.variant_id) ?? 0) + outstanding);
  }

  // Enumerate every tracked variant × active store, not just pairs that already have an
  // inventory_levels row — a variant with no stock event yet still needs to show as 0, not
  // disappear from the table entirely.
  const rows: InventoryMonitoringRow[] = (data ?? []).flatMap((item) => {
    const category = firstOf(item.categories);
    const variants = arrayOf(item.item_variants).filter((v) => !v.deleted_at);

    return variants.flatMap((variant) => {
      const levelsByStore = new Map(arrayOf(variant.inventory_levels).map((l) => [l.store_id, l]));

      return stores.map((store) => {
        const level = levelsByStore.get(store.id) ?? null;
        const quantities = {
          available_qty: Number(level?.available_qty ?? 0),
          reserved_qty: Number(level?.reserved_qty ?? 0),
          in_production_qty: Number(level?.in_production_qty ?? 0),
          on_hold_qty: Number(level?.on_hold_qty ?? 0),
          incoming_qty: incomingByVariant.get(variant.id) ?? 0,
        };
        const threshold = level?.low_stock_threshold != null ? Number(level.low_stock_threshold) : null;
        return {
          id: level?.id ?? `${variant.id}:${store.id}`,
          variant_id: variant.id,
          store_id: store.id,
          item_name: variant.option1_value ? `${item.name} — ${variant.option1_value}` : item.name,
          sku: variant.sku,
          category: category?.name ?? null,
          store_name: store.name,
          ...quantities,
          on_hand: getOnHand(quantities),
          projected_stock: getProjectedStock(quantities),
          threshold,
          status: getStockStatus({ available_qty: quantities.available_qty, low_stock_threshold: threshold }),
        };
      });
    });
  });

  const movementRows = (movementsData ?? []).map(mapMovementRow);

  return (
    <div className="space-y-6">
      {(error || storesError || poError || movementsError) && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load inventory: {error?.message ?? storesError?.message ?? poError?.message ?? movementsError?.message}
          </CardContent>
        </Card>
      )}

      <InventoryMonitoringTable data={rows} />

      <MovementsTable data={movementRows} />
    </div>
  );
}
