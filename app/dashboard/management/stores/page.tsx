import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { StoresTable, type StoreRow } from "./stores-table";

export default async function StoresPage() {
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
    .from("stores")
    .select("id, store_code, name, address, phone, email, is_active, loyverse_store_id")
    .order("name");

  const rows: StoreRow[] = data ?? [];

  return (
    <div className="space-y-6">
      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load stores: {error.message}
          </CardContent>
        </Card>
      )}

      <StoresTable data={rows} canWrite={canWrite} canDelete={canDelete} />
    </div>
  );
}
