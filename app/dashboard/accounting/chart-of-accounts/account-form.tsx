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
import { Select } from "@/components/ui/select";
import { TextArea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createAccount, updateAccount, type ActionResult } from "./actions";
import type { AccountRow } from "./chart-of-accounts-table";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: AccountRow | null;
  onSaved: () => void;
};

const CATEGORY_OPTIONS = [
  { value: "asset", label: "Asset" },
  { value: "liability", label: "Liability" },
  { value: "equity", label: "Equity" },
  { value: "revenue", label: "Revenue" },
  { value: "expense", label: "Expense" },
];

const ACCOUNT_PREFIX = "SCA-";

function stripPrefix(accountNumber: string | undefined): string {
  if (!accountNumber) return "";
  return accountNumber.startsWith(ACCOUNT_PREFIX) ? accountNumber.slice(ACCOUNT_PREFIX.length) : accountNumber;
}

export function AccountForm({ open, onOpenChange, account, onSaved }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(account);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res: ActionResult = isEdit
        ? await updateAccount(account!.id, formData)
        : await createAccount(formData);

      if (res.success) {
        onSaved();
        onOpenChange(false);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setError(null);
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit Account" : "Add Account"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update this account's number, name, category, or description."
                : "Add a new account to the Chart of Accounts."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[140px_1fr]">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="account_number" className="text-sm font-medium text-(--color-text)">
                Account #
              </label>
              <div className="flex items-center">
                <span className="flex h-9 shrink-0 items-center rounded-l-md border border-r-0 border-(--color-border) bg-(--color-bg) px-3 text-sm text-(--color-text-muted)">
                  {ACCOUNT_PREFIX}
                </span>
                <input
                  id="account_number"
                  name="account_number"
                  type="text"
                  inputMode="numeric"
                  pattern="\d+"
                  defaultValue={stripPrefix(account?.account_number)}
                  required
                  autoFocus
                  className="flex h-9 w-full rounded-r-md border border-(--color-border) bg-(--color-surface) px-3 py-1 text-sm text-(--color-text) shadow-(--shadow-sm) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary) focus-visible:ring-offset-1"
                />
              </div>
            </div>
            <Input
              label="Account Name"
              name="name"
              defaultValue={account?.name ?? ""}
              required
            />
          </div>

          <Select
            label="Category"
            name="category"
            options={CATEGORY_OPTIONS}
            defaultValue={account?.category ?? "asset"}
            required
          />

          <TextArea
            label="Description"
            name="description"
            defaultValue={account?.description ?? ""}
            placeholder="Optional"
            rows={2}
          />

          {error && <p className="text-sm text-(--color-danger)">{error}</p>}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
