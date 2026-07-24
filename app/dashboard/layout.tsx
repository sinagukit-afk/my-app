import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { logout } from "@/app/logout/actions";

function arrayOf<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const today = new Date().toISOString().slice(0, 10);

  const [
    { count: purchaseOrdersCount },
    { count: receivingCount },
    { count: expensePOsCount },
    { count: assetPOsCount },
    { count: itemsForReviewCount },
    { count: ordersActiveCount },
    { count: ordersQuotationCount },
    { count: ordersConfirmedCount },
    { count: ordersOnHoldCount },
    { count: ordersProductionCount },
    { count: shipmentsNotDeliveredCount },
    { count: ordersReadyForShippingCount },
    { data: paymentOrders },
    { count: accountingReviewCount },
    { count: expensePayableCount },
    { count: assetPayableCount },
    { count: manualIncomingPayableCount },
    { count: inventoryPoPayableCount },
    { count: prepaidDueCount },
    { data: dueDepreciationAssets },
    { data: depreciationEntries },
    { data: trackedStockData },
    { count: webQuoteRequestsCount },
  ] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select("id", { count: "exact", head: true })
      .eq("po_type", "inventory")
      .in("status", ["draft", "sent", "partial"]),
    supabase
      .from("purchase_orders")
      .select("id", { count: "exact", head: true })
      .eq("po_type", "inventory")
      .in("status", ["sent", "partial"]),
    supabase
      .from("purchase_orders")
      .select("id", { count: "exact", head: true })
      .eq("po_type", "expense")
      .in("status", ["draft", "sent", "partial"]),
    supabase
      .from("purchase_orders")
      .select("id", { count: "exact", head: true })
      .eq("po_type", "asset")
      .in("status", ["draft", "sent", "partial"]),
    supabase
      .from("inventory_levels")
      .select("id", { count: "exact", head: true })
      .gt("on_hold_qty", 0),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in("status", [
        "confirmed",
        "in_production",
        "partially_completed",
        "production_completed",
        "ready_for_shipping",
        "shipped",
        "on_hold",
      ]),
    supabase
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .eq("status", "open")
      .gte("valid_until", today),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "confirmed"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "on_hold"),
    supabase
      .from("production_orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["not_started", "wip", "partially_completed"]),
    supabase
      .from("order_shipments")
      .select("id", { count: "exact", head: true })
      .neq("status", "delivered"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "ready_for_shipping"),
    supabase
      .from("orders")
      .select("total_money, order_payments(amount)")
      .neq("status", "cancelled"),
    supabase
      .from("journal_entry_drafts")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_review"),
    supabase
      .from("opex_expenses")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .in("payment_status", ["unpaid", "partial"]),
    supabase
      .from("fixed_assets")
      .select("id", { count: "exact", head: true })
      .in("payment_status", ["unpaid", "partial"]),
    supabase
      .from("incoming_items")
      .select("id", { count: "exact", head: true })
      .is("purchase_order_id", null)
      .in("payment_status", ["unpaid", "partial"]),
    supabase
      .from("purchase_orders")
      .select("id", { count: "exact", head: true })
      .eq("po_type", "inventory")
      .in("status", ["partial", "received"])
      .in("payment_status", ["unpaid", "partial"]),
    supabase
      .from("prepaid_expense_schedules")
      .select("id", { count: "exact", head: true })
      .eq("schedule_status", "active")
      .lte("next_posting_date", today),
    supabase
      .from("fixed_assets")
      .select("id, cost, salvage_value, purchased_date")
      .eq("schedule_status", "active")
      .is("disposed_at", null),
    supabase.from("depreciation_entries").select("fixed_asset_id, amount, period_month"),
    supabase
      .from("items")
      .select("item_variants(deleted_at, inventory_levels(available_qty, low_stock_threshold))")
      .eq("track_stock", true)
      .is("deleted_at", null)
      .is("item_variants.deleted_at", null),
    supabase
      .from("web_quote_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),
  ]);

  const ordersShippingCount = (shipmentsNotDeliveredCount ?? 0) + (ordersReadyForShippingCount ?? 0);

  const ordersPaymentCount = (paymentOrders ?? []).filter((o) => {
    const totalPaid = (o.order_payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
    return totalPaid !== Number(o.total_money);
  }).length;

  const supplierPaymentCount =
    (expensePayableCount ?? 0) +
    (assetPayableCount ?? 0) +
    (manualIncomingPayableCount ?? 0) +
    (inventoryPoPayableCount ?? 0);

  // Mirrors the "next posting date" derivation on the Expense Schedule page: an
  // asset with no depreciation posted yet is due starting the month it was
  // purchased; otherwise it's due the month after its last posted entry.
  const accumByAsset = new Map<string, number>();
  const lastPeriodByAsset = new Map<string, string>();
  for (const e of depreciationEntries ?? []) {
    accumByAsset.set(e.fixed_asset_id, (accumByAsset.get(e.fixed_asset_id) ?? 0) + Number(e.amount));
    const prev = lastPeriodByAsset.get(e.fixed_asset_id);
    if (!prev || e.period_month > prev) lastPeriodByAsset.set(e.fixed_asset_id, e.period_month);
  }
  function nextMonthAfter(dateStr: string): string {
    const d = new Date(dateStr);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
  }
  const dueDepreciationCount = (dueDepreciationAssets ?? []).filter((a) => {
    const remaining = Number(a.cost) - Number(a.salvage_value ?? 0) - (accumByAsset.get(a.id) ?? 0);
    if (remaining <= 0) return false;
    const lastPeriod = lastPeriodByAsset.get(a.id);
    const nextPosting = lastPeriod ? nextMonthAfter(lastPeriod) : a.purchased_date.slice(0, 8) + "01";
    return nextPosting <= today;
  }).length;

  const expenseScheduleDueCount = (prepaidDueCount ?? 0) + dueDepreciationCount;

  // Mirrors getStockStatus() on the Inventory Monitoring page: a row needs attention
  // once available stock hits zero (out) or drops to/below its minimum threshold (low).
  const inventoryAttentionCount = (trackedStockData ?? []).reduce((count, item) => {
    for (const variant of arrayOf(item.item_variants).filter((v) => !v.deleted_at)) {
      for (const level of arrayOf(variant.inventory_levels)) {
        const available = Number(level.available_qty);
        const threshold = level.low_stock_threshold != null ? Number(level.low_stock_threshold) : null;
        if (available <= 0 || (threshold != null && available <= threshold)) count++;
      }
    }
    return count;
  }, 0);

  return (
    <AppShell
      userEmail={user.email ?? ""}
      userRole={profile?.role ?? undefined}
      signOutAction={logout}
      navCounts={{
        purchaseOrders: purchaseOrdersCount ?? 0,
        receiving: receivingCount ?? 0,
        expensePOs: expensePOsCount ?? 0,
        assetPOs: assetPOsCount ?? 0,
        itemsForReview: itemsForReviewCount ?? 0,
        ordersActive: ordersActiveCount ?? 0,
        ordersQuotation: ordersQuotationCount ?? 0,
        ordersConfirmed: ordersConfirmedCount ?? 0,
        ordersOnHold: ordersOnHoldCount ?? 0,
        ordersProduction: ordersProductionCount ?? 0,
        ordersShipping: ordersShippingCount ?? 0,
        ordersPayment: ordersPaymentCount,
        supplierPayment: supplierPaymentCount,
        expenseScheduleDue: expenseScheduleDueCount,
        accountingReview: accountingReviewCount ?? 0,
        inventoryAttention: inventoryAttentionCount,
        webQuoteRequests: webQuoteRequestsCount ?? 0,
      }}
    >
      {children}
    </AppShell>
  );
}
