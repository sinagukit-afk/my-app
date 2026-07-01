"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { startProduction } from "./actions";

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
  status: "confirmed" | "in_production";
  note: string | null;
  totalMoney: number;
  createdAt: string;
  items: OrderItem[];
};

const STATUS_VARIANT: Record<string, "default" | "warning"> = {
  confirmed: "default",
  in_production: "warning",
};

type Props = {
  data: OrderRow[];
  canAdvance: boolean;
  canEdit: boolean;
};

function peso(n: number) {
  return `₱${n.toFixed(2)}`;
}

export function OrderListTable({ data, canAdvance, canEdit }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [viewing, setViewing] = useState<OrderRow | null>(null);

  function refresh() {
    router.refresh();
  }

  function handleStartProduction(row: OrderRow) {
    if (!confirm("Move this order into production?")) return;
    startTransition(async () => {
      const res = await startProduction(row.id);
      if (!res.success) alert(res.error);
      else refresh();
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
      key: "status",
      header: "Status",
      sortable: true,
      render: (value) => (
        <Badge variant={STATUS_VARIANT[value as string] ?? "neutral"}>
          {(value as string).replace("_", " ")}
        </Badge>
      ),
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
      header: "Created",
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
          {canEdit && (
            <Link href={`/dashboard/orders/order-list/${row.id}/edit`}>
              <Button variant="ghost" size="sm">
                Edit
              </Button>
            </Link>
          )}
          {canAdvance && row.status === "confirmed" && (
            <Button variant="ghost" size="sm" disabled={isPending} onClick={() => handleStartProduction(row)}>
              Start Production
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Order List"
        description="Confirmed customer orders. Move an order into production once work begins."
      />

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search orders…"
        emptyMessage="No active orders"
        emptyDescription="Confirmed quotes will appear here."
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
    </div>
  );
}
