"use client";

import { useMemo, useState, useTransition } from "react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { accountOptionLabel, PARENT_ACCOUNT_WARNING } from "@/lib/accounting/account-options";
import { savePaymentTypeAccountMappings, type PaymentMappingInput } from "./actions";

export type AccountOption = { id: string; account_number: string; name: string; is_postable: boolean };
export type BankAccountOption = { id: string; name: string; bank: string };

export type PaymentMappingRow = {
  payment_type_id: string;
  payment_type_name: string;
  account_id: string;
  bank_account_id: string;
};

type Props = {
  rows: PaymentMappingRow[];
  accounts: AccountOption[];
  bankAccounts: BankAccountOption[];
  canEdit: boolean;
};

export function PaymentMethodsTable({ rows: initialRows, accounts, bankAccounts, canEdit }: Props) {
  const [rows, setRows] = useState(initialRows);
  const [isPending, startTransition] = useTransition();
  const [saveState, setSaveState] = useState<{ type: "idle" | "success" | "error"; message?: string }>({
    type: "idle",
  });

  const accountOptions = useMemo(
    () => accounts.map((a) => ({ value: a.id, label: accountOptionLabel(a) })),
    [accounts]
  );
  const bankAccountOptions = useMemo(
    () => bankAccounts.map((b) => ({ value: b.id, label: `${b.bank} — ${b.name}` })),
    [bankAccounts]
  );

  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  function isParentAccount(accountId: string): boolean {
    return accountId ? accountsById.get(accountId)?.is_postable === false : false;
  }

  function updateRow(payment_type_id: string, patch: Partial<PaymentMappingRow>) {
    setRows((prev) => prev.map((r) => (r.payment_type_id === payment_type_id ? { ...r, ...patch } : r)));
  }

  const columns: Column<PaymentMappingRow>[] = [
    { key: "payment_type_name", header: "Payment Type", sortable: true },
    {
      key: "account_id",
      header: "GL Account",
      render: (_v, row) => (
        <Select
          value={row.account_id}
          onChange={(e) => updateRow(row.payment_type_id, { account_id: e.target.value })}
          placeholder="Not mapped"
          options={accountOptions}
          disabled={!canEdit}
          error={isParentAccount(row.account_id) ? PARENT_ACCOUNT_WARNING : undefined}
          className="min-w-[220px]"
        />
      ),
    },
    {
      key: "bank_account_id",
      header: "Bank Account",
      render: (_v, row) => (
        <Select
          value={row.bank_account_id}
          onChange={(e) => updateRow(row.payment_type_id, { bank_account_id: e.target.value })}
          placeholder="Direct to GL account"
          options={bankAccountOptions}
          disabled={!canEdit}
          className="min-w-[220px]"
        />
      ),
    },
  ];

  const mappedCount = rows.filter((r) => r.account_id).length;
  const hasParentSelection = rows.some((r) => isParentAccount(r.account_id));

  function handleSave() {
    setSaveState({ type: "idle" });
    const unmapped = rows.filter((r) => !r.account_id).map((r) => r.payment_type_name);
    const payload: PaymentMappingInput[] = rows
      .filter((r) => r.account_id)
      .map((r) => ({
        payment_type_id: r.payment_type_id,
        account_id: r.account_id,
        bank_account_id: r.bank_account_id || null,
      }));

    startTransition(async () => {
      const res = await savePaymentTypeAccountMappings(payload);
      if (!res.success) {
        setSaveState({ type: "error", message: res.error });
        return;
      }
      setSaveState({
        type: "success",
        message:
          unmapped.length > 0
            ? `Mappings saved. Skipped (no GL account chosen): ${unmapped.join(", ")}.`
            : "Mappings saved.",
      });
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-(--color-text-muted)">
          {canEdit
            ? `${mappedCount} of ${rows.length} payment types have a GL account mapped. Bank Account is optional — for reconciliation reference, it doesn't change where entries post.`
            : `Read-only — only Admin can edit payment method mappings. ${mappedCount} of ${rows.length} mapped.`}
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
      <DataTable columns={columns} data={rows} searchPlaceholder="Search payment types…" />
    </div>
  );
}
