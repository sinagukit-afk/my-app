"use client";

import type { ChangeEvent } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Select } from "@/components/ui/select";

/** URL-driven (?year=) single-year picker for whole-year dashboard views. */
export function YearFilter({ year, years }: { year: number; years: number[] }) {
  const router = useRouter();
  const pathname = usePathname();

  function handleChange(e: ChangeEvent<HTMLSelectElement>) {
    router.push(`${pathname}?year=${e.target.value}`);
  }

  return (
    <Select
      aria-label="Year"
      value={String(year)}
      onChange={handleChange}
      options={years.map((y) => ({ value: String(y), label: String(y) }))}
      className="w-28"
    />
  );
}
