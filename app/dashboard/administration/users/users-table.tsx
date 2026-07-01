"use client";

import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  joined: string;
};

const ROLE_BADGE: Record<string, "default" | "success" | "warning" | "danger" | "neutral"> = {
  admin:   "danger",
  manager: "warning",
  encoder: "success",
  cashier: "default",
  viewer:  "neutral",
};

const COLUMNS: Column<UserRow>[] = [
  {
    key: "name",
    header: "Name",
    sortable: true,
    render: (value, row) => (
      <div>
        <p className="font-medium text-(--color-text)">{(value as string) || "—"}</p>
        <p className="text-xs text-(--color-text-muted)">{row.email}</p>
      </div>
    ),
  },
  {
    key: "role",
    header: "Role",
    sortable: true,
    render: (value) => (
      <Badge variant={ROLE_BADGE[value as string] ?? "neutral"}>
        {String(value)}
      </Badge>
    ),
  },
  {
    key: "joined",
    header: "Joined",
    sortable: true,
    render: (value) =>
      new Date(value as string).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
  },
];

export function UsersTable({ data }: { data: UserRow[] }) {
  return (
    <DataTable
      columns={COLUMNS}
      data={data}
      searchPlaceholder="Search by name, email, or role…"
      emptyMessage="No users found"
      emptyDescription="No staff accounts have been created yet."
    />
  );
}
