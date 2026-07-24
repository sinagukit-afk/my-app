"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { FilterBar } from "@/components/business/filter-bar";
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
import { TestimonialForm } from "./testimonial-form";
import { archiveTestimonial, restoreTestimonial, setTestimonialPublished } from "./actions";

export type TestimonialRow = {
  id: string;
  author_name: string;
  author_role: string | null;
  quote: string;
  rating: number | null;
  avatar_url: string | null;
  sort_order: number;
  published: boolean;
  deleted_at: string | null;
};

type Props = {
  data: TestimonialRow[];
};

const STATUS_OPTIONS = [
  { label: "Live on website", value: "published" },
  { label: "Draft (unpublished)", value: "draft" },
  { label: "Archived", value: "archived" },
  { label: "All statuses", value: "all" },
];

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-(--color-warning)" aria-label={`${rating} out of 5`}>
      {"★".repeat(rating)}
      <span className="text-(--color-border-strong)">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

export function TestimonialsTable({ data }: Props) {
  const router = useRouter();
  const { notify } = useNotifications();
  const [isPending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState("published");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TestimonialRow | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<TestimonialRow | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return data;
    if (statusFilter === "archived") return data.filter((t) => t.deleted_at);
    if (statusFilter === "draft") return data.filter((t) => !t.deleted_at && !t.published);
    return data.filter((t) => !t.deleted_at && t.published);
  }, [data, statusFilter]);

  function refresh() {
    router.refresh();
  }

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: TestimonialRow) {
    setEditing(row);
    setFormOpen(true);
  }

  async function handleTogglePublished(row: TestimonialRow) {
    const res = await setTestimonialPublished(row.id, !row.published);
    if (!res.success) notify(res.error, "error");
    else refresh();
  }

  function handleArchive() {
    if (!archiveTarget) return;
    setArchiveError(null);
    startTransition(async () => {
      const res = await archiveTestimonial(archiveTarget.id);
      if (res.success) {
        setArchiveTarget(null);
        refresh();
      } else {
        setArchiveError(res.error);
      }
    });
  }

  async function handleRestore(row: TestimonialRow) {
    const res = await restoreTestimonial(row.id);
    if (!res.success) notify(res.error, "error");
    else refresh();
  }

  const columns: Column<TestimonialRow>[] = [
    {
      key: "author_name",
      header: "Author",
      sortable: true,
      render: (value, row) => (
        <div className="flex flex-col">
          <span className="font-medium text-(--color-text)">{String(value)}</span>
          {row.author_role && (
            <span className="text-xs text-(--color-text-subtle)">{row.author_role}</span>
          )}
        </div>
      ),
    },
    {
      key: "quote",
      header: "Quote",
      render: (value) => (
        <span className="line-clamp-2 block max-w-md text-(--color-text-muted)">
          &ldquo;{String(value)}&rdquo;
        </span>
      ),
    },
    {
      key: "rating",
      header: "Rating",
      sortable: true,
      render: (value) =>
        value ? <Stars rating={value as number} /> : <span className="text-(--color-text-subtle)">—</span>,
      exportValue: (value) => (value as number | null) ?? "",
    },
    {
      key: "sort_order",
      header: "Sort",
      sortable: true,
      render: (value) => <span className="tabular-nums">{String(value)}</span>,
    },
    {
      key: "published",
      header: "Status",
      sortable: true,
      render: (value, row) =>
        row.deleted_at ? (
          <Badge variant="neutral">Archived</Badge>
        ) : value ? (
          <Badge variant="success">Live</Badge>
        ) : (
          <Badge variant="warning">Draft</Badge>
        ),
    },
    {
      key: "id",
      header: "Actions",
      render: (_value, row) =>
        row.deleted_at ? (
          <Button variant="ghost" size="sm" onClick={() => handleRestore(row)}>
            Restore
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
              Edit
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleTogglePublished(row)}>
              {row.published ? "Unpublish" : "Publish"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-(--color-danger)"
              onClick={() => {
                setArchiveTarget(row);
                setArchiveError(null);
              }}
            >
              Archive
            </Button>
          </div>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Website Testimonials"
        description="Customer quotes shown on sinagukit.com. Only published testimonials are visible to visitors."
        actions={<Button onClick={openAdd}>Add Testimonial</Button>}
      />

      <div className="flex items-center gap-2">
        <FilterBar
          aria-label="Filter by status"
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={setStatusFilter}
        />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        searchPlaceholder="Search testimonials…"
        emptyMessage="No testimonials found"
        emptyDescription="Add a customer quote to show it on the website."
        exportFilename="website-testimonials"
      />

      <TestimonialForm
        open={formOpen}
        onOpenChange={setFormOpen}
        testimonial={editing}
        onSaved={refresh}
      />

      <Dialog
        open={!!archiveTarget}
        onOpenChange={(next) => {
          if (!next) {
            setArchiveTarget(null);
            setArchiveError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Testimonial</DialogTitle>
            <DialogDescription>
              Archive the quote from {archiveTarget?.author_name}? It disappears from the website
              immediately. You can restore it later.
            </DialogDescription>
          </DialogHeader>
          {archiveError && <p className="text-sm text-(--color-danger)">{archiveError}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" variant="danger" onClick={handleArchive} disabled={isPending}>
              {isPending ? "Archiving…" : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
