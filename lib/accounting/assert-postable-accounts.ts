import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Defense-in-depth for the account-mapping save actions: the UI already warns
 * and disables Save when a parent/header account is picked, but this re-checks
 * server-side (stale tab, second admin session, etc.) before any write.
 * Returns a friendly error string, or null if every id is postable.
 */
export async function findNonPostableAccounts(
  supabase: SupabaseServerClient,
  accountIds: Array<string | null | undefined>
): Promise<string | null> {
  const ids = Array.from(new Set(accountIds.filter((id): id is string => Boolean(id))));
  if (ids.length === 0) return null;

  const { data, error } = await supabase.from("accounts").select("account_number, name, is_postable").in("id", ids);

  if (error) return error.message;

  const parents = (data ?? []).filter((a) => !a.is_postable);
  if (parents.length === 0) return null;

  return `Cannot map to a parent/header account: ${parents
    .map((a) => `${a.account_number} — ${a.name}`)
    .join(", ")}. Choose a postable account instead.`;
}
