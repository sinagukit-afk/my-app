"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { FilterBar } from "@/components/business/filter-bar";
import { DateRangeFilter } from "@/components/business/date-range-filter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils/format-date";
import { formatCurrency } from "@/lib/utils/format";
import { platformSourceLabel } from "../platform-source";

export type POType = "inventory" | "asset" | "expense";

export type PurchaseOrderRow = {
  id: string;
  reference: string;
  status: string;
  order_date: string;
  expected_date: string | null;
  total: number;
  supplier_name: string;
  item_count: number;
  platform_source: string | null;
  po_type: POType;
};

type Props = {
  data: PurchaseOrderRow[];
  canWriteInventory: boolean;
  canWriteAsset: boolean;
  canWriteExpense: boolean;
  from: string;
  to: string;
};

const STATUS_VARIANT: Record<string, "neutral" | "success" | "warning" | "danger" | "default"> = {
  draft: "neutral",
  sent: "default",
  partial: "warning",
  received: "success",
  cancelled: "danger",
};

const STATUS_FILTER_OPTIONS = [
  { label: "All Statuses", value: "" },
  { label: "Open (Draft/Sent/Partial)", value: "open" },
  { label: "Draft", value: "draft" },
  { label: "Sent", value: "sent" },
  { label: "Partial", value: "partial" },
  { label: "Received", value: "received" },
  { label: "Cancelled", value: "cancelled" },
];

const OPEN_STATUSES = new Set(["draft", "sent", "partial"]);

const CATEGORY_FILTER_OPTIONS = [
  { label: "All Categories", value: "" },
  { label: "Inventory", value: "inventory" },
  { label: "Asset", value: "asset" },
  { label: "Expense", value: "expense" },
];

const CATEGORY_LABEL: Record<POType, string> = {
  inventory: "Inventory",
  asset: "Asset",
  expense: "Expense",
};

const CATEGORY_VARIANT: Record<POType, "default" | "info" | "warning"> = {
  inventory: "default",
  asset: "info",
  expense: "warning",
};

const CATEGORY_PATH: Record<POType, string> = {
  inventory: "inventory-po",
  asset: "asset-po",
  expense: "expense-po",
};

export function PurchaseOrdersTable({
  data,
  canWriteInventory,
  canWriteAsset,
  canWriteExpense,
  from,
  to,
}: Props) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [newOpen, setNewOpen] = useState(false);

  const filteredData = data.filter((row) => {
    if (categoryFilter && row.po_type !== categoryFilter) return false;
    if (!statusFilter) return true;
    if (statusFilter === "open") return OPEN_STATUSES.has(row.status);
    return row.status === statusFilter;
  });

  const columns: Column<PurchaseOrderRow>[] = [
    { key: "reference", header: "Reference", sortable: true },
    {
      key: "po_type",
      header: "Category",
      sortable: true,
      render: (value) => (
        <Badge variant={CATEGORY_VARIANT[value as POType]}>{CATEGORY_LABEL[value as POType]}</Badge>
      ),
    },
    { key: "supplier_name", header: "Supplier", sortable: true },
    {
      key: "platform_source",
      header: "Platform",
      sortable: true,
      render: (value) => platformSourceLabel(value as string | null),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (value) => (
        <Badge variant={STATUS_VARIANT[value as string] ?? "neutral"}>{String(value)}</Badge>
      ),
    },
    { key: "order_date", header: "Order Date", sortable: true, render: (value) => formatDate(value as string) },
    {
      key: "expected_date",
      header: "Expected",
      render: (value) => (value ? formatDate(value as string) : <span className="text-(--color-text-subtle)">—</span>),
    },
    { key: "item_count", header: "Items" },
    {
      key: "total",
      header: "Total",
      sortable: true,
      render: (value) => formatCurrency(value as number),
    },
  ];

  const canWriteAny = canWriteInventory || canWriteAsset || canWriteExpense;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Purchase Orders"
        description="Create and track orders placed with your suppliers, across inventory, expense, and asset purchases. Click a row to view details."
        actions={canWriteAny ? <Button onClick={() => setNewOpen(true)}>New Purchase Order</Button> : undefined}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <DateRangeFilter from={from} to={to} />
        <div className="flex flex-wrap items-end gap-3">
          <FilterBar
            aria-label="Filter by category"
            options={CATEGORY_FILTER_OPTIONS}
            value={categoryFilter}
            onChange={setCategoryFilter}
          />
          <FilterBar
            aria-label="Filter by status"
            options={STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredData}
        exportFilename="purchase-orders"
        searchPlaceholder="Search purchase orders…"
        emptyMessage="No purchase orders found"
        emptyDescription="Create your first purchase order to get started."
        onRowClick={(row) => router.push(`/dashboard/purchasing/${CATEGORY_PATH[row.po_type]}/${row.reference}`)}
        rowHref={(row) => `/dashboard/purchasing/${CATEGORY_PATH[row.po_type]}/${row.reference}`}
      />

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Purchase Order</DialogTitle>
            <DialogDescription>Choose the type of purchase order to create.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            {canWriteInventory && (
              <Link
                href="/dashboard/purchasing/inventory-po/new"
                onClick={() => setNewOpen(false)}
                className="flex flex-col gap-0.5 rounded-lg border border-(--color-border) p-3 text-left transition-colors hover:bg-(--color-bg) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)"
              >
                <span className="font-medium text-(--color-text)">Inventory Purchase Order</span>
                <span className="text-sm text-(--color-text-muted)">Restock items tracked in inventory.</span>
              </Link>
            )}
            {canWriteExpense && (
              <Link
                href="/dashboard/purchasing/expense-po/new"
                onClick={() => setNewOpen(false)}
                className="flex flex-col gap-0.5 rounded-lg border border-(--color-border) p-3 text-left transition-colors hover:bg-(--color-bg) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)"
              >
                <span className="font-medium text-(--color-text)">Expense Purchase Order</span>
                <span className="text-sm text-(--color-text-muted)">
                  Request approval to purchase an operating expense — routes to Finance → Expenses on receipt.
                </span>
              </Link>
            )}
            {canWriteAsset && (
              <Link
                href="/dashboard/purchasing/asset-po/new"
                onClick={() => setNewOpen(false)}
                className="flex flex-col gap-0.5 rounded-lg border border-(--color-border) p-3 text-left transition-colors hover:bg-(--color-bg) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)"
              >
                <span className="font-medium text-(--color-text)">Asset Purchase Order</span>
                <span className="text-sm text-(--color-text-muted)">
                  Request approval to purchase a fixed asset — routes to Finance → Fixed Assets on receipt.
                </span>
              </Link>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
