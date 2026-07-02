import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  order: "Order",
  purchase_order: "Purchase Order",
  depreciation: "Depreciation",
  opening_balance: "Opening Balance",
};

function peso(n: number) {
  return `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}

export default async function JournalEntryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const hasAccess = ["admin", "manager"].includes(role);

  if (!hasAccess) redirect("/dashboard/accounting/journal");

  const { data: entry } = await supabase
    .from("journal_entries")
    .select(
      "id, entry_date, description, source_type, created_at, journal_entry_lines(id, debit, credit, memo, line_order, accounts(account_number, name))"
    )
    .eq("id", id)
    .single();

  if (!entry) notFound();

  const lines = ((entry.journal_entry_lines ?? []) as {
    id: string;
    debit: number;
    credit: number;
    memo: string | null;
    line_order: number;
    // One-to-one embed still types as T | T[]; normalize below.
    accounts: { account_number: number; name: string } | { account_number: number; name: string }[] | null;
  }[])
    .slice()
    .sort((a, b) => a.line_order - b.line_order);

  const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journal Entry"
        description={entry.description}
        actions={
          <Link href="/dashboard/accounting/journal">
            <Button variant="secondary">Back to Journal</Button>
          </Link>
        }
      />

      <Card className="max-w-xl">
        <CardContent className="grid grid-cols-2 gap-4 p-6 text-sm">
          <div>
            <p className="text-(--color-text-muted)">Date</p>
            <p className="font-medium text-(--color-text)">
              {new Date(entry.entry_date).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div>
            <p className="text-(--color-text-muted)">Source</p>
            <p>
              <Badge variant="neutral">{SOURCE_LABELS[entry.source_type] ?? entry.source_type}</Badge>
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lines</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-(--color-border) bg-(--color-bg)">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">Account</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">Memo</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">Debit</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">Credit</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const acct = Array.isArray(l.accounts) ? l.accounts[0] : l.accounts;
                  return (
                    <tr key={l.id} className="border-b border-(--color-border) last:border-0">
                      <td className="px-4 py-3 text-(--color-text)">
                        {acct ? `${acct.account_number} — ${acct.name}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-(--color-text-muted)">{l.memo || "—"}</td>
                      <td className="px-4 py-3 text-right text-(--color-text)">
                        {Number(l.debit) > 0 ? peso(l.debit) : ""}
                      </td>
                      <td className="px-4 py-3 text-right text-(--color-text)">
                        {Number(l.credit) > 0 ? peso(l.credit) : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-(--color-border) bg-(--color-bg) font-semibold">
                  <td className="px-4 py-3 text-(--color-text)" colSpan={2}>Total</td>
                  <td className="px-4 py-3 text-right text-(--color-text)">{peso(totalDebit)}</td>
                  <td className="px-4 py-3 text-right text-(--color-text)">{peso(totalCredit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
