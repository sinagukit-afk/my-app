import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { canManageMarketing } from "../../access";
import { QuoteRequestDetail, type QuoteRequestDetailData } from "./quote-request-detail";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function WebQuoteRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!(await canManageMarketing())) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-(--color-danger)">
          You don&apos;t have permission to view website quote requests. Only admins and managers
          can work this inbox.
        </CardContent>
      </Card>
    );
  }

  const supabase = await createClient();

  const { data: request } = await supabase
    .from("web_quote_requests")
    .select(
      "id, full_name, email, phone, shipping_address, product_category, quantity, customization_details, needed_by_date, status, converted_quote_id, submitter_ip, user_agent, created_at, updated_at, quotes(quote_number)"
    )
    .eq("id", id)
    .single();

  if (!request) notFound();

  const linkedQuote = firstOf(request.quotes);

  const data: QuoteRequestDetailData = {
    id: request.id,
    full_name: request.full_name,
    email: request.email,
    phone: request.phone,
    shipping_address: request.shipping_address,
    product_category: request.product_category,
    quantity: request.quantity,
    customization_details: request.customization_details,
    needed_by_date: request.needed_by_date,
    status: request.status,
    converted_quote_id: request.converted_quote_id,
    converted_quote_number: linkedQuote?.quote_number ?? null,
    submitter_ip: request.submitter_ip ? String(request.submitter_ip) : null,
    user_agent: request.user_agent,
    created_at: request.created_at,
    updated_at: request.updated_at,
  };

  return <QuoteRequestDetail request={data} />;
}
