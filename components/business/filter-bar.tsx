"use client";

import * as React from "react";
import { Select } from "@/components/ui/select";
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
  "aria-label"?: string;
}

export function FilterBar({ options, value, onChange, className, "aria-label": ariaLabel }: FilterBarProps) {
  return (
    <Select
      aria-label={ariaLabel ?? "Filter"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      options={options}
      className={cn("w-44", className)}
    />
  );
}
