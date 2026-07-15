"use client";

import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type HierarchicalReportRow = {
  account_id: string;
  account_number: string;
  account_name: string;
  category: string;
  depth: number;
  is_postable: boolean;
};

export type ValueColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
};

type Props<T extends HierarchicalReportRow> = {
  rows: T[];
  valueColumns: ValueColumn<T>[];
  categoryBadge: (category: string) => ReactNode;
  searchPlaceholder?: string;
  emptyMessage: string;
  emptyDescription: string;
};

export function HierarchicalReportTable<T extends HierarchicalReportRow>({
  rows,
  valueColumns,
  categoryBadge,
  searchPlaceholder = "Search accounts…",
  emptyMessage,
  emptyDescription,
}: Props<T>) {
  const [search, setSearch] = useState("");

  // Rows arrive in tree pre-order (parent immediately followed by its
  // children, per `sort_path`), so a row's ancestor chain can be recovered
  // just by tracking, at each depth, the most recent row seen — no
  // parent_account_id needed on the client.
  const visibleIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    const set = new Set<string>();
    const stack: string[] = [];
    for (const row of rows) {
      stack.length = row.depth;
      const matches =
        row.account_number.toLowerCase().includes(q) || row.account_name.toLowerCase().includes(q);
      if (matches) {
        set.add(row.account_id);
        for (const ancestorId of stack) set.add(ancestorId);
      }
      stack[row.depth] = row.account_id;
    }
    return set;
  }, [rows, search]);

  const visibleRows = visibleIds ? rows.filter((r) => visibleIds.has(r.account_id)) : rows;
  const colCount = 3 + valueColumns.length;

  return (
    <div className="space-y-3">
      <div className="relative w-full max-w-xs">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-muted)"
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M6 11A5 5 0 1 0 6 1a5 5 0 0 0 0 10ZM13 13l-3-3"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-9 w-full rounded-md border border-(--color-border) bg-(--color-surface) pl-9 pr-3 text-sm text-(--color-text) shadow-(--shadow-sm) placeholder:text-(--color-text-subtle) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary) focus-visible:ring-offset-1"
        />
      </div>

      <div className="rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-sm) overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-(--color-border) bg-(--color-bg)">
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
                  Account #
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
                  Account Name
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
                  Category
                </th>
                {valueColumns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)"
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={colCount}>
                    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                      <p className="font-medium text-(--color-text-muted)">{emptyMessage}</p>
                      <p className="text-xs text-(--color-text-subtle)">{emptyDescription}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => (
                  <tr
                    key={row.account_id}
                    className={cn(
                      "border-b border-(--color-border) last:border-0",
                      !row.is_postable && "bg-(--color-bg) font-semibold"
                    )}
                  >
                    <td className="px-4 py-3">
                      <div style={{ paddingLeft: row.depth * 20 }}>
                        <span className="font-mono text-(--color-text)">{row.account_number}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-(--color-text)">{row.account_name}</td>
                    <td className="px-4 py-3">{categoryBadge(row.category)}</td>
                    {valueColumns.map((col) => (
                      <td key={col.key} className="px-4 py-3 text-right">
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
