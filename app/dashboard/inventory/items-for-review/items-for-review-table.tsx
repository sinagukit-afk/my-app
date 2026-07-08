"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ReleaseForm } from "./release-form";

export type ReviewRow = {
  variant_id: string;
  store_id: string;
  item_name: string;
  variant_label: string | null;
  sku: string | null;
  on_hold_qty: number;
  available_qty: number;
  in_production_qty: number;
};

type Props = {
  data: ReviewRow[];
  canRelease: boolean;
};

export function ItemsForReviewTable({ data, canRelease }: Props) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<ReviewRow | null>(null);

  function openRelease(row: ReviewRow) {
    setSelected(row);
    setFormOpen(true);
  }

  function refresh() {
    router.refresh();
  }

  const columns: Column<ReviewRow>[] = [
    {
      key: "item_name",
      header: "Item",
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-(--color-text)">{String(value)}</p>
          {(row.variant_label || row.sku) && (
            <p className="text-xs text-(--color-text-muted)">
              {row.variant_label ?? row.sku}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "on_hold_qty",
      header: "On Hold",
      sortable: true,
      render: (value) => <Badge variant="warning">{String(value)}</Badge>,
    },
    {
      key: "in_production_qty",
      header: "In Production",
      sortable: true,
    },
    {
      key: "available_qty",
      header: "Available",
      sortable: true,
    },
    {
      key: "variant_id",
      header: "Actions",
      render: (_value, row) =>
        canRelease ? (
          <Button variant="ghost" size="sm" onClick={() => openRelease(row)}>
            Release
          </Button>
        ) : (
          <span className="text-(--color-text-subtle)">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Items for Review"
        description="Stock parked On Hold — typically the already-completed portion of a cancelled Production Order — with no automatic path back into circulation. Review and release it to Available or In Production."
      />

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search items…"
        emptyMessage="Nothing to review"
        emptyDescription="No items currently have stock parked On Hold."
      />

      {canRelease && (
        <ReleaseForm open={formOpen} onOpenChange={setFormOpen} row={selected} onReleased={refresh} />
      )}
    </div>
  );
}
