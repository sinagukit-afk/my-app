import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Card, CardContent } from "@/components/ui/card";

type Trend = "up" | "down" | "neutral";

export interface StatCardProps {
  label: string;
  value: string | number;
  /** e.g. "+12%" or "−3 units" */
  delta?: string;
  trend?: Trend;
  icon?: React.ReactNode;
  className?: string;
}

const trendColor: Record<Trend, string> = {
  up: "text-(--color-success)",
  down: "text-(--color-danger)",
  neutral: "text-(--color-text-muted)",
};

const trendArrow: Record<Trend, string> = {
  up: "↑",
  down: "↓",
  neutral: "→",
};

export function StatCard({ label, value, delta, trend = "neutral", icon, className }: StatCardProps) {
  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-(--color-text-muted) truncate">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-(--color-text) tabular-nums">{value}</p>
            {delta && (
              <p className={cn("mt-1 text-xs font-medium", trendColor[trend])}>
                {trendArrow[trend]} {delta}
              </p>
            )}
          </div>
          {icon && (
            <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-(--color-primary-light) text-(--color-primary)">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
