import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Card, CardContent } from "@/components/ui/card";

export interface PlaceholderCardProps {
  title?: string;
  description?: string;
  /** Minimum height class, e.g. "min-h-[200px]" */
  minHeight?: string;
  className?: string;
  children?: React.ReactNode;
}

export function PlaceholderCard({
  title = "Coming Soon",
  description = "This section is under construction.",
  minHeight = "min-h-[160px]",
  className,
  children,
}: PlaceholderCardProps) {
  return (
    <Card
      className={cn(
        "flex items-center justify-center border-dashed bg-[--color-bg]",
        minHeight,
        className
      )}
    >
      <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
        <div className="text-3xl text-[--color-text-subtle]">⋯</div>
        <p className="text-sm font-medium text-[--color-text-muted]">{title}</p>
        {description && (
          <p className="text-xs text-[--color-text-subtle] max-w-[240px]">{description}</p>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
