import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ReceivingTable, type ReceivablePO } from "./receiving-table";

export default async function ReceivingPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("purchase_orders")
    .select(
      "id, reference, status, expected_date, suppliers(name), purchase_order_items(quantity_ordered, quantity_received)"
    )
    .in("status", ["sent", "partial"])
    .order("expected_date", { ascending: true, nullsFirst: false });

  const rows: ReceivablePO[] = (data ?? []).map((po) => {
    const supplier = Array.isArray(po.suppliers) ? po.suppliers[0] : po.suppliers;
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Receiving"
        description="Process incoming deliveries and reconcile them against open purchase orders."
      />

      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load purchase orders: {error.message}
          </CardContent>
        </Card>
      )}

      <ReceivingTable data={rows} />
    </div>
  );
}
