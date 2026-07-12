"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

type Props = {
  canWrite: boolean;
};

export function ReceivingHeader({ canWrite }: Props) {
  return (
    <PageHeader
      title="Receiving"
      description="Process incoming deliveries and reconcile them against open purchase orders."
      actions={
        canWrite ? (
          <Button asChild>
            <Link href="/dashboard/purchasing/receiving/new">Log Manual Incoming</Link>
          </Button>
        ) : undefined
      }
    />
  );
}
