import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { BackLink } from "@/components/ui/back-link";

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** Logical parent route (usually the list page). Renders a consistent "‹ Back" link above the title. */
  backHref?: string;
  backLabel?: string;
}

function PageHeader({ title, description, actions, backHref, backLabel, className, ...props }: PageHeaderProps) {
  return (
    <div
      className={cn("flex flex-wrap items-start justify-between gap-4 pb-6 lg:flex-nowrap", className)}
      {...props}
    >
      <div className="min-w-0">
        {backHref && <BackLink href={backHref} label={backLabel} />}
        <h1 className="text-2xl font-semibold text-(--color-text) truncate">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-(--color-text-muted)">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:shrink-0 lg:flex-nowrap">{actions}</div>
      )}
    </div>
  );
}

export { PageHeader };
