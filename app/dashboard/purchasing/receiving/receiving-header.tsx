"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  ManualIncomingForm,
  type SupplierOption,
  type ItemOption,
  type PaymentTypeOption,
} from "./manual-incoming-form";

type Props = {
  canWrite: boolean;
  suppliers: SupplierOption[];
  items: ItemOption[];
  paymentTypeOptions: PaymentTypeOption[];
};

export function ReceivingHeader({ canWrite, suppliers, items, paymentTypeOptions }: Props) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Receiving"
        description="Process incoming deliveries and reconcile them against open purchase orders."
        actions={
          canWrite ? (
            <Button onClick={() => setFormOpen(true)}>Log Manual Incoming</Button>
          ) : undefined
        }
      />

      {canWrite && (
        <ManualIncomingForm
          open={formOpen}
          onOpenChange={setFormOpen}
          suppliers={suppliers}
          items={items}
          paymentTypeOptions={paymentTypeOptions}
          onSaved={() => router.refresh()}
        />
      )}
    </>
  );
}
