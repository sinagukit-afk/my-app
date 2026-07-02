"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type DateRange = { from: string; to: string };

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

const PRESETS: { label: string; getRange: () => DateRange }[] = [
  {
    label: "This Month",
    getRange: () => {
      const now = new Date();
      return { from: toISODate(startOfMonth(now)), to: toISODate(endOfMonth(now)) };
    },
  },
  {
    label: "Last Month",
    getRange: () => {
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { from: toISODate(startOfMonth(lastMonth)), to: toISODate(endOfMonth(lastMonth)) };
    },
  },
  {
    label: "This Year",
    getRange: () => {
      const now = new Date();
      return { from: `${now.getFullYear()}-01-01`, to: toISODate(now) };
    },
  },
  { label: "All Time", getRange: () => ({ from: "", to: "" }) },
];

/** URL-driven (?from=&to=) date-range picker. Pairs with a server component reading `searchParams`. */
export function DateRangeFilter({ from, to }: DateRange) {
  const router = useRouter();
  const pathname = usePathname();
  const [localFrom, setLocalFrom] = useState(from);
  const [localTo, setLocalTo] = useState(to);
  const [isPending, startTransition] = useTransition();

  function applyRange(range: DateRange) {
    setLocalFrom(range.from);
    setLocalTo(range.to);
    const params = new URLSearchParams();
    if (range.from) params.set("from", range.from);
    if (range.to) params.set("to", range.to);
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <Button
            key={preset.label}
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => applyRange(preset.getRange())}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      <Input label="From" type="date" value={localFrom} onChange={(e) => setLocalFrom(e.target.value)} />
      <Input label="To" type="date" value={localTo} onChange={(e) => setLocalTo(e.target.value)} />
      <Button type="button" size="sm" disabled={isPending} onClick={() => applyRange({ from: localFrom, to: localTo })}>
        Apply
      </Button>
    </div>
  );
}
