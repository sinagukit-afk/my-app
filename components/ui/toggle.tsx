"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface ToggleProps {
  label?: string;
  description?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
}

const Toggle: React.FC<ToggleProps> = ({
  label,
  description,
  checked,
  defaultChecked,
  onChange,
  disabled = false,
  id,
  className,
}) => {
  const [internalChecked, setInternalChecked] = React.useState(defaultChecked ?? false);
  const isControlled = checked !== undefined;
  const isOn = isControlled ? checked : internalChecked;
  const toggleId = id ?? label?.toLowerCase().replace(/\s+/g, "-") ?? React.useId();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isControlled) setInternalChecked(e.target.checked);
    onChange?.(e.target.checked);
  };

  return (
    <div className={cn("flex items-start gap-3", className)}>
      <div className="relative inline-flex shrink-0 items-center">
        <input
          type="checkbox"
          role="switch"
          id={toggleId}
          checked={isOn}
          onChange={handleChange}
          disabled={disabled}
          className="sr-only peer"
          aria-checked={isOn}
        />
        <label
          htmlFor={toggleId}
          className={cn(
            "flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors duration-200",
            "bg-(--color-border-strong) peer-checked:bg-(--color-primary)",
            "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
            "after:block after:h-5 after:w-5 after:translate-x-0.5 after:rounded-full after:bg-white after:shadow-(--shadow-sm) after:transition-transform after:duration-200",
            "peer-checked:after:translate-x-5"
          )}
        />
      </div>
      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <label htmlFor={toggleId} className="text-sm font-medium text-(--color-text) cursor-pointer">
              {label}
            </label>
          )}
          {description && (
            <span className="text-xs text-(--color-text-muted)">{description}</span>
          )}
        </div>
      )}
    </div>
  );
};

export { Toggle };
