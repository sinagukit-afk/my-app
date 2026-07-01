import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ProductionQueuePage() {
  return (
    <div>
      <PageHeader
        title="Production Queue"
        description="Monitor orders currently in production and manage priorities."
      />
      <Card className="max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Module under construction</CardTitle>
            <Badge variant="neutral">Coming Soon</Badge>
          </div>
          <CardDescription>
            This page will display orders queued for production, allow drag-and-drop
            prioritisation, and track progress through each production stage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-(--color-text-muted)">
            No data or forms are connected yet. Check back once this module is built out.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
