"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { TextArea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { CurrencyInput } from "@/components/ui/currency-input";
import { NumberInput } from "@/components/ui/number-input";
import { Button } from "@/components/ui/button";
import { createManualIncomingWithItems, type NewIncomingItemInput } from "../actions";
import { randomId } from "@/lib/utils/random-id";
import { cn } from "@/lib/utils/cn";
import { AutoFillPanel } from "@/components/ai-autofill/auto-fill-panel";
import { AiFieldHighlight } from "@/components/ai-autofill/ai-field-highlight";
import { useAiFilledKeys } from "@/components/ai-autofill/use-ai-filled-keys";
import { manualIncomingSchema } from "@/lib/ai-autofill/schemas";
import { toIsoDate } from "@/lib/ai-autofill/normalize-date";
import type { DropdownOptionsByField, ExtractionResult } from "@/lib/ai-autofill/types";
import { formatCurrency, roundMoney } from "@/lib/utils/format";

export type VariantOption = {
  id: string;
  itemId: string;
  itemName: string;
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
  lineCost: string;
};

function emptyRow(): ItemRow {
  return { rowId: randomId(), variantId: "", quantity: "1", lineCost: "" };
}

type RowDerived = {
  defaultCost: number | null;
  unitCost: number | null;
  discount: number | null;
};

/** Line Cost is the manual input (what was actually paid for the whole line); cost per item and discount fall out of it. */
function deriveRow(row: ItemRow, variantOptions: VariantOption[]): RowDerived {
  const variant = variantOptions.find((v) => v.id === row.variantId);
  const defaultCost = variant?.cost ?? null;
  const qty = Number(row.quantity) || 0;
  const hasLineCost = row.lineCost !== "" && !Number.isNaN(Number(row.lineCost));
  if (!hasLineCost) return { defaultCost, unitCost: null, discount: null };

  const lineCost = Number(row.lineCost);
  const unitCost = qty > 0 ? lineCost / qty : null;
  const discount = defaultCost != null ? defaultCost * qty - lineCost : null;
  return { defaultCost, unitCost, discount };
}

const COST_VARIANCE_THRESHOLD = 0.5;

/** Warns when a row's computed cost per item is more than 50% below or above the item's registered cost — a sanity check, not a hard rule (registered costs go stale, suppliers change prices). */
function costVarianceWarning(defaultCost: number | null, unitCost: number | null): string | null {
  if (!defaultCost || defaultCost <= 0) return null;
  if (unitCost == null || unitCost <= 0) return null;

  const ratio = unitCost / defaultCost;
  if (ratio >= 1 - COST_VARIANCE_THRESHOLD && ratio <= 1 + COST_VARIANCE_THRESHOLD) return null;

  return `Cost per item (${formatCurrency(unitCost)}) is more than 50% ${ratio < 1 ? "below" : "above"} the registered cost (${formatCurrency(defaultCost)}) — double-check before submitting.`;
}

type Props = {
  suppliers: SupplierOption[];
  variantOptions: VariantOption[];
};

export function NewManualIncomingForm({ suppliers, variantOptions }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<ItemRow[]>([emptyRow()]);
  const [aiRowIds, setAiRowIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [costWarningNotice, setCostWarningNotice] = useState<string | null>(null);

  const [supplierId, setSupplierId] = useState("");
  const [dateReceived, setDateReceived] = useState(new Date().toISOString().slice(0, 10));
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
    const currentRow = rows.find((r) => r.rowId === rowId);
    const qty = Number(currentRow?.quantity) || 1;
    updateRow(rowId, {
      variantId,
      lineCost: variant?.cost != null ? String(roundMoney(variant.cost * qty)) : "",
    });
  }

  const dropdownOptions: DropdownOptionsByField = useMemo(
    () => ({
      supplier_id: suppliers.map((s) => ({ value: s.id, label: s.name })),
      variant_id: variantOptions.map((v) => ({ value: v.id, label: v.label, keywords: v.keywords })),
    }),
    [suppliers, variantOptions]
  );

  const itemOptions = useMemo(
    () =>
      variantOptions.map((v) => ({
        value: v.id,
        label: v.sku ? `${v.label} (${v.sku})` : v.label,
        keywords: [v.sku, v.keywords].filter(Boolean).join(" "),
      })),
    [variantOptions]
  );

  function handleExtracted(result: ExtractionResult) {
    const header = result.header;
    if (typeof header.supplier_id === "string") setSupplierId(header.supplier_id);
    if (typeof header.date_received === "string") {
      const iso = toIsoDate(header.date_received);
      if (iso) setDateReceived(iso);
    }
    if (typeof header.shipping_fee === "number") setShippingFee(String(header.shipping_fee));
    if (typeof header.note === "string" && header.note) setNote(header.note);

    if (result.items && result.items.length > 0) {
      const newRows: ItemRow[] = result.items.map((item) => {
        const variantId = typeof item.variant_id === "string" ? item.variant_id : "";
        const variant = variantOptions.find((v) => v.id === variantId);
        const qty = typeof item.quantity === "number" ? item.quantity : 1;
        const unitCost = typeof item.unit_price === "number" ? item.unit_price : variant?.cost ?? null;
        const discount = typeof item.discount === "number" ? item.discount : 0;
        const lineCost = unitCost != null ? Math.max(0, roundMoney(qty * unitCost - discount)) : null;
        return {
          rowId: randomId(),
          variantId,
          quantity: String(qty),
          lineCost: lineCost != null ? String(lineCost) : "",
        };
      });
      setRows(newRows);
      setAiRowIds(new Set(newRows.map((r) => r.rowId)));
    }

    markFilled(Object.keys(header).filter((key) => header[key] !== null && header[key] !== undefined && header[key] !== ""));
  }

  const subtotal = useMemo(
    () => rows.reduce((sum, r) => sum + Math.max(0, Number(r.lineCost) || 0), 0),
    [rows]
  );

  /** Flags rows whose item is also picked on another row, so accidental splits get caught before submit. */
  const duplicateVariantIds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      if (!r.variantId) continue;
      counts.set(r.variantId, (counts.get(r.variantId) ?? 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id));
  }, [rows]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    const items: NewIncomingItemInput[] = rows
      .filter((r) => r.variantId && Number(r.quantity) > 0)
      .map((r) => {
        const variant = variantOptions.find((v) => v.id === r.variantId);
        const derived = deriveRow(r, variantOptions);
        return {
          item_id: variant?.itemId ?? "",
          variant_id: r.variantId,
          item_name_snapshot: variant?.itemName ?? "",
          quantity: Number(r.quantity) || 0,
          unit_price: roundMoney(derived.unitCost ?? 0),
          discount_amount: roundMoney(derived.discount ?? 0),
          line_total: roundMoney(Number(r.lineCost) || 0),
        };
      })
      .filter((i) => i.item_id);

    if (items.length === 0) {
      setError("Add at least one line item with a quantity greater than zero.");
      return;
    }

    const flaggedCount = rows.filter((r) => {
      if (!r.variantId || Number(r.quantity) <= 0) return false;
      const derived = deriveRow(r, variantOptions);
      return costVarianceWarning(derived.defaultCost, derived.unitCost);
    }).length;
    setCostWarningNotice(
      flaggedCount > 0
        ? `${flaggedCount} item${flaggedCount > 1 ? "s" : ""} above have a unit cost more than 50% off their registered cost — the receipt will still be logged, but double-check those before relying on it.`
        : null
    );

    formData.set("items_json", JSON.stringify(items));

    startTransition(async () => {
      const res = await createManualIncomingWithItems(formData);
      if (res.success) {
        router.push("/dashboard/purchasing/receiving");
      } else {
        setError(res.error);
      }
    });
  }

  function handleFormKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.requestSubmit();
    }
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-6">
      <PageHeader
        title="Log Manual Incoming"
        description="Record inventory receipts not tied to a purchase order. Each item gets its own receiving number and is marked Received automatically."
      />

      <AutoFillPanel schema={manualIncomingSchema} dropdownOptions={dropdownOptions} onExtracted={handleExtracted} />

      <Card>
        <CardHeader>
          <CardTitle>Receipt Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <AiFieldHighlight active={aiFilledKeys.has("supplier_id")}>
              <Select
                label="Supplier (optional)"
                name="supplier_id"
                placeholder="Select a supplier…"
                value={supplierId}
                onChange={(e) => {
                  setSupplierId(e.target.value);
                  clearAiField("supplier_id");
                }}
                options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
              />
            </AiFieldHighlight>
            <AiFieldHighlight active={aiFilledKeys.has("date_received")}>
              <DatePicker
                label="Date Received"
                name="date_received"
                value={dateReceived}
                onChange={(e) => {
                  setDateReceived(e.target.value);
                  clearAiField("date_received");
                }}
                required
              />
            </AiFieldHighlight>
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
              name="notes"
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
          <CardDescription>
            Add each item, quantity, and the total line cost — cost per item and discount are calculated automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.map((row, i) => {
            const derived = deriveRow(row, variantOptions);
            const warning = costVarianceWarning(derived.defaultCost, derived.unitCost);
            return (
              <div
                key={row.rowId}
                className={cn(
                  "space-y-2 border-b border-(--color-border) pb-4 last:border-0",
                  aiRowIds.has(row.rowId) && "rounded-md ring-2 ring-(--color-info) ring-offset-1 ring-offset-(--color-surface)"
                )}
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
                  <Combobox
                    label={i === 0 ? "Item" : undefined}
                    value={row.variantId}
                    onValueChange={(next) => handleVariantChange(row.rowId, next)}
                    placeholder="Select an item…"
                    searchPlaceholder="Search by name or SKU…"
                    options={itemOptions}
                  />
                  <NumberInput
                    label={i === 0 ? "Quantity" : undefined}
                    min={0.001}
                    step="any"
                    decimals={3}
                    value={row.quantity}
                    onChange={(e) => updateRow(row.rowId, { quantity: e.target.value })}
                  />
                  <CurrencyInput
                    label={i === 0 ? "Line Cost" : undefined}
                    value={row.lineCost}
                    onChange={(e) => updateRow(row.rowId, { lineCost: e.target.value })}
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
                </div>
                <p className="text-xs text-(--color-text-muted)">
                  Default cost: {derived.defaultCost != null ? formatCurrency(derived.defaultCost) : "—"}
                  {" · "}Cost per item: {derived.unitCost != null ? formatCurrency(derived.unitCost) : "—"}
                  {" · "}Discount:{" "}
                  {derived.discount != null
                    ? `${formatCurrency(derived.discount)}${derived.discount < 0 ? " (markup)" : ""}`
                    : "—"}
                </p>
                {warning && <p className="text-xs text-(--color-danger)">{warning}</p>}
                {row.variantId && duplicateVariantIds.has(row.variantId) && (
                  <p className="text-xs text-(--color-warning)">
                    This item is also selected on another row — consider combining them into one line.
                  </p>
                )}
              </div>
            );
          })}
          <Button type="button" variant="secondary" onClick={addRow}>
            Add Row
          </Button>
        </CardContent>
        <CardFooter className="flex-col items-end gap-1 text-sm text-(--color-text-muted)">
          <p>
            Subtotal: <span className="font-medium text-(--color-text)">{formatCurrency(subtotal)}</span>
          </p>
          <p>
            Shipping Fee: <span className="font-medium text-(--color-text)">{formatCurrency(Number(shippingFee) || 0)}</span>
          </p>
          <p>
            Total Payable:{" "}
            <span className="font-semibold text-(--color-text)">
              {formatCurrency(subtotal + (Number(shippingFee) || 0))}
            </span>
          </p>
        </CardFooter>
      </Card>

      <div className="flex flex-col items-end gap-2">
        {costWarningNotice && <p className="text-sm text-(--color-danger)">{costWarningNotice}</p>}
        {error && <p className="text-sm text-(--color-danger)">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Log Receipt"}
          </Button>
        </div>
      </div>
    </form>
  );
}
