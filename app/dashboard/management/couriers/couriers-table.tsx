"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useNotifications } from "@/components/providers/notification-provider";
import { CourierForm } from "./courier-form";
import { setCourierActive } from "./actions";

export type CourierRow = {
  id: string;
  courier_code: string;
  name: string;
  contact_number: string | null;
  is_active: boolean;
};

type Props = {
  data: CourierRow[];
  canWrite: boolean;
};

export function CouriersTable({ data, canWrite }: Props) {
  const router = useRouter();
  const { notify } = useNotifications();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CourierRow | null>(null);

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: CourierRow) {
    setEditing(row);
    setFormOpen(true);
  }

  function refresh() {
    router.refresh();
  }

  async function handleToggleActive(row: CourierRow) {
    const res = await setCourierActive(row.id, !row.is_active);
    if (!res.success) notify(res.error, "error");
    else refresh();
  }

  const columns: Column<CourierRow>[] = [
    {
      key: "courier_code",
      header: "Code",
      sortable: true,
      className: "font-mono text-xs",
    },
    {
      key: "name",
      header: "Courier",
      sortable: true,
      render: (value) => <p className="font-medium text-(--color-text)">{String(value)}</p>,
    },
    {
      key: "contact_number",
      header: "Contact Number",
      render: (value) => (value as string) || <span className="text-(--color-text-subtle)">—</span>,
    },
    {
      key: "is_active",
      header: "Status",
      sortable: true,
      render: (value) => <Badge variant={value ? "success" : "neutral"}>{value ? "Active" : "Inactive"}</Badge>,
    },
    {
      key: "id",
      header: "Actions",
      render: (_value, row) => (
        <div className="flex items-center gap-2">
          {canWrite && (
            <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
              Edit
            </Button>
          )}
          {canWrite && (
            <Button variant="ghost" size="sm" onClick={() => handleToggleActive(row)}>
              {row.is_active ? "Deactivate" : "Activate"}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Couriers"
        description="Manage the courier directory used when shipping orders."
        actions={canWrite ? <Button onClick={openAdd}>Add Courier</Button> : undefined}
      />

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search couriers…"
        emptyMessage="No couriers found"
        emptyDescription="Add your first courier to get started."
      />

      {canWrite && <CourierForm open={formOpen} onOpenChange={setFormOpen} courier={editing} onSaved={refresh} />}
    </div>
  );
}
