import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

export default async function NewItemPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const role = profile?.role ?? "";
  const canWrite = ["admin", "manager"].includes(role);

  if (!canWrite) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-(--color-danger)">
          You don&apos;t have permission to add items. Only admins and managers
          can create or edit items.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Item"
        description="Create a new catalog item and push it to Loyverse."
      />
      <Card>
        <CardContent className="flex flex-col items-start gap-3 p-6">
          <p className="text-sm text-(--color-text-muted)">
            The Add/Edit item form ships with ITEM-5. This page is a placeholder
            so navigation and role gating are already in place.
          </p>
          <Button asChild variant="secondary">
            <Link href="/dashboard/inventory/items">Back to Item List</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
