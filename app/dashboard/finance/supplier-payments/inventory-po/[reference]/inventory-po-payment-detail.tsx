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
import { Select } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePicker } from "@/components/ui/date-picker";
import { TextArea } from "@/components/ui/textarea";
import { logInventoryPOPayment } from "../../actions";
import { formatDate } from "@/lib/utils/format-date";
import { formatQty, formatCurrency } from "@/lib/utils/format";

export type InventoryPOPaymentDetailData = {
  id: string;
  reference: string;
  payment_status: "unpaid" | "partial" | "paid";
  order_date: string;
  supplier_name: string | null;
  total_payable: number;
};

export type ReceivedLineRow = {
  id: string;
  reference: string;
  item_name: string;
  variant_label: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  shipping_fee: number;
  discount_amount: number;
  date_received: string;
};

export type PaymentRow = { id: string; amount: number; paid_date: string; notes: string | null; payment_type_name: string | null };

type Option = { id: string; name: string };

const STATUS_VARIANT: Record<InventoryPOPaymentDetailData["payment_status"], "danger" | "warning" | "success"> = {
  unpaid: "danger",
  partial: "warning",
  paid: "success",
};

type Props = {
  po: InventoryPOPaymentDetailData;
  lines: ReceivedLineRow[];
  payments: PaymentRow[];
  remainingBalance: number;
  paymentTypes: Option[];
  canPay: boolean;
};

export function InventoryPOPaymentDetail({ po, lines, payments, remainingBalance, paymentTypes, canPay }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [payOpen, setPayOpen] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const canShowPay = canPay && po.payment_status !== "paid";

  function handlePaySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPayError(null);
    const formData = new FormData(e.currentTarget);
    const paymentTypeId = (formData.get("payment_type_id") as string) || null;
    const amount = Number(formData.get("amount"));
    const paidDate = formData.get("paid_date") as string;
    const notes = (formData.get("notes") as string) || null;
    startTransition(async () => {
      const res = await logInventoryPOPayment(po.id, po.reference, paymentTypeId, amount, paidDate, notes);
      if (res.success) {
        setPayOpen(false);
        router.refresh();
      } else {
        setPayError(res.error);
      }
    });
  }

  const totalShipping = lines.reduce((s, l) => s + l.shipping_fee, 0);

  const columns: Column<ReceivedLineRow>[] = [
    {
      key: "item_name",
      header: "Item",
      render: (value, row) => (
        <div>
          <p className="font-medium text-(--color-text)">{String(value)}</p>
          {row.variant_label && <p className="text-xs text-(--color-text-muted)">{row.variant_label}</p>}
        </div>
      ),
    },
    { key: "reference", header: "Receiving No." },
    { key: "date_received", header: "Date", render: (value) => formatDate(value as string) },
    { key: "quantity", header: "Qty", render: (value) => formatQty(value as number) },
    { key: "unit_price", header: "Unit Price", render: (value) => formatCurrency(value as number) },
    { key: "total_price", header: "Line Total", render: (value) => formatCurrency(value as number) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/finance/supplier-payments" className="text-sm text-(--color-primary) hover:underline">
          ← Supplier Payment
        </Link>
      </div>

      <PageHeader
        title={po.reference}
        description={po.supplier_name ?? undefined}
        actions={canShowPay ? <Button onClick={() => setPayOpen(true)}>Log Payment</Button> : undefined}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-(--color-text-muted)">Supplier</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-(--color-text)">{po.supplier_name ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-(--color-text-muted)">Order Date</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-(--color-text)">{formatDate(po.order_date)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-(--color-text-muted)">Total</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold text-(--color-text)">
            {formatCurrency(po.total_payable)}
            {totalShipping > 0 && (
              <p className="text-xs font-normal text-(--color-text-muted)">
                incl. {formatCurrency(totalShipping)} shipping
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-(--color-text-muted)">Payment Status</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[po.payment_status]}>
              {po.payment_status.charAt(0).toUpperCase() + po.payment_status.slice(1)}
            </Badge>
            {po.payment_status !== "paid" && (
              <span className="text-xs text-(--color-text-muted)">{formatCurrency(remainingBalance)} remaining</span>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 text-sm text-(--color-text-muted)">
          Source:{" "}
          <Link
            href={`/dashboard/purchasing/inventory-po/${po.reference}`}
            className="text-(--color-primary) hover:underline"
          >
            {po.reference}
          </Link>{" "}
          · owed reflects what&apos;s been received so far — grows as more of the order arrives.
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-(--color-text)">Received Items</h2>
        <DataTable
          columns={columns}
          data={lines}
          searchable={false}
          emptyMessage="Nothing received yet"
          emptyDescription="Receiving lines for this PO will appear here as they come in."
        />
      </div>

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
              <p className="font-medium text-(--color-text)">{formatCurrency(p.amount)}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {canShowPay && (
        <Dialog open={payOpen} onOpenChange={(next) => { setPayOpen(next); if (!next) setPayError(null); }}>
          <DialogContent>
            <form onSubmit={handlePaySubmit} className="space-y-4">
              <DialogHeader>
                <DialogTitle>Log Payment</DialogTitle>
                <DialogDescription>{formatCurrency(remainingBalance)} remaining on this order.</DialogDescription>
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
