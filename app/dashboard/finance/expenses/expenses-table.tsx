"use client";

import Link from "next/link";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils/format-date";

export type ExpenseRow = {
  id: string;
  expense_number: string;
  description: string;
  amount: number;
  expense_date: string;
  payment_status: "unpaid" | "partial" | "paid";
  source: "direct" | "purchase_order";
  category_name: string;
  supplier_name: string | null;
};

const STATUS_VARIANT: Record<ExpenseRow["payment_status"], "danger" | "warning" | "success"> = {
  unpaid: "danger",
  partial: "warning",
  paid: "success",
};

const SOURCE_LABEL: Record<ExpenseRow["source"], string> = {
  direct: "Direct Entry",
  purchase_order: "Expense PO",
};

type Props = {
  data: ExpenseRow[];
  canWrite: boolean;
};

export function ExpensesTable({ data }: Props) {
  const columns: Column<ExpenseRow>[] = [
    {
      key: "expense_number",
      header: "Expense #",
      sortable: true,
      render: (value, row) => (
        <Link href={`/dashboard/finance/expenses/${row.id}`} className="font-medium text-(--color-primary) hover:underline">
          {String(value)}
        </Link>
      ),
    },
    { key: "expense_date", header: "Date", sortable: true, render: (value) => formatDate(value as string) },
    { key: "category_name", header: "Category", sortable: true },
    { key: "description", header: "Description", className: "max-w-xs truncate" },
    {
      key: "supplier_name",
      header: "Supplier",
      render: (value) => (value as string) || <span className="text-(--color-text-subtle)">—</span>,
    },
    {
      key: "source",
      header: "Source",
      render: (value) => <Badge variant="neutral">{SOURCE_LABEL[value as ExpenseRow["source"]]}</Badge>,
    },
    { key: "amount", header: "Amount", sortable: true, render: (value) => `₱${Number(value).toFixed(2)}` },
    {
      key: "payment_status",
      header: "Payment",
      sortable: true,
      render: (value) => (
        <Badge variant={STATUS_VARIANT[value as ExpenseRow["payment_status"]]}>
          {(value as string).charAt(0).toUpperCase() + (value as string).slice(1)}
        </Badge>
      ),
    },
    {
      key: "id",
      header: "",
      render: (_value, row) => (
        <Link href={`/dashboard/finance/expenses/${row.id}`}>
          <Button variant="ghost" size="sm">
            View
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Search expenses…"
      emptyMessage="No expenses recorded"
      emptyDescription="Record a direct expense, or receive an Expense PO from Purchasing."
    />
  );
}
