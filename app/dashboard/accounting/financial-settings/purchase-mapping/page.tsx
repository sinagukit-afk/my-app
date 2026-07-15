import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SystemMappingTable, type SystemMappingRow, type AccountOption } from "@/components/business/system-mapping-table";
import { PURCHASE_MAPPING_KEYS, MAPPING_KEY_ACCOUNT_CATEGORY } from "@/lib/accounting/system-mapping-keys";
import { savePurchaseMappings } from "./actions";

export default async function PurchaseMappingPage() {
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
          title="Purchase Mapping"
          description="GL accounts used when Accounting auto-posts purchase-side events (credit card payable, interest)."
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

  const [{ data: mappings }, { data: accounts }] = await Promise.all([
    supabase
      .from("system_account_mappings")
      .select("mapping_key, label, account_id")
      .in("mapping_key", PURCHASE_MAPPING_KEYS as unknown as string[]),
    supabase
      .from("accounts")
      .select("id, account_number, name, category")
      .eq("is_active", true)
      .eq("is_postable", true)
      .order("account_number"),
  ]);

  const mappingByKey = new Map((mappings ?? []).map((m) => [m.mapping_key, m]));

  const rows: SystemMappingRow[] = PURCHASE_MAPPING_KEYS.map((key) => {
    const m = mappingByKey.get(key);
    return {
      mapping_key: key,
      label: m?.label ?? key,
      account_id: m?.account_id ?? "",
      account_category: MAPPING_KEY_ACCOUNT_CATEGORY[key],
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Mapping"
        description="GL accounts used when Accounting auto-posts purchase-side events (credit card payable, interest)."
      />
      <Card>
        <CardContent className="p-4">
          <SystemMappingTable rows={rows} accounts={(accounts ?? []) as AccountOption[]} canEdit={canEdit} onSave={savePurchaseMappings} />
        </CardContent>
      </Card>
    </div>
  );
}
