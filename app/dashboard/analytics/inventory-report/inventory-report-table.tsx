"use client";

import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

export type StockStatus = "ok" | "low" | "out";

export type StockRow = {
  id: string;
  item: string;
  variant: string;
  category: string;
  inStock: number;
  threshold: number | null;
  unitCost: number;
  stockValue: number;
  status: StockStatus;
};

function money(v: number) {
  return `₱${v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_BADGE: Record<StockStatus, { label: string; variant: "success" | "warning" | "danger" }> = {
  ok: { label: "OK", variant: "success" },
  low: { label: "Low Stock", variant: "warning" },
  out: { label: "Out of Stock", variant: "danger" },
};

const columns: Column<StockRow>[] = [
  { key: "item", header: "Item", sortable: true },
  { key: "variant", header: "Variant", sortable: true },
  { key: "category", header: "Category", sortable: true },
  {
    key: "inStock",
    header: "In Stock",
    sortable: true,
    render: (value) => Number(value).toLocaleString("en-PH"),
  },
  {
    key: "threshold",
    header: "Low Stock Threshold",
    sortable: true,
    render: (value) => (value == null ? "—" : Number(value).toLocaleString("en-PH")),
  },
  {
    key: "unitCost",
    header: "Unit Cost",
    sortable: true,
    render: (value) => money(Number(value)),
  },
  {
    key: "stockValue",
    header: "Stock Value",
    sortable: true,
    render: (value) => <span className="font-medium text-(--color-text)">{money(Number(value))}</span>,
  },
  {
    key: "status",
    header: "Status",
    sortable: true,
    render: (value) => {
      const status = STATUS_BADGE[value as StockStatus];
      return <Badge variant={status.variant}>{status.label}</Badge>;
    },
  },
];

export function InventoryStockTable({ data }: { data: StockRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Search items, variants, or categories…"
      emptyMessage="No tracked stock"
      emptyDescription="No items with stock tracking enabled were found."
    />
  );
}
