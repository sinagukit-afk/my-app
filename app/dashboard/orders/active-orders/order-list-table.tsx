"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, downloadCsv, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { FilterBar } from "@/components/business/filter-bar";
import { DateRangeFilter } from "@/components/business/date-range-filter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { DATE_RANGE_PRESETS } from "@/lib/utils/date-range-presets";
import { formatDate } from "@/lib/utils/format-date";
import { exportOrders } from "./actions";

export type OrderRow = {
  orderNumber: string;
  customerName: string | null;
  orderDate: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  totalItems: number;
  totalMoney: number;
  paymentStatus: "Unpaid" | "Partially Paid" | "Paid" | "Overpaid";
  lastActivity: string;
};

const STATUS_VARIANT: Record<string, "success" | "default" | "danger" | "warning" | "neutral"> = {
  confirmed: "default",
  in_production: "warning",
  partially_completed: "warning",
  production_completed: "success",
  ready_for_shipping: "default",
  shipped: "default",
  delivered: "success",
  on_hold: "neutral",
  cancelled: "danger",
};

const STATUS_FILTER_OPTIONS = [
  { label: "All", value: "" },
  { label: "Confirmed", value: "confirmed" },
  { label: "In Production", value: "in_production" },
  { label: "Partially Completed", value: "partially_completed" },
  { label: "Production Completed", value: "production_completed" },
  { label: "Ready for Shipping", value: "ready_for_shipping" },
  { label: "Shipped", value: "shipped" },
  { label: "Delivered", value: "delivered" },
  { label: "On Hold", value: "on_hold" },
  { label: "Cancelled", value: "cancelled" },
];

const PAYMENT_STATUS_VARIANT: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  Unpaid: "danger",
  "Partially Paid": "warning",
  Paid: "success",
  Overpaid: "neutral",
};

function peso(n: number) {
  return `₱${n.toFixed(2)}`;
}

const EXPORT_SCOPES = ["Current Filter", ...DATE_RANGE_PRESETS.map((p) => p.label)];

const EXPORT_SCOPE_DESCRIPTIONS: Record<string, string> = {
  "Current Filter": "Exactly what's on screen now — current date range and status filter.",
  "This Month": "All orders this month, every status.",
  "Last Month": "All orders last month, every status.",
  "This Year": "All orders this year, every status.",
  "All Time": "Every order ever placed, every status.",
};

function exportSlug(scope: string) {
  return scope.toLowerCase().replace(/\s+/g, "-");
}

type Props = {
  data: OrderRow[];
  canCreate: boolean;
  from: string;
  to: string;
};

export function OrderListTable({ data, canCreate, from, to }: Props) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportScope, setExportScope] = useState(EXPORT_SCOPES[0]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const filteredData = statusFilter ? data.filter((row) => row.status === statusFilter) : data;

  const columns: Column<OrderRow>[] = [
    {
      key: "orderNumber",
      header: "Order No.",
      sortable: true,
    },
    {
      key: "customerName",
      header: "Customer",
      sortable: true,
      render: (value) =>
        (value as string) || <span className="text-(--color-text-subtle)">Walk-in</span>,
      exportValue: (value) => (value as string) || "Walk-in",
    },
    {
      key: "orderDate",
      header: "Order Date",
      sortable: true,
      render: (value) => formatDate(value as string),
      exportValue: (value) => formatDate(value as string),
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      render: (value) => formatDate(value as string),
      exportValue: (value) => formatDate(value as string),
    },
    {
      key: "updatedAt",
      header: "Modified",
      sortable: true,
      render: (value) => formatDate(value as string),
      exportValue: (value) => formatDate(value as string),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (value) => (
        <Badge variant={STATUS_VARIANT[value as string] ?? "neutral"}>
          {(value as string).replace(/_/g, " ")}
        </Badge>
      ),
      exportValue: (value) => (value as string).replace(/_/g, " "),
    },
    {
      key: "totalItems",
      header: "Total Items",
      sortable: true,
    },
    {
      key: "totalMoney",
      header: "Order Total",
      sortable: true,
      render: (value) => peso(value as number),
    },
    {
      key: "paymentStatus",
      header: "Payment Status",
      sortable: true,
      render: (value) => (
        <Badge variant={PAYMENT_STATUS_VARIANT[value as string] ?? "neutral"}>{value as string}</Badge>
      ),
    },
    {
      key: "lastActivity",
      header: "Last Activity",
    },
  ];

  async function handleExport() {
    setExportError(null);
    setIsExporting(true);
    try {
      if (exportScope === "Current Filter") {
        downloadCsv(
          filteredData,
          columns,
          `active-orders_${exportSlug(exportScope)}${from ? `_${from}` : ""}${to ? `_to_${to}` : ""}`
        );
      } else {
        const preset = DATE_RANGE_PRESETS.find((p) => p.label === exportScope);
        const range = preset ? preset.getRange() : { from: "", to: "" };
        const { rows, error } = await exportOrders(range.from, range.to);
        if (error) {
          setExportError(error);
          return;
        }
        downloadCsv(rows, columns, `active-orders_${exportSlug(exportScope)}`);
      }
      setExportOpen(false);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Active Orders"
        description="Customer orders. Click a row to view details, edit, or move it into production."
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setExportError(null);
                setExportOpen(true);
              }}
            >
              Export to Excel
            </Button>
            {canCreate && (
              <Link href="/dashboard/orders/active-orders/new">
                <Button>New Order</Button>
              </Link>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <DateRangeFilter from={from} to={to} />
        <FilterBar options={STATUS_FILTER_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
      </div>

      <DataTable
        columns={columns}
        data={filteredData}
        searchPlaceholder="Search orders…"
        emptyMessage="No orders found"
        emptyDescription="Confirmed quotes will appear here."
        onRowClick={(row) => router.push(`/dashboard/orders/active-orders/${row.orderNumber}`)}
      />

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Orders</DialogTitle>
            <DialogDescription>Choose which orders to include in the exported file.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            {EXPORT_SCOPES.map((scope) => (
              <label
                key={scope}
                className="flex items-start gap-2.5 rounded-md border border-(--color-border) p-3 cursor-pointer transition-colors hover:bg-(--color-bg) has-[:checked]:border-(--color-primary)"
              >
                <input
                  type="radio"
                  name="export-scope"
                  value={scope}
                  checked={exportScope === scope}
                  onChange={() => setExportScope(scope)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-(--color-primary)"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-(--color-text)">{scope}</span>
                  <span className="text-xs text-(--color-text-muted)">{EXPORT_SCOPE_DESCRIPTIONS[scope]}</span>
                </div>
              </label>
            ))}
          </div>
          {exportError && <p className="text-sm text-(--color-danger)">Failed to export: {exportError}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" onClick={handleExport} disabled={isExporting}>
              {isExporting ? "Exporting…" : "Export"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
