"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useRegisterUnsavedChanges } from "@/lib/hooks/use-unsaved-changes";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { TextArea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { updateQuoteWithItems } from "../../actions";
import { ORDER_SOURCE_OPTIONS } from "../../../order-source";
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
  orderSource: string | null;
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
  orderSource,
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
  const [customerIdValue, setCustomerIdValue] = useState(customerId ?? "");
  const [orderSourceValue, setOrderSourceValue] = useState(orderSource ?? "");
  const [error, setError] = useState<string | null>(null);

  const initialSnapshot = useRef(
    JSON.stringify({ rows, quoteDateValue, validUntilValue, customerIdValue, orderSourceValue })
  );
  const isDirty =
    JSON.stringify({ rows, quoteDateValue, validUntilValue, customerIdValue, orderSourceValue }) !==
    initialSnapshot.current;
  useRegisterUnsavedChanges(isDirty);

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
    formData.set("quote_date", quoteDateValue);
    formData.set("valid_until", validUntilValue);

    startTransition(async () => {
      const res = await updateQuoteWithItems(quoteId, formData);
      if (res.success) {
        // replace, not push: a successful save should drop this edit form out of history so
        // browser Back doesn't return the user to the (now stale) edit form.
        router.replace("/dashboard/orders/quotation");
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PageHeader
        title="Edit Quote"
        description="Update the customer, notes, or line items on this quote."
        backHref="/dashboard/orders/quotation"
        backLabel="Back to Quotation"
      />

      <Card>
        <CardHeader>
          <CardTitle>Quote Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Combobox
              label="Customer"
              name="customer_id"
              value={customerIdValue}
              onValueChange={setCustomerIdValue}
              placeholder="Walk-in customer"
              searchPlaceholder="Search customers…"
              options={customers.map((c) => ({ value: c.id, label: c.name }))}
            />
            <Combobox
              label="Order Source"
              name="order_source"
              value={orderSourceValue}
              onValueChange={setOrderSourceValue}
              placeholder="Select a source…"
              searchPlaceholder="Search sources…"
              options={ORDER_SOURCE_OPTIONS}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

      <div className="space-y-2">
        {error && <p className="text-sm text-(--color-danger)">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>
    </form>
  );
}
