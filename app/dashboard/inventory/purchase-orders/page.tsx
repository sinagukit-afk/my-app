import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PurchaseOrdersTable, type PurchaseOrderRow } from "./purchase-orders-table";

export default async function PurchaseOrdersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const canWrite = ["admin", "manager", "encoder"].includes(role);
  const canDelete = ["admin", "manager"].includes(role);

  const { data, error } = await supabase
    .from("purchase_orders")
    .select(
      "id, reference, status, order_date, expected_date, total, suppliers(name), purchase_order_items(id)"
    )
    .order("created_at", { ascending: false });

  const rows: PurchaseOrderRow[] = (data ?? []).map((po) => {
    const supplier = Array.isArray(po.suppliers) ? po.suppliers[0] : po.suppliers;
    return {
      id: po.id,
      reference: po.reference,
      status: po.status,
      order_date: po.order_date,
      expected_date: po.expected_date,
      total: po.total,
      supplier_name: supplier?.name ?? "Unknown supplier",
      item_count: po.purchase_order_items?.length ?? 0,
    };
  });

  return (
    <div className="space-y-6">
      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load purchase orders: {error.message}
          </CardContent>
        </Card>
      )}

      <PurchaseOrdersTable data={rows} canWrite={canWrite} canDelete={canDelete} />
    </div>
  );
}
