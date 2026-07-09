"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StoreForm } from "./store-form";
import { setStoreActive, deleteStore } from "./actions";

export type StoreRow = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  loyverse_store_id: string | null;
};

type Props = {
  data: StoreRow[];
  canWrite: boolean;
  canDelete: boolean;
};

export function StoresTable({ data, canWrite, canDelete }: Props) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StoreRow | null>(null);

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: StoreRow) {
    setEditing(row);
    setFormOpen(true);
  }

  function refresh() {
    router.refresh();
  }

  async function handleToggleActive(row: StoreRow) {
    const res = await setStoreActive(row.id, !row.is_active);
    if (!res.success) alert(res.error);
    else refresh();
  }

  async function handleDelete(row: StoreRow) {
    if (!confirm(`Delete store "${row.name}"? This cannot be undone.`)) return;
    const res = await deleteStore(row.id);
    if (!res.success) alert(res.error);
    else refresh();
  }

  const columns: Column<StoreRow>[] = [
    {
      key: "name",
      header: "Store",
      sortable: true,
      render: (value) => <span className="font-medium text-(--color-text)">{String(value)}</span>,
    },
    {
      key: "address",
      header: "Address",
      className: "max-w-xs truncate",
      render: (value) => (value as string) || <span className="text-(--color-text-subtle)">—</span>,
    },
    {
      key: "phone",
      header: "Phone",
      render: (value) => (value as string) || <span className="text-(--color-text-subtle)">—</span>,
    },
    {
      key: "email",
      header: "Email",
      render: (value) => (value as string) || <span className="text-(--color-text-subtle)">—</span>,
    },
    {
      key: "loyverse_store_id",
      header: "Source",
      render: (value) =>
        value ? <Badge variant="neutral">Loyverse-linked</Badge> : <Badge variant="default">BMS-only</Badge>,
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
          {canWrite && (
            <Button variant="ghost" size="sm" onClick={() => handleToggleActive(row)}>
              {row.is_active ? "Deactivate" : "Activate"}
            </Button>
          )}
          {canDelete && (
            <Button variant="ghost" size="sm" className="text-(--color-danger)" onClick={() => handleDelete(row)}>
              Delete
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stores"
        description="Manage store locations and their contact details."
        actions={canWrite ? <Button onClick={openAdd}>Add Store</Button> : undefined}
      />

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search stores…"
        emptyMessage="No stores found"
        emptyDescription="Add your first store to get started."
      />

      {canWrite && (
        <StoreForm open={formOpen} onOpenChange={setFormOpen} store={editing} onSaved={refresh} />
      )}
    </div>
  );
}
