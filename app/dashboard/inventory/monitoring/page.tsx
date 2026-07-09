import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { getOnHand, getProjectedStock, getStockStatus } from "@/lib/inventory/calculations";
import { InventoryMonitoringTable, type InventoryMonitoringRow } from "./inventory-monitoring-table";
import { MovementsTable } from "./movements-table";
import { MOVEMENT_SELECT, mapMovementRow } from "./movement-utils";
import { QtyTile } from "./qty-tile";

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
    { data: poItemsData, error: poError },
    { data: movementsData, error: movementsError },
  ] = await Promise.all([
    supabase
      .from("items")
      .select(
        `name, categories(name),
         item_variants(id, sku, option1_value, deleted_at,
           inventory_levels(id, store_id, available_qty, reserved_qty, in_production_qty, on_hold_qty, low_stock_threshold, stores(name)))`
      )
      .eq("track_stock", true)
      .is("deleted_at", null)
      .is("item_variants.deleted_at", null)
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
        const threshold = level.low_stock_threshold != null ? Number(level.low_stock_threshold) : null;
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
          threshold,
          status: getStockStatus({ available_qty: quantities.available_qty, low_stock_threshold: threshold }),
        };
      })
    );
  });

  const summary = {
    lowStock: rows.filter((r) => r.status === "low").length,
    outOfStock: rows.filter((r) => r.status === "out").length,
    onHold: rows.filter((r) => r.on_hold_qty > 0).length,
    inProduction: rows.filter((r) => r.in_production_qty > 0).length,
    incoming: rows.filter((r) => r.incoming_qty > 0).length,
    reserved: rows.filter((r) => r.reserved_qty > 0).length,
  };

  const movementRows = (movementsData ?? []).map(mapMovementRow);

  return (
    <div className="space-y-6">
      {(error || poError || movementsError) && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load inventory: {error?.message ?? poError?.message ?? movementsError?.message}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <QtyTile label="Low Stock" value={summary.lowStock.toLocaleString("en-PH")} variant="warning" />
        <QtyTile label="Out of Stock" value={summary.outOfStock.toLocaleString("en-PH")} variant="danger" />
        <QtyTile label="On Hold" value={summary.onHold.toLocaleString("en-PH")} variant="warning" />
        <QtyTile label="In Production" value={summary.inProduction.toLocaleString("en-PH")} variant="default" />
        <QtyTile label="Incoming" value={summary.incoming.toLocaleString("en-PH")} variant="neutral" />
        <QtyTile label="Reserved" value={summary.reserved.toLocaleString("en-PH")} variant="info" />
      </div>

      <InventoryMonitoringTable data={rows} />

      <MovementsTable data={movementRows} />
    </div>
  );
}
