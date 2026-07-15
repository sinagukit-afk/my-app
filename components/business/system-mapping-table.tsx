"use client";

import { useState, useTransition } from "react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export type AccountOption = { id: string; account_number: string; name: string; category: string };

export type SystemMappingRow = {
  mapping_key: string;
  label: string;
  account_id: string;
  /** accounts.category this mapping's picker should be filtered to (e.g. "revenue", "expense", "liability") */
  account_category: string;
};

export type SaveResult = { success: true } | { success: false; error: string };

type Props = {
  rows: SystemMappingRow[];
  accounts: AccountOption[];
  canEdit: boolean;
  onSave: (rows: { mapping_key: string; account_id: string | null }[]) => Promise<SaveResult>;
};

export function SystemMappingTable({ rows: initialRows, accounts, canEdit, onSave }: Props) {
  const [rows, setRows] = useState(initialRows);
  const [isPending, startTransition] = useTransition();
  const [saveState, setSaveState] = useState<{ type: "idle" | "success" | "error"; message?: string }>({
    type: "idle",
  });

  function updateRow(mapping_key: string, account_id: string) {
    setRows((prev) => prev.map((r) => (r.mapping_key === mapping_key ? { ...r, account_id } : r)));
  }

  function optionsFor(category: string) {
    return accounts
      .filter((a) => a.category === category)
      .map((a) => ({ value: a.id, label: `${a.account_number} — ${a.name}` }));
  }

  const columns: Column<SystemMappingRow>[] = [
    { key: "label", header: "Mapping", sortable: true },
    {
      key: "account_id",
      header: "GL Account",
      render: (_v, row) => (
        <Select
          value={row.account_id}
          onChange={(e) => updateRow(row.mapping_key, e.target.value)}
          placeholder="Not mapped"
          options={optionsFor(row.account_category)}
          disabled={!canEdit}
          className="min-w-[260px]"
        />
      ),
    },
  ];

  const mappedCount = rows.filter((r) => r.account_id).length;

  function handleSave() {
    setSaveState({ type: "idle" });
    const unmapped = rows.filter((r) => !r.account_id).map((r) => r.label);
    const payload = rows.map((r) => ({ mapping_key: r.mapping_key, account_id: r.account_id || null }));

    startTransition(async () => {
      const res = await onSave(payload);
      if (!res.success) {
        setSaveState({ type: "error", message: res.error });
        return;
      }
      setSaveState({
        type: "success",
        message:
          unmapped.length > 0
            ? `Mappings saved. Left unmapped: ${unmapped.join(", ")} — related postings will be skipped until mapped.`
            : "Mappings saved.",
      });
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-(--color-text-muted)">
          {canEdit
            ? `${mappedCount} of ${rows.length} mapped.`
            : `Read-only — only Admin can edit these mappings. ${mappedCount} of ${rows.length} mapped.`}
        </p>
        {canEdit && (
          <div className="flex items-center gap-3">
            {saveState.type === "success" && (
              <span className="text-sm text-(--color-success)">{saveState.message}</span>
            )}
            {saveState.type === "error" && <span className="text-sm text-(--color-danger)">{saveState.message}</span>}
            <Button type="button" onClick={handleSave} disabled={isPending}>
              {isPending ? "Saving…" : "Save Mappings"}
            </Button>
          </div>
        )}
      </div>
      <DataTable columns={columns} data={rows} searchable={false} />
    </div>
  );
}
