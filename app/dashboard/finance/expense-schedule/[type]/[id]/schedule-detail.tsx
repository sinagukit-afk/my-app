"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { DatePicker } from "@/components/ui/date-picker";
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
import { formatDate } from "@/lib/utils/format-date";
import { pauseSchedule, resumeSchedule, extendSchedule, terminateSchedule } from "../../actions";

export type ScheduleDetailData = {
  id: string;
  type: "prepaid" | "fixed_asset";
  name: string;
  total_amount: number;
  term_months: number;
  periodic_amount: number;
  start_date: string;
  next_posting_date: string | null;
  remaining_balance: number;
  status: "active" | "paused" | "terminated";
};

export type HistoryRow = {
  id: string;
  period_month: string;
  amount: number;
  draft_id: string | null;
  draft_status: "pending_review" | "posted" | "rejected" | null;
  posted_journal_entry_id: string | null;
};

function peso(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_LABEL: Record<string, string> = { active: "Active", paused: "Paused", terminated: "Terminated" };
const STATUS_VARIANT: Record<string, "success" | "warning" | "neutral"> = {
  active: "success",
  paused: "warning",
  terminated: "neutral",
};
const DRAFT_STATUS_LABEL: Record<string, string> = {
  pending_review: "Pending Review",
  posted: "Posted",
  rejected: "Rejected",
};
const DRAFT_STATUS_VARIANT: Record<string, "warning" | "success" | "danger"> = {
  pending_review: "warning",
  posted: "success",
  rejected: "danger",
};

type Props = {
  detail: ScheduleDetailData;
  history: HistoryRow[];
  canWrite: boolean;
};

export function ScheduleDetail({ detail, history, canWrite }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendMonths, setExtendMonths] = useState<number | "">("");
  const [terminateOpen, setTerminateOpen] = useState(false);
  const [terminationDate, setTerminationDate] = useState(new Date().toISOString().slice(0, 10));

  function runAction(action: Promise<{ success: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await action;
      if (res.success) {
        router.refresh();
      } else {
        setError(res.error ?? "Something went wrong.");
      }
    });
  }

  function handlePause() {
    runAction(pauseSchedule(detail.type, detail.id));
  }
  function handleResume() {
    runAction(resumeSchedule(detail.type, detail.id));
  }
  function handleExtend() {
    setError(null);
    startTransition(async () => {
      const res = await extendSchedule(detail.type, detail.id, Number(extendMonths) || 0);
      if (res.success) {
        setExtendOpen(false);
        setExtendMonths("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }
  function handleTerminate() {
    setError(null);
    startTransition(async () => {
      const res = await terminateSchedule(detail.type, detail.id, terminationDate);
      if (res.success) {
        setTerminateOpen(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={detail.name}
        description={detail.type === "prepaid" ? "Prepaid expense amortization schedule" : "Fixed asset depreciation schedule"}
        backHref="/dashboard/finance/expense-schedule"
        backLabel="Back to Expense Schedule"
      />

      <Card className="max-w-3xl">
        <CardContent className="grid grid-cols-1 gap-4 p-6 text-sm sm:grid-cols-4">
          <div>
            <p className="text-(--color-text-muted)">Total</p>
            <p className="font-medium text-(--color-text)">{peso(detail.total_amount)}</p>
          </div>
          <div>
            <p className="text-(--color-text-muted)">{detail.type === "prepaid" ? "Monthly Amount" : "Term (mo.)"}</p>
            <p className="font-medium text-(--color-text)">
              {detail.type === "prepaid" ? peso(detail.periodic_amount) : detail.term_months}
            </p>
          </div>
          <div>
            <p className="text-(--color-text-muted)">Start Date</p>
            <p className="font-medium text-(--color-text)">{formatDate(detail.start_date)}</p>
          </div>
          <div>
            <p className="text-(--color-text-muted)">Status</p>
            <p>
              <Badge variant={STATUS_VARIANT[detail.status]}>{STATUS_LABEL[detail.status]}</Badge>
            </p>
          </div>
          <div>
            <p className="text-(--color-text-muted)">Remaining Balance</p>
            <p className="font-medium text-(--color-text)">{peso(detail.remaining_balance)}</p>
          </div>
          {detail.type === "prepaid" && (
            <div>
              <p className="text-(--color-text-muted)">Next Posting Date</p>
              <p className="font-medium text-(--color-text)">
                {detail.status === "active" && detail.next_posting_date ? formatDate(detail.next_posting_date) : "—"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {canWrite && detail.status !== "terminated" && (
        <div className="flex flex-wrap gap-2">
          {detail.status === "active" && (
            <Button type="button" variant="secondary" onClick={handlePause} disabled={isPending}>
              Pause
            </Button>
          )}
          {detail.status === "paused" && (
            <Button type="button" variant="secondary" onClick={handleResume} disabled={isPending}>
              Resume
            </Button>
          )}
          <Dialog open={extendOpen} onOpenChange={(next) => { setExtendOpen(next); if (!next) setError(null); }}>
            <DialogTrigger asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Extend
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Extend Schedule</DialogTitle>
                <DialogDescription>
                  Add more months to the remaining term. The {detail.type === "prepaid" ? "monthly amortization" : "depreciation"}{" "}
                  amount is recalculated over the new remaining periods.
                </DialogDescription>
              </DialogHeader>
              <NumberInput
                label="Additional Months"
                min={1}
                value={extendMonths}
                onChange={(e) => setExtendMonths(e.target.value === "" ? "" : Number(e.target.value))}
              />
              {error && <p className="text-sm text-(--color-danger)">{error}</p>}
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="secondary" disabled={isPending}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="button" onClick={handleExtend} disabled={isPending || !extendMonths}>
                  {isPending ? "Extending…" : "Extend"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={terminateOpen} onOpenChange={(next) => { setTerminateOpen(next); if (!next) setError(null); }}>
            <DialogTrigger asChild>
              <Button type="button" variant="danger" disabled={isPending}>
                Terminate
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Terminate Schedule</DialogTitle>
                <DialogDescription>
                  Stops the schedule and immediately writes off the remaining balance ({peso(detail.remaining_balance)}) as
                  one draft journal entry, routed to Accounting Review. This cannot be undone once approved.
                </DialogDescription>
              </DialogHeader>
              <DatePicker label="Termination Date" value={terminationDate} onChange={(e) => setTerminationDate(e.target.value)} required />
              {error && <p className="text-sm text-(--color-danger)">{error}</p>}
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="secondary" disabled={isPending}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="button" variant="danger" onClick={handleTerminate} disabled={isPending}>
                  {isPending ? "Terminating…" : "Terminate"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
      {error && !extendOpen && !terminateOpen && <p className="text-sm text-(--color-danger)">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Posting History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-(--color-border) bg-(--color-bg)">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">Period</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">Draft Status</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-(--color-text-muted)">
                      No postings yet.
                    </td>
                  </tr>
                )}
                {history.map((h) => (
                  <tr key={h.id} className="border-b border-(--color-border) last:border-0">
                    <td className="px-4 py-3 text-(--color-text)">{formatDate(h.period_month)}</td>
                    <td className="px-4 py-3 text-right text-(--color-text)">{peso(h.amount)}</td>
                    <td className="px-4 py-3">
                      {h.draft_status ? (
                        <Link
                          href={
                            h.draft_status === "posted" && h.posted_journal_entry_id
                              ? `/dashboard/accounting/journal/${h.posted_journal_entry_id}`
                              : `/dashboard/accounting/review/${h.draft_id}`
                          }
                          className="text-(--color-primary) hover:underline"
                        >
                          <Badge variant={DRAFT_STATUS_VARIANT[h.draft_status]}>{DRAFT_STATUS_LABEL[h.draft_status]}</Badge>
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
