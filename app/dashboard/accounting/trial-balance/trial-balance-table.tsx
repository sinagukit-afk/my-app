"use client";

import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

export type TrialBalanceRow = {
  account_number: string;
  account_name: string;
  category: string;
  debit_balance: number;
  credit_balance: number;
};

function money(v: number) {
  return `₱${v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const CATEGORY_VARIANT: Record<string, "default" | "success" | "warning" | "danger" | "neutral"> = {
  asset: "default",
  liability: "warning",
  equity: "success",
  revenue: "success",
  expense: "danger",
};

const columns: Column<TrialBalanceRow>[] = [
  { key: "account_number", header: "Account #", sortable: true },
  { key: "account_name", header: "Account Name", sortable: true },
  {
    key: "category",
    header: "Category",
    sortable: true,
    render: (value) => <Badge variant={CATEGORY_VARIANT[value as string] ?? "neutral"}>{value as string}</Badge>,
  },
  {
    key: "debit_balance",
    header: "Debit",
    sortable: true,
    render: (value) => (Number(value) > 0 ? <span className="text-(--color-text)">{money(Number(value))}</span> : ""),
  },
  {
    key: "credit_balance",
    header: "Credit",
    sortable: true,
    render: (value) => (Number(value) > 0 ? <span className="text-(--color-text)">{money(Number(value))}</span> : ""),
  },
];

export function TrialBalanceTable({ data }: { data: TrialBalanceRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Search accounts…"
      pageSize={20}
      emptyMessage="No activity as of this date"
      emptyDescription="No journal entries have been posted on or before the selected date."
    />
  );
}
