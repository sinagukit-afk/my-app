import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { RunDepreciationDialog } from "./run-depreciation-dialog";
import { FixedAssetsTable, type AssetRow, type AssetStatus } from "./fixed-assets-table";

function peso(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}

export default async function FixedAssetsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const hasAccess = ["admin", "manager"].includes(role);
  const canRun = role === "admin";

  if (!hasAccess) {
    return (
      <div>
        <PageHeader
          title="Fixed Assets"
          description="Depreciable assets and their accumulated depreciation."
        />
        <Card className="max-w-lg">
          <CardContent className="p-4 text-sm text-(--color-text-muted)">
            Accounting records are restricted to Admin and Manager roles. Contact an administrator if you
            need access.
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: assets, error } = await supabase
    .from("fixed_assets")
    .select("id, name, purchased_date, cost, useful_life_months, disposed_at, asset_account_id")
    .order("purchased_date");

  const { data: entries } = await supabase.from("depreciation_entries").select("fixed_asset_id, amount");
  const { data: accounts } = await supabase.from("accounts").select("id, account_number");

  const accumByAsset = new Map<string, number>();
  for (const e of entries ?? []) {
    accumByAsset.set(e.fixed_asset_id, (accumByAsset.get(e.fixed_asset_id) ?? 0) + Number(e.amount));
  }
  const accountNumberById = new Map((accounts ?? []).map((a) => [a.id, a.account_number]));

  const rows: AssetRow[] = (assets ?? []).map((a) => {
    const cost = Number(a.cost);
    const accumulated = accumByAsset.get(a.id) ?? 0;
    const bookValue = cost - accumulated;
    const status: AssetStatus = a.disposed_at ? "disposed" : bookValue <= 0.01 ? "fully_depreciated" : "active";

    return {
      id: a.id,
      name: a.name,
      account_number: accountNumberById.get(a.asset_account_id) ?? 0,
      purchased_date: a.purchased_date,
      cost,
      useful_life_months: a.useful_life_months,
      accumulated,
      book_value: bookValue,
      status,
    };
  });

  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const totalAccumulated = rows.reduce((s, r) => s + r.accumulated, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fixed Assets"
        description="Depreciable assets and their accumulated depreciation."
        actions={canRun ? <RunDepreciationDialog /> : undefined}
      />

      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load fixed assets: {error.message}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-(--color-text-muted)">Total Cost</p>
            <p className="mt-1 text-2xl font-semibold text-(--color-text) tabular-nums">{peso(totalCost)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-(--color-text-muted)">Total Accum. Depreciation</p>
            <p className="mt-1 text-2xl font-semibold text-(--color-text) tabular-nums">{peso(totalAccumulated)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-(--color-text-muted)">Total Book Value</p>
            <p className="mt-1 text-2xl font-semibold text-(--color-text) tabular-nums">
              {peso(totalCost - totalAccumulated)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <FixedAssetsTable data={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
