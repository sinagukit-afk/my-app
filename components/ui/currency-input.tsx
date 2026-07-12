"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
  currency?: string;
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, label, error, id, currency = "₱", onBlur, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (raw !== "") {
        const num = Number(raw);
        if (Number.isFinite(num)) {
          const rounded = Math.round(num * 100) / 100;
          if (String(rounded) !== raw) {
            e.target.value = String(rounded);
            props.onChange?.(e as unknown as React.ChangeEvent<HTMLInputElement>);
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
        <div className="relative flex items-center">
          <span className="absolute left-3 select-none text-sm text-(--color-text-muted)">
            {currency}
          </span>
          <input
            ref={ref}
            type="number"
            id={inputId}
            step="0.01"
            min="0"
            onBlur={handleBlur}
            className={cn(
              "flex h-9 w-full rounded-md border border-(--color-border) bg-(--color-surface) pl-8 pr-3 py-1 text-sm text-(--color-text) shadow-(--shadow-sm) transition-colors",
              "placeholder:text-(--color-text-subtle)",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary) focus-visible:ring-offset-1",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
              error && "border-(--color-danger) focus-visible:ring-(--color-danger)",
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-(--color-danger)">{error}</p>}
      </div>
    );
  }
);
CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
