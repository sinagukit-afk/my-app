"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OrderPayments, type OrderPaymentRow } from "@/app/dashboard/orders/active-orders/[orderNumber]/order-payments";

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

export type PaymentOrderData = {
  id: string;
  orderNumber: string;
  status: string;
  targetDate: string;
  createdAt: string;
  fulfillmentMethod: string | null;
  totalMoney: number;
  customerName: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  payments: OrderPaymentRow[];
  paymentTypeOptions: { id: string; name: string }[];
  canAddPayment: boolean;
  canClosePayment: boolean;
  isPaymentClosed: boolean;
  paymentClosedAt: string | null;
  paymentClosedByName: string | null;
  paymentCloseNote: string | null;
  tipAmount: number;
};

export type ActivityLogRow = {
  id: string;
  action: string;
  description: string;
  createdAt: string;
  userName: string;
};

export function PaymentOrderDetail({ data, logs }: { data: PaymentOrderData; logs: ActivityLogRow[] }) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.orderNumber}
        description="Payment information for this order."
        actions={
          <Link
            href={`/dashboard/orders/active-orders/${data.orderNumber}`}
            className="text-sm text-(--color-primary) hover:underline"
          >
            View Full Order →
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Order</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[data.status] ?? "neutral"}>{data.status.replace(/_/g, " ")}</Badge>
          </div>
          <div className="flex justify-between text-(--color-text-muted)">
            <span>Customer</span>
            <span className="text-(--color-text)">{data.customerName ?? "Walk-in customer"}</span>
          </div>
          {data.customerPhone && (
            <div className="flex justify-between text-(--color-text-muted)">
              <span>Phone</span>
              <span className="text-(--color-text)">{data.customerPhone}</span>
            </div>
          )}
          {data.customerAddress && (
            <div className="flex justify-between text-(--color-text-muted)">
              <span>Address</span>
              <span className="text-(--color-text)">{data.customerAddress}</span>
            </div>
          )}
          <div className="flex justify-between text-(--color-text-muted)">
            <span>Order Date</span>
            <span className="text-(--color-text)">{data.createdAt.slice(0, 10)}</span>
          </div>
          <div className="flex justify-between text-(--color-text-muted)">
            <span>Target Date</span>
            <span className="text-(--color-text)">{data.targetDate}</span>
          </div>
          {data.fulfillmentMethod && (
            <div className="flex justify-between text-(--color-text-muted)">
              <span>Fulfillment</span>
              <span className="text-(--color-text) capitalize">{data.fulfillmentMethod}</span>
            </div>
          )}
        </CardContent>
      </Card>

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
  );
}
