"use client";

import { useRef, useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updatePassword } from "./actions";

export function PasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [isOpen, setIsOpen] = useState(false);
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
        setIsOpen(false);
        setResult({ success: true });
      } else {
        setResult({ success: false, error: (res as { success: false; error: string }).error });
      }
    });
  }

  function handleCancel() {
    formRef.current?.reset();
    setIsOpen(false);
    setResult(null);
  }

  return (
    <Card className="max-w-lg">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Password</CardTitle>
        {!isOpen && (
          <Button variant="secondary" size="sm" onClick={() => { setResult(null); setIsOpen(true); }}>
            Change Password
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isOpen ? (
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Current Password"
              name="current_password"
              type="password"
              required
              autoComplete="current-password"
              autoFocus
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
            {result && !result.success && (
              <p className="text-sm text-[--color-danger]">{result.error}</p>
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Updating…" : "Update Password"}
              </Button>
              <Button type="button" variant="secondary" onClick={handleCancel} disabled={isPending}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="text-sm text-[--color-text-muted]">
            {result?.success
              ? <p className="text-[--color-success]">Password changed successfully.</p>
              : <p>Your password is managed by Sinag Ukit. Click Change Password to update it.</p>
            }
          </div>
        )}
      </CardContent>
    </Card>
  );
}
