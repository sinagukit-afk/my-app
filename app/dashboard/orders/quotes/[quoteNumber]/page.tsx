import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { QuoteDetail, type QuoteDetailData, type ActivityLogRow } from "./quote-detail";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function QuoteDetailPage({ params }: { params: Promise<{ quoteNumber: string }> }) {
  const { quoteNumber } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";

  const { data: quote } = await supabase
    .from("quotes")
    .select(
      "id, quote_number, status, quote_date, valid_until, note, cancellation_reason, cancelled_at, created_by, converted_order_id, converted_at, subtotal, total_discount, total_money, customers(id, name, phone_number, email, address_line1, barangay, city, province), quote_items(id, item_name_snapshot, sku_snapshot, quantity, unit_price, discount_id, line_discount, quote_item_modifiers(name_snapshot, price_snapshot))"
    )
    .eq("quote_number", quoteNumber)
    .single();

  if (!quote) notFound();

  const { data: logsData } = await supabase
    .from("activity_logs")
    .select("id, action, description, created_at, profiles(full_name, email)")
    .eq("entity_type", "quote")
    .eq("entity_id", quote.id)
    .order("created_at", { ascending: false });

  const logs: ActivityLogRow[] = (logsData ?? []).map((l) => {
    const actor = firstOf(l.profiles);
    return {
      id: l.id,
      action: l.action,
      description: l.description ?? "",
      createdAt: l.created_at,
      userName: actor?.full_name ?? actor?.email ?? "System",
    };
  });

  const customer = firstOf(quote.customers);
  const today = new Date().toISOString().slice(0, 10);
  const effectiveStatus = quote.status === "open" && quote.valid_until < today ? "expired" : quote.status;

  const canEdit =
    effectiveStatus === "open" &&
    (role === "admin" || (["encoder", "manager"].includes(role) && quote.created_by === user?.id));
  const canConvert = effectiveStatus === "open" && ["admin", "manager", "encoder"].includes(role);
  const canCancel =
    effectiveStatus === "open" &&
    (role === "admin" || (["encoder", "manager"].includes(role) && quote.created_by === user?.id));

  const data: QuoteDetailData = {
    id: quote.id,
    quoteNumber: quote.quote_number,
    status: quote.status,
    effectiveStatus,
    quoteDate: quote.quote_date,
    validUntil: quote.valid_until,
    note: quote.note,
    cancellationReason: quote.cancellation_reason,
    cancelledAt: quote.cancelled_at,
    convertedOrderId: quote.converted_order_id,
    convertedAt: quote.converted_at,
    subtotal: Number(quote.subtotal),
    totalDiscount: Number(quote.total_discount),
    totalMoney: Number(quote.total_money),
    customerName: customer?.name ?? null,
    customerPhone: customer?.phone_number ?? null,
    customerEmail: customer?.email ?? null,
    customerAddress:
      [customer?.address_line1, customer?.barangay, customer?.city, customer?.province].filter(Boolean).join(", ") ||
      null,
    items: (quote.quote_items ?? []).map((it) => ({
      id: it.id,
      name: it.item_name_snapshot ?? "",
      sku: it.sku_snapshot,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unit_price),
      discount: Number(it.line_discount),
      modifiers: (it.quote_item_modifiers ?? []).map((m) => ({ name: m.name_snapshot ?? "", price: Number(m.price_snapshot) })),
    })),
    canEdit,
    canConvert,
    canCancel,
  };

  return (
    <div className="space-y-6">
      <QuoteDetail data={data} logs={logs} />
    </div>
  );
}
