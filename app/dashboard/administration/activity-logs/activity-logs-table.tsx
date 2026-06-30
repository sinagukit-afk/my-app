"use client";

import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

export type LogRow = {
  id: string;
  user_name: string;
  action: string;
  entity_type: string;
  description: string;
  created_at: string;
};

const ACTION_BADGE: Record<string, "default" | "success" | "warning" | "danger" | "neutral"> = {
  login:           "neutral",
  logout:          "neutral",
  create_receipt:  "success",
  add_incoming:    "success",
  create_item:     "success",
  create_category: "success",
  update_item:     "warning",
  view_report:     "default",
};

function formatAction(action: string): string {
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const COLUMNS: Column<LogRow>[] = [
  {
    key: "user_name",
    header: "User",
    sortable: true,
    render: (value) => (
      <span className="font-medium text-[--color-text]">{(value as string) || "System"}</span>
    ),
  },
  {
    key: "action",
    header: "Action",
    sortable: true,
    render: (value) => (
      <Badge variant={ACTION_BADGE[value as string] ?? "neutral"}>
        {formatAction(value as string)}
      </Badge>
    ),
  },
  {
    key: "description",
    header: "Description",
    render: (value) => (
      <span className="text-sm text-[--color-text-muted]">{(value as string) || "—"}</span>
    ),
  },
  {
    key: "entity_type",
    header: "Entity",
    sortable: true,
    render: (value) =>
      value ? (
        <span className="rounded bg-[--color-border] px-2 py-0.5 text-xs font-mono text-[--color-text-muted]">
          {String(value)}
        </span>
      ) : (
        <span className="text-[--color-text-subtle]">—</span>
      ),
  },
  {
    key: "created_at",
    header: "Time",
    sortable: true,
    render: (value) => (
      <span className="whitespace-nowrap text-xs text-[--color-text-muted]">
        {formatTimestamp(value as string)}
      </span>
    ),
  },
];

export function ActivityLogsTable({ data }: { data: LogRow[] }) {
  return (
    <DataTable
      columns={COLUMNS}
      data={data}
      pageSize={15}
      searchPlaceholder="Search by user, action, or description…"
      emptyMessage="No activity logs"
      emptyDescription="No user actions have been recorded yet."
    />
  );
}
