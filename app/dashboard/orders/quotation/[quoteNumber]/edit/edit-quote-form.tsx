"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { TextArea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { updateQuoteWithItems } from "../../actions";
import {
  QuoteLineItemsEditor,
  resolveQuoteLines,
  type QuoteLineRow,
  type VariantOption,
  type DiscountOption,
  type ModifierGroupOption,
} from "../../quote-line-items";

type CustomerOption = { id: string; name: string };

type Props = {
  quoteId: string;
  customerId: string | null;
  note: string | null;
  quoteDate: string;
  validUntil: string;
  initialRows: QuoteLineRow[];
  customers: CustomerOption[];
  variantOptions: VariantOption[];
  discounts: DiscountOption[];
  modifierGroups: ModifierGroupOption[];
};

export function EditQuoteForm({
  quoteId,
  customerId,
  note,
  quoteDate,
  validUntil,
  initialRows,
  customers,
  variantOptions,
  discounts,
  modifierGroups,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<QuoteLineRow[]>(initialRows);
  const [quoteDateValue, setQuoteDateValue] = useState(quoteDate);
  const [validUntilValue, setValidUntilValue] = useState(validUntil);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const items = resolveQuoteLines(rows, variantOptions, discounts, modifierGroups);
    if (items.length === 0) {
      alert("Add at least one line item with a quantity greater than zero.");
      return;
    }

    formData.set("items_json", JSON.stringify(items));
    formData.set("quote_date", quoteDateValue);
    formData.set("valid_until", validUntilValue);

    startTransition(async () => {
      const res = await updateQuoteWithItems(quoteId, formData);
      if (res.success) {
        router.push("/dashboard/orders/quotation");
      } else {
        alert(res.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PageHeader title="Edit Quote" description="Update the customer, notes, or line items on this quote." />

      <Card>
        <CardHeader>
          <CardTitle>Quote Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            label="Customer"
            name="customer_id"
            placeholder="Walk-in customer"
            defaultValue={customerId ?? ""}
            options={customers.map((c) => ({ value: c.id, label: c.name }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <DatePicker
              label="Quote Date"
              value={quoteDateValue}
              onChange={(e) => setQuoteDateValue(e.target.value)}
            />
            <DatePicker
              label="Valid Until"
              value={validUntilValue}
              onChange={(e) => setValidUntilValue(e.target.value)}
            />
          </div>
          <TextArea label="Notes" name="note" rows={2} defaultValue={note ?? ""} />
        </CardContent>
      </Card>

      <QuoteLineItemsEditor
        rows={rows}
        onRowsChange={setRows}
        variantOptions={variantOptions}
        discounts={discounts}
        modifierGroups={modifierGroups}
      />

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
