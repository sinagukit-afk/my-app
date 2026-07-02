"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { IncomingForm, type SupplierOption, type ItemOption } from "./incoming-form";

export type IncomingRow = {
  id: string;
  date_received: string;
  item_name_snapshot: string;
  variant_label: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  supplier_name: string | null;
  notes: string | null;
  received_by_email: string | null;
};

type Props = {
  data: IncomingRow[];
  suppliers: SupplierOption[];
  items: ItemOption[];
  canWrite: boolean;
};

export function IncomingTable({ data, suppliers, items, canWrite }: Props) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);

  function refresh() {
    router.refresh();
  }

  const columns: Column<IncomingRow>[] = [
    {
      key: "date_received",
      header: "Date",
      sortable: true,
      render: (value) => (
        <span className="text-(--color-text-muted) text-sm">
          {new Date(value as string).toLocaleDateString("en-PH", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </span>
      ),
    },
    {
      key: "item_name_snapshot",
      header: "Item",
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-(--color-text)">{String(value)}</p>
          {row.variant_label && (
            <p className="text-xs text-(--color-text-muted)">{row.variant_label}</p>
          )}
        </div>
      ),
    },
    {
      key: "quantity",
      header: "Qty",
      sortable: true,
      render: (value) => <span className="tabular-nums">{Number(value).toLocaleString()}</span>,
    },
    {
      key: "unit_price",
      header: "Unit Price",
      render: (value) => (
        <span className="tabular-nums">
          ₱{Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: "total_price",
      header: "Total",
      sortable: true,
      render: (value) => (
        <span className="tabular-nums font-medium">
          ₱{Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: "supplier_name",
      header: "Supplier",
      render: (value) =>
        value ? (
          <span>{String(value)}</span>
        ) : (
          <span className="text-(--color-text-subtle)">—</span>
        ),
    },
    {
      key: "notes",
      header: "Notes",
      className: "max-w-xs truncate",
      render: (value) =>
        value ? (
          <span className="text-(--color-text-muted) text-sm">{String(value)}</span>
        ) : (
          <span className="text-(--color-text-subtle)">—</span>
        ),
    },
    {
      key: "received_by_email",
      header: "Received By",
      render: (value) => (
        <span className="text-(--color-text-muted) text-sm">
          {value ? String(value) : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Incoming Inventory"
        description="Log manual inventory receipts. Stock levels are updated automatically."
        actions={
          canWrite ? (
            <Button onClick={() => setFormOpen(true)}>Log Incoming</Button>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search entries…"
        emptyMessage="No incoming entries yet"
        emptyDescription="Log your first manual receipt to get started."
      />

      {canWrite && (
        <IncomingForm
          open={formOpen}
          onOpenChange={setFormOpen}
          suppliers={suppliers}
          items={items}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
