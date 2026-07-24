"use client";

import { useEffect, useState, useTransition } from "react";
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
import { CurrencyInput } from "@/components/ui/currency-input";
import { NumberInput } from "@/components/ui/number-input";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { createModifier, updateModifier, type ActionResult } from "../actions";
import type { ModifierRow } from "./product-detail";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  modifier?: ModifierRow | null;
  onSaved: () => void;
};

export function ModifierForm({ open, onOpenChange, productId, modifier, onSaved }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(true);
  const isEdit = Boolean(modifier);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setPublished(modifier?.published ?? true);
  }, [open, modifier]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res: ActionResult = isEdit
        ? await updateModifier(modifier!.id, productId, formData)
        : await createModifier(productId, formData);

      if (res.success) {
        onSaved();
        onOpenChange(false);
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
            <DialogTitle>{isEdit ? "Edit Modifier" : "Add Modifier"}</DialogTitle>
            <DialogDescription>
              A customization option buyers can pick on this product&apos;s website page.
            </DialogDescription>
          </DialogHeader>

          <Input
            id="modifier-name"
            label="Modifier Name"
            name="modifier_name"
            defaultValue={modifier?.modifier_name ?? ""}
            placeholder="e.g. Gold foil finish"
            required
            autoFocus
          />

          <TextArea
            id="modifier-description"
            label="Description"
            name="description"
            rows={2}
            defaultValue={modifier?.description ?? ""}
            placeholder="Optional detail shown under the option."
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <CurrencyInput
              id="modifier-price"
              label="Price Add-on"
              name="price_modifier"
              defaultValue={modifier?.price_modifier ?? 0}
            />
            <NumberInput
              id="modifier-sort-order"
              label="Sort Order"
              name="sort_order"
              step={1}
              defaultValue={modifier?.sort_order ?? 0}
            />
          </div>

          <Toggle
            id="modifier-published"
            label="Published"
            description="Unpublished modifiers stay hidden from the website."
            checked={published}
            onChange={setPublished}
          />
          <input type="hidden" name="published" value={published ? "true" : "false"} />

          {error && <p className="text-sm text-(--color-danger)">{error}</p>}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Modifier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
