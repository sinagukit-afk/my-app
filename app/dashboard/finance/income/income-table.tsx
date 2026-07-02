"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { IncomeForm } from "./income-form";
import { deleteIncome } from "./actions";

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
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<IncomeRow | null>(null);

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: IncomeRow) {
    setEditing(row);
    setFormOpen(true);
  }

  function refresh() {
    router.refresh();
  }

  async function handleDelete(row: IncomeRow) {
    if (!confirm(`Delete this ${row.category} entry of ₱${row.amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}?`)) return;
    const res = await deleteIncome(row.id);
    if (!res.success) alert(res.error);
    else refresh();
  }

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
        title="Income"
        description="Track all revenue streams and incoming payments."
        actions={<Button onClick={openAdd}>Add Income</Button>}
      />

      <p className="text-sm text-(--color-text-muted)">
        Total recorded: <span className="font-medium text-(--color-text)">₱{totalAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
      </p>

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search income…"
        emptyMessage="No income recorded"
        emptyDescription="Add your first income entry to get started."
      />

      <IncomeForm open={formOpen} onOpenChange={setFormOpen} income={editing} onSaved={refresh} />
    </div>
  );
}
