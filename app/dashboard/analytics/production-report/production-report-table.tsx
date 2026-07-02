"use client";

import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

export type OrderStage = "quote" | "confirmed" | "in_production" | "completed" | "cancelled";

export type ProductionOrderRow = {
  id: string;
  customer: string;
  status: OrderStage;
  createdAt: string;
  updatedAt: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

const STAGE_BADGE: Record<OrderStage, { label: string; variant: "neutral" | "default" | "warning" | "success" | "danger" }> = {
  quote: { label: "Quote", variant: "neutral" },
  confirmed: { label: "Confirmed", variant: "default" },
  in_production: { label: "In Production", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
  cancelled: { label: "Cancelled", variant: "danger" },
};

const columns: Column<ProductionOrderRow>[] = [
  { key: "customer", header: "Customer", sortable: true },
  {
    key: "status",
    header: "Stage",
    sortable: true,
    render: (value) => {
      const stage = STAGE_BADGE[value as OrderStage];
      return <Badge variant={stage.variant}>{stage.label}</Badge>;
    },
  },
  { key: "createdAt", header: "Created", sortable: true, render: (value) => formatDate(value as string) },
  { key: "updatedAt", header: "Last Updated", sortable: true, render: (value) => formatDate(value as string) },
];

export function ProductionOrdersTable({ data }: { data: ProductionOrderRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Search customers…"
      emptyMessage="No orders"
      emptyDescription="No orders were created in the selected date range."
    />
  );
}
