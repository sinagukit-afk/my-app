"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { TextArea } from "@/components/ui/textarea";
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

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const newItems = resolveOrderLines(rows, variantOptions, discounts, modifierGroups);

    if (newItems.length === 0) {
      alert("Add at least one line item with a quantity greater than zero.");
      return;
    }

    formData.set("items_json", JSON.stringify(newItems));

    startTransition(async () => {
      const res = await adjustOrderItems(orderId, formData);
      if (res.success) {
        router.push("/dashboard/orders/active-orders");
      } else {
        alert(res.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PageHeader
        title="Edit Order"
        description="Change the customer, notes, or line items. Stock is automatically reserved or released to match."
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

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
