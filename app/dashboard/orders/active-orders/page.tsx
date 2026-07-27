import { createClient } from "@/lib/supabase/server";
import { OrderListTable } from "./order-list-table";
import { fetchOrderRows } from "./queries";

type SearchParams = Promise<{ year?: string; month?: string; status?: string }>;

export default async function OrderListPage({ searchParams }: { searchParams: SearchParams }) {
  const { year: yearParam, month: monthParam, status = "" } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const canCreate = ["admin", "manager", "encoder"].includes(role);

  const currentYear = new Date().getUTCFullYear();
  const year = Number(yearParam) || currentYear;
  const month = Number(monthParam) || 0;
  const periodStart = month ? `${year}-${String(month).padStart(2, "0")}-01` : `${year}-01-01`;
  const periodEnd = month
    ? new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
    : `${year}-12-31`;

  const [{ data: orderYearsRaw }, { rows, error }] = await Promise.all([
    supabase.from("orders").select("created_at"),
    fetchOrderRows(periodStart, periodEnd),
  ]);

  const years = Array.from(
    new Set([currentYear, ...((orderYearsRaw ?? []).map((r) => new Date(r.created_at).getUTCFullYear()))])
  ).sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-(--color-danger)">Failed to load orders: {error}</p>
      )}
      <OrderListTable
        data={rows}
        canCreate={canCreate}
        year={year}
        month={month}
        years={years}
        initialStatus={status}
      />
    </div>
  );
}
