"use client";

import { useState } from "react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/utils/format-date";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

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
  completedAt: string;
  loyverseReceiptNumber: string | null;
  items: OrderItem[];
};

type Props = {
  data: OrderRow[];
};

function peso(n: number) {
  return `₱${n.toFixed(2)}`;
}

export function CompletedOrdersTable({ data }: Props) {
  const [viewing, setViewing] = useState<OrderRow | null>(null);

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
      key: "loyverseReceiptNumber",
      header: "Loyverse Receipt",
      render: (value) =>
        value ? (
          <Badge variant="success">{value as string}</Badge>
        ) : (
          <span className="text-(--color-text-subtle)">—</span>
        ),
    },
    {
      key: "completedAt",
      header: "Completed",
      sortable: true,
      render: (value) => formatDate(value as string),
    },
    {
      key: "id",
      header: "Actions",
      render: (_value, row) => (
        <Button variant="ghost" size="sm" onClick={() => setViewing(row)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Completed"
        description="Archive of fulfilled orders."
      />

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search orders…"
        emptyMessage="No completed orders yet"
        emptyDescription="Orders marked completed from Production will appear here."
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
            {viewing?.loyverseReceiptNumber && (
              <div className="flex justify-between text-sm text-(--color-text-muted)">
                <span>Loyverse Receipt</span>
                <span>{viewing.loyverseReceiptNumber}</span>
              </div>
            )}
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
    </div>
  );
}
