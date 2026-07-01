"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserForm } from "./user-form";
import { setUserActive } from "./actions";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  joined: string;
  active: boolean;
};

const ROLE_BADGE: Record<string, "default" | "success" | "warning" | "danger" | "neutral"> = {
  admin:   "danger",
  manager: "warning",
  encoder: "success",
  cashier: "default",
  viewer:  "neutral",
};

type Props = {
  data: UserRow[];
  canManage: boolean;
  currentUserId: string | null;
};

export function UsersTable({ data, canManage, currentUserId }: Props) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);

  function openInvite() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: UserRow) {
    setEditing(row);
    setFormOpen(true);
  }

  function refresh() {
    router.refresh();
  }

  async function handleToggleActive(row: UserRow) {
    const res = await setUserActive(row.id, !row.active);
    if (!res.success) alert(res.error);
    else refresh();
  }

  const columns: Column<UserRow>[] = [
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
      key: "active",
      header: "Status",
      sortable: true,
      render: (value) => (
        <Badge variant={value ? "success" : "neutral"}>{value ? "Active" : "Deactivated"}</Badge>
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
    ...(canManage
      ? [
          {
            key: "id",
            header: "Actions",
            render: (_value, row) => (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={row.id === currentUserId && row.active}
                  onClick={() => handleToggleActive(row)}
                >
                  {row.active ? "Deactivate" : "Activate"}
                </Button>
              </div>
            ),
          } satisfies Column<UserRow>,
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={openInvite}>Invite User</Button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search by name, email, or role…"
        emptyMessage="No users found"
        emptyDescription="No staff accounts have been created yet."
      />

      {canManage && (
        <UserForm open={formOpen} onOpenChange={setFormOpen} user={editing} onSaved={refresh} />
      )}
    </div>
  );
}
