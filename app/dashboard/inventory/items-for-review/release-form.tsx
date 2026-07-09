"use client";

import { useTransition } from "react";
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
import { TextArea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { releaseOnHoldStock } from "./actions";
import type { ReviewRow } from "./items-for-review-table";

const DESTINATIONS = [
  { value: "available", label: "Available" },
  { value: "scrap", label: "Scrap (remove from stock)" },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: ReviewRow | null;
  onReleased: () => void;
};

export function ReleaseForm({ open, onOpenChange, row, onReleased }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await releaseOnHoldStock(formData);
      if (res.success) {
        onReleased();
        onOpenChange(false);
      } else {
        alert(res.error);
      }
    });
  }

  if (!row) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Release On Hold Stock</DialogTitle>
            <DialogDescription>
              {row.item_name}
              {row.variant_label ? ` — ${row.variant_label}` : ""} has{" "}
              <span className="font-medium text-(--color-text)">{row.on_hold_qty}</span> unit(s) parked
              On Hold (e.g. from a cancelled Production Order). Move some or all of it back to
              Available, or scrap it out of stock entirely.
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="variant_id" value={row.variant_id} />
          <input type="hidden" name="store_id" value={row.store_id} />

          <Select label="Release To" name="destination" options={DESTINATIONS} required />

          <NumberInput
            label={`Quantity (max ${row.on_hold_qty})`}
            name="quantity"
            step="any"
            min={0}
            max={row.on_hold_qty}
            defaultValue={row.on_hold_qty}
            required
          />

          <TextArea
            label="Note"
            name="note"
            rows={3}
            placeholder="Reason for release (optional)…"
          />

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Releasing…" : "Release Stock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
