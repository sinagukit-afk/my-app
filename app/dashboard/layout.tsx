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

  const [{ count: purchaseOrdersCount }, { count: receivingCount }, { count: itemsForReviewCount }] =
    await Promise.all([
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
    ]);

  return (
    <AppShell
      userEmail={user.email ?? ""}
      userRole={profile?.role ?? undefined}
      signOutAction={logout}
      navCounts={{
        purchaseOrders: purchaseOrdersCount ?? 0,
        receiving: receivingCount ?? 0,
        itemsForReview: itemsForReviewCount ?? 0,
      }}
    >
      {children}
    </AppShell>
  );
}
