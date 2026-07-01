"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ className, label, error, id, rows = 4, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-(--color-text)">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          rows={rows}
          className={cn(
            "w-full rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm text-(--color-text) shadow-(--shadow-sm) transition-colors resize-y",
            "placeholder:text-(--color-text-subtle)",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary) focus-visible:ring-offset-1",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-(--color-danger) focus-visible:ring-(--color-danger)",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-(--color-danger)">{error}</p>}
      </div>
    );
  }
);
TextArea.displayName = "TextArea";

export { TextArea };
