"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePicker } from "@/components/ui/date-picker";
import { recordDirectExpense } from "./actions";

type Option = { id: string; name: string };

type Props = {
  categories: Option[];
  suppliers: Option[];
};

const PAYMENT_STATUS_OPTIONS = [
  { value: "unpaid", label: "Unpaid" },
  { value: "paid", label: "Paid" },
];

export function NewExpenseButton({ categories, suppliers }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await recordDirectExpense(formData);
      if (res.success) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>New Expense</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>New Expense</DialogTitle>
              <DialogDescription>
                Direct entry for recurring OPEX (rent, utilities, internet, salaries) that doesn&apos;t need a
                purchase order.
              </DialogDescription>
            </DialogHeader>

            <Select
              label="Category"
              name="category_id"
              placeholder="Select a category…"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              required
            />
            <Input label="Description" name="description" placeholder="e.g. July Internet Bill" required />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <CurrencyInput label="Amount" name="amount" required />
              <DatePicker label="Date" name="expense_date" defaultValue={new Date().toISOString().slice(0, 10)} required />
            </div>
            <Select
              label="Supplier (optional)"
              name="supplier_id"
              placeholder="Select a supplier…"
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
            />
            <Select
              label="Payment Status"
              name="payment_status"
              defaultValue="unpaid"
              options={PAYMENT_STATUS_OPTIONS}
              required
            />

            {error && <p className="text-sm text-(--color-danger)">{error}</p>}

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary" disabled={isPending}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Save Expense"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
