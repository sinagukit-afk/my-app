"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/format-date";

export type JournalRow = {
  id: string;
  journal_number: string;
  entry_date: string;
  description: string;
  source_type: string;
  line_count: number;
  total: number;
};

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

type Props = {
  data: JournalRow[];
};

export function JournalTable({ data }: Props) {
  const router = useRouter();

  const columns: Column<JournalRow>[] = [
    {
      key: "journal_number",
      header: "Journal No.",
      sortable: true,
      className: "font-mono text-xs",
    },
    {
      key: "entry_date",
      header: "Date",
      sortable: true,
      render: (value) => formatDate(value as string),
    },
    {
      key: "description",
      header: "Description",
      sortable: true,
      className: "max-w-md truncate",
    },
    {
      key: "source_type",
      header: "Source",
      sortable: true,
      render: (value) => (
        <Badge variant="neutral">{SOURCE_LABELS[value as string] ?? (value as string)}</Badge>
      ),
    },
    {
      key: "line_count",
      header: "Lines",
      sortable: true,
    },
    {
      key: "total",
      header: "Amount",
      sortable: true,
      render: (value) => (
        <span className="font-medium text-(--color-text)">
          ₱{Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: "id",
      header: "",
      render: (_value, row) => (
        <Link
          href={`/dashboard/accounting/journal/${row.id}`}
          className="text-sm font-medium text-(--color-primary) hover:underline"
        >
          View
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-(--color-text)">Posted Entries</h2>
          <p className="mt-1 text-sm text-(--color-text-muted)">
            Every posted double-entry transaction. Each entry balances — total debits equal total credits.
          </p>
        </div>
        <Button onClick={() => router.push("/dashboard/accounting/journal/new")}>New Journal Entry</Button>
      </div>

      <DataTable
        columns={columns}
        data={data}
        pageSize={50}
        searchPlaceholder="Search entries…"
        emptyMessage="No journal entries yet"
        emptyDescription="Post your first entry to start the ledger."
        onRowClick={(row) => router.push(`/dashboard/accounting/journal/${row.id}`)}
      />
    </div>
  );
}
