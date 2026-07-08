"use client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { NumberInput } from "@/components/ui/number-input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Button } from "@/components/ui/button";

export type VariantOption = {
  id: string;
  itemId: string;
  label: string;
  sku: string | null;
  price: number | null;
};

export type DiscountOption = {
  id: string;
  name: string;
  discountType: string;
  percentage: number | null;
  moneyAmount: number | null;
};

export type ModifierGroupOption = {
  itemId: string;
  modifierId: string;
  modifierName: string;
  options: { id: string; name: string; price: number }[];
};

export type QuoteLineRow = {
  rowId: string;
  variantId: string;
  quantity: string;
  unitPrice: string;
  discountId: string;
  discountManualValue: string;
  modifierSelections: Record<string, string>;
};

export type ResolvedQuoteLine = {
  variant_id: string;
  item_name_snapshot: string;
  sku_snapshot: string | null;
  quantity: number;
  unit_price: number;
  discount_id: string | null;
  line_discount: number;
  modifiers: { modifier_id: string; modifier_option_id: string; name_snapshot: string; price_snapshot: number }[];
};

// A discount is "variable" when Loyverse leaves the value to be entered at the point of use
// (matches how a Loyverse cashier would apply it), rather than a value fixed on the discount itself.
const VARIABLE_DISCOUNT_TYPES = ["VARIABLE_AMOUNT", "VARIABLE_PERCENT"];

export function emptyQuoteRow(): QuoteLineRow {
  return {
    rowId: crypto.randomUUID(),
    variantId: "",
    quantity: "1",
    unitPrice: "",
    discountId: "",
    discountManualValue: "",
    modifierSelections: {},
  };
}

export function modifierGroupsForItem(itemId: string | undefined, groups: ModifierGroupOption[]) {
  if (!itemId) return [];
  return groups.filter((g) => g.itemId === itemId);
}

export function resolveLineDiscount(row: QuoteLineRow, discounts: DiscountOption[]): number {
  if (!row.discountId) return 0;
  const d = discounts.find((x) => x.id === row.discountId);
  if (!d) return 0;
  const qty = Number(row.quantity) || 0;
  const price = Number(row.unitPrice) || 0;
  const lineSubtotal = qty * price;
  switch (d.discountType) {
    case "FIXED_PERCENT":
      return (lineSubtotal * (Number(d.percentage) || 0)) / 100;
    case "FIXED_AMOUNT":
      return Number(d.moneyAmount) || 0;
    case "VARIABLE_PERCENT":
      return (lineSubtotal * (Number(row.discountManualValue) || 0)) / 100;
    case "VARIABLE_AMOUNT":
      return Number(row.discountManualValue) || 0;
    default:
      return 0;
  }
}

export function modifierTotalPerUnit(row: QuoteLineRow, itemId: string | undefined, groups: ModifierGroupOption[]): number {
  const applicable = modifierGroupsForItem(itemId, groups);
  return applicable.reduce((sum, g) => {
    const selectedOptionId = row.modifierSelections[g.modifierId];
    if (!selectedOptionId) return sum;
    const opt = g.options.find((o) => o.id === selectedOptionId);
    return sum + (opt?.price ?? 0);
  }, 0);
}

export function lineTotal(
  row: QuoteLineRow,
  variantOptions: VariantOption[],
  discounts: DiscountOption[],
  groups: ModifierGroupOption[]
): number {
  const variant = variantOptions.find((v) => v.id === row.variantId);
  const qty = Number(row.quantity) || 0;
  const price = Number(row.unitPrice) || 0;
  const modTotal = modifierTotalPerUnit(row, variant?.itemId, groups);
  const discount = resolveLineDiscount(row, discounts);
  return Math.max(0, qty * (price + modTotal) - discount);
}

export function resolveQuoteLines(
  rows: QuoteLineRow[],
  variantOptions: VariantOption[],
  discounts: DiscountOption[],
  groups: ModifierGroupOption[]
): ResolvedQuoteLine[] {
  return rows
    .filter((r) => r.variantId && Number(r.quantity) > 0)
    .map((r) => {
      const variant = variantOptions.find((v) => v.id === r.variantId);
      const applicableGroups = modifierGroupsForItem(variant?.itemId, groups);
      const modifiers = applicableGroups
        .map((g) => {
          const optionId = r.modifierSelections[g.modifierId];
          if (!optionId) return null;
          const opt = g.options.find((o) => o.id === optionId);
          if (!opt) return null;
          return {
            modifier_id: g.modifierId,
            modifier_option_id: opt.id,
            name_snapshot: `${g.modifierName}: ${opt.name}`,
            price_snapshot: opt.price,
          };
        })
        .filter((m): m is NonNullable<typeof m> => m !== null);

      return {
        variant_id: r.variantId,
        item_name_snapshot: variant?.label ?? "",
        sku_snapshot: variant?.sku ?? null,
        quantity: Number(r.quantity) || 0,
        unit_price: Number(r.unitPrice) || 0,
        discount_id: r.discountId || null,
        line_discount: resolveLineDiscount(r, discounts),
        modifiers,
      };
    });
}

type Props = {
  rows: QuoteLineRow[];
  onRowsChange: (rows: QuoteLineRow[]) => void;
  variantOptions: VariantOption[];
  discounts: DiscountOption[];
  modifierGroups: ModifierGroupOption[];
};

export function QuoteLineItemsEditor({ rows, onRowsChange, variantOptions, discounts, modifierGroups }: Props) {
  function updateRow(rowId: string, patch: Partial<QuoteLineRow>) {
    onRowsChange(rows.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }

  function addRow() {
    onRowsChange([...rows, emptyQuoteRow()]);
  }

  function removeRow(rowId: string) {
    if (rows.length > 1) onRowsChange(rows.filter((r) => r.rowId !== rowId));
  }

  function handleVariantChange(rowId: string, variantId: string) {
    const variant = variantOptions.find((v) => v.id === variantId);
    updateRow(rowId, {
      variantId,
      unitPrice: variant?.price != null ? String(variant.price) : "",
      modifierSelections: {},
    });
  }

  const subtotal = rows.reduce((sum, r) => sum + lineTotal(r, variantOptions, discounts, modifierGroups), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Line Items</CardTitle>
        <CardDescription>Add each item, quantity, unit price, discount, and any modifiers.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {rows.map((row, i) => {
          const variant = variantOptions.find((v) => v.id === row.variantId);
          const discount = discounts.find((d) => d.id === row.discountId);
          const groups = modifierGroupsForItem(variant?.itemId, modifierGroups);
          const total = lineTotal(row, variantOptions, discounts, modifierGroups);

          return (
            <div key={row.rowId} className="space-y-3 border-b border-(--color-border) pb-4 last:border-0">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
                <Select
                  label={i === 0 ? "Item" : undefined}
                  value={row.variantId}
                  onChange={(e) => handleVariantChange(row.rowId, e.target.value)}
                  placeholder="Select an item…"
                  options={variantOptions.map((v) => ({
                    value: v.id,
                    label: v.sku ? `${v.label} (${v.sku})` : v.label,
                  }))}
                />
                <NumberInput
                  label={i === 0 ? "Quantity" : undefined}
                  min={0.01}
                  step="any"
                  value={row.quantity}
                  onChange={(e) => updateRow(row.rowId, { quantity: e.target.value })}
                />
                <CurrencyInput
                  label={i === 0 ? "Unit Price" : undefined}
                  value={row.unitPrice}
                  onChange={(e) => updateRow(row.rowId, { unitPrice: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="text-(--color-danger)"
                  disabled={rows.length === 1}
                  onClick={() => removeRow(row.rowId)}
                >
                  Remove
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Select
                  label="Discount"
                  placeholder="No discount"
                  value={row.discountId}
                  onChange={(e) => updateRow(row.rowId, { discountId: e.target.value, discountManualValue: "" })}
                  options={discounts.map((d) => ({ value: d.id, label: d.name }))}
                />
                {discount && VARIABLE_DISCOUNT_TYPES.includes(discount.discountType) && (
                  <CurrencyInput
                    label={discount.discountType === "VARIABLE_PERCENT" ? "Discount % " : "Discount Amount"}
                    currency={discount.discountType === "VARIABLE_PERCENT" ? "%" : "₱"}
                    value={row.discountManualValue}
                    onChange={(e) => updateRow(row.rowId, { discountManualValue: e.target.value })}
                  />
                )}
              </div>

              {groups.length > 0 && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {groups.map((g) => (
                    <Select
                      key={g.modifierId}
                      label={`Modifier(${g.modifierName})`}
                      placeholder="None"
                      value={row.modifierSelections[g.modifierId] ?? ""}
                      onChange={(e) =>
                        updateRow(row.rowId, {
                          modifierSelections: { ...row.modifierSelections, [g.modifierId]: e.target.value },
                        })
                      }
                      options={g.options.map((o) => ({
                        value: o.id,
                        label: o.price ? `${o.name} (+₱${o.price.toFixed(2)})` : o.name,
                      }))}
                    />
                  ))}
                </div>
              )}

              <p className="text-right text-xs text-(--color-text-muted)">
                Line total: <span className="font-medium text-(--color-text)">₱{total.toFixed(2)}</span>
              </p>
            </div>
          );
        })}
        <Button type="button" variant="secondary" onClick={addRow}>
          Add Row
        </Button>
      </CardContent>
      <CardFooter className="flex-col items-end gap-1 text-sm text-(--color-text-muted)">
        <p>
          Subtotal: <span className="font-medium text-(--color-text)">₱{subtotal.toFixed(2)}</span>
        </p>
      </CardFooter>
    </Card>
  );
}
