import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { canManageMarketing } from "../access";
import { TestimonialsTable, type TestimonialRow } from "./testimonials-table";

export default async function WebsiteTestimonialsPage() {
  if (!(await canManageMarketing())) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-(--color-danger)">
          You don&apos;t have permission to manage website content. Only admins and managers can
          edit published testimonials.
        </CardContent>
      </Card>
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("web_testimonials")
    .select("id, author_name, author_role, quote, rating, avatar_url, sort_order, published, deleted_at")
    .order("sort_order")
    .order("author_name");

  const rows: TestimonialRow[] = data ?? [];

  return (
    <div className="space-y-6">
      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load testimonials: {error.message}
          </CardContent>
        </Card>
      )}

      <TestimonialsTable data={rows} />
    </div>
  );
}
