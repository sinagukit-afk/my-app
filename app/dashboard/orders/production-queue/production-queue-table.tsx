"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { completeOrder } from "./actions";

export type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
};

export type OrderRow = {
  id: string;
  customerName: string | null;
  note: string | null;
  totalMoney: number;
  createdAt: string;
  items: OrderItem[];
};

type Props = {
  data: OrderRow[];
  canComplete: boolean;
};

function peso(n: number) {
  return `₱${n.toFixed(2)}`;
}

export function ProductionQueueTable({ data, canComplete }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [viewing, setViewing] = useState<OrderRow | null>(null);
  const [completing, setCompleting] = useState<OrderRow | null>(null);
  const [receiptNumber, setReceiptNumber] = useState("");
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    router.refresh();
  }

  function openComplete(row: OrderRow) {
    setReceiptNumber("");
    setError(null);
    setCompleting(row);
  }

  function handleComplete() {
    if (!completing) return;
    startTransition(async () => {
      const res = await completeOrder(completing.id, receiptNumber);
      if (!res.success) {
        setError(res.error);
      } else {
        setCompleting(null);
        refresh();
      }
    });
  }

  const columns: Column<OrderRow>[] = [
    {
      key: "customerName",
      header: "Customer",
      sortable: true,
      render: (value) =>
        (value as string) || <span className="text-(--color-text-subtle)">Walk-in</span>,
    },
    {
      key: "items",
      header: "Items",
      render: (value) => {
        const items = value as OrderItem[];
        return `${items.length} item${items.length === 1 ? "" : "s"}`;
      },
    },
    {
      key: "totalMoney",
      header: "Total",
      sortable: true,
      render: (value) => peso(value as number),
    },
    {
      key: "createdAt",
      header: "In Production Since",
      sortable: true,
      render: (value) => new Date(value as string).toLocaleDateString(),
    },
    {
      key: "id",
      header: "Actions",
      render: (_value, row) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setViewing(row)}>
            View
          </Button>
          {canComplete && (
            <Button variant="ghost" size="sm" disabled={isPending} onClick={() => openComplete(row)}>
              Mark Completed
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Production Queue"
        description="Orders currently in production. Mark an order completed once fulfilment is done."
      />

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search orders…"
        emptyMessage="No orders in production"
        emptyDescription="Orders moved to production from Order List will appear here."
      />

      <Dialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>
              {viewing?.customerName ?? "Walk-in customer"}
              {viewing?.note ? ` — ${viewing.note}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {viewing?.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm text-(--color-text)">
                <span>
                  {item.name} × {item.quantity}
                </span>
                <span>{peso(item.quantity * item.unitPrice - item.discount)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-(--color-border) pt-2 text-sm font-medium text-(--color-text)">
              <span>Total</span>
              <span>{peso(viewing?.totalMoney ?? 0)}</span>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(completing)} onOpenChange={(open) => !open && setCompleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Order Completed</DialogTitle>
            <DialogDescription>
              {completing?.customerName ?? "Walk-in customer"} — {peso(completing?.totalMoney ?? 0)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              label="Loyverse Receipt # (optional)"
              placeholder="e.g. 1001-1234"
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
            />
            <p className="text-xs text-(--color-text-subtle)">
              Automatic Loyverse sync is currently disabled. If this order was rung up in
              Loyverse, enter its receipt number here to link the two records manually —
              otherwise leave this blank.
            </p>
            {error && <p className="text-sm text-(--color-danger)">{error}</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" disabled={isPending} onClick={handleComplete}>
              Mark Completed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
