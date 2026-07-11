"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { inviteUser, updateUserProfile, type ActionResult } from "./actions";
import type { UserRow } from "./users-table";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "encoder", label: "Encoder" },
  { value: "cashier", label: "Cashier" },
  { value: "viewer", label: "Viewer" },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: UserRow | null;
  onSaved: () => void;
};

export function UserForm({ open, onOpenChange, user, onSaved }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(user);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res: ActionResult = isEdit
        ? await updateUserProfile(user!.id, formData)
        : await inviteUser(formData);

      if (res.success) {
        onSaved();
        onOpenChange(false);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit User" : "Invite User"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update this user's name and role."
                : "Send an email invitation to grant system access."}
            </DialogDescription>
          </DialogHeader>

          {isEdit ? (
            <Input label="Email" name="email" value={user!.email} disabled readOnly />
          ) : (
            <Input label="Email" name="email" type="email" required autoFocus />
          )}
          <Input
            label="Full Name"
            name="full_name"
            defaultValue={user?.name ?? ""}
            autoFocus={isEdit}
          />
          <Select
            label="Role"
            name="role"
            defaultValue={user?.role ?? "encoder"}
            options={ROLE_OPTIONS}
          />

          {error && <p className="text-sm text-(--color-danger)">{error}</p>}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : isEdit ? "Save Changes" : "Send Invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
