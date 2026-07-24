import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { canManageMarketing } from "../access";
import { QuoteRequestsTable, type QuoteRequestRow } from "./quote-requests-table";

export default async function WebQuoteRequestsPage() {
  if (!(await canManageMarketing())) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-(--color-danger)">
          You don&apos;t have permission to view website quote requests. Only admins and managers
          can work this inbox.
        </CardContent>
      </Card>
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("web_quote_requests")
    .select(
      "id, full_name, email, phone, product_category, quantity, needed_by_date, status, converted_quote_id, created_at"
    )
    .order("created_at", { ascending: false });

  const rows: QuoteRequestRow[] = data ?? [];

  return (
    <div className="space-y-6">
      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load quote requests: {error.message}
          </CardContent>
        </Card>
      )}

      <QuoteRequestsTable data={rows} />
    </div>
  );
}
