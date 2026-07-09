import { Badge, type BadgeProps } from "@/components/ui/badge";

// Compact stat tile colored to match the badge variant a related quantity/status
// uses elsewhere on Inventory Monitoring (inventory-monitoring-table.tsx's per-column
// badges, STATUS_BADGE's low/out colors) — leave `variant` unset for an uncolored value,
// matching columns (On Hand/Projected) that render as plain bold text, not a badge.
export function QtyTile({ label, value, variant }: { label: string; value: string; variant?: BadgeProps["variant"] }) {
  return (
    <div className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2">
      <p className="text-xs text-(--color-text-muted)">{label}</p>
      {variant ? (
        <Badge variant={variant} className="mt-1 text-sm">{value}</Badge>
      ) : (
        <p className="mt-1 text-sm font-semibold text-(--color-text)">{value}</p>
      )}
    </div>
  );
}
