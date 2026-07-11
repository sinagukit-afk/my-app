"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { createFixedAsset, updateFixedAsset } from "./actions";

export type CategoryOption = { id: string; name: string };
export type SupplierOption = { id: string; name: string };

export type EditingAsset = {
  id: string;
  name: string;
  purchased_date: string;
  cost: number;
  salvage_value: number;
  useful_life_months: number;
  supplier_id: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryOption[];
  suppliers: SupplierOption[];
  asset?: EditingAsset | null;
};

export function AssetFormDialog({ open, onOpenChange, categories, suppliers, asset }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!asset;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = isEdit ? await updateFixedAsset(asset!.id, formData) : await createFixedAsset(formData);
      if (res.success) {
        onOpenChange(false);
        router.refresh();
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
            <DialogTitle>{isEdit ? "Edit Fixed Asset" : "Add Fixed Asset"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update this asset's purchase details."
                : "The category supplies the asset/accum. depreciation/expense accounts."}
            </DialogDescription>
          </DialogHeader>

          {!isEdit && (
            <Select
              label="Category"
              name="category_id"
              placeholder="Select a category…"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              required
            />
          )}

          <Input label="Asset Name" name="name" defaultValue={asset?.name} placeholder="e.g. Laser Machine" required />

          <Select
            label="Supplier (optional)"
            name="supplier_id"
            defaultValue={asset?.supplier_id ?? ""}
            options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DatePicker
              label="Purchased Date"
              name="purchased_date"
              defaultValue={asset?.purchased_date ?? new Date().toISOString().slice(0, 10)}
              required
            />
            <NumberInput
              label="Useful Life (months)"
              name="useful_life_months"
              min={1}
              defaultValue={asset?.useful_life_months}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <CurrencyInput label="Cost" name="cost" defaultValue={asset?.cost} required />
            <CurrencyInput label="Salvage Value" name="salvage_value" defaultValue={asset?.salvage_value ?? 0} />
          </div>

          {error && <p className="text-sm text-(--color-danger)">{error}</p>}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Asset"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
