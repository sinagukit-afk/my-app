"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { createShipment } from "../../../actions";
import { randomId } from "@/lib/utils/random-id";
import { AutoFillPanel } from "@/components/ai-autofill/auto-fill-panel";
import { AiFieldHighlight } from "@/components/ai-autofill/ai-field-highlight";
import { useAiFilledKeys } from "@/components/ai-autofill/use-ai-filled-keys";
import { shippingLabelSchema } from "@/lib/ai-autofill/schemas";
import type { DropdownOptionsByField, ExtractionResult } from "@/lib/ai-autofill/types";
import type { ShippableOrderItem, PackagingVariantOption, ShipmentCustomer } from "../../order-shipments";

type PackagingRow = { rowId: string; variantId: string; quantity: string };

function emptyPackagingRow(): PackagingRow {
  return { rowId: randomId(), variantId: "", quantity: "1" };
}

export function NewShipmentForm({
  orderId,
  orderNumber,
  shippableItems,
  packagingOptions,
  courierOptions,
  customer,
}: {
  orderId: string;
  orderNumber: string;
  shippableItems: ShippableOrderItem[];
  packagingOptions: PackagingVariantOption[];
  courierOptions: { id: string; name: string }[];
  customer: ShipmentCustomer | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

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
  const [lineQtys, setLineQtys] = useState<Record<string, string>>(() =>
    Object.fromEntries(shippableItems.map((si) => [si.orderItemId, String(si.remainingQty)]))
  );
  const [packagingRows, setPackagingRows] = useState<PackagingRow[]>([emptyPackagingRow()]);
  const { aiFilledKeys, markFilled, clear: clearAiField } = useAiFilledKeys();

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

  function updatePackagingRow(rowId: string, patch: Partial<PackagingRow>) {
    setPackagingRows((rows) => rows.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }

  function addPackagingRow() {
    setPackagingRows((rows) => [...rows, emptyPackagingRow()]);
  }

  function removePackagingRow(rowId: string) {
    setPackagingRows((rows) => (rows.length > 1 ? rows.filter((r) => r.rowId !== rowId) : rows));
  }

  function handleSubmit() {
    setFormError(null);
    const items = shippableItems
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
      const res = await createShipment(orderId, input);
      if (!res.success) {
        setFormError(res.error);
      } else {
        router.push(`/dashboard/orders/active-orders/${orderNumber}`);
      }
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Shipment"
        description="Allocate product and packaging quantities for this shipment. Creating a shipment does not affect stock — stock is deducted when it's marked Shipped (or Picked Up)."
      />

      <div className="space-y-4">
        <AutoFillPanel schema={shippingLabelSchema} dropdownOptions={dropdownOptions} onExtracted={handleExtracted} />

        <Card>
          <CardHeader>
            <CardTitle>Fulfillment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Product Lines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {shippableItems.length === 0 && (
              <p className="text-xs text-(--color-text-muted)">Nothing left to ship on this order.</p>
            )}
            {shippableItems.map((si) => (
              <div key={si.orderItemId} className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr] sm:items-end">
                <span className="text-sm text-(--color-text)">
                  {si.name}
                  {si.sku ? ` (${si.sku})` : ""}
                  <span className="block text-xs text-(--color-text-muted)">{si.remainingQty} remaining</span>
                </span>
                <NumberInput
                  min={0}
                  max={si.remainingQty}
                  step="0.001"
                  decimals={3}
                  value={lineQtys[si.orderItemId] ?? "0"}
                  onChange={(e) => setLineQtys((prev) => ({ ...prev, [si.orderItemId]: e.target.value }))}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Packaging Materials</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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
                  decimals={3}
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
          </CardContent>
        </Card>
      </div>

      {formError && <p className="text-sm text-(--color-danger)">{formError}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" disabled={isPending} onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="button" disabled={isPending} onClick={handleSubmit}>
          {isPending ? "Saving…" : "Save Shipment"}
        </Button>
      </div>
    </div>
  );
}
