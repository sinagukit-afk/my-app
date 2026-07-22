"use client";

import * as React from "react";
import Link from "next/link";
import { useGuardedLinkClick } from "@/lib/hooks/use-unsaved-changes";
import { cn } from "@/lib/utils/cn";

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 12L6 8l4-4" />
    </svg>
  );
}

interface BackLinkProps {
  href: string;
  label?: string;
  className?: string;
}

/** Consistent "‹ Back" affordance for detail/edit/error pages — routes through the unsaved-changes guard. */
export function BackLink({ href, label = "Back", className }: BackLinkProps) {
  const guardedClick = useGuardedLinkClick();
  return (
    <Link
      href={href}
      onClick={guardedClick(href)}
      className={cn(
        "mb-1 inline-flex items-center gap-1 text-sm font-medium text-(--color-text-muted) transition-colors hover:text-(--color-text)",
        className
      )}
    >
      <ChevronLeftIcon />
      {label}
    </Link>
  );
}
