import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-16 text-center", className)}>
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[--color-bg] text-[--color-text-subtle] text-2xl">
          {icon}
        </div>
      )}
      <div className="max-w-[320px] space-y-1">
        <p className="text-sm font-semibold text-[--color-text]">{title}</p>
        {description && (
          <p className="text-xs text-[--color-text-muted]">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
