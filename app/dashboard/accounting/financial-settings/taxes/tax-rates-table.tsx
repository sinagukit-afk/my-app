"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useNotifications } from "@/components/providers/notification-provider";
import { TaxRateForm } from "./tax-rate-form";
import { setTaxRateActive } from "./actions";

export type TaxRateRow = {
  id: string;
  name: string;
  rate_percent: number;
  is_active: boolean;
};

type Props = {
  data: TaxRateRow[];
  canWrite: boolean;
};

export function TaxRatesTable({ data, canWrite }: Props) {
  const router = useRouter();
  const { notify } = useNotifications();
  const [isPending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TaxRateRow | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<TaxRateRow | null>(null);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: TaxRateRow) {
    setEditing(row);
    setFormOpen(true);
  }

  function refresh() {
    router.refresh();
  }

  function handleDeactivate() {
    if (!deactivateTarget) return;
    setDeactivateError(null);
    startTransition(async () => {
      const res = await setTaxRateActive(deactivateTarget.id, false);
      if (res.success) {
        setDeactivateTarget(null);
        refresh();
      } else {
        setDeactivateError(res.error);
      }
    });
  }

  async function handleReactivate(row: TaxRateRow) {
    const res = await setTaxRateActive(row.id, true);
    if (!res.success) notify(res.error, "error");
    else refresh();
  }

  const columns: Column<TaxRateRow>[] = [
    { key: "name", header: "Name", sortable: true },
    {
      key: "rate_percent",
      header: "Rate",
      sortable: true,
      render: (value) => `${Number(value).toFixed(2)}%`,
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
          {canWrite && row.is_active && (
            <Button
              variant="ghost"
              size="sm"
              className="text-(--color-danger)"
              onClick={() => {
                setDeactivateTarget(row);
                setDeactivateError(null);
              }}
            >
              Deactivate
            </Button>
          )}
          {canWrite && !row.is_active && (
            <Button variant="ghost" size="sm" onClick={() => handleReactivate(row)}>
              Reactivate
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tax Rates"
        description="Reference rates for future use. Not yet applied automatically to POS/Orders."
        actions={canWrite ? <Button onClick={openAdd}>Add Tax Rate</Button> : undefined}
      />

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search tax rates…"
        emptyMessage="No tax rates yet"
        emptyDescription="Add a tax rate to get started."
      />

      {canWrite && (
        <TaxRateForm open={formOpen} onOpenChange={setFormOpen} taxRate={editing} onSaved={refresh} />
      )}

      <Dialog
        open={!!deactivateTarget}
        onOpenChange={(next) => {
          if (!next) {
            setDeactivateTarget(null);
            setDeactivateError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Tax Rate</DialogTitle>
            <DialogDescription>
              Deactivate &quot;{deactivateTarget?.name}&quot;? It will stop showing up as an option wherever
              tax rates are selectable.
            </DialogDescription>
          </DialogHeader>
          {deactivateError && <p className="text-sm text-(--color-danger)">{deactivateError}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" variant="danger" onClick={handleDeactivate} disabled={isPending}>
              {isPending ? "Deactivating…" : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
