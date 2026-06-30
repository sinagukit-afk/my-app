"use client";

import { useRef, useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updatePassword } from "./actions";

export function PasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updatePassword(formData);
      if (res.success) {
        formRef.current?.reset();
        setResult({ success: true });
      } else {
        setResult({ success: false, error: (res as { success: false; error: string }).error });
      }
    });
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Change Password</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Current Password"
            name="current_password"
            type="password"
            required
            autoComplete="current-password"
          />
          <Input
            label="New Password"
            name="new_password"
            type="password"
            required
            autoComplete="new-password"
          />
          <Input
            label="Confirm New Password"
            name="confirm_password"
            type="password"
            required
            autoComplete="new-password"
          />
          {result && (
            <p
              className={`text-sm ${
                result.success
                  ? "text-[--color-success]"
                  : "text-[--color-danger]"
              }`}
            >
              {result.success ? "Password changed successfully." : result.error}
            </p>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Updating…" : "Update Password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
