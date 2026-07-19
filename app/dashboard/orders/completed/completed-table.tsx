"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/utils/format-date";
import { formatCurrency } from "@/lib/utils/format";

export type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
};

export type OrderRow = {
  id: string;
  orderNumber: string;
  customerName: string | null;
  note: string | null;
  totalMoney: number;
  createdAt: string;
  completedAt: string;
  loyverseReceiptNumber: string | null;
  items: OrderItem[];
};

type Props = {
  data: OrderRow[];
};

export function CompletedOrdersTable({ data }: Props) {
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
      key: "items",
      header: "Items",
      render: (value) => {
        const items = value as OrderItem[];
        return `${items.length} item${items.length === 1 ? "" : "s"}`;
      },
    },
    {
      key: "totalMoney",
      header: "Total",
      sortable: true,
      render: (value) => formatCurrency(value as number),
    },
    {
      key: "loyverseReceiptNumber",
      header: "Loyverse Receipt",
      render: (value) =>
        value ? (
          <Badge variant="success">{value as string}</Badge>
        ) : (
          <span className="text-(--color-text-subtle)">—</span>
        ),
    },
    {
      key: "completedAt",
      header: "Completed",
      sortable: true,
      render: (value) => formatDate(value as string),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Completed"
        description="Archive of fulfilled orders. Click a row to view the full order — shipments, payments, and activity log."
        actions={
          <Link
            href="/dashboard/orders/active-orders?status=completed"
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
        emptyMessage="No completed orders yet"
        emptyDescription="Orders marked completed from Production will appear here."
        onRowClick={(row) => router.push(`/dashboard/orders/active-orders/${row.orderNumber}`)}
      />
    </div>
  );
}
