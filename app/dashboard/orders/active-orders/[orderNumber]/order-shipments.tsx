"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  createShipment,
  updateShipment,
  markShipmentShipped,
  markShipmentDelivered,
  markShipmentPickedUp,
} from "../actions";
import { randomId } from "@/lib/utils/random-id";
import { AutoFillPanel } from "@/components/ai-autofill/auto-fill-panel";
import { AiFieldHighlight } from "@/components/ai-autofill/ai-field-highlight";
import { useAiFilledKeys } from "@/components/ai-autofill/use-ai-filled-keys";
import { shippingLabelSchema } from "@/lib/ai-autofill/schemas";
import type { DropdownOptionsByField, ExtractionResult } from "@/lib/ai-autofill/types";
import { formatDate } from "@/lib/utils/format-date";

export type ShippableOrderItem = {
  orderItemId: string;
  name: string;
  sku: string | null;
  remainingQty: number;
};

export type PackagingVariantOption = {
  id: string;
  label: string;
  sku: string | null;
};

export type ShipmentProductLine = {
  orderItemId: string;
  name: string;
  sku: string | null;
  quantityShipped: number;
};

export type ShipmentPackagingLine = {
  variantId: string;
  name: string;
  quantityUsed: number;
};

export type OrderShipmentRow = {
  id: string;
  shipmentNumber: string;
  status: string;
  fulfillmentType: "pickup" | "delivery";
  shipsToCustomer: boolean | null;
  receiverName: string | null;
  receiverPhone: string | null;
  receiverAddressLine1: string | null;
  receiverBarangay: string | null;
  receiverCity: string | null;
  receiverProvince: string | null;
  receiverPostalCode: string | null;
  courierId: string | null;
  courierName: string | null;
  trackingNumber: string | null;
  shippingCost: number | null;
  shippingFeeCharged: number | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  note: string | null;
  productLines: ShipmentProductLine[];
  packagingLines: ShipmentPackagingLine[];
};

export type ShipmentCustomer = {
  name: string;
  phone: string | null;
  address: string | null;
};

const SHIPMENT_STATUS_VARIANT: Record<string, "success" | "default" | "neutral"> = {
  preparing: "neutral",
  shipped: "default",
  delivered: "success",
};

function peso(n: number) {
  return `₱${n.toFixed(2)}`;
}

function formatAddress(parts: (string | null | undefined)[]) {
  return parts.filter(Boolean).join(", ") || null;
}

type PackagingRow = { rowId: string; variantId: string; quantity: string };

function emptyPackagingRow(): PackagingRow {
  return { rowId: randomId(), variantId: "", quantity: "1" };
}

export function OrderShipments({
  orderId,
  orderNumber,
  shipments,
  shippableItems,
  packagingOptions,
  courierOptions,
  customer,
  canAddShipment,
  isShippingRole,
  onChanged,
}: {
  orderId: string;
  orderNumber: string;
  shipments: OrderShipmentRow[];
  shippableItems: ShippableOrderItem[];
  packagingOptions: PackagingVariantOption[];
  courierOptions: { id: string; name: string }[];
  customer: ShipmentCustomer | null;
  canAddShipment: boolean;
  isShippingRole: boolean;
  onChanged: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const [editingShipment, setEditingShipment] = useState<OrderShipmentRow | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [shipTarget, setShipTarget] = useState<string | null>(null);
  const [shipError, setShipError] = useState<string | null>(null);
  const [deliverTarget, setDeliverTarget] = useState<string | null>(null);
  const [deliverError, setDeliverError] = useState<string | null>(null);
  const [pickupTarget, setPickupTarget] = useState<string | null>(null);
  const [pickupError, setPickupError] = useState<string | null>(null);

  const hasCustomer = customer != null;

  const [fulfillmentType, setFulfillmentType] = useState<"pickup" | "delivery">("delivery");
  const [shipsToCustomer, setShipsToCustomer] = useState(hasCustomer);
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [receiverAddressLine1, setReceiverAddressLine1] = useState("");
  const [receiverCity, setReceiverCity] = useState("");
  const [receiverProvince, setReceiverProvince] = useState("");
  const [courierId, setCourierId] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [shippingCost, setShippingCost] = useState("");
  const [shippingFeeCharged, setShippingFeeCharged] = useState("");
  const [note, setNote] = useState("");
  const [lineQtys, setLineQtys] = useState<Record<string, string>>({});
  const [packagingRows, setPackagingRows] = useState<PackagingRow[]>([emptyPackagingRow()]);
  const { aiFilledKeys, markFilled, clear: clearAiField, clearAll: clearAiFields } = useAiFilledKeys();

  const dropdownOptions: DropdownOptionsByField = useMemo(
    () => ({ courierId: courierOptions.map((c) => ({ value: c.id, label: c.name })) }),
    [courierOptions]
  );

  function handleExtracted(result: ExtractionResult) {
    const header = result.header;

    if (typeof header.courierId === "string" || (typeof header.trackingNumber === "string" && header.trackingNumber)) {
      setFulfillmentType("delivery");
    }
    if (typeof header.courierId === "string") setCourierId(header.courierId);
    if (typeof header.trackingNumber === "string" && header.trackingNumber) setTrackingNumber(header.trackingNumber);
    if (typeof header.shippingCost === "number") setShippingCost(String(header.shippingCost));

    const hasReceiverInfo = [
      header.receiverName,
      header.receiverAddressLine1,
      header.receiverCity,
      header.receiverProvince,
    ].some((v) => typeof v === "string" && v);

    if (hasReceiverInfo) {
      // A photographed shipping label documents the actual receiver for this
      // shipment — default to the manual-receiver fields even if the order has
      // a registered customer, so the extracted address is visible for review.
      setShipsToCustomer(false);
      if (typeof header.receiverName === "string" && header.receiverName) setReceiverName(header.receiverName);
      if (typeof header.receiverPhone === "string" && header.receiverPhone) setReceiverPhone(header.receiverPhone);
      if (typeof header.receiverAddressLine1 === "string" && header.receiverAddressLine1) setReceiverAddressLine1(header.receiverAddressLine1);
      if (typeof header.receiverCity === "string" && header.receiverCity) setReceiverCity(header.receiverCity);
      if (typeof header.receiverProvince === "string" && header.receiverProvince) setReceiverProvince(header.receiverProvince);
    }

    const noteLines: string[] = [];
    if (typeof header.goodsDescription === "string" && header.goodsDescription) noteLines.push(`Goods: ${header.goodsDescription}`);
    if (typeof header.weight === "number") noteLines.push(`Weight: ${header.weight} kg`);
    if (typeof header.courierOrderNo === "string" && header.courierOrderNo) noteLines.push(`Courier Order No.: ${header.courierOrderNo}`);
    if (noteLines.length > 0) setNote(noteLines.join(" | "));

    const directKeys = Object.entries(header)
      .filter(
        ([key, value]) =>
          value !== null && value !== undefined && value !== "" && !["weight", "goodsDescription", "courierOrderNo"].includes(key)
      )
      .map(([key]) => key);
    markFilled(noteLines.length > 0 ? [...directKeys, "note"] : directKeys);
  }

  function handleFulfillmentChange(value: "pickup" | "delivery") {
    setFulfillmentType(value);
    if (value === "delivery" && !hasCustomer) setShipsToCustomer(false);
  }

  // Product lines a shipment can allocate against: order-wide remaining quantity, plus
  // (when editing) that shipment's own already-allocated quantity added back in, since
  // editing replaces rather than adds to its existing allocation.
  const activeItems = useMemo(() => {
    if (!editingShipment) return shippableItems.filter((si) => si.remainingQty > 0);
    const ownQty = new Map(editingShipment.productLines.map((p) => [p.orderItemId, p.quantityShipped]));
    return shippableItems
      .map((si) => ({ ...si, remainingQty: si.remainingQty + (ownQty.get(si.orderItemId) ?? 0) }))
      .filter((si) => si.remainingQty > 0);
  }, [editingShipment, shippableItems]);

  function resetForm() {
    setFulfillmentType("delivery");
    setShipsToCustomer(hasCustomer);
    setReceiverName("");
    setReceiverPhone("");
    setReceiverAddressLine1("");
    setReceiverCity("");
    setReceiverProvince("");
    setCourierId("");
    setTrackingNumber("");
    setShippingCost("");
    setShippingFeeCharged("");
    setNote("");
    setLineQtys({});
    setPackagingRows([emptyPackagingRow()]);
    setFormError(null);
    clearAiFields();
  }

  function openEditForm(s: OrderShipmentRow) {
    setFormError(null);
    setEditingShipment(s);
    setFulfillmentType(s.fulfillmentType);
    setShipsToCustomer(s.fulfillmentType === "pickup" ? hasCustomer : (s.shipsToCustomer ?? hasCustomer));
    setReceiverName(s.receiverName ?? "");
    setReceiverPhone(s.receiverPhone ?? "");
    // Older shipments may still have a separate barangay value from before the
    // form merged it into the address line — fold it in here so editing doesn't
    // silently drop it.
    setReceiverAddressLine1([s.receiverAddressLine1, s.receiverBarangay].filter(Boolean).join(", "));
    setReceiverCity(s.receiverCity ?? "");
    setReceiverProvince(s.receiverProvince ?? "");
    setCourierId(s.courierId ?? "");
    setTrackingNumber(s.trackingNumber ?? "");
    setShippingCost(s.shippingCost != null ? String(s.shippingCost) : "");
    setShippingFeeCharged(s.shippingFeeCharged != null ? String(s.shippingFeeCharged) : "");
    setNote(s.note ?? "");
    setLineQtys(Object.fromEntries(s.productLines.map((p) => [p.orderItemId, String(p.quantityShipped)])));
    setPackagingRows(
      s.packagingLines.length > 0
        ? s.packagingLines.map((p) => ({ rowId: randomId(), variantId: p.variantId, quantity: String(p.quantityUsed) }))
        : [emptyPackagingRow()]
    );
    setFormOpen(true);
  }

  function updatePackagingRow(rowId: string, patch: Partial<PackagingRow>) {
    setPackagingRows((rows) => rows.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }

  function addPackagingRow() {
    setPackagingRows((rows) => [...rows, emptyPackagingRow()]);
  }

  function removePackagingRow(rowId: string) {
    setPackagingRows((rows) => (rows.length > 1 ? rows.filter((r) => r.rowId !== rowId) : rows));
  }

  function handleSubmitShipment() {
    setFormError(null);
    const items = activeItems
      .map((si) => ({ orderItemId: si.orderItemId, quantityShipped: Number(lineQtys[si.orderItemId]) || 0 }))
      .filter((i) => i.quantityShipped > 0);

    if (items.length === 0) {
      setFormError("Enter a quantity for at least one product line.");
      return;
    }

    const packagingItems = packagingRows
      .filter((r) => r.variantId && Number(r.quantity) > 0)
      .map((r) => ({ variantId: r.variantId, quantityUsed: Number(r.quantity) }));

    const isPickup = fulfillmentType === "pickup";
    const isManualReceiver = !isPickup && !shipsToCustomer;

    if (isManualReceiver && !receiverName.trim()) {
      setFormError("Receiver name is required when this shipment doesn't go to the customer.");
      return;
    }

    const input = {
      fulfillmentType,
      shipsToCustomer: isPickup ? true : shipsToCustomer,
      receiverName: isManualReceiver ? receiverName.trim() || null : null,
      receiverPhone: isManualReceiver ? receiverPhone.trim() || null : null,
      receiverAddressLine1: isManualReceiver ? receiverAddressLine1.trim() || null : null,
      receiverBarangay: null,
      receiverCity: isManualReceiver ? receiverCity.trim() || null : null,
      receiverProvince: isManualReceiver ? receiverProvince.trim() || null : null,
      receiverPostalCode: null,
      courierId: isPickup ? null : courierId || null,
      trackingNumber: isPickup ? null : trackingNumber.trim() || null,
      shippingCost: isPickup ? null : shippingCost ? Number(shippingCost) : null,
      shippingFeeCharged: isPickup ? null : shippingFeeCharged ? Number(shippingFeeCharged) : null,
      note: note.trim() || null,
      items,
      packagingItems,
    };

    startTransition(async () => {
      const res = editingShipment
        ? await updateShipment(orderId, editingShipment.id, input)
        : await createShipment(orderId, input);
      if (!res.success) {
        setFormError(res.error);
      } else {
        setFormOpen(false);
        setEditingShipment(null);
        resetForm();
        onChanged();
      }
    });
  }

  function handleMarkShipped() {
    if (!shipTarget) return;
    setShipError(null);
    startTransition(async () => {
      const res = await markShipmentShipped(orderId, shipTarget);
      if (res.success) {
        setShipTarget(null);
        onChanged();
      } else {
        setShipError(res.error);
      }
    });
  }

  function handleMarkDelivered() {
    if (!deliverTarget) return;
    setDeliverError(null);
    startTransition(async () => {
      const res = await markShipmentDelivered(orderId, deliverTarget);
      if (res.success) {
        setDeliverTarget(null);
        onChanged();
      } else {
        setDeliverError(res.error);
      }
    });
  }

  function handleMarkPickedUp() {
    if (!pickupTarget) return;
    setPickupError(null);
    startTransition(async () => {
      const res = await markShipmentPickedUp(orderId, pickupTarget);
      if (res.success) {
        setPickupTarget(null);
        onChanged();
      } else {
        setPickupError(res.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Shipments</CardTitle>
          <CardDescription>Partial shipments supported — each ships and delivers independently.</CardDescription>
        </div>
        {canAddShipment && (
          <Button asChild>
            <Link href={`/dashboard/orders/active-orders/${orderNumber}/shipments/new`}>Add Shipment</Link>
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {shipments.length === 0 && <p className="text-sm text-(--color-text-muted)">No shipments yet.</p>}
        {shipments.map((s) => (
          <div key={s.id} className="space-y-2 rounded-md border border-(--color-border) p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-(--color-text)">{s.shipmentNumber}</span>
              <div className="flex items-center gap-2">
                <Badge variant="neutral">{s.fulfillmentType === "pickup" ? "Pickup" : "Delivery"}</Badge>
                <Badge variant={SHIPMENT_STATUS_VARIANT[s.status] ?? "neutral"}>{s.status}</Badge>
              </div>
            </div>
            {s.fulfillmentType === "delivery" && (
              <>
                <div className="flex justify-between gap-4 text-(--color-text-muted)">
                  <span>Receiver</span>
                  <span className="text-right text-(--color-text)">
                    {s.receiverName ?? "—"}
                    {s.shipsToCustomer === false && (
                      <span className="block text-xs text-(--color-text-muted)">
                        {formatAddress([s.receiverAddressLine1, s.receiverBarangay, s.receiverCity, s.receiverProvince]) ?? ""}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-(--color-text-muted)">
                  <span>Courier</span>
                  <span className="text-(--color-text)">{s.courierName ?? "—"}</span>
                </div>
                <div className="flex justify-between text-(--color-text-muted)">
                  <span>Tracking Number</span>
                  <span className="text-(--color-text)">{s.trackingNumber ?? "—"}</span>
                </div>
              </>
            )}
            {s.productLines.length > 0 && (
              <div>
                <p className="text-xs font-medium text-(--color-text-muted)">Product Lines</p>
                {s.productLines.map((p, i) => (
                  <div key={i} className="flex justify-between text-(--color-text)">
                    <span>
                      {p.name}
                      {p.sku ? ` (${p.sku})` : ""}
                    </span>
                    <span>{p.quantityShipped}</span>
                  </div>
                ))}
              </div>
            )}
            {s.packagingLines.length > 0 && (
              <div>
                <p className="text-xs font-medium text-(--color-text-muted)">Packaging Materials</p>
                {s.packagingLines.map((p, i) => (
                  <div key={i} className="flex justify-between text-(--color-text)">
                    <span>{p.name}</span>
                    <span>{p.quantityUsed}</span>
                  </div>
                ))}
              </div>
            )}
            {(s.shippingCost != null || s.shippingFeeCharged != null) && (
              <div className="flex justify-between text-(--color-text-muted)">
                <span>Shipping Cost / Fee Charged</span>
                <span className="text-(--color-text)">
                  {s.shippingCost != null ? peso(s.shippingCost) : "—"} /{" "}
                  {s.shippingFeeCharged != null ? peso(s.shippingFeeCharged) : "—"}
                </span>
              </div>
            )}
            {s.fulfillmentType === "pickup" ? (
              <div className="flex justify-between text-(--color-text-muted)">
                <span>Picked Up</span>
                <span className="text-(--color-text)">
                  {s.deliveredAt ? formatDate(s.deliveredAt) : "—"}
                </span>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-(--color-text-muted)">
                  <span>Shipped</span>
                  <span className="text-(--color-text)">
                    {s.shippedAt ? formatDate(s.shippedAt) : "—"}
                  </span>
                </div>
                <div className="flex justify-between text-(--color-text-muted)">
                  <span>Delivered</span>
                  <span className="text-(--color-text)">
                    {s.deliveredAt ? formatDate(s.deliveredAt) : "—"}
                  </span>
                </div>
              </>
            )}
            {s.note && <p className="text-(--color-text-muted)">Notes: {s.note}</p>}
            {isShippingRole && (s.status === "preparing" || s.status === "shipped") && (
              <div className="flex justify-end gap-2 pt-1">
                {s.status === "preparing" && (
                  <Button size="sm" variant="secondary" disabled={isPending} onClick={() => openEditForm(s)}>
                    Edit
                  </Button>
                )}
                {s.status === "preparing" && s.fulfillmentType === "pickup" && (
                  <Button
                    size="sm"
                    disabled={isPending}
                    onClick={() => {
                      setPickupError(null);
                      setPickupTarget(s.id);
                    }}
                  >
                    Mark as Picked Up
                  </Button>
                )}
                {s.status === "preparing" && s.fulfillmentType === "delivery" && (
                  <Button
                    size="sm"
                    disabled={isPending}
                    onClick={() => {
                      setShipError(null);
                      setShipTarget(s.id);
                    }}
                  >
                    Mark Shipped
                  </Button>
                )}
                {s.status === "shipped" && (
                  <Button
                    size="sm"
                    disabled={isPending}
                    onClick={() => {
                      setDeliverError(null);
                      setDeliverTarget(s.id);
                    }}
                  >
                    Mark Delivered
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditingShipment(null);
            setFormError(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Shipment {editingShipment?.shipmentNumber}</DialogTitle>
            <DialogDescription>
              Allocate product and packaging quantities for this shipment. Creating a shipment does not affect stock —
              stock is deducted when it&apos;s marked Shipped (or Picked Up).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <AutoFillPanel schema={shippingLabelSchema} dropdownOptions={dropdownOptions} onExtracted={handleExtracted} />
            <Select
              label="Fulfillment Method"
              value={fulfillmentType}
              onChange={(e) => handleFulfillmentChange(e.target.value as "pickup" | "delivery")}
              options={[
                { value: "delivery", label: "Delivery" },
                { value: "pickup", label: "Pick Up" },
              ]}
            />
            {fulfillmentType === "delivery" && (
              <>
                <Toggle
                  label="Ships to Customer?"
                  description={
                    hasCustomer
                      ? "Turn off if this shipment goes to someone other than the customer above."
                      : "No registered customer on this order — enter receiver details below."
                  }
                  checked={shipsToCustomer}
                  disabled={!hasCustomer}
                  onChange={setShipsToCustomer}
                />
                {shipsToCustomer ? (
                  <div className="rounded-md border border-(--color-border) bg-(--color-bg) p-3 text-sm">
                    <p className="font-medium text-(--color-text)">{customer?.name}</p>
                    {customer?.phone && <p className="text-(--color-text-muted)">{customer.phone}</p>}
                    {customer?.address && <p className="text-(--color-text-muted)">{customer.address}</p>}
                  </div>
                ) : (
                  <div className="space-y-4 border-t border-(--color-border) pt-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <AiFieldHighlight active={aiFilledKeys.has("receiverName")}>
                        <Input
                          label="Receiver Name"
                          value={receiverName}
                          onChange={(e) => {
                            setReceiverName(e.target.value);
                            clearAiField("receiverName");
                          }}
                          required
                        />
                      </AiFieldHighlight>
                      <AiFieldHighlight active={aiFilledKeys.has("receiverPhone")}>
                        <Input
                          label="Receiver Phone"
                          value={receiverPhone}
                          onChange={(e) => {
                            setReceiverPhone(e.target.value);
                            clearAiField("receiverPhone");
                          }}
                        />
                      </AiFieldHighlight>
                    </div>
                    <AiFieldHighlight active={aiFilledKeys.has("receiverAddressLine1")}>
                      <Input
                        label="Address Line 1"
                        placeholder="Building no., street, barangay"
                        value={receiverAddressLine1}
                        onChange={(e) => {
                          setReceiverAddressLine1(e.target.value);
                          clearAiField("receiverAddressLine1");
                        }}
                      />
                    </AiFieldHighlight>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <AiFieldHighlight active={aiFilledKeys.has("receiverCity")}>
                        <Input
                          label="City / Municipality"
                          value={receiverCity}
                          onChange={(e) => {
                            setReceiverCity(e.target.value);
                            clearAiField("receiverCity");
                          }}
                        />
                      </AiFieldHighlight>
                      <AiFieldHighlight active={aiFilledKeys.has("receiverProvince")}>
                        <Input
                          label="Province"
                          value={receiverProvince}
                          onChange={(e) => {
                            setReceiverProvince(e.target.value);
                            clearAiField("receiverProvince");
                          }}
                        />
                      </AiFieldHighlight>
                    </div>
                  </div>
                )}
                <AiFieldHighlight active={aiFilledKeys.has("courierId")}>
                  <Select
                    label="Courier"
                    placeholder="Select courier…"
                    value={courierId}
                    onChange={(e) => {
                      setCourierId(e.target.value);
                      clearAiField("courierId");
                    }}
                    options={courierOptions.map((c) => ({ value: c.id, label: c.name }))}
                  />
                </AiFieldHighlight>
                <AiFieldHighlight active={aiFilledKeys.has("trackingNumber")}>
                  <Input
                    label="Tracking Number"
                    value={trackingNumber}
                    onChange={(e) => {
                      setTrackingNumber(e.target.value);
                      clearAiField("trackingNumber");
                    }}
                  />
                </AiFieldHighlight>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <AiFieldHighlight active={aiFilledKeys.has("shippingCost")}>
                    <CurrencyInput
                      label="Shipping Cost (paid to courier)"
                      value={shippingCost}
                      onChange={(e) => {
                        setShippingCost(e.target.value);
                        clearAiField("shippingCost");
                      }}
                    />
                  </AiFieldHighlight>
                  <CurrencyInput
                    label="Shipping Fee Charged (to customer)"
                    value={shippingFeeCharged}
                    onChange={(e) => setShippingFeeCharged(e.target.value)}
                  />
                </div>
              </>
            )}
            <AiFieldHighlight active={aiFilledKeys.has("note")}>
              <Input
                label="Notes (optional)"
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  clearAiField("note");
                }}
              />
            </AiFieldHighlight>

            <div className="space-y-2 border-t border-(--color-border) pt-3">
              <p className="text-sm font-medium text-(--color-text)">Product Lines</p>
              {activeItems.length === 0 && (
                <p className="text-xs text-(--color-text-muted)">Nothing left to ship on this order.</p>
              )}
              {activeItems.map((si) => (
                <div key={si.orderItemId} className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr] sm:items-end">
                  <span className="text-sm text-(--color-text)">
                    {si.name}
                    {si.sku ? ` (${si.sku})` : ""}
                    <span className="block text-xs text-(--color-text-muted)">{si.remainingQty} remaining</span>
                  </span>
                  <NumberInput
                    min={0}
                    max={si.remainingQty}
                    value={lineQtys[si.orderItemId] ?? "0"}
                    onChange={(e) => setLineQtys((prev) => ({ ...prev, [si.orderItemId]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

            <div className="space-y-3 border-t border-(--color-border) pt-3">
              <p className="text-sm font-medium text-(--color-text)">Packaging Materials</p>
              {packagingRows.map((row) => (
                <div key={row.rowId} className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
                  <Select
                    placeholder="Select packaging item…"
                    value={row.variantId}
                    onChange={(e) => updatePackagingRow(row.rowId, { variantId: e.target.value })}
                    options={packagingOptions.map((p) => ({
                      value: p.id,
                      label: p.sku ? `${p.label} (${p.sku})` : p.label,
                    }))}
                  />
                  <NumberInput
                    min={0.01}
                    step="any"
                    value={row.quantity}
                    onChange={(e) => updatePackagingRow(row.rowId, { quantity: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-(--color-danger)"
                    disabled={packagingRows.length === 1}
                    onClick={() => removePackagingRow(row.rowId)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button type="button" variant="secondary" onClick={addPackagingRow}>
                Add Row
              </Button>
            </div>
          </div>
          {formError && <p className="text-sm text-(--color-danger)">{formError}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" disabled={isPending} onClick={handleSubmitShipment}>
              {isPending ? "Saving…" : editingShipment ? "Save Changes" : "Save Shipment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!shipTarget}
        onOpenChange={(next) => {
          if (!next) {
            setShipTarget(null);
            setShipError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Shipped</DialogTitle>
            <DialogDescription>Mark this shipment as shipped? This will deduct stock.</DialogDescription>
          </DialogHeader>
          {shipError && <p className="text-sm text-(--color-danger)">{shipError}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" onClick={handleMarkShipped} disabled={isPending}>
              {isPending ? "Saving…" : "Mark Shipped"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deliverTarget}
        onOpenChange={(next) => {
          if (!next) {
            setDeliverTarget(null);
            setDeliverError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Delivered</DialogTitle>
            <DialogDescription>Mark this shipment as delivered?</DialogDescription>
          </DialogHeader>
          {deliverError && <p className="text-sm text-(--color-danger)">{deliverError}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" onClick={handleMarkDelivered} disabled={isPending}>
              {isPending ? "Saving…" : "Mark Delivered"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!pickupTarget}
        onOpenChange={(next) => {
          if (!next) {
            setPickupTarget(null);
            setPickupError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Picked Up</DialogTitle>
            <DialogDescription>Mark this shipment as picked up? This will deduct stock.</DialogDescription>
          </DialogHeader>
          {pickupError && <p className="text-sm text-(--color-danger)">{pickupError}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" onClick={handleMarkPickedUp} disabled={isPending}>
              {isPending ? "Saving…" : "Mark as Picked Up"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
