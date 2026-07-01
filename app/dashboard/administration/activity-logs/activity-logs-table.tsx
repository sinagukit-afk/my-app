"use client";

import { useEffect, useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getOrderDiffData, type OrderDiffResult } from "./actions";

export type LogRow = {
  id: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

const ACTION_BADGE: Record<string, "default" | "success" | "warning" | "danger" | "neutral"> = {
  login:           "neutral",
  logout:          "neutral",
  create_receipt:  "success",
  add_incoming:    "success",
  create_item:     "success",
  create_category: "success",
  update_item:     "warning",
  view_report:     "default",
  quote_edited:    "warning",
};

function formatAction(action: string): string {
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const COLUMNS: Column<LogRow>[] = [
  {
    key: "user_name",
    header: "User",
    sortable: true,
    render: (value) => (
      <span className="font-medium text-(--color-text)">{(value as string) || "System"}</span>
    ),
  },
  {
    key: "action",
    header: "Action",
    sortable: true,
    render: (value) => (
      <Badge variant={ACTION_BADGE[value as string] ?? "neutral"}>
        {formatAction(value as string)}
      </Badge>
    ),
  },
  {
    key: "description",
    header: "Description",
    render: (value) => (
      <span className="text-sm text-(--color-text-muted)">{(value as string) || "—"}</span>
    ),
  },
  {
    key: "entity_type",
    header: "Entity",
    sortable: true,
    render: (value) =>
      value ? (
        <span className="rounded bg-(--color-border) px-2 py-0.5 text-xs font-mono text-(--color-text-muted)">
          {String(value)}
        </span>
      ) : (
        <span className="text-(--color-text-subtle)">—</span>
      ),
  },
  {
    key: "created_at",
    header: "Time",
    sortable: true,
    render: (value) => (
      <span className="whitespace-nowrap text-xs text-(--color-text-muted)">
        {formatTimestamp(value as string)}
      </span>
    ),
  },
];

type PreviousOrder = {
  customer_id: string | null;
  note: string | null;
  subtotal: number;
  total_discount: number;
  total_money: number;
};

type PreviousItem = {
  item_name_snapshot: string | null;
  sku_snapshot: string | null;
  quantity: number;
  unit_price: number;
  line_discount: number;
};

function money(v: number | null | undefined) {
  return v == null ? "—" : `₱${v.toFixed(2)}`;
}

function ItemsTable({ items }: { items: PreviousItem[] }) {
  if (items.length === 0) return <p className="text-xs text-(--color-text-subtle)">No line items.</p>;
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-(--color-text-muted)">
          <th className="py-1 pr-2 text-left font-medium">Item</th>
          <th className="py-1 pr-2 text-right font-medium">Qty</th>
          <th className="py-1 pr-2 text-right font-medium">Price</th>
          <th className="py-1 text-right font-medium">Discount</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr key={i} className="border-t border-(--color-border)">
            <td className="py-1 pr-2 text-(--color-text)">{item.item_name_snapshot ?? item.sku_snapshot ?? "—"}</td>
            <td className="py-1 pr-2 text-right text-(--color-text)">{item.quantity}</td>
            <td className="py-1 pr-2 text-right text-(--color-text)">{money(item.unit_price)}</td>
            <td className="py-1 text-right text-(--color-text)">{money(item.line_discount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function QuoteEditDiff({ log }: { log: LogRow }) {
  const [diff, setDiff] = useState<OrderDiffResult | null>(null);
  const [loading, setLoading] = useState(true);

  const previousOrder = log.metadata?.previous_order as PreviousOrder | undefined;
  const previousItems = (log.metadata?.previous_items as PreviousItem[] | undefined) ?? [];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getOrderDiffData(log.entity_id, previousOrder?.customer_id ?? null).then((result) => {
      if (!cancelled) {
        setDiff(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log.id]);

  if (!previousOrder) return null;

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
          Order Header
        </p>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-(--color-text-muted)">
              <th className="py-1 pr-2 text-left font-medium">Field</th>
              <th className="py-1 pr-2 text-left font-medium">Before Edit</th>
              <th className="py-1 text-left font-medium">Current</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-(--color-border)">
              <td className="py-1 pr-2 font-medium text-(--color-text-muted)">Customer</td>
              <td className="py-1 pr-2 text-(--color-text)">
                {loading ? "…" : diff?.previousCustomerName ?? "—"}
              </td>
              <td className="py-1 text-(--color-text)">
                {loading ? "…" : diff?.current.customer_name ?? "—"}
              </td>
            </tr>
            <tr className="border-t border-(--color-border)">
              <td className="py-1 pr-2 font-medium text-(--color-text-muted)">Note</td>
              <td className="py-1 pr-2 text-(--color-text)">{previousOrder.note ?? "—"}</td>
              <td className="py-1 text-(--color-text)">{loading ? "…" : diff?.current.note ?? "—"}</td>
            </tr>
            <tr className="border-t border-(--color-border)">
              <td className="py-1 pr-2 font-medium text-(--color-text-muted)">Subtotal</td>
              <td className="py-1 pr-2 text-(--color-text)">{money(previousOrder.subtotal)}</td>
              <td className="py-1 text-(--color-text)">{loading ? "…" : money(diff?.current.subtotal)}</td>
            </tr>
            <tr className="border-t border-(--color-border)">
              <td className="py-1 pr-2 font-medium text-(--color-text-muted)">Discount</td>
              <td className="py-1 pr-2 text-(--color-text)">{money(previousOrder.total_discount)}</td>
              <td className="py-1 text-(--color-text)">
                {loading ? "…" : money(diff?.current.total_discount)}
              </td>
            </tr>
            <tr className="border-t border-(--color-border)">
              <td className="py-1 pr-2 font-medium text-(--color-text-muted)">Total</td>
              <td className="py-1 pr-2 text-(--color-text)">{money(previousOrder.total_money)}</td>
              <td className="py-1 text-(--color-text)">{loading ? "…" : money(diff?.current.total_money)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
            Line Items — Before Edit
          </p>
          <ItemsTable items={previousItems} />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
            Line Items — Current
          </p>
          {loading ? (
            <p className="text-xs text-(--color-text-subtle)">Loading…</p>
          ) : (
            <ItemsTable items={diff?.current.items ?? []} />
          )}
        </div>
      </div>
    </div>
  );
}

function LogDetailDialog({ log, onOpenChange }: { log: LogRow | null; onOpenChange: (open: boolean) => void }) {
  const isQuoteEdit = log?.action === "quote_edited";

  return (
    <Dialog open={Boolean(log)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{log ? formatAction(log.action) : ""}</DialogTitle>
          <DialogDescription>
            {log ? `${log.user_name} — ${formatTimestamp(log.created_at)}` : ""}
          </DialogDescription>
        </DialogHeader>

        {log && (
          <div className="max-h-[60vh] space-y-4 overflow-y-auto text-sm">
            {log.description && <p className="text-(--color-text)">{log.description}</p>}

            {log.entity_type && (
              <p className="text-xs text-(--color-text-muted)">
                Entity: <span className="font-mono">{log.entity_type}</span>
                {log.entity_id && <> #{log.entity_id}</>}
              </p>
            )}

            {isQuoteEdit && log.entity_id ? (
              <QuoteEditDiff log={log} />
            ) : (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
                  Metadata
                </p>
                <pre className="overflow-x-auto rounded-md bg-(--color-bg) p-3 text-xs text-(--color-text-muted)">
                  {JSON.stringify(log.metadata ?? {}, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ActivityLogsTable({ data }: { data: LogRow[] }) {
  const [actionFilter, setActionFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<LogRow | null>(null);

  const actionOptions = useMemo(
    () => [
      { value: "", label: "All actions" },
      ...Array.from(new Set(data.map((l) => l.action))).sort().map((a) => ({ value: a, label: formatAction(a) })),
    ],
    [data]
  );
  const actorOptions = useMemo(
    () => [
      { value: "", label: "All users" },
      ...Array.from(new Set(data.map((l) => l.user_name))).sort().map((u) => ({ value: u, label: u })),
    ],
    [data]
  );

  const filtered = useMemo(() => {
    return data.filter((l) => {
      if (actionFilter && l.action !== actionFilter) return false;
      if (actorFilter && l.user_name !== actorFilter) return false;
      const ts = new Date(l.created_at);
      if (dateFrom && ts < new Date(dateFrom)) return false;
      if (dateTo && ts > new Date(`${dateTo}T23:59:59`)) return false;
      return true;
    });
  }, [data, actionFilter, actorFilter, dateFrom, dateTo]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Select
          label="Action"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          options={actionOptions}
        />
        <Select
          label="User"
          value={actorFilter}
          onChange={(e) => setActorFilter(e.target.value)}
          options={actorOptions}
        />
        <Input label="From" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <Input label="To" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </div>

      <DataTable
        columns={COLUMNS}
        data={filtered}
        pageSize={15}
        searchPlaceholder="Search by user, action, or description…"
        emptyMessage="No activity logs"
        emptyDescription="No user actions match the current filters."
        onRowClick={setSelected}
      />

      <LogDetailDialog log={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}
