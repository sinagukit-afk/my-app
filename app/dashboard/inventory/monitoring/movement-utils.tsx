import { Badge } from "@/components/ui/badge";
import type { Column } from "@/components/ui/data-table";

export function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export type MovementRow = {
  id: string;
  movement_type: string;
  status: string;
  quantity_change: number;
  quantity_before: number | null;
  quantity_after: number | null;
  counterpart_status: string | null;
  note: string | null;
  occurred_at: string;
  item_name: string;
  variant_label: string | null;
  store_name: string;
};

export const MOVEMENT_SELECT =
  `id, movement_type, status, quantity_change, quantity_before, quantity_after, counterpart_status, note, occurred_at,
   item_variants(sku, option1_value, items(name)), stores(name)`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapMovementRow(m: any): MovementRow {
  const variant = firstOf(m.item_variants);
  const item = variant ? firstOf(variant.items) : null;
  const store = firstOf(m.stores);
  return {
    id: m.id,
    movement_type: m.movement_type,
    status: m.status,
    quantity_change: m.quantity_change,
    quantity_before: m.quantity_before,
    quantity_after: m.quantity_after,
    counterpart_status: m.counterpart_status,
    note: m.note,
    occurred_at: m.occurred_at,
    item_name: item?.name ?? "Unknown item",
    variant_label: variant?.option1_value ?? variant?.sku ?? null,
    store_name: store?.name ?? "—",
  };
}

const TYPE_BADGE: Record<string, "default" | "success" | "warning" | "danger" | "neutral" | "info"> = {
  initial_sync: "neutral",
  incoming: "success",
  sale: "default",
  adjustment: "warning",
  manual_adjustment: "warning",
  order: "default",
  status_transfer: "info",
  status_adjustment: "neutral",
};

export const TYPE_LABEL: Record<string, string> = {
  initial_sync: "Initial Sync",
  incoming: "Incoming",
  sale: "Sale",
  adjustment: "Adjustment",
  manual_adjustment: "Manual Adjustment",
  order: "Order",
  status_transfer: "Status Transfer",
  status_adjustment: "Status Adjustment",
};

const STATUS_BADGE: Record<string, "default" | "success" | "warning" | "danger" | "neutral" | "info"> = {
  available: "success",
  reserved: "info",
  in_production: "default",
  on_hold: "warning",
  incoming: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  available: "Available",
  reserved: "Reserved",
  in_production: "In Production",
  on_hold: "On Hold",
  incoming: "Incoming",
};

export function movementColumns(): Column<MovementRow>[] {
  return [
    {
      key: "occurred_at",
      header: "Date",
      sortable: true,
      render: (value) =>
        new Date(value as string).toLocaleString("en-PH", {
          dateStyle: "medium",
          timeStyle: "short",
        }),
    },
    {
      key: "item_name",
      header: "Item",
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-(--color-text)">{String(value)}</p>
          {row.variant_label && (
            <p className="text-xs text-(--color-text-muted)">{row.variant_label}</p>
          )}
        </div>
      ),
    },
    {
      key: "store_name",
      header: "Store",
    },
    {
      key: "movement_type",
      header: "Type",
      sortable: true,
      render: (value) => (
        <Badge variant={TYPE_BADGE[value as string] ?? "neutral"}>
          {TYPE_LABEL[value as string] ?? String(value)}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (value, row) => {
        const status = value as string;
        const direction =
          row.counterpart_status && row.quantity_change > 0
            ? `from ${STATUS_LABEL[row.counterpart_status] ?? row.counterpart_status}`
            : row.counterpart_status && row.quantity_change < 0
              ? `to ${STATUS_LABEL[row.counterpart_status] ?? row.counterpart_status}`
              : null;
        return (
          <div>
            <Badge variant={STATUS_BADGE[status] ?? "neutral"}>{STATUS_LABEL[status] ?? status}</Badge>
            {direction && <p className="mt-1 text-xs text-(--color-text-muted)">({direction})</p>}
          </div>
        );
      },
    },
    {
      key: "quantity_change",
      header: "Change",
      sortable: true,
      render: (value) => {
        const v = Number(value);
        return (
          <span className={v >= 0 ? "text-(--color-success)" : "text-(--color-danger)"}>
            {v > 0 ? `+${v}` : v}
          </span>
        );
      },
    },
    {
      key: "quantity_after",
      header: "Before → After",
      render: (value, row) =>
        row.quantity_before === null || value === null ? (
          "—"
        ) : (
          <span>
            {row.quantity_before} → {value as number}
          </span>
        ),
    },
    {
      key: "note",
      header: "Note",
      className: "max-w-xs truncate",
      render: (value) => (value as string) || <span className="text-(--color-text-subtle)">—</span>,
    },
  ];
}
