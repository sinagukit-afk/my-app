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
import { createIncome, updateIncome, type ActionResult } from "./actions";
import type { IncomeRow } from "./income-table";

const CATEGORIES = [
  { value: "Sales", label: "Sales" },
  { value: "Service Revenue", label: "Service Revenue" },
  { value: "Rental Income", label: "Rental Income" },
  { value: "Interest Income", label: "Interest Income" },
  { value: "Other", label: "Other" },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  income?: IncomeRow | null;
  onSaved: () => void;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function IncomeForm({ open, onOpenChange, income, onSaved }: Props) {
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(income);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res: ActionResult = isEdit
        ? await updateIncome(income!.id, formData)
        : await createIncome(formData);

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
            <DialogTitle>{isEdit ? "Edit Income" : "Add Income"}</DialogTitle>
            <DialogDescription>
              {isEdit ? "Update this income entry." : "Record a new income entry."}
            </DialogDescription>
          </DialogHeader>

          <Input
            label="Date"
            name="date"
            type="date"
            defaultValue={income?.date ?? todayISO()}
            required
            autoFocus
          />
          <Select
            label="Category"
            name="category"
            placeholder="Select a category…"
            defaultValue={income?.category ?? ""}
            options={CATEGORIES}
            required
          />
          <CurrencyInput
            label="Amount"
            name="amount"
            defaultValue={income?.amount ?? ""}
            required
          />
          <TextArea label="Note" name="note" defaultValue={income?.note ?? ""} rows={3} />

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Income"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
