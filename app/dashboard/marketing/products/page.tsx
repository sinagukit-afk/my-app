import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { canManageMarketing } from "../access";
import { ProductsTable, type ProductRow } from "./products-table";

export default async function WebsiteProductsPage() {
  if (!(await canManageMarketing())) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-(--color-danger)">
          You don&apos;t have permission to manage website content. Only admins and managers can
          edit the public product catalog.
        </CardContent>
      </Card>
    );
  }

  const supabase = await createClient();

  const [{ data: productRows, error }, { data: modifierRows }] = await Promise.all([
    supabase
      .from("web_products")
      .select(
        "id, slug, name, description, category, starting_price, moq, lead_time_standard, rush_option, pricing_notes, sort_order, published, deleted_at"
      )
      .order("sort_order")
      .order("name"),
    supabase
      .from("web_productmodifier")
      .select("product_id")
      .is("deleted_at", null),
  ]);

  const modifierCounts = new Map<string, number>();
  for (const modifier of modifierRows ?? []) {
    modifierCounts.set(modifier.product_id, (modifierCounts.get(modifier.product_id) ?? 0) + 1);
  }

  const rows: ProductRow[] = (productRows ?? []).map((product) => ({
    ...product,
    starting_price: Number(product.starting_price),
    modifier_count: modifierCounts.get(product.id) ?? 0,
  }));

  // Free-text column on the table — suggest what's already in use rather than forcing a fixed list.
  const categories = Array.from(
    new Set((productRows ?? []).map((p) => p.category).filter((c): c is string => !!c))
  ).sort();

  return (
    <div className="space-y-6">
      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">
            Failed to load website products: {error.message}
          </CardContent>
        </Card>
      )}

      <ProductsTable data={rows} categories={categories} />
    </div>
  );
}
