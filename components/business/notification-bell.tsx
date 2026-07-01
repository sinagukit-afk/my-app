"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface NotificationBellProps {
  count?: number;
  onClick?: () => void;
  className?: string;
}

export function NotificationBell({ count = 0, onClick, className }: NotificationBellProps) {
  const capped = count > 99 ? "99+" : count > 0 ? String(count) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={capped ? `${count} notifications` : "Notifications"}
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-md",
        "text-(--color-text-muted) hover:bg-(--color-bg) hover:text-(--color-text)",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)",
        "transition-colors",
        className
      )}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {capped && (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 flex min-w-[16px] h-4 items-center justify-center rounded-full bg-(--color-danger) px-1 text-[10px] font-semibold text-white leading-none"
        >
          {capped}
        </span>
      )}
    </button>
  );
}
