import * as React from "react";
import { cn } from "@/lib/utils/cn";

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

function PageHeader({ title, description, actions, className, ...props }: PageHeaderProps) {
  return (
    <div
      className={cn("flex items-start justify-between gap-4 pb-6", className)}
      {...props}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-[--color-text] truncate">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-[--color-text-muted]">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export { PageHeader };
