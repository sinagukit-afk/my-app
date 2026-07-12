import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/business/stat-card";
import { NewExpenseButton } from "./new-expense-button";
import { CategoriesDialogButton } from "./categories-dialog";
import { ExpensesTable, type ExpenseRow } from "./expenses-table";

function peso(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function ExpensesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const hasAccess = ["admin", "manager"].includes(role);
  const canWrite = ["admin", "manager"].includes(role);

  if (!hasAccess) {
    return (
      <div>
        <PageHeader title="Expenses" description="Operating expenses that are not part of inventory." />
        <Card className="max-w-lg">
          <CardContent className="p-4 text-sm text-(--color-text-muted)">
            Finance records are restricted to Admin and Manager roles. Contact an administrator if you need
            access.
          </CardContent>
        </Card>
      </div>
    );
  }

  const [{ data, error }, { data: categories }, { data: suppliers }, { data: accounts }] = await Promise.all([
    supabase
      .from("opex_expenses")
      .select(
        "id, expense_number, description, amount, expense_date, payment_status, source, expense_categories(name), suppliers(name)"
      )
      .is("deleted_at", null)
      .order("expense_date", { ascending: false }),
    supabase.from("expense_categories").select("id, name").eq("is_active", true).order("name"),
    supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
    supabase.from("accounts").select("id, account_number, name").eq("category", "expense").eq("is_active", true).order("account_number"),
  ]);

  const rows: ExpenseRow[] = (data ?? []).map((e) => {
    const category = Array.isArray(e.expense_categories) ? e.expense_categories[0] : e.expense_categories;
    const supplier = Array.isArray(e.suppliers) ? e.suppliers[0] : e.suppliers;
    return {
      id: e.id,
      expense_number: e.expense_number,
      description: e.description,
      amount: Number(e.amount),
      expense_date: e.expense_date,
      payment_status: e.payment_status as ExpenseRow["payment_status"],
      source: e.source as ExpenseRow["source"],
      category_name: category?.name ?? "—",
      supplier_name: supplier?.name ?? null,
    };
  });

  const totalUnpaid = rows.filter((r) => r.payment_status !== "paid").reduce((s, r) => s + r.amount, 0);
  const totalThisMonth = rows
    .filter((r) => r.expense_date.slice(0, 7) === new Date().toISOString().slice(0, 7))
    .reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Operating expenses that are not part of inventory — rent, utilities, supplies, and more."
        actions={
          canWrite ? (
            <div className="flex items-center gap-2">
              <CategoriesDialogButton categories={categories ?? []} accounts={accounts ?? []} />
              <NewExpenseButton categories={categories ?? []} suppliers={suppliers ?? []} />
            </div>
          ) : undefined
        }
      />

      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load expenses: {error.message}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Outstanding (Unpaid + Partial)" value={peso(totalUnpaid)} />
        <StatCard label="This Month" value={peso(totalThisMonth)} />
      </div>

      <ExpensesTable data={rows} canWrite={canWrite} />
    </div>
  );
}
