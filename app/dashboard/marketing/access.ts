import { createClient } from "@/lib/supabase/server";

/**
 * Marketing screens manage the public website's content and its inbound leads.
 * Gated to admin/manager to mirror the write-side RLS on every `web_*` table
 * (see the RLS policies added in `marketing_tables_soft_delete_and_rls_hardening`).
 */
export const MARKETING_ROLES = ["admin", "manager"];

/** The signed-in user's `profiles.role`, or "" when signed out. */
export async function getMarketingRole(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "";

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return profile?.role ?? "";
}

export async function canManageMarketing(): Promise<boolean> {
  return MARKETING_ROLES.includes(await getMarketingRole());
}

/**
 * Server actions check this explicitly rather than leaning on RLS alone: an UPDATE
 * blocked by RLS affects zero rows without raising an error, so a denied write would
 * otherwise report success to the UI.
 */
export const MARKETING_DENIED = "Only admins and managers can manage website content.";
