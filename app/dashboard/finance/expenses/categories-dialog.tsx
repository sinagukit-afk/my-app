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
import { createExpenseCategory } from "./actions";

type CategoryOption = { id: string; name: string };
type AccountOption = { id: string; account_number: string; name: string };

type Props = {
  categories: CategoryOption[];
  accounts: AccountOption[];
};

export function CategoriesDialogButton({ categories, accounts }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createExpenseCategory(formData);
      if (res.success) {
        (e.target as HTMLFormElement).reset();
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Manage Categories
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Expense Categories</DialogTitle>
            <DialogDescription>
              Each category maps to an expense account, used to auto-post the journal entry when an expense is
              recorded.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-(--color-border) p-2">
            {categories.length === 0 && (
              <p className="p-2 text-sm text-(--color-text-muted)">No categories yet — add one below.</p>
            )}
            {categories.map((c) => (
              <div key={c.id} className="rounded px-2 py-1 text-sm text-(--color-text)">
                {c.name}
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 border-t border-(--color-border) pt-4">
            <Input label="New Category Name" name="name" placeholder="e.g. Repairs & Maintenance" required />
            <Select
              label="Default Expense Account"
              name="default_expense_account_id"
              placeholder="Select an account…"
              options={accounts.map((a) => ({ value: a.id, label: `${a.account_number} — ${a.name}` }))}
              required
            />
            {error && <p className="text-sm text-(--color-danger)">{error}</p>}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary" disabled={isPending}>
                  Close
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Adding…" : "Add Category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
