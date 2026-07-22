"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { formatQty, formatCurrency } from "@/lib/utils/format";
import { Select } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { CurrencyInput } from "@/components/ui/currency-input";
import { NumberInput } from "@/components/ui/number-input";
import { ItemForm, type CategoryOption } from "./item-form";
import {
  updateAssetPurchaseOrderHeader,
  setAssetPurchaseOrderStatus,
  removeAssetPurchaseOrderItem,
  receiveAssetPurchaseOrder,
  deleteAssetPurchaseOrder,
  type ReceiveLine,
} from "../actions";

export type AssetPODetailData = {
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
  supplier_id: string | null;
  supplier_name: string;
};

export type AssetPOItemRow = {
  id: string;
  category_name: string;
  default_useful_life_months: number | null;
  description: string;
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
  cancelled: "danger",
};

const NEXT_STATUS: Record<string, { status: string; label: string }[]> = {
  draft: [
    { status: "sent", label: "Approve & Send" },
    { status: "cancelled", label: "Cancel Order" },
  ],
  sent: [{ status: "cancelled", label: "Cancel Order" }],
  partial: [],
  received: [],
  cancelled: [],
};

type Props = {
  po: AssetPODetailData;
  items: AssetPOItemRow[];
  suppliers: { id: string; name: string }[];
  categories: CategoryOption[];
  canWrite: boolean;
  canDelete: boolean;
  canReceive: boolean;
};

type ReceiveRowState = { quantity: string; usefulLife: string; salvage: string };

export function AssetPODetail({ po, items, suppliers, categories, canWrite, canDelete, canReceive }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<{ status: string; label: string } | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<AssetPOItemRow | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveError, setReceiveError] = useState<string | null>(null);
  const [receiveRows, setReceiveRows] = useState<Record<string, ReceiveRowState>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function refresh() {
    router.refresh();
  }

  function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEditError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateAssetPurchaseOrderHeader(po.id, po.reference, formData);
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
      const res = await setAssetPurchaseOrderStatus(po.id, po.reference, statusTarget.status);
      if (res.success) {
        setStatusTarget(null);
        refresh();
      } else {
        setStatusError(res.error);
      }
    });
  }

  /** Benign, non-destructive transitions (draft → sent) run directly — no confirm dialog. */
  function runStatusChange(target: { status: string; label: string }) {
    setStatusError(null);
    startTransition(async () => {
      const res = await setAssetPurchaseOrderStatus(po.id, po.reference, target.status);
      if (res.success) {
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
      const res = await removeAssetPurchaseOrderItem(po.id, po.reference, removeTarget.id);
      if (res.success) {
        setRemoveTarget(null);
        refresh();
      } else {
        setRemoveError(res.error);
      }
    });
  }

  function openReceiveDialog() {
    const defaults: Record<string, ReceiveRowState> = {};
    for (const item of receivableItems) {
      defaults[item.id] = {
        quantity: String(item.quantity_ordered - item.quantity_received),
        usefulLife: item.default_useful_life_months != null ? String(item.default_useful_life_months) : "",
        salvage: "0",
      };
    }
    setReceiveRows(defaults);
    setReceiveError(null);
    setReceiveOpen(true);
  }

  function confirmReceive() {
    setReceiveError(null);

    const missingUsefulLife = receivableItems.filter((item) => {
      const row = receiveRows[item.id];
      if (!(Number(row?.quantity) > 0)) return false;
      return !(Number(row?.usefulLife) > 0);
    });

    if (missingUsefulLife.length > 0) {
      setReceiveError(
        `Enter a useful life (months) for: ${missingUsefulLife.map((i) => i.description).join(", ")}.`
      );
      return;
    }

    const lines: ReceiveLine[] = receivableItems
      .map((item) => {
        const row = receiveRows[item.id];
        return {
          po_item_id: item.id,
          quantity: Number(row?.quantity) || 0,
          useful_life_months: Number(row?.usefulLife) || undefined,
          salvage_value: row?.salvage ? Number(row.salvage) : undefined,
        };
      })
      .filter((l) => l.quantity > 0);

    if (lines.length === 0) {
      setReceiveError("Enter a quantity greater than zero for at least one line.");
      return;
    }

    startTransition(async () => {
      const res = await receiveAssetPurchaseOrder(po.id, po.reference, lines);
      if (res.success) {
        setReceiveOpen(false);
        refresh();
      } else {
        setReceiveError(res.error);
      }
    });
  }

  function confirmDelete() {
    setDeleteError(null);
    startTransition(async () => {
      const res = await deleteAssetPurchaseOrder(po.id);
      if (res.success) {
        router.push("/dashboard/purchasing/asset-po");
      } else {
        setDeleteError(res.error);
      }
    });
  }

  const canEditHeader = canWrite && po.status === "draft";
  const canEditItems = canWrite && po.status === "draft";
  const transitions = canWrite ? NEXT_STATUS[po.status] ?? [] : [];
  const receivableItems = items.filter((i) => i.quantity_received < i.quantity_ordered);
  const canShowReceive = canReceive && (po.status === "sent" || po.status === "partial") && receivableItems.length > 0;

  const columns: Column<AssetPOItemRow>[] = [
    {
      key: "description",
      header: "Description",
      render: (value, row) => (
        <div>
          <p className="font-medium text-(--color-text)">{String(value)}</p>
          <p className="text-xs text-(--color-text-muted)">{row.category_name}</p>
        </div>
      ),
    },
    { key: "quantity_ordered", header: "Ordered", render: (value) => formatQty(value as number) },
    { key: "quantity_received", header: "Received", render: (value) => formatQty(value as number) },
    { key: "unit_cost", header: "Unit Cost", render: (value) => formatCurrency(value as number) },
    { key: "discount_amount", header: "Discount", render: (value) => formatCurrency(value as number) },
    { key: "line_total", header: "Line Total", render: (value) => formatCurrency(value as number) },
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
      <PageHeader
        title={po.reference}
        description={`Supplier: ${po.supplier_name}`}
        backHref="/dashboard/purchasing/asset-po"
        backLabel="Back to Asset PO"
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
                  if (t.status === "sent") {
                    runStatusChange(t);
                  } else {
                    setStatusTarget(t);
                    setStatusError(null);
                  }
                }}
              >
                {isPending && t.status === "sent" ? "Updating…" : t.label}
              </Button>
            ))}
            {canShowReceive && <Button onClick={openReceiveDialog}>Receive</Button>}
            {canDelete && po.status === "draft" && (
              <Button
                variant="secondary"
                className="text-(--color-danger)"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteOpen(true);
                }}
              >
                Delete
              </Button>
            )}
          </div>
        }
      />

      {statusError && !statusTarget && (
        <p className="text-sm text-(--color-danger)">{statusError}</p>
      )}

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
            {formatCurrency(po.subtotal)} net + {formatCurrency(po.shipping_fee)} shipping
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-(--color-text-muted)">Total</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold text-(--color-text)">
            {formatCurrency(po.total)}
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
          stickyHeader
          emptyMessage="No line items yet"
          emptyDescription="Add items to this purchase order."
        />
      </div>

      {canEditHeader && (
        <Dialog open={editOpen} onOpenChange={(next) => { setEditOpen(next); if (!next) setEditError(null); }}>
          <DialogContent>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <DialogHeader>
                <DialogTitle>Edit Asset PO</DialogTitle>
                <DialogDescription>Update this order&apos;s header details.</DialogDescription>
              </DialogHeader>

              <Select
                label="Supplier (optional)"
                name="supplier_id"
                defaultValue={po.supplier_id ?? ""}
                options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
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
                  <Button type="button" variant="secondary" disabled={isPending}>Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isPending}>{isPending ? "Saving…" : "Save Changes"}</Button>
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
          categories={categories}
          onSaved={refresh}
        />
      )}

      <Dialog open={!!statusTarget} onOpenChange={(next) => { if (!next) { setStatusTarget(null); setStatusError(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Status</DialogTitle>
            <DialogDescription>Change status to &quot;{statusTarget?.status}&quot;?</DialogDescription>
          </DialogHeader>
          {statusError && <p className="text-sm text-(--color-danger)">{statusError}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>Cancel</Button>
            </DialogClose>
            <Button type="button" onClick={confirmStatusChange} disabled={isPending}>
              {isPending ? "Updating…" : statusTarget?.label ?? "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!removeTarget} onOpenChange={(next) => { if (!next) { setRemoveTarget(null); setRemoveError(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Item</DialogTitle>
            <DialogDescription>Remove &quot;{removeTarget?.description}&quot; from this order?</DialogDescription>
          </DialogHeader>
          {removeError && <p className="text-sm text-(--color-danger)">{removeError}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>Cancel</Button>
            </DialogClose>
            <Button type="button" variant="danger" onClick={confirmRemoveItem} disabled={isPending}>
              {isPending ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={receiveOpen} onOpenChange={(next) => { if (!next) { setReceiveOpen(false); setReceiveError(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Receive Asset PO</DialogTitle>
            <DialogDescription>
              Each line becomes its own fixed asset in Finance → Fixed Assets, depreciated individually. Confirm
              or override the useful life and salvage value.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {receivableItems.map((item) => {
              const row = receiveRows[item.id] ?? { quantity: "0", usefulLife: "", salvage: "0" };
              return (
                <div key={item.id} className="space-y-2 border-b border-(--color-border) pb-3 last:border-0">
                  <p className="text-sm font-medium text-(--color-text)">{item.description}</p>
                  <p className="text-xs text-(--color-text-muted)">
                    Remaining: {item.quantity_ordered - item.quantity_received} · {item.category_name}
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <NumberInput
                      label="Quantity"
                      min={0}
                      max={item.quantity_ordered - item.quantity_received}
                      step="any"
                      decimals={3}
                      value={row.quantity}
                      onChange={(e) => setReceiveRows((prev) => ({ ...prev, [item.id]: { ...row, quantity: e.target.value } }))}
                    />
                    <NumberInput
                      label="Useful Life (months)"
                      min={1}
                      value={row.usefulLife}
                      onChange={(e) => setReceiveRows((prev) => ({ ...prev, [item.id]: { ...row, usefulLife: e.target.value } }))}
                    />
                    <CurrencyInput
                      label="Salvage Value"
                      value={row.salvage}
                      onChange={(e) => setReceiveRows((prev) => ({ ...prev, [item.id]: { ...row, salvage: e.target.value } }))}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {receiveError && <p className="text-sm text-(--color-danger)">{receiveError}</p>}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>Cancel</Button>
            </DialogClose>
            <Button type="button" onClick={confirmReceive} disabled={isPending}>
              {isPending ? "Receiving…" : "Post Receipt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={(next) => { setDeleteOpen(next); if (!next) setDeleteError(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Asset PO</DialogTitle>
            <DialogDescription>
              Delete asset purchase order &quot;{po.reference}&quot;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && <p className="text-sm text-(--color-danger)">{deleteError}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>Cancel</Button>
            </DialogClose>
            <Button type="button" variant="danger" onClick={confirmDelete} disabled={isPending}>
              {isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
