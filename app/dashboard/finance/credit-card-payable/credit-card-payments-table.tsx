"use client";

import { DataTable, type Column } from "@/components/ui/data-table";
import { formatDate } from "@/lib/utils/format-date";

export type PaymentRow = {
  id: string;
  paid_date: string;
  payment_type_name: string;
  principal_amount: number;
  interest_amount: number;
  notes: string | null;
};

function peso(n: number) {
  return `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const columns: Column<PaymentRow>[] = [
  {
    key: "paid_date",
    header: "Date",
    sortable: true,
    render: (value) => formatDate(value as string),
  },
  {
    key: "payment_type_name",
    header: "Paid From",
    sortable: true,
  },
  {
    key: "principal_amount",
    header: "Principal",
    sortable: true,
    render: (value) => <span className="text-(--color-text)">{peso(value as number)}</span>,
  },
  {
    key: "interest_amount",
    header: "Interest",
    sortable: true,
    render: (value) =>
      Number(value) > 0 ? <span className="text-(--color-text)">{peso(value as number)}</span> : "—",
  },
  {
    key: "notes",
    header: "Notes",
    className: "max-w-md truncate",
    render: (value) => (value as string) || "—",
  },
];

type Props = {
  data: PaymentRow[];
};

export function CreditCardPaymentsTable({ data }: Props) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Search payments…"
      emptyMessage="No installment payments logged yet"
      emptyDescription="Log a payment once a credit card purchase has posted a balance."
    />
  );
}
