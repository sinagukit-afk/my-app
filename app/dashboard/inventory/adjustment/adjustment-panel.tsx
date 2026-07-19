"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { AdjustmentForm, type VariantOption } from "./adjustment-form";
import { BulkCountForm } from "./bulk-count-form";

type Mode = "single" | "bulk";

type Props = {
  variants: VariantOption[];
};

export function AdjustmentPanel({ variants }: Props) {
  const [mode, setMode] = useState<Mode>("single");

  return (
    <div className="space-y-4">
      <div className="inline-flex overflow-hidden rounded-md border border-(--color-border)">
        <button
          type="button"
          onClick={() => setMode("single")}
          aria-pressed={mode === "single"}
          className={cn(
            "px-3 py-1.5 text-sm font-medium transition-colors",
            mode === "single"
              ? "bg-(--color-primary) text-(--color-primary-fg)"
              : "bg-(--color-surface) text-(--color-text-muted) hover:bg-(--color-bg)"
          )}
        >
          Single Item
        </button>
        <button
          type="button"
          onClick={() => setMode("bulk")}
          aria-pressed={mode === "bulk"}
          className={cn(
            "border-l border-(--color-border) px-3 py-1.5 text-sm font-medium transition-colors",
            mode === "bulk"
              ? "bg-(--color-primary) text-(--color-primary-fg)"
              : "bg-(--color-surface) text-(--color-text-muted) hover:bg-(--color-bg)"
          )}
        >
          Bulk Physical Count
        </button>
      </div>

      {mode === "single" ? <AdjustmentForm variants={variants} /> : <BulkCountForm variants={variants} />}
    </div>
  );
}
