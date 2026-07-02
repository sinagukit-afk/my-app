import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { IncomeTable, type IncomeRow } from "./income-table";

export default async function IncomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const hasAccess = ["admin", "manager"].includes(role);

  if (!hasAccess) {
    return (
      <div>
        <PageHeader
          title="Income"
          description="Track all revenue streams and incoming payments."
        />
        <Card className="max-w-lg">
          <CardContent className="p-4 text-sm text-(--color-text-muted)">
            Finance records are restricted to Admin and Manager roles. Contact an
            administrator if you need access.
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data, error } = await supabase
    .from("income")
    .select("id, date, category, amount, note")
    .is("deleted_at", null)
    .order("date", { ascending: false });

  const rows: IncomeRow[] = data ?? [];

  return (
    <div className="space-y-6">
      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load income: {error.message}
          </CardContent>
        </Card>
      )}

      <IncomeTable data={rows} />
    </div>
  );
}
