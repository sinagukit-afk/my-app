"use client";

import { useMemo, useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { movementColumns, TYPE_LABEL, type MovementRow } from "./movement-utils";

export type { MovementRow } from "./movement-utils";
export { movementColumns } from "./movement-utils";

type Props = {
  data: MovementRow[];
  title?: string;
  description?: string;
};

export function MovementsTable({
  data,
  title = "Inventory Movement History",
  description = "A chronological log of the most recent 500 stock movements across all locations.",
}: Props) {
  const [typeFilter, setTypeFilter] = useState("");

  const types = useMemo(
    () => Array.from(new Set(data.map((r) => r.movement_type))).sort(),
    [data]
  );

  const filtered = useMemo(
    () => (typeFilter ? data.filter((r) => r.movement_type === typeFilter) : data),
    [data, typeFilter]
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        description={description}
        actions={
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            options={[
              { value: "", label: "All types" },
              ...types.map((t) => ({ value: t, label: TYPE_LABEL[t] ?? t })),
            ]}
            className="w-48"
          />
        }
      />

      <DataTable
        columns={movementColumns()}
        data={filtered}
        searchPlaceholder="Search movements…"
        emptyMessage="No stock movements found"
        emptyDescription="Movements will appear here once items are received, adjusted, or sold."
      />
    </div>
  );
}
