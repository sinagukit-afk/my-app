import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { CategoryMappingTable, type AccountOption } from "./category-mapping-table";

export default async function CategoryMappingPage() {
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
          title="Category Mapping"
          description="Map expense and asset categories to the Chart of Accounts used for automatic posting."
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

  const [{ data: expenseCategories }, { data: assetCategories }, { data: accounts }] = await Promise.all([
    supabase
      .from("expense_categories")
      .select("id, name, default_expense_account_id")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("asset_categories")
      .select(
        "id, name, default_asset_account_id, default_accum_depreciation_account_id, default_depreciation_expense_account_id, default_useful_life_months"
      )
      .eq("is_active", true)
      .order("name"),
    supabase.from("accounts").select("id, account_number, name, category").eq("is_active", true).order("account_number"),
  ]);

  const accountOptions: AccountOption[] = accounts ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Category Mapping"
        description="Map Expense PO / Asset PO categories to the Chart of Accounts used when Accounting auto-posts (Purchasing → Finance)."
      />
      <CategoryMappingTable
        expenseCategories={(expenseCategories ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          default_expense_account_id: c.default_expense_account_id ?? "",
        }))}
        assetCategories={(assetCategories ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          default_asset_account_id: c.default_asset_account_id ?? "",
          default_accum_depreciation_account_id: c.default_accum_depreciation_account_id ?? "",
          default_depreciation_expense_account_id: c.default_depreciation_expense_account_id ?? "",
          default_useful_life_months: c.default_useful_life_months,
        }))}
        accounts={accountOptions}
        canEdit={canEdit}
      />
    </div>
  );
}
