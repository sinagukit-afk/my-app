import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { ProductModifiersTable, type ModifierRow } from "./product-modifiers-table";

export default async function ProductModifiersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const canWrite = ["admin", "manager", "encoder"].includes(role);
  const canDelete = ["admin", "manager"].includes(role);

  const { data, error } = await supabase
    .from("modifiers")
    .select("id, name, loyverse_modifier_id, deleted_at, modifier_options(id, name, price)")
    .is("modifier_options.deleted_at", null)
    .order("name");

  const rows: ModifierRow[] = data ?? [];

  return (
    <div className="space-y-6">
      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load modifiers: {error.message}
          </CardContent>
        </Card>
      )}

      <ProductModifiersTable data={rows} canWrite={canWrite} canDelete={canDelete} />
    </div>
  );
}
