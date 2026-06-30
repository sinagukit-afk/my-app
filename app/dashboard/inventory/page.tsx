import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type DashboardSearchParams = Promise<{
  stock?: string;
}>;

type InventoryLevel = {
  id: string;
  in_stock: number | null;
  source_updated_at: string | null;
  updated_at: string | null;
  stores: {
    name: string | null;
  } | null;
  item_variants: {
    sku: string | null;
    barcode: string | null;
    items: {
      name: string | null;
      categories: {
        name: string | null;
      } | null;
    } | null;
  } | null;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Not tracked";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not tracked";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 3,
  }).format(value);
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: DashboardSearchParams;
}) {
  const { stock } = await searchParams;
  const showOutOfStockOnly = stock === "out";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_levels")
    .select(
      "id,in_stock,source_updated_at,updated_at,stores(name),item_variants(sku,barcode,items(name,categories(name)))"
    )
    .order("in_stock", { ascending: true })
    .limit(100)
    .returns<InventoryLevel[]>();

  const inventory = data ?? [];
  const outOfStock = inventory.filter((item) => (item.in_stock ?? 0) <= 0);
  const available = inventory.filter((item) => (item.in_stock ?? 0) > 0);
  const visibleInventory = showOutOfStockOnly ? outOfStock : inventory;

  return (
    <main className="bg-stone-50 p-6">
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-stone-500">
              Inventory
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
              Stock dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
              Review available inventory and quickly isolate items that need
              restocking.
            </p>
          </div>

          <div className="flex rounded-md border border-stone-200 bg-white p-1 text-sm shadow-sm">
            <Link
              href="/dashboard/inventory"
              className={`rounded px-3 py-2 font-medium transition-colors ${
                showOutOfStockOnly
                  ? "text-stone-600 hover:bg-stone-50"
                  : "bg-stone-950 text-white"
              }`}
            >
              All inventory
            </Link>
            <Link
              href="/dashboard/inventory?stock=out"
              className={`rounded px-3 py-2 font-medium transition-colors ${
                showOutOfStockOnly
                  ? "bg-stone-950 text-white"
                  : "text-stone-600 hover:bg-stone-50"
              }`}
            >
              Out of stock
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">Total inventory rows</p>
            <p className="mt-3 text-3xl font-semibold text-stone-950">
              {inventory.length}
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">Available</p>
            <p className="mt-3 text-3xl font-semibold text-emerald-700">
              {available.length}
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">Out of stock</p>
            <p className="mt-3 text-3xl font-semibold text-red-700">
              {outOfStock.length}
            </p>
          </div>
        </div>

        <section className="mt-6 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-stone-950">
              {showOutOfStockOnly ? "Out of stock items" : "Inventory items"}
            </h2>
          </div>

          {error ? (
            <div className="px-5 py-10">
              <p className="text-sm font-medium text-red-700">
                Inventory could not be loaded.
              </p>
              <p className="mt-2 text-sm text-stone-600">{error.message}</p>
            </div>
          ) : visibleInventory.length === 0 ? (
            <div className="px-5 py-10 text-sm text-stone-600">
              {showOutOfStockOnly
                ? "No out-of-stock items found."
                : "No inventory rows found."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Item</th>
                    <th className="px-5 py-3 font-medium">SKU</th>
                    <th className="px-5 py-3 font-medium">Category</th>
                    <th className="px-5 py-3 font-medium">Store</th>
                    <th className="px-5 py-3 font-medium">In stock</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Source updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {visibleInventory.map((item) => {
                    const quantity = item.in_stock ?? 0;
                    const isOutOfStock = quantity <= 0;
                    const variant = item.item_variants;
                    const product = variant?.items;

                    return (
                      <tr key={item.id} className="text-stone-700">
                        <td className="px-5 py-4 font-medium text-stone-950">
                          {product?.name ?? "Unlabeled item"}
                        </td>
                        <td className="px-5 py-4">{variant?.sku ?? "-"}</td>
                        <td className="px-5 py-4">
                          {product?.categories?.name ?? "-"}
                        </td>
                        <td className="px-5 py-4">{item.stores?.name ?? "-"}</td>
                        <td className="px-5 py-4 font-medium">
                          {formatQuantity(quantity)}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`rounded-md px-2 py-1 text-xs font-medium ${
                              isOutOfStock
                                ? "bg-red-50 text-red-700"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {isOutOfStock ? "Out of stock" : "Available"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {formatDate(item.source_updated_at ?? item.updated_at)}
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
