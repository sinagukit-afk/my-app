import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { NewAssetPurchaseOrderForm } from "./new-asset-po-form";

export default async function NewAssetPurchaseOrderPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  if (!["admin", "manager"].includes(role)) {
    return (
      <div>
        <PageHeader
          title="New Asset PO"
          description="Request approval to purchase a fixed asset."
          backHref="/dashboard/purchasing/asset-po"
          backLabel="Back to Asset PO"
        />
        <Card className="max-w-lg">
          <CardContent className="p-4 text-sm text-(--color-text-muted)">
            Creating a purchase order is restricted to Admin and Manager roles. Contact an administrator if
            you need access.
          </CardContent>
        </Card>
      </div>
    );
  }

  const [{ data: suppliers }, { data: categories }] = await Promise.all([
    supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
    supabase.from("asset_categories").select("id, name").eq("is_active", true).order("name"),
  ]);

  return (
    <NewAssetPurchaseOrderForm
      suppliers={suppliers ?? []}
      categories={categories ?? []}
    />
  );
}
