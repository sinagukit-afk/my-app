import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewPurchaseOrderForm, type VariantOption } from "./new-po-form";

export default async function NewPurchaseOrderPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const canWrite = ["admin", "manager", "encoder"].includes(role);

  if (!canWrite) redirect("/dashboard/purchasing/purchase-orders");

  const { data: supplierData } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  const { data: itemData } = await supabase
    .from("items")
    .select("name, item_variants(id, sku, option1_value, cost)")
    .eq("track_stock", true)
    .is("deleted_at", null)
    .is("item_variants.deleted_at", null)
    .order("name");

  const variantOptions: VariantOption[] = (itemData ?? []).flatMap((item) =>
    (item.item_variants ?? []).map((v) => ({
      id: v.id,
      label: v.option1_value ? `${item.name} — ${v.option1_value}` : item.name,
      sku: v.sku,
      cost: v.cost,
    }))
  );

  return <NewPurchaseOrderForm suppliers={supplierData ?? []} variantOptions={variantOptions} />;
}
