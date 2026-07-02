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
import { CurrencyInput } from "@/components/ui/currency-input";
import { TextArea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createExpense, updateExpense, type ActionResult } from "./actions";
import type { ExpenseRow } from "./expenses-table";

const CATEGORIES = [
  { value: "Supplies", label: "Supplies" },
  { value: "Utilities", label: "Utilities" },
  { value: "Rent", label: "Rent" },
  { value: "Salaries & Wages", label: "Salaries & Wages" },
  { value: "Marketing", label: "Marketing" },
  { value: "Transportation", label: "Transportation" },
  { value: "Equipment & Maintenance", label: "Equipment & Maintenance" },
  { value: "Taxes & Fees", label: "Taxes & Fees" },
  { value: "Other", label: "Other" },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: ExpenseRow | null;
  onSaved: () => void;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function ExpenseForm({ open, onOpenChange, expense, onSaved }: Props) {
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(expense);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res: ActionResult = isEdit
        ? await updateExpense(expense!.id, formData)
        : await createExpense(formData);

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
            <DialogTitle>{isEdit ? "Edit Expense" : "Add Expense"}</DialogTitle>
            <DialogDescription>
              {isEdit ? "Update this expense entry." : "Record a new expense entry."}
            </DialogDescription>
          </DialogHeader>

          <Input
            label="Date"
            name="date"
            type="date"
            defaultValue={expense?.date ?? todayISO()}
            required
            autoFocus
          />
          <Select
            label="Category"
            name="category"
            placeholder="Select a category…"
            defaultValue={expense?.category ?? ""}
            options={CATEGORIES}
            required
          />
          <CurrencyInput
            label="Amount"
            name="amount"
            defaultValue={expense?.amount ?? ""}
            required
          />
          <TextArea label="Note" name="note" defaultValue={expense?.note ?? ""} rows={3} />

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
