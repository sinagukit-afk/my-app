"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { deletePurchaseOrder } from "./actions";

export type PurchaseOrderRow = {
  id: string;
  reference: string;
  status: string;
  order_date: string;
  expected_date: string | null;
  total: number;
  supplier_name: string;
  item_count: number;
};

type Props = {
  data: PurchaseOrderRow[];
  canWrite: boolean;
  canDelete: boolean;
};

const STATUS_VARIANT: Record<string, "neutral" | "success" | "warning" | "danger" | "default"> = {
  draft: "neutral",
  sent: "default",
  partial: "warning",
  received: "success",
  closed: "success",
  cancelled: "danger",
};

export function PurchaseOrdersTable({ data, canWrite, canDelete }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrderRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function refresh() {
    router.refresh();
  }

  function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    startTransition(async () => {
      const res = await deletePurchaseOrder(deleteTarget.id);
      if (res.success) {
        setDeleteTarget(null);
        refresh();
      } else {
        setDeleteError(res.error);
      }
    });
  }

  const columns: Column<PurchaseOrderRow>[] = [
    {
      key: "reference",
      header: "Reference",
      sortable: true,
      render: (value, row) => (
        <Link href={`/dashboard/purchasing/inventory-po/${row.reference}`} className="font-medium text-(--color-primary) hover:underline">
          {String(value)}
        </Link>
      ),
    },
    {
      key: "supplier_name",
      header: "Supplier",
      sortable: true,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (value) => (
        <Badge variant={STATUS_VARIANT[value as string] ?? "neutral"}>{String(value)}</Badge>
      ),
    },
    {
      key: "order_date",
      header: "Order Date",
      sortable: true,
    },
    {
      key: "expected_date",
      header: "Expected",
      render: (value) => (value as string) || <span className="text-(--color-text-subtle)">—</span>,
    },
    {
      key: "item_count",
      header: "Items",
    },
    {
      key: "total",
      header: "Total",
      sortable: true,
      render: (value) => `₱${Number(value).toFixed(2)}`,
    },
    {
      key: "id",
      header: "Actions",
      render: (_value, row) => (
        <div className="flex items-center gap-2">
          <Link href={`/dashboard/purchasing/inventory-po/${row.reference}`}>
            <Button variant="ghost" size="sm">
              View
            </Button>
          </Link>
          {canDelete && row.status === "draft" && (
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
        title="Purchase Orders"
        description="Create and track orders placed with your suppliers."
        actions={
          canWrite ? (
            <Link href="/dashboard/purchasing/inventory-po/new">
              <Button>New Purchase Order</Button>
            </Link>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search purchase orders…"
        emptyMessage="No purchase orders found"
        emptyDescription="Create your first purchase order to get started."
      />

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
            <DialogTitle>Delete Purchase Order</DialogTitle>
            <DialogDescription>
              Delete purchase order &quot;{deleteTarget?.reference}&quot;? This cannot be undone.
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
