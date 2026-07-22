"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useRegisterUnsavedChanges } from "@/lib/hooks/use-unsaved-changes";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { TextArea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { CurrencyInput } from "@/components/ui/currency-input";
import { NumberInput } from "@/components/ui/number-input";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createAssetPurchaseOrder, type NewItemInput } from "../actions";
import { randomId } from "@/lib/utils/random-id";
import { cn } from "@/lib/utils/cn";
import { AutoFillPanel } from "@/components/ai-autofill/auto-fill-panel";
import { AiFieldHighlight } from "@/components/ai-autofill/ai-field-highlight";
import { useAiFilledKeys } from "@/components/ai-autofill/use-ai-filled-keys";
import { supplierInvoiceSchema } from "@/lib/ai-autofill/schemas";
import { toIsoDate } from "@/lib/ai-autofill/normalize-date";
import type { DropdownOptionsByField, ExtractionResult } from "@/lib/ai-autofill/types";
import { formatCurrency } from "@/lib/utils/format";

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

/** Discount can never be negative or exceed the line's gross (qty × unit cost). */
function clampDiscount(gross: number, discount: number): number {
  return Math.min(Math.max(discount, 0), Math.max(gross, 0));
}

type Props = {
  suppliers: SupplierOption[];
  categories: CategoryOption[];
};

export function NewAssetPurchaseOrderForm({ suppliers, categories }: Props) {
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

  const initialSnapshot = useRef(JSON.stringify({ rows, supplierId, orderDate, shippingFee, note }));
  const isDirty =
    JSON.stringify({ rows, supplierId, orderDate, shippingFee, note }) !== initialSnapshot.current;
  useRegisterUnsavedChanges(isDirty);

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
        const gross = qty * cost;
        const discount = clampDiscount(gross, Number(r.discount) || 0);
        return gross - discount;
      }),
    [rows]
  );

  const subtotal = rowTotals.reduce((sum, t) => sum + t, 0);

  /** Per-category subtotal breakdown — only worth showing once a PO actually spans more than one category. */
  const categoryBreakdown = useMemo(() => {
    const totals = new Map<string, number>();
    rows.forEach((r, i) => {
      if (!r.categoryId) return;
      totals.set(r.categoryId, (totals.get(r.categoryId) ?? 0) + rowTotals[i]);
    });
    return [...totals.entries()]
      .map(([id, total]) => ({ id, name: categories.find((c) => c.id === id)?.name ?? "—", total }))
      .filter((c) => c.total > 0);
  }, [rows, rowTotals, categories]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    const items: NewItemInput[] = rows
      .filter((r) => r.categoryId && r.description.trim() && Number(r.quantity) > 0)
      .map((r) => {
        const quantity_ordered = Number(r.quantity) || 0;
        const unit_cost = Number(r.unitCost) || 0;
        return {
          asset_category_id: r.categoryId,
          description: r.description.trim(),
          quantity_ordered,
          unit_cost,
          discount_amount: clampDiscount(quantity_ordered * unit_cost, Number(r.discount) || 0),
        };
      });

    if (items.length === 0) {
      setError("Add at least one line item with a category, description, and quantity greater than zero.");
      return;
    }

    formData.set("items_json", JSON.stringify(items));

    startTransition(async () => {
      const res = await createAssetPurchaseOrder(formData);
      if (res.success) {
        // replace, not push: a successful save should drop this form out of history so
        // browser Back doesn't return the user to the (now stale) create form.
        router.replace(`/dashboard/purchasing/asset-po/${res.reference}`);
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
        title="New Asset PO"
        description="Request approval to purchase a fixed asset before buying."
        backHref="/dashboard/purchasing/asset-po"
        backLabel="Back to Asset PO"
      />

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
          <CardDescription>Add each asset category, description, quantity, and unit cost.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.map((row, i) => (
            <div
              key={row.rowId}
              className={cn(
                "space-y-1 border-b border-(--color-border) pb-4 last:border-0",
                aiRowIds.has(row.rowId) && "rounded-md ring-2 ring-(--color-info) ring-offset-1 ring-offset-(--color-surface)"
              )}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.5fr_0.7fr_0.8fr_0.8fr_auto] sm:items-end">
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
                  placeholder="e.g. Laser Machine"
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
              <p className="text-xs text-(--color-text-muted)">
                Line Total: <span className="font-medium text-(--color-text)">{formatCurrency(rowTotals[i])}</span>
              </p>
            </div>
          ))}
          <Button type="button" variant="secondary" onClick={addRow}>
            Add Row
          </Button>
        </CardContent>
        <CardFooter className="flex-col items-end gap-1 text-sm text-(--color-text-muted)">
          {categoryBreakdown.length > 1 && (
            <div className="mb-1 w-full space-y-0.5 border-b border-(--color-border) pb-2">
              {categoryBreakdown.map((c) => (
                <p key={c.id} className="flex justify-between gap-4">
                  <span>{c.name}</span>
                  <span className="text-(--color-text)">{formatCurrency(c.total)}</span>
                </p>
              ))}
            </div>
          )}
          <p>
            Subtotal: <span className="font-medium text-(--color-text)">{formatCurrency(subtotal)}</span>
          </p>
        </CardFooter>
      </Card>

      <div className="flex flex-col items-end gap-2">
        {error && <p className="text-sm text-(--color-danger)">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating…" : "Create Asset PO"}
          </Button>
        </div>
      </div>
    </form>
  );
}
