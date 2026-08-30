import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ReviewTable, type ReviewRow } from "../review/review-table";
import { JournalTable, type JournalRow } from "./journal-table";

type SearchParams = Promise<{ from?: string; to?: string }>;

export default async function JournalPage({ searchParams }: { searchParams: SearchParams }) {
  const { from = "", to = "" } = await searchParams;
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
          description="Draft journal entries awaiting review, and the posted double-entry ledger."
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

  // Posted entries honour the ?from/&to date range; drafts always show in full so
  // the review queue never hides pending work behind a filter.
  let entryQuery = supabase
    .from("journal_entries")
    .select(
      "id, journal_number, entry_date, description, source_type, created_at, journal_entry_lines(debit, credit)"
    )
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (from) entryQuery = entryQuery.gte("entry_date", from);
  if (to) entryQuery = entryQuery.lte("entry_date", to);

  // Pull each draft/entry with its lines so we can show a debit total per row in
  // the lists. Lines are summed client-side.
  const [{ data: draftData, error: draftError }, { data: entryData, error: entryError }] = await Promise.all([
    supabase
      .from("journal_entry_drafts")
      .select(
        "id, entry_date, description, event_type, status, created_at, journal_entry_draft_lines(debit, credit)"
      )
      .order("created_at", { ascending: false }),
    entryQuery,
  ]);

  const reviewRows: ReviewRow[] = (draftData ?? []).map((d) => {
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

  const journalRows: JournalRow[] = (entryData ?? []).map((e) => {
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
      <PageHeader
        title="Journal Entries"
        description="Draft journal entries awaiting review, and the posted double-entry ledger."
        actions={
          <Link href="/dashboard/accounting/journal/new">
            <Button>New Journal Entry</Button>
          </Link>
        }
      />

      {draftError && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load draft journal entries: {draftError.message}
          </CardContent>
        </Card>
      )}
      {entryError && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load journal entries: {entryError.message}
          </CardContent>
        </Card>
      )}

      <div className="space-y-10">
        <ReviewTable data={reviewRows} />
        <JournalTable data={journalRows} from={from} to={to} />
      </div>
    </div>
  );
}
