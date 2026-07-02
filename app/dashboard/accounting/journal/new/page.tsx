import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewJournalForm, type AccountOption } from "./new-journal-form";

export default async function NewJournalEntryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const hasAccess = ["admin", "manager"].includes(role);

  if (!hasAccess) redirect("/dashboard/accounting/journal");

  const { data: accountData } = await supabase
    .from("accounts")
    .select("account_number, name, category")
    .eq("is_active", true)
    .order("account_number");

  const accounts: AccountOption[] = accountData ?? [];

  return <NewJournalForm accounts={accounts} />;
}
