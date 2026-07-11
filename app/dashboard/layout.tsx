import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { logout } from "@/app/logout/actions";

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
  ] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["draft", "sent", "partial"]),
    supabase
      .from("purchase_orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["sent", "partial"]),
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
  ]);

  const ordersShippingCount = (shipmentsNotDeliveredCount ?? 0) + (ordersReadyForShippingCount ?? 0);

  const ordersPaymentCount = (paymentOrders ?? []).filter((o) => {
    const totalPaid = (o.order_payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
    return totalPaid !== Number(o.total_money);
  }).length;

  return (
    <AppShell
      userEmail={user.email ?? ""}
      userRole={profile?.role ?? undefined}
      signOutAction={logout}
      navCounts={{
        purchaseOrders: purchaseOrdersCount ?? 0,
        receiving: receivingCount ?? 0,
        itemsForReview: itemsForReviewCount ?? 0,
        ordersActive: ordersActiveCount ?? 0,
        ordersQuotation: ordersQuotationCount ?? 0,
        ordersConfirmed: ordersConfirmedCount ?? 0,
        ordersOnHold: ordersOnHoldCount ?? 0,
        ordersProduction: ordersProductionCount ?? 0,
        ordersShipping: ordersShippingCount ?? 0,
        ordersPayment: ordersPaymentCount,
        accountingReview: accountingReviewCount ?? 0,
      }}
    >
      {children}
    </AppShell>
  );
}
