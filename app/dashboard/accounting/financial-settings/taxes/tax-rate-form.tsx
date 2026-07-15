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
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Button } from "@/components/ui/button";
import { createTaxRate, updateTaxRate, type ActionResult } from "./actions";
import type { TaxRateRow } from "./tax-rates-table";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taxRate?: TaxRateRow | null;
  onSaved: () => void;
};

export function TaxRateForm({ open, onOpenChange, taxRate, onSaved }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(taxRate);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res: ActionResult = isEdit
        ? await updateTaxRate(taxRate!.id, formData)
        : await createTaxRate(formData);

      if (res.success) {
        onSaved();
        onOpenChange(false);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setError(null);
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit Tax Rate" : "Add Tax Rate"}</DialogTitle>
            <DialogDescription>
              {isEdit ? "Update this tax rate's name or percentage." : "Add a reference tax rate."}
            </DialogDescription>
          </DialogHeader>

          <Input
            label="Name"
            name="name"
            placeholder="e.g. VAT"
            defaultValue={taxRate?.name ?? ""}
            required
            autoFocus
          />

          <NumberInput
            label="Rate (%)"
            name="rate_percent"
            placeholder="e.g. 12.00"
            defaultValue={taxRate?.rate_percent ?? ""}
            min={0}
            max={100}
            step={0.01}
            decimals={2}
            required
            className="max-w-[160px]"
          />

          {error && <p className="text-sm text-(--color-danger)">{error}</p>}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Tax Rate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
