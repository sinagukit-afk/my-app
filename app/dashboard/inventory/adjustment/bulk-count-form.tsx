"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { NumberInput } from "@/components/ui/number-input";
import { TextArea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { formatQty } from "@/lib/utils/format";
import { randomId } from "@/lib/utils/random-id";
import { bulkAdjustStock } from "./actions";
import type { VariantOption } from "./adjustment-form";

type CountRow = {
  rowId: string;
  variantId: string;
  countedQty: string;
};

function emptyRow(): CountRow {
  return { rowId: randomId(), variantId: "", countedQty: "" };
}

type Props = {
  variants: VariantOption[];
};

export function BulkCountForm({ variants }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<CountRow[]>([emptyRow()]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function updateRow(rowId: string, patch: Partial<CountRow>) {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(rowId: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.rowId !== rowId) : prev));
  }

  const resolved = useMemo(
    () =>
      rows.map((row) => {
        const variant = variants.find((v) => v.id === row.variantId) ?? null;
        const counted = row.countedQty === "" ? null : Number(row.countedQty);
        const delta = variant && counted !== null && !Number.isNaN(counted) ? counted - variant.in_stock : null;
        return { ...row, variant, counted, delta };
      }),
    [rows, variants]
  );

  const changedRows = resolved.filter((r) => r.variant && r.delta !== null && r.delta !== 0);
  const hasIncompleteRow = resolved.some((r) => r.variantId && r.counted === null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (changedRows.length === 0) {
      setError("No counted quantities differ from current stock — nothing to submit.");
      return;
    }
    startTransition(async () => {
      const res = await bulkAdjustStock(
        changedRows.map((r) => ({ variant_id: r.variantId, qty_delta: r.delta as number })),
        note.trim() || null
      );
      if (res.success) {
        setRows([emptyRow()]);
        setNote("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  // Variants already picked in another row are hidden from the rest of the pickers, so a
  // recount can't accidentally be split across two rows for the same item.
  function optionsFor(rowId: string) {
    const usedElsewhere = new Set(rows.filter((r) => r.rowId !== rowId).map((r) => r.variantId));
    return variants
      .filter((v) => !usedElsewhere.has(v.id))
      .map((v) => ({
        value: v.id,
        label: v.sku ? `${v.label} (${v.sku})` : v.label,
        keywords: v.sku ?? undefined,
      }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk Physical Count</CardTitle>
        <CardDescription>
          Enter the counted (ending) quantity for each item — only rows where the count differs
          from current stock will post an adjustment, recorded as a Physical Count Correction.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form id="bulk-count-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            {resolved.map((row) => (
              <div key={row.rowId} className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
                <Combobox
                  label="Item"
                  value={row.variantId}
                  onValueChange={(v) => updateRow(row.rowId, { variantId: v })}
                  placeholder="Select an item…"
                  searchPlaceholder="Search by name or SKU…"
                  options={optionsFor(row.rowId)}
                />
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-(--color-text)">Current Stock</span>
                  <p className="flex h-9 items-center text-sm text-(--color-text-muted)">
                    {row.variant ? formatQty(row.variant.in_stock) : "—"}
                  </p>
                </div>
                <NumberInput
                  label="Counted Qty"
                  value={row.countedQty}
                  onChange={(e) => updateRow(row.rowId, { countedQty: e.target.value })}
                  step="any"
                  min={0}
                  decimals={3}
                  disabled={!row.variantId}
                />
                <div className="flex items-center gap-2 sm:pb-0.5">
                  {row.delta !== null && (
                    <span
                      className={
                        row.delta === 0
                          ? "text-xs text-(--color-text-subtle)"
                          : row.delta > 0
                            ? "text-xs font-medium text-(--color-success)"
                            : "text-xs font-medium text-(--color-danger)"
                      }
                    >
                      {row.delta === 0 ? "No change" : row.delta > 0 ? `+${formatQty(row.delta)}` : formatQty(row.delta)}
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => removeRow(row.rowId)}
                    disabled={rows.length === 1}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Button type="button" variant="secondary" size="sm" onClick={addRow}>
            + Add Row
          </Button>

          <TextArea
            label="Note (applies to all counted rows)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="e.g. Weekly cycle count, July 19…"
          />

          {error && <p className="text-sm text-(--color-danger)">{error}</p>}
        </form>
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <span className="text-xs text-(--color-text-muted)">
          {changedRows.length === 0
            ? "No changes yet"
            : `${changedRows.length} item${changedRows.length !== 1 ? "s" : ""} will be adjusted`}
        </span>
        <Button type="submit" form="bulk-count-form" disabled={isPending || changedRows.length === 0 || hasIncompleteRow}>
          {isPending ? "Saving…" : "Submit Count"}
        </Button>
      </CardFooter>
    </Card>
  );
}
