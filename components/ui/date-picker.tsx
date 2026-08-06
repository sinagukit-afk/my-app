"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface DatePickerProps {
  label?: string;
  error?: string;
  id?: string;
  name?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  /** ISO "YYYY-MM-DD". Controlled mode — pair with onChange. */
  value?: string;
  /** ISO "YYYY-MM-DD". Uncontrolled mode — read back via `name` at form submit. */
  defaultValue?: string;
  /** Fires with an ISO "YYYY-MM-DD" (or "" while incomplete/invalid). */
  onChange?: (event: { target: { value: string; name?: string } }) => void;
  "aria-label"?: string;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function isValidDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12) return false;
  const daysInMonth = new Date(y, m, 0).getDate();
  return d >= 1 && d <= daysInMonth;
}

/** Parses an 8-digit MMDDYYYY buffer into an ISO date, or null while incomplete/invalid. */
function isoFromDigits(digits: string): string | null {
  if (digits.length !== 8) return null;
  const mm = Number(digits.slice(0, 2));
  const dd = Number(digits.slice(2, 4));
  const yyyy = Number(digits.slice(4, 8));
  if (!isValidDate(yyyy, mm, dd)) return null;
  return `${digits.slice(4, 8)}-${digits.slice(0, 2)}-${digits.slice(2, 4)}`;
}

/** Pure "YYYY-MM-DD" strings are parsed directly rather than via `Date` to avoid UTC-midnight shifts. */
function digitsFromIso(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const [, y, m, d] = match;
  return `${m}${d}${y}`;
}

function formatDigits(digits: string): string {
  const mm = digits.slice(0, 2);
  const dd = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  let out = mm;
  if (digits.length >= 2) out += "/";
  out += dd;
  if (dd.length === 2) out += "/";
  out += yyyy;
  return out;
}

type MonthCell = { y: number; m: number; d: number; inMonth: boolean };

function getMonthGrid(year: number, monthIndex: number): MonthCell[] {
  const startWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, monthIndex, 0).getDate();
  const cells: MonthCell[] = [];
  for (let i = 0; i < 42; i++) {
    const dayNum = i - startWeekday + 1;
    if (dayNum < 1) {
      const m = monthIndex === 0 ? 11 : monthIndex - 1;
      cells.push({ y: monthIndex === 0 ? year - 1 : year, m, d: daysInPrevMonth + dayNum, inMonth: false });
    } else if (dayNum > daysInMonth) {
      const m = monthIndex === 11 ? 0 : monthIndex + 1;
      cells.push({ y: monthIndex === 11 ? year + 1 : year, m, d: dayNum - daysInMonth, inMonth: false });
    } else {
      cells.push({ y: year, m: monthIndex, d: dayNum, inMonth: true });
    }
  }
  return cells;
}

/**
 * MM/DD/YYYY date field with a calendar popover. Native `<input type="date">` renders its
 * segment order (and calendar UI) using the OS/browser regional format — confirmed to ignore
 * both `navigator.language` and the page's `lang` attribute — so it cannot be forced to
 * MM/DD/YYYY for a visitor whose OS locale differs. This component owns its own formatting
 * instead, and always displays/accepts MM/DD/YYYY regardless of the visitor's OS.
 */
const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  (
    { className, label, error, id, name, required, disabled, autoFocus, value, defaultValue, onChange, "aria-label": ariaLabel },
    forwardedRef
  ) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    const rootRef = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement);

    const [digits, setDigits] = React.useState(() => digitsFromIso(value ?? defaultValue ?? ""));
    const iso = isoFromDigits(digits) ?? "";
    const lastEmitted = React.useRef(iso);
    const [open, setOpen] = React.useState(false);
    const [viewYear, setViewYear] = React.useState(() => {
      const parts = value ?? defaultValue ?? "";
      const match = parts.match(/^(\d{4})-(\d{2})-\d{2}$/);
      return match ? Number(match[1]) : new Date().getFullYear();
    });
    const [viewMonth, setViewMonth] = React.useState(() => {
      const parts = value ?? defaultValue ?? "";
      const match = parts.match(/^\d{4}-(\d{2})-\d{2}$/);
      return match ? Number(match[1]) - 1 : new Date().getMonth();
    });

    // Resync the digit buffer when a controlled `value` changes from outside this field
    // (e.g. a sibling field recomputing this one's default). Skip changes we emitted ourselves.
    React.useEffect(() => {
      if (value === undefined) return;
      if (value === lastEmitted.current) return;
      lastEmitted.current = value;
      setDigits(digitsFromIso(value));
    }, [value]);

    React.useEffect(() => {
      const el = inputRef.current;
      if (!el) return;
      el.setCustomValidity(digits.length === 8 && !iso ? "Enter a valid date." : "");
    }, [digits, iso]);

    React.useEffect(() => {
      if (!open) return;
      function onPointerDown(e: PointerEvent) {
        if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
      }
      document.addEventListener("pointerdown", onPointerDown);
      return () => document.removeEventListener("pointerdown", onPointerDown);
    }, [open]);

    function commit(nextDigits: string) {
      setDigits(nextDigits);
      const nextIso = isoFromDigits(nextDigits) ?? "";
      lastEmitted.current = nextIso;
      onChange?.({ target: { value: nextIso, name } });
    }

    function openPopover() {
      if (disabled) return;
      const parsed = iso.match(/^(\d{4})-(\d{2})-\d{2}$/);
      const today = new Date();
      setViewYear(parsed ? Number(parsed[1]) : today.getFullYear());
      setViewMonth(parsed ? Number(parsed[2]) - 1 : today.getMonth());
      setOpen((o) => !o);
    }

    function pickDay(cell: MonthCell) {
      const picked = `${cell.y}-${String(cell.m + 1).padStart(2, "0")}-${String(cell.d).padStart(2, "0")}`;
      commit(digitsFromIso(picked));
      setOpen(false);
    }

    function shiftMonth(delta: number) {
      let m = viewMonth + delta;
      let y = viewYear;
      if (m < 0) { m = 11; y -= 1; }
      if (m > 11) { m = 0; y += 1; }
      setViewMonth(m);
      setViewYear(y);
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.currentTarget;
      const hasSelection = el.selectionStart !== el.selectionEnd;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        commit(((hasSelection ? "" : digits) + e.key).slice(0, 8));
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        commit(hasSelection ? "" : digits.slice(0, -1));
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      const allowed = ["Tab", "Shift", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "Enter"];
      if (!allowed.includes(e.key)) e.preventDefault();
    }

    function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
      e.preventDefault();
      commit(e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 8));
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const nextDigits = e.target.value.replace(/\D/g, "").slice(0, 8);
      if (nextDigits !== digits) commit(nextDigits);
    }

    const cells = getMonthGrid(viewYear, viewMonth);
    const today = new Date();
    const selectedParts = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-(--color-text)">
            {label}
          </label>
        )}
        <div ref={rootRef} className="relative">
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="MM/DD/YYYY"
            pattern="\d{2}/\d{2}/\d{4}"
            maxLength={10}
            required={required}
            disabled={disabled}
            autoFocus={autoFocus}
            aria-label={ariaLabel}
            value={formatDigits(digits)}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            className={cn(
              "flex h-9 w-full rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-1 pr-9 text-sm text-(--color-text) shadow-(--shadow-sm) transition-colors",
              "placeholder:text-(--color-text-subtle)",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary) focus-visible:ring-offset-1",
              "disabled:cursor-not-allowed disabled:opacity-50",
              error && "border-(--color-danger) focus-visible:ring-(--color-danger)",
              className
            )}
          />
          <button
            type="button"
            disabled={disabled}
            aria-label="Open calendar"
            aria-expanded={open}
            onClick={openPopover}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-(--color-text-muted) hover:text-(--color-text) disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M2 6.5H14" stroke="currentColor" strokeWidth="1.3" />
              <path d="M5 1.5V4M11 1.5V4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </button>

          {open && (
            <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-md border border-(--color-border) bg-(--color-surface) p-2 shadow-(--shadow-md)">
              <div className="mb-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  aria-label="Previous month"
                  className="rounded px-2 py-1 text-sm text-(--color-text-muted) hover:bg-(--color-bg) hover:text-(--color-text)"
                >
                  ‹
                </button>
                <span className="text-sm font-medium text-(--color-text)">
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </span>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  aria-label="Next month"
                  className="rounded px-2 py-1 text-sm text-(--color-text-muted) hover:bg-(--color-bg) hover:text-(--color-text)"
                >
                  ›
                </button>
              </div>
              <div className="grid grid-cols-7 gap-0.5 text-center">
                {WEEKDAYS.map((wd) => (
                  <span key={wd} className="py-1 text-[11px] font-medium text-(--color-text-muted)">
                    {wd}
                  </span>
                ))}
                {cells.map((cell, i) => {
                  const isSelected =
                    !!selectedParts &&
                    Number(selectedParts[1]) === cell.y &&
                    Number(selectedParts[2]) === cell.m + 1 &&
                    Number(selectedParts[3]) === cell.d;
                  const isToday =
                    today.getFullYear() === cell.y && today.getMonth() === cell.m && today.getDate() === cell.d;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => pickDay(cell)}
                      className={cn(
                        "h-7 w-7 rounded text-xs text-(--color-text) hover:bg-(--color-bg)",
                        !cell.inMonth && "text-(--color-text-subtle)",
                        isToday && !isSelected && "font-semibold text-(--color-primary) ring-1 ring-inset ring-(--color-primary)",
                        isSelected && "bg-(--color-primary) text-white hover:bg-(--color-primary)"
                      )}
                    >
                      {cell.d}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        {name && <input type="hidden" name={name} value={iso} />}
        {error && <p className="text-xs text-(--color-danger)">{error}</p>}
      </div>
    );
  }
);
DatePicker.displayName = "DatePicker";

export { DatePicker };
