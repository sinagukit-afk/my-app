"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { FilterBar } from "@/components/business/filter-bar";
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
import { formatCurrency } from "@/lib/utils/format";
import { ProductForm } from "./product-form";
import { archiveProduct, restoreProduct, setProductPublished } from "./actions";

export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  starting_price: number;
  moq: number;
  lead_time_standard: string;
  rush_option: string | null;
  pricing_notes: string | null;
  sort_order: number;
  published: boolean;
  deleted_at: string | null;
  modifier_count: number;
};

type Props = {
  data: ProductRow[];
  categories: string[];
};

const STATUS_OPTIONS = [
  { label: "Live on website", value: "published" },
  { label: "Draft (unpublished)", value: "draft" },
  { label: "Archived", value: "archived" },
  { label: "All statuses", value: "all" },
];

export function ProductsTable({ data, categories }: Props) {
  const router = useRouter();
  const { notify } = useNotifications();
  const [isPending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState("published");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ProductRow | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return data;
    if (statusFilter === "archived") return data.filter((p) => p.deleted_at);
    if (statusFilter === "draft") return data.filter((p) => !p.deleted_at && !p.published);
    return data.filter((p) => !p.deleted_at && p.published);
  }, [data, statusFilter]);

  function refresh() {
    router.refresh();
  }

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: ProductRow) {
    setEditing(row);
    setFormOpen(true);
  }

  async function handleTogglePublished(row: ProductRow) {
    const res = await setProductPublished(row.id, !row.published);
    if (!res.success) notify(res.error, "error");
    else {
      notify(
        row.published
          ? `"${row.name}" is no longer shown on the website.`
          : `"${row.name}" is now live on the website.`,
        "success"
      );
      refresh();
    }
  }

  function handleArchive() {
    if (!archiveTarget) return;
    setArchiveError(null);
    startTransition(async () => {
      const res = await archiveProduct(archiveTarget.id);
      if (res.success) {
        setArchiveTarget(null);
        refresh();
      } else {
        setArchiveError(res.error);
      }
    });
  }

  async function handleRestore(row: ProductRow) {
    const res = await restoreProduct(row.id);
    if (!res.success) notify(res.error, "error");
    else refresh();
  }

  const columns: Column<ProductRow>[] = [
    {
      key: "name",
      header: "Product",
      sortable: true,
      render: (value, row) => (
        <div className="flex flex-col">
          <span className="font-medium text-(--color-text)">{String(value)}</span>
          <span className="text-xs text-(--color-text-subtle)">/{row.slug}</span>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      sortable: true,
      render: (value) =>
        value ? (
          <Badge variant="neutral">{String(value)}</Badge>
        ) : (
          <span className="text-(--color-text-subtle)">—</span>
        ),
    },
    {
      key: "starting_price",
      header: "From",
      sortable: true,
      render: (value) => <span className="tabular-nums">{formatCurrency(value as number)}</span>,
      exportValue: (value) => value as number,
    },
    {
      key: "moq",
      header: "MOQ",
      sortable: true,
      render: (value) => <span className="tabular-nums">{String(value)}</span>,
    },
    {
      key: "lead_time_standard",
      header: "Lead Time",
      render: (value, row) => (
        <div className="flex flex-col">
          <span>{String(value)}</span>
          {row.rush_option && (
            <span className="text-xs text-(--color-text-subtle)">Rush: {row.rush_option}</span>
          )}
        </div>
      ),
    },
    {
      key: "modifier_count",
      header: "Modifiers",
      sortable: true,
      render: (value) => <span className="tabular-nums">{String(value)}</span>,
    },
    {
      key: "published",
      header: "Status",
      sortable: true,
      render: (value, row) =>
        row.deleted_at ? (
          <Badge variant="neutral">Archived</Badge>
        ) : value ? (
          <Badge variant="success">Live</Badge>
        ) : (
          <Badge variant="warning">Draft</Badge>
        ),
    },
    {
      key: "id",
      header: "Actions",
      render: (_value, row) =>
        row.deleted_at ? (
          <Button variant="ghost" size="sm" onClick={() => handleRestore(row)}>
            Restore
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
              Edit
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleTogglePublished(row)}>
              {row.published ? "Unpublish" : "Publish"}
            </Button>
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
          </div>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Website Products"
        description="The product catalog shown on sinagukit.com. Separate from ERP items — editing here changes the public site only."
        actions={<Button onClick={openAdd}>Add Product</Button>}
      />

      <div className="flex items-center gap-2">
        <FilterBar
          aria-label="Filter by status"
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={setStatusFilter}
        />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        searchPlaceholder="Search products…"
        emptyMessage="No products found"
        emptyDescription="Add a product to publish it on the website."
        rowHref={(row) => `/dashboard/marketing/products/${row.id}`}
        exportFilename="website-products"
      />

      <ProductForm
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editing}
        categories={categories}
        onSaved={refresh}
      />

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
            <DialogTitle>Archive Product</DialogTitle>
            <DialogDescription>
              Archive &quot;{archiveTarget?.name}&quot;? It disappears from the website immediately.
              Its {archiveTarget?.modifier_count ?? 0} modifier
              {archiveTarget?.modifier_count === 1 ? "" : "s"} stay attached and come back with it
              if you restore.
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
