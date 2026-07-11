"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePicker } from "@/components/ui/date-picker";
import { Select } from "@/components/ui/select";
import { TextArea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { addOrderPayment, closeOrderPayment } from "../actions";

export type OrderPaymentRow = {
  id: string;
  paymentDate: string;
  amount: number;
  paymentTypeName: string | null;
  referenceNo: string | null;
  createdAt: string;
};

export type OrderPaymentsData = {
  id: string;
  orderNumber: string;
  totalMoney: number;
  payments: OrderPaymentRow[];
  paymentTypeOptions: { id: string; name: string }[];
  canAddPayment: boolean;
  canClosePayment: boolean;
  isClosed: boolean;
  paymentClosedAt: string | null;
  paymentClosedByName: string | null;
  paymentCloseNote: string | null;
  tipAmount: number;
};

const PAYMENT_STATUS_VARIANT: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  Unpaid: "danger",
  "Partially Paid": "warning",
  Paid: "success",
  Overpaid: "neutral",
};

function peso(n: number) {
  return `₱${n.toFixed(2)}`;
}

function paymentStatus(totalPaid: number, totalMoney: number): keyof typeof PAYMENT_STATUS_VARIANT {
  if (totalPaid <= 0) return "Unpaid";
  if (totalPaid < totalMoney) return "Partially Paid";
  if (totalPaid > totalMoney) return "Overpaid";
  return "Paid";
}

export function OrderPayments({ data, onChanged }: { data: OrderPaymentsData; onChanged: () => void }) {
  const [isPending, startTransition] = useTransition();

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentTypeId, setPaymentTypeId] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const [closeOpen, setCloseOpen] = useState(false);
  const [closeNote, setCloseNote] = useState("");
  const [closeError, setCloseError] = useState<string | null>(null);

  const totalPaid = useMemo(() => data.payments.reduce((sum, p) => sum + p.amount, 0), [data.payments]);
  const remainingBalance = Math.max(0, data.totalMoney - totalPaid);
  const change = Math.max(0, totalPaid - data.totalMoney);
  const payStatus = paymentStatus(totalPaid, data.totalMoney);
  const noteRequired = payStatus === "Partially Paid";
  const canClose = data.canClosePayment && !data.isClosed && payStatus !== "Unpaid";

  function handleAddPayment() {
    setPaymentError(null);
    const amount = Number(paymentAmount);
    if (!(amount > 0)) {
      setPaymentError("Enter a valid payment amount.");
      return;
    }
    startTransition(async () => {
      const res = await addOrderPayment(data.id, {
        paymentDate,
        amount,
        paymentTypeId: paymentTypeId || null,
        referenceNo: referenceNo.trim() || null,
      });
      if (!res.success) {
        setPaymentError(res.error);
      } else {
        setPaymentOpen(false);
        setPaymentAmount("");
        setPaymentTypeId("");
        setReferenceNo("");
        onChanged();
      }
    });
  }

  function handleClosePayment() {
    setCloseError(null);
    if (noteRequired && !closeNote.trim()) {
      setCloseError("A note is required to close a partially paid order.");
      return;
    }
    startTransition(async () => {
      const res = await closeOrderPayment(data.id, data.orderNumber, closeNote.trim() || null);
      if (!res.success) {
        setCloseError(res.error);
      } else {
        setCloseOpen(false);
        setCloseNote("");
        onChanged();
      }
    });
  }

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Payments</CardTitle>
            <CardDescription>Append-only payment history for this order.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Link href={`/dashboard/orders/payment/${data.orderNumber}/preview`}>
              <Button variant="secondary">Payment Preview</Button>
            </Link>
            {data.canAddPayment && !data.isClosed && (
              <Button onClick={() => setPaymentOpen(true)}>Add Payment</Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.isClosed && (
            <div className="rounded-md border border-(--color-border) p-3 text-sm">
              <p className="font-medium text-(--color-text)">
                Payment closed {data.paymentClosedAt ? new Date(data.paymentClosedAt).toLocaleString() : ""}
                {data.paymentClosedByName ? ` by ${data.paymentClosedByName}` : ""}
              </p>
              {data.paymentCloseNote && (
                <p className="text-(--color-text-muted)">Note: {data.paymentCloseNote}</p>
              )}
              {data.tipAmount > 0 && (
                <p className="text-(--color-text-muted)">Tip recorded: {peso(data.tipAmount)}</p>
              )}
            </div>
          )}

          {data.payments.length === 0 && <p className="text-sm text-(--color-text-muted)">No payments recorded yet.</p>}
          {data.payments.map((p) => (
            <div key={p.id} className="flex justify-between border-b border-(--color-border) pb-2 text-sm last:border-0">
              <span className="text-(--color-text)">
                {p.paymentDate} · {p.paymentTypeName ?? "Unspecified"}
                {p.referenceNo ? ` (${p.referenceNo})` : ""}
              </span>
              <span className="font-medium text-(--color-text)">{peso(p.amount)}</span>
            </div>
          ))}
          <div className="space-y-1 border-t border-(--color-border) pt-3 text-sm">
            <div className="flex justify-between text-(--color-text-muted)">
              <span>Total Paid</span>
              <span>{peso(totalPaid)}</span>
            </div>
            <div className="flex justify-between text-(--color-text-muted)">
              <span>Remaining Balance</span>
              <span>{peso(remainingBalance)}</span>
            </div>
            {change > 0 && (
              <div className="flex justify-between text-(--color-text-muted)">
                <span>Change</span>
                <span>{peso(change)}</span>
              </div>
            )}
            <div className="flex items-center justify-between font-medium text-(--color-text)">
              <span>Payment Status</span>
              <Badge variant={PAYMENT_STATUS_VARIANT[payStatus]}>{payStatus}</Badge>
            </div>
          </div>
          {canClose && (
            <div className="flex justify-end pt-1">
              <Button variant="secondary" onClick={() => setCloseOpen(true)}>
                Close Payment
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={paymentOpen}
        onOpenChange={(next) => {
          setPaymentOpen(next);
          if (!next) setPaymentError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Payment</DialogTitle>
            <DialogDescription>Record a payment received for {data.orderNumber}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <DatePicker label="Payment Date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            <CurrencyInput
              label="Amount"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
            />
            <Select
              label="Payment Type"
              placeholder="Select payment type…"
              value={paymentTypeId}
              onChange={(e) => setPaymentTypeId(e.target.value)}
              options={data.paymentTypeOptions.map((pt) => ({ value: pt.id, label: pt.name }))}
            />
            <Input
              label="Reference No. (optional)"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
            />
          </div>
          {paymentError && <p className="text-sm text-(--color-danger)">{paymentError}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" disabled={isPending} onClick={handleAddPayment}>
              {isPending ? "Saving…" : "Save Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={closeOpen}
        onOpenChange={(next) => {
          setCloseOpen(next);
          if (!next) setCloseError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close Payment</DialogTitle>
            <DialogDescription>
              {payStatus === "Overpaid"
                ? `This order is overpaid by ${peso(change)} — the excess will be recorded as a tip.`
                : payStatus === "Partially Paid"
                  ? "This order is only partially paid. A note is required to close it — use this for cases like the customer no longer responding after shipment."
                  : `Close payment for ${data.orderNumber}. Current status: ${payStatus}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <TextArea
              label={noteRequired ? "Note (required)" : "Note (optional)"}
              value={closeNote}
              onChange={(e) => setCloseNote(e.target.value)}
              placeholder={noteRequired ? "Why is this being closed while only partially paid?" : undefined}
            />
          </div>
          {closeError && <p className="text-sm text-(--color-danger)">{closeError}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" disabled={isPending} onClick={handleClosePayment}>
              {isPending ? "Closing…" : "Close Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
