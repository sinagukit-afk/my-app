"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterBarProps {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function FilterBar({ options, value, onChange, className }: FilterBarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)} role="group" aria-label="Filter options">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={cn(
              "h-8 rounded-md px-3 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)",
              active
                ? "bg-(--color-primary) text-(--color-primary-fg)"
                : "border border-(--color-border) bg-(--color-surface) text-(--color-text-muted) hover:bg-(--color-bg) hover:text-(--color-text)"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
