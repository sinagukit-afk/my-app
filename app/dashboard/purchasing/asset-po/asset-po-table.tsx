"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/utils/format-date";

export type AssetPORow = {
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
  data: AssetPORow[];
  canWrite: boolean;
};

const STATUS_VARIANT: Record<string, "neutral" | "success" | "warning" | "danger" | "default"> = {
  draft: "neutral",
  sent: "default",
  partial: "warning",
  received: "success",
  closed: "success",
  cancelled: "danger",
};

export function AssetPOTable({ data, canWrite }: Props) {
  const router = useRouter();

  const columns: Column<AssetPORow>[] = [
    { key: "reference", header: "Reference", sortable: true },
    { key: "supplier_name", header: "Supplier", sortable: true },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (value) => <Badge variant={STATUS_VARIANT[value as string] ?? "neutral"}>{String(value)}</Badge>,
    },
    { key: "order_date", header: "Order Date", sortable: true, render: (value) => formatDate(value as string) },
    {
      key: "expected_date",
      header: "Expected",
      render: (value) => (value ? formatDate(value as string) : <span className="text-(--color-text-subtle)">—</span>),
    },
    { key: "item_count", header: "Lines" },
    {
      key: "total",
      header: "Total",
      sortable: true,
      render: (value) => `₱${Number(value).toFixed(2)}`,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Asset Purchase Orders"
        description="Request approval to purchase fixed assets before buying — routes to Finance → Fixed Assets on receipt. Click a row to view details."
        actions={
          canWrite ? (
            <Link href="/dashboard/purchasing/asset-po/new">
              <Button>New Asset PO</Button>
            </Link>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search asset purchase orders…"
        emptyMessage="No asset purchase orders found"
        emptyDescription="Create your first asset PO to get started."
        onRowClick={(row) => router.push(`/dashboard/purchasing/asset-po/${row.reference}`)}
      />
    </div>
  );
}
