"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { TextArea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils/format-date";
import { Select } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { CurrencyInput } from "@/components/ui/currency-input";
import { ItemForm, type VariantOption } from "./item-form";
import { updatePurchaseOrderHeader, setPurchaseOrderStatus, removePurchaseOrderItem } from "../actions";

export type PurchaseOrderDetailData = {
  id: string;
  reference: string;
  status: string;
  order_date: string;
  expected_date: string | null;
  subtotal: number;
  shipping_fee: number;
  discount_amount: number;
  total: number;
  note: string | null;
  supplier_id: string;
  supplier_name: string;
};

export type PurchaseOrderItemRow = {
  id: string;
  label: string;
  sku: string | null;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  discount_amount: number;
  line_total: number;
};

const STATUS_VARIANT: Record<string, "neutral" | "success" | "warning" | "danger" | "default"> = {
  draft: "neutral",
  sent: "default",
  partial: "warning",
  received: "success",
  closed: "success",
  cancelled: "danger",
};

const NEXT_STATUS: Record<string, { status: string; label: string }[]> = {
  draft: [
    { status: "sent", label: "Mark as Sent" },
    { status: "cancelled", label: "Cancel" },
  ],
  sent: [{ status: "cancelled", label: "Cancel" }],
  partial: [],
  received: [{ status: "closed", label: "Close" }],
  closed: [],
  cancelled: [],
};

type Props = {
  po: PurchaseOrderDetailData;
  items: PurchaseOrderItemRow[];
  suppliers: { id: string; name: string }[];
  variantOptions: VariantOption[];
  canWrite: boolean;
  canDelete: boolean;
};

export function PurchaseOrderDetail({ po, items, suppliers, variantOptions, canWrite, canDelete }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<{ status: string; label: string } | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<PurchaseOrderItemRow | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  function refresh() {
    router.refresh();
  }

  function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEditError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updatePurchaseOrderHeader(po.id, po.reference, formData);
      if (res.success) {
        refresh();
        setEditOpen(false);
      } else {
        setEditError(res.error);
      }
    });
  }

  function confirmStatusChange() {
    if (!statusTarget) return;
    setStatusError(null);
    startTransition(async () => {
      const res = await setPurchaseOrderStatus(po.id, po.reference, statusTarget.status);
      if (res.success) {
        setStatusTarget(null);
        refresh();
      } else {
        setStatusError(res.error);
      }
    });
  }

  function confirmRemoveItem() {
    if (!removeTarget) return;
    setRemoveError(null);
    startTransition(async () => {
      const res = await removePurchaseOrderItem(po.id, po.reference, removeTarget.id);
      if (res.success) {
        setRemoveTarget(null);
        refresh();
      } else {
        setRemoveError(res.error);
      }
    });
  }

  const canEditHeader = canWrite && po.status === "draft";
  const canEditItems = canWrite && po.status === "draft";
  const transitions = canWrite ? NEXT_STATUS[po.status] ?? [] : [];

  const columns: Column<PurchaseOrderItemRow>[] = [
    {
      key: "label",
      header: "Item",
      render: (value, row) => (
        <div>
          <p className="font-medium text-(--color-text)">{String(value)}</p>
          {row.sku && <p className="text-xs text-(--color-text-muted)">{row.sku}</p>}
        </div>
      ),
    },
    { key: "quantity_ordered", header: "Ordered" },
    { key: "quantity_received", header: "Received" },
    {
      key: "unit_cost",
      header: "Unit Cost",
      render: (value) => `₱${Number(value).toFixed(2)}`,
    },
    {
      key: "discount_amount",
      header: "Discount",
      render: (value) => `₱${Number(value).toFixed(2)}`,
    },
    {
      key: "line_total",
      header: "Line Total",
      render: (value) => `₱${Number(value).toFixed(2)}`,
    },
    {
      key: "id",
      header: "Actions",
      render: (_value, row) =>
        canEditItems && canDelete && row.quantity_received === 0 ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-(--color-danger)"
            onClick={() => {
              setRemoveTarget(row);
              setRemoveError(null);
            }}
          >
            Remove
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/purchasing/inventory-po" className="text-sm text-(--color-primary) hover:underline">
          ← Purchase Orders
        </Link>
      </div>

      <PageHeader
        title={po.reference}
        description={`Supplier: ${po.supplier_name}`}
        actions={
          <div className="flex items-center gap-2">
            {canEditHeader && (
              <Button variant="secondary" onClick={() => setEditOpen(true)}>
                Edit
              </Button>
            )}
            {transitions.map((t) => (
              <Button
                key={t.status}
                variant="secondary"
                disabled={isPending}
                onClick={() => {
                  setStatusTarget(t);
                  setStatusError(null);
                }}
              >
                {t.label}
              </Button>
            ))}
            {(po.status === "sent" || po.status === "partial") && (
              <Link href={`/dashboard/purchasing/receiving/${po.reference}`}>
                <Button>Receive</Button>
              </Link>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-(--color-text-muted)">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={STATUS_VARIANT[po.status] ?? "neutral"}>{po.status}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-(--color-text-muted)">Order / Expected</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-(--color-text)">
            {formatDate(po.order_date)} {po.expected_date ? `→ ${formatDate(po.expected_date)}` : ""}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-(--color-text-muted)">Subtotal / Fees</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-(--color-text)">
            ₱{Number(po.subtotal).toFixed(2)} net (₱{Number(po.discount_amount).toFixed(2)} item discounts) + ₱
            {Number(po.shipping_fee).toFixed(2)} shipping
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-(--color-text-muted)">Total</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold text-(--color-text)">
            ₱{Number(po.total).toFixed(2)}
          </CardContent>
        </Card>
      </div>

      {po.note && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-text-muted)">{po.note}</CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-(--color-text)">Line Items</h2>
          {canEditItems && <Button onClick={() => setItemFormOpen(true)}>Add Item</Button>}
        </div>
        <DataTable
          columns={columns}
          data={items}
          searchable={false}
          emptyMessage="No line items yet"
          emptyDescription="Add items to this purchase order."
        />
      </div>

      {canEditHeader && (
        <Dialog
          open={editOpen}
          onOpenChange={(next) => {
            setEditOpen(next);
            if (!next) setEditError(null);
          }}
        >
          <DialogContent>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <DialogHeader>
                <DialogTitle>Edit Purchase Order</DialogTitle>
                <DialogDescription>Update this order&apos;s header details.</DialogDescription>
              </DialogHeader>

              <Select
                label="Supplier"
                name="supplier_id"
                defaultValue={po.supplier_id}
                options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                required
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DatePicker label="Order Date" name="order_date" defaultValue={po.order_date} required />
                <DatePicker label="Expected Date" name="expected_date" defaultValue={po.expected_date ?? ""} />
              </div>
              <CurrencyInput label="Shipping Fee" name="shipping_fee" defaultValue={po.shipping_fee} />
              <TextArea label="Notes" name="note" rows={3} defaultValue={po.note ?? ""} />

              {editError && <p className="text-sm text-(--color-danger)">{editError}</p>}

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="secondary" disabled={isPending}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving…" : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {canEditItems && (
        <ItemForm
          open={itemFormOpen}
          onOpenChange={setItemFormOpen}
          purchaseOrderId={po.id}
          reference={po.reference}
          variantOptions={variantOptions}
          onSaved={refresh}
        />
      )}

      <Dialog
        open={!!statusTarget}
        onOpenChange={(next) => {
          if (!next) {
            setStatusTarget(null);
            setStatusError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Status</DialogTitle>
            <DialogDescription>
              Change status to &quot;{statusTarget?.status}&quot;?
            </DialogDescription>
          </DialogHeader>
          {statusError && <p className="text-sm text-(--color-danger)">{statusError}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" onClick={confirmStatusChange} disabled={isPending}>
              {isPending ? "Updating…" : statusTarget?.label ?? "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!removeTarget}
        onOpenChange={(next) => {
          if (!next) {
            setRemoveTarget(null);
            setRemoveError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Item</DialogTitle>
            <DialogDescription>
              Remove &quot;{removeTarget?.label}&quot; from this order?
            </DialogDescription>
          </DialogHeader>
          {removeError && <p className="text-sm text-(--color-danger)">{removeError}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" variant="danger" onClick={confirmRemoveItem} disabled={isPending}>
              {isPending ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
