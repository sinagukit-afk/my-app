"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { ReleaseForm } from "./release-form";

export type ReviewRow = {
  variant_id: string;
  store_id: string;
  item_name: string;
  variant_label: string | null;
  sku: string | null;
  on_hold_qty: number;
  available_qty: number;
  group_label: string;
  group_href: string | null;
};

type Props = {
  data: ReviewRow[];
  canRelease: boolean;
};

export function ItemsForReviewTable({ data, canRelease }: Props) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<ReviewRow | null>(null);

  function openRelease(row: ReviewRow) {
    setSelected(row);
    setFormOpen(true);
  }

  function refresh() {
    router.refresh();
  }

  // A SKU can appear as more than one row when its On Hold stock came from multiple
  // sources (see splitOnHoldBySource in page.tsx) — count occurrences per (variant, store)
  // so the table can flag the split visually instead of looking like duplicate data.
  const sourceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of data) {
      const key = `${row.variant_id}:${row.store_id}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [data]);

  const columns: Column<ReviewRow>[] = [
    {
      key: "item_name",
      header: "Item",
      sortable: true,
      render: (value, row) => {
        const count = sourceCounts.get(`${row.variant_id}:${row.store_id}`) ?? 1;
        return (
          <div>
            <p className="flex items-center gap-1.5 font-medium text-(--color-text)">
              {String(value)}
              {count > 1 && (
                <span
                  title={`This item's On Hold stock is split across ${count} sources.`}
                  className="inline-flex items-center rounded-full bg-(--color-border) px-1.5 py-0.5 text-[10px] font-semibold text-(--color-text-muted)"
                >
                  ×{count} sources
                </span>
              )}
            </p>
            {(row.variant_label || row.sku) && (
              <p className="text-xs text-(--color-text-muted)">
                {row.variant_label ?? row.sku}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: "on_hold_qty",
      header: "On Hold",
      sortable: true,
      render: (value) => <Badge variant="warning">{String(value)}</Badge>,
    },
    {
      key: "available_qty",
      header: "Available",
      sortable: true,
    },
    {
      key: "group_label",
      header: "Source",
      sortable: true,
      render: (value, row) =>
        row.group_href ? (
          <Link
            href={row.group_href}
            className="hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {String(value)}
          </Link>
        ) : (
          <span className="text-(--color-text-muted)">{String(value)}</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Items for Review"
        description="Stock parked On Hold — typically the already-completed portion of a cancelled Production Order — with no automatic path back into circulation. Click a row to review and release it to Available or Scrap. A SKU may appear more than once if its On Hold stock came from more than one cancelled order."
      />

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search items…"
        onRowClick={canRelease ? openRelease : undefined}
        emptyMessage="Nothing to review"
        emptyDescription="No items currently have stock parked On Hold."
      />

      {canRelease && (
        <ReleaseForm open={formOpen} onOpenChange={setFormOpen} row={selected} onReleased={refresh} />
      )}
    </div>
  );
}
