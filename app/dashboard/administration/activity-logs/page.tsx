import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/business/stat-card";
import { ActivityLogsTable, type LogRow } from "./activity-logs-table";

type RawLog = {
  id: string;
  action: string;
  entity_type: string | null;
  description: string | null;
  created_at: string;
  profiles: { full_name: string | null; email: string | null } | null;
};

export default async function ActivityLogsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_logs")
    .select("id, action, entity_type, description, created_at, profiles(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(500)
    .returns<RawLog[]>();

  const logs = data ?? [];

  const rows: LogRow[] = logs.map((l) => ({
    id: l.id,
    user_name: l.profiles?.full_name ?? l.profiles?.email ?? "Unknown",
    action: l.action,
    entity_type: l.entity_type ?? "",
    description: l.description ?? "",
    created_at: l.created_at,
  }));

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const loginsToday = logs.filter(
    (l) => l.action === "login" && new Date(l.created_at) >= todayStart
  ).length;

  const businessActionsToday = logs.filter(
    (l) =>
      !["login", "logout"].includes(l.action) &&
      new Date(l.created_at) >= todayStart
  ).length;

  const uniqueUsers = new Set(logs.map((l) => l.profiles?.email).filter(Boolean)).size;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity Logs"
        description="Chronological audit trail of all user actions taken within the system."
      />

      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load activity logs: {error.message}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Total Events"
          value={logs.length}
          icon={
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M3 5h14M3 10h14M3 15h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          }
        />
        <StatCard label="Active Users" value={uniqueUsers} />
        <StatCard label="Logins Today"          value={loginsToday} />
        <StatCard label="Actions Today"         value={businessActionsToday} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event Log</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityLogsTable data={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
