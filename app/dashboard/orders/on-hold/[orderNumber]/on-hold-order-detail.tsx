"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { resumeOrder, cancelOrder } from "../../active-orders/actions";
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
  canResume: boolean;
  canCancel: boolean;
  isShippingRole: boolean;
};

function peso(n: number) {
  return `₱${n.toFixed(2)}`;
}

function lineTotal(item: OnHoldOrderItem) {
  const modifierTotal = item.modifiers.reduce((sum, m) => sum + m.price, 0);
  return Math.max(0, item.quantity * (item.unitPrice + modifierTotal) - item.discount);
}

const LIST_PATH = "/dashboard/orders/on-hold";

export function OnHoldOrderDetail({ data }: { data: OnHoldOrderData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleResumeOrder() {
    startTransition(async () => {
      const res = await resumeOrder(data.id);
      if (!res.success) {
        alert(res.error);
      } else {
        alert("Order resumed.");
        router.push(LIST_PATH);
      }
    });
  }

  function handleCancelOrder() {
    if (!confirm("Cancel this order? Reserved and in-production inventory will be released.")) return;
    startTransition(async () => {
      const res = await cancelOrder(data.id);
      if (!res.success) {
        alert(res.error);
      } else {
        alert("Order cancelled.");
        router.push(LIST_PATH);
      }
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.orderNumber}
        description={`Order Date ${data.createdAt.slice(0, 10)} · Target Date ${data.targetDate}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {data.canResume && (
              <Button disabled={isPending} onClick={handleResumeOrder}>
                Resume Order
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
      </Card>

      {data.shipments.length > 0 && (
        <OrderShipments
          orderId={data.id}
          shipments={data.shipments}
          shippableItems={data.shippableItems}
          packagingOptions={data.packagingOptions}
          courierOptions={data.courierOptions}
          customer={data.shipmentCustomer}
          canAddShipment={false}
          isShippingRole={data.isShippingRole}
          onChanged={() => router.refresh()}
        />
      )}
    </div>
  );
}
