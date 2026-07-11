"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Button } from "@/components/ui/button";
import { createModifier, updateModifier, type ActionResult } from "./actions";
import type { ModifierRow } from "./product-modifiers-table";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modifier?: ModifierRow | null;
  onSaved: () => void;
};

type OptionRowState = { key: string; id?: string; name: string; price: string };

let rowKeySeq = 0;
function newRowKey() {
  rowKeySeq += 1;
  return `new-${rowKeySeq}`;
}

function seedRows(modifier?: ModifierRow | null): OptionRowState[] {
  if (!modifier) return [];
  return modifier.modifier_options.map((o) => ({
    key: o.id,
    id: o.id,
    name: o.name,
    price: String(o.price),
  }));
}

export function ModifierForm({ open, onOpenChange, modifier, onSaved }: Props) {
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<OptionRowState[]>(() => seedRows(modifier));
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(modifier);

  function addRow() {
    setRows((prev) => [...prev, { key: newRowKey(), name: "", price: "0" }]);
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function updateRow(key: string, patch: Partial<OptionRowState>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const optionsPayload = rows
      .filter((r) => r.name.trim())
      .map((r) => ({ id: r.id, name: r.name.trim(), price: Number(r.price) || 0 }));
    formData.set("options_json", JSON.stringify(optionsPayload));

    startTransition(async () => {
      const res: ActionResult = isEdit
        ? await updateModifier(modifier!.id, formData)
        : await createModifier(formData);

      if (res.success) {
        onSaved();
        onOpenChange(false);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit Modifier" : "Add Modifier"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update this modifier's name and options."
                : "Add a new modifier group with one or more options."}
            </DialogDescription>
          </DialogHeader>

          <Input
            label="Modifier Name"
            name="name"
            defaultValue={modifier?.name ?? ""}
            required
            autoFocus
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-(--color-text)">Options</label>
              <Button type="button" variant="secondary" size="sm" onClick={addRow}>
                Add Option
              </Button>
            </div>

            {rows.length === 0 && (
              <p className="text-xs text-(--color-text-subtle)">No options yet — add at least one.</p>
            )}

            <div className="space-y-2">
              {rows.map((row) => (
                <div key={row.key} className="flex items-end gap-2">
                  <div className="flex-1">
                    <Input
                      id={`option-name-${row.key}`}
                      label={row.key === rows[0]?.key ? "Option Name" : undefined}
                      value={row.name}
                      onChange={(e) => updateRow(row.key, { name: e.target.value })}
                      placeholder="e.g. Simple Text"
                    />
                  </div>
                  <div className="w-32">
                    <CurrencyInput
                      id={`option-price-${row.key}`}
                      label={row.key === rows[0]?.key ? "Price" : undefined}
                      value={row.price}
                      onChange={(e) => updateRow(row.key, { price: e.target.value })}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-(--color-danger)"
                    onClick={() => removeRow(row.key)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {isEdit && modifier?.loyverse_modifier_id && (
            <p className="text-xs text-(--color-text-subtle)">
              This modifier is pulled from Loyverse. Local edits here won&apos;t push back to
              Loyverse and may be overwritten if this modifier is later changed there.
            </p>
          )}

          {error && <p className="text-sm text-(--color-danger)">{error}</p>}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Modifier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
