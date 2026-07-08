"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import {
  startProduction,
  overrideReservedQty,
  cancelOrder,
  holdOrder,
  resumeOrder,
} from "../actions";
import {
  OrderShipments,
  type OrderShipmentRow,
  type ShippableOrderItem,
  type PackagingVariantOption,
  type ShipmentCustomer,
} from "./order-shipments";
import { OrderPayments, type OrderPaymentRow } from "./order-payments";

export type OrderDetailItem = {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  reservedQty: number;
  completedQty: number;
  modifiers: { name: string; price: number }[];
  productionOrderNumber: string | null;
  productionOrderStatus: string | null;
};

export type OrderDetailData = {
  id: string;
  orderNumber: string;
  status: string;
  note: string | null;
  targetDate: string;
  createdAt: string;
  subtotal: number;
  totalDiscount: number;
  totalMoney: number;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  shipmentCustomer: ShipmentCustomer | null;
  items: OrderDetailItem[];
  payments: OrderPaymentRow[];
  paymentTypeOptions: { id: string; name: string }[];
  canClosePayment: boolean;
  isPaymentClosed: boolean;
  paymentClosedAt: string | null;
  paymentClosedByName: string | null;
  paymentCloseNote: string | null;
  tipAmount: number;
  shipments: OrderShipmentRow[];
  shippableItems: ShippableOrderItem[];
  packagingOptions: PackagingVariantOption[];
  courierOptions: { id: string; name: string }[];
  canEdit: boolean;
  canAdvance: boolean;
  canOverrideReservedQty: boolean;
  canAddPayment: boolean;
  canCancel: boolean;
  canHold: boolean;
  canResume: boolean;
  canAddShipment: boolean;
  isShippingRole: boolean;
};

export type ActivityLogRow = {
  id: string;
  action: string;
  description: string;
  createdAt: string;
  userName: string;
};

const STATUS_VARIANT: Record<string, "success" | "default" | "danger" | "warning" | "neutral"> = {
  confirmed: "default",
  in_production: "warning",
  partially_completed: "warning",
  production_completed: "success",
  ready_for_shipping: "default",
  shipped: "default",
  delivered: "success",
  on_hold: "neutral",
  cancelled: "danger",
};

function peso(n: number) {
  return `₱${n.toFixed(2)}`;
}

function lineTotal(item: OrderDetailItem) {
  const modifierTotal = item.modifiers.reduce((sum, m) => sum + m.price, 0);
  return Math.max(0, item.quantity * (item.unitPrice + modifierTotal) - item.discount);
}

export function OrderDetail({ data, logs }: { data: OrderDetailData; logs: ActivityLogRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [reservedQty, setReservedQty] = useState<Record<string, number>>(
    Object.fromEntries(data.items.map((i) => [i.id, i.reservedQty]))
  );
  const reservedQtyDirty = data.items.some((i) => reservedQty[i.id] !== i.reservedQty);

  function handleStartProduction() {
    if (!confirm("Move this order into production?")) return;
    startTransition(async () => {
      const res = await startProduction(data.id);
      if (!res.success) alert(res.error);
      else router.refresh();
    });
  }

  function handleSaveReservedQty() {
    const updates = data.items
      .filter((i) => reservedQty[i.id] !== i.reservedQty)
      .map((i) => ({ orderItemId: i.id, reservedQty: reservedQty[i.id] }));
    if (updates.length === 0) return;
    startTransition(async () => {
      const res = await overrideReservedQty(data.id, updates);
      if (!res.success) alert(res.error);
      else router.refresh();
    });
  }

  function runStatusAction(action: () => Promise<{ success: boolean; error?: string }>) {
    startTransition(async () => {
      const res = await action();
      if (!res.success) alert(res.error);
      else router.refresh();
    });
  }

  function handleCancelOrder() {
    if (!confirm("Cancel this order? Reserved inventory will be released back to Available.")) return;
    runStatusAction(() => cancelOrder(data.id));
  }

  function handleHoldOrder() {
    if (!confirm("Put this order on hold? It can be resumed later.")) return;
    runStatusAction(() => holdOrder(data.id));
  }

  function handleResumeOrder() {
    runStatusAction(() => resumeOrder(data.id));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.orderNumber}
        description={`Order Date ${data.createdAt.slice(0, 10)} · Target Date ${data.targetDate}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {data.canEdit && (
              <Link href={`/dashboard/orders/active-orders/${data.orderNumber}/edit`}>
                <Button variant="secondary">Edit</Button>
              </Link>
            )}
            {data.canAdvance && (
              <Button disabled={isPending} onClick={handleStartProduction}>
                Start Production
              </Button>
            )}
            {data.canResume && (
              <Button disabled={isPending} onClick={handleResumeOrder}>
                Resume Order
              </Button>
            )}
            {data.canHold && (
              <Button variant="secondary" disabled={isPending} onClick={handleHoldOrder}>
                Put On Hold
              </Button>
            )}
            {data.canCancel && (
              <Button variant="secondary" className="text-(--color-danger)" disabled={isPending} onClick={handleCancelOrder}>
                Cancel Order
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Badge variant={STATUS_VARIANT[data.status] ?? "neutral"}>{data.status.replace(/_/g, " ")}</Badge>
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
              <CardDescription>Ordered, Reserved, and Completed quantities per line.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-2 text-xs font-medium text-(--color-text-muted)">
                <span>Item</span>
                <span className="text-right">Ordered</span>
                <span className="text-right">Reserved</span>
                <span className="text-right">Completed</span>
                <span className="text-right">Line Total</span>
              </div>
              {data.items.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] items-center gap-2 border-b border-(--color-border) pb-3 text-sm last:border-0"
                >
                  <div>
                    <span className="text-(--color-text)">
                      {item.name}
                      {item.sku ? ` (${item.sku})` : ""}
                    </span>
                    {item.modifiers.length > 0 && (
                      <p className="text-xs text-(--color-text-muted)">
                        {item.modifiers.map((m) => `${m.name} (+${peso(m.price)})`).join(", ")}
                      </p>
                    )}
                    {item.discount > 0 && (
                      <p className="text-xs text-(--color-text-muted)">Discount: -{peso(item.discount)}</p>
                    )}
                  </div>
                  <span className="text-right text-(--color-text)">{item.quantity}</span>
                  {data.canOverrideReservedQty ? (
                    <NumberInput
                      className="h-8 text-right"
                      min={0}
                      max={item.quantity}
                      value={reservedQty[item.id]}
                      onChange={(e) =>
                        setReservedQty((prev) => ({
                          ...prev,
                          [item.id]: Math.max(0, Math.min(item.quantity, Number(e.target.value) || 0)),
                        }))
                      }
                    />
                  ) : (
                    <span className="text-right text-(--color-text)">{item.reservedQty}</span>
                  )}
                  <div className="text-right">
                    <span className="text-(--color-text)">{item.completedQty}</span>
                    {item.productionOrderNumber && (
                      <p className="text-xs text-(--color-text-muted)">
                        <Link
                          href={`/dashboard/orders/production/${item.productionOrderNumber}`}
                          className="hover:underline"
                        >
                          {item.productionOrderNumber}
                        </Link>
                      </p>
                    )}
                  </div>
                  <span className="text-right font-medium text-(--color-text)">{peso(lineTotal(item))}</span>
                </div>
              ))}
              <div className="space-y-1 border-t border-(--color-border) pt-3 text-sm">
                <div className="flex justify-between text-(--color-text-muted)">
                  <span>Total Discount</span>
                  <span>-{peso(data.totalDiscount)}</span>
                </div>
                <div className="flex justify-between font-medium text-(--color-text)">
                  <span>Total Amount</span>
                  <span>{peso(data.totalMoney)}</span>
                </div>
              </div>
            </CardContent>
            {data.canOverrideReservedQty && (
              <CardFooter className="justify-end gap-2">
                <Button
                  variant="secondary"
                  disabled={!reservedQtyDirty || isPending}
                  onClick={handleSaveReservedQty}
                >
                  {isPending ? "Saving…" : "Save Reserved Qty"}
                </Button>
              </CardFooter>
            )}
          </Card>

          {(data.shipments.length > 0 || data.canAddShipment) && (
            <OrderShipments
              orderId={data.id}
              shipments={data.shipments}
              shippableItems={data.shippableItems}
              packagingOptions={data.packagingOptions}
              courierOptions={data.courierOptions}
              customer={data.shipmentCustomer}
              canAddShipment={data.canAddShipment}
              isShippingRole={data.isShippingRole}
              onChanged={() => router.refresh()}
            />
          )}

          <OrderPayments
            data={{
              id: data.id,
              orderNumber: data.orderNumber,
              totalMoney: data.totalMoney,
              payments: data.payments,
              paymentTypeOptions: data.paymentTypeOptions,
              canAddPayment: data.canAddPayment,
              canClosePayment: data.canClosePayment,
              isClosed: data.isPaymentClosed,
              paymentClosedAt: data.paymentClosedAt,
              paymentClosedByName: data.paymentClosedByName,
              paymentCloseNote: data.paymentCloseNote,
              tipAmount: data.tipAmount,
            }}
            onChanged={() => router.refresh()}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Activity Log</CardTitle>
            <CardDescription>Immutable audit trail for this order.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {logs.length === 0 && <p className="text-sm text-(--color-text-muted)">No activity yet.</p>}
            {logs.map((log) => (
              <div key={log.id} className="border-b border-(--color-border) pb-2 text-sm last:border-0">
                <p className="text-(--color-text)">{log.description || log.action}</p>
                <p className="text-xs text-(--color-text-muted)">
                  {log.userName} · {new Date(log.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
