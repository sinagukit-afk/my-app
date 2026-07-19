"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  OrderShipments,
  type OrderShipmentRow,
  type ShippableOrderItem,
  type PackagingVariantOption,
  type ShipmentCustomer,
} from "@/app/dashboard/orders/active-orders/[orderNumber]/order-shipments";

const ORDER_STATUS_VARIANT: Record<string, "success" | "default" | "danger" | "warning" | "neutral"> = {
  ready_for_shipping: "default",
  shipped: "warning",
  delivered: "success",
};

export type ShippingOrderData = {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string | null;
  shipmentCustomer: ShipmentCustomer | null;
  canAddShipment: boolean;
  isShippingRole: boolean;
  shipments: OrderShipmentRow[];
  shippableItems: ShippableOrderItem[];
  packagingOptions: PackagingVariantOption[];
  courierOptions: { id: string; name: string }[];
  paymentTypeOptions: { id: string; name: string }[];
};

export function ShippingOrderDetail({ data }: { data: ShippingOrderData }) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.orderNumber}
        description="Shipping information for this order."
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
            <Badge variant={ORDER_STATUS_VARIANT[data.status] ?? "neutral"}>
              {data.status.replace(/_/g, " ")}
            </Badge>
          </div>
          <div className="flex justify-between text-(--color-text-muted)">
            <span>Customer</span>
            <span className="text-(--color-text)">{data.customerName ?? "Walk-in customer"}</span>
          </div>
        </CardContent>
      </Card>

      <OrderShipments
        orderId={data.id}
        shipments={data.shipments}
        shippableItems={data.shippableItems}
        packagingOptions={data.packagingOptions}
        courierOptions={data.courierOptions}
        paymentTypeOptions={data.paymentTypeOptions}
        customer={data.shipmentCustomer}
        canAddShipment={data.canAddShipment}
        isShippingRole={data.isShippingRole}
        onChanged={() => router.refresh()}
      />
    </div>
  );
}
