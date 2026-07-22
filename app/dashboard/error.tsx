"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/business/empty-state";

function ErrorIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5l7 12.5H1L8 1.5z" />
      <path d="M8 6.5v3M8 12h.01" />
    </svg>
  );
}

/** Error boundary for everything under /dashboard — nested inside AppShell, so nav/breadcrumb/back-forward stay available. */
export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EmptyState
      icon={<ErrorIcon />}
      title="Something went wrong"
      description={
        error.digest
          ? `An unexpected error occurred. Reference: ${error.digest}`
          : error.message || "An unexpected error occurred."
      }
      action={
        <div className="flex justify-center gap-2">
          <Button variant="secondary" onClick={() => unstable_retry()}>
            Try again
          </Button>
          <Link href="/dashboard">
            <Button variant="secondary">Go to Dashboard</Button>
          </Link>
        </div>
      }
    />
  );
}
