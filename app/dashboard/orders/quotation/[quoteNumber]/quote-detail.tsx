"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { convertQuote, cancelQuote } from "../actions";
import { formatDate, formatDateTime } from "@/lib/utils/format-date";
import { formatCurrency } from "@/lib/utils/format";

export type QuoteDetailItem = {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  modifiers: { name: string; price: number }[];
};

export type QuoteDetailData = {
  id: string;
  quoteNumber: string;
  status: string;
  effectiveStatus: string;
  quoteDate: string;
  validUntil: string;
  note: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  convertedOrderNumber: string | null;
  convertedAt: string | null;
  subtotal: number;
  totalDiscount: number;
  totalMoney: number;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  items: QuoteDetailItem[];
  canEdit: boolean;
  canConvert: boolean;
  canCancel: boolean;
};

export type ActivityLogRow = {
  id: string;
  action: string;
  description: string;
  createdAt: string;
  userName: string;
};

const STATUS_VARIANT: Record<string, "success" | "default" | "danger" | "warning" | "neutral"> = {
  open: "success",
  converted: "default",
  cancelled: "danger",
  expired: "warning",
};

function lineTotal(item: QuoteDetailItem) {
  const modifierTotal = item.modifiers.reduce((sum, m) => sum + m.price, 0);
  return Math.max(0, item.quantity * (item.unitPrice + modifierTotal) - item.discount);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function plusDays(dateIso: string, days: number) {
  const d = new Date(dateIso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function QuoteDetail({ data, logs }: { data: QuoteDetailData; logs: ActivityLogRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState(() => plusDays(todayIso(), 5));

  function handleConvert() {
    setConvertError(null);
    startTransition(async () => {
      const res = await convertQuote(data.id, targetDate);
      if (!res.success) setConvertError(res.error);
      else {
        setConvertOpen(false);
        router.refresh();
      }
    });
  }

  function handleCancel() {
    setCancelError(null);
    startTransition(async () => {
      const res = await cancelQuote(data.id, cancelReason);
      if (!res.success) {
        setCancelError(res.error);
      } else {
        setCancelOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.quoteNumber}
        description={`Quote Date ${formatDate(data.quoteDate)} · Valid Until ${formatDate(data.validUntil)}`}
        backHref="/dashboard/orders/quotation"
        backLabel="Back to Quotation"
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/dashboard/orders/quotation/${data.quoteNumber}/view`}>
              <Button variant="secondary">View</Button>
            </Link>
            {data.canEdit && (
              <Link href={`/dashboard/orders/quotation/${data.quoteNumber}/edit`}>
                <Button variant="secondary">Edit</Button>
              </Link>
            )}
            {data.canConvert && (
              <Button
                disabled={isPending}
                onClick={() => {
                  setConvertError(null);
                  setConvertOpen(true);
                }}
              >
                Convert to Order
              </Button>
            )}
            {data.canCancel && (
              <Button
                variant="ghost"
                className="text-(--color-danger)"
                onClick={() => {
                  setCancelError(null);
                  setCancelOpen(true);
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Quote Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={STATUS_VARIANT[data.effectiveStatus] ?? "neutral"}>
                  {data.effectiveStatus.charAt(0).toUpperCase() + data.effectiveStatus.slice(1)}
                </Badge>
                {data.convertedOrderNumber && (
                  <Link
                    href={`/dashboard/orders/active-orders/${data.convertedOrderNumber}`}
                    className="text-sm text-(--color-primary) hover:underline"
                  >
                    View linked Sales Order →
                  </Link>
                )}
              </div>
              {data.cancellationReason && (
                <p className="text-sm text-(--color-text-muted)">
                  Cancellation reason: <span className="text-(--color-text)">{data.cancellationReason}</span>
                </p>
              )}
              <div>
                <p className="text-sm font-medium text-(--color-text)">{data.customerName ?? "Walk-in customer"}</p>
                {data.customerAddress && <p className="text-xs text-(--color-text-muted)">{data.customerAddress}</p>}
                {(data.customerPhone || data.customerEmail) && (
                  <p className="text-xs text-(--color-text-muted)">
                    {[data.customerPhone, data.customerEmail].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              {data.note && <p className="text-sm text-(--color-text-muted)">Notes: {data.note}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.items.map((item) => (
                <div key={item.id} className="border-b border-(--color-border) pb-3 last:border-0">
                  <div className="flex justify-between text-sm">
                    <span className="text-(--color-text)">
                      {item.name} × {item.quantity}
                      {item.sku ? ` (${item.sku})` : ""}
                    </span>
                    <span className="font-medium text-(--color-text)">{formatCurrency(lineTotal(item))}</span>
                  </div>
                  {item.modifiers.length > 0 && (
                    <p className="text-xs text-(--color-text-muted)">
                      {item.modifiers.map((m) => `${m.name} (+${formatCurrency(m.price)})`).join(", ")}
                    </p>
                  )}
                  {item.discount > 0 && (
                    <p className="text-xs text-(--color-text-muted)">Discount: -{formatCurrency(item.discount)}</p>
                  )}
                </div>
              ))}
              <div className="space-y-1 border-t border-(--color-border) pt-3 text-sm">
                <div className="flex justify-between text-(--color-text-muted)">
                  <span>Total Discount</span>
                  <span>-{formatCurrency(data.totalDiscount)}</span>
                </div>
                <div className="flex justify-between font-medium text-(--color-text)">
                  <span>Total Amount</span>
                  <span>{formatCurrency(data.totalMoney)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Activity Log</CardTitle>
            <CardDescription>Immutable audit trail for this quote.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {logs.length === 0 && <p className="text-sm text-(--color-text-muted)">No activity yet.</p>}
            {logs.map((log) => (
              <div key={log.id} className="border-b border-(--color-border) pb-2 text-sm last:border-0">
                <p className="text-(--color-text)">{log.description || log.action}</p>
                <p className="text-xs text-(--color-text-muted)">
                  {log.userName} · {formatDateTime(log.createdAt)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={convertOpen}
        onOpenChange={(next) => {
          setConvertOpen(next);
          if (!next) setConvertError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert to Order</DialogTitle>
            <DialogDescription>
              This will reserve available stock and create a Sales Order from {data.quoteNumber}. Set a target date for the order.
            </DialogDescription>
          </DialogHeader>
          <DatePicker label="Target Date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          {convertError && <p className="text-sm text-(--color-danger)">{convertError}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" disabled={isPending || !targetDate} onClick={handleConvert}>
              {isPending ? "Converting…" : "Convert to Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={cancelOpen}
        onOpenChange={(next) => {
          setCancelOpen(next);
          if (!next) setCancelError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Quote</DialogTitle>
            <DialogDescription>This will permanently lock {data.quoteNumber}. You can optionally record a reason.</DialogDescription>
          </DialogHeader>
          <TextArea
            label="Cancellation Reason (optional)"
            rows={3}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          {cancelError && <p className="text-sm text-(--color-danger)">{cancelError}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Keep Quote
              </Button>
            </DialogClose>
            <Button type="button" className="bg-(--color-danger)" disabled={isPending} onClick={handleCancel}>
              {isPending ? "Cancelling…" : "Cancel Quote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
