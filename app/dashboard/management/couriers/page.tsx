import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { CouriersTable, type CourierRow } from "./couriers-table";

export default async function CouriersPage() {
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
    .from("couriers")
    .select("id, name, contact_number, is_active")
    .order("name");

  const rows: CourierRow[] = data ?? [];

  return (
    <div className="space-y-6">
      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load couriers: {error.message}
          </CardContent>
        </Card>
      )}

      <CouriersTable data={rows} canWrite={canWrite} />
    </div>
  );
}
