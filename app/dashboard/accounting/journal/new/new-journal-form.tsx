"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { postJournalEntry, type JournalLineInput } from "../actions";

export type AccountOption = {
  account_number: string;
  name: string;
  category: string;
};

type LineRow = {
  rowId: string;
  accountNumber: string; // account_number, e.g. "SCA-1000"
  debit: string;
  credit: string;
  memo: string;
};

function emptyRow(): LineRow {
  return { rowId: crypto.randomUUID(), accountNumber: "", debit: "", credit: "", memo: "" };
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function peso(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type Props = {
  accounts: AccountOption[];
};

export function NewJournalForm({ accounts }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Start with two blank lines — a journal entry always needs at least two.
  const [rows, setRows] = useState<LineRow[]>([emptyRow(), emptyRow()]);

  const accountOptions = useMemo(
    () => accounts.map((a) => ({ value: a.account_number, label: `${a.account_number} — ${a.name}` })),
    [accounts]
  );

  function updateRow(rowId: string, patch: Partial<LineRow>) {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(rowId: string) {
    setRows((prev) => (prev.length > 2 ? prev.filter((r) => r.rowId !== rowId) : prev));
  }

  const totalDebit = useMemo(() => rows.reduce((s, r) => s + (Number(r.debit) || 0), 0), [rows]);
  const totalCredit = useMemo(() => rows.reduce((s, r) => s + (Number(r.credit) || 0), 0), [rows]);
  // Compare in integer centavos to avoid float drift, mirroring the RPC's round(...,2) check.
  const difference = Math.round(totalDebit * 100) - Math.round(totalCredit * 100);
  const balanced = difference === 0 && Math.round(totalDebit * 100) > 0;

  const filledLines = rows.filter(
    (r) => r.accountNumber && ((Number(r.debit) || 0) > 0 || (Number(r.credit) || 0) > 0)
  );
  const canSubmit = balanced && filledLines.length >= 2 && !isPending;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const lines: JournalLineInput[] = filledLines.map((r) => ({
      account_number: r.accountNumber,
      debit: Number(r.debit) || 0,
      credit: Number(r.credit) || 0,
      memo: r.memo.trim() || null,
    }));

    // Guard against a line carrying amounts on both sides — the DB CHECK rejects
    // it too, but catch it here with a clearer message before the round-trip.
    const twoSided = lines.find((l) => l.debit > 0 && l.credit > 0);
    if (twoSided) {
      alert(`Account ${twoSided.account_number} has both a debit and a credit — each line takes one or the other.`);
      return;
    }

    const formData = new FormData(e.currentTarget);
    formData.set("lines_json", JSON.stringify(lines));

    startTransition(async () => {
      const res = await postJournalEntry(formData);
      if (res.success) {
        router.push(`/dashboard/accounting/journal/${res.id}`);
      } else {
        alert(res.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PageHeader
        title="New Journal Entry"
        description="Record a balanced double-entry transaction. Debits must equal credits before you can post."
      />

      <Card>
        <CardHeader>
          <CardTitle>Entry Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[200px_1fr]">
            <Input label="Entry Date" name="entry_date" type="date" defaultValue={todayISO()} required />
            <Input label="Description" name="description" placeholder="e.g. Owner's capital contribution" required />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lines</CardTitle>
          <CardDescription>
            Pick an account and enter an amount in either the Debit or the Credit column — not both.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.map((row, i) => (
            <div
              key={row.rowId}
              className="grid grid-cols-1 gap-3 border-b border-(--color-border) pb-4 last:border-0 sm:grid-cols-[2fr_1fr_1fr_2fr_auto] sm:items-end"
            >
              <Select
                label={i === 0 ? "Account" : undefined}
                value={row.accountNumber}
                onChange={(e) => updateRow(row.rowId, { accountNumber: e.target.value })}
                placeholder="Select an account…"
                options={accountOptions}
              />
              <CurrencyInput
                label={i === 0 ? "Debit" : undefined}
                value={row.debit}
                // Entering a debit clears any credit on the same line, so a line is always one-sided.
                onChange={(e) => updateRow(row.rowId, { debit: e.target.value, credit: e.target.value ? "" : row.credit })}
              />
              <CurrencyInput
                label={i === 0 ? "Credit" : undefined}
                value={row.credit}
                onChange={(e) => updateRow(row.rowId, { credit: e.target.value, debit: e.target.value ? "" : row.debit })}
              />
              <Input
                label={i === 0 ? "Memo" : undefined}
                value={row.memo}
                onChange={(e) => updateRow(row.rowId, { memo: e.target.value })}
                placeholder="Optional"
              />
              <Button
                type="button"
                variant="ghost"
                className="text-(--color-danger)"
                disabled={rows.length <= 2}
                onClick={() => removeRow(row.rowId)}
              >
                Remove
              </Button>
            </div>
          ))}
          <Button type="button" variant="secondary" onClick={addRow}>
            Add Line
          </Button>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-2 border-t border-(--color-border) pt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-(--color-text-muted)">Total Debits</span>
            <span className="font-medium text-(--color-text)">{peso(totalDebit)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-(--color-text-muted)">Total Credits</span>
            <span className="font-medium text-(--color-text)">{peso(totalCredit)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-(--color-text-muted)">Difference</span>
            <span
              className={cn(
                "font-semibold",
                balanced ? "text-(--color-success)" : "text-(--color-danger)"
              )}
            >
              {peso(difference / 100)}
            </span>
          </div>
          <div className="pt-1">
            {balanced ? (
              <p className="text-xs text-(--color-success)">Balanced — ready to post.</p>
            ) : (
              <p className="text-xs text-(--color-text-muted)">
                Entry must balance (debits = credits, greater than zero) before it can be posted.
              </p>
            )}
          </div>
        </CardFooter>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => router.push("/dashboard/accounting/journal")} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {isPending ? "Posting…" : "Post Entry"}
        </Button>
      </div>
    </form>
  );
}
