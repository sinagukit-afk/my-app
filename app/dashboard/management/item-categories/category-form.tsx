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
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { createCategory, updateCategory, type ActionResult } from "./actions";
import type { CategoryRow } from "./item-categories-table";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: CategoryRow | null;
  onSaved: () => void;
};

const TYPE_OPTIONS = [
  { value: "product", label: "Product" },
  { value: "packaging", label: "Packaging" },
];

const COLOR_OPTIONS = [
  { value: "GREY", label: "Grey" },
  { value: "RED", label: "Red" },
  { value: "PINK", label: "Pink" },
  { value: "ORANGE", label: "Orange" },
  { value: "YELLOW", label: "Yellow" },
  { value: "GREEN", label: "Green" },
  { value: "BLUE", label: "Blue" },
  { value: "PURPLE", label: "Purple" },
];

export function CategoryForm({ open, onOpenChange, category, onSaved }: Props) {
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(category);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res: ActionResult = isEdit
        ? await updateCategory(category!.id, formData)
        : await createCategory(formData);

      if (res.success) {
        onSaved();
        onOpenChange(false);
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
            <DialogTitle>{isEdit ? "Edit Category" : "Add Category"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update this category's name, type, and tag color."
                : "Add a new category for items or packaging components."}
            </DialogDescription>
          </DialogHeader>

          <Input
            label="Category Name"
            name="name"
            defaultValue={category?.name ?? ""}
            required
            autoFocus
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Type"
              name="category_type"
              options={TYPE_OPTIONS}
              defaultValue={category?.category_type ?? "product"}
              required
            />
            <Select
              label="Tag Color"
              name="color"
              options={COLOR_OPTIONS}
              defaultValue={category?.color ?? "GREY"}
            />
          </div>

          {isEdit && category?.loyverse_category_id && (
            <p className="text-xs text-(--color-text-subtle)">
              This category is pulled from Loyverse. Local edits here won&apos;t push back to
              Loyverse and may be overwritten if this category is later changed there.
            </p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
