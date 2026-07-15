"use client";

import { Badge } from "@/components/ui/badge";
import { HierarchicalReportTable } from "@/components/business/hierarchical-report-table";

export type IncomeStatementRow = {
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

export function IncomeStatementTable({ data }: { data: IncomeStatementRow[] }) {
  return (
    <HierarchicalReportTable
      rows={data}
      categoryBadge={(category) => (
        <Badge variant={category === "revenue" ? "success" : "danger"}>{category}</Badge>
      )}
      valueColumns={[
        {
          key: "amount",
          header: "Amount",
          render: (row) => (
            <span className={row.category === "revenue" ? "text-(--color-success)" : "text-(--color-danger)"}>
              {money(Number(row.rollup_amount))}
            </span>
          ),
        },
      ]}
      searchPlaceholder="Search accounts…"
      emptyMessage="No activity in this period"
      emptyDescription="No revenue or expense entries were posted in the selected date range."
    />
  );
}
