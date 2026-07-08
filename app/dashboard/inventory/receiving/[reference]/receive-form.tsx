"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { NumberInput } from "@/components/ui/number-input";
import { Button } from "@/components/ui/button";
import { receivePurchaseOrder } from "./actions";

export type ReceivableItem = {
  id: string;
  label: string;
  sku: string | null;
  quantity_ordered: number;
  quantity_received: number;
  remaining: number;
};

type Props = {
  purchaseOrderId: string;
  reference: string;
  items: ReceivableItem[];
};

export function ReceiveForm({ purchaseOrderId, reference, items }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [quantities, setQuantities] = useState<Record<string, string>>(
    Object.fromEntries(items.map((item) => [item.id, String(item.remaining)]))
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const lines = items.map((item) => ({
      po_item_id: item.id,
      quantity: Number(quantities[item.id] ?? 0) || 0,
    }));

    startTransition(async () => {
      const res = await receivePurchaseOrder(purchaseOrderId, reference, lines);
      if (res.success) {
        router.push("/dashboard/inventory/receiving");
        router.refresh();
      } else {
        alert(res.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Post Receipt</CardTitle>
        <CardDescription>
          Enter the quantity actually received for each item. Stock will be updated immediately.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="grid grid-cols-[1fr_auto] items-end gap-4 border-b border-(--color-border) pb-3 last:border-0">
              <div>
                <p className="font-medium text-(--color-text)">{item.label}</p>
                <p className="text-xs text-(--color-text-muted)">
                  {item.sku ? `${item.sku} — ` : ""}
                  Ordered {item.quantity_ordered}, received {item.quantity_received}, remaining {item.remaining}
                </p>
              </div>
              <NumberInput
                className="w-32"
                min={0}
                max={item.remaining}
                step="any"
                value={quantities[item.id] ?? ""}
                onChange={(e) => setQuantities((prev) => ({ ...prev, [item.id]: e.target.value }))}
              />
            </div>
          ))}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Posting…" : "Post Receipt"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
