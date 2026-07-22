import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Root-level 404 — for URLs outside /dashboard (bad links, typos). No AppShell available here. */
export default function RootNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <img src="/sinag-ukit-logo.jpg" alt="Sinag Ukit" className="h-12 w-12 rounded-(--radius-md) object-contain" />
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-(--color-text)">Page not found</h1>
        <p className="max-w-[320px] text-sm text-(--color-text-muted)">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>
      </div>
      <Link href="/">
        <Button variant="secondary">Go to Sinag Ukit</Button>
      </Link>
    </div>
  );
}
