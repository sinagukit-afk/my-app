import { createClient } from "@/lib/supabase/server";
import { OrderListTable } from "./order-list-table";
import { fetchOrderRows } from "./queries";

type SearchParams = Promise<{ from?: string; to?: string }>;

export default async function OrderListPage({ searchParams }: { searchParams: SearchParams }) {
  const { from = "", to = "" } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const canCreate = ["admin", "manager", "encoder"].includes(role);

  const { rows, error } = await fetchOrderRows(from, to);

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-(--color-danger)">Failed to load orders: {error}</p>
      )}
      <OrderListTable data={rows} canCreate={canCreate} from={from} to={to} />
    </div>
  );
}
