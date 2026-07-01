import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { SuppliersTable, type SupplierRow } from "./suppliers-table";

export default async function SuppliersPage() {
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
    .from("suppliers")
    .select("id, name, contact_name, phone, email, address, note, is_active")
    .order("name");

  const rows: SupplierRow[] = data ?? [];

  return (
    <div className="space-y-6">
      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load suppliers: {error.message}
          </CardContent>
        </Card>
      )}

      <SuppliersTable data={rows} canWrite={canWrite} canDelete={canDelete} />
    </div>
  );
}
