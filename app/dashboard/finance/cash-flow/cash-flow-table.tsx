"use client";

import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/format-date";

export type CashFlowRow = {
  date: string;
  type: "in" | "out";
  category: string;
  amount: number;
  note: string | null;
  balance: number;
};

function money(v: number) {
  return `₱${v.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}

const columns: Column<CashFlowRow>[] = [
  {
    key: "date",
    header: "Date",
    sortable: true,
    render: (value) => formatDate(value as string),
  },
  {
    key: "type",
    header: "Type",
    sortable: true,
    render: (value) =>
      value === "in" ? <Badge variant="success">Inflow</Badge> : <Badge variant="danger">Outflow</Badge>,
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
    render: (value, row) => (
      <span className={row.type === "in" ? "font-medium text-(--color-success)" : "font-medium text-(--color-danger)"}>
        {row.type === "in" ? "+" : "−"}
        {money(Number(value))}
      </span>
    ),
  },
  {
    key: "balance",
    header: "Running Balance",
    render: (value) => <span className="font-medium text-(--color-text)">{money(Number(value))}</span>,
  },
  {
    key: "note",
    header: "Note",
    className: "max-w-xs truncate",
    render: (value) => (value as string) || <span className="text-(--color-text-subtle)">—</span>,
  },
];

export function CashFlowTable({ data }: { data: CashFlowRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Search cash flow entries…"
      emptyMessage="No entries in range"
      emptyDescription="No income or expense entries were recorded in the selected date range."
    />
  );
}
