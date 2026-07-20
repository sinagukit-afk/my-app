"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { NumberInput } from "@/components/ui/number-input";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/format";
import { randomId } from "@/lib/utils/random-id";
import { updateComponents } from "../actions";

export type ComponentOption = {
  id: string;
  label: string;
  sku: string | null;
  cost: number | null;
};

export type BomEditorVariant = {
  id: string;
  sku: string;
  options: string | null;
  default_price: number | null;
  pricing_type: "FIXED" | "VARIABLE";
  components: { component_variant_id: string; quantity: number }[];
};

type ComponentRow = {
  rowId: string;
  component_variant_id: string;
  quantity: string;
};

type VariantState = {
  id: string;
  sku: string;
  options: string | null;
  default_price: number | null;
  pricing_type: "FIXED" | "VARIABLE";
  rows: ComponentRow[];
};

type Props = {
  itemId: string;
  itemName: string;
  category: string | null;
  variants: BomEditorVariant[];
  componentOptions: ComponentOption[];
};

function emptyRow(): ComponentRow {
  return { rowId: randomId(), component_variant_id: "", quantity: "1" };
}

export function BomEditor({ itemId, itemName, category, variants, componentOptions }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [state, setState] = useState<VariantState[]>(() =>
    variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      options: v.options,
      default_price: v.default_price,
      pricing_type: v.pricing_type,
      rows:
        v.components.length > 0
          ? v.components.map((c) => ({
              rowId: randomId(),
              component_variant_id: c.component_variant_id,
              quantity: String(c.quantity),
            }))
          : [emptyRow()],
    }))
  );

  const costById = useMemo(() => new Map(componentOptions.map((c) => [c.id, c.cost])), [componentOptions]);

  function addRow(variantId: string) {
    setState((prev) =>
      prev.map((v) => (v.id === variantId ? { ...v, rows: [...v.rows, emptyRow()] } : v))
    );
  }

  function updateRow(variantId: string, rowId: string, patch: Partial<ComponentRow>) {
    setState((prev) =>
      prev.map((v) =>
        v.id === variantId
          ? { ...v, rows: v.rows.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)) }
          : v
      )
    );
  }

  function removeRow(variantId: string, rowId: string) {
    setState((prev) =>
      prev.map((v) => (v.id === variantId ? { ...v, rows: v.rows.filter((r) => r.rowId !== rowId) } : v))
    );
  }

  function variantCost(v: VariantState): number {
    return v.rows.reduce((sum, r) => {
      if (!r.component_variant_id) return sum;
      const cost = costById.get(r.component_variant_id) ?? 0;
      return sum + cost * Number(r.quantity || 0);
    }, 0);
  }

  function handleSubmit() {
    setError(null);

    for (const v of state) {
      const validRows = v.rows.filter((r) => r.component_variant_id);
      if (validRows.length === 0) {
        setError(`"${v.sku}" needs at least one component.`);
        return;
      }
      if (validRows.some((r) => r.component_variant_id === v.id)) {
        setError(`"${v.sku}" can't include itself as a component.`);
        return;
      }
      if (validRows.some((r) => !r.quantity || Number(r.quantity) <= 0)) {
        setError(`"${v.sku}" has a component with an invalid quantity.`);
        return;
      }
    }

    const payload = state.map((v) => ({
      variant_id: v.id,
      components: v.rows
        .filter((r) => r.component_variant_id)
        .map((r) => ({ component_variant_id: r.component_variant_id, quantity: Number(r.quantity || 1) })),
    }));

    startTransition(async () => {
      const res = await updateComponents(itemId, payload);
      if (res.success) {
        router.push("/dashboard/management/product-bom");
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit BOM — ${itemName}`}
        description={category ?? undefined}
        actions={
          <Link href="/dashboard/management/product-bom">
            <Button variant="secondary">Back to Product BOM</Button>
          </Link>
        }
      />

      {state.map((v) => {
        const ownId = v.id;
        const options = componentOptions
          .filter((c) => c.id !== ownId)
          .map((c) => ({
            value: c.id,
            label: c.sku ? `${c.label} (${c.sku})` : c.label,
            keywords: c.sku ?? undefined,
          }));
        const cost = variantCost(v);
        const margin =
          v.pricing_type === "FIXED" && v.default_price !== null ? v.default_price - cost : null;

        return (
          <Card key={v.id}>
            <CardHeader>
              <CardTitle>
                {v.sku}
                {v.options && <span className="ml-2 font-normal text-(--color-text-muted)">{v.options}</span>}
              </CardTitle>
              <CardDescription>
                Price: {v.pricing_type === "FIXED" && v.default_price !== null ? formatCurrency(v.default_price) : "Variable"}
                {" · "}
                Cost: {formatCurrency(cost)}
                {margin !== null && (
                  <>
                    {" · "}
                    Margin:{" "}
                    <span className={margin < 0 ? "text-(--color-danger)" : undefined}>{formatCurrency(margin)}</span>
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {v.rows.map((r) => (
                <div key={r.rowId} className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
                  <Combobox
                    placeholder="Select a component…"
                    value={r.component_variant_id}
                    onValueChange={(value) => updateRow(v.id, r.rowId, { component_variant_id: value })}
                    options={options}
                  />
                  <NumberInput
                    min={0.01}
                    step="any"
                    decimals={3}
                    value={r.quantity}
                    onChange={(e) => updateRow(v.id, r.rowId, { quantity: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-(--color-danger)"
                    onClick={() => removeRow(v.id, r.rowId)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button type="button" variant="secondary" size="sm" onClick={() => addRow(v.id)}>
                Add Component
              </Button>
            </CardContent>
          </Card>
        );
      })}

      <CardFooter className="flex items-center justify-end gap-2 px-0">
        {error && <p className="mr-auto text-sm text-(--color-danger)">{error}</p>}
        <Button type="button" onClick={handleSubmit} disabled={isPending}>
          {isPending ? "Saving…" : "Save BOM"}
        </Button>
      </CardFooter>
    </div>
  );
}
