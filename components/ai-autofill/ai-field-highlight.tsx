"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface AiFieldHighlightProps {
  /** True while this field still holds an AI-filled, unedited value. */
  active: boolean;
  children: React.ReactNode;
  className?: string;
}

export function AiFieldHighlight({ active, children, className }: AiFieldHighlightProps) {
  return (
    <div
      className={cn(
        "relative rounded-md transition-shadow",
        active && "ring-2 ring-(--color-info) ring-offset-1 ring-offset-(--color-surface)",
        className
      )}
    >
      {children}
      {active && (
        <span className="absolute -top-2 -right-2 rounded-full bg-(--color-info) px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
          AI
        </span>
      )}
    </div>
  );
}
