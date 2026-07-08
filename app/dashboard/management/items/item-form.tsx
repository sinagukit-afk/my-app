"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { TextArea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { NumberInput } from "@/components/ui/number-input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Button } from "@/components/ui/button";
import { upsertItem } from "./actions";

export type CategoryOption = { id: string; name: string };
export type SupplierOption = { id: string; name: string };
export type ModifierOption = { id: string; name: string; options: string[] };
export type ComponentPickerOption = { id: string; label: string; sku: string | null };

export type ExistingComponent = {
  component_variant_id: string;
  quantity: number;
};

export type ExistingVariant = {
  id: string;
  sku: string;
  barcode: string | null;
  option1_value: string | null;
  option2_value: string | null;
  option3_value: string | null;
  cost: number | null;
  default_price: number | null;
  pricing_type: "FIXED" | "VARIABLE";
  default_purchase_cost: number | null;
  in_stock: number | null;
  low_stock_threshold: number | null;
  components: ExistingComponent[];
};

export type ItemFormInitial = {
  name: string;
  category_id: string | null;
  description: string | null;
  item_type: "simple" | "composite";
  sold_by: "each" | "weight";
  is_available_for_sale: boolean;
  track_stock: boolean;
  primary_supplier_id: string | null;
  option1_name: string | null;
  option2_name: string | null;
  option3_name: string | null;
  variants: ExistingVariant[];
  modifier_ids: string[];
};

type Props = {
  mode: "create" | "edit";
  itemId?: string;
  categories: CategoryOption[];
  suppliers: SupplierOption[];
  modifiers: ModifierOption[];
  componentOptions: ComponentPickerOption[];
  initial?: ItemFormInitial;
};

type ComponentRow = {
  rowId: string;
  component_variant_id: string;
  quantity: string;
};

type VariantRow = {
  rowId: string;
  id?: string;
  option1_value: string;
  option2_value: string;
  option3_value: string;
  sku: string;
  barcode: string;
  cost: string;
  default_price: string;
  pricing_type: "FIXED" | "VARIABLE";
  default_purchase_cost: number | null;
  in_stock: number | null;
  initial_stock: string;
  low_stock_threshold: string;
  components: ComponentRow[];
};

function emptyVariantRow(option1_value = "", option2_value = "", option3_value = ""): VariantRow {
  return {
    rowId: crypto.randomUUID(),
    option1_value,
    option2_value,
    option3_value,
    sku: "",
    barcode: "",
    cost: "",
    default_price: "",
    pricing_type: "VARIABLE",
    default_purchase_cost: null,
    in_stock: null,
    initial_stock: "",
    low_stock_threshold: "",
    components: [],
  };
}

function emptyComponentRow(): ComponentRow {
  return { rowId: crypto.randomUUID(), component_variant_id: "", quantity: "1" };
}

function seedRows(initial: ItemFormInitial | undefined): VariantRow[] {
  if (!initial || initial.variants.length === 0) return [emptyVariantRow()];
  return initial.variants.map((v) => ({
    rowId: crypto.randomUUID(),
    id: v.id,
    option1_value: v.option1_value ?? "",
    option2_value: v.option2_value ?? "",
    option3_value: v.option3_value ?? "",
    sku: v.sku,
    barcode: v.barcode ?? "",
    cost: v.cost != null ? String(v.cost) : "",
    default_price: v.default_price != null ? String(v.default_price) : "",
    pricing_type: v.pricing_type,
    default_purchase_cost: v.default_purchase_cost,
    in_stock: v.in_stock,
    initial_stock: "",
    low_stock_threshold: v.low_stock_threshold != null ? String(v.low_stock_threshold) : "",
    components: v.components.map((c) => ({
      rowId: crypto.randomUUID(),
      component_variant_id: c.component_variant_id,
      quantity: String(c.quantity),
    })),
  }));
}

function parseValues(s: string): string[] {
  return s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function ItemForm({
  mode,
  itemId,
  categories,
  suppliers,
  modifiers,
  componentOptions,
  initial,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [itemType, setItemType] = useState<"simple" | "composite">(initial?.item_type ?? "simple");
  const [trackStock, setTrackStock] = useState(initial?.track_stock ?? false);
  const [isAvailableForSale, setIsAvailableForSale] = useState(initial?.is_available_for_sale ?? true);
  const [option1Name, setOption1Name] = useState(initial?.option1_name ?? "");
  const [option2Name, setOption2Name] = useState(initial?.option2_name ?? "");
  const [option3Name, setOption3Name] = useState(initial?.option3_name ?? "");
  const [option1Values, setOption1Values] = useState("");
  const [option2Values, setOption2Values] = useState("");
  const [option3Values, setOption3Values] = useState("");
  const [rows, setRows] = useState<VariantRow[]>(() => seedRows(initial));
  const [selectedModifierIds, setSelectedModifierIds] = useState<string[]>(
    initial?.modifier_ids ?? []
  );

  useEffect(() => {
    if (itemType === "composite" && trackStock) setTrackStock(false);
  }, [itemType, trackStock]);

  function updateRow(rowId: string, patch: Partial<VariantRow>) {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }

  function removeRow(rowId: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.rowId !== rowId) : prev));
  }

  function generateVariants() {
    const l1 = option1Name.trim() ? parseValues(option1Values) : [];
    const l2 = option2Name.trim() ? parseValues(option2Values) : [];
    const l3 = option3Name.trim() ? parseValues(option3Values) : [];
    const combos: [string, string, string][] = [];
    for (const a of l1.length ? l1 : [""]) {
      for (const b of l2.length ? l2 : [""]) {
        for (const c of l3.length ? l3 : [""]) {
          combos.push([a, b, c]);
        }
      }
    }

    setRows((prev) => {
      const existingByKey = new Map(
        prev.map((r) => [`${r.option1_value}|${r.option2_value}|${r.option3_value}`, r])
      );
      return combos.map(([a, b, c]) => existingByKey.get(`${a}|${b}|${c}`) ?? emptyVariantRow(a, b, c));
    });
  }

  function addComponent(rowId: string) {
    setRows((prev) =>
      prev.map((r) => (r.rowId === rowId ? { ...r, components: [...r.components, emptyComponentRow()] } : r))
    );
  }

  function updateComponent(rowId: string, compRowId: string, patch: Partial<ComponentRow>) {
    setRows((prev) =>
      prev.map((r) =>
        r.rowId === rowId
          ? {
              ...r,
              components: r.components.map((c) => (c.rowId === compRowId ? { ...c, ...patch } : c)),
            }
          : r
      )
    );
  }

  function removeComponent(rowId: string, compRowId: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.rowId === rowId ? { ...r, components: r.components.filter((c) => c.rowId !== compRowId) } : r
      )
    );
  }

  function toggleModifier(id: string, checked: boolean) {
    setSelectedModifierIds((prev) => (checked ? [...prev, id] : prev.filter((m) => m !== id)));
  }

  const ownVariantIds = new Set(rows.map((r) => r.id).filter((id): id is string => !!id));
  const availableComponentOptions = componentOptions.filter((v) => !ownVariantIds.has(v.id));

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    if (rows.length === 0) {
      alert("Add at least one variant.");
      return;
    }
    for (const r of rows) {
      if (!r.sku.trim()) {
        alert("Every variant needs a SKU.");
        return;
      }
      if (r.pricing_type === "FIXED" && !r.default_price) {
        alert(`Default price is required for SKU "${r.sku}" (Fixed pricing).`);
        return;
      }
    }
    if (itemType === "composite") {
      for (const r of rows) {
        const validComponents = r.components.filter((c) => c.component_variant_id);
        if (validComponents.length === 0) {
          alert(`Composite variant "${r.sku}" needs at least one component.`);
          return;
        }
        if (validComponents.some((c) => ownVariantIds.has(c.component_variant_id))) {
          alert("A component can't be one of this item's own variants.");
          return;
        }
      }
    }

    const variantsPayload = rows.map((r) => ({
      id: r.id,
      sku: r.sku,
      barcode: r.barcode || undefined,
      option1_value: r.option1_value || undefined,
      option2_value: r.option2_value || undefined,
      option3_value: r.option3_value || undefined,
      cost: r.cost === "" ? null : Number(r.cost),
      default_price: r.default_price === "" ? null : Number(r.default_price),
      pricing_type: r.pricing_type,
      initial_stock:
        mode === "create" && trackStock ? Number(r.initial_stock || 0) : undefined,
      low_stock_threshold:
        trackStock && r.low_stock_threshold !== "" ? Number(r.low_stock_threshold) : null,
    }));

    const componentsPayload =
      itemType === "composite"
        ? rows.flatMap((r) =>
            r.components
              .filter((c) => c.component_variant_id)
              .map((c) => ({
                composite_sku: r.sku,
                component_variant_id: c.component_variant_id,
                quantity: Number(c.quantity || 1),
              }))
          )
        : [];

    formData.set("is_available_for_sale", String(isAvailableForSale));
    formData.set("track_stock", String(trackStock));
    formData.set("variants_json", JSON.stringify(variantsPayload));
    formData.set("components_json", JSON.stringify(componentsPayload));
    formData.set("modifier_ids_json", JSON.stringify(selectedModifierIds));

    startTransition(async () => {
      const res = await upsertItem(formData);
      if (res.success) {
        router.push("/dashboard/management/items");
      } else {
        alert(res.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PageHeader
        title={mode === "create" ? "Add Item" : "Edit Item"}
        description="Matches Loyverse field-for-field. Saving pushes the item to Loyverse."
      />

      {itemId && <input type="hidden" name="item_id" value={itemId} />}

      <Card>
        <CardHeader>
          <CardTitle>Core Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Item Name" id="name" name="name" defaultValue={initial?.name ?? ""} required />
            <Select
              label="Category"
              name="category_id"
              defaultValue={initial?.category_id ?? ""}
              placeholder="Select a category…"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              required
            />
          </div>

          <TextArea label="Description" name="description" defaultValue={initial?.description ?? ""} rows={2} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Select
              label="Item Type"
              name="item_type"
              value={itemType}
              onChange={(e) => setItemType(e.target.value as "simple" | "composite")}
              options={[
                { value: "simple", label: "Simple" },
                { value: "composite", label: "Composite" },
              ]}
            />
            <Select
              label="Sold By"
              name="sold_by"
              defaultValue={initial?.sold_by ?? "each"}
              options={[
                { value: "each", label: "Each" },
                { value: "weight", label: "Weight" },
              ]}
            />
            <Select
              label="Primary Supplier"
              name="primary_supplier_id"
              defaultValue={initial?.primary_supplier_id ?? ""}
              placeholder="None"
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
            />
          </div>

          <div className="flex flex-wrap gap-6">
            <Checkbox
              label="Available for Sale"
              checked={isAvailableForSale}
              onChange={setIsAvailableForSale}
            />
            <Checkbox
              label="Track Stock"
              checked={trackStock}
              onChange={setTrackStock}
              disabled={itemType === "composite"}
              description={itemType === "composite" ? "Composite items never track stock directly." : undefined}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Variant Matrix</CardTitle>
          <CardDescription>
            Up to 3 options. Leave a name blank to skip it. Generating re-uses existing rows for
            option combinations you keep.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Input
                placeholder="Option 1 name (e.g. Size)"
                value={option1Name}
                onChange={(e) => setOption1Name(e.target.value)}
              />
              <input name="option1_name" type="hidden" value={option1Name} readOnly />
              <Input
                placeholder="Values, comma separated"
                value={option1Values}
                onChange={(e) => setOption1Values(e.target.value)}
                disabled={!option1Name.trim()}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Input
                placeholder="Option 2 name"
                value={option2Name}
                onChange={(e) => setOption2Name(e.target.value)}
              />
              <input name="option2_name" type="hidden" value={option2Name} readOnly />
              <Input
                placeholder="Values, comma separated"
                value={option2Values}
                onChange={(e) => setOption2Values(e.target.value)}
                disabled={!option2Name.trim()}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Input
                placeholder="Option 3 name"
                value={option3Name}
                onChange={(e) => setOption3Name(e.target.value)}
              />
              <input name="option3_name" type="hidden" value={option3Name} readOnly />
              <Input
                placeholder="Values, comma separated"
                value={option3Values}
                onChange={(e) => setOption3Values(e.target.value)}
                disabled={!option3Name.trim()}
              />
            </div>
          </div>
          <Button type="button" variant="secondary" onClick={generateVariants}>
            Generate Variants
          </Button>

          <div className="space-y-6">
            {rows.map((row) => (
              <div key={row.rowId} className="rounded-md border border-(--color-border) p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-(--color-text)">
                    {[row.option1_value, row.option2_value, row.option3_value].filter(Boolean).join(" / ") ||
                      "Default"}
                  </p>
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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Input
                    label="SKU"
                    value={row.sku}
                    onChange={(e) => updateRow(row.rowId, { sku: e.target.value })}
                    required
                  />
                  <Input
                    label="Barcode"
                    value={row.barcode}
                    onChange={(e) => updateRow(row.rowId, { barcode: e.target.value })}
                  />
                  <CurrencyInput
                    label="Cost"
                    value={row.cost}
                    onChange={(e) => updateRow(row.rowId, { cost: e.target.value })}
                  />
                  {row.default_purchase_cost != null && (
                    <CurrencyInput label="Default Purchase Cost" value={row.default_purchase_cost} disabled />
                  )}
                  <Select
                    label="Pricing Type"
                    value={row.pricing_type}
                    onChange={(e) =>
                      updateRow(row.rowId, { pricing_type: e.target.value as "FIXED" | "VARIABLE" })
                    }
                    options={[
                      { value: "VARIABLE", label: "Variable" },
                      { value: "FIXED", label: "Fixed" },
                    ]}
                  />
                  <CurrencyInput
                    label="Default Price"
                    value={row.default_price}
                    onChange={(e) => updateRow(row.rowId, { default_price: e.target.value })}
                    disabled={row.pricing_type !== "FIXED"}
                  />
                  {mode === "create" && trackStock && (
                    <NumberInput
                      label="Initial Stock"
                      min={0}
                      value={row.initial_stock}
                      onChange={(e) => updateRow(row.rowId, { initial_stock: e.target.value })}
                    />
                  )}
                  {mode === "edit" && trackStock && (
                    <p className="flex items-end pb-1 text-sm text-(--color-text-muted)">
                      Current stock: <span className="ml-1 font-medium text-(--color-text)">{row.in_stock ?? 0}</span>
                      <Link href="/dashboard/inventory/adjustment" className="ml-2 text-(--color-primary) underline">
                        Adjust Stock
                      </Link>
                    </p>
                  )}
                  {trackStock && (
                    <NumberInput
                      label="Minimum Stock"
                      min={0}
                      value={row.low_stock_threshold}
                      onChange={(e) => updateRow(row.rowId, { low_stock_threshold: e.target.value })}
                    />
                  )}
                </div>

                {itemType === "composite" && (
                  <div className="space-y-2 border-t border-(--color-border) pt-3">
                    <p className="text-sm font-medium text-(--color-text)">Components</p>
                    {row.components.map((c) => (
                      <div key={c.rowId} className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
                        <Select
                          placeholder="Select a component…"
                          value={c.component_variant_id}
                          onChange={(e) => updateComponent(row.rowId, c.rowId, { component_variant_id: e.target.value })}
                          options={availableComponentOptions.map((v) => ({
                            value: v.id,
                            label: v.sku ? `${v.label} (${v.sku})` : v.label,
                          }))}
                        />
                        <NumberInput
                          min={0.01}
                          step="any"
                          value={c.quantity}
                          onChange={(e) => updateComponent(row.rowId, c.rowId, { quantity: e.target.value })}
                        />
                        <Button type="button" variant="ghost" className="text-(--color-danger)" onClick={() => removeComponent(row.rowId, c.rowId)}>
                          Remove
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="secondary" size="sm" onClick={() => addComponent(row.rowId)}>
                      Add Component
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Modifiers</CardTitle>
          <CardDescription>Assign existing Loyverse modifier lists. Managed in Loyverse backoffice.</CardDescription>
        </CardHeader>
        <CardContent className="max-h-64 space-y-2 overflow-y-auto">
          {modifiers.length === 0 && <p className="text-sm text-(--color-text-muted)">No modifiers available.</p>}
          {modifiers.map((m) => (
            <Checkbox
              key={m.id}
              label={m.name}
              description={m.options.length > 0 ? m.options.join(", ") : undefined}
              checked={selectedModifierIds.includes(m.id)}
              onChange={(checked) => toggleModifier(m.id, checked)}
            />
          ))}
        </CardContent>
      </Card>

      <CardFooter className="flex justify-end gap-2 px-0">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : mode === "create" ? "Create Item" : "Save Changes"}
        </Button>
      </CardFooter>
    </form>
  );
}
