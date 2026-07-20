import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BomEditor, type BomEditorVariant, type ComponentOption } from "./bom-editor";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function arrayOf<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

export default async function ProductBomEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const canWrite = ["admin", "manager"].includes(role);

  if (!canWrite) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-(--color-danger)">
          You don&apos;t have permission to edit Product BOM. Only admins and managers can edit components.
        </CardContent>
      </Card>
    );
  }

  const { data: item } = await supabase
    .from("items")
    .select("id, name, item_type, deleted_at, categories(name)")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!item) notFound();

  if (item.item_type !== "composite") {
    return (
      <Card>
        <CardContent className="space-y-3 p-4 text-sm">
          <p className="text-(--color-text)">
            &quot;{item.name}&quot; is a simple item — it doesn&apos;t have a bill of materials.
          </p>
          <Link href={`/dashboard/management/items/${item.id}`}>
            <Button variant="secondary">View Item</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const category = firstOf(item.categories);

  const { data: variantRows } = await supabase
    .from("item_variants")
    .select("id, sku, option1_value, option2_value, option3_value, default_price, pricing_type")
    .eq("item_id", id)
    .is("deleted_at", null)
    .order("created_at");

  const variantIds = (variantRows ?? []).map((v) => v.id);

  const { data: componentRows } = variantIds.length
    ? await supabase
        .from("item_components")
        .select(
          "composite_variant_id, quantity, component:item_variants!item_components_component_variant_id_fkey(id, sku, cost, items(name))"
        )
        .in("composite_variant_id", variantIds)
    : { data: [] };

  const { data: allVariantRows } = await supabase
    .from("item_variants")
    .select("id, sku, cost, items(name)")
    .is("deleted_at", null)
    .order("sku");

  const componentOptions: ComponentOption[] = (allVariantRows ?? []).map((v) => {
    const parent = firstOf(v.items);
    return {
      id: v.id,
      label: parent?.name ?? "Unknown item",
      sku: v.sku,
      cost: v.cost !== null ? Number(v.cost) : null,
    };
  });

  const variants: BomEditorVariant[] = (variantRows ?? []).map((v) => {
    const options = [v.option1_value, v.option2_value, v.option3_value].filter(Boolean).join(" / ");
    return {
      id: v.id,
      sku: v.sku,
      options: options || null,
      default_price: v.default_price !== null ? Number(v.default_price) : null,
      pricing_type: v.pricing_type as "FIXED" | "VARIABLE",
      components: (componentRows ?? [])
        .filter((c) => c.composite_variant_id === v.id)
        .map((c) => {
          const component = firstOf(c.component);
          return {
            component_variant_id: component?.id ?? "",
            quantity: Number(c.quantity),
          };
        }),
    };
  });

  return (
    <BomEditor
      itemId={item.id}
      itemName={item.name}
      category={category?.name ?? null}
      variants={variants}
      componentOptions={componentOptions}
    />
  );
}
