import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IncomingItemForm } from "./IncomingItemForm";

type ItemRow = {
  id: string;
  name: string;
  item_variants: {
    id: string;
    sku: string | null;
    cost: number | null;
  }[];
};

export default async function IncomingItemsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: items, error } = await supabase
    .from("items")
    .select("id,name,item_variants(id,sku,cost)")
    .ilike("name", "Inv%")
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .returns<ItemRow[]>();

  const itemOptions =
    items?.flatMap((item) =>
      item.item_variants.map((variant) => ({
        id: item.id,
        variantId: variant.id,
        name: item.name,
        sku: variant.sku,
        cost: variant.cost,
      }))
    ) ?? [];

  return (
    <main className="bg-stone-50 p-6">
      <div className="mx-auto w-full max-w-4xl">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-stone-500">
            Receiving
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
            Add incoming item
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
            Record newly received stock from online orders, suppliers, or other
            sources.
          </p>
        </div>

        <section className="mt-6 rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
          {error ? (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              Items could not be loaded: {error.message}
            </div>
          ) : (
            <IncomingItemForm
              items={itemOptions}
              userEmail={user.email ?? "Signed-in user"}
            />
          )}
        </section>
      </div>
    </main>
  );
}
