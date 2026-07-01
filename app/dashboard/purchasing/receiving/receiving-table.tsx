"use client";

import Link from "next/link";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

export type ReceivablePO = {
  id: string;
  reference: string;
  status: string;
  expected_date: string | null;
  supplier_name: string;
  items_remaining: number;
};

type Props = {
  data: ReceivablePO[];
};

export function ReceivingTable({ data }: Props) {
  const columns: Column<ReceivablePO>[] = [
    {
      key: "reference",
      header: "Reference",
      render: (value, row) => (
        <Link href={`/dashboard/purchasing/receiving/${row.reference}`} className="font-medium text-(--color-primary) hover:underline">
          {String(value)}
        </Link>
      ),
    },
    { key: "supplier_name", header: "Supplier" },
    {
      key: "status",
      header: "Status",
      render: (value) => <Badge variant={value === "partial" ? "warning" : "default"}>{String(value)}</Badge>,
    },
    {
      key: "expected_date",
      header: "Expected",
      render: (value) => (value as string) || <span className="text-(--color-text-subtle)">—</span>,
    },
    { key: "items_remaining", header: "Units Remaining" },
    {
      key: "id",
      header: "",
      render: (_value, row) => (
        <Link href={`/dashboard/purchasing/receiving/${row.reference}`} className="text-sm text-(--color-primary) hover:underline">
          Receive →
        </Link>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Search open purchase orders…"
      emptyMessage="Nothing to receive"
      emptyDescription="Purchase orders will appear here once they've been sent to a supplier."
    />
  );
}
