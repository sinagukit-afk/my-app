import { redirect } from "next/navigation";

export default function InventoryPurchaseOrdersRedirect() {
  redirect("/dashboard/purchasing/purchase-orders");
}
