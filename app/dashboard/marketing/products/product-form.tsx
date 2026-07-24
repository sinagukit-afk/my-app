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
import { createProduct, updateProduct, type ActionResult } from "./actions";
import type { ProductRow } from "./products-table";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: ProductRow | null;
  categories: string[];
  onSaved: () => void;
};

/** Mirrors the SLUG_PATTERN the server action enforces. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function ProductForm({ open, onOpenChange, product, categories, onSaved }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [published, setPublished] = useState(true);
  const isEdit = Boolean(product);

  // Reset local state each time the dialog opens, since the same instance is reused
  // for both "Add" and "Edit".
  useEffect(() => {
    if (!open) return;
    setError(null);
    setSlug(product?.slug ?? "");
    setSlugTouched(Boolean(product));
    setPublished(product?.published ?? true);
  }, [open, product]);

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!slugTouched) setSlug(slugify(e.target.value));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res: ActionResult = isEdit
        ? await updateProduct(product!.id, formData)
        : await createProduct(formData);

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
      {/* Taller than the default dialog — keep it scrollable on desktop too. */}
      <DialogContent className="max-w-2xl lg:max-h-[85vh] lg:overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit Product" : "Add Product"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update how this product appears on the public website."
                : "Add a product to the public website catalog."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              id="product-name"
              label="Product Name"
              name="name"
              defaultValue={product?.name ?? ""}
              onChange={handleNameChange}
              required
              autoFocus
            />
            <Input
              id="product-slug"
              label="URL Slug"
              name="slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="engraved-wooden-plaque"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Input
                id="product-category"
                label="Category"
                name="category"
                list="web-product-categories"
                defaultValue={product?.category ?? ""}
                placeholder="e.g. Awards"
              />
              <datalist id="web-product-categories">
                {categories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </div>
            <NumberInput
              id="product-sort-order"
              label="Sort Order"
              name="sort_order"
              step={1}
              defaultValue={product?.sort_order ?? 0}
            />
          </div>

          <TextArea
            id="product-description"
            label="Description"
            name="description"
            rows={3}
            defaultValue={product?.description ?? ""}
            placeholder="Shown on the product card and detail page."
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <CurrencyInput
              id="product-starting-price"
              label="Starting Price"
              name="starting_price"
              defaultValue={product?.starting_price ?? 0}
              required
            />
            <NumberInput
              id="product-moq"
              label="Minimum Order Qty"
              name="moq"
              step={1}
              min={1}
              defaultValue={product?.moq ?? 1}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              id="product-lead-time"
              label="Standard Lead Time"
              name="lead_time_standard"
              defaultValue={product?.lead_time_standard ?? "5-7 days"}
              required
            />
            <Input
              id="product-rush-option"
              label="Rush Option"
              name="rush_option"
              defaultValue={product?.rush_option ?? ""}
              placeholder="e.g. 3 days (+20%)"
            />
          </div>

          <TextArea
            id="product-pricing-notes"
            label="Pricing Notes"
            name="pricing_notes"
            rows={2}
            defaultValue={product?.pricing_notes ?? ""}
            placeholder="Any caveats shown alongside the price."
          />

          <Toggle
            id="product-published"
            label="Published"
            description="Unpublished products stay hidden from the website until you turn this back on."
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
              {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
