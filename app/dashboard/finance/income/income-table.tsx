"use client";

// DEPRECATED (ACCT-3): the `income` table is retired in favour of double-entry
// `journal_entries`. This screen is now read-only historical reference — new
// revenue is recorded via the Accounting → Journal posting form. Do not
// reintroduce create/edit/delete here; see PROGRESS-ACCOUNTING.md (ACCT-3).

import Link from "next/link";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";

export type IncomeRow = {
  id: string;
  date: string;
  category: string;
  amount: number;
  note: string | null;
};

type Props = {
  data: IncomeRow[];
};

export function IncomeTable({ data }: Props) {
  const totalAmount = data.reduce((sum, row) => sum + Number(row.amount), 0);

  const columns: Column<IncomeRow>[] = [
    {
      key: "date",
      header: "Date",
      sortable: true,
      render: (value) => new Date(value as string).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }),
    },
    {
      key: "category",
      header: "Category",
      sortable: true,
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      render: (value) => (
        <span className="font-medium text-(--color-text)">
          ₱{Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: "note",
      header: "Note",
      className: "max-w-xs truncate",
      render: (value) => (value as string) || <span className="text-(--color-text-subtle)">—</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Income"
        description="Historical revenue records (read-only). Superseded by the accounting journal."
        actions={
          <Link href="/dashboard/accounting/journal/new">
            <Button>Record in Journal</Button>
          </Link>
        }
      />

      <Card>
        <CardContent className="p-4 text-sm text-(--color-text-muted)">
          This page is now a read-only archive. Income is recorded as balanced
          double-entry transactions in{" "}
          <Link href="/dashboard/accounting/journal" className="font-medium text-(--color-primary) hover:underline">
            Accounting → Journal
          </Link>
          .
        </CardContent>
      </Card>

      <p className="text-sm text-(--color-text-muted)">
        Total recorded: <span className="font-medium text-(--color-text)">₱{totalAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
      </p>

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search income…"
        emptyMessage="No income recorded"
        emptyDescription="Historical income entries appear here."
      />
    </div>
  );
}
