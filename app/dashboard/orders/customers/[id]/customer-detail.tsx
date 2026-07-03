"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { CustomerForm, type EditableCustomer } from "../customer-form";

export type LinkedSource = {
  source: string;
  external_username: string | null;
  profile_url: string | null;
  linked_at: string;
};

export type HistoryEntry = {
  id: string;
  kind: "order" | "receipt";
  label: string;
  status: string | null;
  total: number;
  date: string;
};

type Props = {
  customer: EditableCustomer & { total_visits: number; total_spent: number; total_points: number };
  sources: LinkedSource[];
  history: HistoryEntry[];
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

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "danger" | "neutral"> = {
  quote: "neutral",
  confirmed: "default",
  in_production: "warning",
  completed: "success",
  cancelled: "danger",
};

export function CustomerDetail({ customer, sources, history, canWrite }: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);

  const address = [customer.address_line1, customer.barangay, customer.city, customer.province, customer.postal_code]
    .filter(Boolean)
    .join(", ");

  const historyColumns: Column<HistoryEntry>[] = [
    { key: "label", header: "Reference" },
    {
      key: "status",
      header: "Status",
      render: (value) =>
        value ? (
          <Badge variant={STATUS_VARIANT[value as string] ?? "neutral"}>
            {(value as string).replace("_", " ")}
          </Badge>
        ) : (
          <span className="text-(--color-text-subtle)">—</span>
        ),
    },
    { key: "total", header: "Total", render: (value) => peso(value as number) },
    { key: "date", header: "Date", render: (value) => new Date(value as string).toLocaleDateString() },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={customer.name}
        description="Customer profile, linked accounts, and order history."
        actions={
          <div className="flex gap-2">
            <Link href="/dashboard/orders/customers">
              <Button variant="secondary">Back to Customers</Button>
            </Link>
            {canWrite && <Button onClick={() => setEditOpen(true)}>Edit Customer</Button>}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-(--color-text-muted)">Phone</p>
              <p className="text-sm text-(--color-text)">{customer.phone_number || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-(--color-text-muted)">Email</p>
              <p className="text-sm text-(--color-text)">{customer.email || "—"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-medium text-(--color-text-muted)">Shipping Address</p>
              <p className="text-sm text-(--color-text)">{address || "—"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-medium text-(--color-text-muted)">Note</p>
              <p className="text-sm text-(--color-text)">{customer.note || "—"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Loyalty</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs font-medium text-(--color-text-muted)">Total Visits</p>
              <p className="text-xl font-semibold text-(--color-text)">{customer.total_visits}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-(--color-text-muted)">Total Spent</p>
              <p className="text-xl font-semibold text-(--color-text)">{peso(customer.total_spent)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-(--color-text-muted)">Loyalty Points</p>
              <p className="text-xl font-semibold text-(--color-text)">{customer.total_points}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Linked Accounts</CardTitle>
          <CardDescription>External identities linked to this customer profile.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sources.length === 0 && <p className="text-sm text-(--color-text-subtle)">No linked accounts.</p>}
          {sources.map((s) => (
            <div
              key={`${s.source}-${s.linked_at}`}
              className="flex items-center justify-between border-b border-(--color-border) pb-3 last:border-0 last:pb-0"
            >
              <div>
                <p className="text-sm font-medium text-(--color-text)">{SOURCE_LABEL[s.source] ?? s.source}</p>
                <p className="text-xs text-(--color-text-muted)">
                  {s.external_username ?? "—"} · linked {new Date(s.linked_at).toLocaleDateString()}
                </p>
              </div>
              <Badge variant="success">Linked</Badge>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="text-sm font-medium text-(--color-text)">Facebook</p>
              <p className="text-xs text-(--color-text-muted)">Not connected yet</p>
            </div>
            <Button variant="secondary" size="sm" disabled title="Facebook integration is not built yet">
              Link Facebook
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Order History</CardTitle>
          <CardDescription>All quotes, orders, and POS receipts for this customer.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={historyColumns}
            data={history}
            searchable={false}
            emptyMessage="No order history"
            emptyDescription="This customer has no orders or receipts yet."
          />
        </CardContent>
      </Card>

      {canWrite && (
        <CustomerForm
          open={editOpen}
          onOpenChange={setEditOpen}
          customer={customer}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}
