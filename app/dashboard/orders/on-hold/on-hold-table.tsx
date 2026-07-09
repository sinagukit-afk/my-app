"use client";

import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { DateRangeFilter } from "@/components/business/date-range-filter";

export type OrderRow = {
  orderNumber: string;
  customerName: string | null;
  orderDate: string;
  createdAt: string;
  updatedAt: string;
  items: string[];
  lastActivity: string;
};

type Props = {
  data: OrderRow[];
  from: string;
  to: string;
};

export function OnHoldOrdersTable({ data, from, to }: Props) {
  const router = useRouter();

  const columns: Column<OrderRow>[] = [
    {
      key: "orderNumber",
      header: "Order No.",
      sortable: true,
    },
    {
      key: "customerName",
      header: "Customer",
      sortable: true,
      render: (value) =>
        (value as string) || <span className="text-(--color-text-subtle)">Walk-in</span>,
    },
    {
      key: "orderDate",
      header: "Order Date",
      sortable: true,
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      render: (value) => new Date(value as string).toLocaleString(),
    },
    {
      key: "updatedAt",
      header: "Modified",
      sortable: true,
      render: (value) => new Date(value as string).toLocaleString(),
    },
    {
      key: "items",
      header: "Items",
      className: "min-w-[280px]",
      render: (value) => {
        const items = value as string[];
        if (items.length === 0) return "—";
        return (
          <div className="space-y-0.5">
            {items.map((line, i) => (
              <div key={i} className="whitespace-nowrap">
                {line}
              </div>
            ))}
          </div>
        );
      },
    },
    {
      key: "lastActivity",
      header: "Last Activity",
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="On Hold"
        description="Orders currently on hold. Click a row to view details or resume."
      />

      <DateRangeFilter from={from} to={to} />

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search orders…"
        emptyMessage="No orders on hold"
        emptyDescription="Orders put on hold will appear here until resumed or cancelled."
        onRowClick={(row) => router.push(`/dashboard/orders/on-hold/${row.orderNumber}`)}
      />
    </div>
  );
}
