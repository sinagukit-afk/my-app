import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ProfitLossPage() {
  return (
    <div>
      <PageHeader
        title="Profit & Loss"
        description="Review net profit against total income and expenses for any period."
      />
      <Card className="max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Module under construction</CardTitle>
            <Badge variant="neutral">Coming Soon</Badge>
          </div>
          <CardDescription>
            This page will generate a P&amp;L statement summarising gross profit, operating
            costs, and net income, exportable by date range.
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
