"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Skeleton } from "@/components/ui/skeleton";

export type SortDirection = "asc" | "desc" | null;

export interface Column<T> {
  key: keyof T & string;
  header: string;
  sortable?: boolean;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  className?: string;
}

export interface DataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  emptyDescription?: string;
  pageSize?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
  onRowClick?: (row: T) => void;
}

function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  isLoading = false,
  emptyMessage = "No data found",
  emptyDescription = "There are no records to display.",
  pageSize = 10,
  searchable = true,
  searchPlaceholder = "Search…",
  className,
  onRowClick,
}: DataTableProps<T>) {
  const [search, setSearch] = React.useState("");
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<SortDirection>(null);
  const [page, setPage] = React.useState(1);

  // Filter
  const filtered = React.useMemo(() => {
    if (!search.trim()) return data;
    const lower = search.toLowerCase();
    return data.filter((row) =>
      Object.values(row).some((v) =>
        String(v ?? "").toLowerCase().includes(lower)
      )
    );
  }, [data, search]);

  // Sort
  const sorted = React.useMemo(() => {
    if (!sortKey || !sortDir) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : d === "desc" ? null : "asc"));
      if (sortDir === "desc") setSortKey(null);
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const EmptyState = () => (
    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true" className="text-(--color-text-subtle)">
        <rect x="6" y="10" width="28" height="22" rx="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6 16h28" stroke="currentColor" strokeWidth="1.5" />
        <path d="M14 24h12M14 28h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <p className="font-medium text-(--color-text-muted)">{emptyMessage}</p>
      <p className="text-xs text-(--color-text-subtle)">{emptyDescription}</p>
    </div>
  );

  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) {
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="opacity-30">
          <path d="M6 2v8M3 5l3-3 3 3M3 7l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="text-(--color-primary)">
        {sortDir === "asc" ? (
          <path d="M3 7l3-5 3 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M3 5l3 5 3-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    );
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Search */}
      {searchable && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-muted)"
              width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"
            >
              <path d="M6 11A5 5 0 1 0 6 1a5 5 0 0 0 0 10ZM13 13l-3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={handleSearch}
              placeholder={searchPlaceholder}
              className={cn(
                "h-9 w-full rounded-md border border-(--color-border) bg-(--color-surface) pl-9 pr-3 text-sm text-(--color-text) shadow-(--shadow-sm)",
                "placeholder:text-(--color-text-subtle)",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary) focus-visible:ring-offset-1"
              )}
            />
          </div>
          {search && (
            <span className="text-xs text-(--color-text-muted)">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {/* Table (lg and up) */}
      <div className="rounded-lg border border-(--color-border) overflow-hidden bg-(--color-surface) shadow-(--shadow-sm)">
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-(--color-border) bg-(--color-bg)">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={cn(
                      "px-4 py-3 text-left text-xs font-semibold text-(--color-text-muted) uppercase tracking-wider whitespace-nowrap",
                      col.sortable && "cursor-pointer select-none hover:text-(--color-text) transition-colors",
                      col.className
                    )}
                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {col.header}
                      {col.sortable && <SortIcon col={col.key} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: pageSize }).map((_, i) => (
                  <tr key={i} className="border-b border-(--color-border) last:border-0">
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={columns.length}>
                    <EmptyState />
                  </td>
                </tr>
              ) : (
                paginated.map((row, ri) => (
                  <tr
                    key={ri}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      "border-b border-(--color-border) last:border-0 hover:bg-(--color-bg) transition-colors",
                      onRowClick && "cursor-pointer"
                    )}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={cn("px-4 py-3 text-(--color-text)", col.className)}>
                        {col.render
                          ? col.render(row[col.key], row)
                          : String(row[col.key] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Stacked rows (below lg) — card fallback so dense tables don't require horizontal scrolling on phones/tablets */}
        <div className="lg:hidden">
          {isLoading ? (
            <div className="divide-y divide-(--color-border)">
              {Array.from({ length: pageSize }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2 p-4">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : paginated.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="divide-y divide-(--color-border)">
              {paginated.map((row, ri) => {
                const [primary, ...rest] = columns;
                const labeled = rest.filter((col) => col.header);
                const unlabeled = rest.filter((col) => !col.header);
                return (
                  <div
                    key={ri}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      "flex flex-col gap-2 p-4 transition-colors",
                      onRowClick && "cursor-pointer active:bg-(--color-bg)"
                    )}
                  >
                    <div className="text-(--color-text)">
                      {primary.render
                        ? primary.render(row[primary.key], row)
                        : String(row[primary.key] ?? "")}
                    </div>
                    {labeled.map((col) => (
                      <div key={col.key} className="flex items-start justify-between gap-3 text-sm">
                        <span className="shrink-0 text-(--color-text-muted)">{col.header}</span>
                        <span className="text-right text-(--color-text)">
                          {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? "")}
                        </span>
                      </div>
                    ))}
                    {unlabeled.length > 0 && (
                      <div className="flex items-center justify-end gap-3 border-t border-(--color-border) pt-2">
                        {unlabeled.map((col) => (
                          <div key={col.key}>
                            {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? "")}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination footer */}
        {!isLoading && sorted.length > 0 && (
          <div className="flex items-center justify-between border-t border-(--color-border) bg-(--color-bg) px-4 py-2.5">
            <span className="text-xs text-(--color-text-muted)">
              Showing {Math.min((currentPage - 1) * pageSize + 1, sorted.length)}–{Math.min(currentPage * pageSize, sorted.length)} of {sorted.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-md text-xs text-(--color-text-muted) transition-colors",
                  "hover:bg-(--color-surface) hover:text-(--color-text)",
                  "disabled:cursor-not-allowed disabled:opacity-40"
                )}
                aria-label="Previous page"
              >
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === "…" ? (
                    <span key={`ellipsis-${i}`} className="px-1 text-xs text-(--color-text-subtle)">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      className={cn(
                        "inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-md px-1.5 text-xs transition-colors",
                        currentPage === p
                          ? "bg-(--color-primary) text-(--color-primary-fg) font-medium"
                          : "text-(--color-text-muted) hover:bg-(--color-surface) hover:text-(--color-text)"
                      )}
                    >
                      {p}
                    </button>
                  )
                )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-md text-xs text-(--color-text-muted) transition-colors",
                  "hover:bg-(--color-surface) hover:text-(--color-text)",
                  "disabled:cursor-not-allowed disabled:opacity-40"
                )}
                aria-label="Next page"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { DataTable };
