"use client";

import { DataTable, type Column } from "@/components/ui/data-table";

export type ExpenseCategoryRow = {
  category: string;
  amount: number;
};

function money(v: number) {
  return `₱${v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const columns: Column<ExpenseCategoryRow>[] = [
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
      <span className="font-medium text-(--color-danger)">{money(Number(value))}</span>
    ),
  },
];

export function ExpenseBreakdownTable({ data }: { data: ExpenseCategoryRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchable={false}
      pageSize={20}
      emptyMessage="No expenses in range"
      emptyDescription="No expense entries were recorded in the selected date range."
    />
  );
}
