"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { ModifierForm } from "./modifier-form";
import { archiveModifier, restoreModifier, setModifierPublished } from "../actions";

export type ProductDetailData = {
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
};

export type ModifierRow = {
  id: string;
  modifier_name: string;
  description: string | null;
  price_modifier: number;
  sort_order: number;
  published: boolean;
  deleted_at: string | null;
};

type Props = {
  product: ProductDetailData;
  modifiers: ModifierRow[];
};

const STATUS_OPTIONS = [
  { label: "Live on website", value: "published" },
  { label: "Draft (unpublished)", value: "draft" },
  { label: "Archived", value: "archived" },
  { label: "All statuses", value: "all" },
];

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wide text-(--color-text-subtle)">
        {label}
      </span>
      <span className="text-sm text-(--color-text)">{value}</span>
    </div>
  );
}

export function ProductDetail({ product, modifiers }: Props) {
  const router = useRouter();
  const { notify } = useNotifications();
  const [isPending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState("published");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ModifierRow | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ModifierRow | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return modifiers;
    if (statusFilter === "archived") return modifiers.filter((m) => m.deleted_at);
    if (statusFilter === "draft") return modifiers.filter((m) => !m.deleted_at && !m.published);
    return modifiers.filter((m) => !m.deleted_at && m.published);
  }, [modifiers, statusFilter]);

  function refresh() {
    router.refresh();
  }

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: ModifierRow) {
    setEditing(row);
    setFormOpen(true);
  }

  async function handleTogglePublished(row: ModifierRow) {
    const res = await setModifierPublished(row.id, product.id, !row.published);
    if (!res.success) notify(res.error, "error");
    else refresh();
  }

  function handleArchive() {
    if (!archiveTarget) return;
    setArchiveError(null);
    startTransition(async () => {
      const res = await archiveModifier(archiveTarget.id, product.id);
      if (res.success) {
        setArchiveTarget(null);
        refresh();
      } else {
        setArchiveError(res.error);
      }
    });
  }

  async function handleRestore(row: ModifierRow) {
    const res = await restoreModifier(row.id, product.id);
    if (!res.success) notify(res.error, "error");
    else refresh();
  }

  const columns: Column<ModifierRow>[] = [
    {
      key: "modifier_name",
      header: "Modifier",
      sortable: true,
      render: (value, row) => (
        <div className="flex flex-col">
          <span className="font-medium text-(--color-text)">{String(value)}</span>
          {row.description && (
            <span className="text-xs text-(--color-text-subtle)">{row.description}</span>
          )}
        </div>
      ),
    },
    {
      key: "price_modifier",
      header: "Price Add-on",
      sortable: true,
      render: (value) => {
        const amount = value as number;
        return (
          <span className="tabular-nums">
            {amount > 0 ? "+" : ""}
            {formatCurrency(amount)}
          </span>
        );
      },
      exportValue: (value) => value as number,
    },
    {
      key: "sort_order",
      header: "Sort",
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
    <div className="space-y-6">
      <PageHeader
        title={product.name}
        description={`/${product.slug} — customization options shown on the website product page.`}
        backHref="/dashboard/marketing/products"
        backLabel="Back to Website Products"
        actions={
          product.deleted_at ? (
            <Badge variant="neutral">Archived</Badge>
          ) : (
            <Badge variant={product.published ? "success" : "warning"}>
              {product.published ? "Live" : "Draft"}
            </Badge>
          )
        }
      />

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-5">
          <Field label="Category" value={product.category ?? "—"} />
          <Field label="Starting Price" value={formatCurrency(product.starting_price)} />
          <Field label="Minimum Order" value={product.moq} />
          <Field label="Lead Time" value={product.lead_time_standard} />
          <Field label="Rush Option" value={product.rush_option ?? "—"} />
          {product.description && (
            <div className="col-span-2 sm:col-span-3 lg:col-span-5">
              <Field label="Description" value={product.description} />
            </div>
          )}
          {product.pricing_notes && (
            <div className="col-span-2 sm:col-span-3 lg:col-span-5">
              <Field label="Pricing Notes" value={product.pricing_notes} />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <FilterBar
          aria-label="Filter modifiers by status"
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={setStatusFilter}
        />
        <Button onClick={openAdd}>Add Modifier</Button>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        searchPlaceholder="Search modifiers…"
        emptyMessage="No modifiers found"
        emptyDescription="Add a customization option buyers can pick on the website."
        exportFilename={`${product.slug}-modifiers`}
      />

      <ModifierForm
        open={formOpen}
        onOpenChange={setFormOpen}
        productId={product.id}
        modifier={editing}
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
            <DialogTitle>Archive Modifier</DialogTitle>
            <DialogDescription>
              Archive &quot;{archiveTarget?.modifier_name}&quot;? Buyers will no longer see it as an
              option on {product.name}. You can restore it later.
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
