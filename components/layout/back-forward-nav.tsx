"use client";

import * as React from "react";
import { useGuardedNavigate } from "@/lib/hooks/use-unsaved-changes";
import { cn } from "@/lib/utils/cn";

function ChevronLeftSmallIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 12L6 8l4-4" />
    </svg>
  );
}

function ChevronRightSmallIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}

interface BrowserNavigation {
  canGoBack: boolean;
  canGoForward: boolean;
  addEventListener: (type: "currententrychange", listener: () => void) => void;
  removeEventListener: (type: "currententrychange", listener: () => void) => void;
}

function getNavigationApi(): BrowserNavigation | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { navigation?: BrowserNavigation }).navigation ?? null;
}

/**
 * Browser-like back/forward buttons, mirroring session history rather than a fixed route.
 * Uses the Navigation API (window.navigation) to know when each direction is actually usable —
 * Chromium/Edge support it; on browsers that don't (older Safari/Firefox), it degrades to an
 * always-enabled Back (router.back() no-ops safely with no history) and a permanently-disabled
 * Forward, since there's no standard way to detect forward availability without that API.
 */
export function BackForwardNav() {
  const { back, forward } = useGuardedNavigate();
  // Must match the server-rendered default exactly (no window access here) — populating the
  // real window.navigation state happens in the effect below, after hydration completes, to
  // avoid a hydration mismatch (the client's actual history state can differ from any guess
  // made during the render that has to match SSR output).
  const [state, setState] = React.useState({ canGoBack: true, canGoForward: false, supported: false });

  React.useEffect(() => {
    const nav = getNavigationApi();
    if (!nav) return;
    function update() {
      // The Navigation API fires `currententrychange` synchronously as part of the browser's
      // navigation transition, which can land inside React/Next's own commit phase (their
      // router subscribes via useInsertionEffect internally) — scheduling a state update from
      // there throws "useInsertionEffect must not schedule updates". Queuing a microtask moves
      // this update outside that phase, after the current commit has fully finished.
      queueMicrotask(() => {
        setState({ canGoBack: nav!.canGoBack, canGoForward: nav!.canGoForward, supported: true });
      });
    }
    update();
    nav.addEventListener("currententrychange", update);
    return () => nav.removeEventListener("currententrychange", update);
  }, []);

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => back()}
        disabled={!state.canGoBack}
        aria-label="Go back"
        title="Go back"
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-(--radius-md) text-(--color-text-muted) transition-colors",
          "hover:bg-(--color-bg) hover:text-(--color-text) disabled:pointer-events-none disabled:opacity-40"
        )}
      >
        <ChevronLeftSmallIcon />
      </button>
      <button
        type="button"
        onClick={() => forward()}
        disabled={!state.canGoForward}
        aria-label="Go forward"
        title="Go forward"
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-(--radius-md) text-(--color-text-muted) transition-colors",
          "hover:bg-(--color-bg) hover:text-(--color-text) disabled:pointer-events-none disabled:opacity-40"
        )}
      >
        <ChevronRightSmallIcon />
      </button>
    </div>
  );
}
