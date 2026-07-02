"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** URL-driven (?asOf=) single-date picker, for point-in-time reports (trial balance, balance sheet). */
export function AsOfDateFilter({ asOf }: { asOf: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [localAsOf, setLocalAsOf] = useState(asOf);
  const [isPending, startTransition] = useTransition();

  function apply(value: string) {
    setLocalAsOf(value);
    const params = new URLSearchParams();
    if (value) params.set("asOf", value);
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => apply(new Date().toISOString().slice(0, 10))}
      >
        Today
      </Button>
      <Input label="As of" type="date" value={localAsOf} onChange={(e) => setLocalAsOf(e.target.value)} />
      <Button type="button" size="sm" disabled={isPending} onClick={() => apply(localAsOf)}>
        Apply
      </Button>
    </div>
  );
}
