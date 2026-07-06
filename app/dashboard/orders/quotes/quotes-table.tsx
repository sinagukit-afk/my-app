"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

export type QuoteRow = {
  id: string;
  quoteNumber: string;
  customerName: string | null;
  status: string;
  quoteDate: string;
  validUntil: string;
  totalMoney: number;
  lastActivity: string;
};

const STATUS_VARIANT: Record<string, "success" | "default" | "danger" | "warning" | "neutral"> = {
  open: "success",
  converted: "default",
  cancelled: "danger",
  expired: "warning",
};

function peso(n: number) {
  return `₱${n.toFixed(2)}`;
}

type Props = {
  data: QuoteRow[];
  canCreate: boolean;
};

export function QuotesTable({ data, canCreate }: Props) {
  const router = useRouter();

  const columns: Column<QuoteRow>[] = [
    {
      key: "quoteNumber",
      header: "Quote No.",
      sortable: true,
    },
    {
      key: "customerName",
      header: "Customer",
      sortable: true,
      render: (value, row) => (
        <Link
          href={`/dashboard/orders/quotes/${row.id}`}
          className="text-(--color-primary) hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {(value as string) || "Walk-in"}
        </Link>
      ),
    },
    {
      key: "quoteDate",
      header: "Quote Date",
      sortable: true,
    },
    {
      key: "validUntil",
      header: "Valid Until",
      sortable: true,
    },
    {
      key: "status",
      header: "Status",
      render: (value) => {
        const status = value as string;
        return (
          <Badge variant={STATUS_VARIANT[status] ?? "neutral"}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        );
      },
    },
    {
      key: "totalMoney",
      header: "Total Amount",
      sortable: true,
      render: (value) => peso(value as number),
    },
    {
      key: "lastActivity",
      header: "Last Activity",
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Quotes"
        description="Prepare quotations for customers. Converting a quote reserves stock and creates a Sales Order."
        actions={
          canCreate ? (
            <Link href="/dashboard/orders/quotes/new">
              <Button>New Quote</Button>
            </Link>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search quotes…"
        emptyMessage="No quotes yet"
        emptyDescription="Create a quote to get started."
        onRowClick={(row) => router.push(`/dashboard/orders/quotes/${row.id}`)}
      />
    </div>
  );
}
