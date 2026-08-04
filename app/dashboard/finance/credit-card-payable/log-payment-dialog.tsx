"use client";

import { useMemo, useState, useTransition } from "react";
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
import { Combobox } from "@/components/ui/combobox";
import { CurrencyInput } from "@/components/ui/currency-input";
import { TextArea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { logInstallmentPayment } from "./actions";

export type CardOption = {
  value: string;
  label: string;
  accountLabel: string;
  balance: number;
  mapped: boolean;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function peso(n: number) {
  return `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type Props = {
  cards: CardOption[];
  paymentTypeOptions: SelectOption[];
};

export function LogPaymentDialog({ cards, paymentTypeOptions }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [cardId, setCardId] = useState("");
  const [paymentTypeId, setPaymentTypeId] = useState("");
  const [principal, setPrincipal] = useState("");
  const [interest, setInterest] = useState("");
  const [paidDate, setPaidDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const cardOptions: SelectOption[] = useMemo(
    () => cards.filter((c) => c.mapped).map((c) => ({ value: c.value, label: c.label })),
    [cards]
  );
  const selectedCard = cards.find((c) => c.value === cardId);
  const anyCardHasBalance = cards.some((c) => c.mapped && c.balance > 0);

  function reset() {
    setCardId("");
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
        cardId,
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

  const canSubmit =
    cardId && paymentTypeId && Number(principal) > 0 && !isPending && (selectedCard?.balance ?? 0) > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button disabled={!anyCardHasBalance}>Log Payment</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log Credit Card Installment Payment</DialogTitle>
          <DialogDescription>
            Records a payment against a card&apos;s outstanding Credit Card Payable balance. This creates a
            draft journal entry — it still needs Review &amp; Approve before it posts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Select
            label="Card"
            value={cardId}
            onChange={(e) => setCardId(e.target.value)}
            placeholder="Select a credit card…"
            options={cardOptions}
          />
          {selectedCard && (
            <p className="-mt-2 text-xs text-(--color-text-muted)">
              Outstanding: {peso(selectedCard.balance)} ({selectedCard.accountLabel})
            </p>
          )}
          <Combobox
            label="Paid From"
            value={paymentTypeId}
            onValueChange={setPaymentTypeId}
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
