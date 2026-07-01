import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/business/stat-card";
import { UsersTable, type UserRow } from "./users-table";

export default async function UsersPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at")
    .order("created_at");

  const rows: UserRow[] = (data ?? []).map((p) => ({
    id: p.id,
    name: p.full_name ?? "",
    email: p.email ?? "",
    role: p.role ?? "",
    joined: p.created_at,
  }));

  const roleCount = rows.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage staff accounts and control who has access to the system."
      />

      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load users: {error.message}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Total Users"
          value={rows.length}
          icon={
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M13 6A3 3 0 1 1 7 6a3 3 0 0 1 6 0ZM2 17c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          }
        />
        <StatCard label="Admins"   value={roleCount.admin   ?? 0} />
        <StatCard label="Managers" value={roleCount.manager ?? 0} />
        <StatCard label="Encoders" value={roleCount.encoder ?? 0} />
        <StatCard label="Cashiers & Viewers" value={(roleCount.cashier ?? 0) + (roleCount.viewer ?? 0)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent>
          <UsersTable data={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
