import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { accountOptionLabel } from "@/lib/accounting/account-options";
import { BankAccountsTable, type BankAccountRow } from "./bank-accounts-table";

export default async function BankAccountsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const hasAccess = ["admin", "manager"].includes(role);
  const canWrite = role === "admin";

  if (!hasAccess) {
    return (
      <div>
        <PageHeader
          title="Bank Accounts"
          description="Real bank/wallet/credit card accounts, each linked to a Chart of Accounts account."
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

  const [{ data: bankAccounts, error }, { data: glAccounts }] = await Promise.all([
    supabase
      .from("bank_accounts")
      .select("id, name, bank, type, account_number_masked, gl_account_id, currency, is_active, accounts(account_number, name)")
      .order("name"),
    supabase
      .from("accounts")
      .select("id, account_number, name, is_postable, category")
      .in("category", ["asset", "liability"])
      .eq("is_active", true)
      .order("account_number"),
  ]);

  const rows: BankAccountRow[] = (bankAccounts ?? []).map((b) => {
    const gl = Array.isArray(b.accounts) ? b.accounts[0] : b.accounts;
    return {
      id: b.id,
      name: b.name,
      bank: b.bank,
      type: b.type,
      account_number_masked: b.account_number_masked,
      gl_account_id: b.gl_account_id,
      gl_account_label: gl ? `${gl.account_number} — ${gl.name}` : "—",
      currency: b.currency,
      is_active: b.is_active,
    };
  });

  const glAccountOptions = (glAccounts ?? []).map((a) => ({
    value: a.id,
    label: accountOptionLabel(a),
    is_postable: a.is_postable,
    category: a.category as "asset" | "liability",
  }));

  return (
    <div className="space-y-6">
      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load bank accounts: {error.message}
          </CardContent>
        </Card>
      )}

      <BankAccountsTable data={rows} glAccountOptions={glAccountOptions} canWrite={canWrite} />
    </div>
  );
}
