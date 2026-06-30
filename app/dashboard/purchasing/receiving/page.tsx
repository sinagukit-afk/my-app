import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ReceivingPage() {
  return (
    <div>
      <PageHeader
        title="Receiving"
        description="Process incoming deliveries and reconcile them against open purchase orders."
      />
      <Card className="max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Module under construction</CardTitle>
            <Badge variant="neutral">Coming Soon</Badge>
          </div>
          <CardDescription>
            This page will guide you through confirming delivered quantities, flagging
            discrepancies, and posting receipts to inventory.
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
