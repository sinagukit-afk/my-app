"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { roundMoney } from "@/lib/utils/format";

type Op = "+" | "-" | "×" | "÷";

function applyOp(a: number, b: number, op: Op): number {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "×":
      return a * b;
    case "÷":
      return b === 0 ? NaN : a / b;
  }
}

const BUTTON_ROWS: Array<Array<{ label: string; kind: "digit" | "op" | "clear" | "backspace" | "equals" | "decimal" }>> = [
  [
    { label: "C", kind: "clear" },
    { label: "⌫", kind: "backspace" },
    { label: "÷", kind: "op" },
  ],
  [
    { label: "7", kind: "digit" },
    { label: "8", kind: "digit" },
    { label: "9", kind: "digit" },
    { label: "×", kind: "op" },
  ],
  [
    { label: "4", kind: "digit" },
    { label: "5", kind: "digit" },
    { label: "6", kind: "digit" },
    { label: "-", kind: "op" },
  ],
  [
    { label: "1", kind: "digit" },
    { label: "2", kind: "digit" },
    { label: "3", kind: "digit" },
    { label: "+", kind: "op" },
  ],
];

export interface CalculatorButtonProps {
  /** Called with the rounded (2-decimal) result when the user applies it to the field. */
  onApply: (value: number) => void;
  /** Seeds the calculator display when it opens, e.g. the field's current value. */
  initialValue?: string;
  className?: string;
}

/** A small popover calculator for filling in a numeric field — for totals that are easier to key in as an expression (qty × unit price, etc.) than to compute by hand first. */
export function CalculatorButton({ onApply, initialValue, className }: CalculatorButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [display, setDisplay] = React.useState("0");
  const [accumulator, setAccumulator] = React.useState<number | null>(null);
  const [pendingOp, setPendingOp] = React.useState<Op | null>(null);
  const [freshEntry, setFreshEntry] = React.useState(true);
  const rootRef = React.useRef<HTMLDivElement>(null);

  function reset() {
    setDisplay("0");
    setAccumulator(null);
    setPendingOp(null);
    setFreshEntry(true);
  }

  function openPanel() {
    setDisplay(initialValue && initialValue !== "" && Number.isFinite(Number(initialValue)) ? initialValue : "0");
    setAccumulator(null);
    setPendingOp(null);
    setFreshEntry(true);
    setOpen(true);
  }

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function inputDigit(d: string) {
    setDisplay((prev) => {
      if (freshEntry) return d;
      if (prev === "0") return d;
      return prev + d;
    });
    setFreshEntry(false);
  }

  function inputDecimal() {
    setDisplay((prev) => {
      if (freshEntry) return "0.";
      if (prev.includes(".")) return prev;
      return prev + ".";
    });
    setFreshEntry(false);
  }

  function inputOperator(op: Op) {
    const current = Number(display);
    setAccumulator((prevAcc) => {
      if (prevAcc == null) return current;
      if (pendingOp && !freshEntry) return applyOp(prevAcc, current, pendingOp);
      return prevAcc;
    });
    setPendingOp(op);
    setFreshEntry(true);
  }

  function equals() {
    if (accumulator == null || pendingOp == null) return;
    const current = Number(display);
    const result = applyOp(accumulator, current, pendingOp);
    setDisplay(Number.isFinite(result) ? String(roundMoney(result)) : "Error");
    setAccumulator(null);
    setPendingOp(null);
    setFreshEntry(true);
  }

  function backspace() {
    setDisplay((prev) => {
      if (freshEntry || prev === "Error") return "0";
      const next = prev.slice(0, -1);
      return next === "" || next === "-" ? "0" : next;
    });
  }

  function clear() {
    reset();
  }

  function press(kind: (typeof BUTTON_ROWS)[number][number]["kind"], label: string) {
    if (kind === "digit") inputDigit(label);
    else if (kind === "decimal") inputDecimal();
    else if (kind === "op") inputOperator(label as Op);
    else if (kind === "equals") equals();
    else if (kind === "clear") clear();
    else if (kind === "backspace") backspace();
  }

  function applyAndClose() {
    const value = Number(display);
    if (Number.isFinite(value)) {
      onApply(roundMoney(value));
      setOpen(false);
      reset();
    }
  }

  function onPanelKeyDown(e: React.KeyboardEvent) {
    if (e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      inputDigit(e.key);
    } else if (e.key === ".") {
      e.preventDefault();
      inputDecimal();
    } else if (e.key === "+" || e.key === "-") {
      e.preventDefault();
      inputOperator(e.key);
    } else if (e.key === "*") {
      e.preventDefault();
      inputOperator("×");
    } else if (e.key === "/") {
      e.preventDefault();
      inputOperator("÷");
    } else if (e.key === "Backspace") {
      e.preventDefault();
      backspace();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (pendingOp != null) equals();
      else applyAndClose();
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-label="Open calculator"
        onClick={() => (open ? setOpen(false) : openPanel())}
        className="flex h-6 w-6 items-center justify-center rounded text-(--color-text-muted) hover:bg-(--color-bg) hover:text-(--color-text)"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="2.5" y="1.5" width="11" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
          <rect x="4.5" y="3.5" width="7" height="2.5" rx="0.5" fill="currentColor" />
          {[4.5, 7, 9.5].map((x) => (
            <circle key={`r1-${x}`} cx={x} cy={9} r="0.75" fill="currentColor" />
          ))}
          {[4.5, 7, 9.5].map((x) => (
            <circle key={`r2-${x}`} cx={x} cy={11.5} r="0.75" fill="currentColor" />
          ))}
        </svg>
      </button>

      {open && (
        <div
          onKeyDown={onPanelKeyDown}
          className="absolute right-0 top-full z-50 mt-1 w-52 rounded-md border border-(--color-border) bg-(--color-surface) p-2 shadow-(--shadow-md)"
        >
          <div className="mb-2 rounded border border-(--color-border) bg-(--color-bg) px-2 py-2 text-right font-mono text-base text-(--color-text)">
            {display}
            {pendingOp && <span className="ml-1 text-(--color-text-muted)">{pendingOp}</span>}
          </div>
          <div className="grid grid-cols-4 gap-1">
            {BUTTON_ROWS.map((row, i) =>
              row.map((btn) => (
                <button
                  key={`${i}-${btn.label}`}
                  type="button"
                  onClick={() => press(btn.kind, btn.label)}
                  className={cn(
                    "flex h-8 items-center justify-center rounded text-sm transition-colors",
                    btn.kind === "op"
                      ? "bg-(--color-bg) text-(--color-primary) hover:bg-(--color-border)"
                      : btn.kind === "clear" || btn.kind === "backspace"
                        ? "bg-(--color-bg) text-(--color-danger) hover:bg-(--color-border)"
                        : "bg-(--color-bg) text-(--color-text) hover:bg-(--color-border)"
                  )}
                >
                  {btn.label}
                </button>
              ))
            )}
            <button
              type="button"
              onClick={() => inputDigit("0")}
              className="col-span-2 flex h-8 items-center justify-center rounded bg-(--color-bg) text-sm text-(--color-text) hover:bg-(--color-border)"
            >
              0
            </button>
            <button
              type="button"
              onClick={inputDecimal}
              className="flex h-8 items-center justify-center rounded bg-(--color-bg) text-sm text-(--color-text) hover:bg-(--color-border)"
            >
              .
            </button>
            <button
              type="button"
              onClick={equals}
              className="flex h-8 items-center justify-center rounded bg-(--color-bg) text-sm font-medium text-(--color-primary) hover:bg-(--color-border)"
            >
              =
            </button>
          </div>
          <button
            type="button"
            onClick={applyAndClose}
            className="mt-2 flex h-8 w-full items-center justify-center rounded-md bg-(--color-primary) text-sm font-medium text-(--color-primary-fg) hover:bg-(--color-primary-hover)"
          >
            Use {display}
          </button>
        </div>
      )}
    </div>
  );
}
