import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PaymentMethodsTable, type PaymentMappingRow } from "./payment-methods-table";

export default async function PaymentMethodsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const hasAccess = ["admin", "manager"].includes(role);
  const canEdit = role === "admin";

  if (!hasAccess) {
    return (
      <div>
        <PageHeader
          title="Payment Methods"
          description="Map each payment type to the GL account it posts to when Accounting auto-posts from Sales/Purchasing events."
        />
        <Card className="max-w-lg">
          <CardContent className="p-4 text-sm text-(--color-text-muted)">
            Accounting records are restricted to Admin and Manager roles. Contact an administrator if you
            need access.
          </CardContent>
        </Card>
      </div>
    );
  }

  const [{ data: paymentTypes }, { data: mappings }, { data: accounts }, { data: bankAccounts }] =
    await Promise.all([
      supabase.from("payment_types").select("id, name").eq("is_active", true).order("name"),
      supabase.from("payment_type_accounting_mappings").select("payment_type_id, account_id, bank_account_id"),
      supabase
        .from("accounts")
        .select("id, account_number, name, is_postable")
        .eq("category", "asset")
        .eq("is_active", true)
        .order("account_number"),
      supabase.from("bank_accounts").select("id, name, bank").eq("is_active", true).order("name"),
    ]);

  const mappingByPaymentType = new Map((mappings ?? []).map((m) => [m.payment_type_id, m]));

  const rows: PaymentMappingRow[] = (paymentTypes ?? []).map((pt) => {
    const m = mappingByPaymentType.get(pt.id);
    return {
      payment_type_id: pt.id,
      payment_type_name: pt.name,
      account_id: m?.account_id ?? "",
      bank_account_id: m?.bank_account_id ?? "",
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Methods"
        description="Map each payment type to the GL account it posts to when Accounting auto-posts from Sales/Purchasing events."
      />
      <Card>
        <CardContent className="p-4">
          <PaymentMethodsTable
            rows={rows}
            accounts={accounts ?? []}
            bankAccounts={bankAccounts ?? []}
            canEdit={canEdit}
          />
        </CardContent>
      </Card>
    </div>
  );
}
