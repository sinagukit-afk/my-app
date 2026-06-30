import { logout } from "@/app/logout/actions";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return (
    <div>
      <nav className="flex flex-col gap-3 border-b border-stone-200 px-6 py-3 text-sm text-stone-600 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Signed in as {user.email}
          {profile?.role ? ` / ${profile.role}` : ""}
        </span>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="hover:text-stone-950">
            Sales
          </Link>
          <Link href="/dashboard/inventory" className="hover:text-stone-950">
            Inventory
          </Link>
          <Link href="/dashboard/incoming" className="hover:text-stone-950">
            Incoming
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="text-stone-500 hover:text-stone-900 hover:underline"
            >
              Sign out
            </button>
          </form>
        </div>
      </nav>
      {children}
    </div>
  );
}
