"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requestPasswordReset } from "./actions";

export function PasswordForm() {
  const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setResult(null);
    startTransition(async () => {
      const res = await requestPasswordReset();
      setResult(res.success ? { success: true } : { success: false, error: res.error });
    });
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Password</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-(--color-text-muted)">
          To change your password, we&apos;ll email you a secure link to set a new one.
        </p>
        <Button variant="secondary" size="sm" onClick={handleClick} disabled={isPending}>
          {isPending ? "Sending…" : "Send Password Reset Email"}
        </Button>
        {result?.success && (
          <p className="text-sm text-(--color-success)">
            Reset link sent — check your email.
          </p>
        )}
        {result && !result.success && (
          <p className="text-sm text-(--color-danger)">{result.error}</p>
        )}
      </CardContent>
    </Card>
  );
}
