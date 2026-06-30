import { createClient } from "@/lib/supabase/server";

type ReceiptLineItem = {
  id: string;
  item_name_snapshot: string | null;
  sku_snapshot: string | null;
  quantity: number | null;
  unit_price: number | null;
  cost_at_sale: number | null;
  gross_total_money: number | null;
  total_discount: number | null;
  receipts: {
    receipt_number: string | null;
    receipt_date: string | null;
    receipt_type: string | null;
    cancelled_at: string | null;
    total_money: number | null;
    stores: {
      name: string | null;
    } | null;
  } | null;
};

function money(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);
}

function number(value: number) {
  return new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: 3,
  }).format(value);
}

function date(value: string | null) {
  if (!value) {
    return "Not tracked";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Not tracked";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function netSales(item: ReceiptLineItem) {
  return (item.gross_total_money ?? 0) - (item.total_discount ?? 0);
}

function costOfSales(item: ReceiptLineItem) {
  return (item.cost_at_sale ?? 0) * (item.quantity ?? 0);
}

export default async function SalesDashboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("receipt_line_items")
    .select(
      "id,item_name_snapshot,sku_snapshot,quantity,unit_price,cost_at_sale,gross_total_money,total_discount,receipts(receipt_number,receipt_date,receipt_type,cancelled_at,total_money,stores(name))"
    )
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<ReceiptLineItem[]>();

  const lineItems = (data ?? []).filter(
    (item) =>
      item.receipts?.cancelled_at === null &&
      item.receipts?.receipt_type?.toLowerCase() === "sale"
  );
  const totalSales = lineItems.reduce((sum, item) => sum + netSales(item), 0);
  const totalCost = lineItems.reduce((sum, item) => sum + costOfSales(item), 0);
  const grossProfit = totalSales - totalCost;
  const margin = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;
  const totalUnits = lineItems.reduce(
    (sum, item) => sum + (item.quantity ?? 0),
    0
  );

  const topItems = [...lineItems]
    .sort((a, b) => netSales(b) - netSales(a))
    .slice(0, 8);

  return (
    <main className="bg-stone-50 p-6">
      <div className="mx-auto w-full max-w-6xl">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-stone-500">
            Sales
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
            Sales and cost dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
            Track receipt sales against the related item cost at the time of
            sale.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">Net sales</p>
            <p className="mt-3 text-2xl font-semibold text-stone-950">
              {money(totalSales)}
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">Cost of sales</p>
            <p className="mt-3 text-2xl font-semibold text-red-700">
              {money(totalCost)}
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">Gross profit</p>
            <p className="mt-3 text-2xl font-semibold text-emerald-700">
              {money(grossProfit)}
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">Gross margin</p>
            <p className="mt-3 text-2xl font-semibold text-stone-950">
              {number(margin)}%
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">Line items</p>
            <p className="mt-3 text-2xl font-semibold text-stone-950">
              {lineItems.length}
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">Units sold</p>
            <p className="mt-3 text-2xl font-semibold text-stone-950">
              {number(totalUnits)}
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">Average sale per line</p>
            <p className="mt-3 text-2xl font-semibold text-stone-950">
              {money(lineItems.length ? totalSales / lineItems.length : 0)}
            </p>
          </div>
        </div>

        <section className="mt-6 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-stone-950">
              Top sales by line item
            </h2>
          </div>

          {error ? (
            <div className="px-5 py-10">
              <p className="text-sm font-medium text-red-700">
                Sales could not be loaded.
              </p>
              <p className="mt-2 text-sm text-stone-600">{error.message}</p>
            </div>
          ) : topItems.length === 0 ? (
            <div className="px-5 py-10 text-sm text-stone-600">
              No sales line items found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Receipt</th>
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 font-medium">Item</th>
                    <th className="px-5 py-3 font-medium">SKU</th>
                    <th className="px-5 py-3 font-medium">Qty</th>
                    <th className="px-5 py-3 font-medium">Sales</th>
                    <th className="px-5 py-3 font-medium">Cost</th>
                    <th className="px-5 py-3 font-medium">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {topItems.map((item) => {
                    const sales = netSales(item);
                    const cost = costOfSales(item);
                    const profit = sales - cost;

                    return (
                      <tr key={item.id} className="text-stone-700">
                        <td className="px-5 py-4 font-medium text-stone-950">
                          {item.receipts?.receipt_number ?? "-"}
                        </td>
                        <td className="px-5 py-4">
                          {date(item.receipts?.receipt_date ?? null)}
                        </td>
                        <td className="px-5 py-4">
                          {item.item_name_snapshot ?? "Unlabeled item"}
                        </td>
                        <td className="px-5 py-4">{item.sku_snapshot ?? "-"}</td>
                        <td className="px-5 py-4">
                          {number(item.quantity ?? 0)}
                        </td>
                        <td className="px-5 py-4 font-medium">
                          {money(sales)}
                        </td>
                        <td className="px-5 py-4 text-red-700">
                          {money(cost)}
                        </td>
                        <td
                          className={`px-5 py-4 font-medium ${
                            profit >= 0 ? "text-emerald-700" : "text-red-700"
                          }`}
                        >
                          {money(profit)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
