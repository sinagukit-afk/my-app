"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { generateDuePrepaidPostings } from "./actions";
import type { ScheduleRow } from "./expense-schedule-table";

function peso(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type Props = {
  schedules: ScheduleRow[];
};

export function GeneratePrepaidPostingsDialog({ schedules }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const today = new Date().toISOString().slice(0, 10);
  const due = schedules.filter((s) => s.status === "active" && s.next_posting_date && s.next_posting_date <= today);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const res = await generateDuePrepaidPostings();
      if (res.success) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setError(null); }}>
      <DialogTrigger asChild>
        <Button>Generate Due Postings</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate Due Prepaid Postings</DialogTitle>
          <DialogDescription>
            Creates one draft journal entry per prepaid schedule whose next posting date has arrived, and
            routes each to Accounting Review. Nothing posts to the Journal until it&apos;s approved.
          </DialogDescription>
        </DialogHeader>

        {due.length === 0 ? (
          <p className="text-sm text-(--color-text-muted)">
            Nothing is due right now — every active prepaid schedule&apos;s next posting date is in the future.
          </p>
        ) : (
          <div className="overflow-hidden rounded-md border border-(--color-border)">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-(--color-border) bg-(--color-bg)">
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
                    Schedule
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
                    Amount Due
                  </th>
                </tr>
              </thead>
              <tbody>
                {due.map((s) => (
                  <tr key={s.id} className="border-b border-(--color-border) last:border-0">
                    <td className="px-3 py-2 text-(--color-text)">{s.name}</td>
                    <td className="px-3 py-2 text-right text-(--color-text)">
                      {peso(Math.min(s.remaining_balance, s.total_amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {error && <p className="text-sm text-(--color-danger)">{error}</p>}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleConfirm} disabled={isPending || due.length === 0}>
            {isPending ? "Generating…" : "Generate Drafts"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
