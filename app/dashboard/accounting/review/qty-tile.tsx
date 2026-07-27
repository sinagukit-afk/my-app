import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

// Compact stat tile, same format as Customer Payment's QtyTile
// (app/dashboard/finance/payments/qty-tile.tsx) — leave `variant` unset for an
// uncolored value. When `onClick` is set, the tile renders as a toggleable filter
// button — `active` rings it to show the table below is currently scoped to this tile's slice.
export function QtyTile({
  label,
  value,
  variant,
  onClick,
  active,
}: {
  label: string;
  value: string;
  variant?: BadgeProps["variant"];
  onClick?: () => void;
  active?: boolean;
}) {
  const content = (
    <>
      <p className="text-xs text-(--color-text-muted)">{label}</p>
      {variant ? (
        <Badge variant={variant} className="mt-1 text-sm">{value}</Badge>
      ) : (
        <p className="mt-1 text-sm font-semibold text-(--color-text)">{value}</p>
      )}
    </>
  );

  if (!onClick) {
    return (
      <div className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2">{content}</div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-lg border bg-(--color-surface) px-3 py-2 text-left transition-colors hover:bg-(--color-bg)",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary) focus-visible:ring-offset-1",
        active ? "border-(--color-primary) ring-1 ring-(--color-primary)" : "border-(--color-border)"
      )}
    >
      {content}
    </button>
  );
}
