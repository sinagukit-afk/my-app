import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { LogPaymentDialog } from "./log-payment-dialog";
import { CreditCardPaymentsTable, type PaymentRow } from "./credit-card-payments-table";

function peso(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
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

  const { data: lines } = await supabase
    .from("journal_entry_lines")
    .select("debit, credit, accounts!inner(account_number)")
    .eq("accounts.account_number", "SCA-2020");

  const outstandingBalance = (lines ?? []).reduce(
    (s, l) => s + Number(l.credit || 0) - Number(l.debit || 0),
    0
  );

  const { data: payments } = await supabase
    .from("credit_card_installment_payments")
    .select("id, paid_date, principal_amount, interest_amount, notes, payment_types(name)")
    .order("paid_date", { ascending: false });

  const rows: PaymentRow[] = (payments ?? []).map((p) => {
    const pt = Array.isArray(p.payment_types) ? p.payment_types[0] : p.payment_types;
    return {
      id: p.id,
      paid_date: p.paid_date,
      payment_type_name: pt?.name ?? "—",
      principal_amount: Number(p.principal_amount),
      interest_amount: Number(p.interest_amount),
      notes: p.notes,
    };
  });

  const { data: paymentTypes } = await supabase.from("payment_types").select("id, name").order("name");
  const paymentTypeOptions = (paymentTypes ?? []).map((pt) => ({ value: pt.id, label: pt.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Credit Card Payable"
        description="Outstanding balance and installment payment history for card-funded purchases."
        actions={
          <LogPaymentDialog paymentTypeOptions={paymentTypeOptions} outstandingBalance={outstandingBalance} />
        }
      />

      <Card className="max-w-sm">
        <CardContent className="p-5">
          <p className="text-sm text-(--color-text-muted)">Outstanding Balance</p>
          <p className="mt-1 text-2xl font-semibold text-(--color-text) tabular-nums">
            {peso(outstandingBalance)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <CreditCardPaymentsTable data={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
