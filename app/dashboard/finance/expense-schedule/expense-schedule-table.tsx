"use client";

import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/format-date";

export type ScheduleType = "prepaid" | "fixed_asset";
export type ScheduleStatus = "active" | "paused" | "terminated";

export type ScheduleRow = {
  id: string;
  type: ScheduleType;
  name: string;
  total_amount: number;
  remaining_balance: number;
  next_posting_date: string | null;
  status: ScheduleStatus;
};

function peso(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const TYPE_LABEL: Record<ScheduleType, string> = {
  prepaid: "Prepaid",
  fixed_asset: "Fixed Asset",
};

const STATUS_LABEL: Record<ScheduleStatus, string> = {
  active: "Active",
  paused: "Paused",
  terminated: "Terminated",
};

const STATUS_VARIANT: Record<ScheduleStatus, "success" | "warning" | "neutral"> = {
  active: "success",
  paused: "warning",
  terminated: "neutral",
};

type Props = {
  data: ScheduleRow[];
};

export function ExpenseScheduleTable({ data }: Props) {
  const router = useRouter();

  const columns: Column<ScheduleRow>[] = [
    {
      key: "type",
      header: "Type",
      sortable: true,
      render: (value) => <Badge variant="neutral">{TYPE_LABEL[value as ScheduleType]}</Badge>,
    },
    { key: "name", header: "Name / Description", sortable: true },
    { key: "total_amount", header: "Total", sortable: true, render: (value) => peso(Number(value)) },
    { key: "remaining_balance", header: "Remaining Balance", sortable: true, render: (value) => peso(Number(value)) },
    {
      key: "next_posting_date",
      header: "Next Posting",
      sortable: true,
      render: (value) => (value ? formatDate(value as string) : "—"),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (value) => <Badge variant={STATUS_VARIANT[value as ScheduleStatus]}>{STATUS_LABEL[value as ScheduleStatus]}</Badge>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Search schedules…"
      emptyMessage="No active schedules"
      emptyDescription="Prepaid expenses and fixed assets recorded with those accounting treatments will appear here."
      onRowClick={(row) => router.push(`/dashboard/finance/expense-schedule/${row.type}/${row.id}`)}
    />
  );
}
