"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { TextArea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { CurrencyInput } from "@/components/ui/currency-input";
import { NumberInput } from "@/components/ui/number-input";
import { Button } from "@/components/ui/button";
import { createPurchaseOrderWithItems, type NewItemInput } from "../actions";
import { randomId } from "@/lib/utils/random-id";
import { cn } from "@/lib/utils/cn";
import { AutoFillPanel } from "@/components/ai-autofill/auto-fill-panel";
import { AiFieldHighlight } from "@/components/ai-autofill/ai-field-highlight";
import { useAiFilledKeys } from "@/components/ai-autofill/use-ai-filled-keys";
import { inventoryPurchaseSchema } from "@/lib/ai-autofill/schemas";
import { toIsoDate } from "@/lib/ai-autofill/normalize-date";
import type { DropdownOptionsByField, ExtractionResult } from "@/lib/ai-autofill/types";

export type VariantOption = {
  id: string;
  label: string;
  sku: string | null;
  cost: number | null;
  keywords?: string;
};

type SupplierOption = { id: string; name: string };

type ItemRow = {
  rowId: string;
  variantId: string;
  quantity: string;
  unitCost: string;
  discount: string;
};

function emptyRow(): ItemRow {
  return { rowId: randomId(), variantId: "", quantity: "1", unitCost: "", discount: "0" };
}

const COST_VARIANCE_THRESHOLD = 0.5;

/** Warns when a row's unit cost is more than 50% below or above the item's registered cost — a sanity check, not a hard rule (registered costs go stale, suppliers change prices). */
function costVarianceWarning(row: ItemRow, variantOptions: VariantOption[]): string | null {
  const variant = variantOptions.find((v) => v.id === row.variantId);
  const registeredCost = variant?.cost;
  if (!registeredCost || registeredCost <= 0) return null;

  const unitCost = Number(row.unitCost);
  if (!row.unitCost || Number.isNaN(unitCost)) return null;

  const ratio = unitCost / registeredCost;
  if (ratio >= 1 - COST_VARIANCE_THRESHOLD && ratio <= 1 + COST_VARIANCE_THRESHOLD) return null;

  return `Unit cost (₱${unitCost.toFixed(2)}) is more than 50% ${ratio < 1 ? "below" : "above"} the registered cost (₱${registeredCost.toFixed(2)}) — double-check before submitting.`;
}

type Props = {
  suppliers: SupplierOption[];
  variantOptions: VariantOption[];
};

export function NewPurchaseOrderForm({ suppliers, variantOptions }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<ItemRow[]>([emptyRow()]);
  const [aiRowIds, setAiRowIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [costWarningNotice, setCostWarningNotice] = useState<string | null>(null);

  const [supplierId, setSupplierId] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [shippingFee, setShippingFee] = useState("0");
  const [note, setNote] = useState("");
  const { aiFilledKeys, markFilled, clear: clearAiField } = useAiFilledKeys();

  function updateRow(rowId: string, patch: Partial<ItemRow>) {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
    setAiRowIds((prev) => {
      if (!prev.has(rowId)) return prev;
      const next = new Set(prev);
      next.delete(rowId);
      return next;
    });
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(rowId: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.rowId !== rowId) : prev));
  }

  function handleVariantChange(rowId: string, variantId: string) {
    const variant = variantOptions.find((v) => v.id === variantId);
    updateRow(rowId, { variantId, unitCost: variant?.cost != null ? String(variant.cost) : "" });
  }

  const dropdownOptions: DropdownOptionsByField = useMemo(
    () => ({
      supplier_id: suppliers.map((s) => ({ value: s.id, label: s.name })),
      variant_id: variantOptions.map((v) => ({ value: v.id, label: v.label, keywords: v.keywords })),
    }),
    [suppliers, variantOptions]
  );

  function handleExtracted(result: ExtractionResult) {
    const header = result.header;
    if (typeof header.supplier_id === "string") setSupplierId(header.supplier_id);
    if (typeof header.order_date === "string") {
      const iso = toIsoDate(header.order_date);
      if (iso) setOrderDate(iso);
    }
    if (typeof header.shipping_fee === "number") setShippingFee(String(header.shipping_fee));
    if (typeof header.note === "string" && header.note) setNote(header.note);

    if (result.items && result.items.length > 0) {
      const newRows: ItemRow[] = result.items.map((item) => {
        const variantId = typeof item.variant_id === "string" ? item.variant_id : "";
        const variant = variantOptions.find((v) => v.id === variantId);
        return {
          rowId: randomId(),
          variantId,
          quantity: typeof item.quantity === "number" ? String(item.quantity) : "1",
          unitCost:
            typeof item.unit_cost === "number" ? String(item.unit_cost) : variant?.cost != null ? String(variant.cost) : "",
          discount: typeof item.discount === "number" ? String(item.discount) : "0",
        };
      });
      setRows(newRows);
      setAiRowIds(new Set(newRows.map((r) => r.rowId)));
    }

    markFilled(Object.keys(header).filter((key) => header[key] !== null && header[key] !== undefined && header[key] !== ""));
  }

  const rowTotals = useMemo(
    () =>
      rows.map((r) => {
        const qty = Number(r.quantity) || 0;
        const cost = Number(r.unitCost) || 0;
        const discount = Number(r.discount) || 0;
        return Math.max(0, qty * cost - discount);
      }),
    [rows]
  );

  const subtotal = rowTotals.reduce((sum, t) => sum + t, 0);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    const items: NewItemInput[] = rows
      .filter((r) => r.variantId && Number(r.quantity) > 0)
      .map((r) => {
        const variant = variantOptions.find((v) => v.id === r.variantId);
        return {
          variant_id: r.variantId,
          item_name_snapshot: variant?.label ?? "",
          quantity_ordered: Number(r.quantity) || 0,
          unit_cost: Number(r.unitCost) || 0,
          discount_amount: Number(r.discount) || 0,
        };
      });

    if (items.length === 0) {
      setError("Add at least one line item with a quantity greater than zero.");
      return;
    }

    const flaggedCount = rows.filter(
      (r) => r.variantId && Number(r.quantity) > 0 && costVarianceWarning(r, variantOptions)
    ).length;
    setCostWarningNotice(
      flaggedCount > 0
        ? `${flaggedCount} item${flaggedCount > 1 ? "s" : ""} above have a unit cost more than 50% off their registered cost — the purchase order will still be created, but double-check those before relying on it.`
        : null
    );

    formData.set("items_json", JSON.stringify(items));

    startTransition(async () => {
      const res = await createPurchaseOrderWithItems(formData);
      if (res.success) {
        router.push(`/dashboard/purchasing/inventory-po/${res.reference}`);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PageHeader title="New Purchase Order" description="Set up the order header and its line items in one step." />

      <AutoFillPanel schema={inventoryPurchaseSchema} dropdownOptions={dropdownOptions} onExtracted={handleExtracted} />

      <Card>
        <CardHeader>
          <CardTitle>Order Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AiFieldHighlight active={aiFilledKeys.has("supplier_id")}>
            <Select
              label="Supplier"
              name="supplier_id"
              placeholder="Select a supplier…"
              value={supplierId}
              onChange={(e) => {
                setSupplierId(e.target.value);
                clearAiField("supplier_id");
              }}
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
              required
            />
          </AiFieldHighlight>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <AiFieldHighlight active={aiFilledKeys.has("order_date")}>
              <DatePicker
                label="Order Date"
                name="order_date"
                value={orderDate}
                onChange={(e) => {
                  setOrderDate(e.target.value);
                  clearAiField("order_date");
                }}
                required
              />
            </AiFieldHighlight>
            <DatePicker label="Expected Date" name="expected_date" />
            <AiFieldHighlight active={aiFilledKeys.has("shipping_fee")}>
              <CurrencyInput
                label="Shipping Fee"
                name="shipping_fee"
                value={shippingFee}
                onChange={(e) => {
                  setShippingFee(e.target.value);
                  clearAiField("shipping_fee");
                }}
              />
            </AiFieldHighlight>
          </div>
          <AiFieldHighlight active={aiFilledKeys.has("note")}>
            <TextArea
              label="Notes"
              name="note"
              rows={2}
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
          <CardTitle>Line Items</CardTitle>
          <CardDescription>Add each item, quantity, unit cost, and any per-item discount.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.map((row, i) => {
            const warning = costVarianceWarning(row, variantOptions);
            return (
              <div
                key={row.rowId}
                className={cn(
                  "grid grid-cols-1 gap-3 border-b border-(--color-border) pb-4 last:border-0 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end",
                  aiRowIds.has(row.rowId) && "rounded-md ring-2 ring-(--color-info) ring-offset-1 ring-offset-(--color-surface)"
                )}
              >
                <Select
                  label={i === 0 ? "Item" : undefined}
                  value={row.variantId}
                  onChange={(e) => handleVariantChange(row.rowId, e.target.value)}
                  placeholder="Select an item…"
                  options={variantOptions.map((v) => ({
                    value: v.id,
                    label: v.sku ? `${v.label} (${v.sku})` : v.label,
                  }))}
                />
                <NumberInput
                  label={i === 0 ? "Quantity" : undefined}
                  min={0.01}
                  step="any"
                  value={row.quantity}
                  onChange={(e) => updateRow(row.rowId, { quantity: e.target.value })}
                />
                <CurrencyInput
                  label={i === 0 ? "Unit Cost" : undefined}
                  value={row.unitCost}
                  onChange={(e) => updateRow(row.rowId, { unitCost: e.target.value })}
                />
                <CurrencyInput
                  label={i === 0 ? "Discount" : undefined}
                  value={row.discount}
                  onChange={(e) => updateRow(row.rowId, { discount: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="text-(--color-danger)"
                  disabled={rows.length === 1}
                  onClick={() => removeRow(row.rowId)}
                >
                  Remove
                </Button>
                {warning && <p className="text-xs text-(--color-danger) sm:col-span-5">{warning}</p>}
              </div>
            );
          })}
          <Button type="button" variant="secondary" onClick={addRow}>
            Add Row
          </Button>
        </CardContent>
        <CardFooter className="flex-col items-end gap-1 text-sm text-(--color-text-muted)">
          <p>
            Subtotal: <span className="font-medium text-(--color-text)">₱{subtotal.toFixed(2)}</span>
          </p>
        </CardFooter>
      </Card>

      <div className="flex flex-col items-end gap-2">
        {costWarningNotice && <p className="text-sm text-(--color-danger)">{costWarningNotice}</p>}
        {error && <p className="text-sm text-(--color-danger)">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating…" : "Create Purchase Order"}
          </Button>
        </div>
      </div>
    </form>
  );
}
