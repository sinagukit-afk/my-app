import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReviewDetail, type DraftDetail, type AccountOption } from "./review-detail";

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const hasAccess = ["admin", "manager"].includes(role);

  if (!hasAccess) redirect("/dashboard/accounting/review");

  const { data: draft, error } = await supabase
    .from("journal_entry_drafts")
    .select(
      "id, entry_date, description, event_type, status, posted_journal_entry_id, review_note, reviewed_at, reviewed_by, created_at, journal_entry_draft_lines(id, debit, credit, memo, line_order, accounts(account_number, name))"
    )
    .eq("id", id)
    .single();

  if (error || !draft) notFound();

  const { data: accountData } = await supabase
    .from("accounts")
    .select("account_number, name, category")
    .eq("is_active", true)
    .order("account_number");

  const accounts: AccountOption[] = accountData ?? [];

  const rawLines = (draft.journal_entry_draft_lines ?? []) as {
    id: string;
    debit: number;
    credit: number;
    memo: string | null;
    line_order: number;
    accounts: { account_number: string; name: string } | { account_number: string; name: string }[] | null;
  }[];

  // reviewed_by has no FK to profiles (only to auth.users), so it can't be
  // embedded via .select() — look it up separately when set.
  const { data: reviewerProfile } = draft.reviewed_by
    ? await supabase.from("profiles").select("full_name").eq("id", draft.reviewed_by).single()
    : { data: null };

  const detail: DraftDetail = {
    id: draft.id,
    entry_date: draft.entry_date,
    description: draft.description,
    event_type: draft.event_type,
    status: draft.status,
    posted_journal_entry_id: draft.posted_journal_entry_id,
    review_note: draft.review_note,
    reviewed_at: draft.reviewed_at,
    reviewer_name: reviewerProfile?.full_name ?? null,
    lines: rawLines
      .slice()
      .sort((a, b) => a.line_order - b.line_order)
      .map((l) => {
        const acct = Array.isArray(l.accounts) ? l.accounts[0] : l.accounts;
        return {
          id: l.id,
          account_number: acct?.account_number ?? "",
          account_name: acct?.name ?? "",
          debit: Number(l.debit),
          credit: Number(l.credit),
          memo: l.memo,
        };
      }),
  };

  return <ReviewDetail draft={detail} accounts={accounts} />;
}
