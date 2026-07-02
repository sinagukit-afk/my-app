"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface CheckboxProps {
  label?: string;
  description?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  error?: string;
  className?: string;
}

const Checkbox: React.FC<CheckboxProps> = ({
  label,
  description,
  checked,
  defaultChecked,
  onChange,
  disabled = false,
  id,
  error,
  className,
}) => {
  const [internalChecked, setInternalChecked] = React.useState(defaultChecked ?? false);
  const generatedId = React.useId();
  const isControlled = checked !== undefined;
  const isOn = isControlled ? checked : internalChecked;
  const checkboxId = id ?? label?.toLowerCase().replace(/\s+/g, "-") ?? generatedId;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isControlled) setInternalChecked(e.target.checked);
    onChange?.(e.target.checked);
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          id={checkboxId}
          checked={isOn}
          onChange={handleChange}
          disabled={disabled}
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0 rounded border border-(--color-border-strong) bg-(--color-surface) accent-(--color-primary) transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary) focus-visible:ring-offset-1",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-(--color-danger)"
          )}
        />
        {(label || description) && (
          <div className="flex flex-col">
            {label && (
              <label htmlFor={checkboxId} className="text-sm font-medium text-(--color-text) cursor-pointer leading-none">
                {label}
              </label>
            )}
            {description && (
              <span className="text-xs text-(--color-text-muted) mt-0.5">{description}</span>
            )}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-(--color-danger) ml-6">{error}</p>}
    </div>
  );
};

export { Checkbox };
