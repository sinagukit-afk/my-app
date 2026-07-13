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
import { randomId } from "@/lib/utils/random-id";

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
  ai_match_keywords: string | null;
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
  id?: string;
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

function emptyVariantRow(): VariantRow {
  return {
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
  return { rowId: randomId(), component_variant_id: "", quantity: "1" };
}

function seedVariant(initial: ItemFormInitial | undefined): VariantRow {
  const v = initial?.variants[0];
  if (!v) return emptyVariantRow();
  return {
    id: v.id,
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
      rowId: randomId(),
      component_variant_id: c.component_variant_id,
      quantity: String(c.quantity),
    })),
  };
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
  const [error, setError] = useState<string | null>(null);

  const [itemType, setItemType] = useState<"simple" | "composite">(initial?.item_type ?? "simple");
  const [trackStock, setTrackStock] = useState(initial?.track_stock ?? false);
  const [isAvailableForSale, setIsAvailableForSale] = useState(initial?.is_available_for_sale ?? true);
  const [variant, setVariant] = useState<VariantRow>(() => seedVariant(initial));
  const [selectedModifierIds, setSelectedModifierIds] = useState<string[]>(
    initial?.modifier_ids ?? []
  );

  useEffect(() => {
    if (itemType === "composite" && trackStock) setTrackStock(false);
  }, [itemType, trackStock]);

  function updateVariant(patch: Partial<VariantRow>) {
    setVariant((prev) => ({ ...prev, ...patch }));
  }

  function addComponent() {
    setVariant((prev) => ({ ...prev, components: [...prev.components, emptyComponentRow()] }));
  }

  function updateComponent(compRowId: string, patch: Partial<ComponentRow>) {
    setVariant((prev) => ({
      ...prev,
      components: prev.components.map((c) => (c.rowId === compRowId ? { ...c, ...patch } : c)),
    }));
  }

  function removeComponent(compRowId: string) {
    setVariant((prev) => ({
      ...prev,
      components: prev.components.filter((c) => c.rowId !== compRowId),
    }));
  }

  function toggleModifier(id: string, checked: boolean) {
    setSelectedModifierIds((prev) => (checked ? [...prev, id] : prev.filter((m) => m !== id)));
  }

  const ownVariantIds = new Set(variant.id ? [variant.id] : []);
  const availableComponentOptions = componentOptions.filter((v) => !ownVariantIds.has(v.id));

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    if (!variant.sku.trim()) {
      setError("A SKU is required.");
      return;
    }
    if (variant.pricing_type === "FIXED" && !variant.default_price) {
      setError(`Default price is required for SKU "${variant.sku}" (Fixed pricing).`);
      return;
    }
    if (itemType === "composite") {
      const validComponents = variant.components.filter((c) => c.component_variant_id);
      if (validComponents.length === 0) {
        setError(`Composite item "${variant.sku}" needs at least one component.`);
        return;
      }
      if (validComponents.some((c) => ownVariantIds.has(c.component_variant_id))) {
        setError("A component can't be this item's own variant.");
        return;
      }
    }

    const variantsPayload = [
      {
        id: variant.id,
        sku: variant.sku,
        barcode: variant.barcode || undefined,
        cost: variant.cost === "" ? null : Number(variant.cost),
        default_price: variant.default_price === "" ? null : Number(variant.default_price),
        pricing_type: variant.pricing_type,
        initial_stock:
          mode === "create" && trackStock ? Number(variant.initial_stock || 0) : undefined,
        low_stock_threshold:
          trackStock && variant.low_stock_threshold !== "" ? Number(variant.low_stock_threshold) : null,
      },
    ];

    const componentsPayload =
      itemType === "composite"
        ? variant.components
            .filter((c) => c.component_variant_id)
            .map((c) => ({
              composite_sku: variant.sku,
              component_variant_id: c.component_variant_id,
              quantity: Number(c.quantity || 1),
            }))
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
        setError(res.error);
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

          <TextArea
            label="AI Match Keywords (optional)"
            name="ai_match_keywords"
            defaultValue={initial?.ai_match_keywords ?? ""}
            rows={2}
            placeholder="e.g. beech wood craft, pinewood blank, ref magnet wood — comma separated"
          />
          <p className="-mt-3 text-xs text-(--color-text-muted)">
            Alternate names or phrasing this item might appear as on a supplier invoice or delivery photo.
            Helps AI Auto-Fill match it even if the picture doesn&apos;t use this item&apos;s exact registered
            name. Not shown in Loyverse.
          </p>

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
          <CardTitle>Pricing & Stock</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label="SKU"
              value={variant.sku}
              onChange={(e) => updateVariant({ sku: e.target.value })}
              required
            />
            <Input
              label="Barcode"
              value={variant.barcode}
              onChange={(e) => updateVariant({ barcode: e.target.value })}
            />
            <CurrencyInput
              label="Cost"
              value={variant.cost}
              onChange={(e) => updateVariant({ cost: e.target.value })}
            />
            {variant.default_purchase_cost != null && (
              <CurrencyInput label="Default Purchase Cost" value={variant.default_purchase_cost} disabled />
            )}
            <Select
              label="Pricing Type"
              value={variant.pricing_type}
              onChange={(e) =>
                updateVariant({ pricing_type: e.target.value as "FIXED" | "VARIABLE" })
              }
              options={[
                { value: "VARIABLE", label: "Variable" },
                { value: "FIXED", label: "Fixed" },
              ]}
            />
            <CurrencyInput
              label="Default Price"
              value={variant.default_price}
              onChange={(e) => updateVariant({ default_price: e.target.value })}
              disabled={variant.pricing_type !== "FIXED"}
            />
            {mode === "create" && trackStock && (
              <NumberInput
                label="Initial Stock"
                min={0}
                step="0.001"
                decimals={3}
                value={variant.initial_stock}
                onChange={(e) => updateVariant({ initial_stock: e.target.value })}
              />
            )}
            {mode === "edit" && trackStock && (
              <p className="flex items-end pb-1 text-sm text-(--color-text-muted)">
                Current stock: <span className="ml-1 font-medium text-(--color-text)">{variant.in_stock ?? 0}</span>
                <Link href="/dashboard/inventory/adjustment" className="ml-2 text-(--color-primary) underline">
                  Adjust Stock
                </Link>
              </p>
            )}
            {trackStock && (
              <NumberInput
                label="Minimum Stock"
                min={0}
                step="0.001"
                decimals={3}
                value={variant.low_stock_threshold}
                onChange={(e) => updateVariant({ low_stock_threshold: e.target.value })}
              />
            )}
          </div>

          {itemType === "composite" && (
            <div className="space-y-2 border-t border-(--color-border) pt-3">
              <p className="text-sm font-medium text-(--color-text)">Components</p>
              {variant.components.map((c) => (
                <div key={c.rowId} className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
                  <Select
                    placeholder="Select a component…"
                    value={c.component_variant_id}
                    onChange={(e) => updateComponent(c.rowId, { component_variant_id: e.target.value })}
                    options={availableComponentOptions.map((v) => ({
                      value: v.id,
                      label: v.sku ? `${v.label} (${v.sku})` : v.label,
                    }))}
                  />
                  <NumberInput
                    min={0.01}
                    step="any"
                    decimals={3}
                    value={c.quantity}
                    onChange={(e) => updateComponent(c.rowId, { quantity: e.target.value })}
                  />
                  <Button type="button" variant="ghost" className="text-(--color-danger)" onClick={() => removeComponent(c.rowId)}>
                    Remove
                  </Button>
                </div>
              ))}
              <Button type="button" variant="secondary" size="sm" onClick={addComponent}>
                Add Component
              </Button>
            </div>
          )}
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

      <CardFooter className="flex items-center justify-end gap-2 px-0">
        {error && <p className="mr-auto text-sm text-(--color-danger)">{error}</p>}
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : mode === "create" ? "Create Item" : "Save Changes"}
        </Button>
      </CardFooter>
    </form>
  );
}
