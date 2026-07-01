import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default:  "bg-(--color-primary-light) text-(--color-primary)",
        success:  "bg-(--color-success-light) text-(--color-success)",
        warning:  "bg-(--color-warning-light) text-(--color-warning)",
        danger:   "bg-(--color-danger-light) text-(--color-danger)",
        neutral:  "bg-(--color-border) text-(--color-text-muted)",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
