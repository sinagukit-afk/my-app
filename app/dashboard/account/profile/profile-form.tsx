"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateProfile } from "./actions";

type Props = {
  contactNumber: string | null;
  birthday: string | null;
};

export function ProfileForm({ contactNumber, birthday }: Props) {
  const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateProfile(formData);
      setResult(res.success ? { success: true } : { success: false, error: (res as { success: false; error: string }).error });
    });
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Personal Information</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Contact Number"
            name="contact_number"
            type="tel"
            defaultValue={contactNumber ?? ""}
            placeholder="+63 9XX XXX XXXX"
          />
          <Input
            label="Birthday"
            name="birthday"
            type="date"
            defaultValue={birthday ?? ""}
          />
          {result && (
            <p
              className={`text-sm ${
                result.success
                  ? "text-[--color-success]"
                  : "text-[--color-danger]"
              }`}
            >
              {result.success ? "Profile updated successfully." : result.error}
            </p>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save Changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
