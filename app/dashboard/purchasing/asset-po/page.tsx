import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { AssetPOTable, type AssetPORow } from "./asset-po-table";

type SearchParams = Promise<{ from?: string; to?: string }>;

export default async function AssetPurchaseOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const { from = "", to = "" } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const canWrite = ["admin", "manager"].includes(role);

  let query = supabase
    .from("purchase_orders")
    .select(
      "id, reference, status, order_date, expected_date, total, suppliers(name), purchase_order_items(id)"
    )
    .eq("po_type", "asset");
  if (from) query = query.gte("order_date", from);
  if (to) query = query.lte("order_date", to);

  const { data, error } = await query.order("created_at", { ascending: false });

  const rows: AssetPORow[] = (data ?? []).map((po) => {
    const supplier = Array.isArray(po.suppliers) ? po.suppliers[0] : po.suppliers;
    return {
      id: po.id,
      reference: po.reference,
      status: po.status,
      order_date: po.order_date,
      expected_date: po.expected_date,
      total: po.total,
      supplier_name: supplier?.name ?? "—",
      item_count: po.purchase_order_items?.length ?? 0,
    };
  });

  return (
    <div className="space-y-6">
      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load asset purchase orders: {error.message}
          </CardContent>
        </Card>
      )}

      <AssetPOTable data={rows} canWrite={canWrite} from={from} to={to} />
    </div>
  );
}
