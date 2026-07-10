import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ChartOfAccountsTable, type AccountRow } from "./chart-of-accounts-table";

export default async function ChartOfAccountsPage() {
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
          title="Chart of Accounts"
          description="The full list of accounts used across Journal entries, Fixed Assets, and Product Mapping."
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

  const { data, error } = await supabase
    .from("accounts")
    .select("id, account_number, name, category, description, is_active")
    .order("account_number");

  const rows: AccountRow[] = data ?? [];

  return (
    <div className="space-y-6">
      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load accounts: {error.message}
          </CardContent>
        </Card>
      )}

      <ChartOfAccountsTable data={rows} canWrite={canWrite} />
    </div>
  );
}
