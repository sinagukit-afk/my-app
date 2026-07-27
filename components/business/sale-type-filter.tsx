"use client";

import type { ChangeEvent } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";

/** URL-driven (?source=) Order Source picker. Preserves other params (e.g. ?year=). */
export function SaleTypeFilter({
  source,
  options,
}: {
  source: string;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(e: ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value) {
      params.set("source", e.target.value);
    } else {
      params.delete("source");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select
      aria-label="Sale Type"
      value={source}
      onChange={handleChange}
      options={[{ value: "", label: "All Sources" }, ...options]}
      className="w-44"
    />
  );
}
