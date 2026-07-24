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
import { FaqForm } from "./faq-form";
import { archiveFaq, restoreFaq, setFaqPublished } from "./actions";

export type FaqRow = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  sort_order: number;
  published: boolean;
  deleted_at: string | null;
};

type Props = {
  data: FaqRow[];
  categories: string[];
};

const STATUS_OPTIONS = [
  { label: "Live on website", value: "published" },
  { label: "Draft (unpublished)", value: "draft" },
  { label: "Archived", value: "archived" },
  { label: "All statuses", value: "all" },
];

export function FaqsTable({ data, categories }: Props) {
  const router = useRouter();
  const { notify } = useNotifications();
  const [isPending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState("published");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FaqRow | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<FaqRow | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const categoryOptions = useMemo(
    () => [
      { label: "All categories", value: "all" },
      ...categories.map((category) => ({ label: category, value: category })),
    ],
    [categories]
  );

  const filtered = useMemo(() => {
    let rows = data;
    if (statusFilter === "archived") rows = rows.filter((f) => f.deleted_at);
    else if (statusFilter === "draft") rows = rows.filter((f) => !f.deleted_at && !f.published);
    else if (statusFilter === "published") rows = rows.filter((f) => !f.deleted_at && f.published);
    if (categoryFilter !== "all") rows = rows.filter((f) => f.category === categoryFilter);
    return rows;
  }, [data, statusFilter, categoryFilter]);

  function refresh() {
    router.refresh();
  }

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: FaqRow) {
    setEditing(row);
    setFormOpen(true);
  }

  async function handleTogglePublished(row: FaqRow) {
    const res = await setFaqPublished(row.id, !row.published);
    if (!res.success) notify(res.error, "error");
    else refresh();
  }

  function handleArchive() {
    if (!archiveTarget) return;
    setArchiveError(null);
    startTransition(async () => {
      const res = await archiveFaq(archiveTarget.id);
      if (res.success) {
        setArchiveTarget(null);
        refresh();
      } else {
        setArchiveError(res.error);
      }
    });
  }

  async function handleRestore(row: FaqRow) {
    const res = await restoreFaq(row.id);
    if (!res.success) notify(res.error, "error");
    else refresh();
  }

  const columns: Column<FaqRow>[] = [
    {
      key: "question",
      header: "Question",
      sortable: true,
      render: (value, row) => (
        <div className="flex max-w-md flex-col">
          <span className="font-medium text-(--color-text)">{String(value)}</span>
          <span className="line-clamp-2 text-xs text-(--color-text-subtle)">{row.answer}</span>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      sortable: true,
      render: (value) =>
        value ? (
          <Badge variant="neutral">{String(value)}</Badge>
        ) : (
          <span className="text-(--color-text-subtle)">Uncategorized</span>
        ),
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
        title="Website FAQs"
        description="Questions and answers shown on the sinagukit.com FAQ page, grouped by category and ordered by sort value."
        actions={<Button onClick={openAdd}>Add FAQ</Button>}
      />

      <div className="flex flex-wrap items-center gap-2">
        <FilterBar
          aria-label="Filter by status"
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={setStatusFilter}
        />
        <FilterBar
          aria-label="Filter by category"
          options={categoryOptions}
          value={categoryFilter}
          onChange={setCategoryFilter}
        />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        searchPlaceholder="Search questions and answers…"
        emptyMessage="No FAQs found"
        emptyDescription="Add a question to show it on the website FAQ page."
        exportFilename="website-faqs"
      />

      <FaqForm
        open={formOpen}
        onOpenChange={setFormOpen}
        faq={editing}
        categories={categories}
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
            <DialogTitle>Archive FAQ</DialogTitle>
            <DialogDescription>
              Archive &quot;{archiveTarget?.question}&quot;? It disappears from the website FAQ page
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
