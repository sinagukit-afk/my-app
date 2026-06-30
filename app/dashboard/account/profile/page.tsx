import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ProfilePage() {
  return (
    <div>
      <PageHeader
        title="Profile"
        description="View and update your personal account details."
      />
      <Card className="max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Module under construction</CardTitle>
            <Badge variant="neutral">Coming Soon</Badge>
          </div>
          <CardDescription>
            This page will let you update your display name, email address, and password,
            and manage notification preferences.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[--color-text-muted]">
            No data or forms are connected yet. Check back once this module is built out.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
