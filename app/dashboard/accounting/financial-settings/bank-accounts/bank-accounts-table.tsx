"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useNotifications } from "@/components/providers/notification-provider";
import { BankAccountForm } from "./bank-account-form";
import { setBankAccountActive } from "./actions";

export type BankAccountRow = {
  id: string;
  name: string;
  bank: string;
  account_number_masked: string | null;
  gl_account_id: string;
  gl_account_label: string;
  currency: string;
  is_active: boolean;
};

type GlAccountOption = { value: string; label: string };

type Props = {
  data: BankAccountRow[];
  glAccountOptions: GlAccountOption[];
  canWrite: boolean;
};

export function BankAccountsTable({ data, glAccountOptions, canWrite }: Props) {
  const router = useRouter();
  const { notify } = useNotifications();
  const [isPending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccountRow | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<BankAccountRow | null>(null);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: BankAccountRow) {
    setEditing(row);
    setFormOpen(true);
  }

  function refresh() {
    router.refresh();
  }

  function handleDeactivate() {
    if (!deactivateTarget) return;
    setDeactivateError(null);
    startTransition(async () => {
      const res = await setBankAccountActive(deactivateTarget.id, false);
      if (res.success) {
        setDeactivateTarget(null);
        refresh();
      } else {
        setDeactivateError(res.error);
      }
    });
  }

  async function handleReactivate(row: BankAccountRow) {
    const res = await setBankAccountActive(row.id, true);
    if (!res.success) notify(res.error, "error");
    else refresh();
  }

  const columns: Column<BankAccountRow>[] = [
    { key: "name", header: "Name", sortable: true },
    { key: "bank", header: "Bank", sortable: true },
    {
      key: "account_number_masked",
      header: "Account #",
      render: (value) => (value ? String(value) : <span className="text-(--color-text-subtle)">—</span>),
    },
    { key: "gl_account_label", header: "GL Account", sortable: true },
    { key: "currency", header: "Currency" },
    {
      key: "is_active",
      header: "Status",
      sortable: true,
      render: (value) => <Badge variant={value ? "success" : "neutral"}>{value ? "Active" : "Inactive"}</Badge>,
    },
    {
      key: "id",
      header: "Actions",
      render: (_value, row) => (
        <div className="flex items-center gap-2">
          {canWrite && (
            <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
              Edit
            </Button>
          )}
          {canWrite && row.is_active && (
            <Button
              variant="ghost"
              size="sm"
              className="text-(--color-danger)"
              onClick={() => {
                setDeactivateTarget(row);
                setDeactivateError(null);
              }}
            >
              Deactivate
            </Button>
          )}
          {canWrite && !row.is_active && (
            <Button variant="ghost" size="sm" onClick={() => handleReactivate(row)}>
              Reactivate
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bank Accounts"
        description="Real bank/cash accounts, each linked to a Chart of Accounts asset account. Used by Payment Methods for reconciliation-ready posting."
        actions={canWrite ? <Button onClick={openAdd}>Add Bank Account</Button> : undefined}
      />

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search bank accounts…"
        emptyMessage="No bank accounts yet"
        emptyDescription="Add your first bank account to get started."
      />

      {canWrite && (
        <BankAccountForm
          open={formOpen}
          onOpenChange={setFormOpen}
          bankAccount={editing}
          glAccountOptions={glAccountOptions}
          onSaved={refresh}
        />
      )}

      <Dialog
        open={!!deactivateTarget}
        onOpenChange={(next) => {
          if (!next) {
            setDeactivateTarget(null);
            setDeactivateError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Bank Account</DialogTitle>
            <DialogDescription>
              Deactivate &quot;{deactivateTarget?.name}&quot;? It will stop showing up as an option on
              Payment Methods.
            </DialogDescription>
          </DialogHeader>
          {deactivateError && <p className="text-sm text-(--color-danger)">{deactivateError}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" variant="danger" onClick={handleDeactivate} disabled={isPending}>
              {isPending ? "Deactivating…" : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
