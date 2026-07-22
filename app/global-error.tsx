"use client";

import "./globals.css";

/**
 * Last-resort catch for errors thrown in the root layout itself (Providers, etc.) — replaces the
 * entire app, so it must supply its own <html>/<body> and can't rely on ThemeProvider or any other
 * context. Deliberately minimal to keep its own failure surface small.
 */
export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex h-full min-h-full flex-col items-center justify-center gap-4 bg-(--color-bg) p-6 text-center">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-(--color-text)">Something went wrong</h1>
          <p className="max-w-[320px] text-sm text-(--color-text-muted)">
            The application failed to load. Try again, or go back to the dashboard.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="inline-flex h-9 items-center justify-center rounded-md border border-(--color-border) bg-(--color-surface) px-4 text-sm font-medium text-(--color-text) hover:bg-(--color-bg)"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="inline-flex h-9 items-center justify-center rounded-md border border-(--color-border) bg-(--color-surface) px-4 text-sm font-medium text-(--color-text) hover:bg-(--color-bg)"
          >
            Go to Dashboard
          </a>
        </div>
      </body>
    </html>
  );
}
