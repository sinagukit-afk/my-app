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
import { createManualIncomingWithItems, type NewIncomingItemInput } from "../actions";
import { randomId } from "@/lib/utils/random-id";
import { cn } from "@/lib/utils/cn";
import { AutoFillPanel } from "@/components/ai-autofill/auto-fill-panel";
import { AiFieldHighlight } from "@/components/ai-autofill/ai-field-highlight";
import { useAiFilledKeys } from "@/components/ai-autofill/use-ai-filled-keys";
import { manualIncomingSchema } from "@/lib/ai-autofill/schemas";
import { toIsoDate } from "@/lib/ai-autofill/normalize-date";
import type { DropdownOptionsByField, ExtractionResult } from "@/lib/ai-autofill/types";

export type VariantOption = {
  id: string;
  itemId: string;
  itemName: string;
  label: string;
  sku: string | null;
  keywords?: string;
};

type SupplierOption = { id: string; name: string };
type PaymentTypeOption = { id: string; name: string };

type ItemRow = {
  rowId: string;
  variantId: string;
  quantity: string;
  unitPrice: string;
};

function emptyRow(): ItemRow {
  return { rowId: randomId(), variantId: "", quantity: "1", unitPrice: "" };
}

type Props = {
  suppliers: SupplierOption[];
  variantOptions: VariantOption[];
  paymentTypeOptions: PaymentTypeOption[];
};

export function NewManualIncomingForm({ suppliers, variantOptions, paymentTypeOptions }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<ItemRow[]>([emptyRow()]);
  const [aiRowIds, setAiRowIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const [supplierId, setSupplierId] = useState("");
  const [dateReceived, setDateReceived] = useState(new Date().toISOString().slice(0, 10));
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
    if (typeof header.date_received === "string") {
      const iso = toIsoDate(header.date_received);
      if (iso) setDateReceived(iso);
    }
    if (typeof header.note === "string" && header.note) setNote(header.note);

    if (result.items && result.items.length > 0) {
      const newRows: ItemRow[] = result.items.map((item) => ({
        rowId: randomId(),
        variantId: typeof item.variant_id === "string" ? item.variant_id : "",
        quantity: typeof item.quantity === "number" ? String(item.quantity) : "1",
        unitPrice: typeof item.unit_price === "number" ? String(item.unit_price) : "",
      }));
      setRows(newRows);
      setAiRowIds(new Set(newRows.map((r) => r.rowId)));
    }

    markFilled(Object.keys(header).filter((key) => header[key] !== null && header[key] !== undefined && header[key] !== ""));
  }

  const rowTotals = useMemo(
    () =>
      rows.map((r) => {
        const qty = Number(r.quantity) || 0;
        const price = Number(r.unitPrice) || 0;
        return qty * price;
      }),
    [rows]
  );

  const subtotal = rowTotals.reduce((sum, t) => sum + t, 0);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    const items: NewIncomingItemInput[] = rows
      .filter((r) => r.variantId && Number(r.quantity) > 0)
      .map((r) => {
        const variant = variantOptions.find((v) => v.id === r.variantId);
        return {
          item_id: variant?.itemId ?? "",
          variant_id: r.variantId,
          item_name_snapshot: variant?.itemName ?? "",
          quantity: Number(r.quantity) || 0,
          unit_price: Number(r.unitPrice) || 0,
        };
      })
      .filter((i) => i.item_id);

    if (items.length === 0) {
      setError("Add at least one line item with a quantity greater than zero.");
      return;
    }

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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <AiFieldHighlight active={aiFilledKeys.has("supplier_id")}>
              <Select
                label="Supplier"
                name="supplier_id"
                placeholder="— None —"
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
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Payment Method"
              name="payment_type_id"
              placeholder="— Not specified —"
              options={paymentTypeOptions.map((pt) => ({ value: pt.id, label: pt.name }))}
            />
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="is_credit_card"
                name="is_credit_card"
                value="true"
                className="h-4 w-4 rounded border border-(--color-border-strong) bg-(--color-surface) accent-(--color-primary)"
              />
              <label htmlFor="is_credit_card" className="text-sm text-(--color-text)">
                Paid via credit card
              </label>
            </div>
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
          <CardDescription>Add each item, quantity, and unit price.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.map((row, i) => (
            <div
              key={row.rowId}
              className={cn(
                "grid grid-cols-1 gap-3 border-b border-(--color-border) pb-4 last:border-0 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end",
                aiRowIds.has(row.rowId) && "rounded-md ring-2 ring-(--color-info) ring-offset-1 ring-offset-(--color-surface)"
              )}
            >
              <Select
                label={i === 0 ? "Item" : undefined}
                value={row.variantId}
                onChange={(e) => updateRow(row.rowId, { variantId: e.target.value })}
                placeholder="Select an item…"
                options={variantOptions.map((v) => ({
                  value: v.id,
                  label: v.sku ? `${v.label} (${v.sku})` : v.label,
                }))}
              />
              <NumberInput
                label={i === 0 ? "Quantity" : undefined}
                min={0.001}
                step="any"
                value={row.quantity}
                onChange={(e) => updateRow(row.rowId, { quantity: e.target.value })}
              />
              <CurrencyInput
                label={i === 0 ? "Unit Price" : undefined}
                value={row.unitPrice}
                onChange={(e) => updateRow(row.rowId, { unitPrice: e.target.value })}
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
          ))}
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
