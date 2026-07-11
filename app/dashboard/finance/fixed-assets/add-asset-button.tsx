"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AssetFormDialog, type CategoryOption, type SupplierOption } from "./asset-form-dialog";

type Props = {
  categories: CategoryOption[];
  suppliers: SupplierOption[];
};

export function AddAssetButton({ categories, suppliers }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Add Asset</Button>
      <AssetFormDialog open={open} onOpenChange={setOpen} categories={categories} suppliers={suppliers} />
    </>
  );
}
