"use client";

import { useTransition, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TextArea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createManualIncoming, type ActionResult } from "./actions";

export type SupplierOption = { id: string; name: string };
export type ItemOption = {
  id: string;
  name: string;
  variants: { id: string; label: string }[];
};
export type PaymentTypeOption = { id: string; name: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: SupplierOption[];
  items: ItemOption[];
  paymentTypeOptions: PaymentTypeOption[];
  onSaved: () => void;
};

export function ManualIncomingForm({ open, onOpenChange, suppliers, items, paymentTypeOptions, onSaved }: Props) {
  const [isPending, startTransition] = useTransition();
  const [selectedItemId, setSelectedItemId] = useState("");

  const selectedItem = items.find((i) => i.id === selectedItemId);
  const variants = selectedItem?.variants ?? [];

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res: ActionResult = await createManualIncoming(formData);
      if (res.success) {
        onSaved();
        onOpenChange(false);
      } else {
        alert(res.error);
      }
    });
  }

  function handleOpenChange(open: boolean) {
    if (!open) setSelectedItemId("");
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Log Manual Incoming</DialogTitle>
            <DialogDescription>
              Record a manual inventory receipt not tied to a purchase order. It will get its
              own receiving number and be marked Received automatically.
            </DialogDescription>
          </DialogHeader>

          {/* Supplier */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-(--color-text)">Supplier</label>
            <select
              name="supplier_id"
              className="w-full rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm text-(--color-text) focus:outline-none focus:ring-2 focus:ring-(--color-ring)"
            >
              <option value="">— None —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Item */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-(--color-text)">
              Item <span className="text-(--color-danger)">*</span>
            </label>
            <select
              name="item_id"
              required
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="w-full rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm text-(--color-text) focus:outline-none focus:ring-2 focus:ring-(--color-ring)"
            >
              <option value="">— Select item —</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>

          {/* Variant — only shown when item has multiple variants */}
          {variants.length > 1 && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-(--color-text)">Variant</label>
              <select
                name="variant_id"
                className="w-full rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm text-(--color-text) focus:outline-none focus:ring-2 focus:ring-(--color-ring)"
              >
                <option value="">— Auto-resolve (first variant) —</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quantity + Unit Price */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Quantity"
              name="quantity"
              type="number"
              min="0.001"
              step="any"
              required
              placeholder="0"
            />
            <Input
              label="Unit Price (₱)"
              name="unit_price"
              type="number"
              min="0"
              step="0.01"
              required
              placeholder="0.00"
            />
          </div>

          {/* Date Received */}
          <Input
            label="Date Received"
            name="date_received"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
          />

          {/* Payment Method */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-(--color-text)">Payment Method</label>
            <select
              name="payment_type_id"
              className="w-full rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm text-(--color-text) focus:outline-none focus:ring-2 focus:ring-(--color-ring)"
            >
              <option value="">— Not specified —</option>
              {paymentTypeOptions.map((pt) => (
                <option key={pt.id} value={pt.id}>
                  {pt.name}
                </option>
              ))}
            </select>
          </div>

          {/* Credit Card flag */}
          <div className="flex items-center gap-2">
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

          {/* Notes */}
          <TextArea label="Notes" name="notes" rows={3} placeholder="Optional notes…" />

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Log Receipt"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
