"use client";

import { useState, useTransition } from "react";
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
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePicker } from "@/components/ui/date-picker";
import { TextArea } from "@/components/ui/textarea";
import { logAssetPayment } from "../actions";
import { formatDate } from "@/lib/utils/format-date";

export type AssetDetailData = {
  id: string;
  name: string;
  category_name: string;
  supplier_name: string | null;
  cost: number;
  payment_status: "unpaid" | "partial" | "paid";
  purchased_date: string;
  purchase_order_reference: string | null;
};

export type PaymentRow = { id: string; amount: number; paid_date: string; notes: string | null; payment_type_name: string | null };

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
};

export function AssetDetail({ asset, payments, remainingBalance, paymentTypes, canPay }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [payOpen, setPayOpen] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const canShowPay = canPay && asset.payment_status !== "paid";

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
      <div className="flex items-center gap-3">
        <Link href="/dashboard/finance/fixed-assets" className="text-sm text-(--color-primary) hover:underline">
          ← Fixed Assets
        </Link>
      </div>

      <PageHeader
        title={asset.name}
        description={`Purchased ${formatDate(asset.purchased_date)}`}
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

      {canShowPay && (
        <Dialog open={payOpen} onOpenChange={(next) => { setPayOpen(next); if (!next) setPayError(null); }}>
          <DialogContent>
            <form onSubmit={handlePaySubmit} className="space-y-4">
              <DialogHeader>
                <DialogTitle>Log Payment</DialogTitle>
                <DialogDescription>₱{remainingBalance.toFixed(2)} remaining on this asset.</DialogDescription>
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
