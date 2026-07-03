"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { FilterBar } from "@/components/business/filter-bar";
import { archiveItem } from "./actions";

export type ItemRow = {
  id: string;
  name: string;
  category: string | null;
  item_type: string;
  status: "available" | "not_for_sale" | "archived";
  stock: number | null;
  sku_list: string;
  sku_count: number;
  price_label: string;
  sync_status: string;
  sync_error: string | null;
};

const STATUS_BADGE: Record<ItemRow["status"], "success" | "neutral" | "warning"> = {
  available: "success",
  not_for_sale: "neutral",
  archived: "warning",
};

const STATUS_LABEL: Record<ItemRow["status"], string> = {
  available: "Available",
  not_for_sale: "Not for sale",
  archived: "Archived",
};

const SYNC_BADGE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  synced: "success",
  pending: "warning",
  failed: "danger",
  local_only: "neutral",
};

const SYNC_LABEL: Record<string, string> = {
  synced: "Synced",
  pending: "Pending",
  failed: "Failed",
  local_only: "Local only",
};

type Props = {
  data: ItemRow[];
  canWrite: boolean;
};

export function ItemsTable({ data, canWrite }: Props) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  async function handleArchive(row: ItemRow) {
    if (!confirm(`Archive "${row.name}"? It will be hidden from the active catalog and no longer sync to Loyverse.`)) return;
    const res = await archiveItem(row.id);
    if (!res.success) alert(res.error);
    else router.refresh();
  }

  const categories = useMemo(
    () =>
      Array.from(
        new Set(data.map((r) => r.category).filter((c): c is string => !!c))
      ).sort(),
    [data]
  );

  const filtered = useMemo(
    () =>
      data.filter((r) => {
        if (statusFilter === "") {
          if (r.status === "archived") return false;
        } else if (r.status !== statusFilter) {
          return false;
        }
        if (categoryFilter && r.category !== categoryFilter) return false;
        if (typeFilter && r.item_type !== typeFilter) return false;
        return true;
      }),
    [data, statusFilter, categoryFilter, typeFilter]
  );

  const statusOptions = [
    { label: "All", value: "" },
    { label: "Available", value: "available" },
    { label: "Not for sale", value: "not_for_sale" },
    // Archived rows are only visible to admin/manager at the RLS level.
    ...(canWrite ? [{ label: "Archived", value: "archived" }] : []),
  ];

  const columns: Column<ItemRow>[] = [
    {
      key: "name",
      header: "Item",
      sortable: true,
      render: (value) => (
        <p className="font-medium text-(--color-text)">{String(value)}</p>
      ),
    },
    {
      key: "category",
      header: "Category",
      sortable: true,
      render: (value) =>
        (value as string) || <span className="text-(--color-text-subtle)">—</span>,
    },
    {
      key: "sku_list",
      header: "SKU",
      render: (_value, row) => {
        if (row.sku_count === 0)
          return <span className="text-(--color-text-subtle)">—</span>;
        const [first, ...rest] = row.sku_list.split(", ");
        return (
          <span title={row.sku_list}>
            {first}
            {rest.length > 0 && (
              <span className="ml-1 text-xs text-(--color-text-muted)">
                +{rest.length} more
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: "price_label",
      header: "Price",
      render: (value) =>
        value === "Variable" ? (
          <span className="text-(--color-text-muted)">Variable</span>
        ) : (
          String(value)
        ),
    },
    {
      key: "stock",
      header: "Stock",
      sortable: true,
      render: (value) =>
        value === null ? (
          <span className="text-(--color-text-subtle)" title="Stock not tracked">
            —
          </span>
        ) : (
          Number(value).toLocaleString("en-PH")
        ),
    },
    {
      key: "item_type",
      header: "Type",
      sortable: true,
      render: (value) => (
        <Badge variant={value === "composite" ? "default" : "neutral"}>
          {value === "composite" ? "Composite" : "Simple"}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (value) => {
        const status = value as ItemRow["status"];
        return <Badge variant={STATUS_BADGE[status]}>{STATUS_LABEL[status]}</Badge>;
      },
    },
    {
      key: "sync_status",
      header: "Sync",
      sortable: true,
      render: (value, row) => {
        const sync = String(value);
        return (
          <div title={row.sync_error ?? undefined}>
            <Badge variant={SYNC_BADGE[sync] ?? "neutral"}>
              {SYNC_LABEL[sync] ?? sync}
            </Badge>
            {sync === "failed" && row.sync_error && (
              <p className="mt-1 max-w-48 truncate text-xs text-(--color-danger)">
                {row.sync_error}
              </p>
            )}
          </div>
        );
      },
    },
  ];

  if (canWrite) {
    columns.push({
      key: "id",
      header: "",
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/inventory/items/${String(value)}/edit`}
            className="text-sm text-(--color-primary) underline"
          >
            Edit
          </Link>
          {row.status !== "archived" && (
            <Button
              variant="ghost"
              size="sm"
              className="text-(--color-danger)"
              onClick={() => handleArchive(row)}
            >
              Archive
            </Button>
          )}
        </div>
      ),
    });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Item List"
        description="Every item in the catalog, with pricing, stock, and Loyverse sync state."
        actions={
          canWrite ? (
            <Button asChild>
              <Link href="/dashboard/inventory/items/new">Add Item</Link>
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <FilterBar
          options={statusOptions}
          value={statusFilter}
          onChange={setStatusFilter}
        />
        <Select
          aria-label="Filter by category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          options={[
            { value: "", label: "All categories" },
            ...categories.map((c) => ({ value: c, label: c })),
          ]}
          className="w-44"
        />
        <Select
          aria-label="Filter by item type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          options={[
            { value: "", label: "All types" },
            { value: "simple", label: "Simple" },
            { value: "composite", label: "Composite" },
          ]}
          className="w-40"
        />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        searchPlaceholder="Search items…"
        emptyMessage="No items found"
        emptyDescription="Adjust the filters or search to find what you're looking for."
      />
    </div>
  );
}
