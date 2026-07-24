import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { canManageMarketing } from "../../access";
import { ProductDetail, type ProductDetailData, type ModifierRow } from "./product-detail";

export default async function WebsiteProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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

  const { data: product } = await supabase
    .from("web_products")
    .select(
      "id, slug, name, description, category, starting_price, moq, lead_time_standard, rush_option, pricing_notes, sort_order, published, deleted_at"
    )
    .eq("id", id)
    .single();

  if (!product) notFound();

  const { data: modifierRows } = await supabase
    .from("web_productmodifier")
    .select("id, modifier_name, description, price_modifier, sort_order, published, deleted_at")
    .eq("product_id", id)
    .order("sort_order")
    .order("modifier_name");

  const data: ProductDetailData = {
    ...product,
    starting_price: Number(product.starting_price),
  };

  const modifiers: ModifierRow[] = (modifierRows ?? []).map((modifier) => ({
    ...modifier,
    price_modifier: Number(modifier.price_modifier),
  }));

  return <ProductDetail product={data} modifiers={modifiers} />;
}
