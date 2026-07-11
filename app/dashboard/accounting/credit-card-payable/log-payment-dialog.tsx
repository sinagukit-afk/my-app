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
import { Select, type SelectOption } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { TextArea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { logInstallmentPayment } from "./actions";

function today() {
  return new Date().toISOString().slice(0, 10);
}

type Props = {
  paymentTypeOptions: SelectOption[];
  outstandingBalance: number;
};

export function LogPaymentDialog({ paymentTypeOptions, outstandingBalance }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [paymentTypeId, setPaymentTypeId] = useState("");
  const [principal, setPrincipal] = useState("");
  const [interest, setInterest] = useState("");
  const [paidDate, setPaidDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setPaymentTypeId("");
    setPrincipal("");
    setInterest("");
    setPaidDate(today());
    setNotes("");
    setError(null);
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const res = await logInstallmentPayment(
        paymentTypeId,
        Number(principal) || 0,
        Number(interest) || 0,
        paidDate,
        notes
      );
      if (res.success) {
        setOpen(false);
        reset();
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  const canSubmit = paymentTypeId && Number(principal) > 0 && !isPending && outstandingBalance > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button disabled={outstandingBalance <= 0}>Log Payment</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log Credit Card Installment Payment</DialogTitle>
          <DialogDescription>
            Records a payment against the outstanding Credit Card Payable balance. This creates a draft journal
            entry — it still needs Review &amp; Approve before it posts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Select
            label="Paid From"
            value={paymentTypeId}
            onChange={(e) => setPaymentTypeId(e.target.value)}
            placeholder="Select a payment method…"
            options={paymentTypeOptions}
          />
          <div className="grid grid-cols-2 gap-3">
            <CurrencyInput
              label="Principal"
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
            />
            <CurrencyInput
              label="Interest / Finance Charge"
              value={interest}
              onChange={(e) => setInterest(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <Input
            label="Paid Date"
            type="date"
            value={paidDate}
            onChange={(e) => setPaidDate(e.target.value)}
          />
          <TextArea
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
            rows={2}
          />
          {error && <p className="text-sm text-(--color-danger)">{error}</p>}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {isPending ? "Logging…" : "Log Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
