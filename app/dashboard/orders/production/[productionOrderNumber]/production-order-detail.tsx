"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
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
import { formatDate, formatDateTime } from "@/lib/utils/format-date";
import {
  PRODUCTION_ORDER_STATUS_LABEL,
  PRODUCTION_ORDER_STATUS_VARIANT,
  type ProductionOrderStatus,
} from "@/lib/production-order-status";
import {
  completeProductionOrder,
  startProductionOrder,
  addProductionCompletedQty,
  cancelProductionOrder,
} from "../actions";

export type ProductionComponentRow = {
  id: string;
  name: string;
  sku: string | null;
  reservedQty: number;
  completedQty: number;
};

export type ProductionOrderDetailData = {
  id: string;
  productionOrderNumber: string;
  orderNumber: string;
  itemName: string;
  sku: string | null;
  modifiers: string[];
  quantity: number;
  completedQty: number;
  status: ProductionOrderStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  canStart: boolean;
  canComplete: boolean;
  canAddCompletedQty: boolean;
  canCancel: boolean;
  components: ProductionComponentRow[];
};

export type ActivityLogRow = {
  id: string;
  action: string;
  description: string;
  createdAt: string;
  userName: string;
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-center gap-x-4 gap-y-1">
      <span className="text-(--color-text-muted)">{label}</span>
      <span className="text-(--color-text)">{value}</span>
    </div>
  );
}

export function ProductionOrderDetail({ data, logs }: { data: ProductionOrderDetailData; logs: ActivityLogRow[] }) {
  const router = useRouter();
  const { notify } = useNotifications();
  const [isPending, startTransition] = useTransition();
  const [addQty, setAddQty] = useState(0);
  const remaining = data.quantity - data.completedQty;

  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  function handleStart() {
    startTransition(async () => {
      const res = await startProductionOrder(data.id);
      if (!res.success) notify(res.error, "error");
      else router.refresh();
    });
  }

  function handleComplete() {
    setCompleteError(null);
    startTransition(async () => {
      const res = await completeProductionOrder(data.id);
      if (res.success) {
        setCompleteOpen(false);
        router.refresh();
      } else {
        setCompleteError(res.error);
      }
    });
  }

  function handleAddCompletedQty() {
    if (!(addQty > 0)) return;
    startTransition(async () => {
      const res = await addProductionCompletedQty(data.id, addQty);
      if (!res.success) notify(res.error, "error");
      else {
        setAddQty(0);
        router.refresh();
      }
    });
  }

  function handleCancel() {
    setCancelError(null);
    startTransition(async () => {
      const res = await cancelProductionOrder(data.id);
      if (res.success) {
        setCancelOpen(false);
        router.refresh();
      } else {
        setCancelError(res.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.productionOrderNumber}
        description={`Created ${formatDate(data.createdAt)}`}
        backHref="/dashboard/orders/production"
        backLabel="Back to Production"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {data.canStart && (
              <Button disabled={isPending} onClick={handleStart}>
                Start Production
              </Button>
            )}
            {data.canComplete && (
              <Button disabled={isPending} onClick={() => setCompleteOpen(true)}>
                Mark as Complete
              </Button>
            )}
            {data.canCancel && (
              <Button
                variant="secondary"
                className="text-(--color-danger)"
                disabled={isPending}
                onClick={() => setCancelOpen(true)}
              >
                Cancel Order
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Production Order</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Badge variant={PRODUCTION_ORDER_STATUS_VARIANT[data.status] ?? "neutral"}>
                {PRODUCTION_ORDER_STATUS_LABEL[data.status] ?? data.status}
              </Badge>
              <div className="space-y-1.5 text-sm">
                <InfoRow
                  label="Customer Order"
                  value={
                    <Link
                      href={`/dashboard/orders/active-orders/${data.orderNumber}`}
                      className="font-medium hover:underline"
                    >
                      {data.orderNumber}
                    </Link>
                  }
                />
                <InfoRow label="Product" value={`${data.itemName}${data.sku ? ` (${data.sku})` : ""}`} />
                {data.modifiers.length > 0 && (
                  <InfoRow label="Modifiers" value={data.modifiers.join(", ")} />
                )}
                <InfoRow label="Quantity" value={data.quantity} />
                <InfoRow
                  label="Completed Qty"
                  value={`${data.completedQty} of ${data.quantity} (as of ${formatDate(data.updatedAt)})`}
                />
              </div>

              {data.canAddCompletedQty && remaining > 0 && (
                <div className="flex items-end gap-2 rounded-md border border-(--color-border) p-3">
                  <NumberInput
                    label={`Add completed (max ${remaining})`}
                    className="h-8 w-32 text-right"
                    min={1}
                    max={remaining}
                    step="0.001"
                    decimals={3}
                    value={addQty}
                    onChange={(e) => setAddQty(Math.max(0, Math.min(remaining, Number(e.target.value) || 0)))}
                  />
                  <Button disabled={!(addQty > 0) || isPending} onClick={handleAddCompletedQty}>
                    {isPending ? "Saving…" : "Save"}
                  </Button>
                  <p className="pb-2 text-xs text-(--color-text-muted)">
                    Completions are recorded permanently and can&apos;t be reduced — only the remaining
                    quantity can be logged going forward.
                  </p>
                </div>
              )}

              {data.notes && <p className="text-sm text-(--color-text-muted)">Notes: {data.notes}</p>}
            </CardContent>
          </Card>

          {data.components.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Components</CardTitle>
                <CardDescription>
                  This product is composite — Reserved/Completed shown per individual item.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="hidden gap-2 text-xs font-medium text-(--color-text-muted) lg:grid lg:grid-cols-[2fr_1fr_1fr]">
                  <span>Item</span>
                  <span className="text-right">Reserved</span>
                  <span className="text-right">Completed</span>
                </div>
                {data.components.map((c) => (
                  <div key={c.id} className="border-b border-(--color-border) pb-2 text-sm last:border-0">
                    <div className="hidden items-center gap-2 lg:grid lg:grid-cols-[2fr_1fr_1fr]">
                      <span className="text-(--color-text)">
                        {c.name}
                        {c.sku ? ` (${c.sku})` : ""}
                      </span>
                      <span className="text-right text-(--color-text)">{c.reservedQty}</span>
                      <span className="text-right text-(--color-text)">{c.completedQty}</span>
                    </div>
                    <div className="space-y-1 lg:hidden">
                      <span className="text-(--color-text)">
                        {c.name}
                        {c.sku ? ` (${c.sku})` : ""}
                      </span>
                      <div className="flex justify-between">
                        <span className="text-(--color-text-muted)">Reserved</span>
                        <span className="text-(--color-text)">{c.reservedQty}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-(--color-text-muted)">Completed</span>
                        <span className="text-(--color-text)">{c.completedQty}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Activity Log</CardTitle>
            <CardDescription>Immutable audit trail for this production order.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {logs.length === 0 && <p className="text-sm text-(--color-text-muted)">No activity yet.</p>}
            {logs.map((log) => (
              <div key={log.id} className="border-b border-(--color-border) pb-2 text-sm last:border-0">
                <p className="text-(--color-text)">{log.description || log.action}</p>
                <p className="text-xs text-(--color-text-muted)">
                  {log.userName} · {formatDateTime(log.createdAt)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={completeOpen}
        onOpenChange={(next) => {
          setCompleteOpen(next);
          if (!next) setCompleteError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Complete</DialogTitle>
            <DialogDescription>
              Mark this Production Order completed? This sets Completed Qty to the full quantity on its order lines.
            </DialogDescription>
          </DialogHeader>
          {completeError && <p className="text-sm text-(--color-danger)">{completeError}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" onClick={handleComplete} disabled={isPending}>
              {isPending ? "Saving…" : "Mark as Complete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={cancelOpen}
        onOpenChange={(next) => {
          setCancelOpen(next);
          if (!next) setCancelError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
            <DialogDescription>
              Cancel this Production Order? The uncompleted quantity is released back to Available; the completed
              quantity is moved to On Hold.
            </DialogDescription>
          </DialogHeader>
          {cancelError && <p className="text-sm text-(--color-danger)">{cancelError}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" variant="danger" onClick={handleCancel} disabled={isPending}>
              {isPending ? "Cancelling…" : "Cancel Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
