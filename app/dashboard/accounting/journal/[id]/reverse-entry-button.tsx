"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { reverseJournalEntry } from "../actions";

type Props = {
  entryId: string;
};

export function ReverseEntryButton({ entryId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleReverse() {
    setError(null);
    startTransition(async () => {
      const res = await reverseJournalEntry(entryId, reason);
      if (res.success) {
        setOpen(false);
        router.push(`/dashboard/accounting/journal/${res.id}`);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <>
      <Button type="button" variant="danger" onClick={() => setOpen(true)}>
        Reverse Entry
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setReason("");
            setError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverse Journal Entry</DialogTitle>
            <DialogDescription>
              Posts a new entry with every debit and credit swapped, canceling out this entry's effect. The
              original entry stays on the ledger unchanged — this cannot be undone or edited later.
            </DialogDescription>
          </DialogHeader>
          <TextArea
            label="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why this entry needs to be reversed"
            rows={3}
            required
          />
          {error && <p className="text-sm text-(--color-danger)">{error}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" variant="danger" onClick={handleReverse} disabled={isPending || !reason.trim()}>
              {isPending ? "Reversing…" : "Reverse Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
