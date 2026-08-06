import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditQuoteForm } from "./edit-quote-form";
import type { VariantOption, DiscountOption, ModifierGroupOption, QuoteLineRow } from "../../quote-line-items";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function EditQuotePage({ params }: { params: Promise<{ quoteNumber: string }> }) {
  const { quoteNumber } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";

  const { data: quote } = await supabase
    .from("quotes")
    .select("id, status, valid_until, customer_id, note, quote_date, order_source, created_by")
    .eq("quote_number", quoteNumber)
    .single();

  const today = new Date().toISOString().slice(0, 10);
  if (!quote || quote.status !== "open" || quote.valid_until < today) notFound();

  const canEdit = role === "admin" || (["encoder", "manager"].includes(role) && quote.created_by === user?.id);

  if (!canEdit) redirect("/dashboard/orders/quotation");

  const { data: existingItems } = await supabase
    .from("quote_items")
    .select(
      "id, variant_id, item_name_snapshot, sku_snapshot, quantity, unit_price, discount_id, line_discount, quote_item_modifiers(modifier_id, modifier_option_id)"
    )
    .eq("quote_id", quote.id);

  const { data: customerData } = await supabase.from("customers").select("id, name").order("name");

  const { data: itemData } = await supabase
    .from("items")
    .select("id, name, item_variants(id, sku, option1_value, default_price), categories!inner(name)")
    .eq("is_available_for_sale", true)
    .is("deleted_at", null)
    .is("item_variants.deleted_at", null)
    .in("categories.name", ["Product(Customize)", "Product(Pre-made)", "Services"])
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

  // Existing lines may reference a variant outside the filtered categories (e.g. saved before
  // this filter existed) — keep it selectable so the editor doesn't render it as blank.
  const knownVariantIds = new Set(variantOptions.map((v) => v.id));
  const missingVariantIds = [...new Set((existingItems ?? []).map((i) => i.variant_id))].filter(
    (id) => !knownVariantIds.has(id)
  );

  if (missingVariantIds.length > 0) {
    const { data: extraVariantData } = await supabase
      .from("item_variants")
      .select("id, sku, option1_value, default_price, item_id, items(name)")
      .in("id", missingVariantIds);

    for (const v of extraVariantData ?? []) {
      const item = firstOf(v.items);
      variantOptions.push({
        id: v.id,
        itemId: v.item_id,
        label: v.option1_value ? `${item?.name ?? ""} — ${v.option1_value}` : item?.name ?? "",
        sku: v.sku,
        price: v.default_price,
      });
    }
  }

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

  const initialRows: QuoteLineRow[] = (existingItems ?? []).map((item) => ({
    rowId: crypto.randomUUID(),
    variantId: item.variant_id,
    quantity: String(item.quantity),
    unitPrice: String(item.unit_price),
    discountId: item.discount_id ?? "",
    discountManualValue: "",
    modifierSelections: Object.fromEntries(
      (item.quote_item_modifiers ?? []).map((m) => [m.modifier_id, m.modifier_option_id])
    ),
  }));

  return (
    <EditQuoteForm
      quoteId={quote.id}
      customerId={quote.customer_id}
      note={quote.note}
      quoteDate={quote.quote_date}
      validUntil={quote.valid_until}
      orderSource={quote.order_source}
      initialRows={initialRows}
      customers={customers}
      variantOptions={variantOptions}
      discounts={discounts}
      modifierGroups={modifierGroups}
    />
  );
}
