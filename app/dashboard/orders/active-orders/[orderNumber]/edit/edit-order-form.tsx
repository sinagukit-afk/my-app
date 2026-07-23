"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useRegisterUnsavedChanges } from "@/lib/hooks/use-unsaved-changes";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { TextArea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { adjustOrderItems } from "../../actions";
import {
  OrderLineItemsEditor,
  resolveOrderLines,
  type OrderLineRow,
  type VariantOption,
  type DiscountOption,
  type ModifierGroupOption,
} from "../../order-line-items";

type CustomerOption = { id: string; name: string };

type Props = {
  orderId: string;
  status: string;
  customerId: string | null;
  note: string | null;
  orderDate: string;
  targetDate: string;
  initialRows: OrderLineRow[];
  customers: CustomerOption[];
  variantOptions: VariantOption[];
  discounts: DiscountOption[];
  modifierGroups: ModifierGroupOption[];
};

export function EditOrderForm({
  orderId,
  status,
  customerId,
  note,
  orderDate,
  targetDate,
  initialRows,
  customers,
  variantOptions,
  discounts,
  modifierGroups,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Production Completed freezes the line list entirely; only Customer/Notes
  // may still change (per ORDER-6's editable-until-Production-Completed matrix).
  const itemsLocked = status === "production_completed";
  const [rows, setRows] = useState<OrderLineRow[]>(initialRows);
  const [orderDateValue, setOrderDateValue] = useState(orderDate);
  const [targetDateValue, setTargetDateValue] = useState(targetDate);
  const [error, setError] = useState<string | null>(null);

  const initialSnapshot = useRef(JSON.stringify({ rows, orderDateValue, targetDateValue }));
  const isDirty = JSON.stringify({ rows, orderDateValue, targetDateValue }) !== initialSnapshot.current;
  useRegisterUnsavedChanges(isDirty);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    if (!targetDateValue) {
      setError("Target date is required.");
      return;
    }

    const newItems = resolveOrderLines(rows, variantOptions, discounts, modifierGroups);

    if (newItems.length === 0) {
      setError("Add at least one line item with a quantity greater than zero.");
      return;
    }

    formData.set("items_json", JSON.stringify(newItems));
    formData.set("order_date", orderDateValue);
    formData.set("target_date", targetDateValue);

    startTransition(async () => {
      const res = await adjustOrderItems(orderId, formData);
      if (res.success) {
        // replace, not push: a successful save should drop this edit form out of history so
        // browser Back doesn't return the user to the (now stale) edit form.
        router.replace("/dashboard/orders/active-orders");
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PageHeader
        title="Edit Order"
        description="Change the customer, notes, or line items. Stock is automatically reserved or released to match."
        backHref="/dashboard/orders/active-orders"
        backLabel="Back to Orders"
      />

      <Card>
        <CardHeader>
          <CardTitle>Order Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            label="Customer"
            name="customer_id"
            placeholder="Walk-in customer"
            defaultValue={customerId ?? ""}
            options={customers.map((c) => ({ value: c.id, label: c.name }))}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DatePicker
              label="Order Date"
              value={orderDateValue}
              onChange={(e) => setOrderDateValue(e.target.value)}
            />
            <DatePicker
              label="Target Date"
              value={targetDateValue}
              onChange={(e) => setTargetDateValue(e.target.value)}
            />
          </div>
          <TextArea label="Notes" name="note" rows={2} defaultValue={note ?? ""} />
        </CardContent>
      </Card>

      <OrderLineItemsEditor
        rows={rows}
        onRowsChange={setRows}
        variantOptions={variantOptions}
        discounts={discounts}
        modifierGroups={modifierGroups}
        locked={itemsLocked}
      />

      {error && <p className="text-sm text-(--color-danger)">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
