"use client";

import { useEffect, useState, useTransition } from "react";
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
import { Combobox } from "@/components/ui/combobox";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePicker } from "@/components/ui/date-picker";
import { TextArea } from "@/components/ui/textarea";
import { logAssetPayment, voidAssetPayment } from "../actions";
import { formatDate } from "@/lib/utils/format-date";

export type AssetDetailData = {
  id: string;
  asset_code: string;
  name: string;
  category_name: string;
  supplier_name: string | null;
  cost: number;
  payment_status: "unpaid" | "partial" | "paid";
  purchased_date: string;
  purchase_order_reference: string | null;
};

export type PaymentRow = {
  id: string;
  amount: number;
  paid_date: string;
  notes: string | null;
  payment_type_name: string | null;
  voided_at: string | null;
  void_reason: string | null;
};

type Option = { id: string; name: string };

const STATUS_VARIANT: Record<AssetDetailData["payment_status"], "danger" | "warning" | "success"> = {
  unpaid: "danger",
  partial: "warning",
  paid: "success",
};

type Props = {
  asset: AssetDetailData;
  payments: PaymentRow[];
  remainingBalance: number;
  paymentTypes: Option[];
  canPay: boolean;
  canVoid: boolean;
};

export function AssetDetail({ asset, payments, remainingBalance, paymentTypes, canPay, canVoid }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [payOpen, setPayOpen] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [paymentTypeId, setPaymentTypeId] = useState("");
  const [voidTarget, setVoidTarget] = useState<PaymentRow | null>(null);
  const [voidError, setVoidError] = useState<string | null>(null);

  useEffect(() => {
    if (!payOpen) setPaymentTypeId("");
  }, [payOpen]);

  const canShowPay = canPay && asset.payment_status !== "paid";

  function handleVoidSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!voidTarget) return;
    setVoidError(null);
    const reason = (new FormData(e.currentTarget).get("reason") as string) ?? "";
    startTransition(async () => {
      const res = await voidAssetPayment(voidTarget.id, reason, asset.id);
      if (res.success) {
        setVoidTarget(null);
        router.refresh();
      } else {
        setVoidError(res.error);
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
      const res = await logAssetPayment(asset.id, paymentTypeId, amount, paidDate, notes);
      if (res.success) {
        setPayOpen(false);
        router.refresh();
      } else {
        setPayError(res.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={asset.name}
        description={`${asset.asset_code} — Purchased ${formatDate(asset.purchased_date)}`}
        backHref="/dashboard/finance/fixed-assets"
        backLabel="Back to Fixed Assets"
        actions={canShowPay ? <Button onClick={() => setPayOpen(true)}>Log Payment</Button> : undefined}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-(--color-text-muted)">Category</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-(--color-text)">{asset.category_name}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-(--color-text-muted)">Supplier</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-(--color-text)">{asset.supplier_name ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-(--color-text-muted)">Cost</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold text-(--color-text)">
            ₱{asset.cost.toFixed(2)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-(--color-text-muted)">Payment Status</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[asset.payment_status]}>
              {asset.payment_status.charAt(0).toUpperCase() + asset.payment_status.slice(1)}
            </Badge>
            {asset.payment_status !== "paid" && (
              <span className="text-xs text-(--color-text-muted)">₱{remainingBalance.toFixed(2)} remaining</span>
            )}
          </CardContent>
        </Card>
      </div>

      {asset.purchase_order_reference && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-text-muted)">
            Source: Asset PO{" "}
            <Link
              href={`/dashboard/purchasing/asset-po/${asset.purchase_order_reference}`}
              className="text-(--color-primary) hover:underline"
            >
              {asset.purchase_order_reference}
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {payments.length === 0 && <p className="text-sm text-(--color-text-muted)">No payments logged yet.</p>}
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 border-b border-(--color-border) py-2 text-sm last:border-0">
              <div>
                <p className="text-(--color-text)">
                  {formatDate(p.paid_date)} · {p.payment_type_name ?? "—"}
                  {p.voided_at && <Badge variant="danger" className="ml-2">Voided</Badge>}
                </p>
                {p.notes && <p className="text-xs text-(--color-text-muted)">{p.notes}</p>}
                {p.voided_at && p.void_reason && (
                  <p className="text-xs text-(--color-text-muted)">Void reason: {p.void_reason}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <p className={p.voided_at ? "font-medium text-(--color-text-muted) line-through" : "font-medium text-(--color-text)"}>
                  ₱{p.amount.toFixed(2)}
                </p>
                {canVoid && !p.voided_at && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-(--color-danger)"
                    onClick={() => {
                      setVoidTarget(p);
                      setVoidError(null);
                    }}
                  >
                    Void
                  </Button>
                )}
              </div>
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
                <DialogDescription>₱{remainingBalance.toFixed(2)} remaining on this asset.</DialogDescription>
              </DialogHeader>

              <Combobox
                label="Payment Method"
                name="payment_type_id"
                placeholder="Select…"
                value={paymentTypeId}
                onValueChange={setPaymentTypeId}
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

      {canVoid && (
        <Dialog
          open={!!voidTarget}
          onOpenChange={(next) => {
            if (!next) {
              setVoidTarget(null);
              setVoidError(null);
            }
          }}
        >
          <DialogContent>
            <form onSubmit={handleVoidSubmit} className="space-y-4">
              <DialogHeader>
                <DialogTitle>Void Payment</DialogTitle>
                <DialogDescription>
                  Void the ₱{voidTarget ? voidTarget.amount.toFixed(2) : ""} payment logged on{" "}
                  {voidTarget ? formatDate(voidTarget.paid_date) : ""}? It will stop counting toward this
                  asset, and any posted journal entry is reversed automatically.
                </DialogDescription>
              </DialogHeader>

              <TextArea label="Reason" name="reason" rows={2} required />

              {voidError && <p className="text-sm text-(--color-danger)">{voidError}</p>}

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="secondary" disabled={isPending}>Cancel</Button>
                </DialogClose>
                <Button type="submit" variant="danger" disabled={isPending}>
                  {isPending ? "Voiding…" : "Void Payment"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
