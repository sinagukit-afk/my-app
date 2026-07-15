"use client";

import { Badge } from "@/components/ui/badge";
import { HierarchicalReportTable } from "@/components/business/hierarchical-report-table";

export type TrialBalanceRow = {
  account_id: string;
  account_number: string;
  account_name: string;
  category: string;
  depth: number;
  is_postable: boolean;
  debit_balance: number;
  credit_balance: number;
  rollup_debit_balance: number;
  rollup_credit_balance: number;
};

function money(v: number) {
  return `₱${v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const CATEGORY_VARIANT: Record<string, "default" | "success" | "warning" | "danger" | "neutral"> = {
  asset: "default",
  liability: "warning",
  equity: "success",
  revenue: "success",
  expense: "danger",
};

export function TrialBalanceTable({ data }: { data: TrialBalanceRow[] }) {
  return (
    <HierarchicalReportTable
      rows={data}
      categoryBadge={(category) => (
        <Badge variant={CATEGORY_VARIANT[category] ?? "neutral"}>{category}</Badge>
      )}
      valueColumns={[
        {
          key: "debit",
          header: "Debit",
          render: (row) =>
            Number(row.rollup_debit_balance) > 0 ? (
              <span className="text-(--color-text)">{money(Number(row.rollup_debit_balance))}</span>
            ) : (
              ""
            ),
        },
        {
          key: "credit",
          header: "Credit",
          render: (row) =>
            Number(row.rollup_credit_balance) > 0 ? (
              <span className="text-(--color-text)">{money(Number(row.rollup_credit_balance))}</span>
            ) : (
              ""
            ),
        },
      ]}
      searchPlaceholder="Search accounts…"
      emptyMessage="No activity as of this date"
      emptyDescription="No journal entries have been posted on or before the selected date."
    />
  );
}
