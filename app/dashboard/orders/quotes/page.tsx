import { createClient } from "@/lib/supabase/server";
import { QuotesTable, type QuoteRow } from "./quotes-table";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function QuotesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const canCreate = ["admin", "manager", "encoder"].includes(role);
  const canConfirm = ["admin", "manager", "encoder"].includes(role);
  const canDelete = role === "admin";
  const isAdmin = role === "admin";
  const canEditOwn = ["encoder", "manager"].includes(role);

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, note, total_money, created_at, created_by, customers(name), order_items(id, item_name_snapshot, quantity, unit_price, line_discount)"
    )
    .eq("status", "quote")
    .order("created_at", { ascending: false });

  const rows: QuoteRow[] = (data ?? []).map((o) => {
    const customer = firstOf(o.customers);
    return {
      id: o.id,
      customerName: customer?.name ?? null,
      note: o.note,
      totalMoney: Number(o.total_money),
      createdAt: o.created_at,
      canEdit: isAdmin || (canEditOwn && o.created_by === user?.id),
      canCancel: isAdmin || (canEditOwn && o.created_by === user?.id),
      items: (o.order_items ?? []).map((it) => ({
        id: it.id,
        name: it.item_name_snapshot ?? "",
        quantity: Number(it.quantity),
        unitPrice: Number(it.unit_price),
        discount: Number(it.line_discount),
      })),
    };
  });

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-(--color-danger)">Failed to load quotes: {error.message}</p>
      )}
      <QuotesTable data={rows} canCreate={canCreate} canConfirm={canConfirm} canDelete={canDelete} />
    </div>
  );
}
