"use client";

import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

export type BalanceSheetRow = {
  account_number: string;
  account_name: string;
  category: string;
  amount: number;
};

function money(v: number) {
  return `₱${v.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}

const CATEGORY_VARIANT: Record<string, "default" | "success" | "warning"> = {
  asset: "default",
  liability: "warning",
  equity: "success",
};

const columns: Column<BalanceSheetRow>[] = [
  { key: "account_number", header: "Account #", sortable: true },
  { key: "account_name", header: "Account Name", sortable: true },
  {
    key: "category",
    header: "Category",
    sortable: true,
    render: (value) => <Badge variant={CATEGORY_VARIANT[value as string] ?? "neutral"}>{value as string}</Badge>,
  },
  {
    key: "amount",
    header: "Amount",
    sortable: true,
    render: (value) => <span className="text-(--color-text)">{money(Number(value))}</span>,
  },
];

export function BalanceSheetTable({ data }: { data: BalanceSheetRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Search accounts…"
      pageSize={20}
      emptyMessage="No activity as of this date"
      emptyDescription="No journal entries have been posted on or before the selected date."
    />
  );
}
