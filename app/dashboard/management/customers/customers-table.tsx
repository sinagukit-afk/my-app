"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { CustomerForm } from "./customer-form";
import { formatDate } from "@/lib/utils/format-date";

export type CustomerSource = {
  source: string;
  external_username: string | null;
  linked_at: string;
};

export type CustomerRow = {
  id: string;
  name: string;
  phone_number: string | null;
  email: string | null;
  totalVisits: number;
  totalSpent: number;
  lastOrderDate: string | null;
  sources: CustomerSource[];
};

type Props = {
  data: CustomerRow[];
  canWrite: boolean;
};

const SOURCE_LABEL: Record<string, string> = {
  loyverse: "Loyverse",
  facebook: "Facebook",
  instagram: "Instagram",
  manual: "Manual",
  walkin: "Walk-in",
};

function peso(n: number) {
  return `₱${n.toFixed(2)}`;
}

function SourceBadges({ sources }: { sources: CustomerSource[] }) {
  const present = new Set(sources.map((s) => s.source));
  return (
    <div className="flex flex-wrap gap-1">
      {(["loyverse", "facebook", "instagram", "manual"] as const).map((key) => (
        <Badge key={key} variant={present.has(key) ? "success" : "neutral"}>
          {SOURCE_LABEL[key]} {present.has(key) ? "✓" : "—"}
        </Badge>
      ))}
    </div>
  );
}

export function CustomersTable({ data, canWrite }: Props) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [sourceFilter, setSourceFilter] = useState("");

  function refresh() {
    router.refresh();
  }

  const filtered = useMemo(() => {
    if (!sourceFilter) return data;
    return data.filter((row) => row.sources.some((s) => s.source === sourceFilter));
  }, [data, sourceFilter]);

  const columns: Column<CustomerRow>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      render: (value) => (
        <span className="font-medium text-(--color-text)">{String(value)}</span>
      ),
    },
    {
      key: "phone_number",
      header: "Phone",
      render: (value) => (value as string) || <span className="text-(--color-text-subtle)">—</span>,
    },
    {
      key: "email",
      header: "Email",
      render: (value) => (value as string) || <span className="text-(--color-text-subtle)">—</span>,
    },
    {
      key: "sources",
      header: "Sources",
      render: (value) => <SourceBadges sources={value as CustomerSource[]} />,
    },
    {
      key: "totalVisits",
      header: "Total Visits",
      sortable: true,
      render: (value) => String(value),
    },
    {
      key: "totalSpent",
      header: "Total Spent",
      sortable: true,
      render: (value) => peso(value as number),
    },
    {
      key: "lastOrderDate",
      header: "Last Order",
      sortable: true,
      render: (value) =>
        value ? formatDate(value as string) : <span className="text-(--color-text-subtle)">—</span>,
    },
    {
      key: "id",
      header: "",
      render: (_value, row) => (
        <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/management/customers/${row.id}`)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customers"
        description="Browse customer profiles, linked accounts, and order history."
        actions={canWrite ? <Button onClick={() => setFormOpen(true)}>Add Customer</Button> : undefined}
      />

      <div className="max-w-xs">
        <Select
          placeholder="All sources"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          options={[
            { value: "loyverse", label: "Loyverse" },
            { value: "facebook", label: "Facebook" },
            { value: "instagram", label: "Instagram" },
            { value: "manual", label: "Manual" },
            { value: "walkin", label: "Walk-in" },
          ]}
        />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(row) => router.push(`/dashboard/management/customers/${row.id}`)}
        searchPlaceholder="Search customers…"
        emptyMessage="No customers found"
        emptyDescription="Add a customer to get started."
      />

      {canWrite && <CustomerForm open={formOpen} onOpenChange={setFormOpen} onSaved={refresh} />}
    </div>
  );
}
