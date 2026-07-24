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
import { NumberInput } from "@/components/ui/number-input";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { createFaq, updateFaq, type ActionResult } from "./actions";
import type { FaqRow } from "./faqs-table";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  faq?: FaqRow | null;
  categories: string[];
  onSaved: () => void;
};

export function FaqForm({ open, onOpenChange, faq, categories, onSaved }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(true);
  const isEdit = Boolean(faq);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setPublished(faq?.published ?? true);
  }, [open, faq]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res: ActionResult = isEdit
        ? await updateFaq(faq!.id, formData)
        : await createFaq(formData);

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
            <DialogTitle>{isEdit ? "Edit FAQ" : "Add FAQ"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update this question as it appears on the website FAQ page."
                : "Add a question and answer to the website FAQ page."}
            </DialogDescription>
          </DialogHeader>

          <Input
            id="faq-question"
            label="Question"
            name="question"
            defaultValue={faq?.question ?? ""}
            required
            autoFocus
          />

          <TextArea
            id="faq-answer"
            label="Answer"
            name="answer"
            rows={5}
            defaultValue={faq?.answer ?? ""}
            required
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Input
                id="faq-category"
                label="Category"
                name="category"
                list="web-faq-categories"
                defaultValue={faq?.category ?? ""}
                placeholder="e.g. Ordering"
              />
              <datalist id="web-faq-categories">
                {categories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </div>
            <NumberInput
              id="faq-sort-order"
              label="Sort Order"
              name="sort_order"
              step={1}
              defaultValue={faq?.sort_order ?? 0}
            />
          </div>

          <Toggle
            id="faq-published"
            label="Published"
            description="Unpublished questions stay hidden from the website FAQ page."
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
              {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add FAQ"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
