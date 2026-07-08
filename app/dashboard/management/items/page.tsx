import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { ItemsTable, type ItemRow } from "./items-table";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function arrayOf<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function peso(v: number) {
  return `₱${v.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
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
      `id, name, item_type, track_stock, is_available_for_sale, deleted_at, sync_status, sync_error,
       categories(name),
       item_variants(sku, default_price, pricing_type, deleted_at, inventory_levels(in_stock))`
    )
    .order("name");

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
        priceLabel = min === max ? peso(min) : `${peso(min)} – ${peso(max)}`;
        if (hasVariable) priceLabel += " · Variable";
      }
    }

    const stock = item.track_stock
      ? variants.reduce(
          (sum, v) =>
            sum +
            arrayOf(v.inventory_levels).reduce(
              (s, l) => s + Number(l.in_stock ?? 0),
              0
            ),
          0
        )
      : null;

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
      stock,
      sku_list: skus.join(", "),
      sku_count: skus.length,
      price_label: priceLabel,
      sync_status: item.sync_status ?? "synced",
      sync_error: item.sync_error,
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
