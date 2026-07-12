"use client";

import type { ChangeEvent } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DATE_RANGE_PRESETS, type DateRange } from "@/lib/utils/date-range-presets";

export type { DateRange };

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

  function handlePresetChange(e: ChangeEvent<HTMLSelectElement>) {
    const preset = DATE_RANGE_PRESETS.find((p) => p.label === e.target.value);
    if (preset) applyRange(preset.getRange());
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Select
        aria-label="Quick date range"
        placeholder="Quick range…"
        value=""
        onChange={handlePresetChange}
        options={DATE_RANGE_PRESETS.map((preset) => ({ value: preset.label, label: preset.label }))}
        className="w-40"
      />
      <Input label="From" type="date" value={localFrom} onChange={(e) => setLocalFrom(e.target.value)} />
      <Input label="To" type="date" value={localTo} onChange={(e) => setLocalTo(e.target.value)} />
      <Button type="button" size="sm" disabled={isPending} onClick={() => applyRange({ from: localFrom, to: localTo })}>
        Apply
      </Button>
    </div>
  );
}
