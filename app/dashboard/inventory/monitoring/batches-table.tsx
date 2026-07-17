"use client";

import { useMemo, useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { batchColumns, type BatchRow } from "./batch-utils";
import { movementColumns, type MovementRow } from "./movement-utils";

type Props = {
  data: BatchRow[];
  movements: MovementRow[];
};

function BatchTraceDialog({
  batch,
  movements,
  onOpenChange,
}: {
  batch: BatchRow | null;
  movements: MovementRow[];
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(batch)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{batch?.reference}</DialogTitle>
          <DialogDescription>
            Every stock movement recorded for this batch, in order — from receipt through its current buckets to
            any final shipment or scrap.
          </DialogDescription>
        </DialogHeader>

        {batch && (
          <div className="max-h-[70vh] overflow-y-auto">
            <DataTable
              columns={movementColumns()}
              data={movements}
              searchable={false}
              emptyMessage="No movements recorded"
              emptyDescription="This batch has no tracked movements yet."
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function BatchesTable({ data, movements }: Props) {
  const [selected, setSelected] = useState<BatchRow | null>(null);

  const movementsByLot = useMemo(() => {
    const map = new Map<string, MovementRow[]>();
    for (const m of movements) {
      if (!m.lot_id) continue;
      const list = map.get(m.lot_id);
      if (list) list.push(m);
      else map.set(m.lot_id, [m]);
    }
    return map;
  }, [movements]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Batches"
        description="One row per receiving event for this item at this store — Purchase Order, Manual Incoming, or a positive stock adjustment. Click a batch to see its full movement trace. Stock on hand from before this feature shipped isn't tied to a batch."
      />

      <DataTable
        columns={batchColumns()}
        data={data}
        searchPlaceholder="Search batches…"
        emptyMessage="No batches recorded"
        emptyDescription="Batches appear here once stock is received for this item at this store."
        onRowClick={setSelected}
      />

      <BatchTraceDialog
        batch={selected}
        movements={selected ? movementsByLot.get(selected.id) ?? [] : []}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </div>
  );
}
