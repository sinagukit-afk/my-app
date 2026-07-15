import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ScheduleDetail, type ScheduleDetailData, type HistoryRow } from "./schedule-detail";

export default async function ExpenseScheduleDetailPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = await params;
  if (type !== "prepaid" && type !== "fixed_asset") notFound();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const hasAccess = ["admin", "manager"].includes(role);
  if (!hasAccess) redirect("/dashboard/finance/expense-schedule");
  const canWrite = ["admin", "manager"].includes(role);

  let detail: ScheduleDetailData;
  let history: HistoryRow[];

  if (type === "prepaid") {
    const { data: schedule, error } = await supabase
      .from("prepaid_expense_schedules")
      .select(
        "id, total_amount, term_months, monthly_amount, start_date, next_posting_date, remaining_balance, schedule_status, opex_expenses(description)"
      )
      .eq("id", id)
      .single();

    if (error || !schedule) notFound();
    const expense = Array.isArray(schedule.opex_expenses) ? schedule.opex_expenses[0] : schedule.opex_expenses;

    detail = {
      id: schedule.id,
      type: "prepaid",
      name: expense?.description ?? "Prepaid expense",
      total_amount: Number(schedule.total_amount),
      term_months: schedule.term_months,
      periodic_amount: Number(schedule.monthly_amount),
      start_date: schedule.start_date,
      next_posting_date: schedule.next_posting_date,
      remaining_balance: Number(schedule.remaining_balance),
      status: schedule.schedule_status,
    };

    const { data: entries } = await supabase
      .from("prepaid_expense_schedule_entries")
      .select("id, period_month, amount, journal_entry_draft_id, journal_entry_drafts(status, posted_journal_entry_id)")
      .eq("schedule_id", id)
      .order("period_month");

    history = (entries ?? []).map((e) => {
      const draft = Array.isArray(e.journal_entry_drafts) ? e.journal_entry_drafts[0] : e.journal_entry_drafts;
      return {
        id: e.id,
        period_month: e.period_month,
        amount: Number(e.amount),
        draft_id: e.journal_entry_draft_id,
        draft_status: draft?.status ?? null,
        posted_journal_entry_id: draft?.posted_journal_entry_id ?? null,
      };
    });
  } else {
    const { data: asset, error } = await supabase
      .from("fixed_assets")
      .select("id, name, cost, salvage_value, useful_life_months, purchased_date, schedule_status")
      .eq("id", id)
      .single();

    if (error || !asset) notFound();

    const { data: entries } = await supabase
      .from("depreciation_entries")
      .select("id, period_month, amount, journal_entry_draft_id, journal_entry_drafts(status, posted_journal_entry_id)")
      .eq("fixed_asset_id", id)
      .order("period_month");

    const accumulated = (entries ?? []).reduce((s, e) => s + Number(e.amount), 0);
    const remaining = Math.max(Number(asset.cost) - Number(asset.salvage_value ?? 0) - accumulated, 0);

    detail = {
      id: asset.id,
      type: "fixed_asset",
      name: asset.name,
      total_amount: Number(asset.cost),
      term_months: asset.useful_life_months,
      periodic_amount: Math.round((Number(asset.cost) - Number(asset.salvage_value ?? 0)) / asset.useful_life_months * 100) / 100,
      start_date: asset.purchased_date,
      next_posting_date: null,
      remaining_balance: remaining,
      status: asset.schedule_status,
    };

    history = (entries ?? []).map((e) => {
      const draft = Array.isArray(e.journal_entry_drafts) ? e.journal_entry_drafts[0] : e.journal_entry_drafts;
      return {
        id: e.id,
        period_month: e.period_month,
        amount: Number(e.amount),
        draft_id: e.journal_entry_draft_id,
        draft_status: draft?.status ?? null,
        posted_journal_entry_id: draft?.posted_journal_entry_id ?? null,
      };
    });
  }

  return <ScheduleDetail detail={detail} history={history} canWrite={canWrite} />;
}
