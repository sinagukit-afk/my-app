"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateProfile } from "./actions";

type Props = {
  fullName: string | null;
  contactNumber: string | null;
  birthday: string | null;
};

export function ProfileForm({ fullName, contactNumber, birthday }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [current, setCurrent] = useState({ fullName, contactNumber, birthday });
  const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateProfile(formData);
      if (res.success) {
        setCurrent({
          fullName: (formData.get("full_name") as string).trim() || null,
          contactNumber: (formData.get("contact_number") as string).trim() || null,
          birthday: (formData.get("birthday") as string) || null,
        });
        setIsEditing(false);
        setResult({ success: true });
        router.refresh();
      } else {
        setResult({ success: false, error: (res as { success: false; error: string }).error });
      }
    });
  }

  function handleCancel() {
    setIsEditing(false);
    setResult(null);
  }

  const formattedBirthday = current.birthday
    ? new Date(current.birthday).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      })
    : null;

  return (
    <Card className="max-w-lg">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Personal Information</CardTitle>
        {!isEditing && (
          <Button variant="secondary" size="sm" onClick={() => { setResult(null); setIsEditing(true); }}>
            Update Profile
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full Name"
              name="full_name"
              type="text"
              defaultValue={current.fullName ?? ""}
              placeholder="Juan Dela Cruz"
              autoFocus
              required
            />
            <Input
              label="Contact Number"
              name="contact_number"
              type="tel"
              defaultValue={current.contactNumber ?? ""}
              placeholder="+63 9XX XXX XXXX"
            />
            <Input
              label="Birthday"
              name="birthday"
              type="date"
              defaultValue={current.birthday ?? ""}
            />
            {result && !result.success && (
              <p className="text-sm text-(--color-danger)">{result.error}</p>
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Save Changes"}
              </Button>
              <Button type="button" variant="secondary" onClick={handleCancel} disabled={isPending}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="font-medium text-(--color-text)">Contact Number</dt>
              <dd className="mt-0.5 text-(--color-text-muted)">
                {current.contactNumber ?? <span className="italic">Not set</span>}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-(--color-text)">Birthday</dt>
              <dd className="mt-0.5 text-(--color-text-muted)">
                {formattedBirthday ?? <span className="italic">Not set</span>}
              </dd>
            </div>
            {result?.success && (
              <p className="text-sm text-(--color-success)">Profile updated successfully.</p>
            )}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
