"use client";

import type { ChangeEvent } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";

const MONTH_OPTIONS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

/** URL-driven (?month=) single-month picker, paired with YearFilter. Preserves other params. */
export function MonthFilter({ month }: { month: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(e: ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value) {
      params.set("month", e.target.value);
    } else {
      params.delete("month");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select
      aria-label="Month"
      value={month}
      onChange={handleChange}
      options={[{ value: "", label: "All Months" }, ...MONTH_OPTIONS]}
      className="w-36"
    />
  );
}
