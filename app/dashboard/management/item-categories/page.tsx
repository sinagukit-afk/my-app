import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { ItemCategoriesTable, type CategoryRow } from "./item-categories-table";

export default async function ItemCategoriesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const canWrite = role === "admin";

  const { data, error } = await supabase
    .from("categories")
    .select("id, name, category_type")
    .is("deleted_at", null)
    .order("name");

  const rows: CategoryRow[] = data ?? [];

  return (
    <div className="space-y-6">
      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load categories: {error.message}
          </CardContent>
        </Card>
      )}

      <ItemCategoriesTable data={rows} canWrite={canWrite} />
    </div>
  );
}
