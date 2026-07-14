"use client";

import { useRouter } from "next/navigation";
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
  const router = useRouter();

  const columns: Column<ReceivablePO>[] = [
    { key: "reference", header: "Reference" },
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
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Search open purchase orders…"
      emptyMessage="Nothing to receive"
      emptyDescription="Purchase orders will appear here once they've been sent to a supplier."
      onRowClick={(row) => router.push(`/dashboard/purchasing/receiving/${row.reference}`)}
    />
  );
}
