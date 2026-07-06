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

  const { data, error } = await supabase
    .from("quotes")
    .select("id, quote_number, status, quote_date, valid_until, total_money, customers(name)")
    .order("created_at", { ascending: false });

  const { data: logsData } = await supabase
    .from("activity_logs")
    .select("entity_id, description, action, created_at")
    .eq("entity_type", "quote")
    .order("created_at", { ascending: false });

  const lastActivityByQuote = new Map<string, string>();
  for (const log of logsData ?? []) {
    if (log.entity_id && !lastActivityByQuote.has(log.entity_id)) {
      lastActivityByQuote.set(log.entity_id, log.description || log.action);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  const rows: QuoteRow[] = (data ?? []).map((q) => {
    const customer = firstOf(q.customers);
    const effectiveStatus = q.status === "open" && q.valid_until < today ? "expired" : q.status;
    return {
      id: q.id,
      quoteNumber: q.quote_number,
      customerName: customer?.name ?? null,
      status: effectiveStatus,
      quoteDate: q.quote_date,
      validUntil: q.valid_until,
      totalMoney: Number(q.total_money),
      lastActivity: lastActivityByQuote.get(q.id) ?? "—",
    };
  });

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-(--color-danger)">Failed to load quotes: {error.message}</p>
      )}
      <QuotesTable data={rows} canCreate={canCreate} />
    </div>
  );
}
