"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useNotifications } from "@/components/providers/notification-provider";
import { SupplierForm } from "./supplier-form";
import { setSupplierActive, deleteSupplier } from "./actions";

export type SupplierRow = {
  id: string;
  supplier_code: string;
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
  const { notify } = useNotifications();
  const [isPending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SupplierRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
    if (!res.success) notify(res.error, "error");
    else refresh();
  }

  function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    startTransition(async () => {
      const res = await deleteSupplier(deleteTarget.id);
      if (res.success) {
        setDeleteTarget(null);
        refresh();
      } else {
        setDeleteError(res.error);
      }
    });
  }

  const columns: Column<SupplierRow>[] = [
    {
      key: "supplier_code",
      header: "Code",
      sortable: true,
      className: "font-mono text-xs",
    },
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
            <Button
              variant="ghost"
              size="sm"
              className="text-(--color-danger)"
              onClick={() => {
                setDeleteTarget(row);
                setDeleteError(null);
              }}
            >
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

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(next) => {
          if (!next) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Supplier</DialogTitle>
            <DialogDescription>
              Delete supplier &quot;{deleteTarget?.name}&quot;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && <p className="text-sm text-(--color-danger)">{deleteError}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" variant="danger" onClick={handleDelete} disabled={isPending}>
              {isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
