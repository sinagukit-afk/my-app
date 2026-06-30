"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { SearchBar } from "./search-bar";
import { FilterBar, type FilterOption } from "./filter-bar";

export interface DataToolbarProps {
  search?: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  };
  filters?: {
    options: FilterOption[];
    value: string;
    onChange: (v: string) => void;
  };
  /** Slot for action buttons (e.g. "Add new", "Export") placed on the right */
  actions?: React.ReactNode;
  className?: string;
}

export function DataToolbar({ search, filters, actions, className }: DataToolbarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {search && (
        <div className="flex-1 min-w-[180px] max-w-[320px]">
          <SearchBar
            value={search.value}
            onChange={search.onChange}
            placeholder={search.placeholder}
          />
        </div>
      )}
      {filters && (
        <FilterBar
          options={filters.options}
          value={filters.value}
          onChange={filters.onChange}
        />
      )}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}
