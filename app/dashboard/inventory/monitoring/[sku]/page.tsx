import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getOnHand, getProjectedStock } from "@/lib/inventory/calculations";
import { MOVEMENT_SELECT, mapMovementRow } from "../movement-utils";
import { MovementsTable } from "../movements-table";
import { QtyTile } from "../qty-tile";
import { BATCH_SELECT, mapBatchRow } from "../batch-utils";
import { BatchesTable } from "../batches-table";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function arrayOf<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function formatQty(value: number) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 3 }).format(value);
}

const VARIANT_SELECT =
  `id, sku, option1_value, items(name, categories(name)),
   inventory_levels(id, store_id, available_qty, reserved_qty, in_production_qty, on_hold_qty)`;

export default async function InventoryItemDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ sku: string }>;
  searchParams: Promise<{ store?: string }>;
}) {
  const { sku } = await params;
  const { store } = await searchParams;
  const supabase = await createClient();

  // Routed by SKU (human-readable, not DB-enforced unique) — fall back to matching by
  // variant id for the rare case a tracked variant has no SKU set.
  let { data: variant } = await supabase
    .from("item_variants")
    .select(VARIANT_SELECT)
    .eq("sku", sku)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (!variant) {
    ({ data: variant } = await supabase
      .from("item_variants")
      .select(VARIANT_SELECT)
      .eq("id", sku)
      .is("deleted_at", null)
      .maybeSingle());
  }

  if (!variant) notFound();

  const levels = arrayOf(variant.inventory_levels);
  const level = (store ? levels.find((l) => l.store_id === store) : levels[0]) ?? null;

  // A tracked variant that hasn't had a stock event yet has no inventory_levels row for
  // this store — that's not a 404, it just means everything is 0 so far.
  const storeId = store ?? level?.store_id;
  if (!storeId) notFound();

  const item = firstOf(variant.items);
  const category = item ? firstOf(item.categories) : null;
  const { data: storeRow } = await supabase.from("stores").select("name").eq("id", storeId).maybeSingle();
  if (!storeRow) notFound();

  const [
    { data: poItemsData },
    { data: movementsData, error: movementsError },
    { data: batchesData, error: batchesError },
    { data: lotMovementsData },
  ] = await Promise.all([
    supabase
      .from("purchase_order_items")
      .select("quantity_ordered, quantity_received, purchase_orders!inner(status)")
      .eq("variant_id", variant.id)
      .in("purchase_orders.status", ["sent", "partial"]),

    supabase
      .from("inventory_movements")
      .select(MOVEMENT_SELECT)
      .eq("variant_id", variant.id)
      .eq("store_id", storeId)
      .order("occurred_at", { ascending: false })
      .limit(50),

    supabase
      .from("incoming_items")
      .select(BATCH_SELECT)
      .eq("variant_id", variant.id)
      .eq("store_id", storeId)
      .order("date_received", { ascending: true })
      .order("created_at", { ascending: true }),

    supabase
      .from("inventory_movements")
      .select(MOVEMENT_SELECT)
      .eq("variant_id", variant.id)
      .eq("store_id", storeId)
      .not("lot_id", "is", null)
      .order("occurred_at", { ascending: true }),
  ]);

  const incoming_qty = (poItemsData ?? []).reduce((sum, line) => {
    const outstanding = Number(line.quantity_ordered) - Number(line.quantity_received);
    return outstanding > 0 ? sum + outstanding : sum;
  }, 0);

  const quantities = {
    available_qty: Number(level?.available_qty ?? 0),
    reserved_qty: Number(level?.reserved_qty ?? 0),
    in_production_qty: Number(level?.in_production_qty ?? 0),
    on_hold_qty: Number(level?.on_hold_qty ?? 0),
    incoming_qty,
  };
  const itemName = variant.option1_value ? `${item?.name ?? "Unknown item"} — ${variant.option1_value}` : item?.name ?? "Unknown item";
  const movements = (movementsData ?? []).map(mapMovementRow);
  const batches = (batchesData ?? []).map(mapBatchRow);
  const lotMovements = (lotMovementsData ?? []).map(mapMovementRow);

  return (
    <div className="space-y-6">
      <PageHeader
        title={itemName}
        description={[variant.sku, category?.name, storeRow?.name ?? "—"].filter(Boolean).join(" · ")}
        backHref="/dashboard/inventory/monitoring"
        backLabel="Back to Inventory"
      />

      {movementsError && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load movement history: {movementsError.message}
          </CardContent>
        </Card>
      )}

      {batchesError && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load batches: {batchesError.message}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        <QtyTile label="Available" value={formatQty(quantities.available_qty)} variant="success" />
        <QtyTile label="Reserved" value={formatQty(quantities.reserved_qty)} variant="info" />
        <QtyTile label="In Production" value={formatQty(quantities.in_production_qty)} variant="default" />
        <QtyTile label="On Hold" value={formatQty(quantities.on_hold_qty)} variant="warning" />
        <QtyTile label="Incoming" value={formatQty(quantities.incoming_qty)} variant="neutral" />
        <QtyTile label="On Hand" value={formatQty(getOnHand(quantities))} />
        <QtyTile label="Projected" value={formatQty(getProjectedStock(quantities))} />
      </div>

      <BatchesTable data={batches} movements={lotMovements} />

      <MovementsTable
        data={movements}
        title="Recent Movements"
        description="The most recent 50 stock movements recorded for this item at this store."
      />
    </div>
  );
}
