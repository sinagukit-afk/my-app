import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReverseEntryButton } from "./reverse-entry-button";
import { formatDate } from "@/lib/utils/format-date";

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  order: "Order",
  purchase_order: "Purchase Order",
  depreciation: "Depreciation",
  opening_balance: "Opening Balance",
  sale_recognized: "Sale Recognized",
  cogs: "COGS",
  purchase_received: "Purchase Received",
  manual_incoming: "Manual Incoming",
  inventory_adjustment_gain: "Inventory Adjustment (Gain)",
  inventory_adjustment_loss: "Inventory Adjustment (Loss)",
  reversal: "Reversal",
  credit_card_installment_payment: "Credit Card Installment Payment",
  expense_recorded: "Expense Recorded",
  asset_acquired: "Asset Acquired",
  expense_payment: "Expense Payment",
  asset_payment: "Asset Payment",
};

function peso(n: number) {
  return `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
      "id, journal_number, entry_date, description, source_type, source_id, created_at, journal_entry_lines(id, debit, credit, memo, line_order, accounts(account_number, name))"
    )
    .eq("id", id)
    .single();

  if (!entry) notFound();

  const [{ data: reversedBy }, { data: reverses }] = await Promise.all([
    supabase
      .from("journal_entries")
      .select("id, description")
      .eq("source_type", "reversal")
      .eq("source_id", id)
      .maybeSingle(),
    entry.source_type === "reversal" && entry.source_id
      ? supabase.from("journal_entries").select("id, description").eq("id", entry.source_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const lines = ((entry.journal_entry_lines ?? []) as {
    id: string;
    debit: number;
    credit: number;
    memo: string | null;
    line_order: number;
    // One-to-one embed still types as T | T[]; normalize below.
    accounts: { account_number: string; name: string } | { account_number: string; name: string }[] | null;
  }[])
    .slice()
    .sort((a, b) => a.line_order - b.line_order);

  const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Journal Entry — ${entry.journal_number}`}
        description={entry.description}
        backHref="/dashboard/accounting/journal"
        backLabel="Back to Journal"
        actions={
          hasAccess && !reversedBy && entry.source_type !== "reversal" && (
            <ReverseEntryButton entryId={entry.id} />
          )
        }
      />

      <Card className="max-w-xl">
        <CardContent className="grid grid-cols-1 gap-4 p-6 text-sm sm:grid-cols-2">
          <div>
            <p className="text-(--color-text-muted)">Journal No.</p>
            <p className="font-mono font-medium text-(--color-text)">{entry.journal_number}</p>
          </div>
          <div>
            <p className="text-(--color-text-muted)">Date</p>
            <p className="font-medium text-(--color-text)">
              {formatDate(entry.entry_date)}
            </p>
          </div>
          <div>
            <p className="text-(--color-text-muted)">Source</p>
            <p>
              <Badge variant="neutral">{SOURCE_LABELS[entry.source_type] ?? entry.source_type}</Badge>
            </p>
          </div>
          {reverses && (
            <div className="sm:col-span-2">
              <p className="text-(--color-text-muted)">Reverses</p>
              <Link
                href={`/dashboard/accounting/journal/${reverses.id}`}
                className="text-sm font-medium text-(--color-primary) hover:underline"
              >
                {reverses.description} →
              </Link>
            </div>
          )}
          {reversedBy && (
            <div className="sm:col-span-2">
              <p className="text-(--color-text-muted)">Reversed by</p>
              <Link
                href={`/dashboard/accounting/journal/${reversedBy.id}`}
                className="text-sm font-medium text-(--color-primary) hover:underline"
              >
                {reversedBy.description} →
              </Link>
            </div>
          )}
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
