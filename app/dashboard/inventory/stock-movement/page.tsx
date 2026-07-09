import { redirect } from "next/navigation";

export default function StockMovementRedirectPage() {
  redirect("/dashboard/inventory/monitoring");
}
