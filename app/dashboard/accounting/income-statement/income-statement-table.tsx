"use client";

import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

export type IncomeStatementRow = {
  account_number: string;
  account_name: string;
  category: string;
  amount: number;
};

function money(v: number) {
  return `₱${v.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}

const columns: Column<IncomeStatementRow>[] = [
  { key: "account_number", header: "Account #", sortable: true },
  { key: "account_name", header: "Account Name", sortable: true },
  {
    key: "category",
    header: "Category",
    sortable: true,
    render: (value) => (
      <Badge variant={value === "revenue" ? "success" : "danger"}>{value as string}</Badge>
    ),
  },
  {
    key: "amount",
    header: "Amount",
    sortable: true,
    render: (value, row) => (
      <span className={row.category === "revenue" ? "text-(--color-success)" : "text-(--color-danger)"}>
        {money(Number(value))}
      </span>
    ),
  },
];

export function IncomeStatementTable({ data }: { data: IncomeStatementRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Search accounts…"
      pageSize={20}
      emptyMessage="No activity in this period"
      emptyDescription="No revenue or expense entries were posted in the selected date range."
    />
  );
}
