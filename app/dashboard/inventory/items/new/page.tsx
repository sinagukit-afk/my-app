import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { ItemForm } from "../item-form";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function NewItemPage() {
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
          You don&apos;t have permission to add items. Only admins and managers
          can create or edit items.
        </CardContent>
      </Card>
    );
  }

  const [{ data: categories }, { data: suppliers }, { data: modifiers }, { data: variantRows }] =
    await Promise.all([
      supabase.from("categories").select("id, name").order("name"),
      supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
      supabase.from("modifiers").select("id, name").is("deleted_at", null).order("name"),
      supabase
        .from("item_variants")
        .select("id, sku, items(name)")
        .is("deleted_at", null)
        .order("sku"),
    ]);

  const componentOptions = (variantRows ?? []).map((v) => {
    const item = firstOf(v.items);
    return { id: v.id, label: item?.name ?? "Unknown item", sku: v.sku };
  });

  return (
    <ItemForm
      mode="create"
      categories={categories ?? []}
      suppliers={suppliers ?? []}
      modifiers={modifiers ?? []}
      componentOptions={componentOptions}
    />
  );
}
