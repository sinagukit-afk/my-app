"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { createBankAccount, updateBankAccount, type ActionResult } from "./actions";
import { PARENT_ACCOUNT_WARNING } from "@/lib/accounting/account-options";
import type { BankAccountRow } from "./bank-accounts-table";

type GlAccountOption = { value: string; label: string; is_postable: boolean; category: "asset" | "liability" };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankAccount?: BankAccountRow | null;
  glAccountOptions: GlAccountOption[];
  onSaved: () => void;
};

const TYPE_OPTIONS = [
  { value: "saving", label: "Saving" },
  { value: "online_wallet", label: "Online Wallet" },
  { value: "credit_card", label: "Credit Card" },
];

// Which accounts.category a bank account's GL Account picker should be
// restricted to for each type — credit cards post to a liability (the
// card's payable account), everything else posts to an asset.
function categoryForType(type: string): "asset" | "liability" {
  return type === "credit_card" ? "liability" : "asset";
}

export function BankAccountForm({ open, onOpenChange, bankAccount, glAccountOptions, onSaved }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState(bankAccount?.type ?? "saving");
  const [glAccountId, setGlAccountId] = useState(bankAccount?.gl_account_id ?? "");
  const isEdit = Boolean(bankAccount);

  useEffect(() => {
    if (open) {
      setType(bankAccount?.type ?? "saving");
      setGlAccountId(bankAccount?.gl_account_id ?? "");
    }
  }, [open, bankAccount]);

  const glAccountsByValue = useMemo(() => new Map(glAccountOptions.map((o) => [o.value, o])), [glAccountOptions]);
  const isParentAccount = glAccountId ? glAccountsByValue.get(glAccountId)?.is_postable === false : false;

  const allowedCategory = categoryForType(type);
  const filteredAccountOptions = useMemo(
    () => glAccountOptions.filter((o) => o.category === allowedCategory),
    [glAccountOptions, allowedCategory]
  );

  function handleTypeChange(next: string) {
    setType(next);
    if (glAccountId && glAccountsByValue.get(glAccountId)?.category !== categoryForType(next)) {
      setGlAccountId("");
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res: ActionResult = isEdit
        ? await updateBankAccount(bankAccount!.id, formData)
        : await createBankAccount(formData);

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
            <DialogTitle>{isEdit ? "Edit Bank Account" : "Add Bank Account"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update this bank account's details or GL account link."
                : "Add a bank account and link it to the GL account it posts to."}
            </DialogDescription>
          </DialogHeader>

          <Input
            label="Account Name"
            name="name"
            placeholder="e.g. Main Operating Account"
            defaultValue={bankAccount?.name ?? ""}
            required
            autoFocus
          />

          <Select
            label="Type"
            name="type"
            options={TYPE_OPTIONS}
            value={type}
            onChange={(e) => handleTypeChange(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Bank"
              name="bank"
              placeholder="e.g. BDO"
              defaultValue={bankAccount?.bank ?? ""}
              required
            />
            <Input
              label="Account # (masked)"
              name="account_number_masked"
              placeholder="e.g. ****1234"
              defaultValue={bankAccount?.account_number_masked ?? ""}
            />
          </div>

          <Combobox
            label="GL Account"
            name="gl_account_id"
            placeholder="Select an account…"
            options={filteredAccountOptions}
            value={glAccountId}
            onValueChange={setGlAccountId}
            error={isParentAccount ? PARENT_ACCOUNT_WARNING : undefined}
          />
          <p className="-mt-2 text-xs text-(--color-text-muted)">
            {type === "credit_card"
              ? "The Chart of Accounts liability account (the card's payable) this links to."
              : "The Chart of Accounts asset account this bank account's balance posts to."}
          </p>

          <Input
            label="Currency"
            name="currency"
            defaultValue={bankAccount?.currency ?? "PHP"}
            required
            className="max-w-[120px]"
          />

          {error && <p className="text-sm text-(--color-danger)">{error}</p>}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending || isParentAccount}>
              {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Bank Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
