import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SystemMappingTable, type SystemMappingRow, type AccountOption } from "@/components/business/system-mapping-table";
import { TAX_MAPPING_KEYS, MAPPING_KEY_ACCOUNT_CATEGORY } from "@/lib/accounting/system-mapping-keys";
import { TaxRatesTable, type TaxRateRow } from "./tax-rates-table";
import { saveTaxMapping } from "./actions";

export default async function TaxesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const hasAccess = ["admin", "manager"].includes(role);
  const canEdit = role === "admin";

  if (!hasAccess) {
    return (
      <div>
        <PageHeader
          title="Taxes"
          description="Tax rates and the liability account tax collected posts to."
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

  const [{ data: mappings }, { data: accounts }, { data: taxRates, error }] = await Promise.all([
    supabase
      .from("system_account_mappings")
      .select("mapping_key, label, account_id")
      .in("mapping_key", TAX_MAPPING_KEYS as unknown as string[]),
    supabase
      .from("accounts")
      .select("id, account_number, name, category, is_postable")
      .eq("is_active", true)
      .order("account_number"),
    supabase.from("tax_rates").select("id, name, rate_percent, is_active").order("name"),
  ]);

  const mappingByKey = new Map((mappings ?? []).map((m) => [m.mapping_key, m]));

  const mappingRows: SystemMappingRow[] = TAX_MAPPING_KEYS.map((key) => {
    const m = mappingByKey.get(key);
    return {
      mapping_key: key,
      label: m?.label ?? key,
      account_id: m?.account_id ?? "",
      account_category: MAPPING_KEY_ACCOUNT_CATEGORY[key],
    };
  });

  const rateRows: TaxRateRow[] = (taxRates ?? []) as TaxRateRow[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Taxes"
        description="Foundation-only: configure tax rates and the liability account tax collected posts to. No tax-rate calculation engine is wired into POS/Orders yet — Accounting only splits an order's existing total_tax into this account when a sale is recognized."
      />

      <Card>
        <CardContent className="p-4">
          <SystemMappingTable
            rows={mappingRows}
            accounts={(accounts ?? []) as AccountOption[]}
            canEdit={canEdit}
            onSave={saveTaxMapping}
          />
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load tax rates: {error.message}
          </CardContent>
        </Card>
      )}

      <TaxRatesTable data={rateRows} canWrite={canEdit} />
    </div>
  );
}
