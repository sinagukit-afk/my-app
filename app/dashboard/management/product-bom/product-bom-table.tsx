"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";

export type ProductBomRow = {
  id: string;
  name: string;
  category: string | null;
  sku_list: string;
  variant_count: number;
  component_count: number;
  cost_label: string;
  price_label: string;
  missing_bom: boolean;
};

type Props = {
  data: ProductBomRow[];
  canWrite: boolean;
};

export function ProductBomTable({ data, canWrite }: Props) {
  const router = useRouter();
  const [categoryFilter, setCategoryFilter] = useState("");

  const categories = useMemo(
    () => Array.from(new Set(data.map((r) => r.category).filter((c): c is string => !!c))).sort(),
    [data]
  );

  const filtered = useMemo(
    () => data.filter((r) => (categoryFilter ? r.category === categoryFilter : true)),
    [data, categoryFilter]
  );

  const columns: Column<ProductBomRow>[] = [
    {
      key: "name",
      header: "Item",
      sortable: true,
      exportValue: (value, row) => (row.sku_list ? `${String(value)} (${row.sku_list})` : String(value)),
      render: (value, row) => (
        <div>
          <p className="font-medium text-(--color-text)">{String(value)}</p>
          {row.sku_list && (
            <p className="mt-0.5 text-xs text-(--color-text-muted)" title={row.sku_list}>
              {row.sku_list.split(", ")[0]}
              {row.variant_count > 1 && ` +${row.variant_count - 1} more`}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      sortable: true,
      render: (value) => (value as string) || <span className="text-(--color-text-subtle)">—</span>,
    },
    {
      key: "component_count",
      header: "Components",
      sortable: true,
      render: (value) => String(value),
    },
    {
      key: "price_label",
      header: "Price",
      render: (value) => String(value),
    },
    {
      key: "cost_label",
      header: "Cost",
      render: (value) => String(value),
    },
    {
      key: "missing_bom",
      header: "Status",
      render: (value) =>
        value ? (
          <Badge variant="danger">Missing components</Badge>
        ) : (
          <Badge variant="success">Complete</Badge>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Product BOM"
        description="Bills of materials for composite items — edit what each product is built from without opening the full item form."
        actions={
          <Link href="/dashboard/management/items" className="text-sm text-(--color-primary) hover:underline">
            Manage Items →
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Select
          aria-label="Filter by category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          options={[{ value: "", label: "All categories" }, ...categories.map((c) => ({ value: c, label: c }))]}
          className="w-44"
        />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        pageSize={50}
        searchPlaceholder="Search composite items…"
        emptyMessage="No composite items found"
        emptyDescription="Composite items appear here once created in the Items module."
        onRowClick={(row) =>
          router.push(
            canWrite ? `/dashboard/management/product-bom/${row.id}` : `/dashboard/management/items/${row.id}`
          )
        }
        rowHref={(row) =>
          canWrite ? `/dashboard/management/product-bom/${row.id}` : `/dashboard/management/items/${row.id}`
        }
        exportFilename="product-bom"
      />
    </div>
  );
}
