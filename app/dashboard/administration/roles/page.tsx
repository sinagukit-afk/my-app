import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/business/stat-card";

const ROLE_DEFS: {
  key: string;
  label: string;
  description: string;
  permissions: string[];
  badge: "default" | "success" | "warning" | "danger" | "neutral";
}[] = [
  {
    key: "admin",
    label: "Admin",
    description: "Full system access. Can manage users, roles, and all data across every module.",
    permissions: [
      "Manage users & roles",
      "View all reports & analytics",
      "Create, edit, delete any record",
      "System configuration",
    ],
    badge: "danger",
  },
  {
    key: "manager",
    label: "Manager",
    description: "Operational oversight. Can view reports and update product and pricing data.",
    permissions: [
      "View all reports",
      "Update items & pricing",
      "View activity logs",
      "Create & manage receipts",
    ],
    badge: "warning",
  },
  {
    key: "encoder",
    label: "Encoder",
    description: "Data entry role. Focused on creating transactions and logging incoming stock.",
    permissions: [
      "Create receipts",
      "Add incoming items",
      "View inventory levels",
      "Basic sales reports",
    ],
    badge: "success",
  },
  {
    key: "cashier",
    label: "Cashier",
    description: "Point-of-sale role. Focused on processing customer transactions.",
    permissions: [
      "Create receipts",
      "View own activity",
      "Basic sales view",
    ],
    badge: "default",
  },
  {
    key: "viewer",
    label: "Viewer",
    description: "Read-only access. Can view reports and dashboards but cannot make any changes.",
    permissions: [
      "View reports & analytics",
      "View inventory levels",
      "No create, edit, or delete access",
    ],
    badge: "neutral",
  },
];

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="shrink-0 text-[--color-success]">
    <path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default async function RolesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("role");

  const roleCount = (data ?? []).reduce<Record<string, number>>((acc, p) => {
    acc[p.role] = (acc[p.role] ?? 0) + 1;
    return acc;
  }, {});

  const totalUsers = (data ?? []).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles"
        description="Permission sets that control what each user can see and do in the system."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Total Roles"
          value={ROLE_DEFS.length}
          icon={
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <rect x="3" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <rect x="11" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <rect x="3" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <rect x="11" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          }
        />
        {ROLE_DEFS.map((r) => (
          <StatCard
            key={r.key}
            label={r.label}
            value={roleCount[r.key] ?? 0}
            delta={
              totalUsers > 0
                ? `${Math.round(((roleCount[r.key] ?? 0) / totalUsers) * 100)}% of users`
                : undefined
            }
            trend="neutral"
          />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {ROLE_DEFS.map((role) => (
          <Card key={role.key}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{role.label}</CardTitle>
                  <CardDescription className="mt-1">{role.description}</CardDescription>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1.5">
                  <Badge variant={role.badge}>{role.label}</Badge>
                  <span className="text-xs text-[--color-text-muted]">
                    {roleCount[role.key] ?? 0} user{(roleCount[role.key] ?? 0) !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[--color-text-muted]">
                Permissions
              </p>
              <ul className="space-y-1.5">
                {role.permissions.map((perm) => (
                  <li key={perm} className="flex items-center gap-2 text-sm text-[--color-text-muted]">
                    <CheckIcon />
                    {perm}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
