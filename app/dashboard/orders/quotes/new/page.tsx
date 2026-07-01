import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewQuoteForm, type VariantOption } from "./new-quote-form";

export default async function NewQuotePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const canWrite = ["admin", "manager", "encoder"].includes(role);

  if (!canWrite) redirect("/dashboard/orders/quotes");

  const { data: customerData } = await supabase
    .from("customers")
    .select("id, name")
    .order("name");

  const { data: itemData } = await supabase
    .from("items")
    .select("name, item_variants(id, sku, option1_value, default_price)")
    .eq("is_available_for_sale", true)
    .order("name");

  const variantOptions: VariantOption[] = (itemData ?? []).flatMap((item) =>
    (item.item_variants ?? []).map((v) => ({
      id: v.id,
      label: v.option1_value ? `${item.name} — ${v.option1_value}` : item.name,
      sku: v.sku,
      price: v.default_price,
    }))
  );

  const customers = (customerData ?? []).filter((c) => c.name) as { id: string; name: string }[];

  return <NewQuoteForm customers={customers} variantOptions={variantOptions} />;
}
