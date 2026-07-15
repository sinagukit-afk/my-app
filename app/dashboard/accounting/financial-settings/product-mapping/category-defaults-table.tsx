"use client";

import { useMemo, useState, useTransition } from "react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { saveCategoryDefaultMappings, type CategoryDefaultInput } from "./actions";
import type { AccountOption } from "./product-mapping-table";

export type CategoryDefaultRow = {
  category_id: string;
  category_name: string;
  default_revenue_account_id: string;
  default_inventory_account_id: string;
  default_expense_account_id: string;
};

type Props = {
  rows: CategoryDefaultRow[];
  accounts: AccountOption[];
  canEdit: boolean;
};

export function CategoryDefaultsTable({ rows: initialRows, accounts, canEdit }: Props) {
  const [rows, setRows] = useState(initialRows);
  const [isPending, startTransition] = useTransition();
  const [saveState, setSaveState] = useState<{ type: "idle" | "success" | "error"; message?: string }>({
    type: "idle",
  });

  const revenueOptions = useMemo(
    () =>
      accounts
        .filter((a) => a.category === "revenue")
        .map((a) => ({ value: a.id, label: `${a.account_number} — ${a.name}` })),
    [accounts]
  );
  const inventoryOptions = useMemo(
    () =>
      accounts
        .filter((a) => a.category === "asset")
        .map((a) => ({ value: a.id, label: `${a.account_number} — ${a.name}` })),
    [accounts]
  );
  const expenseOptions = useMemo(
    () =>
      accounts
        .filter((a) => a.category === "expense")
        .map((a) => ({ value: a.id, label: `${a.account_number} — ${a.name}` })),
    [accounts]
  );

  function updateRow(category_id: string, patch: Partial<CategoryDefaultRow>) {
    setRows((prev) => prev.map((r) => (r.category_id === category_id ? { ...r, ...patch } : r)));
  }

  const columns: Column<CategoryDefaultRow>[] = [
    { key: "category_name", header: "Category", sortable: true },
    {
      key: "default_revenue_account_id",
      header: "Default Revenue Account",
      render: (_v, row) => (
        <Select
          value={row.default_revenue_account_id}
          onChange={(e) => updateRow(row.category_id, { default_revenue_account_id: e.target.value })}
          placeholder="None"
          options={revenueOptions}
          disabled={!canEdit}
          className="min-w-[220px]"
        />
      ),
    },
    {
      key: "default_inventory_account_id",
      header: "Default Inventory Account",
      render: (_v, row) => (
        <Select
          value={row.default_inventory_account_id}
          onChange={(e) => updateRow(row.category_id, { default_inventory_account_id: e.target.value })}
          placeholder="None"
          options={inventoryOptions}
          disabled={!canEdit}
          className="min-w-[220px]"
        />
      ),
    },
    {
      key: "default_expense_account_id",
      header: "Default COGS / Expense Account",
      render: (_v, row) => (
        <Select
          value={row.default_expense_account_id}
          onChange={(e) => updateRow(row.category_id, { default_expense_account_id: e.target.value })}
          placeholder="None"
          options={expenseOptions}
          disabled={!canEdit}
          className="min-w-[220px]"
        />
      ),
    },
  ];

  function handleSave() {
    setSaveState({ type: "idle" });
    const payload: CategoryDefaultInput[] = rows.map((r) => ({
      category_id: r.category_id,
      default_revenue_account_id: r.default_revenue_account_id || null,
      default_inventory_account_id: r.default_inventory_account_id || null,
      default_expense_account_id: r.default_expense_account_id || null,
    }));

    startTransition(async () => {
      const res = await saveCategoryDefaultMappings(payload);
      setSaveState(res.success ? { type: "success", message: "Category defaults saved." } : { type: "error", message: res.error });
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-(--color-text-muted)">
          {canEdit
            ? "New items created under a category automatically inherit that category's defaults here — this only affects newly created items, not existing mappings below."
            : "Read-only — only Admin can edit category defaults."}
        </p>
        {canEdit && (
          <div className="flex items-center gap-3">
            {saveState.type === "success" && <span className="text-sm text-(--color-success)">{saveState.message}</span>}
            {saveState.type === "error" && <span className="text-sm text-(--color-danger)">{saveState.message}</span>}
            <Button type="button" onClick={handleSave} disabled={isPending}>
              {isPending ? "Saving…" : "Save Category Defaults"}
            </Button>
          </div>
        )}
      </div>
      <DataTable columns={columns} data={rows} searchable={false} />
    </div>
  );
}
