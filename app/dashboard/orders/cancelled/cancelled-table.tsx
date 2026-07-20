"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/utils/format-date";
import { formatCurrency } from "@/lib/utils/format";

export type OrderRow = {
  orderNumber: string;
  customerName: string | null;
  orderDate: string;
  cancelledAt: string;
  totalMoney: number;
  items: string[];
  lastActivity: string;
};

type Props = {
  data: OrderRow[];
};

export function CancelledOrdersTable({ data }: Props) {
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
      render: (value) => formatDate(value as string),
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
      key: "totalMoney",
      header: "Total",
      sortable: true,
      render: (value) => formatCurrency(value as number),
    },
    {
      key: "cancelledAt",
      header: "Cancelled",
      sortable: true,
      render: (value) => formatDate(value as string),
    },
    {
      key: "lastActivity",
      header: "Last Activity",
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cancelled"
        description="Archive of cancelled orders. Click a row to view the full order history."
        actions={
          <Link
            href="/dashboard/orders/active-orders?status=cancelled"
            className="text-sm text-(--color-primary) hover:underline"
          >
            View in Active Orders →
          </Link>
        }
      />

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search orders…"
        emptyMessage="No cancelled orders"
        emptyDescription="Orders cancelled from any status will appear here."
        onRowClick={(row) => router.push(`/dashboard/orders/active-orders/${row.orderNumber}`)}
        exportFilename="cancelled-orders"
      />
    </div>
  );
}
