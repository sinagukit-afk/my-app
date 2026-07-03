import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditQuoteForm, type VariantOption } from "./edit-quote-form";

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, status, customer_id, note, created_by, same_as_customer, receiver_name, receiver_phone, receiver_address_line1, receiver_barangay, receiver_city, receiver_province, receiver_postal_code"
    )
    .eq("id", id)
    .single();

  if (!order || order.status !== "quote") notFound();

  const canEdit =
    role === "admin" || (["encoder", "manager"].includes(role) && order.created_by === user?.id);

  if (!canEdit) redirect("/dashboard/orders/quotes");

  const { data: existingItems } = await supabase
    .from("order_items")
    .select("variant_id, item_name_snapshot, sku_snapshot, quantity, unit_price, line_discount")
    .eq("order_id", id);

  const { data: customerData } = await supabase.from("customers").select("id, name").order("name");

  const { data: itemData } = await supabase
    .from("items")
    .select("name, item_variants(id, sku, option1_value, default_price)")
    .eq("is_available_for_sale", true)
    .is("deleted_at", null)
    .is("item_variants.deleted_at", null)
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

  return (
    <EditQuoteForm
      orderId={order.id}
      customerId={order.customer_id}
      note={order.note}
      receiver={{
        same_as_customer: order.same_as_customer,
        receiver_name: order.receiver_name,
        receiver_phone: order.receiver_phone,
        receiver_address_line1: order.receiver_address_line1,
        receiver_barangay: order.receiver_barangay,
        receiver_city: order.receiver_city,
        receiver_province: order.receiver_province,
        receiver_postal_code: order.receiver_postal_code,
      }}
      items={existingItems ?? []}
      customers={customers}
      variantOptions={variantOptions}
    />
  );
}
