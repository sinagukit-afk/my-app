"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useNotifications } from "@/components/providers/notification-provider";
import { AccountForm } from "./account-form";
import { setAccountActive } from "./actions";

export type AccountRow = {
  id: string;
  account_number: string;
  name: string;
  category: string;
  description: string | null;
  is_active: boolean;
  parent_account_id: string | null;
  is_postable: boolean;
};

type Props = {
  data: AccountRow[];
  canWrite: boolean;
};

const CATEGORY_BADGE: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" | "neutral" }> = {
  asset: { label: "Asset", variant: "info" },
  liability: { label: "Liability", variant: "warning" },
  equity: { label: "Equity", variant: "default" },
  revenue: { label: "Revenue", variant: "success" },
  expense: { label: "Expense", variant: "danger" },
};

export function ChartOfAccountsTable({ data, canWrite }: Props) {
  const router = useRouter();
  const { notify } = useNotifications();
  const [isPending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AccountRow | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [deactivateTarget, setDeactivateTarget] = useState<AccountRow | null>(null);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  const byId = useMemo(() => new Map(data.map((r) => [r.id, r] as const)), [data]);

  const childrenOf = useMemo(() => {
    const map = new Map<string | null, AccountRow[]>();
    for (const r of data) {
      const key = r.parent_account_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return map;
  }, [data]);

  const hasActiveFilter = Boolean(search.trim() || categoryFilter || statusFilter);

  const matchIds = useMemo(() => {
    if (!hasActiveFilter) return null;
    const q = search.trim().toLowerCase();
    const set = new Set<string>();
    for (const r of data) {
      if (categoryFilter && r.category !== categoryFilter) continue;
      if (statusFilter && String(r.is_active) !== statusFilter) continue;
      if (
        q &&
        !r.account_number.toLowerCase().includes(q) &&
        !r.name.toLowerCase().includes(q) &&
        !(r.description ?? "").toLowerCase().includes(q)
      )
        continue;
      set.add(r.id);
    }
    return set;
  }, [data, search, categoryFilter, statusFilter, hasActiveFilter]);

  const visibleIds = useMemo(() => {
    if (!matchIds) return null;
    const set = new Set(matchIds);
    for (const id of matchIds) {
      let cur = byId.get(id);
      while (cur?.parent_account_id) {
        set.add(cur.parent_account_id);
        cur = byId.get(cur.parent_account_id);
      }
    }
    return set;
  }, [matchIds, byId]);

  const parentOptions = useMemo(
    () =>
      data
        .filter((r) => r.is_active)
        .map((r) => ({ value: r.id, label: `${r.account_number} — ${r.name}` })),
    [data]
  );

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: AccountRow) {
    setEditing(row);
    setFormOpen(true);
  }

  function refresh() {
    router.refresh();
  }

  function handleDeactivate() {
    if (!deactivateTarget) return;
    setDeactivateError(null);
    startTransition(async () => {
      const res = await setAccountActive(deactivateTarget.id, false);
      if (res.success) {
        setDeactivateTarget(null);
        refresh();
      } else {
        setDeactivateError(res.error);
      }
    });
  }

  async function handleReactivate(row: AccountRow) {
    const res = await setAccountActive(row.id, true);
    if (!res.success) notify(res.error, "error");
    else refresh();
  }

  function expandAll() {
    setCollapsed(new Set());
  }

  function collapseAll() {
    const withChildren = data.filter((r) => (childrenOf.get(r.id)?.length ?? 0) > 0).map((r) => r.id);
    setCollapsed(new Set(withChildren));
  }

  function renderRows(rows: AccountRow[], depth: number): ReactNode[] {
    return rows.flatMap((row) => {
      if (visibleIds && !visibleIds.has(row.id)) return [];
      const children = childrenOf.get(row.id) ?? [];
      const isCollapsed = !hasActiveFilter && collapsed.has(row.id);
      const badge = CATEGORY_BADGE[row.category] ?? { label: row.category, variant: "neutral" as const };

      const rowEl = (
        <tr
          key={row.id}
          className="border-b border-(--color-border) last:border-0 hover:bg-(--color-bg) transition-colors"
        >
          <td className="px-4 py-3">
            <div className="flex items-center gap-1.5" style={{ paddingLeft: depth * 20 }}>
              {children.length > 0 ? (
                <button
                  type="button"
                  onClick={() => toggleCollapse(row.id)}
                  aria-label={isCollapsed ? "Expand" : "Collapse"}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-(--color-text-muted) transition-colors hover:bg-(--color-surface) hover:text-(--color-text)"
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                    aria-hidden="true"
                    className={cn("transition-transform", !isCollapsed && "rotate-90")}
                  >
                    <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ) : (
                <span className="inline-block h-5 w-5 shrink-0" />
              )}
              <span className="font-mono text-(--color-text)">{row.account_number}</span>
            </div>
          </td>
          <td className="px-4 py-3">
            <span className="font-medium text-(--color-text)">{row.name}</span>
            {!row.is_postable && (
              <Badge variant="neutral" className="ml-2">
                Group
              </Badge>
            )}
          </td>
          <td className="px-4 py-3">
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </td>
          <td className="px-4 py-3 text-(--color-text-muted)">{row.description || "—"}</td>
          <td className="px-4 py-3">
            <Badge variant={row.is_active ? "success" : "neutral"}>{row.is_active ? "Active" : "Inactive"}</Badge>
          </td>
          <td className="px-4 py-3">
            <div className="flex items-center gap-2">
              {canWrite && (
                <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                  Edit
                </Button>
              )}
              {canWrite && row.is_active && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-(--color-danger)"
                  onClick={() => {
                    setDeactivateTarget(row);
                    setDeactivateError(null);
                  }}
                >
                  Deactivate
                </Button>
              )}
              {canWrite && !row.is_active && (
                <Button variant="ghost" size="sm" onClick={() => handleReactivate(row)}>
                  Reactivate
                </Button>
              )}
            </div>
          </td>
        </tr>
      );

      const childRows = isCollapsed ? [] : renderRows(children, depth + 1);
      return [rowEl, ...childRows];
    });
  }

  const renderedRows = renderRows(childrenOf.get(null) ?? [], 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Chart of Accounts"
        description="The full list of accounts used across Journal entries, Fixed Assets, and Product Mapping."
        actions={canWrite ? <Button onClick={openAdd}>Add Account</Button> : undefined}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-muted)"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <path d="M6 11A5 5 0 1 0 6 1a5 5 0 0 0 0 10ZM13 13l-3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search accounts…"
            className="h-9 w-full rounded-md border border-(--color-border) bg-(--color-surface) pl-9 pr-3 text-sm text-(--color-text) shadow-(--shadow-sm) placeholder:text-(--color-text-subtle) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary) focus-visible:ring-offset-1"
          />
        </div>
        <Select
          aria-label="Filter by category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          options={[
            { value: "", label: "All categories" },
            { value: "asset", label: "Asset" },
            { value: "liability", label: "Liability" },
            { value: "equity", label: "Equity" },
            { value: "revenue", label: "Revenue" },
            { value: "expense", label: "Expense" },
          ]}
          className="w-44"
        />
        <Select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { value: "", label: "All statuses" },
            { value: "true", label: "Active" },
            { value: "false", label: "Inactive" },
          ]}
          className="w-40"
        />
        <div className="ml-auto flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={expandAll}>
            Expand all
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={collapseAll}>
            Collapse all
          </Button>
        </div>
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
                  Name
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
                  Category
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
                  Description
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {renderedRows.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                      <p className="font-medium text-(--color-text-muted)">No accounts found</p>
                      <p className="text-xs text-(--color-text-subtle)">
                        Adjust the category/status filter or search to find what you&apos;re looking for.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                renderedRows
              )}
            </tbody>
          </table>
        </div>
      </div>

      {canWrite && (
        <AccountForm
          open={formOpen}
          onOpenChange={setFormOpen}
          account={editing}
          parentOptions={parentOptions}
          onSaved={refresh}
        />
      )}

      <Dialog
        open={!!deactivateTarget}
        onOpenChange={(next) => {
          if (!next) {
            setDeactivateTarget(null);
            setDeactivateError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Account</DialogTitle>
            <DialogDescription>
              Deactivate account &quot;{deactivateTarget?.account_number} — {deactivateTarget?.name}&quot;? It will
              stop showing up as an option on new journal entries.
            </DialogDescription>
          </DialogHeader>
          {deactivateError && <p className="text-sm text-(--color-danger)">{deactivateError}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" variant="danger" onClick={handleDeactivate} disabled={isPending}>
              {isPending ? "Deactivating…" : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
