import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const SECTIONS = [
  {
    href: "/dashboard/administration/users",
    title: "Users",
    description: "Invite staff, assign roles, and deactivate accounts.",
  },
  {
    href: "/dashboard/administration/roles",
    title: "Roles",
    description: "Read-only reference of what each role can see and do.",
  },
  {
    href: "/dashboard/administration/activity-logs",
    title: "Activity Logs",
    description: "Audit trail of actions taken across the system.",
  },
];

export default function AdministrationPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Administration"
        description="Manage users, roles, and review the system's activity log."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className="h-full transition-colors hover:bg-(--color-bg)">
              <CardHeader>
                <CardTitle className="text-base">{s.title}</CardTitle>
                <CardDescription>{s.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
