import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/business/empty-state";

function NotFoundIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="7" r="5.5" />
      <path d="M11 11l3.5 3.5" />
      <path d="M5 7h4" />
    </svg>
  );
}

/**
 * Rendered inside AppShell (nested under app/dashboard/layout.tsx) for any notFound() call or
 * unmatched URL below /dashboard — sidebar, breadcrumb, and the global back/forward buttons stay
 * available for free.
 */
export default function DashboardNotFound() {
  return (
    <EmptyState
      icon={<NotFoundIcon />}
      title="Page not found"
      description="The page you're looking for doesn't exist, was moved, or you may not have access to it."
      action={
        <Link href="/dashboard">
          <Button variant="secondary">Go to Dashboard</Button>
        </Link>
      }
    />
  );
}
