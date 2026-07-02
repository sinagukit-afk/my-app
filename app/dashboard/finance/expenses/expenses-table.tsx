"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ExpenseForm } from "./expense-form";
import { deleteExpense } from "./actions";

export type ExpenseRow = {
  id: string;
  date: string;
  category: string;
  amount: number;
  note: string | null;
};

type Props = {
  data: ExpenseRow[];
};

export function ExpensesTable({ data }: Props) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: ExpenseRow) {
    setEditing(row);
    setFormOpen(true);
  }

  function refresh() {
    router.refresh();
  }

  async function handleDelete(row: ExpenseRow) {
    if (!confirm(`Delete this ${row.category} entry of ₱${row.amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}?`)) return;
    const res = await deleteExpense(row.id);
    if (!res.success) alert(res.error);
    else refresh();
  }

  const totalAmount = data.reduce((sum, row) => sum + Number(row.amount), 0);

  const columns: Column<ExpenseRow>[] = [
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
    {
      key: "id",
      header: "Actions",
      render: (_value, row) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" className="text-(--color-danger)" onClick={() => handleDelete(row)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Expenses"
        description="Log and categorise business expenditures."
        actions={<Button onClick={openAdd}>Add Expense</Button>}
      />

      <p className="text-sm text-(--color-text-muted)">
        Total recorded: <span className="font-medium text-(--color-text)">₱{totalAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
      </p>

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search expenses…"
        emptyMessage="No expenses recorded"
        emptyDescription="Add your first expense entry to get started."
      />

      <ExpenseForm open={formOpen} onOpenChange={setFormOpen} expense={editing} onSaved={refresh} />
    </div>
  );
}
