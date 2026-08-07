"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface ComboboxOption {
  value: string;
  label: string;
  /** Extra hidden search terms (e.g. SKU, aliases) matched alongside the label. */
  keywords?: string;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  /** When set, a hidden input carries the value so plain FormData forms keep working. */
  name?: string;
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  /**
   * When set, a "Create …" row appears whenever the search text doesn't exactly match an
   * existing option's label. Selecting it calls back with the trimmed search text instead
   * of a value — the caller is responsible for creating the entity and calling onValueChange.
   */
  onCreateOption?: (query: string) => void;
  /** Label for the create row. Defaults to `Create "<query>"`. */
  createOptionLabel?: (query: string) => string;
}

/** Searchable single-select. Same visual language as Select, but with a type-to-filter panel. */
export function Combobox({
  options,
  value,
  onValueChange,
  label,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  name,
  error,
  disabled,
  autoFocus,
  id,
  className,
  "aria-label": ariaLabel,
  onCreateOption,
  createOptionLabel,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [highlight, setHighlight] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  // useId is SSR-stable, so ids never mismatch on hydration and stay unique per instance.
  const reactId = React.useId();
  const inputId = id ?? reactId;
  const listboxId = `${inputId}-listbox`;

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = React.useMemo(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return options;
    return options.filter((o) => {
      const haystack = `${o.label} ${o.keywords ?? ""}`.toLowerCase();
      return tokens.every((t) => haystack.includes(t));
    });
  }, [options, query]);

  const trimmedQuery = query.trim();
  const showCreate = Boolean(
    onCreateOption &&
      trimmedQuery.length > 0 &&
      !options.some((o) => o.label.toLowerCase() === trimmedQuery.toLowerCase())
  );
  const createIndex = filtered.length;
  const totalCount = filtered.length + (showCreate ? 1 : 0);

  const close = React.useCallback((refocusTrigger = true) => {
    setOpen(false);
    setQuery("");
    if (refocusTrigger) triggerRef.current?.focus();
  }, []);

  function openPanel() {
    const selectedIndex = selected ? options.indexOf(selected) : -1;
    setHighlight(Math.max(0, selectedIndex));
    setOpen(true);
  }

  function select(option: ComboboxOption) {
    onValueChange(option.value);
    close();
  }

  function createOption() {
    if (!onCreateOption || !trimmedQuery) return;
    onCreateOption(trimmedQuery);
    close();
  }

  React.useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);

  React.useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${highlight}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, totalCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlight === createIndex && showCreate) {
        createOption();
        return;
      }
      const option = filtered[highlight];
      if (option) select(option);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      close(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-(--color-text)">
          {label}
        </label>
      )}
      <div ref={rootRef} className="relative">
        <button
          type="button"
          ref={triggerRef}
          id={inputId}
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          disabled={disabled}
          autoFocus={autoFocus}
          onClick={() => (open ? close() : openPanel())}
          onKeyDown={(e) => {
            if (!open && e.key === "ArrowDown") {
              e.preventDefault();
              openPanel();
            }
          }}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-1 text-sm text-(--color-text) shadow-(--shadow-sm) transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary) focus-visible:ring-offset-1",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-(--color-danger) focus-visible:ring-(--color-danger)",
            className
          )}
        >
          <span className={cn("truncate text-left", !selected && "text-(--color-text-subtle)")}>
            {selected?.label ?? placeholder}
          </span>
          <svg
            className="shrink-0 text-(--color-text-muted)"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-(--color-border) bg-(--color-surface) shadow-(--shadow-md)">
            <div className="border-b border-(--color-border) p-1.5">
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlight(0);
                }}
                onKeyDown={onSearchKeyDown}
                placeholder={searchPlaceholder}
                role="searchbox"
                aria-autocomplete="list"
                aria-controls={listboxId}
                className="h-8 w-full rounded border-0 bg-transparent px-2 text-sm text-(--color-text) placeholder:text-(--color-text-subtle) focus:outline-none"
              />
            </div>
            <ul ref={listRef} id={listboxId} role="listbox" className="max-h-60 overflow-y-auto p-1">
              {filtered.length === 0 && !showCreate && (
                <li className="px-2 py-2 text-sm text-(--color-text-muted)">No items match your search.</li>
              )}
              {filtered.map((o, i) => (
                <li
                  key={o.value}
                  data-index={i}
                  role="option"
                  aria-selected={o.value === value}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    select(o);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={cn(
                    "cursor-pointer rounded px-2 py-1.5 text-sm text-(--color-text)",
                    i === highlight && "bg-(--color-bg)",
                    o.value === value && "font-medium text-(--color-primary)"
                  )}
                >
                  {o.label}
                </li>
              ))}
              {showCreate && (
                <li
                  data-index={createIndex}
                  role="option"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    createOption();
                  }}
                  onMouseEnter={() => setHighlight(createIndex)}
                  className={cn(
                    "cursor-pointer rounded px-2 py-1.5 text-sm font-medium text-(--color-primary)",
                    createIndex === highlight && "bg-(--color-bg)"
                  )}
                >
                  {createOptionLabel ? createOptionLabel(trimmedQuery) : `Create "${trimmedQuery}"`}
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-(--color-danger)">{error}</p>}
      {name && <input type="hidden" name={name} value={value} />}
    </div>
  );
}
