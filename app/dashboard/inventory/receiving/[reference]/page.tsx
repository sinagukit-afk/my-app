import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ReceiveForm, type ReceivableItem } from "./receive-form";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function ReceivePurchaseOrderPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const canReceive = ["admin", "manager", "encoder"].includes(role);

  const { data: po, error } = await supabase
    .from("purchase_orders")
    .select("id, reference, status, suppliers(name)")
    .eq("reference", reference)
    .single();

  if (error || !po) notFound();

  const supplier = firstOf(po.suppliers);

  const { data: itemsData } = await supabase
    .from("purchase_order_items")
    .select(
      "id, quantity_ordered, quantity_received, unit_cost, item_name_snapshot, item_variants(sku, option1_value, items(name))"
    )
    .eq("purchase_order_id", po.id)
    .order("created_at");

  const { data: paymentTypesData } = await supabase
    .from("payment_types")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  const items: ReceivableItem[] = (itemsData ?? [])
    .map((row) => {
      const variant = firstOf(row.item_variants);
      const item = variant ? firstOf(variant.items) : null;
      const label = [item?.name ?? row.item_name_snapshot ?? "Unknown item", variant?.option1_value]
        .filter(Boolean)
        .join(" — ");
      return {
        id: row.id,
        label,
        sku: variant?.sku ?? null,
        quantity_ordered: row.quantity_ordered,
        quantity_received: row.quantity_received,
        remaining: Math.max(0, Number(row.quantity_ordered) - Number(row.quantity_received)),
      };
    })
    .filter((item) => item.remaining > 0);

  const canReceiveNow = canReceive && (po.status === "sent" || po.status === "partial");

  return (
    <div className="space-y-6">
      <Link href="/dashboard/inventory/receiving" className="text-sm text-(--color-primary) hover:underline">
        ← Receiving
      </Link>

      <PageHeader
        title={po.reference}
        description={`Supplier: ${supplier?.name ?? "Unknown supplier"} — status: ${po.status}`}
      />

      {po.status !== "sent" && po.status !== "partial" && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-text-muted)">
            This purchase order is not open for receiving (status: {po.status}).
          </CardContent>
        </Card>
      )}

      {!canReceive && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-text-muted)">
            Your role does not have permission to receive purchase orders.
          </CardContent>
        </Card>
      )}

      {canReceiveNow && items.length === 0 && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-text-muted)">
            All items on this order have already been received.
          </CardContent>
        </Card>
      )}

      {canReceiveNow && items.length > 0 && (
        <ReceiveForm
          purchaseOrderId={po.id}
          reference={po.reference}
          items={items}
          paymentTypeOptions={paymentTypesData ?? []}
        />
      )}
    </div>
  );
}
