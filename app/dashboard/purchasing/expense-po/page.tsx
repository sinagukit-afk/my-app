import { redirect } from "next/navigation";

export default function ExpensePurchaseOrdersRedirect() {
  redirect("/dashboard/purchasing/purchase-orders");
}
