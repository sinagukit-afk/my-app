import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/business/stat-card";
import { DateRangeFilter } from "@/components/business/date-range-filter";
import { CashFlowTable, type CashFlowRow } from "./cash-flow-table";

type SearchParams = Promise<{ from?: string; to?: string }>;

function money(v: number) {
  return `₱${v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type EntryLineRow = { debit: number; credit: number; memo: string | null; account_id: string };
type EntryRow = {
  entry_date: string;
  description: string;
  journal_entry_lines: EntryLineRow | EntryLineRow[] | null;
};

export default async function CashFlowPage({ searchParams }: { searchParams: SearchParams }) {
  const { from = "", to = "" } = await searchParams;

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
          title="Cash Flow"
          description="Monitor money moving in and out of the business over time."
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

  // Cash accounts = every bank/wallet account (not credit cards, those are a payable, not
  // cash) plus Cash on hand (1010, physical till cash — not in bank_accounts since it isn't
  // a bank/wallet). Same source of truth the Payment Methods / Bank Accounts settings pages
  // use for "which GL account does this actually post to."
  const [{ data: bankAccountRows }, { data: cashOnHand }] = await Promise.all([
    supabase.from("bank_accounts").select("gl_account_id, type").neq("type", "credit_card"),
    supabase.from("accounts").select("id").eq("account_number", "1010").maybeSingle(),
  ]);
  const cashAccountIds = new Set<string>(
    (bankAccountRows ?? []).map((r) => r.gl_account_id).filter((id): id is string => Boolean(id))
  );
  if (cashOnHand?.id) cashAccountIds.add(cashOnHand.id);

  let entriesQuery = supabase
    .from("journal_entries")
    .select("entry_date, description, journal_entry_lines(debit, credit, memo, account_id)");
  if (from) entriesQuery = entriesQuery.gte("entry_date", from);
  if (to) entriesQuery = entriesQuery.lte("entry_date", to);

  const { data: entryRows, error: entriesError } = await entriesQuery
    .order("entry_date")
    .returns<EntryRow[]>();

  const cashLines: { date: string; type: "in" | "out"; category: string; amount: number; note: string | null }[] = [];
  for (const entry of entryRows ?? []) {
    const lines = Array.isArray(entry.journal_entry_lines)
      ? entry.journal_entry_lines
      : entry.journal_entry_lines
        ? [entry.journal_entry_lines]
        : [];
    for (const line of lines) {
      if (!cashAccountIds.has(line.account_id)) continue;
      const debit = Number(line.debit);
      const credit = Number(line.credit);
      if (debit > 0) {
        cashLines.push({ date: entry.entry_date, type: "in", category: entry.description, amount: debit, note: line.memo });
      } else if (credit > 0) {
        cashLines.push({ date: entry.entry_date, type: "out", category: entry.description, amount: credit, note: line.memo });
      }
    }
  }

  const totalIn = cashLines.filter((l) => l.type === "in").reduce((sum, l) => sum + l.amount, 0);
  const totalOut = cashLines.filter((l) => l.type === "out").reduce((sum, l) => sum + l.amount, 0);
  const net = totalIn - totalOut;

  const timeline: CashFlowRow[] = [...cashLines]
    .sort((a, b) => a.date.localeCompare(b.date))
    .reduce<CashFlowRow[]>((rows, entry) => {
      const prevBalance = rows.length ? rows[rows.length - 1].balance : 0;
      const balance = entry.type === "in" ? prevBalance + entry.amount : prevBalance - entry.amount;
      rows.push({ ...entry, balance });
      return rows;
    }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cash Flow"
        description="Monitor money moving in and out of the business over time."
      />

      <DateRangeFilter from={from} to={to} />

      {entriesError && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load cash flow data: {entriesError.message}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Inflow" value={money(totalIn)} trend="up" />
        <StatCard label="Total Outflow" value={money(totalOut)} trend="down" />
        <StatCard
          label="Net Cash Flow"
          value={money(net)}
          trend={net >= 0 ? "up" : "down"}
          delta={net >= 0 ? "Positive" : "Negative"}
        />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-(--color-text)">Timeline</h2>
            <Badge variant="neutral">{timeline.length} entries</Badge>
          </div>
          <CashFlowTable data={timeline} />
        </CardContent>
      </Card>
    </div>
  );
}
