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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { previewDepreciation, runDepreciation, type DepreciationPreviewLine } from "./actions";

function peso(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function RunDepreciationDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(currentMonthValue());
  const [lines, setLines] = useState<DepreciationPreviewLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function loadPreview(m: string) {
    setError(null);
    setLines(null);
    startTransition(async () => {
      const res = await previewDepreciation(`${m}-01`);
      if (res.success) setLines(res.lines);
      else setError(res.error);
    });
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) loadPreview(month);
    else {
      setLines(null);
      setError(null);
    }
  }

  function handleMonthChange(value: string) {
    setMonth(value);
    loadPreview(value);
  }

  function handleConfirm() {
    startTransition(async () => {
      const res = await runDepreciation(`${month}-01`);
      if (res.success) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  const total = (lines ?? []).reduce((s, l) => s + l.monthly_amount, 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>Run Depreciation</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Run Monthly Depreciation</DialogTitle>
          <DialogDescription>
            Preview what will be posted before confirming. Assets already posted for this month, fully
            depreciated, or disposed are skipped automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            label="Month"
            type="month"
            value={month}
            onChange={(e) => handleMonthChange(e.target.value)}
          />

          {error && <p className="text-sm text-(--color-danger)">{error}</p>}

          {isPending && lines === null && !error && (
            <p className="text-sm text-(--color-text-muted)">Loading preview…</p>
          )}

          {lines !== null && lines.length === 0 && !error && (
            <p className="text-sm text-(--color-text-muted)">
              Nothing to post for this month — every active asset is already posted, fully depreciated, or
              disposed.
            </p>
          )}

          {lines !== null && lines.length > 0 && (
            <div className="overflow-hidden rounded-md border border-(--color-border)">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-(--color-border) bg-(--color-bg)">
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
                      Asset
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
                      This Month
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.fixed_asset_id} className="border-b border-(--color-border) last:border-0">
                      <td className="px-3 py-2 text-(--color-text)">{l.name}</td>
                      <td className="px-3 py-2 text-right text-(--color-text)">{peso(l.monthly_amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-(--color-border) bg-(--color-bg) font-semibold">
                    <td className="px-3 py-2 text-(--color-text)">Total</td>
                    <td className="px-3 py-2 text-right text-(--color-text)">{peso(total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isPending || lines === null || lines.length === 0}
          >
            {isPending ? "Posting…" : "Confirm & Post"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
