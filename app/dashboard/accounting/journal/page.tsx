import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { JournalTable, type JournalRow } from "./journal-table";

export default async function JournalPage() {
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
          title="Journal Entries"
          description="Double-entry journal for all posted accounting transactions."
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

  // Pull each entry with its lines so we can show a debit/credit total per entry
  // in the list. Lines are summed client-side in the table for the running total.
  const { data, error } = await supabase
    .from("journal_entries")
    .select(
      "id, journal_number, entry_date, description, source_type, created_at, journal_entry_lines(debit, credit)"
    )
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  const rows: JournalRow[] = (data ?? []).map((e) => {
    const lines = (e.journal_entry_lines ?? []) as { debit: number; credit: number }[];
    const total = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
    return {
      id: e.id,
      journal_number: e.journal_number,
      entry_date: e.entry_date,
      description: e.description,
      source_type: e.source_type,
      line_count: lines.length,
      total,
    };
  });

  return (
    <div className="space-y-6">
      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load journal entries: {error.message}
          </CardContent>
        </Card>
      )}

      <JournalTable data={rows} />
    </div>
  );
}
