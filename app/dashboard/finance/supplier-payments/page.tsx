import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SupplierPaymentTable, type SupplierPayableRow } from "./supplier-payment-table";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

type SearchParams = Promise<{ from?: string; to?: string }>;

export default async function SupplierPaymentsPage({ searchParams }: { searchParams: SearchParams }) {
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
          title="Supplier Payment"
          description="Inventory PO, Expense PO, Asset PO, and Manual Incoming payables."
        />
        <Card className="max-w-lg">
          <CardContent className="p-4 text-sm text-(--color-text-muted)">
            Finance records are restricted to Admin and Manager roles. Contact an administrator if you need
            access.
          </CardContent>
        </Card>
      </div>
    );
  }

  let expenseQuery = supabase
    .from("opex_expenses")
    .select("id, expense_number, amount, expense_date, payment_status, source, suppliers(name)")
    .is("deleted_at", null);
  if (from) expenseQuery = expenseQuery.gte("expense_date", from);
  if (to) expenseQuery = expenseQuery.lte("expense_date", to);

  let assetQuery = supabase
    .from("fixed_assets")
    .select("id, name, cost, purchased_date, payment_status, suppliers(name)");
  if (from) assetQuery = assetQuery.gte("purchased_date", from);
  if (to) assetQuery = assetQuery.lte("purchased_date", to);

  let manualIncomingQuery = supabase
    .from("incoming_items")
    .select(
      "id, reference, total_price, shipping_fee, discount_amount, date_received, payment_status, supplier, suppliers(name)"
    )
    .is("purchase_order_id", null);
  if (from) manualIncomingQuery = manualIncomingQuery.gte("date_received", from);
  if (to) manualIncomingQuery = manualIncomingQuery.lte("date_received", to);

  let poIncomingQuery = supabase
    .from("incoming_items")
    .select("purchase_order_id, total_price, shipping_fee, discount_amount, date_received")
    .not("purchase_order_id", "is", null);
  if (from) poIncomingQuery = poIncomingQuery.gte("date_received", from);
  if (to) poIncomingQuery = poIncomingQuery.lte("date_received", to);

  const [
    { data: expenses, error: expensesError },
    { data: assets, error: assetsError },
    { data: manualIncoming, error: manualIncomingError },
    { data: poIncoming, error: poIncomingError },
    { data: paymentsData },
  ] = await Promise.all([
    expenseQuery.order("expense_date", { ascending: false }),
    assetQuery.order("purchased_date", { ascending: false }),
    manualIncomingQuery.order("date_received", { ascending: false }),
    poIncomingQuery,
    supabase.from("payable_payments").select("payable_type, payable_id, amount").is("voided_at", null),
  ]);

  // Inventory POs are one payable per PO, not per receiving batch — group every
  // receiving line by purchase_order_id and sum what's actually been received so far.
  const poGroups = new Map<string, { total: number; latestDate: string }>();
  for (const row of poIncoming ?? []) {
    const poId = row.purchase_order_id as string;
    // Line Cost (total_price) already IS the payable — discount_amount is only the
    // gap vs. registered/default cost, posted to the Supplier Discount account for
    // inventory valuation. It does not reduce what's owed to the supplier.
    const lineTotal = Number(row.total_price) + Number(row.shipping_fee);
    const g = poGroups.get(poId);
    if (g) {
      g.total += lineTotal;
      if (row.date_received > g.latestDate) g.latestDate = row.date_received;
    } else {
      poGroups.set(poId, { total: lineTotal, latestDate: row.date_received });
    }
  }

  const poIds = [...poGroups.keys()];
  const { data: pos, error: posError } = poIds.length
    ? await supabase
        .from("purchase_orders")
        .select("id, reference, payment_status, suppliers(name)")
        .in("id", poIds)
    : { data: [], error: null };

  const paidByKey = new Map<string, number>();
  for (const p of paymentsData ?? []) {
    const key = `${p.payable_type}:${p.payable_id}`;
    paidByKey.set(key, (paidByKey.get(key) ?? 0) + Number(p.amount));
  }

  // payment_status is the ground truth (some rows were marked paid before the
  // payable_payments ledger existed for their type, or created pre-paid directly,
  // so the ledger sum alone can under-report "paid" for those rows).
  function paidAndRemaining(status: string, total: number, ledgerPaid: number) {
    if (status === "paid") return { paid: total, remaining: 0 };
    return { paid: ledgerPaid, remaining: total - ledgerPaid };
  }

  const expenseRows: SupplierPayableRow[] = (expenses ?? []).map((e) => {
    const supplier = firstOf(e.suppliers);
    const total = Number(e.amount);
    const { paid, remaining } = paidAndRemaining(e.payment_status, total, paidByKey.get(`expense:${e.id}`) ?? 0);
    return {
      key: `expense:${e.id}`,
      type: e.source === "purchase_order" ? "expense_po" : "direct_expense",
      reference: e.expense_number,
      supplier_name: supplier?.name ?? null,
      date: e.expense_date,
      total,
      paid,
      remaining,
      payment_status: e.payment_status as SupplierPayableRow["payment_status"],
      detail_href: `/dashboard/finance/expenses/${e.id}`,
    };
  });

  const assetRows: SupplierPayableRow[] = (assets ?? []).map((a) => {
    const supplier = firstOf(a.suppliers);
    const total = Number(a.cost);
    const { paid, remaining } = paidAndRemaining(a.payment_status, total, paidByKey.get(`asset:${a.id}`) ?? 0);
    return {
      key: `asset:${a.id}`,
      type: "asset_po",
      reference: a.name,
      supplier_name: supplier?.name ?? null,
      date: a.purchased_date,
      total,
      paid,
      remaining,
      payment_status: a.payment_status as SupplierPayableRow["payment_status"],
      detail_href: `/dashboard/finance/fixed-assets/${a.id}`,
    };
  });

  const manualIncomingRows: SupplierPayableRow[] = (manualIncoming ?? []).map((i) => {
    const supplier = firstOf(i.suppliers);
    const total = Number(i.total_price) + Number(i.shipping_fee);
    const { paid, remaining } = paidAndRemaining(i.payment_status, total, paidByKey.get(`inventory:${i.id}`) ?? 0);
    return {
      key: `inventory:${i.id}`,
      type: "manual_incoming",
      reference: i.reference,
      supplier_name: supplier?.name ?? i.supplier ?? null,
      date: i.date_received,
      total,
      paid,
      remaining,
      payment_status: i.payment_status as SupplierPayableRow["payment_status"],
      detail_href: `/dashboard/finance/supplier-payments/incoming/${i.id}`,
    };
  });

  const poRows: SupplierPayableRow[] = (pos ?? []).map((po) => {
    const supplier = firstOf(po.suppliers);
    const group = poGroups.get(po.id)!;
    const { paid, remaining } = paidAndRemaining(
      po.payment_status,
      group.total,
      paidByKey.get(`purchase_order:${po.id}`) ?? 0
    );
    return {
      key: `purchase_order:${po.id}`,
      type: "inventory_po",
      reference: po.reference,
      supplier_name: supplier?.name ?? null,
      date: group.latestDate,
      total: group.total,
      paid,
      remaining,
      payment_status: po.payment_status as SupplierPayableRow["payment_status"],
      detail_href: `/dashboard/finance/supplier-payments/inventory-po/${po.reference}`,
    };
  });

  const rows = [...expenseRows, ...assetRows, ...manualIncomingRows, ...poRows].sort((a, b) =>
    a.date < b.date ? 1 : -1
  );

  const error = expensesError || assetsError || manualIncomingError || poIncomingError || posError;

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-(--color-danger)">Failed to load supplier payables: {error.message}</p>
      )}
      <SupplierPaymentTable data={rows} from={from} to={to} />
    </div>
  );
}
