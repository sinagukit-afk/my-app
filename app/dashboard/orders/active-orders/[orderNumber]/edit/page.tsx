import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditOrderForm } from "./edit-order-form";
import type { VariantOption, DiscountOption, ModifierGroupOption, OrderLineRow } from "../../order-line-items";

export default async function EditOrderPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const canEdit = ["admin", "manager", "encoder"].includes(role);

  if (!canEdit) redirect("/dashboard/orders/active-orders");

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, customer_id, note, order_date, target_date")
    .eq("order_number", orderNumber)
    .single();

  if (
    !order ||
    !["confirmed", "in_production", "partially_completed", "production_completed"].includes(order.status)
  )
    notFound();

  const { data: existingItems } = await supabase
    .from("order_items")
    .select(
      "id, variant_id, item_name_snapshot, sku_snapshot, quantity, unit_price, discount_id, line_discount, completed_qty, order_item_modifiers(modifier_id, modifier_option_id)"
    )
    .eq("order_id", order.id);

  const { data: customerData } = await supabase.from("customers").select("id, name").order("name");

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

  const initialRows: OrderLineRow[] = (existingItems ?? []).map((item) => ({
    rowId: crypto.randomUUID(),
    existingId: item.id,
    variantId: item.variant_id,
    quantity: String(item.quantity),
    unitPrice: String(item.unit_price),
    discountId: item.discount_id ?? "",
    discountManualValue: "",
    modifierSelections: Object.fromEntries(
      (item.order_item_modifiers ?? []).map((m) => [m.modifier_id, m.modifier_option_id])
    ),
    completedQty: item.completed_qty,
  }));

  return (
    <EditOrderForm
      orderId={order.id}
      status={order.status}
      customerId={order.customer_id}
      note={order.note}
      orderDate={order.order_date}
      targetDate={order.target_date}
      initialRows={initialRows}
      customers={customers}
      variantOptions={variantOptions}
      discounts={discounts}
      modifierGroups={modifierGroups}
    />
  );
}
