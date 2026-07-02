"use client";

import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

export type AssetStatus = "active" | "fully_depreciated" | "disposed";

export type AssetRow = {
  id: string;
  name: string;
  account_number: number;
  purchased_date: string;
  cost: number;
  useful_life_months: number;
  accumulated: number;
  book_value: number;
  status: AssetStatus;
};

function peso(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}

const STATUS_LABEL: Record<AssetStatus, string> = {
  active: "Active",
  fully_depreciated: "Fully Depreciated",
  disposed: "Disposed",
};

const STATUS_VARIANT: Record<AssetStatus, "success" | "warning" | "neutral"> = {
  active: "success",
  fully_depreciated: "warning",
  disposed: "neutral",
};

const columns: Column<AssetRow>[] = [
  { key: "name", header: "Asset", sortable: true },
  { key: "account_number", header: "Asset Account #", sortable: true },
  {
    key: "purchased_date",
    header: "Purchased",
    sortable: true,
    render: (value) =>
      new Date(value as string).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }),
  },
  { key: "useful_life_months", header: "Useful Life (mo.)", sortable: true },
  { key: "cost", header: "Cost", sortable: true, render: (value) => peso(Number(value)) },
  { key: "accumulated", header: "Accum. Depreciation", sortable: true, render: (value) => peso(Number(value)) },
  { key: "book_value", header: "Book Value", sortable: true, render: (value) => peso(Number(value)) },
  {
    key: "status",
    header: "Status",
    sortable: true,
    render: (value) => <Badge variant={STATUS_VARIANT[value as AssetStatus]}>{STATUS_LABEL[value as AssetStatus]}</Badge>,
  },
];

export function FixedAssetsTable({ data }: { data: AssetRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Search assets…"
      emptyMessage="No fixed assets yet"
      emptyDescription="Assets are added via migration seed data for now — no add-asset UI yet."
    />
  );
}
