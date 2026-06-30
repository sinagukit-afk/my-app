import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function SalesReportPage() {
  return (
    <div>
      <PageHeader
        title="Sales Report"
        description="Analyse sales performance across products, customers, and time periods."
      />
      <Card className="max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Module under construction</CardTitle>
            <Badge variant="neutral">Coming Soon</Badge>
          </div>
          <CardDescription>
            This page will show charts and tables breaking down revenue by product, category,
            and customer, with date-range filtering and export options.
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
