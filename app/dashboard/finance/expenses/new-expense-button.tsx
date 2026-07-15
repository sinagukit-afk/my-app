"use client";

import { useMemo, useState, useTransition } from "react";
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
import { NumberInput } from "@/components/ui/number-input";
import { DatePicker } from "@/components/ui/date-picker";
import { recordDirectExpense } from "./actions";

type Option = { id: string; name: string };
type CategoryOption = { id: string; name: string; accounting_treatment: "immediate" | "prepaid" | "fixed_asset" };

type Props = {
  categories: CategoryOption[];
  suppliers: Option[];
};

const PAYMENT_STATUS_OPTIONS = [
  { value: "unpaid", label: "Unpaid" },
  { value: "paid", label: "Paid" },
];

const TREATMENT_OPTIONS = [
  { value: "immediate", label: "Immediate Expense" },
  { value: "prepaid", label: "Prepaid Expense" },
  { value: "fixed_asset", label: "Fixed Asset" },
];

export function NewExpenseButton({ categories, suppliers }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [treatment, setTreatment] = useState<"immediate" | "prepaid" | "fixed_asset">("immediate");

  const selectedCategory = useMemo(() => categories.find((c) => c.id === categoryId), [categories, categoryId]);

  function handleCategoryChange(id: string) {
    setCategoryId(id);
    const category = categories.find((c) => c.id === id);
    if (category) setTreatment(category.accounting_treatment);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setCategoryId("");
      setTreatment("immediate");
      setError(null);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await recordDirectExpense(formData);
      if (res.success) {
        handleOpenChange(false);
        if (res.kind === "fixed_asset") {
          router.push("/dashboard/finance/fixed-assets");
        } else {
          router.refresh();
        }
      } else {
        setError(res.error);
      }
    });
  }

  const isOverride = selectedCategory ? treatment !== selectedCategory.accounting_treatment : false;

  return (
    <>
      <Button onClick={() => setOpen(true)}>New Expense</Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
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
              value={categoryId}
              onChange={(e) => handleCategoryChange(e.target.value)}
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

            <Select
              label="Accounting Treatment"
              name="treatment_override"
              value={treatment}
              onChange={(e) => setTreatment(e.target.value as typeof treatment)}
              options={TREATMENT_OPTIONS}
              disabled={!categoryId}
              required
            />
            {isOverride && (
              <p className="text-sm text-(--color-text-muted)">
                Overriding this category&apos;s default treatment ({selectedCategory?.accounting_treatment}).
              </p>
            )}

            {treatment === "prepaid" && (
              <NumberInput
                label="Amortization Months (optional — uses category default if blank)"
                name="term_override"
                min={1}
              />
            )}
            {treatment === "fixed_asset" && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <NumberInput
                  label="Useful Life, Months (optional — uses asset category default if blank)"
                  name="useful_life_override"
                  min={1}
                />
                <CurrencyInput label="Salvage Value (optional)" name="salvage_override" />
              </div>
            )}

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
