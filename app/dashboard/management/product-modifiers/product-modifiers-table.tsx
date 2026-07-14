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
import { ModifierForm } from "./modifier-form";
import { archiveModifier, restoreModifier } from "./actions";

export type ModifierOptionRow = {
  id: string;
  name: string;
  price: number;
};

export type ModifierRow = {
  id: string;
  name: string;
  loyverse_modifier_id: string | null;
  deleted_at: string | null;
  modifier_options: ModifierOptionRow[];
};

type Props = {
  data: ModifierRow[];
  canWrite: boolean;
  canDelete: boolean;
};

export function ProductModifiersTable({ data, canWrite, canDelete }: Props) {
  const router = useRouter();
  const { notify } = useNotifications();
  const [isPending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ModifierRow | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ModifierRow | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: ModifierRow) {
    setEditing(row);
    setFormOpen(true);
  }

  function refresh() {
    router.refresh();
  }

  function handleArchive() {
    if (!archiveTarget) return;
    setArchiveError(null);
    startTransition(async () => {
      const res = await archiveModifier(archiveTarget.id);
      if (res.success) {
        setArchiveTarget(null);
        refresh();
      } else {
        setArchiveError(res.error);
      }
    });
  }

  async function handleRestore(row: ModifierRow) {
    const res = await restoreModifier(row.id);
    if (!res.success) notify(res.error, "error");
    else refresh();
  }

  const columns: Column<ModifierRow>[] = [
    {
      key: "name",
      header: "Modifier",
      sortable: true,
      render: (value) => <span className="font-medium text-(--color-text)">{String(value)}</span>,
    },
    {
      key: "modifier_options",
      header: "Options",
      render: (value, row) => {
        const options = row.modifier_options;
        if (options.length === 0) return <span className="text-(--color-text-subtle)">No options</span>;
        return (
          <div className="flex flex-wrap gap-1 max-w-md">
            {options.slice(0, 4).map((o) => (
              <Badge key={o.id} variant="neutral">
                {o.name} {o.price > 0 ? `+₱${o.price}` : ""}
              </Badge>
            ))}
            {options.length > 4 && <Badge variant="neutral">+{options.length - 4} more</Badge>}
          </div>
        );
      },
    },
    {
      key: "loyverse_modifier_id",
      header: "Source",
      render: (value) =>
        value ? <Badge variant="neutral">Loyverse-synced</Badge> : <Badge variant="default">ERP-only</Badge>,
    },
    {
      key: "deleted_at",
      header: "Status",
      sortable: true,
      render: (value) => (
        <Badge variant={value ? "neutral" : "success"}>{value ? "Archived" : "Active"}</Badge>
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
          {canDelete && !row.deleted_at && (
            <Button
              variant="ghost"
              size="sm"
              className="text-(--color-danger)"
              onClick={() => {
                setArchiveTarget(row);
                setArchiveError(null);
              }}
            >
              Archive
            </Button>
          )}
          {canDelete && row.deleted_at && (
            <Button variant="ghost" size="sm" onClick={() => handleRestore(row)}>
              Restore
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Product Modifiers"
        description="Manage modifier groups and their options (e.g. text/design add-ons) available on items."
        actions={canWrite ? <Button onClick={openAdd}>Add Modifier</Button> : undefined}
      />

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search modifiers…"
        emptyMessage="No modifiers found"
        emptyDescription="Add your first modifier to get started."
      />

      {canWrite && (
        <ModifierForm
          key={editing?.id ?? "new"}
          open={formOpen}
          onOpenChange={setFormOpen}
          modifier={editing}
          onSaved={refresh}
        />
      )}

      <Dialog
        open={!!archiveTarget}
        onOpenChange={(next) => {
          if (!next) {
            setArchiveTarget(null);
            setArchiveError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Modifier</DialogTitle>
            <DialogDescription>
              Archive modifier &quot;{archiveTarget?.name}&quot;? It will stop showing up as an option
              on new items.
            </DialogDescription>
          </DialogHeader>
          {archiveError && <p className="text-sm text-(--color-danger)">{archiveError}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" variant="danger" onClick={handleArchive} disabled={isPending}>
              {isPending ? "Archiving…" : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
