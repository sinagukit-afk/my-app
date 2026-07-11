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
import { Button } from "@/components/ui/button";
import { createCourier, updateCourier, type ActionResult } from "./actions";
import type { CourierRow } from "./couriers-table";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courier?: CourierRow | null;
  onSaved: () => void;
};

export function CourierForm({ open, onOpenChange, courier, onSaved }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(courier);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res: ActionResult = isEdit
        ? await updateCourier(courier!.id, formData)
        : await createCourier(formData);

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
            <DialogTitle>{isEdit ? "Edit Courier" : "Add Courier"}</DialogTitle>
            <DialogDescription>
              {isEdit ? "Update this courier's contact details." : "Add a new courier for shipping orders."}
            </DialogDescription>
          </DialogHeader>

          <Input label="Courier Name" name="name" defaultValue={courier?.name ?? ""} required autoFocus />
          <Input label="Contact Number" name="contact_number" defaultValue={courier?.contact_number ?? ""} />

          {error && <p className="text-sm text-(--color-danger)">{error}</p>}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Courier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
