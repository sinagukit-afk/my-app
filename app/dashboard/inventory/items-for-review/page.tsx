import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { ItemsForReviewTable, type ReviewRow } from "./items-for-review-table";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

// Best-effort attribution only, not a real ledger: cancel_production_order()/cancel_order()
// write the order/production-order number into the movement's free-text `note`, but on-hold
// stock is one flat pool per (variant, store) with no per-source parcel tracking — a release
// doesn't say which source's units it drew down. To split a variant's current on_hold_qty
// across sources without any schema change, walk its on-hold inflow movements newest-first
// and greedily attribute quantity to each source until the live total is accounted for
// (older inflows beyond that point are assumed already released). This guarantees the split
// always sums exactly to the real on_hold_qty — it just can't guarantee *which* units are
// whose once more than one source has fed the same pool. See PROGRESS-INVENTORY.md INV-15.
const ORDER_REFERENCE_PATTERN = /\b(SPR|SOD)\d{2}-\d{4}-\d{4}\b/;

function groupFromNote(note: string | null): { label: string; href: string | null } {
  const match = note?.match(ORDER_REFERENCE_PATTERN);
  if (!match) return { label: "Unattributed", href: null };
  const code = match[0];
  return code.startsWith("SPR")
    ? { label: `Production Order ${code}`, href: `/dashboard/orders/production/${code}` }
    : { label: `Order ${code}`, href: `/dashboard/orders/active-orders/${code}` };
}

type Inflow = { note: string | null; quantity_change: number };

function splitOnHoldBySource(inflows: Inflow[], onHoldQty: number) {
  const bySource = new Map<string, { href: string | null; qty: number }>();
  let remaining = onHoldQty;
  for (const inflow of inflows) {
    if (remaining <= 1e-9) break;
    const take = Math.min(inflow.quantity_change, remaining);
    if (take <= 0) continue;
    const { label, href } = groupFromNote(inflow.note);
    const existing = bySource.get(label);
    if (existing) existing.qty += take;
    else bySource.set(label, { href, qty: take });
    remaining -= take;
  }
  if (remaining > 1e-9) {
    const existing = bySource.get("Unattributed");
    if (existing) existing.qty += remaining;
    else bySource.set("Unattributed", { href: null, qty: remaining });
  }
  return bySource;
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
      `variant_id, store_id, on_hold_qty, available_qty,
       item_variants(sku, option1_value, items(name))`
    )
    .gt("on_hold_qty", 0)
    .order("on_hold_qty", { ascending: false });

  const variantIds = [...new Set((data ?? []).map((level) => level.variant_id))];

  const { data: movements } = variantIds.length
    ? await supabase
        .from("inventory_movements")
        .select("variant_id, store_id, note, quantity_change, created_at")
        .in("variant_id", variantIds)
        .eq("status", "on_hold")
        .eq("movement_type", "status_transfer")
        .gt("quantity_change", 0)
        .order("created_at", { ascending: false })
    : { data: [] };

  const inflowsByKey = new Map<string, Inflow[]>();
  for (const movement of movements ?? []) {
    const key = `${movement.variant_id}:${movement.store_id}`;
    if (!inflowsByKey.has(key)) inflowsByKey.set(key, []);
    inflowsByKey.get(key)!.push({ note: movement.note, quantity_change: Number(movement.quantity_change) });
  }

  const rows: ReviewRow[] = (data ?? []).flatMap((level) => {
    const variant = firstOf(level.item_variants);
    const item = variant ? firstOf(variant.items) : null;
    const key = `${level.variant_id}:${level.store_id}`;
    const bySource = splitOnHoldBySource(inflowsByKey.get(key) ?? [], Number(level.on_hold_qty));

    return [...bySource.entries()].map(([label, { href, qty }]) => ({
      variant_id: level.variant_id,
      store_id: level.store_id,
      item_name: item?.name ?? "Unknown item",
      variant_label: variant?.option1_value ?? null,
      sku: variant?.sku ?? null,
      on_hold_qty: qty,
      available_qty: level.available_qty,
      group_label: label,
      group_href: href,
    }));
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
