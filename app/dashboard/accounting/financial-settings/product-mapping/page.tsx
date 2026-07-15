import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ProductMappingTable, type AccountOption, type MappingRow } from "./product-mapping-table";
import { CategoryDefaultsTable, type CategoryDefaultRow } from "./category-defaults-table";

export default async function ProductMappingPage() {
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
          title="Product Account Mapping"
          description="Map items to the Chart of Accounts used for automatic posting."
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

  const [{ data: items }, { data: categories }, { data: mappings }, { data: accounts }] = await Promise.all([
    supabase.from("items").select("id, name, item_type, category_id").is("deleted_at", null).order("name"),
    supabase
      .from("categories")
      .select("id, name, default_revenue_account_id, default_inventory_account_id, default_expense_account_id")
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("item_accounting_mappings")
      .select("item_id, revenue_account_id, inventory_account_id, expense_account_id"),
    supabase
      .from("accounts")
      .select("id, account_number, name, category")
      .eq("is_active", true)
      .order("account_number"),
  ]);

  const categoryNameById = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const mappingByItem = new Map((mappings ?? []).map((m) => [m.item_id, m]));

  const rows: MappingRow[] = (items ?? []).map((i) => {
    const m = mappingByItem.get(i.id);
    return {
      item_id: i.id,
      item_name: i.name,
      category_name: (i.category_id && categoryNameById.get(i.category_id)) || "Uncategorized",
      item_type: i.item_type,
      revenue_account_id: m?.revenue_account_id ?? "",
      inventory_account_id: m?.inventory_account_id ?? "",
      expense_account_id: m?.expense_account_id ?? "",
    };
  });

  const categoryDefaultRows: CategoryDefaultRow[] = (categories ?? []).map((c) => ({
    category_id: c.id,
    category_name: c.name,
    default_revenue_account_id: c.default_revenue_account_id ?? "",
    default_inventory_account_id: c.default_inventory_account_id ?? "",
    default_expense_account_id: c.default_expense_account_id ?? "",
  }));

  const accountOptions: AccountOption[] = accounts ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Account Mapping"
        description="Map each item to the Sales Revenue, Inventory, and COGS/Expense accounts used when Accounting auto-posts from operational events (ACCT-7)."
      />
      <Card>
        <CardContent className="space-y-3 p-4">
          <h3 className="text-sm font-semibold text-(--color-text)">Category Defaults</h3>
          <CategoryDefaultsTable rows={categoryDefaultRows} accounts={accountOptions} canEdit={canEdit} />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <ProductMappingTable rows={rows} accounts={accountOptions} canEdit={canEdit} />
        </CardContent>
      </Card>
    </div>
  );
}
