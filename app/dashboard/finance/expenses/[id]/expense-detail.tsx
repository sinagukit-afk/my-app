"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePicker } from "@/components/ui/date-picker";
import { TextArea } from "@/components/ui/textarea";
import {
  updateDirectExpense,
  deleteExpense,
  logExpensePayment,
  uploadExpenseAttachment,
  getAttachmentUrl,
} from "../actions";
import { formatDate } from "@/lib/utils/format-date";

export type ExpenseDetailData = {
  id: string;
  expense_number: string;
  description: string;
  amount: number;
  expense_date: string;
  payment_status: "unpaid" | "partial" | "paid";
  source: "direct" | "purchase_order";
  category_id: string;
  category_name: string;
  supplier_id: string | null;
  supplier_name: string | null;
  purchase_order_reference: string | null;
};

export type AttachmentRow = { id: string; file_name: string; file_path: string; created_at: string };
export type PaymentRow = { id: string; amount: number; paid_date: string; notes: string | null; payment_type_name: string | null };

type Option = { id: string; name: string };

const STATUS_VARIANT: Record<ExpenseDetailData["payment_status"], "danger" | "warning" | "success"> = {
  unpaid: "danger",
  partial: "warning",
  paid: "success",
};

type Props = {
  expense: ExpenseDetailData;
  attachments: AttachmentRow[];
  payments: PaymentRow[];
  remainingBalance: number;
  categories: Option[];
  suppliers: Option[];
  paymentTypes: Option[];
  canWrite: boolean;
  canPay: boolean;
};

export function ExpenseDetail({
  expense,
  attachments,
  payments,
  remainingBalance,
  categories,
  suppliers,
  paymentTypes,
  canWrite,
  canPay,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function refresh() {
    router.refresh();
  }

  function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEditError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateDirectExpense(expense.id, formData);
      if (res.success) {
        setEditOpen(false);
        refresh();
      } else {
        setEditError(res.error);
      }
    });
  }

  function confirmDelete() {
    setDeleteError(null);
    startTransition(async () => {
      const res = await deleteExpense(expense.id);
      if (res.success) {
        router.push("/dashboard/finance/expenses");
      } else {
        setDeleteError(res.error);
      }
    });
  }

  function handlePaySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPayError(null);
    const formData = new FormData(e.currentTarget);
    const paymentTypeId = (formData.get("payment_type_id") as string) || null;
    const amount = Number(formData.get("amount"));
    const paidDate = formData.get("paid_date") as string;
    const notes = (formData.get("notes") as string) || null;
    startTransition(async () => {
      const res = await logExpensePayment(expense.id, paymentTypeId, amount, paidDate, notes);
      if (res.success) {
        setPayOpen(false);
        refresh();
      } else {
        setPayError(res.error);
      }
    });
  }

  function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await uploadExpenseAttachment(expense.id, formData);
      if (res.success) {
        if (fileInputRef.current) fileInputRef.current.value = "";
        refresh();
      } else {
        setUploadError(res.error);
      }
    });
  }

  async function openAttachment(filePath: string) {
    const url = await getAttachmentUrl(filePath);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  const canEdit = canWrite && expense.source === "direct";
  const canShowPay = canPay && expense.payment_status !== "paid";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/finance/expenses" className="text-sm text-(--color-primary) hover:underline">
          ← Expenses
        </Link>
      </div>

      <PageHeader
        title={expense.expense_number}
        description={expense.description}
        actions={
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button variant="secondary" onClick={() => setEditOpen(true)}>
                Edit
              </Button>
            )}
            {canWrite && (
              <Button variant="secondary" className="text-(--color-danger)" onClick={() => setDeleteOpen(true)}>
                Delete
              </Button>
            )}
            {canShowPay && <Button onClick={() => setPayOpen(true)}>Log Payment</Button>}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-(--color-text-muted)">Category</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-(--color-text)">{expense.category_name}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-(--color-text-muted)">Supplier</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-(--color-text)">{expense.supplier_name ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-(--color-text-muted)">Amount</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold text-(--color-text)">
            ₱{expense.amount.toFixed(2)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-(--color-text-muted)">Payment Status</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[expense.payment_status]}>
              {expense.payment_status.charAt(0).toUpperCase() + expense.payment_status.slice(1)}
            </Badge>
            {expense.payment_status !== "paid" && (
              <span className="text-xs text-(--color-text-muted)">₱{remainingBalance.toFixed(2)} remaining</span>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 text-sm text-(--color-text-muted)">
          Date: {formatDate(expense.expense_date)} · Source:{" "}
          {expense.source === "direct" ? (
            "Direct Entry"
          ) : (
            <>
              Expense PO{" "}
              {expense.purchase_order_reference && (
                <Link
                  href={`/dashboard/purchasing/expense-po/${expense.purchase_order_reference}`}
                  className="text-(--color-primary) hover:underline"
                >
                  {expense.purchase_order_reference}
                </Link>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {payments.length === 0 && <p className="text-sm text-(--color-text-muted)">No payments logged yet.</p>}
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between border-b border-(--color-border) py-2 text-sm last:border-0">
                <div>
                  <p className="text-(--color-text)">{formatDate(p.paid_date)} · {p.payment_type_name ?? "—"}</p>
                  {p.notes && <p className="text-xs text-(--color-text-muted)">{p.notes}</p>}
                </div>
                <p className="font-medium text-(--color-text)">₱{p.amount.toFixed(2)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attachments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {attachments.length === 0 && <p className="text-sm text-(--color-text-muted)">No attachments yet.</p>}
            {attachments.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => openAttachment(a.file_path)}
                className="block w-full truncate rounded border border-(--color-border) px-3 py-2 text-left text-sm text-(--color-primary) hover:underline"
              >
                {a.file_name}
              </button>
            ))}
            {canPay && (
              <form onSubmit={handleUpload} className="flex items-center gap-2 border-t border-(--color-border) pt-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  name="file"
                  className="flex-1 text-sm text-(--color-text)"
                  required
                />
                <Button type="submit" size="sm" disabled={isPending}>
                  {isPending ? "Uploading…" : "Upload"}
                </Button>
              </form>
            )}
            {uploadError && <p className="text-sm text-(--color-danger)">{uploadError}</p>}
          </CardContent>
        </Card>
      </div>

      {canEdit && (
        <Dialog open={editOpen} onOpenChange={(next) => { setEditOpen(next); if (!next) setEditError(null); }}>
          <DialogContent>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <DialogHeader>
                <DialogTitle>Edit Expense</DialogTitle>
                <DialogDescription>Update this direct-entry expense.</DialogDescription>
              </DialogHeader>

              <Select
                label="Category"
                name="category_id"
                defaultValue={expense.category_id}
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                required
              />
              <Input label="Description" name="description" defaultValue={expense.description} required />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <CurrencyInput label="Amount" name="amount" defaultValue={expense.amount} required />
                <DatePicker label="Date" name="expense_date" defaultValue={expense.expense_date} required />
              </div>
              <Select
                label="Supplier (optional)"
                name="supplier_id"
                defaultValue={expense.supplier_id ?? ""}
                options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
              />

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

      <Dialog open={deleteOpen} onOpenChange={(next) => { setDeleteOpen(next); if (!next) setDeleteError(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Expense</DialogTitle>
            <DialogDescription>Delete &quot;{expense.expense_number}&quot;? This cannot be undone.</DialogDescription>
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

      {canShowPay && (
        <Dialog open={payOpen} onOpenChange={(next) => { setPayOpen(next); if (!next) setPayError(null); }}>
          <DialogContent>
            <form onSubmit={handlePaySubmit} className="space-y-4">
              <DialogHeader>
                <DialogTitle>Log Payment</DialogTitle>
                <DialogDescription>₱{remainingBalance.toFixed(2)} remaining on this expense.</DialogDescription>
              </DialogHeader>

              <Select
                label="Payment Method"
                name="payment_type_id"
                placeholder="Select…"
                options={paymentTypes.map((p) => ({ value: p.id, label: p.name }))}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <CurrencyInput label="Amount" name="amount" defaultValue={remainingBalance} required />
                <DatePicker label="Date Paid" name="paid_date" defaultValue={new Date().toISOString().slice(0, 10)} required />
              </div>
              <TextArea label="Notes" name="notes" rows={2} />

              {payError && <p className="text-sm text-(--color-danger)">{payError}</p>}

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="secondary" disabled={isPending}>Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isPending}>{isPending ? "Saving…" : "Log Payment"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
