import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function peso(n: number) {
  return `₱${n.toFixed(2)}`;
}

export default async function PaymentPreviewPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, created_at, total_money, subtotal, total_discount, store_id, customers(name, phone_number, address_line1, barangay, city, province), order_items(id, item_name_snapshot, sku_snapshot, quantity, unit_price, line_discount, order_item_modifiers(name_snapshot, price_snapshot))"
    )
    .eq("order_number", orderNumber)
    .single();

  if (!order) notFound();

  const { data: store } = order.store_id
    ? await supabase.from("stores").select("name, address").eq("id", order.store_id).single()
    : { data: null };

  const { data: paymentsData } = await supabase
    .from("order_payments")
    .select("payment_date, amount, reference_no, payment_types(name)")
    .eq("order_id", order.id)
    .order("payment_date", { ascending: false });

  const customer = firstOf(order.customers);
  const customerAddress = [customer?.address_line1, customer?.barangay, customer?.city, customer?.province]
    .filter(Boolean)
    .join(", ");

  const payments = paymentsData ?? [];
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalMoney = Number(order.total_money);
  const remainingBalance = Math.max(0, totalMoney - totalPaid);
  const overpaid = Math.max(0, totalPaid - totalMoney);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex justify-end gap-2 print:hidden">
        <Link href={`/dashboard/orders/payment/${orderNumber}`}>
          <Button variant="secondary">Back</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="space-y-6 p-8">
          <div>
            <p className="text-lg font-semibold text-(--color-text)">{store?.name ?? "Sinag Ukit"}</p>
            {store?.address && <p className="text-sm text-(--color-text-muted)">{store.address}</p>}
          </div>

          <div className="flex justify-between border-t border-(--color-border) pt-4">
            <div>
              <p className="text-xs uppercase text-(--color-text-muted)">Order Number</p>
              <p className="text-sm font-medium text-(--color-text)">{order.order_number}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-(--color-text-muted)">Order Date</p>
              <p className="text-sm text-(--color-text)">{order.created_at.slice(0, 10)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-(--color-text-muted)">Status</p>
              <p className="text-sm capitalize text-(--color-text)">{order.status.replace(/_/g, " ")}</p>
            </div>
          </div>

          <div className="border-t border-(--color-border) pt-4">
            <p className="text-xs uppercase text-(--color-text-muted)">Customer</p>
            <p className="text-sm font-medium text-(--color-text)">{customer?.name ?? "Walk-in customer"}</p>
            {customerAddress && <p className="text-sm text-(--color-text-muted)">{customerAddress}</p>}
            {customer?.phone_number && <p className="text-sm text-(--color-text-muted)">{customer.phone_number}</p>}
          </div>

          <div className="border-t border-(--color-border) pt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-(--color-border) text-left text-xs uppercase text-(--color-text-muted)">
                  <th className="py-2">Item</th>
                  <th className="py-2">Qty</th>
                  <th className="py-2">Unit Price</th>
                  <th className="py-2">Modifier</th>
                  <th className="py-2">Discount</th>
                  <th className="py-2 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {(order.order_items ?? []).map((item) => {
                  const modifierTotal = (item.order_item_modifiers ?? []).reduce(
                    (sum, m) => sum + Number(m.price_snapshot),
                    0
                  );
                  const total = Math.max(
                    0,
                    Number(item.quantity) * (Number(item.unit_price) + modifierTotal) - Number(item.line_discount)
                  );
                  return (
                    <tr key={item.id} className="border-b border-(--color-border) last:border-0">
                      <td className="py-2 text-(--color-text)">
                        {item.item_name_snapshot}
                        {item.sku_snapshot ? ` (${item.sku_snapshot})` : ""}
                      </td>
                      <td className="py-2 text-(--color-text)">{item.quantity}</td>
                      <td className="py-2 text-(--color-text)">{peso(Number(item.unit_price))}</td>
                      <td className="py-2 text-(--color-text-muted)">
                        {(item.order_item_modifiers ?? []).map((m) => m.name_snapshot).join(", ") || "—"}
                      </td>
                      <td className="py-2 text-(--color-text-muted)">
                        {Number(item.line_discount) > 0 ? peso(Number(item.line_discount)) : "—"}
                      </td>
                      <td className="py-2 text-right text-(--color-text)">{peso(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="ml-auto max-w-xs space-y-1 border-t border-(--color-border) pt-4 text-sm">
            <div className="flex justify-between text-(--color-text-muted)">
              <span>Subtotal</span>
              <span>{peso(Number(order.subtotal))}</span>
            </div>
            <div className="flex justify-between text-(--color-text-muted)">
              <span>Total Discount</span>
              <span>-{peso(Number(order.total_discount))}</span>
            </div>
            <div className="flex justify-between font-medium text-(--color-text)">
              <span>Order Total</span>
              <span>{peso(totalMoney)}</span>
            </div>
          </div>

          <div className="border-t border-(--color-border) pt-4">
            <p className="text-xs uppercase text-(--color-text-muted)">Payment History</p>
            {payments.length === 0 ? (
              <p className="pt-2 text-sm text-(--color-text-muted)">No payments recorded yet.</p>
            ) : (
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="border-b border-(--color-border) text-left text-xs uppercase text-(--color-text-muted)">
                    <th className="py-2">Date</th>
                    <th className="py-2">Type</th>
                    <th className="py-2">Reference</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p, i) => {
                    const paymentType = firstOf(p.payment_types);
                    return (
                      <tr key={i} className="border-b border-(--color-border) last:border-0">
                        <td className="py-2 text-(--color-text)">{p.payment_date}</td>
                        <td className="py-2 text-(--color-text-muted)">{paymentType?.name ?? "Unspecified"}</td>
                        <td className="py-2 text-(--color-text-muted)">{p.reference_no ?? "—"}</td>
                        <td className="py-2 text-right text-(--color-text)">{peso(Number(p.amount))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="ml-auto max-w-xs space-y-1 border-t border-(--color-border) pt-4 text-sm">
            <div className="flex justify-between text-(--color-text-muted)">
              <span>Total Paid</span>
              <span>{peso(totalPaid)}</span>
            </div>
            {overpaid > 0 ? (
              <div className="flex justify-between font-medium text-(--color-text)">
                <span>Overpaid (tip)</span>
                <span>{peso(overpaid)}</span>
              </div>
            ) : (
              <div className="flex justify-between font-medium text-(--color-text)">
                <span>Remaining Balance</span>
                <span>{peso(remainingBalance)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
