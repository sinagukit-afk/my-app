import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { AddAssetButton } from "./add-asset-button";
import { FixedAssetsTable, type AssetRow, type AssetStatus } from "./fixed-assets-table";

function peso(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  const canWrite = role === "admin";

  if (!hasAccess) {
    return (
      <div>
        <PageHeader
          title="Fixed Assets"
          description="Depreciable assets and their accumulated depreciation."
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

  const [{ data: assets, error }, { data: entries }, { data: accounts }, { data: categories }, { data: suppliers }] =
    await Promise.all([
      supabase
        .from("fixed_assets")
        .select(
          "id, name, purchased_date, cost, salvage_value, useful_life_months, disposed_at, schedule_status, payment_status, asset_account_id, supplier_id, asset_categories(name)"
        )
        .order("purchased_date"),
      supabase.from("depreciation_entries").select("fixed_asset_id, amount"),
      supabase.from("accounts").select("id, account_number"),
      supabase.from("asset_categories").select("id, name").eq("is_active", true).order("name"),
      supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
    ]);

  const accumByAsset = new Map<string, number>();
  for (const e of entries ?? []) {
    accumByAsset.set(e.fixed_asset_id, (accumByAsset.get(e.fixed_asset_id) ?? 0) + Number(e.amount));
  }
  const accountNumberById = new Map<string, string>((accounts ?? []).map((a) => [a.id, a.account_number]));

  const rows: AssetRow[] = (assets ?? []).map((a) => {
    const cost = Number(a.cost);
    const accumulated = accumByAsset.get(a.id) ?? 0;
    const bookValue = cost - accumulated;
    const status: AssetStatus = a.disposed_at ? "disposed" : bookValue <= Number(a.salvage_value ?? 0) + 0.01 ? "fully_depreciated" : "active";
    const category = Array.isArray(a.asset_categories) ? a.asset_categories[0] : a.asset_categories;

    return {
      id: a.id,
      name: a.name,
      account_number: accountNumberById.get(a.asset_account_id) ?? "",
      category_name: category?.name ?? "—",
      purchased_date: a.purchased_date,
      cost,
      salvage_value: Number(a.salvage_value ?? 0),
      useful_life_months: a.useful_life_months,
      supplier_id: a.supplier_id,
      accumulated,
      book_value: bookValue,
      status,
      schedule_status: a.schedule_status as AssetRow["schedule_status"],
      payment_status: a.payment_status as AssetRow["payment_status"],
    };
  });

  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const totalAccumulated = rows.reduce((s, r) => s + r.accumulated, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fixed Assets"
        description="Depreciable assets and their accumulated depreciation."
        actions={
          <div className="flex items-center gap-2">
            {canWrite && <AddAssetButton categories={categories ?? []} suppliers={suppliers ?? []} />}
            <Link href="/dashboard/finance/expense-schedule">
              <Button variant="secondary">Manage Schedule →</Button>
            </Link>
          </div>
        }
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
          <FixedAssetsTable data={rows} canWrite={canWrite} categories={categories ?? []} suppliers={suppliers ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
