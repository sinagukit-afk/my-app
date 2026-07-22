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
import { createOrder } from "../actions";
import {
  OrderLineItemsEditor,
  emptyOrderRow,
  resolveOrderLines,
  type OrderLineRow,
  type VariantOption,
  type DiscountOption,
  type ModifierGroupOption,
} from "../order-line-items";

type CustomerOption = { id: string; name: string };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function plusDays(dateIso: string, days: number) {
  const d = new Date(dateIso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

type Props = {
  customers: CustomerOption[];
  variantOptions: VariantOption[];
  discounts: DiscountOption[];
  modifierGroups: ModifierGroupOption[];
};

export function NewOrderForm({ customers, variantOptions, discounts, modifierGroups }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [orderDate, setOrderDate] = useState(todayIso());
  const [targetDate, setTargetDate] = useState(plusDays(todayIso(), 5));
  const [targetDateTouched, setTargetDateTouched] = useState(false);
  const [rows, setRows] = useState<OrderLineRow[]>([emptyOrderRow()]);
  const [error, setError] = useState<string | null>(null);

  const initialSnapshot = useRef(JSON.stringify({ orderDate, targetDate, rows }));
  const isDirty = JSON.stringify({ orderDate, targetDate, rows }) !== initialSnapshot.current;
  useRegisterUnsavedChanges(isDirty);

  function handleOrderDateChange(value: string) {
    setOrderDate(value);
    if (!targetDateTouched) setTargetDate(plusDays(value, 5));
  }

  function handleTargetDateChange(value: string) {
    setTargetDateTouched(true);
    setTargetDate(value);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    const newItems = resolveOrderLines(rows, variantOptions, discounts, modifierGroups);

    if (newItems.length === 0) {
      setError("Add at least one line item with a quantity greater than zero.");
      return;
    }

    formData.set("items_json", JSON.stringify(newItems));
    formData.set("target_date", targetDate);

    startTransition(async () => {
      const res = await createOrder(formData);
      if (res.success) {
        // replace, not push: a successful save should drop this form out of history so
        // browser Back doesn't return the user to the (now stale) create form.
        router.replace(
          res.orderNumber ? `/dashboard/orders/active-orders/${res.orderNumber}` : "/dashboard/orders/active-orders"
        );
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PageHeader
        title="New Order"
        description="Create a Sales Order directly, without an existing Quote."
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
            options={customers.map((c) => ({ value: c.id, label: c.name }))}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DatePicker label="Order Date" value={orderDate} onChange={(e) => handleOrderDateChange(e.target.value)} />
            <DatePicker label="Target Date" value={targetDate} onChange={(e) => handleTargetDateChange(e.target.value)} />
          </div>
          <TextArea label="Notes" name="note" rows={2} />
        </CardContent>
      </Card>

      <OrderLineItemsEditor
        rows={rows}
        onRowsChange={setRows}
        variantOptions={variantOptions}
        discounts={discounts}
        modifierGroups={modifierGroups}
      />

      {error && <p className="text-sm text-(--color-danger)">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating…" : "Create Order"}
        </Button>
      </div>
    </form>
  );
}
