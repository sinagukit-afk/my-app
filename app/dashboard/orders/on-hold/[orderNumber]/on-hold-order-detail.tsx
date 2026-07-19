"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
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
import { useNotifications } from "@/components/providers/notification-provider";
import { resumeOrder, cancelOrder } from "../../active-orders/actions";
import { formatDate } from "@/lib/utils/format-date";
import { formatCurrency } from "@/lib/utils/format";
import {
  OrderShipments,
  type OrderShipmentRow,
  type ShippableOrderItem,
  type PackagingVariantOption,
  type ShipmentCustomer,
} from "../../active-orders/[orderNumber]/order-shipments";

export type OnHoldOrderItem = {
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

export type OnHoldOrderData = {
  id: string;
  orderNumber: string;
  status: string;
  note: string | null;
  targetDate: string;
  createdAt: string;
  totalDiscount: number;
  totalMoney: number;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  shipmentCustomer: ShipmentCustomer | null;
  items: OnHoldOrderItem[];
  shipments: OrderShipmentRow[];
  shippableItems: ShippableOrderItem[];
  packagingOptions: PackagingVariantOption[];
  courierOptions: { id: string; name: string }[];
  paymentTypeOptions: { id: string; name: string }[];
  canResume: boolean;
  canCancel: boolean;
  isShippingRole: boolean;
};

function lineTotal(item: OnHoldOrderItem) {
  const modifierTotal = item.modifiers.reduce((sum, m) => sum + m.price, 0);
  return Math.max(0, item.quantity * (item.unitPrice + modifierTotal) - item.discount);
}

const LIST_PATH = "/dashboard/orders/on-hold";

export function OnHoldOrderDetail({ data }: { data: OnHoldOrderData }) {
  const router = useRouter();
  const { notify } = useNotifications();
  const [isPending, startTransition] = useTransition();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  function handleResumeOrder() {
    startTransition(async () => {
      const res = await resumeOrder(data.id);
      if (!res.success) {
        notify(res.error, "error");
      } else {
        notify("Order resumed.", "success");
        router.push(LIST_PATH);
      }
    });
  }

  function handleCancelOrder() {
    setCancelError(null);
    startTransition(async () => {
      const res = await cancelOrder(data.id);
      if (res.success) {
        notify("Order cancelled.", "success");
        router.push(LIST_PATH);
      } else {
        setCancelError(res.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.orderNumber}
        description={`Order Date ${formatDate(data.createdAt)} · Target Date ${formatDate(data.targetDate)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {data.canResume && (
              <Button disabled={isPending} onClick={handleResumeOrder}>
                Resume Order
              </Button>
            )}
            {data.canCancel && (
              <Button variant="secondary" className="text-(--color-danger)" disabled={isPending} onClick={() => setCancelOpen(true)}>
                Cancel Order
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Order Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Badge variant="neutral">on hold</Badge>
          <div>
            <p className="text-sm font-medium text-(--color-text)">
              {data.customerName ?? "Walk-in customer"}
            </p>
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
          <div className="hidden gap-2 text-xs font-medium text-(--color-text-muted) lg:grid lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
            <span>Item</span>
            <span className="text-right">Ordered</span>
            <span className="text-right">Reserved</span>
            <span className="text-right">Completed</span>
            <span className="text-right">Line Total</span>
          </div>
          {data.items.map((item) => (
            <div key={item.id} className="border-b border-(--color-border) pb-3 text-sm last:border-0">
              <div className="hidden items-center gap-2 lg:grid lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
                <div>
                  <span className="text-(--color-text)">
                    {item.name}
                    {item.sku ? ` (${item.sku})` : ""}
                  </span>
                  {item.modifiers.length > 0 && (
                    <p className="text-xs text-(--color-text-muted)">
                      {item.modifiers.map((m) => `${m.name} (+${formatCurrency(m.price)})`).join(", ")}
                    </p>
                  )}
                  {item.discount > 0 && (
                    <p className="text-xs text-(--color-text-muted)">Discount: -{formatCurrency(item.discount)}</p>
                  )}
                </div>
                <span className="text-right text-(--color-text)">{item.quantity}</span>
                <span className="text-right text-(--color-text)">{item.reservedQty}</span>
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
                <span className="text-right font-medium text-(--color-text)">{formatCurrency(lineTotal(item))}</span>
              </div>

              <div className="space-y-2 lg:hidden">
                <div>
                  <span className="text-(--color-text)">
                    {item.name}
                    {item.sku ? ` (${item.sku})` : ""}
                  </span>
                  {item.modifiers.length > 0 && (
                    <p className="text-xs text-(--color-text-muted)">
                      {item.modifiers.map((m) => `${m.name} (+${formatCurrency(m.price)})`).join(", ")}
                    </p>
                  )}
                  {item.discount > 0 && (
                    <p className="text-xs text-(--color-text-muted)">Discount: -{formatCurrency(item.discount)}</p>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-(--color-text-muted)">Ordered</span>
                  <span className="text-(--color-text)">{item.quantity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-(--color-text-muted)">Reserved</span>
                  <span className="text-(--color-text)">{item.reservedQty}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-(--color-text-muted)">Completed</span>
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
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-(--color-text-muted)">Line Total</span>
                  <span className="text-(--color-text)">{formatCurrency(lineTotal(item))}</span>
                </div>
              </div>
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

      {data.shipments.length > 0 && (
        <OrderShipments
          orderId={data.id}
          shipments={data.shipments}
          shippableItems={data.shippableItems}
          packagingOptions={data.packagingOptions}
          courierOptions={data.courierOptions}
          paymentTypeOptions={data.paymentTypeOptions}
          customer={data.shipmentCustomer}
          canAddShipment={false}
          isShippingRole={data.isShippingRole}
          onChanged={() => router.refresh()}
        />
      )}

      <Dialog
        open={cancelOpen}
        onOpenChange={(next) => {
          setCancelOpen(next);
          if (!next) setCancelError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
            <DialogDescription>
              Cancel this order? Reserved and in-production inventory will be released.
            </DialogDescription>
          </DialogHeader>
          {cancelError && <p className="text-sm text-(--color-danger)">{cancelError}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" variant="danger" onClick={handleCancelOrder} disabled={isPending}>
              {isPending ? "Cancelling…" : "Cancel Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
