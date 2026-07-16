import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewManualIncomingForm, type VariantOption } from "./new-manual-incoming-form";

export default async function NewManualIncomingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const canWrite = ["admin", "manager", "encoder"].includes(role);

  if (!canWrite) redirect("/dashboard/purchasing/receiving");

  const [{ data: supplierData }, { data: itemData }] = await Promise.all([
    supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),

    supabase
      .from("items")
      .select("id, name, description, ai_match_keywords, item_variants(id, sku, option1_value)")
      .is("deleted_at", null)
      .is("item_variants.deleted_at", null)
      .order("name"),
  ]);

  const variantOptions: VariantOption[] = (itemData ?? []).flatMap((item) => {
    const keywords = [item.description, item.ai_match_keywords].filter(Boolean).join(", ") || undefined;
    return (item.item_variants ?? []).map((v) => ({
      id: v.id,
      itemId: item.id,
      itemName: item.name,
      label: v.option1_value ? `${item.name} — ${v.option1_value}` : item.name,
      sku: v.sku,
      keywords,
    }));
  });

  return (
    <NewManualIncomingForm
      suppliers={supplierData ?? []}
      variantOptions={variantOptions}
    />
  );
}
