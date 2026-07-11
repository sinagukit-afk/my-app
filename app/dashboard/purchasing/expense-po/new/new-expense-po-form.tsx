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
  const [error, setError] = useState<string | null>(null);

  function updateRow(rowId: string, patch: Partial<ItemRow>) {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(rowId: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.rowId !== rowId) : prev));
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

      <Card>
        <CardHeader>
          <CardTitle>Order Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            label="Supplier (optional)"
            name="supplier_id"
            placeholder="Select a supplier…"
            options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <DatePicker label="Order Date" name="order_date" defaultValue={new Date().toISOString().slice(0, 10)} required />
            <DatePicker label="Expected Date" name="expected_date" />
            <CurrencyInput label="Shipping Fee" name="shipping_fee" defaultValue={0} />
          </div>
          <TextArea label="Notes" name="note" rows={2} />
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
              className="grid grid-cols-1 gap-3 border-b border-(--color-border) pb-4 last:border-0 sm:grid-cols-[1fr_1.5fr_0.7fr_0.8fr_0.8fr_auto] sm:items-end"
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
