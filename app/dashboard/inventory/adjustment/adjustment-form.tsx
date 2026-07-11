"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { NumberInput } from "@/components/ui/number-input";
import { TextArea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { adjustStock } from "./actions";

export type VariantOption = {
  id: string;
  label: string;
  sku: string | null;
  in_stock: number;
};

const REASONS = [
  { value: "physical_count", label: "Physical Count Correction" },
  { value: "damage", label: "Damage / Spoilage" },
  { value: "loss", label: "Loss / Theft" },
  { value: "other", label: "Other" },
];

type Props = {
  variants: VariantOption[];
};

export function AdjustmentForm({ variants }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [variantId, setVariantId] = useState("");
  const [qtyDelta, setQtyDelta] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(() => variants.find((v) => v.id === variantId) ?? null, [variants, variantId]);

  const resultingStock = useMemo(() => {
    if (!selected || !qtyDelta || Number.isNaN(Number(qtyDelta))) return null;
    return Number(selected.in_stock) + Number(qtyDelta);
  }, [selected, qtyDelta]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await adjustStock(formData);
      if (res.success) {
        (e.target as HTMLFormElement).reset();
        setVariantId("");
        setQtyDelta("");
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
          <Select
            label="Item"
            name="variant_id"
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
            placeholder="Select an item…"
            options={variants.map((v) => ({
              value: v.id,
              label: v.sku ? `${v.label} (${v.sku})` : v.label,
            }))}
            required
          />

          {selected && (
            <p className="text-sm text-(--color-text-muted)">
              Current stock: <span className="font-medium text-(--color-text)">{selected.in_stock}</span>
              {resultingStock !== null && (
                <>
                  {" "}
                  → New stock:{" "}
                  <span
                    className={
                      resultingStock < 0 ? "font-medium text-(--color-danger)" : "font-medium text-(--color-text)"
                    }
                  >
                    {resultingStock}
                  </span>
                </>
              )}
            </p>
          )}

          <NumberInput
            label="Adjustment Quantity (use negative to subtract)"
            name="qty_delta"
            value={qtyDelta}
            onChange={(e) => setQtyDelta(e.target.value)}
            step="any"
            required
          />

          <Select label="Reason" name="reason" placeholder="Select a reason…" options={REASONS} />

          <TextArea label="Note" name="note" rows={3} placeholder="Optional details…" />

          {error && <p className="text-sm text-(--color-danger)">{error}</p>}

          <Button type="submit" disabled={isPending || !variantId}>
            {isPending ? "Saving…" : "Submit Adjustment"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
