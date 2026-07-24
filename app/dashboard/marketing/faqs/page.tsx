import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { canManageMarketing } from "../access";
import { FaqsTable, type FaqRow } from "./faqs-table";

export default async function WebsiteFaqsPage() {
  if (!(await canManageMarketing())) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-(--color-danger)">
          You don&apos;t have permission to manage website content. Only admins and managers can
          edit the public FAQ page.
        </CardContent>
      </Card>
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("web_faqs")
    .select("id, question, answer, category, sort_order, published, deleted_at")
    .order("category", { nullsFirst: false })
    .order("sort_order");

  const rows: FaqRow[] = data ?? [];

  const categories = Array.from(
    new Set(rows.map((faq) => faq.category).filter((c): c is string => !!c))
  ).sort();

  return (
    <div className="space-y-6">
      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load FAQs: {error.message}
          </CardContent>
        </Card>
      )}

      <FaqsTable data={rows} categories={categories} />
    </div>
  );
}
