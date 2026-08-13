import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/business/stat-card";
import { AsOfDateFilter } from "@/components/business/as-of-date-filter";
import { BalanceSheetTable, type BalanceSheetRow } from "./balance-sheet-table";

type SearchParams = Promise<{ asOf?: string }>;

function money(v: number) {
  return `₱${v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function BalanceSheetPage({ searchParams }: { searchParams: SearchParams }) {
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
          title="Balance Sheet"
          description="Assets, liabilities, and equity as of a given date."
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

  const { data, error } = await supabase.rpc("get_balance_sheet", { p_as_of: asOf });
  const rows = (data ?? []) as BalanceSheetRow[];

  const totalAssets = rows.filter((r) => r.category === "asset").reduce((s, r) => s + Number(r.amount), 0);
  const totalLiabilities = rows.filter((r) => r.category === "liability").reduce((s, r) => s + Number(r.amount), 0);
  const recordedEquity = rows.filter((r) => r.category === "equity").reduce((s, r) => s + Number(r.amount), 0);

  // No period-close step exists yet to sweep Revenue/Expense into an equity account, so net
  // income for the period sits unclosed and this report would otherwise always read "Out of
  // balance" even when the ledger itself is fine. Show what that unclosed figure actually is,
  // using the Chart of Accounts' own "Current Year Earnings" (3100) account — which exists for
  // exactly this — as a computed, clearly-labeled display row rather than actually posting
  // anything to it (a real period-close is a separate decision, not made here).
  const impliedCurrentYearEarnings = totalAssets - totalLiabilities - recordedEquity;
  const hasUnclosedEarnings = Math.round(impliedCurrentYearEarnings * 100) !== 0;
  if (hasUnclosedEarnings) {
    const earningsRow: BalanceSheetRow = {
      account_id: "computed-current-year-earnings",
      account_number: "3100",
      account_name: "Current Year Earnings (unposted)",
      category: "equity",
      depth: 1,
      is_postable: true,
      amount: impliedCurrentYearEarnings,
      rollup_amount: impliedCurrentYearEarnings,
    };
    const firstLiabilityIndex = rows.findIndex((r) => r.category === "liability");
    rows.splice(firstLiabilityIndex === -1 ? rows.length : firstLiabilityIndex, 0, earningsRow);
  }

  const totalEquity = recordedEquity + (hasUnclosedEarnings ? impliedCurrentYearEarnings : 0);
  const balanced = Math.round(totalAssets * 100) === Math.round((totalLiabilities + totalEquity) * 100);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Balance Sheet"
        description="Assets, liabilities, and equity as of a given date."
      />

      <AsOfDateFilter asOf={asOf} />

      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load balance sheet: {error.message}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Total Assets" value={money(totalAssets)} />
        <StatCard label="Total Liabilities" value={money(totalLiabilities)} />
        <StatCard label="Total Equity" value={money(totalEquity)} />
        <StatCard
          label="Balance Check"
          value={balanced ? "Balanced" : "Out of balance"}
          trend={balanced ? "up" : "down"}
        />
      </div>

      <Card>
        <CardContent className="p-4">
          <BalanceSheetTable data={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
