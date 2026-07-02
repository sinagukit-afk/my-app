import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { IncomingTable, type IncomingRow } from "./incoming-table";
import type { SupplierOption, ItemOption } from "./incoming-form";

export default async function IncomingInventoryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const canWrite = ["admin", "manager", "encoder"].includes(role);

  // Fetch data for form pickers
  const [{ data: supplierData }, { data: itemData }, { data: variantData }, { data: historyData, error }] =
    await Promise.all([
      supabase
        .from("suppliers")
        .select("id, name")
        .eq("is_active", true)
        .order("name"),

      supabase
        .from("items")
        .select("id, name")
        .is("deleted_at", null)
        .order("name"),

      supabase
        .from("item_variants")
        .select("id, item_id, option1_value, option2_value, sku")
        .is("deleted_at", null)
        .order("created_at"),

      supabase
        .from("incoming_items")
        .select(
          "id, date_received, item_name_snapshot, variant_id, quantity, unit_price, total_price, supplier_id, supplier, notes, received_by_email, suppliers(name), item_variants(option1_value, option2_value)"
        )
        .is("purchase_order_id", null)
        .order("date_received", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

  const suppliers: SupplierOption[] = supplierData ?? [];

  // Build items with nested variants for the picker
  const items: ItemOption[] = (itemData ?? []).map((item) => {
    const itemVariants = (variantData ?? []).filter((v) => v.item_id === item.id);
    return {
      id: item.id,
      name: item.name,
      variants: itemVariants.map((v) => ({
        id: v.id,
        label: [v.option1_value, v.option2_value].filter(Boolean).join(" / ") || v.sku || v.id,
      })),
    };
  });

  // Flatten history rows
  const rows: IncomingRow[] = (historyData ?? []).map((row) => {
    const supplierRel = Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers;
    const variantRel = Array.isArray(row.item_variants) ? row.item_variants[0] : row.item_variants;

    const variantLabel = variantRel
      ? [variantRel.option1_value, variantRel.option2_value].filter(Boolean).join(" / ") || null
      : null;

    return {
      id: row.id,
      date_received: row.date_received,
      item_name_snapshot: row.item_name_snapshot,
      variant_label: variantLabel,
      quantity: Number(row.quantity),
      unit_price: Number(row.unit_price),
      total_price: Number(row.total_price),
      supplier_name: supplierRel?.name ?? row.supplier ?? null,
      notes: row.notes ?? null,
      received_by_email: row.received_by_email ?? null,
    };
  });

  return (
    <div className="space-y-6">
      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load incoming entries: {error.message}
          </CardContent>
        </Card>
      )}

      <IncomingTable
        data={rows}
        suppliers={suppliers}
        items={items}
        canWrite={canWrite}
      />
    </div>
  );
}
