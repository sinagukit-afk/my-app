import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function CompletedOrdersPage() {
  return (
    <div>
      <PageHeader
        title="Completed Orders"
        description="Review the archive of fulfilled and closed orders."
      />
      <Card className="max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Module under construction</CardTitle>
            <Badge variant="neutral">Coming Soon</Badge>
          </div>
          <CardDescription>
            This page will list all completed orders with delivery confirmations, final totals,
            and links to related invoices.
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
