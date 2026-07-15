"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  saveExpenseCategoryMappings,
  saveAssetCategoryMappings,
  createExpenseCategory,
  createAssetCategory,
  type ExpenseCategoryMapping,
  type AssetCategoryMapping,
} from "./actions";

export type AccountOption = { id: string; account_number: string; name: string; category: string };

export type ExpenseCategoryRow = {
  id: string;
  name: string;
  default_expense_account_id: string;
  accounting_treatment: "immediate" | "prepaid" | "fixed_asset";
  default_prepaid_account_id: string;
  default_amortization_months: number | null;
  default_asset_category_id: string;
};

export type AssetCategoryOption = { id: string; name: string };

const TREATMENT_OPTIONS = [
  { value: "immediate", label: "Immediate Expense" },
  { value: "prepaid", label: "Prepaid Expense" },
  { value: "fixed_asset", label: "Fixed Asset" },
];

export type AssetCategoryRow = {
  id: string;
  name: string;
  default_asset_account_id: string;
  default_accum_depreciation_account_id: string;
  default_depreciation_expense_account_id: string;
  default_useful_life_months: number | null;
};

type Props = {
  expenseCategories: ExpenseCategoryRow[];
  assetCategories: AssetCategoryRow[];
  assetCategoryOptions: AssetCategoryOption[];
  accounts: AccountOption[];
  canEdit: boolean;
};

export function CategoryMappingTable({
  expenseCategories,
  assetCategories,
  assetCategoryOptions,
  accounts,
  canEdit,
}: Props) {
  const router = useRouter();
  const [expenseRows, setExpenseRows] = useState(expenseCategories);
  const [assetRows, setAssetRows] = useState(assetCategories);

  // Re-sync from fresh server props after router.refresh() (e.g. adding a new
  // category) — useState's initial value is only read once on mount otherwise.
  useEffect(() => setExpenseRows(expenseCategories), [expenseCategories]);
  useEffect(() => setAssetRows(assetCategories), [assetCategories]);
  const [isPending, startTransition] = useTransition();
  const [expenseSave, setExpenseSave] = useState<{ type: "idle" | "success" | "error"; message?: string }>({ type: "idle" });
  const [assetSave, setAssetSave] = useState<{ type: "idle" | "success" | "error"; message?: string }>({ type: "idle" });
  const [newExpenseCategory, setNewExpenseCategory] = useState("");
  const [newAssetCategory, setNewAssetCategory] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  function handleAddExpenseCategory() {
    setAddError(null);
    startTransition(async () => {
      const res = await createExpenseCategory(newExpenseCategory);
      if (res.success) {
        setNewExpenseCategory("");
        router.refresh();
      } else {
        setAddError(res.error);
      }
    });
  }

  function handleAddAssetCategory() {
    setAddError(null);
    startTransition(async () => {
      const res = await createAssetCategory(newAssetCategory);
      if (res.success) {
        setNewAssetCategory("");
        router.refresh();
      } else {
        setAddError(res.error);
      }
    });
  }

  const expenseAccountOptions = useMemo(
    () => accounts.filter((a) => a.category === "expense").map((a) => ({ value: a.id, label: `${a.account_number} — ${a.name}` })),
    [accounts]
  );
  const assetAccountOptions = useMemo(
    () => accounts.filter((a) => a.category === "asset").map((a) => ({ value: a.id, label: `${a.account_number} — ${a.name}` })),
    [accounts]
  );

  function updateExpenseRow(id: string, patch: Partial<ExpenseCategoryRow>) {
    setExpenseRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function updateAssetRow(id: string, patch: Partial<AssetCategoryRow>) {
    setAssetRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function handleSaveExpenses() {
    setExpenseSave({ type: "idle" });
    const payload: ExpenseCategoryMapping[] = expenseRows.map((r) => ({
      id: r.id,
      default_expense_account_id: r.default_expense_account_id || null,
      accounting_treatment: r.accounting_treatment,
      default_prepaid_account_id: r.default_prepaid_account_id || null,
      default_amortization_months: r.default_amortization_months,
      default_asset_category_id: r.default_asset_category_id || null,
    }));
    startTransition(async () => {
      const res = await saveExpenseCategoryMappings(payload);
      setExpenseSave(res.success ? { type: "success", message: "Saved." } : { type: "error", message: res.error });
    });
  }

  function handleSaveAssets() {
    setAssetSave({ type: "idle" });
    const payload: AssetCategoryMapping[] = assetRows.map((r) => ({
      id: r.id,
      default_asset_account_id: r.default_asset_account_id || null,
      default_accum_depreciation_account_id: r.default_accum_depreciation_account_id || null,
      default_depreciation_expense_account_id: r.default_depreciation_expense_account_id || null,
      default_useful_life_months: r.default_useful_life_months,
    }));
    startTransition(async () => {
      const res = await saveAssetCategoryMappings(payload);
      setAssetSave(res.success ? { type: "success", message: "Saved." } : { type: "error", message: res.error });
    });
  }

  const assetCategorySelectOptions = useMemo(
    () => assetCategoryOptions.map((c) => ({ value: c.id, label: c.name })),
    [assetCategoryOptions]
  );

  const expenseColumns: Column<ExpenseCategoryRow>[] = [
    { key: "name", header: "Expense Category", sortable: true },
    {
      key: "accounting_treatment",
      header: "Accounting Treatment",
      render: (_v, row) => (
        <Select
          value={row.accounting_treatment}
          onChange={(e) =>
            updateExpenseRow(row.id, { accounting_treatment: e.target.value as ExpenseCategoryRow["accounting_treatment"] })
          }
          options={TREATMENT_OPTIONS}
          disabled={!canEdit}
          className="min-w-[180px]"
        />
      ),
    },
    {
      key: "default_expense_account_id",
      header: "Expense Account",
      render: (_v, row) => (
        <Select
          value={row.default_expense_account_id}
          onChange={(e) => updateExpenseRow(row.id, { default_expense_account_id: e.target.value })}
          placeholder="Not mapped"
          options={expenseAccountOptions}
          disabled={!canEdit}
          className="min-w-[240px]"
        />
      ),
    },
    {
      key: "default_prepaid_account_id",
      header: "Prepaid Account",
      render: (_v, row) =>
        row.accounting_treatment === "prepaid" ? (
          <Select
            value={row.default_prepaid_account_id}
            onChange={(e) => updateExpenseRow(row.id, { default_prepaid_account_id: e.target.value })}
            placeholder="Not mapped"
            options={assetAccountOptions}
            disabled={!canEdit}
            className="min-w-[220px]"
          />
        ) : (
          <span className="text-(--color-text-subtle)">—</span>
        ),
    },
    {
      key: "default_amortization_months",
      header: "Amortization Months",
      render: (_v, row) =>
        row.accounting_treatment === "prepaid" ? (
          <NumberInput
            className="w-24"
            min={1}
            value={row.default_amortization_months ?? ""}
            onChange={(e) => updateExpenseRow(row.id, { default_amortization_months: Number(e.target.value) || null })}
            disabled={!canEdit}
          />
        ) : (
          <span className="text-(--color-text-subtle)">—</span>
        ),
    },
    {
      key: "default_asset_category_id",
      header: "Asset Category",
      render: (_v, row) =>
        row.accounting_treatment === "fixed_asset" ? (
          <Select
            value={row.default_asset_category_id}
            onChange={(e) => updateExpenseRow(row.id, { default_asset_category_id: e.target.value })}
            placeholder="Not linked"
            options={assetCategorySelectOptions}
            disabled={!canEdit}
            className="min-w-[200px]"
          />
        ) : (
          <span className="text-(--color-text-subtle)">—</span>
        ),
    },
  ];

  const assetColumns: Column<AssetCategoryRow>[] = [
    { key: "name", header: "Asset Category", sortable: true },
    {
      key: "default_asset_account_id",
      header: "Asset Account",
      render: (_v, row) => (
        <Select
          value={row.default_asset_account_id}
          onChange={(e) => updateAssetRow(row.id, { default_asset_account_id: e.target.value })}
          placeholder="Not mapped"
          options={assetAccountOptions}
          disabled={!canEdit}
          className="min-w-[220px]"
        />
      ),
    },
    {
      key: "default_accum_depreciation_account_id",
      header: "Accum. Depreciation Account",
      render: (_v, row) => (
        <Select
          value={row.default_accum_depreciation_account_id}
          onChange={(e) => updateAssetRow(row.id, { default_accum_depreciation_account_id: e.target.value })}
          placeholder="Not mapped"
          options={assetAccountOptions}
          disabled={!canEdit}
          className="min-w-[220px]"
        />
      ),
    },
    {
      key: "default_depreciation_expense_account_id",
      header: "Depreciation Expense Account",
      render: (_v, row) => (
        <Select
          value={row.default_depreciation_expense_account_id}
          onChange={(e) => updateAssetRow(row.id, { default_depreciation_expense_account_id: e.target.value })}
          placeholder="Not mapped"
          options={expenseAccountOptions}
          disabled={!canEdit}
          className="min-w-[220px]"
        />
      ),
    },
    {
      key: "default_useful_life_months",
      header: "Default Useful Life (mo.)",
      render: (_v, row) => (
        <NumberInput
          className="w-24"
          min={1}
          value={row.default_useful_life_months ?? ""}
          onChange={(e) => updateAssetRow(row.id, { default_useful_life_months: Number(e.target.value) || null })}
          disabled={!canEdit}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Expense Categories</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <DataTable columns={expenseColumns} data={expenseRows} searchable={false} emptyMessage="No expense categories yet" />
          {canEdit && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--color-border) pt-3">
              <div className="flex items-center gap-2">
                <Input
                  value={newExpenseCategory}
                  onChange={(e) => setNewExpenseCategory(e.target.value)}
                  placeholder="New expense category name…"
                  className="w-64"
                />
                <Button type="button" variant="secondary" onClick={handleAddExpenseCategory} disabled={isPending}>
                  Add
                </Button>
              </div>
              <div className="flex items-center gap-3">
                {expenseSave.type === "success" && <span className="text-sm text-(--color-success)">{expenseSave.message}</span>}
                {expenseSave.type === "error" && <span className="text-sm text-(--color-danger)">{expenseSave.message}</span>}
                <Button type="button" onClick={handleSaveExpenses} disabled={isPending}>
                  {isPending ? "Saving…" : "Save Expense Mappings"}
                </Button>
              </div>
            </div>
          )}
          {addError && <p className="text-sm text-(--color-danger)">{addError}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Asset Categories</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <DataTable columns={assetColumns} data={assetRows} searchable={false} emptyMessage="No asset categories yet" />
          {canEdit && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--color-border) pt-3">
              <div className="flex items-center gap-2">
                <Input
                  value={newAssetCategory}
                  onChange={(e) => setNewAssetCategory(e.target.value)}
                  placeholder="New asset category name…"
                  className="w-64"
                />
                <Button type="button" variant="secondary" onClick={handleAddAssetCategory} disabled={isPending}>
                  Add
                </Button>
              </div>
              <div className="flex items-center gap-3">
                {assetSave.type === "success" && <span className="text-sm text-(--color-success)">{assetSave.message}</span>}
                {assetSave.type === "error" && <span className="text-sm text-(--color-danger)">{assetSave.message}</span>}
                <Button type="button" onClick={handleSaveAssets} disabled={isPending}>
                  {isPending ? "Saving…" : "Save Asset Mappings"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
