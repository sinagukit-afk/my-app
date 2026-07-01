"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface UserMenuProps {
  name: string;
  email?: string;
  avatarUrl?: string;
  /** Rendered inside the dropdown when open */
  menuItems?: Array<{ label: string; onClick: () => void; danger?: boolean }>;
  className?: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function UserMenu({ name, email, avatarUrl, menuItems, className }: UserMenuProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-(--color-bg) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary) transition-colors"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-(--color-primary) text-xs font-semibold text-white">
            {getInitials(name)}
          </span>
        )}
        <span className="hidden sm:block">
          <span className="block text-xs font-medium text-(--color-text) leading-tight">{name}</span>
          {email && <span className="block text-[10px] text-(--color-text-muted) leading-tight">{email}</span>}
        </span>
        <svg className="text-(--color-text-muted)" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && menuItems && menuItems.length > 0 && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1.5 w-44 rounded-md border border-(--color-border) bg-(--color-surface) py-1 shadow-(--shadow-md)"
        >
          {menuItems.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              type="button"
              onClick={() => { item.onClick(); setOpen(false); }}
              className={cn(
                "block w-full px-3 py-2 text-left text-sm transition-colors",
                item.danger
                  ? "text-(--color-danger) hover:bg-(--color-danger-light)"
                  : "text-(--color-text) hover:bg-(--color-bg)"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
