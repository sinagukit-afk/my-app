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

  const selected = useMemo(
    () => variantOptions.find((v) => v.id === variantId) ?? null,
    [variantOptions, variantId]
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("item_name_snapshot", selected?.label ?? "");
    startTransition(async () => {
      const res = await addPurchaseOrderItem(purchaseOrderId, reference, formData);
      if (res.success) {
        onSaved();
        onOpenChange(false);
        setVariantId("");
      } else {
        alert(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            onChange={(e) => {
              setVariantId(e.target.value);
            }}
            placeholder="Select an item…"
            options={variantOptions.map((v) => ({
              value: v.id,
              label: v.sku ? `${v.label} (${v.sku})` : v.label,
            }))}
            required
            autoFocus
          />

          <div className="grid grid-cols-2 gap-4">
            <NumberInput label="Quantity" name="quantity_ordered" min={0.01} step="any" required />
            <CurrencyInput
              label="Unit Cost"
              name="unit_cost"
              defaultValue={selected?.cost ?? undefined}
              key={selected?.id ?? "none"}
            />
          </div>
          <CurrencyInput label="Discount" name="discount_amount" defaultValue={0} />
          <p className="text-xs text-(--color-text-muted)">Flat discount applied to this line's total.</p>

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
