import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewQuoteForm } from "./new-quote-form";
import type { VariantOption, DiscountOption, ModifierGroupOption } from "../quote-line-items";

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
    .select("id, name, item_variants(id, sku, option1_value, default_price)")
    .eq("is_available_for_sale", true)
    .is("deleted_at", null)
    .is("item_variants.deleted_at", null)
    .order("name");

  const variantOptions: VariantOption[] = (itemData ?? []).flatMap((item) =>
    (item.item_variants ?? []).map((v) => ({
      id: v.id,
      itemId: item.id,
      label: v.option1_value ? `${item.name} — ${v.option1_value}` : item.name,
      sku: v.sku,
      price: v.default_price,
    }))
  );

  const { data: discountData } = await supabase
    .from("discounts")
    .select("id, name, discount_type, percentage, money_amount")
    .is("deleted_at", null)
    .neq("discount_type", "DISCOUNT_BY_POINTS")
    .order("name");

  const discounts: DiscountOption[] = (discountData ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    discountType: d.discount_type,
    percentage: d.percentage,
    moneyAmount: d.money_amount,
  }));

  const { data: itemModifierData } = await supabase
    .from("item_modifiers")
    .select("item_id, modifiers(id, name, modifier_options(id, name, price))");

  const modifierGroups: ModifierGroupOption[] = (itemModifierData ?? []).flatMap((row) => {
    const modifier = Array.isArray(row.modifiers) ? row.modifiers[0] : row.modifiers;
    if (!modifier) return [];
    return [
      {
        itemId: row.item_id,
        modifierId: modifier.id,
        modifierName: modifier.name,
        options: (modifier.modifier_options ?? []).map((o) => ({ id: o.id, name: o.name, price: o.price })),
      },
    ];
  });

  const customers = (customerData ?? []).filter((c) => c.name) as { id: string; name: string }[];

  return (
    <NewQuoteForm
      customers={customers}
      variantOptions={variantOptions}
      discounts={discounts}
      modifierGroups={modifierGroups}
    />
  );
}
