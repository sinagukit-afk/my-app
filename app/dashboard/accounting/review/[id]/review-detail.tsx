"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { TextArea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils/cn";
import { saveDraft, approveDraft, rejectDraft, type DraftLineInput } from "./actions";
import { EVENT_TYPE_LABELS } from "../review-table";

export type AccountOption = {
  account_number: string;
  name: string;
  category: string;
};

export type DraftLine = {
  id: string;
  account_number: string;
  account_name: string;
  debit: number;
  credit: number;
  memo: string | null;
};

export type DraftDetail = {
  id: string;
  entry_date: string;
  description: string;
  event_type: string;
  status: string;
  posted_journal_entry_id: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  reviewer_name: string | null;
  lines: DraftLine[];
};

type LineRow = {
  rowId: string;
  accountNumber: string;
  debit: string;
  credit: string;
  memo: string;
};

function emptyRow(): LineRow {
  return { rowId: crypto.randomUUID(), accountNumber: "", debit: "", credit: "", memo: "" };
}

function peso(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_VARIANT: Record<string, "warning" | "success" | "danger"> = {
  pending_review: "warning",
  posted: "success",
  rejected: "danger",
};

const STATUS_LABELS: Record<string, string> = {
  pending_review: "Pending Review",
  posted: "Posted",
  rejected: "Rejected",
};

type Props = {
  draft: DraftDetail;
  accounts: AccountOption[];
};

export function ReviewDetail({ draft, accounts }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);

  const isEditable = draft.status === "pending_review";

  const [rows, setRows] = useState<LineRow[]>(() =>
    draft.lines.length > 0
      ? draft.lines.map((l) => ({
          rowId: l.id,
          accountNumber: l.account_number,
          debit: l.debit > 0 ? String(l.debit) : "",
          credit: l.credit > 0 ? String(l.credit) : "",
          memo: l.memo ?? "",
        }))
      : [emptyRow(), emptyRow()]
  );
  const [description, setDescription] = useState(draft.description);

  const accountOptions = useMemo(
    () => accounts.map((a) => ({ value: a.account_number, label: `${a.account_number} — ${a.name}` })),
    [accounts]
  );

  function updateRow(rowId: string, patch: Partial<LineRow>) {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(rowId: string) {
    setRows((prev) => (prev.length > 2 ? prev.filter((r) => r.rowId !== rowId) : prev));
  }

  const totalDebit = useMemo(() => rows.reduce((s, r) => s + (Number(r.debit) || 0), 0), [rows]);
  const totalCredit = useMemo(() => rows.reduce((s, r) => s + (Number(r.credit) || 0), 0), [rows]);
  const difference = Math.round(totalDebit * 100) - Math.round(totalCredit * 100);
  const balanced = difference === 0 && Math.round(totalDebit * 100) > 0;

  const filledLines = rows.filter(
    (r) => r.accountNumber && ((Number(r.debit) || 0) > 0 || (Number(r.credit) || 0) > 0)
  );
  const canSave = balanced && filledLines.length >= 2 && description.trim() && !isPending;

  function buildLines(): DraftLineInput[] {
    return filledLines.map((r) => ({
      account_number: r.accountNumber,
      debit: Number(r.debit) || 0,
      credit: Number(r.credit) || 0,
      memo: r.memo.trim() || null,
    }));
  }

  function handleSave() {
    const twoSided = buildLines().find((l) => l.debit > 0 && l.credit > 0);
    if (twoSided) {
      alert(`Account ${twoSided.account_number} has both a debit and a credit — each line takes one or the other.`);
      return;
    }
    startTransition(async () => {
      const res = await saveDraft(draft.id, description, buildLines());
      if (res.success) {
        router.refresh();
      } else {
        alert(res.error);
      }
    });
  }

  function handleApprove() {
    startTransition(async () => {
      const res = await approveDraft(draft.id);
      if (res.success) {
        router.push(`/dashboard/accounting/journal/${res.entryId}`);
      } else {
        alert(res.error);
      }
    });
  }

  function handleReject() {
    startTransition(async () => {
      const res = await rejectDraft(draft.id, rejectReason);
      if (res.success) {
        setRejectOpen(false);
        router.push("/dashboard/accounting/review");
      } else {
        alert(res.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review Draft"
        description={draft.description}
        actions={
          <Link href="/dashboard/accounting/review">
            <Button variant="secondary">Back to Review</Button>
          </Link>
        }
      />

      <Card className="max-w-2xl">
        <CardContent className="grid grid-cols-1 gap-4 p-6 text-sm sm:grid-cols-3">
          <div>
            <p className="text-(--color-text-muted)">Date</p>
            <p className="font-medium text-(--color-text)">
              {new Date(draft.entry_date).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div>
            <p className="text-(--color-text-muted)">Event Type</p>
            <p>
              <Badge variant="neutral">{EVENT_TYPE_LABELS[draft.event_type] ?? draft.event_type}</Badge>
            </p>
          </div>
          <div>
            <p className="text-(--color-text-muted)">Status</p>
            <p>
              <Badge variant={STATUS_VARIANT[draft.status] ?? "neutral"}>
                {STATUS_LABELS[draft.status] ?? draft.status}
              </Badge>
            </p>
          </div>
          {draft.status === "posted" && draft.posted_journal_entry_id && (
            <div className="sm:col-span-3">
              <Link
                href={`/dashboard/accounting/journal/${draft.posted_journal_entry_id}`}
                className="text-sm font-medium text-(--color-primary) hover:underline"
              >
                View posted journal entry →
              </Link>
            </div>
          )}
          {draft.status === "rejected" && (
            <div className="sm:col-span-3">
              <p className="text-(--color-text-muted)">Rejection reason</p>
              <p className="text-(--color-text)">{draft.review_note || "No reason given"}</p>
            </div>
          )}
          {draft.reviewer_name && (
            <div className="sm:col-span-3 text-xs text-(--color-text-subtle)">
              Reviewed by {draft.reviewer_name}
              {draft.reviewed_at
                ? ` on ${new Date(draft.reviewed_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })}`
                : ""}
            </div>
          )}
        </CardContent>
      </Card>

      {isEditable ? (
        <Card>
          <CardHeader>
            <CardTitle>Entry Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </CardContent>
        </Card>
      ) : null}

      {isEditable ? (
        <Card>
          <CardHeader>
            <CardTitle>Lines</CardTitle>
            <CardDescription>
              Auto-generated from the underlying business event. Adjust the account, amount, or memo if needed before approving.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {rows.map((row, i) => (
              <div
                key={row.rowId}
                className="grid grid-cols-1 gap-3 border-b border-(--color-border) pb-4 last:border-0 sm:grid-cols-[2fr_1fr_1fr_2fr_auto] sm:items-end"
              >
                <Select
                  label={i === 0 ? "Account" : undefined}
                  value={row.accountNumber}
                  onChange={(e) => updateRow(row.rowId, { accountNumber: e.target.value })}
                  placeholder="Select an account…"
                  options={accountOptions}
                />
                <CurrencyInput
                  label={i === 0 ? "Debit" : undefined}
                  value={row.debit}
                  onChange={(e) => updateRow(row.rowId, { debit: e.target.value, credit: e.target.value ? "" : row.credit })}
                />
                <CurrencyInput
                  label={i === 0 ? "Credit" : undefined}
                  value={row.credit}
                  onChange={(e) => updateRow(row.rowId, { credit: e.target.value, debit: e.target.value ? "" : row.debit })}
                />
                <Input
                  label={i === 0 ? "Memo" : undefined}
                  value={row.memo}
                  onChange={(e) => updateRow(row.rowId, { memo: e.target.value })}
                  placeholder="Optional"
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="text-(--color-danger)"
                  disabled={rows.length <= 2}
                  onClick={() => removeRow(row.rowId)}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={addRow}>
              Add Line
            </Button>
          </CardContent>
          <CardFooter className="flex-col items-stretch gap-2 border-t border-(--color-border) pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-(--color-text-muted)">Total Debits</span>
              <span className="font-medium text-(--color-text)">{peso(totalDebit)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-(--color-text-muted)">Total Credits</span>
              <span className="font-medium text-(--color-text)">{peso(totalCredit)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-(--color-text-muted)">Difference</span>
              <span className={cn("font-semibold", balanced ? "text-(--color-success)" : "text-(--color-danger)")}>
                {peso(difference / 100)}
              </span>
            </div>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Lines</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-(--color-border) bg-(--color-bg)">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">Account</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">Memo</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">Debit</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.lines.map((l) => (
                    <tr key={l.id} className="border-b border-(--color-border) last:border-0">
                      <td className="px-4 py-3 text-(--color-text)">
                        {l.account_number} — {l.account_name}
                      </td>
                      <td className="px-4 py-3 text-(--color-text-muted)">{l.memo || "—"}</td>
                      <td className="px-4 py-3 text-right text-(--color-text)">
                        {l.debit > 0 ? peso(l.debit) : ""}
                      </td>
                      <td className="px-4 py-3 text-right text-(--color-text)">
                        {l.credit > 0 ? peso(l.credit) : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-(--color-border) bg-(--color-bg) font-semibold">
                    <td className="px-4 py-3 text-(--color-text)" colSpan={2}>Total</td>
                    <td className="px-4 py-3 text-right text-(--color-text)">
                      {peso(draft.lines.reduce((s, l) => s + l.debit, 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-(--color-text)">
                      {peso(draft.lines.reduce((s, l) => s + l.credit, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {isEditable && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" className="text-(--color-danger)" onClick={() => setRejectOpen(true)} disabled={isPending}>
            Reject
          </Button>
          <Button type="button" variant="secondary" onClick={handleSave} disabled={!canSave}>
            {isPending ? "Saving…" : "Save Changes"}
          </Button>
          <Button type="button" onClick={() => setApproveOpen(true)} disabled={!balanced || isPending}>
            Approve & Post
          </Button>
        </div>
      )}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Draft</DialogTitle>
            <DialogDescription>
              This draft will be discarded and will not post to the Journal. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <TextArea
            label="Reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Optional — why this draft shouldn't post"
            rows={3}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" variant="danger" onClick={handleReject} disabled={isPending}>
              {isPending ? "Rejecting…" : "Reject Draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve & Post</DialogTitle>
            <DialogDescription>
              This posts a balanced entry to the Journal and locks it in — corrections after this point require a
              reversal, not an edit.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" onClick={handleApprove} disabled={isPending}>
              {isPending ? "Posting…" : "Approve & Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
