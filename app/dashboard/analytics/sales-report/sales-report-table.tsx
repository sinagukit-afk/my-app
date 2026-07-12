"use client";

import { DataTable, type Column } from "@/components/ui/data-table";
import { formatQty } from "@/lib/utils/format";

export type ItemSalesRow = {
  item: string;
  category: string;
  quantitySold: number;
  revenue: number;
};

function money(v: number) {
  return `₱${v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const columns: Column<ItemSalesRow>[] = [
  { key: "item", header: "Item", sortable: true },
  { key: "category", header: "Category", sortable: true },
  {
    key: "quantitySold",
    header: "Units Sold",
    sortable: true,
    render: (value) => formatQty(value as number),
  },
  {
    key: "revenue",
    header: "Revenue",
    sortable: true,
    render: (value) => <span className="font-medium text-(--color-text)">{money(Number(value))}</span>,
  },
];

/** Pre-sort `data` by revenue desc before passing in — this doubles as the top-sellers view by default. */
export function SalesByItemTable({ data }: { data: ItemSalesRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Search items or categories…"
      emptyMessage="No sales in range"
      emptyDescription="No confirmed, in-production, or completed orders were found in the selected date range."
    />
  );
}
