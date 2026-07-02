import { redirect } from "next/navigation";

// The Accounting section's landing route just forwards to the Journal — the
// journal list is the module's home screen. Report pages (ACCT-4) will live
// alongside it under /dashboard/accounting/*.
export default function AccountingPage() {
  redirect("/dashboard/accounting/journal");
}
