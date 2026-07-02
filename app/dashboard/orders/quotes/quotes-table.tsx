"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DataTable, type Column } from "@/components/ui/data-table";
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
import { confirmQuote, cancelQuote, deleteQuote } from "./actions";

export type QuoteItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
};

export type QuoteRow = {
  id: string;
  customerName: string | null;
  note: string | null;
  totalMoney: number;
  createdAt: string;
  canEdit: boolean;
  canCancel: boolean;
  items: QuoteItem[];
};

type Props = {
  data: QuoteRow[];
  canCreate: boolean;
  canConfirm: boolean;
  canDelete: boolean;
};

function peso(n: number) {
  return `₱${n.toFixed(2)}`;
}

export function QuotesTable({ data, canCreate, canConfirm, canDelete }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [viewing, setViewing] = useState<QuoteRow | null>(null);

  function refresh() {
    router.refresh();
  }

  function handleConfirm(row: QuoteRow) {
    if (!confirm(`Confirm quote for ${row.customerName ?? "walk-in customer"}? This will deduct stock.`)) return;
    startTransition(async () => {
      const res = await confirmQuote(row.id);
      if (!res.success) alert(res.error);
      else refresh();
    });
  }

  function handleCancel(row: QuoteRow) {
    if (!confirm("Cancel this quote?")) return;
    startTransition(async () => {
      const res = await cancelQuote(row.id);
      if (!res.success) alert(res.error);
      else refresh();
    });
  }

  function handleDelete(row: QuoteRow) {
    if (!confirm("Delete this quote permanently?")) return;
    startTransition(async () => {
      const res = await deleteQuote(row.id);
      if (!res.success) alert(res.error);
      else refresh();
    });
  }

  const columns: Column<QuoteRow>[] = [
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
        const items = value as QuoteItem[];
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
          {row.canEdit && (
            <Link href={`/dashboard/orders/quotes/${row.id}/edit`}>
              <Button variant="ghost" size="sm">
                Edit
              </Button>
            </Link>
          )}
          {canConfirm && (
            <Button variant="ghost" size="sm" disabled={isPending} onClick={() => handleConfirm(row)}>
              Confirm
            </Button>
          )}
          {row.canCancel && (
            <Button
              variant="ghost"
              size="sm"
              className="text-(--color-danger)"
              disabled={isPending}
              onClick={() => handleCancel(row)}
            >
              Cancel
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="text-(--color-danger)"
              disabled={isPending}
              onClick={() => handleDelete(row)}
            >
              Delete
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Quotes"
        description="Draft quotes awaiting confirmation. Confirming deducts stock and moves the order to the Order List."
        actions={
          canCreate ? (
            <Link href="/dashboard/orders/quotes/new">
              <Button>New Quote</Button>
            </Link>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search quotes…"
        emptyMessage="No quotes yet"
        emptyDescription="Create a quote to get started."
      />

      <Dialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quote Details</DialogTitle>
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
