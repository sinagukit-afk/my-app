import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/business/stat-card";
import { AsOfDateFilter } from "@/components/business/as-of-date-filter";
import { TrialBalanceTable, type TrialBalanceRow } from "./trial-balance-table";

type SearchParams = Promise<{ asOf?: string }>;

function money(v: number) {
  return `₱${v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function TrialBalancePage({ searchParams }: { searchParams: SearchParams }) {
  const { asOf = new Date().toISOString().slice(0, 10) } = await searchParams;

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
          title="Trial Balance"
          description="Every account's net debit or credit balance as of a given date."
        />
        <Card className="max-w-lg">
          <CardContent className="p-4 text-sm text-(--color-text-muted)">
            Accounting records are restricted to Admin and Manager roles. Contact an
            administrator if you need access.
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data, error } = await supabase.rpc("get_trial_balance", { p_as_of: asOf });
  const rows = (data ?? []) as TrialBalanceRow[];

  const totalDebit = rows.reduce((s, r) => s + Number(r.debit_balance), 0);
  const totalCredit = rows.reduce((s, r) => s + Number(r.credit_balance), 0);
  const balanced = Math.round(totalDebit * 100) === Math.round(totalCredit * 100);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trial Balance"
        description="Every account's net debit or credit balance as of a given date."
      />

      <AsOfDateFilter asOf={asOf} />

      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load trial balance: {error.message}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Debits" value={money(totalDebit)} />
        <StatCard label="Total Credits" value={money(totalCredit)} />
        <StatCard
          label="Ledger Check"
          value={balanced ? "Balanced" : "Out of balance"}
          trend={balanced ? "up" : "down"}
        />
      </div>

      <Card>
        <CardContent className="p-4">
          <TrialBalanceTable data={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
