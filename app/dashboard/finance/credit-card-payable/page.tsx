import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { LogPaymentDialog, type CardOption } from "./log-payment-dialog";
import { CreditCardPaymentsTable, type PaymentRow } from "./credit-card-payments-table";

function peso(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function CreditCardPayablePage() {
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
          title="Credit Card Payable"
          description="Outstanding balance and installment payment history for card-funded purchases."
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

  const { data: cardTypes } = await supabase
    .from("payment_types")
    .select("id, name")
    .eq("is_active", true)
    .eq("is_purchasing_only", true)
    .order("name");

  const cardTypeIds = (cardTypes ?? []).map((c) => c.id);

  const [{ data: cardMappings }, { data: payments }, { data: paymentTypes }] = await Promise.all([
    cardTypeIds.length
      ? supabase
          .from("payment_type_accounting_mappings")
          .select("payment_type_id, account_id, accounts(account_number, name)")
          .in("payment_type_id", cardTypeIds)
      : Promise.resolve({ data: [] as { payment_type_id: string; account_id: string; accounts: unknown }[] }),
    supabase
      .from("credit_card_installment_payments")
      .select(
        `id, paid_date, principal_amount, interest_amount, notes,
         payment_types!credit_card_installment_payments_payment_type_id_fkey(name),
         card:payment_types!credit_card_installment_payments_card_payment_type_id_fkey(name)`
      )
      .order("paid_date", { ascending: false }),
    supabase
      .from("payment_types")
      .select("id, name")
      .eq("is_active", true)
      .eq("is_purchasing_only", false)
      .order("name"),
  ]);

  const accountIdByCard = new Map((cardMappings ?? []).map((m) => [m.payment_type_id, m.account_id]));
  const accountIds = Array.from(new Set((cardMappings ?? []).map((m) => m.account_id).filter(Boolean)));

  const { data: lines } = accountIds.length
    ? await supabase.from("journal_entry_lines").select("account_id, debit, credit").in("account_id", accountIds)
    : { data: [] as { account_id: string; debit: number; credit: number }[] };

  const balanceByAccount = new Map<string, number>();
  for (const l of lines ?? []) {
    const prev = balanceByAccount.get(l.account_id) ?? 0;
    balanceByAccount.set(l.account_id, prev + Number(l.credit || 0) - Number(l.debit || 0));
  }

  const cards: CardOption[] = (cardTypes ?? []).map((c) => {
    const mapping = (cardMappings ?? []).find((m) => m.payment_type_id === c.id);
    const acct = mapping?.accounts as { account_number: string; name: string } | null | undefined;
    const accountId = accountIdByCard.get(c.id) ?? null;
    return {
      value: c.id,
      label: c.name,
      accountLabel: acct ? `${acct.account_number} — ${acct.name}` : "No GL account mapped",
      balance: accountId ? balanceByAccount.get(accountId) ?? 0 : 0,
      mapped: Boolean(accountId),
    };
  });

  const rows: PaymentRow[] = (payments ?? []).map((p) => {
    const pt = Array.isArray(p.payment_types) ? p.payment_types[0] : p.payment_types;
    const card = Array.isArray(p.card) ? p.card[0] : p.card;
    return {
      id: p.id,
      paid_date: p.paid_date,
      card_name: card?.name ?? "—",
      payment_type_name: pt?.name ?? "—",
      principal_amount: Number(p.principal_amount),
      interest_amount: Number(p.interest_amount),
      notes: p.notes,
    };
  });

  const paymentTypeOptions = (paymentTypes ?? []).map((pt) => ({ value: pt.id, label: pt.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Credit Card Payable"
        description="Outstanding balance and installment payment history for card-funded purchases."
        actions={<LogPaymentDialog cards={cards} paymentTypeOptions={paymentTypeOptions} />}
      />

      {cards.length === 0 ? (
        <Card className="max-w-lg">
          <CardContent className="p-4 text-sm text-(--color-text-muted)">
            No purchasing-only credit card payment types are set up yet. Add one on the Payment Methods page.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <Card key={c.value}>
              <CardContent className="p-5">
                <p className="text-sm text-(--color-text-muted)">{c.label}</p>
                <p className="mt-1 text-2xl font-semibold text-(--color-text) tabular-nums">{peso(c.balance)}</p>
                <p className="mt-1 text-xs text-(--color-text-muted)">{c.accountLabel}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <CreditCardPaymentsTable data={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
