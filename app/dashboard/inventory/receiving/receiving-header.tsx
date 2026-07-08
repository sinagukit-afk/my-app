"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ManualIncomingForm, type SupplierOption, type ItemOption } from "./manual-incoming-form";

type Props = {
  canWrite: boolean;
  suppliers: SupplierOption[];
  items: ItemOption[];
};

export function ReceivingHeader({ canWrite, suppliers, items }: Props) {
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
          onSaved={() => router.refresh()}
        />
      )}
    </>
  );
}
