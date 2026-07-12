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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createExpensePurchaseOrder, type NewItemInput } from "../actions";
import { randomId } from "@/lib/utils/random-id";
import { cn } from "@/lib/utils/cn";
import { AutoFillPanel } from "@/components/ai-autofill/auto-fill-panel";
import { AiFieldHighlight } from "@/components/ai-autofill/ai-field-highlight";
import { useAiFilledKeys } from "@/components/ai-autofill/use-ai-filled-keys";
import { supplierInvoiceSchema } from "@/lib/ai-autofill/schemas";
import { toIsoDate } from "@/lib/ai-autofill/normalize-date";
import type { DropdownOptionsByField, ExtractionResult } from "@/lib/ai-autofill/types";

type SupplierOption = { id: string; name: string };
type CategoryOption = { id: string; name: string };

type ItemRow = {
  rowId: string;
  categoryId: string;
  description: string;
  quantity: string;
  unitCost: string;
  discount: string;
};

function emptyRow(): ItemRow {
  return { rowId: randomId(), categoryId: "", description: "", quantity: "1", unitCost: "", discount: "0" };
}

type Props = {
  suppliers: SupplierOption[];
  categories: CategoryOption[];
};

export function NewExpensePurchaseOrderForm({ suppliers, categories }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<ItemRow[]>([emptyRow()]);
  const [aiRowIds, setAiRowIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

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

  const dropdownOptions: DropdownOptionsByField = useMemo(
    () => ({
      supplier_id: suppliers.map((s) => ({ value: s.id, label: s.name })),
      category_id: categories.map((c) => ({ value: c.id, label: c.name })),
    }),
    [suppliers, categories]
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
      const newRows: ItemRow[] = result.items.map((item) => ({
        rowId: randomId(),
        categoryId: typeof item.category_id === "string" ? item.category_id : "",
        description: typeof item.description === "string" ? item.description : "",
        quantity: typeof item.quantity === "number" ? String(item.quantity) : "1",
        unitCost: typeof item.unit_cost === "number" ? String(item.unit_cost) : "",
        discount: typeof item.discount === "number" ? String(item.discount) : "0",
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
      .filter((r) => r.categoryId && r.description.trim() && Number(r.quantity) > 0)
      .map((r) => ({
        expense_category_id: r.categoryId,
        description: r.description.trim(),
        quantity_ordered: Number(r.quantity) || 0,
        unit_cost: Number(r.unitCost) || 0,
        discount_amount: Number(r.discount) || 0,
      }));

    if (items.length === 0) {
      setError("Add at least one line item with a category, description, and quantity greater than zero.");
      return;
    }

    formData.set("items_json", JSON.stringify(items));

    startTransition(async () => {
      const res = await createExpensePurchaseOrder(formData);
      if (res.success) {
        router.push(`/dashboard/purchasing/expense-po/${res.reference}`);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PageHeader title="New Expense PO" description="Request approval to purchase an operating expense before buying." />

      <AutoFillPanel schema={supplierInvoiceSchema} dropdownOptions={dropdownOptions} onExtracted={handleExtracted} />

      <Card>
        <CardHeader>
          <CardTitle>Order Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
          <CardDescription>Add each expense category, description, quantity, and unit cost.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.map((row, i) => (
            <div
              key={row.rowId}
              className={cn(
                "grid grid-cols-1 gap-3 border-b border-(--color-border) pb-4 last:border-0 sm:grid-cols-[1fr_1.5fr_0.7fr_0.8fr_0.8fr_auto] sm:items-end",
                aiRowIds.has(row.rowId) && "rounded-md ring-2 ring-(--color-info) ring-offset-1 ring-offset-(--color-surface)"
              )}
            >
              <Select
                label={i === 0 ? "Category" : undefined}
                value={row.categoryId}
                onChange={(e) => updateRow(row.rowId, { categoryId: e.target.value })}
                placeholder="Select…"
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
              />
              <Input
                label={i === 0 ? "Description" : undefined}
                value={row.description}
                onChange={(e) => updateRow(row.rowId, { description: e.target.value })}
                placeholder="e.g. Aircon repair"
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
            {isPending ? "Creating…" : "Create Expense PO"}
          </Button>
        </div>
      </div>
    </form>
  );
}
