"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { SupplierForm } from "./supplier-form";
import { setSupplierActive, deleteSupplier } from "./actions";

export type SupplierRow = {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  note: string | null;
  is_active: boolean;
};

type Props = {
  data: SupplierRow[];
  canWrite: boolean;
  canDelete: boolean;
};

export function SuppliersTable({ data, canWrite, canDelete }: Props) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierRow | null>(null);

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: SupplierRow) {
    setEditing(row);
    setFormOpen(true);
  }

  function refresh() {
    router.refresh();
  }

  async function handleToggleActive(row: SupplierRow) {
    const res = await setSupplierActive(row.id, !row.is_active);
    if (!res.success) alert(res.error);
    else refresh();
  }

  async function handleDelete(row: SupplierRow) {
    if (!confirm(`Delete supplier "${row.name}"? This cannot be undone.`)) return;
    const res = await deleteSupplier(row.id);
    if (!res.success) alert(res.error);
    else refresh();
  }

  const columns: Column<SupplierRow>[] = [
    {
      key: "name",
      header: "Supplier",
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-(--color-text)">{String(value)}</p>
          {row.contact_name && (
            <p className="text-xs text-(--color-text-muted)">{row.contact_name}</p>
          )}
        </div>
      ),
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
      key: "address",
      header: "Address",
      className: "max-w-xs truncate",
      render: (value) => (value as string) || <span className="text-(--color-text-subtle)">—</span>,
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
        title="Suppliers"
        description="Manage your supplier directory and contact information."
        actions={canWrite ? <Button onClick={openAdd}>Add Supplier</Button> : undefined}
      />

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search suppliers…"
        emptyMessage="No suppliers found"
        emptyDescription="Add your first supplier to get started."
      />

      {canWrite && (
        <SupplierForm
          open={formOpen}
          onOpenChange={setFormOpen}
          supplier={editing}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
