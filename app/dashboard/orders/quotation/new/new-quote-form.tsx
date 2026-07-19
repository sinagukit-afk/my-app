"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { TextArea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { createQuoteWithItems } from "../actions";
import {
  QuoteLineItemsEditor,
  emptyQuoteRow,
  resolveQuoteLines,
  type QuoteLineRow,
  type VariantOption,
  type DiscountOption,
  type ModifierGroupOption,
} from "../quote-line-items";

type CustomerOption = { id: string; name: string };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function plus30Days(dateIso: string) {
  const d = new Date(dateIso);
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

type Props = {
  customers: CustomerOption[];
  variantOptions: VariantOption[];
  discounts: DiscountOption[];
  modifierGroups: ModifierGroupOption[];
};

export function NewQuoteForm({ customers, variantOptions, discounts, modifierGroups }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<QuoteLineRow[]>([emptyQuoteRow()]);
  const [quoteDate, setQuoteDate] = useState(todayIso());
  const [validUntil, setValidUntil] = useState(plus30Days(todayIso()));
  const [validUntilTouched, setValidUntilTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleQuoteDateChange(value: string) {
    setQuoteDate(value);
    if (!validUntilTouched) setValidUntil(plus30Days(value));
  }

  function handleValidUntilChange(value: string) {
    setValidUntilTouched(true);
    setValidUntil(value);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    const items = resolveQuoteLines(rows, variantOptions, discounts, modifierGroups);
    if (items.length === 0) {
      setError("Add at least one line item with a quantity greater than zero.");
      return;
    }

    formData.set("items_json", JSON.stringify(items));
    formData.set("quote_date", quoteDate);
    formData.set("valid_until", validUntil);

    startTransition(async () => {
      const res = await createQuoteWithItems(formData);
      if (res.success) {
        router.push("/dashboard/orders/quotation");
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PageHeader title="New Quote" description="Build an itemized quote for a customer." />

      <Card>
        <CardHeader>
          <CardTitle>Quote Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            label="Customer"
            name="customer_id"
            placeholder="Walk-in customer"
            options={customers.map((c) => ({ value: c.id, label: c.name }))}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DatePicker
              label="Quote Date"
              value={quoteDate}
              onChange={(e) => handleQuoteDateChange(e.target.value)}
            />
            <DatePicker label="Valid Until" value={validUntil} onChange={(e) => handleValidUntilChange(e.target.value)} />
          </div>
          <TextArea label="Notes" name="note" rows={2} />
        </CardContent>
      </Card>

      <QuoteLineItemsEditor
        rows={rows}
        onRowsChange={setRows}
        variantOptions={variantOptions}
        discounts={discounts}
        modifierGroups={modifierGroups}
      />

      <div className="space-y-2">
        {error && <p className="text-sm text-(--color-danger)">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating…" : "Create Quote"}
          </Button>
        </div>
      </div>
    </form>
  );
}
