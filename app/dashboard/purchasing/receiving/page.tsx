import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { ReceivingHeader } from "./receiving-header";
import { ReceivingTable, type ReceivablePO } from "./receiving-table";
import { ReceivingLogTable, type ReceivingLogRow } from "./receiving-log-table";
import type { SupplierOption, ItemOption } from "./manual-incoming-form";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function ReceivingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const canWrite = ["admin", "manager", "encoder"].includes(role);

  const [
    { data: poData, error: poError },
    { data: supplierData },
    { data: itemData },
    { data: variantData },
    { data: logData, error: logError },
    { data: paymentTypesData },
  ] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select(
        "id, reference, status, expected_date, suppliers(name), purchase_order_items(quantity_ordered, quantity_received)"
      )
      .eq("po_type", "inventory")
      .in("status", ["sent", "partial"])
      .order("expected_date", { ascending: true, nullsFirst: false }),

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
        "id, reference, status, date_received, item_name_snapshot, variant_id, quantity, unit_price, total_price, supplier_id, supplier, notes, received_by_email, is_credit_card, item_variants(option1_value, option2_value), suppliers(name), purchase_orders(reference), payment_types(name)"
      )
      .order("date_received", { ascending: false })
      .order("created_at", { ascending: false }),

    supabase
      .from("payment_types")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
  ]);

  const openPOs: ReceivablePO[] = (poData ?? []).map((po) => {
    const supplier = firstOf(po.suppliers);
    const remaining = (po.purchase_order_items ?? []).reduce(
      (sum, item) => sum + Math.max(0, Number(item.quantity_ordered) - Number(item.quantity_received)),
      0
    );
    return {
      id: po.id,
      reference: po.reference,
      status: po.status,
      expected_date: po.expected_date,
      supplier_name: supplier?.name ?? "Unknown supplier",
      items_remaining: remaining,
    };
  });

  const suppliers: SupplierOption[] = supplierData ?? [];

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

  const receivingLog: ReceivingLogRow[] = (logData ?? []).map((row) => {
    const variantRel = firstOf(row.item_variants);
    const supplierRel = firstOf(row.suppliers);
    const poRel = firstOf(row.purchase_orders);
    const paymentTypeRel = firstOf(row.payment_types);

    const variantLabel = variantRel
      ? [variantRel.option1_value, variantRel.option2_value].filter(Boolean).join(" / ") || null
      : null;

    return {
      id: row.id,
      reference: row.reference,
      status: row.status,
      date_received: row.date_received,
      item_name_snapshot: row.item_name_snapshot,
      variant_label: variantLabel,
      quantity: Number(row.quantity),
      unit_price: Number(row.unit_price),
      total_price: Number(row.total_price),
      supplier_name: supplierRel?.name ?? row.supplier ?? null,
      purchase_order_reference: poRel?.reference ?? null,
      notes: row.notes ?? null,
      received_by_email: row.received_by_email ?? null,
      payment_type_name: paymentTypeRel?.name ?? null,
      is_credit_card: row.is_credit_card,
    };
  });

  const paymentTypeOptions = paymentTypesData ?? [];

  return (
    <div className="space-y-6">
      <ReceivingHeader
        canWrite={canWrite}
        suppliers={suppliers}
        items={items}
        paymentTypeOptions={paymentTypeOptions}
      />

      {(poError || logError) && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load receiving data: {poError?.message ?? logError?.message}
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-(--color-text)">Open Purchase Orders</h2>
        <ReceivingTable data={openPOs} />
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-(--color-text)">Receiving Log</h2>
        <ReceivingLogTable data={receivingLog} />
      </div>
    </div>
  );
}
