"use client";

import { useMemo, useState, useTransition } from "react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { accountOptionLabel, PARENT_ACCOUNT_WARNING } from "@/lib/accounting/account-options";
import { saveItemAccountMappings, type MappingInput } from "./actions";

export type AccountOption = {
  id: string;
  account_number: string;
  name: string;
  category: string;
  is_postable: boolean;
};

export type MappingRow = {
  item_id: string;
  item_name: string;
  category_name: string;
  item_type: string;
  revenue_account_id: string;
  inventory_account_id: string;
  expense_account_id: string;
};

type Props = {
  rows: MappingRow[];
  accounts: AccountOption[];
  canEdit: boolean;
};

export function ProductMappingTable({ rows: initialRows, accounts, canEdit }: Props) {
  const [rows, setRows] = useState(initialRows);
  const [isPending, startTransition] = useTransition();
  const [saveState, setSaveState] = useState<{ type: "idle" | "success" | "error"; message?: string }>({
    type: "idle",
  });

  const revenueOptions = useMemo(
    () =>
      accounts
        .filter((a) => a.category === "revenue")
        .map((a) => ({ value: a.id, label: accountOptionLabel(a) })),
    [accounts]
  );
  const inventoryOptions = useMemo(
    () =>
      accounts
        .filter((a) => a.category === "asset")
        .map((a) => ({ value: a.id, label: accountOptionLabel(a) })),
    [accounts]
  );
  const expenseOptions = useMemo(
    () =>
      accounts
        .filter((a) => a.category === "expense")
        .map((a) => ({ value: a.id, label: accountOptionLabel(a) })),
    [accounts]
  );

  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  function isParentAccount(accountId: string): boolean {
    return accountId ? accountsById.get(accountId)?.is_postable === false : false;
  }

  function updateRow(item_id: string, patch: Partial<MappingRow>) {
    setRows((prev) => prev.map((r) => (r.item_id === item_id ? { ...r, ...patch } : r)));
  }

  const columns: Column<MappingRow>[] = [
    { key: "item_name", header: "Item", sortable: true },
    { key: "category_name", header: "Category", sortable: true },
    { key: "item_type", header: "Type", sortable: true },
    {
      key: "revenue_account_id",
      header: "Revenue Account",
      render: (_v, row) => (
        <Select
          value={row.revenue_account_id}
          onChange={(e) => updateRow(row.item_id, { revenue_account_id: e.target.value })}
          placeholder="Not mapped"
          options={revenueOptions}
          disabled={!canEdit}
          error={isParentAccount(row.revenue_account_id) ? PARENT_ACCOUNT_WARNING : undefined}
          className="min-w-[220px]"
        />
      ),
    },
    {
      key: "inventory_account_id",
      header: "Inventory Account",
      render: (_v, row) => (
        <Select
          value={row.inventory_account_id}
          onChange={(e) => updateRow(row.item_id, { inventory_account_id: e.target.value })}
          placeholder="Not mapped"
          options={inventoryOptions}
          disabled={!canEdit}
          error={isParentAccount(row.inventory_account_id) ? PARENT_ACCOUNT_WARNING : undefined}
          className="min-w-[220px]"
        />
      ),
    },
    {
      key: "expense_account_id",
      header: "COGS / Expense Account",
      render: (_v, row) => (
        <Select
          value={row.expense_account_id}
          onChange={(e) => updateRow(row.item_id, { expense_account_id: e.target.value })}
          placeholder="Not mapped"
          options={expenseOptions}
          disabled={!canEdit}
          error={isParentAccount(row.expense_account_id) ? PARENT_ACCOUNT_WARNING : undefined}
          className="min-w-[220px]"
        />
      ),
    },
  ];

  const mappedCount = rows.filter(
    (r) => r.revenue_account_id || r.inventory_account_id || r.expense_account_id
  ).length;
  const hasParentSelection = rows.some(
    (r) => isParentAccount(r.revenue_account_id) || isParentAccount(r.inventory_account_id) || isParentAccount(r.expense_account_id)
  );

  function handleSave() {
    setSaveState({ type: "idle" });
    const payload: MappingInput[] = rows.map((r) => ({
      item_id: r.item_id,
      revenue_account_id: r.revenue_account_id || null,
      inventory_account_id: r.inventory_account_id || null,
      expense_account_id: r.expense_account_id || null,
    }));

    startTransition(async () => {
      const res = await saveItemAccountMappings(payload);
      setSaveState(res.success ? { type: "success", message: "Mappings saved." } : { type: "error", message: res.error });
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-(--color-text-muted)">
          {canEdit
            ? `${mappedCount} of ${rows.length} items have at least one account mapped.`
            : `Read-only — only Admin can edit account mappings. ${mappedCount} of ${rows.length} items mapped.`}
        </p>
        {canEdit && (
          <div className="flex items-center gap-3">
            {hasParentSelection && (
              <span className="text-sm text-(--color-danger)">Fix header-account selections before saving.</span>
            )}
            {saveState.type === "success" && <span className="text-sm text-(--color-success)">{saveState.message}</span>}
            {saveState.type === "error" && <span className="text-sm text-(--color-danger)">{saveState.message}</span>}
            <Button type="button" onClick={handleSave} disabled={isPending || hasParentSelection}>
              {isPending ? "Saving…" : "Save All Mappings"}
            </Button>
          </div>
        )}
      </div>
      <DataTable columns={columns} data={rows} searchable searchPlaceholder="Search items or categories…" pageSize={20} />
    </div>
  );
}
