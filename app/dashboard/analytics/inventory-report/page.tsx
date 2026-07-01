import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function InventoryReportPage() {
  return (
    <div>
      <PageHeader
        title="Inventory Report"
        description="Understand stock levels, turnover rates, and valuation trends."
      />
      <Card className="max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Module under construction</CardTitle>
            <Badge variant="neutral">Coming Soon</Badge>
          </div>
          <CardDescription>
            This page will provide snapshots of stock on hand, slow-moving items, reorder
            alerts, and historical movement summaries.
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
