"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { AssetFormDialog, type CategoryOption, type SupplierOption } from "./asset-form-dialog";
import { disposeFixedAsset } from "./actions";
import { formatDate } from "@/lib/utils/format-date";

export type AssetStatus = "active" | "fully_depreciated" | "disposed";
export type ScheduleStatus = "active" | "paused" | "terminated";
export type AssetPaymentStatus = "unpaid" | "partial" | "paid";

export type AssetRow = {
  id: string;
  name: string;
  account_number: string;
  category_name: string;
  purchased_date: string;
  cost: number;
  salvage_value: number;
  useful_life_months: number;
  supplier_id: string | null;
  accumulated: number;
  book_value: number;
  status: AssetStatus;
  schedule_status: ScheduleStatus;
  payment_status: AssetPaymentStatus;
};

const PAYMENT_STATUS_VARIANT: Record<AssetPaymentStatus, "danger" | "warning" | "success"> = {
  unpaid: "danger",
  partial: "warning",
  paid: "success",
};

const SCHEDULE_STATUS_LABEL: Record<ScheduleStatus, string> = {
  active: "Active",
  paused: "Paused",
  terminated: "Terminated",
};

const SCHEDULE_STATUS_VARIANT: Record<ScheduleStatus, "success" | "warning" | "neutral"> = {
  active: "success",
  paused: "warning",
  terminated: "neutral",
};

function peso(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_LABEL: Record<AssetStatus, string> = {
  active: "Active",
  fully_depreciated: "Fully Depreciated",
  disposed: "Disposed",
};

const STATUS_VARIANT: Record<AssetStatus, "success" | "warning" | "neutral"> = {
  active: "success",
  fully_depreciated: "warning",
  disposed: "neutral",
};

type Props = {
  data: AssetRow[];
  canWrite: boolean;
  categories: CategoryOption[];
  suppliers: SupplierOption[];
};

export function FixedAssetsTable({ data, canWrite, categories, suppliers }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editTarget, setEditTarget] = useState<AssetRow | null>(null);
  const [disposeTarget, setDisposeTarget] = useState<AssetRow | null>(null);
  const [disposeError, setDisposeError] = useState<string | null>(null);

  function confirmDispose() {
    if (!disposeTarget) return;
    setDisposeError(null);
    startTransition(async () => {
      const res = await disposeFixedAsset(disposeTarget.id, new Date().toISOString().slice(0, 10));
      if (res.success) {
        setDisposeTarget(null);
        router.refresh();
      } else {
        setDisposeError(res.error);
      }
    });
  }

  const columns: Column<AssetRow>[] = [
    { key: "name", header: "Asset", sortable: true },
    { key: "category_name", header: "Category", sortable: true },
    { key: "account_number", header: "Asset Account #", sortable: true },
    {
      key: "purchased_date",
      header: "Purchased",
      sortable: true,
      render: (value) => formatDate(value as string),
    },
    { key: "useful_life_months", header: "Useful Life (mo.)", sortable: true },
    { key: "cost", header: "Cost", sortable: true, render: (value) => peso(Number(value)) },
    { key: "salvage_value", header: "Salvage", sortable: true, render: (value) => peso(Number(value)) },
    { key: "accumulated", header: "Accum. Depreciation", sortable: true, render: (value) => peso(Number(value)) },
    { key: "book_value", header: "Book Value", sortable: true, render: (value) => peso(Number(value)) },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (value) => <Badge variant={STATUS_VARIANT[value as AssetStatus]}>{STATUS_LABEL[value as AssetStatus]}</Badge>,
    },
    {
      key: "schedule_status",
      header: "Schedule",
      sortable: true,
      render: (value) => (
        <Badge variant={SCHEDULE_STATUS_VARIANT[value as ScheduleStatus]}>
          {SCHEDULE_STATUS_LABEL[value as ScheduleStatus]}
        </Badge>
      ),
    },
    {
      key: "payment_status",
      header: "Payment",
      sortable: true,
      render: (value) => (
        <Badge variant={PAYMENT_STATUS_VARIANT[value as AssetPaymentStatus]}>
          {(value as string).charAt(0).toUpperCase() + (value as string).slice(1)}
        </Badge>
      ),
    },
    ...(canWrite
      ? [
          {
            key: "id",
            header: "Actions",
            render: (_value: unknown, row: AssetRow) => (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditTarget(row);
                  }}
                >
                  Edit
                </Button>
                {row.status !== "disposed" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-(--color-danger)"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDisposeTarget(row);
                      setDisposeError(null);
                    }}
                  >
                    Dispose
                  </Button>
                )}
              </div>
            ),
          } as Column<AssetRow>,
        ]
      : []),
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search assets…"
        emptyMessage="No fixed assets yet"
        emptyDescription="Add your first asset, or receive one through Purchasing → Asset PO."
        onRowClick={(row) => router.push(`/dashboard/finance/fixed-assets/${row.id}`)}
      />

      {canWrite && editTarget && (
        <AssetFormDialog
          open={!!editTarget}
          onOpenChange={(next) => !next && setEditTarget(null)}
          categories={categories}
          suppliers={suppliers}
          asset={{
            id: editTarget.id,
            name: editTarget.name,
            purchased_date: editTarget.purchased_date,
            cost: editTarget.cost,
            salvage_value: editTarget.salvage_value,
            useful_life_months: editTarget.useful_life_months,
            supplier_id: editTarget.supplier_id,
          }}
        />
      )}

      <Dialog open={!!disposeTarget} onOpenChange={(next) => { if (!next) { setDisposeTarget(null); setDisposeError(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dispose Asset</DialogTitle>
            <DialogDescription>
              Mark &quot;{disposeTarget?.name}&quot; as disposed today? This stops future depreciation.
            </DialogDescription>
          </DialogHeader>
          {disposeError && <p className="text-sm text-(--color-danger)">{disposeError}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>Cancel</Button>
            </DialogClose>
            <Button type="button" variant="danger" onClick={confirmDispose} disabled={isPending}>
              {isPending ? "Disposing…" : "Dispose"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
