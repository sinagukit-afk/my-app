"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { FilterBar } from "@/components/business/filter-bar";
import { DateRangeFilter } from "@/components/business/date-range-filter";
import { formatDate } from "@/lib/utils/format-date";
import { formatCurrency } from "@/lib/utils/format";

export type SupplierPayableType = "inventory_po" | "manual_incoming" | "expense_po" | "direct_expense" | "asset_po";

export type SupplierPayableRow = {
  key: string;
  type: SupplierPayableType;
  reference: string;
  supplier_name: string | null;
  date: string;
  total: number;
  paid: number;
  remaining: number;
  payment_status: "unpaid" | "partial" | "paid";
  detail_href: string;
};

const TYPE_LABEL: Record<SupplierPayableType, string> = {
  inventory_po: "Inventory PO",
  manual_incoming: "Manual Incoming",
  expense_po: "Expense PO",
  direct_expense: "Direct Expense",
  asset_po: "Asset PO",
};

const PAYMENT_STATUS_VARIANT: Record<SupplierPayableRow["payment_status"], "danger" | "warning" | "success"> = {
  unpaid: "danger",
  partial: "warning",
  paid: "success",
};

const TYPE_FILTER_OPTIONS = [
  { label: "All Types", value: "" },
  { label: "Inventory PO", value: "inventory_po" },
  { label: "Expense PO", value: "expense_po" },
  { label: "Asset PO", value: "asset_po" },
  { label: "Manual Incoming", value: "manual_incoming" },
  { label: "Direct Expense", value: "direct_expense" },
];

const PAYMENT_STATUS_FILTER_OPTIONS = [
  { label: "Open (Unpaid + Partial)", value: "open" },
  { label: "All Statuses", value: "" },
  { label: "Unpaid", value: "unpaid" },
  { label: "Partial", value: "partial" },
  { label: "Paid", value: "paid" },
];

type Props = {
  data: SupplierPayableRow[];
  from: string;
  to: string;
};

export function SupplierPaymentTable({ data, from, to }: Props) {
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");

  const supplierOptions = [
    { label: "All Suppliers", value: "" },
    ...[...new Set(data.map((row) => row.supplier_name).filter((n): n is string => !!n))]
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ label: name, value: name })),
  ];

  const typeFiltered = data
    .filter((row) => !typeFilter || row.type === typeFilter)
    .filter((row) => !supplierFilter || row.supplier_name === supplierFilter);

  const filteredData = typeFiltered.filter((row) => {
    if (!statusFilter) return true;
    if (statusFilter === "open") return row.payment_status !== "paid";
    return row.payment_status === statusFilter;
  });

  // Headline numbers ignore the status filter on purpose — "what do we owe" shouldn't
  // change when the user peeks at paid history.
  const openRows = typeFiltered.filter((row) => row.payment_status !== "paid");
  const outstanding = openRows.reduce((sum, row) => sum + row.remaining, 0);
  const unpaidCount = openRows.filter((row) => row.payment_status === "unpaid").length;
  const partialCount = openRows.length - unpaidCount;

  const columns: Column<SupplierPayableRow>[] = [
    { key: "reference", header: "Reference", sortable: true },
    {
      key: "type",
      header: "Type",
      sortable: true,
      render: (value) => <Badge variant="neutral">{TYPE_LABEL[value as SupplierPayableType]}</Badge>,
      exportValue: (value) => TYPE_LABEL[value as SupplierPayableType],
    },
    {
      key: "supplier_name",
      header: "Supplier",
      sortable: true,
      render: (value) => (value as string) || <span className="text-(--color-text-subtle)">—</span>,
    },
    {
      key: "date",
      header: "Date",
      sortable: true,
      render: (value) => formatDate(value as string),
    },
    { key: "total", header: "Total", sortable: true, render: (value) => formatCurrency(value as number) },
    { key: "paid", header: "Paid", sortable: true, render: (value) => formatCurrency(value as number) },
    { key: "remaining", header: "Remaining", sortable: true, render: (value) => formatCurrency(value as number) },
    {
      key: "payment_status",
      header: "Payment Status",
      sortable: true,
      render: (value) => (
        <Badge variant={PAYMENT_STATUS_VARIANT[value as SupplierPayableRow["payment_status"]]}>
          {(value as string).charAt(0).toUpperCase() + (value as string).slice(1)}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Supplier Payment"
        description="Inventory PO, Expense PO, Asset PO, and Manual Incoming payables. Click a row to record or review payments."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-(--color-text-muted)">Outstanding Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold text-(--color-text)">{formatCurrency(outstanding)}</p>
            <p className="text-xs text-(--color-text-muted)">
              {openRows.length} open payable{openRows.length !== 1 ? "s" : ""}
              {from || to ? " in the selected date range" : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-(--color-text-muted)">Unpaid</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold text-(--color-text)">{unpaidCount}</p>
            <p className="text-xs text-(--color-text-muted)">no payment logged yet</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-(--color-text-muted)">Partially Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold text-(--color-text)">{partialCount}</p>
            <p className="text-xs text-(--color-text-muted)">balance still owed</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <DateRangeFilter from={from} to={to} />
        <div className="flex flex-wrap items-center gap-2">
          <FilterBar
            aria-label="Filter by supplier"
            options={supplierOptions}
            value={supplierFilter}
            onChange={setSupplierFilter}
          />
          <FilterBar
            aria-label="Filter by type"
            options={TYPE_FILTER_OPTIONS}
            value={typeFilter}
            onChange={setTypeFilter}
          />
          <FilterBar
            aria-label="Filter by payment status"
            options={PAYMENT_STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredData}
        exportFilename="supplier-payables"
        searchPlaceholder="Search supplier payables…"
        emptyMessage="No supplier payables to display"
        emptyDescription="Inventory receipts, expense/asset POs, and manual incoming logs will appear here."
        onRowClick={(row) => router.push(row.detail_href)}
        rowHref={(row) => row.detail_href}
      />
    </div>
  );
}
