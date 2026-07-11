"use client";

import { useState, useTransition } from "react";
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
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Button } from "@/components/ui/button";
import { addExpensePurchaseOrderItem } from "../actions";

export type CategoryOption = { id: string; name: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrderId: string;
  reference: string;
  categories: CategoryOption[];
  onSaved: () => void;
};

export function ItemForm({ open, onOpenChange, purchaseOrderId, reference, categories, onSaved }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await addExpensePurchaseOrderItem(purchaseOrderId, reference, formData);
      if (res.success) {
        onOpenChange(false);
        onSaved();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add Line Item</DialogTitle>
            <DialogDescription>Add an expense category, description, quantity, and unit cost.</DialogDescription>
          </DialogHeader>

          <Select
            label="Category"
            name="expense_category_id"
            placeholder="Select a category…"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            required
          />
          <Input label="Description" name="description" placeholder="e.g. Aircon repair" required />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <NumberInput label="Quantity" name="quantity_ordered" min={0.01} step="any" defaultValue={1} required />
            <CurrencyInput label="Unit Cost" name="unit_cost" defaultValue={0} />
            <CurrencyInput label="Discount" name="discount_amount" defaultValue={0} />
          </div>

          {error && <p className="text-sm text-(--color-danger)">{error}</p>}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Adding…" : "Add Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
