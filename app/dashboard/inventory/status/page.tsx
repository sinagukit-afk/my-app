import { redirect } from "next/navigation";

export default function InventoryStatusRedirectPage() {
  redirect("/dashboard/inventory/monitoring");
}
