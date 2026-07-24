"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useNotifications } from "@/components/providers/notification-provider";
import { formatDate, formatDateTime } from "@/lib/utils/format-date";
import { StatusBadge } from "../quote-requests-table";
import { setQuoteRequestStatus } from "../actions";
import type { SettableStatus } from "../statuses";

export type QuoteRequestDetailData = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  shipping_address: string | null;
  product_category: string | null;
  quantity: string | null;
  customization_details: string | null;
  needed_by_date: string | null;
  status: string;
  converted_quote_id: string | null;
  converted_quote_number: string | null;
  submitter_ip: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
};

type Props = {
  request: QuoteRequestDetailData;
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wide text-(--color-text-subtle)">
        {label}
      </span>
      <span className="text-sm text-(--color-text)">{value}</span>
    </div>
  );
}

/** Which transitions make sense from where. `converted` is only reachable by linking a real quote. */
const NEXT_STATUSES: Record<string, { status: SettableStatus; label: string }[]> = {
  new: [
    { status: "contacted", label: "Mark as Contacted" },
    { status: "closed", label: "Close Request" },
  ],
  contacted: [
    { status: "closed", label: "Close Request" },
    { status: "new", label: "Move back to New" },
  ],
  closed: [{ status: "new", label: "Reopen as New" }],
  converted: [],
};

export function QuoteRequestDetail({ request }: Props) {
  const router = useRouter();
  const { notify } = useNotifications();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const transitions = NEXT_STATUSES[request.status] ?? [];

  function handleTransition(status: SettableStatus, label: string) {
    setError(null);
    startTransition(async () => {
      const res = await setQuoteRequestStatus(request.id, status);
      if (res.success) {
        notify(`${label} — done.`, "success");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={request.full_name}
        description={`Website quote request received ${formatDateTime(request.created_at)}`}
        backHref="/dashboard/marketing/quote-requests"
        backLabel="Back to Quote Requests"
        actions={<StatusBadge status={request.status} />}
      />

      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-(--color-danger)">{error}</CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Email"
            value={
              request.email ? (
                <a className="text-(--color-primary) hover:underline" href={`mailto:${request.email}`}>
                  {request.email}
                </a>
              ) : (
                "—"
              )
            }
          />
          <Field
            label="Phone"
            value={
              request.phone ? (
                <a className="text-(--color-primary) hover:underline" href={`tel:${request.phone}`}>
                  {request.phone}
                </a>
              ) : (
                "—"
              )
            }
          />
          <Field
            label="Needed By"
            value={request.needed_by_date ? formatDate(request.needed_by_date) : "—"}
          />
          <Field label="Product Category" value={request.product_category ?? "—"} />
          <Field label="Quantity" value={request.quantity ?? "—"} />
          <Field label="Last Updated" value={formatDateTime(request.updated_at)} />
          <div className="sm:col-span-2 lg:col-span-3">
            <Field label="Shipping Address" value={request.shipping_address ?? "—"} />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <Field
              label="Customization Details"
              value={
                request.customization_details ? (
                  <span className="whitespace-pre-wrap">{request.customization_details}</span>
                ) : (
                  "—"
                )
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <h2 className="text-sm font-semibold text-(--color-text)">ERP Quote</h2>
          {request.converted_quote_id ? (
            <p className="text-sm text-(--color-text-muted)">
              Linked to quote{" "}
              <Link
                href={`/dashboard/orders/quotation/${request.converted_quote_number ?? ""}`}
                className="text-(--color-primary) hover:underline"
              >
                {request.converted_quote_number ?? "View quote"}
              </Link>
              .
            </p>
          ) : (
            <p className="text-sm text-(--color-text-muted)">
              Not linked to an ERP quote. Website requests don&apos;t create quotes automatically —
              raise one under Orders → Quotation if this lead is worth pricing.
            </p>
          )}
        </CardContent>
      </Card>

      {transitions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {transitions.map((transition, index) => (
            <Button
              key={transition.status}
              variant={index === 0 ? "primary" : "secondary"}
              disabled={isPending}
              onClick={() => handleTransition(transition.status, transition.label)}
            >
              {transition.label}
            </Button>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
          <Field label="Submitted From IP" value={request.submitter_ip ?? "—"} />
          <Field
            label="User Agent"
            value={
              <span className="break-all text-xs text-(--color-text-muted)">
                {request.user_agent ?? "—"}
              </span>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
