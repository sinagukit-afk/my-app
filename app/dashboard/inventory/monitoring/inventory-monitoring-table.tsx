"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { FilterBar } from "@/components/business/filter-bar";
import type { StockStatus } from "@/lib/inventory/calculations";
import { QtyTile } from "./qty-tile";

export type InventoryMonitoringRow = {
  id: string;
  variant_id: string;
  store_id: string;
  item_name: string;
  sku: string | null;
  category: string | null;
  store_name: string;
  available_qty: number;
  reserved_qty: number;
  in_production_qty: number;
  on_hold_qty: number;
  incoming_qty: number;
  on_hand: number;
  projected_stock: number;
  threshold: number | null;
  status: StockStatus;
};

const STATUS_BADGE: Record<StockStatus, { label: string; variant: "success" | "warning" | "danger" }> = {
  ok: { label: "OK", variant: "success" },
  low: { label: "Low Stock", variant: "warning" },
  out: { label: "Out of Stock", variant: "danger" },
};

function formatQty(value: number) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 3 }).format(value);
}

type QuickFilter = "" | "ok" | "low" | "out" | "on_hold" | "in_production" | "incoming" | "reserved";

type Props = {
  data: InventoryMonitoringRow[];
};

export function InventoryMonitoringTable({ data }: Props) {
  const router = useRouter();
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("");
  const [categoryFilter, setCategoryFilter] = useState("");

  function openMovements(row: InventoryMonitoringRow) {
    const slug = row.sku ?? row.variant_id;
    router.push(`/dashboard/inventory/monitoring/${encodeURIComponent(slug)}?store=${encodeURIComponent(row.store_id)}`);
  }

  function toggleQuickFilter(value: QuickFilter) {
    setQuickFilter((current) => (current === value ? "" : value));
  }

  const categories = useMemo(
    () => Array.from(new Set(data.map((r) => r.category).filter((c): c is string => !!c))).sort(),
    [data]
  );

  const summary = useMemo(
    () => ({
      lowStock: data.filter((r) => r.status === "low").length,
      outOfStock: data.filter((r) => r.status === "out").length,
      onHold: data.filter((r) => r.on_hold_qty > 0).length,
      inProduction: data.filter((r) => r.in_production_qty > 0).length,
      incoming: data.filter((r) => r.incoming_qty > 0).length,
      reserved: data.filter((r) => r.reserved_qty > 0).length,
    }),
    [data]
  );

  const filtered = useMemo(
    () =>
      data.filter((r) => {
        if (categoryFilter && r.category !== categoryFilter) return false;
        switch (quickFilter) {
          case "":
            return true;
          case "ok":
          case "low":
          case "out":
            return r.status === quickFilter;
          case "on_hold":
            return r.on_hold_qty > 0;
          case "in_production":
            return r.in_production_qty > 0;
          case "incoming":
            return r.incoming_qty > 0;
          case "reserved":
            return r.reserved_qty > 0;
        }
      }),
    [data, quickFilter, categoryFilter]
  );

  const columns: Column<InventoryMonitoringRow>[] = [
    {
      key: "item_name",
      header: "Item",
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-(--color-text)">{String(value)}</p>
          {row.sku && <p className="text-xs text-(--color-text-muted)">{row.sku}</p>}
        </div>
      ),
    },
    { key: "category", header: "Category", sortable: true, render: (v) => (v as string) || <span className="text-(--color-text-subtle)">—</span> },
    { key: "store_name", header: "Store" },
    {
      key: "available_qty",
      header: "Available",
      sortable: true,
      render: (v) => <Badge variant="success">{formatQty(Number(v))}</Badge>,
    },
    {
      key: "reserved_qty",
      header: "Reserved",
      sortable: true,
      render: (v) => <Badge variant="info">{formatQty(Number(v))}</Badge>,
    },
    {
      key: "in_production_qty",
      header: "In Production",
      sortable: true,
      render: (v) => <Badge variant="default">{formatQty(Number(v))}</Badge>,
    },
    {
      key: "on_hold_qty",
      header: "On Hold",
      sortable: true,
      render: (v) => <Badge variant="warning">{formatQty(Number(v))}</Badge>,
    },
    {
      key: "incoming_qty",
      header: "Incoming",
      sortable: true,
      render: (v) => <Badge variant="neutral">{formatQty(Number(v))}</Badge>,
    },
    {
      key: "on_hand",
      header: "On Hand",
      sortable: true,
      render: (v) => <span className="font-medium">{formatQty(Number(v))}</span>,
    },
    {
      key: "projected_stock",
      header: "Projected",
      sortable: true,
      render: (v) => <span className="font-medium">{formatQty(Number(v))}</span>,
    },
    {
      key: "threshold",
      header: "Threshold",
      sortable: true,
      render: (v) => (v == null ? <span className="text-(--color-text-subtle)">—</span> : formatQty(Number(v))),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (v) => {
        const status = STATUS_BADGE[v as StockStatus];
        return <Badge variant={status.variant}>{status.label}</Badge>;
      },
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventory Monitoring"
        description="Available, Reserved, In Production, On Hold, and Incoming stock per item. Click a row to open its full movement history. Click a tile below to filter the table to that slice."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <QtyTile
          label="Low Stock"
          value={summary.lowStock.toLocaleString("en-PH")}
          variant="warning"
          onClick={() => toggleQuickFilter("low")}
          active={quickFilter === "low"}
        />
        <QtyTile
          label="Out of Stock"
          value={summary.outOfStock.toLocaleString("en-PH")}
          variant="danger"
          onClick={() => toggleQuickFilter("out")}
          active={quickFilter === "out"}
        />
        <QtyTile
          label="On Hold"
          value={summary.onHold.toLocaleString("en-PH")}
          variant="warning"
          onClick={() => toggleQuickFilter("on_hold")}
          active={quickFilter === "on_hold"}
        />
        <QtyTile
          label="In Production"
          value={summary.inProduction.toLocaleString("en-PH")}
          variant="default"
          onClick={() => toggleQuickFilter("in_production")}
          active={quickFilter === "in_production"}
        />
        <QtyTile
          label="Incoming"
          value={summary.incoming.toLocaleString("en-PH")}
          variant="neutral"
          onClick={() => toggleQuickFilter("incoming")}
          active={quickFilter === "incoming"}
        />
        <QtyTile
          label="Reserved"
          value={summary.reserved.toLocaleString("en-PH")}
          variant="info"
          onClick={() => toggleQuickFilter("reserved")}
          active={quickFilter === "reserved"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <FilterBar
          aria-label="Filter by status"
          options={[
            { label: "All statuses", value: "" },
            { label: "OK", value: "ok" },
            { label: "Low Stock", value: "low" },
            { label: "Out of Stock", value: "out" },
          ]}
          value={["ok", "low", "out"].includes(quickFilter) ? quickFilter : ""}
          onChange={(v) => setQuickFilter(v as QuickFilter)}
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
        {quickFilter && !["ok", "low", "out"].includes(quickFilter) && (
          <button
            type="button"
            onClick={() => setQuickFilter("")}
            className="text-xs text-(--color-primary) hover:underline"
          >
            Clear tile filter
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        pageSize={50}
        searchPlaceholder="Search inventory…"
        emptyMessage="No tracked inventory found"
        emptyDescription="Items with stock tracking enabled will appear here."
        onRowClick={openMovements}
      />
    </div>
  );
}
