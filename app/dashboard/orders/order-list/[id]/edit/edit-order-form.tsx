"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { TextArea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import { NumberInput } from "@/components/ui/number-input";
import { Button } from "@/components/ui/button";
import { adjustOrderItems, type OrderItemInput } from "../../actions";

export type VariantOption = {
  id: string;
  label: string;
  sku: string | null;
  price: number | null;
};

type CustomerOption = { id: string; name: string };

type ExistingItem = {
  variant_id: string;
  item_name_snapshot: string | null;
  sku_snapshot: string | null;
  quantity: number;
  unit_price: number;
  line_discount: number;
};

type ItemRow = {
  rowId: string;
  variantId: string;
  quantity: string;
  unitPrice: string;
  discount: string;
};

function emptyRow(): ItemRow {
  return { rowId: crypto.randomUUID(), variantId: "", quantity: "1", unitPrice: "", discount: "0" };
}

type Props = {
  orderId: string;
  customerId: string | null;
  note: string | null;
  items: ExistingItem[];
  customers: CustomerOption[];
  variantOptions: VariantOption[];
};

export function EditOrderForm({ orderId, customerId, note, items, customers, variantOptions }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<ItemRow[]>(
    items.length > 0
      ? items.map((item) => ({
          rowId: crypto.randomUUID(),
          variantId: item.variant_id,
          quantity: String(item.quantity),
          unitPrice: String(item.unit_price),
          discount: String(item.line_discount),
        }))
      : [emptyRow()]
  );

  function updateRow(rowId: string, patch: Partial<ItemRow>) {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(rowId: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.rowId !== rowId) : prev));
  }

  function handleVariantChange(rowId: string, variantId: string) {
    const variant = variantOptions.find((v) => v.id === variantId);
    updateRow(rowId, { variantId, unitPrice: variant?.price != null ? String(variant.price) : "" });
  }

  const rowTotals = useMemo(
    () =>
      rows.map((r) => {
        const qty = Number(r.quantity) || 0;
        const price = Number(r.unitPrice) || 0;
        const discount = Number(r.discount) || 0;
        return Math.max(0, qty * price - discount);
      }),
    [rows]
  );

  const subtotal = rowTotals.reduce((sum, t) => sum + t, 0);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const newItems: OrderItemInput[] = rows
      .filter((r) => r.variantId && Number(r.quantity) > 0)
      .map((r) => {
        const variant = variantOptions.find((v) => v.id === r.variantId);
        return {
          variant_id: r.variantId,
          item_name_snapshot: variant?.label ?? "",
          sku_snapshot: variant?.sku ?? null,
          quantity: Number(r.quantity) || 0,
          unit_price: Number(r.unitPrice) || 0,
          line_discount: Number(r.discount) || 0,
        };
      });

    if (newItems.length === 0) {
      alert("Add at least one line item with a quantity greater than zero.");
      return;
    }

    formData.set("items_json", JSON.stringify(newItems));

    startTransition(async () => {
      const res = await adjustOrderItems(orderId, formData);
      if (res.success) {
        router.push("/dashboard/orders/order-list");
      } else {
        alert(res.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PageHeader
        title="Edit Order"
        description="Change the customer, notes, or line items. Stock is automatically deducted or returned to match."
      />

      <Card>
        <CardHeader>
          <CardTitle>Order Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            label="Customer"
            name="customer_id"
            placeholder="Walk-in customer"
            defaultValue={customerId ?? ""}
            options={customers.map((c) => ({ value: c.id, label: c.name }))}
          />
          <TextArea label="Notes" name="note" rows={2} defaultValue={note ?? ""} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
          <CardDescription>
            Add each item, quantity, unit price, and any per-item discount. Increasing a quantity or
            adding an item deducts more stock; decreasing or removing one returns stock.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.map((row, i) => (
            <div
              key={row.rowId}
              className="grid grid-cols-1 gap-3 border-b border-(--color-border) pb-4 last:border-0 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end"
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
                label={i === 0 ? "Unit Price" : undefined}
                value={row.unitPrice}
                onChange={(e) => updateRow(row.rowId, { unitPrice: e.target.value })}
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

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
