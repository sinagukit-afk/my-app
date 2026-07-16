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
import { StoreForm } from "./store-form";
import { setStoreActive, deleteStore } from "./actions";

export type StoreRow = {
  id: string;
  store_code: string;
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
  const { notify } = useNotifications();
  const [isPending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StoreRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StoreRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
    if (!res.success) notify(res.error, "error");
    else refresh();
  }

  function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    startTransition(async () => {
      const res = await deleteStore(deleteTarget.id);
      if (res.success) {
        setDeleteTarget(null);
        refresh();
      } else {
        setDeleteError(res.error);
      }
    });
  }

  const columns: Column<StoreRow>[] = [
    {
      key: "store_code",
      header: "Code",
      sortable: true,
      className: "font-mono text-xs",
    },
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
        value ? <Badge variant="neutral">Loyverse-linked</Badge> : <Badge variant="default">ERP-only</Badge>,
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
            <DialogTitle>Delete Store</DialogTitle>
            <DialogDescription>
              Delete store &quot;{deleteTarget?.name}&quot;? This cannot be undone.
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
