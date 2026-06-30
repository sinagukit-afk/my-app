import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-[--color-text]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "flex h-9 w-full rounded-md border border-[--color-border] bg-[--color-surface] px-3 py-1 text-sm text-[--color-text] shadow-[--shadow-sm] transition-colors",
            "placeholder:text-[--color-text-subtle]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-primary] focus-visible:ring-offset-1",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-[--color-danger] focus-visible:ring-[--color-danger]",
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-xs text-[--color-danger]">{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
