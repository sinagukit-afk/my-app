"use client";

import { useEffect, useState, useTransition } from "react";
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
import { TextArea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { NumberInput } from "@/components/ui/number-input";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { createTestimonial, updateTestimonial, type ActionResult } from "./actions";
import type { TestimonialRow } from "./testimonials-table";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  testimonial?: TestimonialRow | null;
  onSaved: () => void;
};

const RATING_OPTIONS = [
  { value: "5", label: "5 — ★★★★★" },
  { value: "4", label: "4 — ★★★★" },
  { value: "3", label: "3 — ★★★" },
  { value: "2", label: "2 — ★★" },
  { value: "1", label: "1 — ★" },
];

export function TestimonialForm({ open, onOpenChange, testimonial, onSaved }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(true);
  const isEdit = Boolean(testimonial);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setPublished(testimonial?.published ?? true);
  }, [open, testimonial]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res: ActionResult = isEdit
        ? await updateTestimonial(testimonial!.id, formData)
        : await createTestimonial(formData);

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
      <DialogContent className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit Testimonial" : "Add Testimonial"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update this customer quote as it appears on the website."
                : "Add a customer quote to show on the website."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              id="testimonial-author-name"
              label="Author Name"
              name="author_name"
              defaultValue={testimonial?.author_name ?? ""}
              required
              autoFocus
            />
            <Input
              id="testimonial-author-role"
              label="Author Role"
              name="author_role"
              defaultValue={testimonial?.author_role ?? ""}
              placeholder="e.g. Events Coordinator, ABC Corp"
            />
          </div>

          <TextArea
            id="testimonial-quote"
            label="Quote"
            name="quote"
            rows={4}
            defaultValue={testimonial?.quote ?? ""}
            required
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              id="testimonial-rating"
              label="Rating"
              name="rating"
              placeholder="No rating"
              options={RATING_OPTIONS}
              defaultValue={testimonial?.rating != null ? String(testimonial.rating) : ""}
            />
            <NumberInput
              id="testimonial-sort-order"
              label="Sort Order"
              name="sort_order"
              step={1}
              defaultValue={testimonial?.sort_order ?? 0}
            />
          </div>

          <Input
            id="testimonial-avatar-url"
            label="Avatar URL"
            name="avatar_url"
            type="url"
            defaultValue={testimonial?.avatar_url ?? ""}
            placeholder="https://…"
          />

          <Toggle
            id="testimonial-published"
            label="Published"
            description="Unpublished testimonials stay hidden from the website."
            checked={published}
            onChange={setPublished}
          />
          <input type="hidden" name="published" value={published ? "true" : "false"} />

          {error && <p className="text-sm text-(--color-danger)">{error}</p>}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Testimonial"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
