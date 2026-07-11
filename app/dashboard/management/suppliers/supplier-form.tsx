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
import { TextArea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createSupplier, updateSupplier, type ActionResult } from "./actions";
import type { SupplierRow } from "./suppliers-table";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: SupplierRow | null;
  onSaved: () => void;
};

export function SupplierForm({ open, onOpenChange, supplier, onSaved }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(supplier);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res: ActionResult = isEdit
        ? await updateSupplier(supplier!.id, formData)
        : await createSupplier(formData);

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
            <DialogTitle>{isEdit ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update this supplier's contact details."
                : "Add a new supplier to your directory."}
            </DialogDescription>
          </DialogHeader>

          <Input
            label="Supplier Name"
            name="name"
            defaultValue={supplier?.name ?? ""}
            required
            autoFocus
          />
          <Input
            label="Contact Person"
            name="contact_name"
            defaultValue={supplier?.contact_name ?? ""}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Phone" name="phone" defaultValue={supplier?.phone ?? ""} />
            <Input
              label="Email"
              name="email"
              type="email"
              defaultValue={supplier?.email ?? ""}
            />
          </div>
          <Input label="Address" name="address" defaultValue={supplier?.address ?? ""} />
          <TextArea label="Notes" name="note" defaultValue={supplier?.note ?? ""} rows={3} />

          {error && <p className="text-sm text-(--color-danger)">{error}</p>}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Supplier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
