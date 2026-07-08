"use client";

import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { setCategoryType } from "./actions";

export type CategoryRow = {
  id: string;
  name: string;
  category_type: "product" | "packaging";
};

type Props = {
  data: CategoryRow[];
  canWrite: boolean;
};

export function ItemCategoriesTable({ data, canWrite }: Props) {
  const router = useRouter();

  async function handleToggleType(row: CategoryRow) {
    const next = row.category_type === "packaging" ? "product" : "packaging";
    const res = await setCategoryType(row.id, next);
    if (!res.success) alert(res.error);
    else router.refresh();
  }

  const columns: Column<CategoryRow>[] = [
    {
      key: "name",
      header: "Category",
      sortable: true,
    },
    {
      key: "category_type",
      header: "Type",
      sortable: true,
      render: (value) => (
        <Badge variant={value === "packaging" ? "info" : "neutral"}>
          {value === "packaging" ? "Packaging" : "Product"}
        </Badge>
      ),
    },
    {
      key: "id",
      header: "Actions",
      render: (_value, row) =>
        canWrite ? (
          <Button variant="ghost" size="sm" onClick={() => handleToggleType(row)}>
            {row.category_type === "packaging" ? "Mark as Product" : "Mark as Packaging"}
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Item Category"
        description="Categories sync from Loyverse. Mark which ones are Packaging Materials, used for shipment packaging tracking."
      />

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search categories…"
        emptyMessage="No categories found"
        emptyDescription="Categories sync in from Loyverse."
      />
    </div>
  );
}
