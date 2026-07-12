"use client";

import { useCallback, useState } from "react";

/**
 * Tracks which field keys were just populated by AI/OCR so the form can ring-highlight
 * them. A key drops out the moment the consuming form calls `clear(key)` from that
 * field's own onChange — i.e. as soon as the user edits it, matching "every AI-filled
 * value must remain editable" and the highlight should not persist past a user edit.
 */
export function useAiFilledKeys() {
  const [keys, setKeys] = useState<Set<string>>(new Set());

  const markFilled = useCallback((newKeys: string[]) => setKeys(new Set(newKeys)), []);

  const clear = useCallback((key: string) => {
    setKeys((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setKeys(new Set()), []);

  return { aiFilledKeys: keys, markFilled, clear, clearAll };
}
