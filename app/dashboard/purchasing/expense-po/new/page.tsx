import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { NewExpensePurchaseOrderForm } from "./new-expense-po-form";

export default async function NewExpensePurchaseOrderPage() {
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
        <PageHeader title="New Expense PO" description="Request approval to purchase an operating expense." />
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
    supabase.from("expense_categories").select("id, name").eq("is_active", true).order("name"),
  ]);

  return (
    <NewExpensePurchaseOrderForm
      suppliers={suppliers ?? []}
      categories={categories ?? []}
    />
  );
}
