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

function modifierValue(nameSnapshot: string) {
  const idx = nameSnapshot.indexOf(": ");
  return idx === -1 ? nameSnapshot : nameSnapshot.slice(idx + 2);
}

export default async function QuoteViewPage({ params }: { params: Promise<{ quoteNumber: string }> }) {
  const { quoteNumber } = await params;
  const supabase = await createClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select(
      "quote_number, status, quote_date, valid_until, note, subtotal, total_discount, total_money, store_id, created_by, customers(name, phone_number, email, address_line1, barangay, city, province), quote_items(id, item_name_snapshot, sku_snapshot, quantity, unit_price, discount_id, line_discount, quote_item_modifiers(name_snapshot, price_snapshot)), preparer:profiles!quotes_created_by_fkey(full_name, function_title)"
    )
    .eq("quote_number", quoteNumber)
    .single();

  if (!quote) notFound();

  const { data: store } = await supabase
    .from("stores")
    .select("address, phone, email")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const customer = firstOf(quote.customers);
  const preparer = firstOf(quote.preparer);
  const customerAddress = [customer?.address_line1, customer?.barangay, customer?.city, customer?.province]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex justify-end gap-2 print:hidden">
        <Link href={`/dashboard/orders/quotation/${quoteNumber}`}>
          <Button variant="secondary">Back</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="space-y-6 p-8">
          <div>
            <p className="text-lg font-semibold text-(--color-text)">Sinag Ukit</p>
            {store?.address && <p className="text-sm text-(--color-text-muted)">Address: {store.address}</p>}
            {store?.phone && <p className="text-sm text-(--color-text-muted)">Phone: {store.phone}</p>}
            {store?.email && <p className="text-sm text-(--color-text-muted)">Email: {store.email}</p>}
          </div>

          <div className="flex justify-between border-t border-(--color-border) pt-4">
            <div>
              <p className="text-xs uppercase text-(--color-text-muted)">Quote Number</p>
              <p className="text-sm font-medium text-(--color-text)">{quote.quote_number}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-(--color-text-muted)">Quote Date</p>
              <p className="text-sm text-(--color-text)">{quote.quote_date}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-(--color-text-muted)">Valid Until</p>
              <p className="text-sm text-(--color-text)">{quote.valid_until}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-(--color-text-muted)">Status</p>
              <p className="text-sm capitalize text-(--color-text)">{quote.status}</p>
            </div>
          </div>

          <div className="border-t border-(--color-border) pt-4">
            <p className="text-xs uppercase text-(--color-text-muted)">Customer</p>
            <p className="text-sm font-medium text-(--color-text)">{customer?.name ?? "Walk-in customer"}</p>
            {customerAddress && <p className="text-sm text-(--color-text-muted)">{customerAddress}</p>}
            {customer?.phone_number && <p className="text-sm text-(--color-text-muted)">{customer.phone_number}</p>}
          </div>

          <div className="border-t border-(--color-border) pt-4">
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="border-b border-(--color-border) text-left text-xs uppercase text-(--color-text-muted)">
                  <th className="py-2">Item</th>
                  <th className="w-[12%] py-2">Qty</th>
                  <th className="w-[12%] py-2">Unit Price</th>
                  <th className="w-[12%] py-2">Discount</th>
                  <th className="w-[12%] py-2 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {(quote.quote_items ?? []).map((item) => {
                  const modifierTotal = (item.quote_item_modifiers ?? []).reduce(
                    (sum, m) => sum + Number(m.price_snapshot),
                    0
                  );
                  const unitPriceWithModifier = Number(item.unit_price) + modifierTotal;
                  const total = Math.max(
                    0,
                    Number(item.quantity) * unitPriceWithModifier - Number(item.line_discount)
                  );
                  return (
                    <tr key={item.id} className="border-b border-(--color-border) last:border-0">
                      <td className="py-2 text-(--color-text)">
                        {item.item_name_snapshot}
                        {(item.quote_item_modifiers ?? []).length > 0 && (
                          <p className="text-xs text-(--color-text-muted)">
                            {(item.quote_item_modifiers ?? []).map((m) => modifierValue(m.name_snapshot)).join(", ")}
                          </p>
                        )}
                      </td>
                      <td className="py-2 text-(--color-text)">{item.quantity}</td>
                      <td className="py-2 text-(--color-text)">{peso(unitPriceWithModifier)}</td>
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
              <span>{peso(Number(quote.subtotal) + Number(quote.total_discount))}</span>
            </div>
            <div className="flex justify-between text-(--color-text-muted)">
              <span>Total Discount</span>
              <span>-{peso(Number(quote.total_discount))}</span>
            </div>
            <div className="flex justify-between font-medium text-(--color-text)">
              <span>Grand Total</span>
              <span>{peso(Number(quote.total_money))}</span>
            </div>
          </div>

          {quote.note && (
            <div className="border-t border-(--color-border) pt-4">
              <p className="text-xs uppercase text-(--color-text-muted)">Notes</p>
              <p className="text-sm text-(--color-text)">{quote.note}</p>
            </div>
          )}

          <div className="border-t border-(--color-border) pt-4">
            <p className="text-xs uppercase text-(--color-text-muted)">Prepared by</p>
            <p className="text-sm font-medium text-(--color-text)">{preparer?.full_name ?? "—"}</p>
            {preparer?.function_title && (
              <p className="text-sm text-(--color-text-muted)">{preparer.function_title}</p>
            )}
          </div>

          <div className="border-t border-(--color-border) pt-4">
            <p className="text-xs text-(--color-text-muted)">
              Note: No signature required, electronically prepared.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
