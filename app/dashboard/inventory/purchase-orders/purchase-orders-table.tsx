"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { deletePurchaseOrder } from "./actions";

export type PurchaseOrderRow = {
  id: string;
  reference: string;
  status: string;
  order_date: string;
  expected_date: string | null;
  total: number;
  supplier_name: string;
  item_count: number;
};

type Props = {
  data: PurchaseOrderRow[];
  canWrite: boolean;
  canDelete: boolean;
};

const STATUS_VARIANT: Record<string, "neutral" | "success" | "warning" | "danger" | "default"> = {
  draft: "neutral",
  sent: "default",
  partial: "warning",
  received: "success",
  closed: "success",
  cancelled: "danger",
};

export function PurchaseOrdersTable({ data, canWrite, canDelete }: Props) {
  const router = useRouter();

  function refresh() {
    router.refresh();
  }

  async function handleDelete(row: PurchaseOrderRow) {
    if (!confirm(`Delete purchase order "${row.reference}"? This cannot be undone.`)) return;
    const res = await deletePurchaseOrder(row.id);
    if (!res.success) alert(res.error);
    else refresh();
  }

  const columns: Column<PurchaseOrderRow>[] = [
    {
      key: "reference",
      header: "Reference",
      sortable: true,
      render: (value, row) => (
        <Link href={`/dashboard/inventory/purchase-orders/${row.reference}`} className="font-medium text-(--color-primary) hover:underline">
          {String(value)}
        </Link>
      ),
    },
    {
      key: "supplier_name",
      header: "Supplier",
      sortable: true,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (value) => (
        <Badge variant={STATUS_VARIANT[value as string] ?? "neutral"}>{String(value)}</Badge>
      ),
    },
    {
      key: "order_date",
      header: "Order Date",
      sortable: true,
    },
    {
      key: "expected_date",
      header: "Expected",
      render: (value) => (value as string) || <span className="text-(--color-text-subtle)">—</span>,
    },
    {
      key: "item_count",
      header: "Items",
    },
    {
      key: "total",
      header: "Total",
      sortable: true,
      render: (value) => `₱${Number(value).toFixed(2)}`,
    },
    {
      key: "id",
      header: "Actions",
      render: (_value, row) => (
        <div className="flex items-center gap-2">
          <Link href={`/dashboard/inventory/purchase-orders/${row.reference}`}>
            <Button variant="ghost" size="sm">
              View
            </Button>
          </Link>
          {canDelete && row.status === "draft" && (
            <Button variant="ghost" size="sm" className="text-(--color-danger)" onClick={() => handleDelete(row)}>
              Delete
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Purchase Orders"
        description="Create and track orders placed with your suppliers."
        actions={
          canWrite ? (
            <Link href="/dashboard/inventory/purchase-orders/new">
              <Button>New Purchase Order</Button>
            </Link>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search purchase orders…"
        emptyMessage="No purchase orders found"
        emptyDescription="Create your first purchase order to get started."
      />
    </div>
  );
}
