"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { NumberInput } from "@/components/ui/number-input";
import { TextArea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { transferStockStatus, adjustIncomingQty } from "./actions";
import type { InventoryMonitoringRow } from "./inventory-monitoring-table";

const HELD_STATUS_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "reserved", label: "Reserved" },
  { value: "in_production", label: "In Production" },
  { value: "on_hold", label: "On Hold" },
];

type MoveStockDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: InventoryMonitoringRow | null;
};

export function MoveStockDialog({ open, onOpenChange, row }: MoveStockDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!row) return;
    const formData = new FormData(e.currentTarget);
    formData.set("variant_id", row.variant_id);
    formData.set("store_id", row.store_id);
    startTransition(async () => {
      const res = await transferStockStatus(formData);
      if (res.success) {
        onOpenChange(false);
        router.refresh();
      } else {
        alert(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Move Stock Between Statuses</DialogTitle>
            <DialogDescription>
              {row ? `${row.item_name}${row.sku ? ` (${row.sku})` : ""}` : "Move quantity between status buckets."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <Select label="From" name="from_status" options={HELD_STATUS_OPTIONS} required />
            <Select label="To" name="to_status" options={HELD_STATUS_OPTIONS} required />
          </div>

          <NumberInput label="Quantity" name="quantity" min="0" step="any" required />
          <TextArea label="Note" name="note" rows={2} placeholder="Optional details…" />

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Moving…" : "Move Stock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type AdjustIncomingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: InventoryMonitoringRow | null;
};

export function AdjustIncomingDialog({ open, onOpenChange, row }: AdjustIncomingDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!row) return;
    const formData = new FormData(e.currentTarget);
    formData.set("variant_id", row.variant_id);
    formData.set("store_id", row.store_id);
    startTransition(async () => {
      const res = await adjustIncomingQty(formData);
      if (res.success) {
        onOpenChange(false);
        router.refresh();
      } else {
        alert(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Adjust Incoming</DialogTitle>
            <DialogDescription>
              {row ? `${row.item_name}${row.sku ? ` (${row.sku})` : ""}` : "Add or remove expected incoming stock."}
              {row && (
                <>
                  {" "}Current incoming: <span className="font-medium">{row.incoming_qty}</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <NumberInput
            label="Quantity Change (use negative to subtract)"
            name="quantity_change"
            step="any"
            required
          />
          <TextArea label="Note" name="note" rows={2} placeholder="Optional details…" />

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Adjust Incoming"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
