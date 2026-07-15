import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { RunDepreciationDialog } from "./run-depreciation-dialog";
import { GeneratePrepaidPostingsDialog } from "./generate-postings-dialog";
import { ExpenseScheduleTable, type ScheduleRow } from "./expense-schedule-table";

export default async function ExpenseSchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const hasAccess = ["admin", "manager"].includes(role);
  const canWrite = ["admin", "manager"].includes(role);
  const canRunDepreciation = role === "admin";

  if (!hasAccess) {
    return (
      <div>
        <PageHeader
          title="Expense Schedule"
          description="Active prepaid expense and fixed asset depreciation schedules."
        />
        <Card className="max-w-lg">
          <CardContent className="p-4 text-sm text-(--color-text-muted)">
            Finance records are restricted to Admin and Manager roles. Contact an administrator if you
            need access.
          </CardContent>
        </Card>
      </div>
    );
  }

  const [{ data: prepaidSchedules, error: prepaidError }, { data: assets, error: assetsError }, { data: depEntries }] =
    await Promise.all([
      supabase
        .from("prepaid_expense_schedules")
        .select("id, total_amount, remaining_balance, next_posting_date, schedule_status, opex_expenses(description)")
        .order("next_posting_date"),
      supabase
        .from("fixed_assets")
        .select("id, name, cost, salvage_value, useful_life_months, purchased_date, schedule_status, disposed_at")
        .order("purchased_date"),
      supabase.from("depreciation_entries").select("fixed_asset_id, amount, period_month"),
    ]);

  const accumByAsset = new Map<string, number>();
  const lastPeriodByAsset = new Map<string, string>();
  for (const e of depEntries ?? []) {
    accumByAsset.set(e.fixed_asset_id, (accumByAsset.get(e.fixed_asset_id) ?? 0) + Number(e.amount));
    const prev = lastPeriodByAsset.get(e.fixed_asset_id);
    if (!prev || e.period_month > prev) lastPeriodByAsset.set(e.fixed_asset_id, e.period_month);
  }

  function nextMonthAfter(dateStr: string): string {
    const d = new Date(dateStr);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
  }

  const prepaidRows: ScheduleRow[] = (prepaidSchedules ?? []).map((s) => {
    const expense = Array.isArray(s.opex_expenses) ? s.opex_expenses[0] : s.opex_expenses;
    return {
      id: s.id,
      type: "prepaid",
      name: expense?.description ?? "Prepaid expense",
      total_amount: Number(s.total_amount),
      remaining_balance: Number(s.remaining_balance),
      next_posting_date: s.schedule_status === "active" ? s.next_posting_date : null,
      status: s.schedule_status as ScheduleRow["status"],
    };
  });

  const assetRows: ScheduleRow[] = (assets ?? [])
    .filter((a) => !a.disposed_at)
    .map((a) => {
      const cost = Number(a.cost);
      const salvage = Number(a.salvage_value ?? 0);
      const accumulated = accumByAsset.get(a.id) ?? 0;
      const remaining = Math.max(cost - salvage - accumulated, 0);
      const lastPeriod = lastPeriodByAsset.get(a.id);
      const nextPosting = lastPeriod ? nextMonthAfter(lastPeriod) : a.purchased_date.slice(0, 8) + "01";
      return {
        id: a.id,
        type: "fixed_asset",
        name: a.name,
        total_amount: cost,
        remaining_balance: remaining,
        next_posting_date: a.schedule_status === "active" && remaining > 0 ? nextPosting : null,
        status: a.schedule_status as ScheduleRow["status"],
      };
    });

  const rows = [...prepaidRows, ...assetRows].sort((a, b) => (a.next_posting_date ?? "9999") < (b.next_posting_date ?? "9999") ? -1 : 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expense Schedule"
        description="Manage active prepaid expense amortization and fixed asset depreciation schedules."
        actions={
          canWrite ? (
            <div className="flex items-center gap-2">
              <GeneratePrepaidPostingsDialog schedules={prepaidRows} />
              {canRunDepreciation && <RunDepreciationDialog />}
            </div>
          ) : undefined
        }
      />

      {(prepaidError || assetsError) && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load schedules: {prepaidError?.message ?? assetsError?.message}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <ExpenseScheduleTable data={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
