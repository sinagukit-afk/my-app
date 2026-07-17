"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { NumberInput } from "@/components/ui/number-input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Button } from "@/components/ui/button";
import { addPurchaseOrderItem } from "../actions";
import { formatCurrency, roundMoney } from "@/lib/utils/format";

export type VariantOption = {
  id: string;
  label: string;
  sku: string | null;
  cost: number | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrderId: string;
  reference: string;
  variantOptions: VariantOption[];
  onSaved: () => void;
};

export function ItemForm({ open, onOpenChange, purchaseOrderId, reference, variantOptions, onSaved }: Props) {
  const [isPending, startTransition] = useTransition();
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [lineCost, setLineCost] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => variantOptions.find((v) => v.id === variantId) ?? null,
    [variantOptions, variantId]
  );

  const derived = useMemo(() => {
    const defaultCost = selected?.cost ?? null;
    const qty = Number(quantity) || 0;
    const hasLineCost = lineCost !== "" && !Number.isNaN(Number(lineCost));
    if (!hasLineCost) return { defaultCost, unitCost: null as number | null, discount: null as number | null };

    const line = Number(lineCost);
    const unitCost = qty > 0 ? line / qty : null;
    const discount = defaultCost != null ? defaultCost * qty - line : null;
    return { defaultCost, unitCost, discount };
  }, [selected, quantity, lineCost]);

  function handleVariantChange(nextVariantId: string) {
    setVariantId(nextVariantId);
    const variant = variantOptions.find((v) => v.id === nextVariantId);
    const qty = Number(quantity) || 1;
    setLineCost(variant?.cost != null ? String(roundMoney(variant.cost * qty)) : "");
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("item_name_snapshot", selected?.label ?? "");
    formData.set("unit_cost", String(roundMoney(derived.unitCost ?? 0)));
    formData.set("discount_amount", String(roundMoney(derived.discount ?? 0)));
    formData.set("line_total", String(roundMoney(Number(lineCost) || 0)));
    startTransition(async () => {
      const res = await addPurchaseOrderItem(purchaseOrderId, reference, formData);
      if (res.success) {
        onSaved();
        onOpenChange(false);
        setVariantId("");
        setQuantity("1");
        setLineCost("");
      } else {
        setError(res.error);
      }
    });
  }

  function handleOpenChange(next: boolean) {
    if (!next) setError(null);
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add Line Item</DialogTitle>
            <DialogDescription>Add an item to this purchase order.</DialogDescription>
          </DialogHeader>

          <Select
            label="Item"
            name="variant_id"
            value={variantId}
            onChange={(e) => handleVariantChange(e.target.value)}
            placeholder="Select an item…"
            options={variantOptions.map((v) => ({
              value: v.id,
              label: v.sku ? `${v.label} (${v.sku})` : v.label,
            }))}
            required
            autoFocus
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumberInput
              label="Quantity"
              name="quantity_ordered"
              min={0.01}
              step="any"
              decimals={3}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
            <CurrencyInput label="Line Cost" value={lineCost} onChange={(e) => setLineCost(e.target.value)} />
          </div>

          <p className="text-xs text-(--color-text-muted)">
            Default cost: {derived.defaultCost != null ? formatCurrency(derived.defaultCost) : "—"}
            {" · "}Cost per item: {derived.unitCost != null ? formatCurrency(derived.unitCost) : "—"}
            {" · "}Discount:{" "}
            {derived.discount != null
              ? `${formatCurrency(derived.discount)}${derived.discount < 0 ? " (markup)" : ""}`
              : "—"}
          </p>

          {error && <p className="text-sm text-(--color-danger)">{error}</p>}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending || !variantId}>
              {isPending ? "Adding…" : "Add Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
