"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Select } from "@/components/ui/select";
import { NumberInput } from "@/components/ui/number-input";
import { TextArea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { adjustStock } from "./actions";

export type VariantOption = {
  id: string;
  label: string;
  sku: string | null;
  in_stock: number;
};

export const REASONS = [
  { value: "physical_count", label: "Physical Count Correction" },
  { value: "damage", label: "Damage / Spoilage" },
  { value: "loss", label: "Loss / Theft" },
  { value: "other", label: "Other" },
];

type Direction = "add" | "subtract";

type Props = {
  variants: VariantOption[];
};

export function AdjustmentForm({ variants }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [variantId, setVariantId] = useState("");
  const [direction, setDirection] = useState<Direction>("add");
  const [qtyAbs, setQtyAbs] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(() => variants.find((v) => v.id === variantId) ?? null, [variants, variantId]);

  const qtyDelta = useMemo(() => {
    if (!qtyAbs || Number.isNaN(Number(qtyAbs))) return null;
    const abs = Math.abs(Number(qtyAbs));
    return direction === "subtract" ? -abs : abs;
  }, [qtyAbs, direction]);

  const resultingStock = useMemo(() => {
    if (!selected || qtyDelta === null) return null;
    return Number(selected.in_stock) + qtyDelta;
  }, [selected, qtyDelta]);

  const wouldGoNegative = resultingStock !== null && resultingStock < 0;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (wouldGoNegative) return;
    const formData = new FormData(e.currentTarget);
    formData.delete("qty_abs");
    formData.set("qty_delta", String(qtyDelta));
    startTransition(async () => {
      const res = await adjustStock(formData);
      if (res.success) {
        (e.target as HTMLFormElement).reset();
        setVariantId("");
        setDirection("add");
        setQtyAbs("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>New Adjustment</CardTitle>
        <CardDescription>
          Increase or decrease stock for an item with a recorded reason.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Combobox
            label="Item"
            name="variant_id"
            value={variantId}
            onValueChange={setVariantId}
            placeholder="Select an item…"
            searchPlaceholder="Search by name or SKU…"
            options={variants.map((v) => ({
              value: v.id,
              label: v.sku ? `${v.label} (${v.sku})` : v.label,
              keywords: v.sku ?? undefined,
            }))}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-(--color-text)">Direction</span>
            <div className="inline-flex w-full overflow-hidden rounded-md border border-(--color-border)">
              <button
                type="button"
                onClick={() => setDirection("add")}
                aria-pressed={direction === "add"}
                className={cn(
                  "flex-1 px-3 py-1.5 text-sm font-medium transition-colors",
                  direction === "add"
                    ? "bg-(--color-primary) text-(--color-primary-fg)"
                    : "bg-(--color-surface) text-(--color-text-muted) hover:bg-(--color-bg)"
                )}
              >
                + Add to Stock
              </button>
              <button
                type="button"
                onClick={() => setDirection("subtract")}
                aria-pressed={direction === "subtract"}
                className={cn(
                  "flex-1 border-l border-(--color-border) px-3 py-1.5 text-sm font-medium transition-colors",
                  direction === "subtract"
                    ? "bg-(--color-danger) text-white"
                    : "bg-(--color-surface) text-(--color-text-muted) hover:bg-(--color-bg)"
                )}
              >
                − Remove from Stock
              </button>
            </div>
          </div>

          {selected && (
            <p className="text-sm text-(--color-text-muted)">
              Current stock: <span className="font-medium text-(--color-text)">{selected.in_stock}</span>
              {resultingStock !== null && (
                <>
                  {" "}
                  → New stock:{" "}
                  <span
                    className={
                      wouldGoNegative ? "font-medium text-(--color-danger)" : "font-medium text-(--color-text)"
                    }
                  >
                    {resultingStock}
                  </span>
                </>
              )}
            </p>
          )}

          <NumberInput
            label="Quantity"
            name="qty_abs"
            value={qtyAbs}
            onChange={(e) => setQtyAbs(e.target.value)}
            step="any"
            min={0}
            decimals={3}
            error={wouldGoNegative ? "This would take stock negative — reduce the quantity." : undefined}
            required
          />

          <Select label="Reason" name="reason" placeholder="Select a reason…" options={REASONS} required />

          <TextArea label="Note" name="note" rows={3} placeholder="Optional details…" />

          {error && <p className="text-sm text-(--color-danger)">{error}</p>}

          <Button type="submit" disabled={isPending || !variantId || wouldGoNegative}>
            {isPending ? "Saving…" : "Submit Adjustment"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
