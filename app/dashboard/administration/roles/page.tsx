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
      "Manage users & roles (invite, edit, deactivate)",
      "Full create, edit, and delete on business records",
      "View all activity logs (every user)",
      "Only role that can advance orders past Confirmed (Start/Complete Production)",
    ],
    badge: "danger",
  },
  {
    key: "manager",
    label: "Manager",
    description: "Operational oversight. Can create, edit, and delete most business records.",
    permissions: [
      "Create & edit suppliers, purchase orders, quotes, orders",
      "Delete suppliers and purchase orders",
      "View all activity logs (every user)",
      "Cannot manage users/roles or advance production past Confirmed",
    ],
    badge: "warning",
  },
  {
    key: "encoder",
    label: "Encoder",
    description: "Data entry role. Focused on creating transactions and logging incoming stock.",
    permissions: [
      "Create & edit suppliers, purchase orders, quotes, orders",
      "Edit or cancel own quotes only while still Open",
      "No delete access on business records",
      "Views only their own activity log",
    ],
    badge: "success",
  },
  {
    key: "cashier",
    label: "Cashier",
    description: "Point-of-sale role. Read-only access to business records in this system.",
    permissions: [
      "View business records (no create, edit, or delete)",
      "Views only their own activity log",
    ],
    badge: "default",
  },
  {
    key: "viewer",
    label: "Viewer",
    description: "Read-only access. Can view reports and dashboards but cannot make any changes.",
    permissions: [
      "View business records (no create, edit, or delete)",
      "Views only their own activity log",
    ],
    badge: "neutral",
  },
];

const MATRIX_ROLES = ["admin", "manager", "encoder", "cashier", "viewer"] as const;

const MATRIX: { capability: string; allowed: Record<(typeof MATRIX_ROLES)[number], boolean> }[] = [
  {
    capability: "View business records",
    allowed: { admin: true, manager: true, encoder: true, cashier: true, viewer: true },
  },
  {
    capability: "Create / edit business records",
    allowed: { admin: true, manager: true, encoder: true, cashier: false, viewer: false },
  },
  {
    capability: "Delete business records",
    allowed: { admin: true, manager: true, encoder: false, cashier: false, viewer: false },
  },
  {
    capability: "Start / Complete Production",
    allowed: { admin: true, manager: false, encoder: false, cashier: false, viewer: false },
  },
  {
    capability: "View all Activity Logs (not just own)",
    allowed: { admin: true, manager: true, encoder: false, cashier: false, viewer: false },
  },
  {
    capability: "Manage Users & Roles",
    allowed: { admin: true, manager: false, encoder: false, cashier: false, viewer: false },
  },
];

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="shrink-0 text-(--color-success)">
    <path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="shrink-0 text-(--color-text-subtle)">
    <path d="M3 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
                  <span className="text-xs text-(--color-text-muted)">
                    {roleCount[role.key] ?? 0} user{(roleCount[role.key] ?? 0) !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
                Permissions
              </p>
              <ul className="space-y-1.5">
                {role.permissions.map((perm) => (
                  <li key={perm} className="flex items-center gap-2 text-sm text-(--color-text-muted)">
                    <CheckIcon />
                    {perm}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Permission Matrix</CardTitle>
          <CardDescription>
            Capability grid derived from the actual Row-Level Security policies — read-only reference.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-(--color-border)">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-(--color-text-muted) uppercase tracking-wider">
                    Capability
                  </th>
                  {MATRIX_ROLES.map((r) => (
                    <th
                      key={r}
                      className="px-3 py-2 text-center text-xs font-semibold text-(--color-text-muted) uppercase tracking-wider"
                    >
                      {r}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MATRIX.map((row) => (
                  <tr key={row.capability} className="border-b border-(--color-border) last:border-0">
                    <td className="px-3 py-2.5 text-(--color-text)">{row.capability}</td>
                    {MATRIX_ROLES.map((r) => (
                      <td key={r} className="px-3 py-2.5 text-center">
                        <span className="inline-flex justify-center">
                          {row.allowed[r] ? <CheckIcon /> : <DashIcon />}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
