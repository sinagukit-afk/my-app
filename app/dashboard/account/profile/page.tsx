import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProfileForm } from "./profile-form";
import { PasswordForm } from "./password-form";

const ROLE_BADGE: Record<string, "default" | "success" | "warning" | "danger" | "neutral"> = {
  admin: "danger",
  manager: "warning",
  encoder: "success",
  cashier: "default",
  viewer: "neutral",
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role, contact_number, birthday, created_at")
    .eq("id", user.id)
    .single();

  const displayName = profile?.full_name ?? profile?.email ?? user.email ?? "?";
  const initial = displayName[0].toUpperCase();

  const formattedBirthday = profile?.birthday
    ? new Date(profile.birthday).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      })
    : null;

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        description="View and update your personal account details."
      />

      {/* Identity card */}
      <Card className="max-w-lg">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-(--color-primary) text-xl font-bold text-(--color-primary-foreground)">
              {initial}
            </div>
            <div className="min-w-0 space-y-1">
              <p className="truncate text-base font-semibold text-(--color-text)">
                {profile?.full_name ?? "—"}
              </p>
              <p className="truncate text-sm text-(--color-text-muted)">
                {profile?.email ?? user.email}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={ROLE_BADGE[profile?.role ?? ""] ?? "neutral"}>
                  {profile?.role ?? "unknown"}
                </Badge>
                {profile?.contact_number && (
                  <span className="text-xs text-(--color-text-muted)">
                    {profile.contact_number}
                  </span>
                )}
                {formattedBirthday && (
                  <span className="text-xs text-(--color-text-muted)">
                    {formattedBirthday}
                  </span>
                )}
              </div>
              {memberSince && (
                <p className="text-xs text-(--color-text-muted)">
                  Member since {memberSince}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <ProfileForm
        fullName={profile?.full_name ?? null}
        contactNumber={profile?.contact_number ?? null}
        birthday={profile?.birthday ?? null}
      />

      <PasswordForm />
    </div>
  );
}
