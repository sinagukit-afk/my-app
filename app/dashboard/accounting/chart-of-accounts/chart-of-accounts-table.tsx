"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { AccountForm } from "./account-form";
import { setAccountActive } from "./actions";

export type AccountRow = {
  id: string;
  account_number: string;
  name: string;
  category: string;
  description: string | null;
  is_active: boolean;
};

type Props = {
  data: AccountRow[];
  canWrite: boolean;
};

const CATEGORY_BADGE: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" | "neutral" }> = {
  asset: { label: "Asset", variant: "info" },
  liability: { label: "Liability", variant: "warning" },
  equity: { label: "Equity", variant: "default" },
  revenue: { label: "Revenue", variant: "success" },
  expense: { label: "Expense", variant: "danger" },
};

export function ChartOfAccountsTable({ data, canWrite }: Props) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AccountRow | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("");

  const filtered = useMemo(
    () => (categoryFilter ? data.filter((r) => r.category === categoryFilter) : data),
    [data, categoryFilter]
  );

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: AccountRow) {
    setEditing(row);
    setFormOpen(true);
  }

  function refresh() {
    router.refresh();
  }

  async function handleDeactivate(row: AccountRow) {
    if (!confirm(`Deactivate account "${row.account_number} — ${row.name}"? It will stop showing up as an option on new journal entries.`)) return;
    const res = await setAccountActive(row.id, false);
    if (!res.success) alert(res.error);
    else refresh();
  }

  async function handleReactivate(row: AccountRow) {
    const res = await setAccountActive(row.id, true);
    if (!res.success) alert(res.error);
    else refresh();
  }

  const columns: Column<AccountRow>[] = [
    {
      key: "account_number",
      header: "Account #",
      sortable: true,
      render: (value) => <span className="font-mono text-(--color-text)">{String(value)}</span>,
    },
    {
      key: "name",
      header: "Name",
      sortable: true,
      render: (value) => <span className="font-medium text-(--color-text)">{String(value)}</span>,
    },
    {
      key: "category",
      header: "Category",
      sortable: true,
      render: (value) => {
        const badge = CATEGORY_BADGE[String(value)] ?? { label: String(value), variant: "neutral" as const };
        return <Badge variant={badge.variant}>{badge.label}</Badge>;
      },
    },
    {
      key: "description",
      header: "Description",
      render: (value) => (
        <span className="text-(--color-text-muted)">{value ? String(value) : "—"}</span>
      ),
    },
    {
      key: "is_active",
      header: "Status",
      sortable: true,
      render: (value) => (
        <Badge variant={value ? "success" : "neutral"}>{value ? "Active" : "Inactive"}</Badge>
      ),
    },
    {
      key: "id",
      header: "Actions",
      render: (_value, row) => (
        <div className="flex items-center gap-2">
          {canWrite && (
            <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
              Edit
            </Button>
          )}
          {canWrite && row.is_active && (
            <Button variant="ghost" size="sm" className="text-(--color-danger)" onClick={() => handleDeactivate(row)}>
              Deactivate
            </Button>
          )}
          {canWrite && !row.is_active && (
            <Button variant="ghost" size="sm" onClick={() => handleReactivate(row)}>
              Reactivate
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Chart of Accounts"
        description="The full list of accounts used across Journal entries, Fixed Assets, and Product Mapping."
        actions={canWrite ? <Button onClick={openAdd}>Add Account</Button> : undefined}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Select
          aria-label="Filter by category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          options={[
            { value: "", label: "All categories" },
            { value: "asset", label: "Asset" },
            { value: "liability", label: "Liability" },
            { value: "equity", label: "Equity" },
            { value: "revenue", label: "Revenue" },
            { value: "expense", label: "Expense" },
          ]}
          className="w-44"
        />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        searchPlaceholder="Search accounts…"
        emptyMessage="No accounts found"
        emptyDescription="Adjust the category filter or search to find what you're looking for."
      />

      {canWrite && (
        <AccountForm open={formOpen} onOpenChange={setFormOpen} account={editing} onSaved={refresh} />
      )}
    </div>
  );
}
