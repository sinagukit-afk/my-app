import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ReviewTable, type ReviewRow } from "./review-table";

export default async function ReviewPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const hasAccess = ["admin", "manager"].includes(role);

  if (!hasAccess) {
    return (
      <div>
        <PageHeader
          title="Pending Review"
          description="Draft journal entries auto-generated from business events, waiting for approval."
        />
        <Card className="max-w-lg">
          <CardContent className="p-4 text-sm text-(--color-text-muted)">
            Accounting records are restricted to Admin and Manager roles. Contact an
            administrator if you need access.
          </CardContent>
        </Card>
      </div>
    );
  }

  // Pull each draft with its lines so we can show a debit total per draft in the
  // list, same shape as the Journal list. Lines are summed client-side.
  const { data, error } = await supabase
    .from("journal_entry_drafts")
    .select(
      "id, entry_date, description, event_type, status, created_at, journal_entry_draft_lines(debit, credit)"
    )
    .order("created_at", { ascending: false });

  const rows: ReviewRow[] = (data ?? []).map((d) => {
    const lines = (d.journal_entry_draft_lines ?? []) as { debit: number; credit: number }[];
    const total = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
    return {
      id: d.id,
      entry_date: d.entry_date,
      description: d.description,
      event_type: d.event_type,
      status: d.status,
      total,
    };
  });

  return (
    <div className="space-y-6">
      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load draft journal entries: {error.message}
          </CardContent>
        </Card>
      )}

      <ReviewTable data={rows} />
    </div>
  );
}
