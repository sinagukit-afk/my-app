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
import { Input } from "@/components/ui/input";
import { TextArea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createCustomer, updateCustomer, type ActionResult, type CreateResult } from "./actions";

export type EditableCustomer = {
  id: string;
  customer_code: string;
  name: string;
  phone_number: string | null;
  email: string | null;
  address_line1: string | null;
  barangay: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  note: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: EditableCustomer | null;
  onSaved: () => void;
};

export function CustomerForm({ open, onOpenChange, customer, onSaved }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(customer);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      if (isEdit) {
        const res: ActionResult = await updateCustomer(customer!.id, formData);
        if (res.success) {
          onSaved();
          onOpenChange(false);
        } else {
          setError(res.error);
        }
        return;
      }

      const res: CreateResult = await createCustomer(formData);
      if (res.success) {
        onSaved();
        onOpenChange(false);
        router.push(`/dashboard/management/customers/${res.id}`);
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
            <DialogTitle>{isEdit ? "Edit Customer" : "Add Customer"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update this customer's contact info, address, or notes."
                : "For walk-ins or leads not yet in Loyverse. This customer is ERP-only and won't push back to Loyverse."}
            </DialogDescription>
          </DialogHeader>

          <Input label="Full Name" name="name" defaultValue={customer?.name ?? ""} required autoFocus />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Phone" name="phone_number" defaultValue={customer?.phone_number ?? ""} />
            <Input label="Email" name="email" type="email" defaultValue={customer?.email ?? ""} />
          </div>
          <Input
            label="Address Line 1"
            name="address_line1"
            placeholder="Building no., street, house no."
            defaultValue={customer?.address_line1 ?? ""}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label="Barangay" name="barangay" defaultValue={customer?.barangay ?? ""} />
            <Input label="City / Municipality" name="city" defaultValue={customer?.city ?? ""} />
            <Input label="Province" name="province" defaultValue={customer?.province ?? ""} />
          </div>
          <Input label="Postal Code" name="postal_code" defaultValue={customer?.postal_code ?? ""} />
          <TextArea label="Notes" name="note" rows={3} defaultValue={customer?.note ?? ""} />

          {error && <p className="text-sm text-(--color-danger)">{error}</p>}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
