"use client";

import { Badge } from "@/components/ui/badge";
import { HierarchicalReportTable } from "@/components/business/hierarchical-report-table";

export type BalanceSheetRow = {
  account_id: string;
  account_number: string;
  account_name: string;
  category: string;
  depth: number;
  is_postable: boolean;
  amount: number;
  rollup_amount: number;
};

function money(v: number) {
  return `₱${v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const CATEGORY_VARIANT: Record<string, "default" | "success" | "warning"> = {
  asset: "default",
  liability: "warning",
  equity: "success",
};

export function BalanceSheetTable({ data }: { data: BalanceSheetRow[] }) {
  return (
    <HierarchicalReportTable
      rows={data}
      categoryBadge={(category) => (
        <Badge variant={CATEGORY_VARIANT[category] ?? "neutral"}>{category}</Badge>
      )}
      valueColumns={[
        {
          key: "amount",
          header: "Amount",
          render: (row) => (
            <span className="text-(--color-text)">{money(Number(row.rollup_amount))}</span>
          ),
        },
      ]}
      searchPlaceholder="Search accounts…"
      emptyMessage="No activity as of this date"
      emptyDescription="No journal entries have been posted on or before the selected date."
    />
  );
}
