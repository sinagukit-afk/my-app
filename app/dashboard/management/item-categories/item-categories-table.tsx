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
import { CategoryForm } from "./category-form";
import { archiveCategory, restoreCategory } from "./actions";

export type CategoryRow = {
  id: string;
  name: string;
  category_type: string;
  color: string | null;
  loyverse_category_id: string | null;
  deleted_at: string | null;
};

type Props = {
  data: CategoryRow[];
  canWrite: boolean;
  canDelete: boolean;
};

const COLOR_SWATCH: Record<string, string> = {
  GREY: "#9CA3AF",
  RED: "#EF4444",
  PINK: "#EC4899",
  ORANGE: "#F97316",
  YELLOW: "#EAB308",
  GREEN: "#22C55E",
  BLUE: "#3B82F6",
  PURPLE: "#A855F7",
};

export function ItemCategoriesTable({ data, canWrite, canDelete }: Props) {
  const router = useRouter();
  const { notify } = useNotifications();
  const [isPending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<CategoryRow | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: CategoryRow) {
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
      const res = await archiveCategory(archiveTarget.id);
      if (res.success) {
        setArchiveTarget(null);
        refresh();
      } else {
        setArchiveError(res.error);
      }
    });
  }

  async function handleRestore(row: CategoryRow) {
    const res = await restoreCategory(row.id);
    if (!res.success) notify(res.error, "error");
    else refresh();
  }

  const columns: Column<CategoryRow>[] = [
    {
      key: "name",
      header: "Category",
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-2">
          <span
            className="h-3 w-3 shrink-0 rounded-full border border-(--color-border)"
            style={{ backgroundColor: COLOR_SWATCH[row.color ?? ""] ?? "#9CA3AF" }}
            aria-hidden="true"
          />
          <span className="font-medium text-(--color-text)">{String(value)}</span>
        </div>
      ),
    },
    {
      key: "category_type",
      header: "Type",
      sortable: true,
      render: (value) => (
        <Badge variant={value === "packaging" ? "warning" : "default"}>
          {value === "packaging" ? "Packaging" : "Product"}
        </Badge>
      ),
    },
    {
      key: "loyverse_category_id",
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
        title="Item Categories"
        description="Manage the categories items and packaging components are organized under."
        actions={canWrite ? <Button onClick={openAdd}>Add Category</Button> : undefined}
      />

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search categories…"
        emptyMessage="No categories found"
        emptyDescription="Add your first category to get started."
      />

      {canWrite && (
        <CategoryForm open={formOpen} onOpenChange={setFormOpen} category={editing} onSaved={refresh} />
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
            <DialogTitle>Archive Category</DialogTitle>
            <DialogDescription>
              Archive category &quot;{archiveTarget?.name}&quot;? It will stop showing up as an option
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
