"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
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
import {
  startProduction,
  overrideReservedQty,
  holdOrder,
  cancelOrder,
} from "../../active-orders/actions";

export type ConfirmedOrderItem = {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  reservedQty: number;
  modifiers: { name: string; price: number }[];
};

export type ConfirmedOrderData = {
  id: string;
  orderNumber: string;
  status: string;
  note: string | null;
  createdAt: string;
  targetDate: string;
  sameAsCustomer: boolean;
  receiverName: string | null;
  receiverPhone: string | null;
  receiverAddress: string | null;
  totalDiscount: number;
  totalMoney: number;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  items: ConfirmedOrderItem[];
  canAdvance: boolean;
  canOverrideReservedQty: boolean;
  canHold: boolean;
  canCancel: boolean;
};

function peso(n: number) {
  return `₱${n.toFixed(2)}`;
}

function lineTotal(item: ConfirmedOrderItem) {
  const modifierTotal = item.modifiers.reduce((sum, m) => sum + m.price, 0);
  return Math.max(0, item.quantity * (item.unitPrice + modifierTotal) - item.discount);
}

const LIST_PATH = "/dashboard/orders/confirmed";

export function ConfirmedOrderDetail({ data }: { data: ConfirmedOrderData }) {
  const router = useRouter();
  const { notify } = useNotifications();
  const [isPending, startTransition] = useTransition();

  const [reservedQty, setReservedQty] = useState<Record<string, number>>(
    Object.fromEntries(data.items.map((i) => [i.id, i.reservedQty]))
  );
  const reservedQtyDirty = data.items.some((i) => reservedQty[i.id] !== i.reservedQty);

  const [startProductionOpen, setStartProductionOpen] = useState(false);
  const [startProductionError, setStartProductionError] = useState<string | null>(null);
  const [holdOpen, setHoldOpen] = useState(false);
  const [holdError, setHoldError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  function handleSaveReservedQty() {
    const updates = data.items
      .filter((i) => reservedQty[i.id] !== i.reservedQty)
      .map((i) => ({ orderItemId: i.id, reservedQty: reservedQty[i.id] }));
    if (updates.length === 0) return;
    startTransition(async () => {
      const res = await overrideReservedQty(data.id, updates);
      if (!res.success) notify(res.error, "error");
      else router.refresh();
    });
  }

  function handleStartProduction() {
    setStartProductionError(null);
    startTransition(async () => {
      const res = await startProduction(data.id);
      if (!res.success) {
        setStartProductionError(res.error);
      } else {
        notify("Successfully sent to production.", "success");
        router.push(LIST_PATH);
      }
    });
  }

  function handleHoldOrder() {
    setHoldError(null);
    startTransition(async () => {
      const res = await holdOrder(data.id);
      if (!res.success) {
        setHoldError(res.error);
      } else {
        notify("Order placed on hold.", "success");
        router.push(LIST_PATH);
      }
    });
  }

  function handleCancelOrder() {
    setCancelError(null);
    startTransition(async () => {
      const res = await cancelOrder(data.id);
      if (!res.success) {
        setCancelError(res.error);
      } else {
        notify("Order cancelled.", "success");
        router.push(LIST_PATH);
      }
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.orderNumber}
        description={`Order Date ${data.createdAt.slice(0, 10)} · Target Date ${data.targetDate}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {data.canAdvance && (
              <Button disabled={isPending} onClick={() => setStartProductionOpen(true)}>
                Start Production
              </Button>
            )}
            {data.canHold && (
              <Button variant="secondary" disabled={isPending} onClick={() => setHoldOpen(true)}>
                Put On Hold
              </Button>
            )}
            {data.canCancel && (
              <Button variant="secondary" className="text-(--color-danger)" disabled={isPending} onClick={() => setCancelOpen(true)}>
                Cancel Order
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Confirmed Order</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-(--color-text)">
              Customer: {data.customerName ?? "Walk-in customer"}
            </p>
            {data.customerAddress && <p className="text-xs text-(--color-text-muted)">{data.customerAddress}</p>}
            {(data.customerPhone || data.customerEmail) && (
              <p className="text-xs text-(--color-text-muted)">
                {[data.customerPhone, data.customerEmail].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          {!data.sameAsCustomer && (
            <div className="rounded-md border border-(--color-border) p-3">
              <p className="text-xs font-medium text-(--color-text-muted)">Ships to</p>
              <p className="text-sm text-(--color-text)">{data.receiverName}</p>
              {data.receiverAddress && <p className="text-xs text-(--color-text-muted)">{data.receiverAddress}</p>}
              {data.receiverPhone && <p className="text-xs text-(--color-text-muted)">{data.receiverPhone}</p>}
            </div>
          )}
          {data.note && <p className="text-sm text-(--color-text-muted)">Notes: {data.note}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
          <CardDescription>Ordered and Reserved quantities per line.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="hidden gap-2 text-xs font-medium text-(--color-text-muted) lg:grid lg:grid-cols-[2fr_1fr_1fr_1fr]">
            <span>Item</span>
            <span className="text-right">Ordered</span>
            <span className="text-right">Reserved</span>
            <span className="text-right">Line Total</span>
          </div>
          {data.items.map((item) => (
            <div key={item.id} className="border-b border-(--color-border) pb-3 text-sm last:border-0">
              <div className="hidden items-center gap-2 lg:grid lg:grid-cols-[2fr_1fr_1fr_1fr]">
                <div>
                  <span className="text-(--color-text)">
                    {item.name}
                    {item.sku ? ` (${item.sku})` : ""}
                  </span>
                  {item.modifiers.length > 0 && (
                    <p className="text-xs text-(--color-text-muted)">
                      {item.modifiers.map((m) => `${m.name} (+${peso(m.price)})`).join(", ")}
                    </p>
                  )}
                  {item.discount > 0 && (
                    <p className="text-xs text-(--color-text-muted)">Discount: -{peso(item.discount)}</p>
                  )}
                </div>
                <span className="text-right text-(--color-text)">{item.quantity}</span>
                {data.canOverrideReservedQty ? (
                  <NumberInput
                    className="h-8 text-right"
                    min={0}
                    max={item.quantity}
                    value={reservedQty[item.id]}
                    onChange={(e) =>
                      setReservedQty((prev) => ({
                        ...prev,
                        [item.id]: Math.max(0, Math.min(item.quantity, Number(e.target.value) || 0)),
                      }))
                    }
                  />
                ) : (
                  <span className="text-right text-(--color-text)">{item.reservedQty}</span>
                )}
                <span className="text-right font-medium text-(--color-text)">{peso(lineTotal(item))}</span>
              </div>

              <div className="space-y-2 lg:hidden">
                <div>
                  <span className="text-(--color-text)">
                    {item.name}
                    {item.sku ? ` (${item.sku})` : ""}
                  </span>
                  {item.modifiers.length > 0 && (
                    <p className="text-xs text-(--color-text-muted)">
                      {item.modifiers.map((m) => `${m.name} (+${peso(m.price)})`).join(", ")}
                    </p>
                  )}
                  {item.discount > 0 && (
                    <p className="text-xs text-(--color-text-muted)">Discount: -{peso(item.discount)}</p>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-(--color-text-muted)">Ordered</span>
                  <span className="text-(--color-text)">{item.quantity}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-(--color-text-muted)">Reserved</span>
                  {data.canOverrideReservedQty ? (
                    <NumberInput
                      className="h-8 w-24 text-right"
                      min={0}
                      max={item.quantity}
                      value={reservedQty[item.id]}
                      onChange={(e) =>
                        setReservedQty((prev) => ({
                          ...prev,
                          [item.id]: Math.max(0, Math.min(item.quantity, Number(e.target.value) || 0)),
                        }))
                      }
                    />
                  ) : (
                    <span className="text-(--color-text)">{item.reservedQty}</span>
                  )}
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-(--color-text-muted)">Line Total</span>
                  <span className="text-(--color-text)">{peso(lineTotal(item))}</span>
                </div>
              </div>
            </div>
          ))}
          <div className="space-y-1 border-t border-(--color-border) pt-3 text-sm">
            <div className="flex justify-between text-(--color-text-muted)">
              <span>Total Discount</span>
              <span>-{peso(data.totalDiscount)}</span>
            </div>
            <div className="flex justify-between font-medium text-(--color-text)">
              <span>Total Amount</span>
              <span>{peso(data.totalMoney)}</span>
            </div>
          </div>
        </CardContent>
        {data.canOverrideReservedQty && (
          <CardFooter className="justify-end gap-2">
            <Button
              variant="secondary"
              disabled={!reservedQtyDirty || isPending}
              onClick={handleSaveReservedQty}
            >
              {isPending ? "Saving…" : "Save Reserved Qty"}
            </Button>
          </CardFooter>
        )}
      </Card>

      <Dialog
        open={startProductionOpen}
        onOpenChange={(next) => {
          setStartProductionOpen(next);
          if (!next) setStartProductionError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Production</DialogTitle>
            <DialogDescription>Move this order into production?</DialogDescription>
          </DialogHeader>
          {startProductionError && <p className="text-sm text-(--color-danger)">{startProductionError}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" onClick={handleStartProduction} disabled={isPending}>
              {isPending ? "Starting…" : "Start Production"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={holdOpen}
        onOpenChange={(next) => {
          setHoldOpen(next);
          if (!next) setHoldError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Put On Hold</DialogTitle>
            <DialogDescription>Put this order on hold? It can be resumed later.</DialogDescription>
          </DialogHeader>
          {holdError && <p className="text-sm text-(--color-danger)">{holdError}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" onClick={handleHoldOrder} disabled={isPending}>
              {isPending ? "Saving…" : "Put On Hold"}
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
              Cancel this order? Reserved inventory will be released back to Available.
            </DialogDescription>
          </DialogHeader>
          {cancelError && <p className="text-sm text-(--color-danger)">{cancelError}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" variant="danger" onClick={handleCancelOrder} disabled={isPending}>
              {isPending ? "Cancelling…" : "Cancel Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
