"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
  /** When set, the value is rounded to this many decimal places on blur (e.g. 3 for quantities). */
  decimals?: number;
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, label, error, id, decimals, onBlur, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      if (decimals !== undefined) {
        const raw = e.target.value;
        if (raw !== "") {
          const num = Number(raw);
          if (Number.isFinite(num)) {
            const factor = 10 ** decimals;
            const rounded = Math.round(num * factor) / factor;
            if (String(rounded) !== raw) {
              e.target.value = String(rounded);
              props.onChange?.(e as unknown as React.ChangeEvent<HTMLInputElement>);
            }
          }
        }
      }
      onBlur?.(e);
    };

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-(--color-text)">
            {label}
          </label>
        )}
        <input
          ref={ref}
          type="number"
          id={inputId}
          onBlur={handleBlur}
          className={cn(
            "flex h-9 w-full rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-1 text-sm text-(--color-text) shadow-(--shadow-sm) transition-colors",
            "placeholder:text-(--color-text-subtle)",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary) focus-visible:ring-offset-1",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
            error && "border-(--color-danger) focus-visible:ring-(--color-danger)",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-(--color-danger)">{error}</p>}
      </div>
    );
  }
);
NumberInput.displayName = "NumberInput";

export { NumberInput };
