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
import { createStore, updateStore, type ActionResult } from "./actions";
import type { StoreRow } from "./stores-table";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store?: StoreRow | null;
  onSaved: () => void;
};

export function StoreForm({ open, onOpenChange, store, onSaved }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(store);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res: ActionResult = isEdit
        ? await updateStore(store!.id, formData)
        : await createStore(formData);

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
            <DialogTitle>{isEdit ? "Edit Store" : "Add Store"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update this store's contact details."
                : "Add a new store location. Loyverse's API has no way to receive new stores, so a store added here stays ERP-only."}
            </DialogDescription>
          </DialogHeader>

          <Input label="Store Name" name="name" defaultValue={store?.name ?? ""} required autoFocus />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Phone" name="phone" defaultValue={store?.phone ?? ""} />
            <Input label="Email" name="email" type="email" defaultValue={store?.email ?? ""} />
          </div>
          <Input label="Address" name="address" defaultValue={store?.address ?? ""} />

          {isEdit && store?.loyverse_store_id && (
            <p className="text-xs text-(--color-text-subtle)">
              This store is linked to Loyverse (read-only there). Edits here stay in the ERP only —
              Loyverse has no API to update store details.
            </p>
          )}

          {error && <p className="text-sm text-(--color-danger)">{error}</p>}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Store"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
