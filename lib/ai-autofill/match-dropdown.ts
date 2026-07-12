import type { DropdownOption } from "./types";

const MATCH_THRESHOLD = 0.6;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dist = Array.from({ length: rows }, (_, i) => [i, ...Array(cols - 1).fill(0)]);
  for (let j = 1; j < cols; j++) dist[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dist[i][j] = Math.min(dist[i - 1][j] + 1, dist[i][j - 1] + 1, dist[i - 1][j - 1] + cost);
    }
  }
  return dist[rows - 1][cols - 1];
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;
  const distance = levenshtein(a, b);
  return 1 - distance / Math.max(a.length, b.length);
}

/**
 * Best similarity between `needle` and an option's label, plus each
 * individually normalized keyword/alias if the option has any — a supplier
 * document naming an item "Beech Wood Craft" should still match an option
 * labeled "Pinewood/Beechwood Blank Craft" if that alias is listed.
 */
function bestOptionScore(needle: string, option: DropdownOption): number {
  let score = similarity(needle, normalize(option.label));
  if (option.keywords) {
    for (const alias of option.keywords.split(/[,;\n]/)) {
      const normalizedAlias = normalize(alias);
      if (!normalizedAlias) continue;
      score = Math.max(score, similarity(needle, normalizedAlias));
    }
  }
  return score;
}

/**
 * Matches free text against a fixed set of dropdown options. Returns the
 * option's value, or null if nothing clears the confidence threshold — the
 * AI/OCR module must never invent a value that isn't one of `options`.
 */
export function matchDropdownOption(rawText: string | null | undefined, options: DropdownOption[]): string | null {
  if (!rawText || options.length === 0) return null;
  const needle = normalize(rawText);
  if (!needle) return null;

  let best: { value: string; score: number } | null = null;
  for (const option of options) {
    const score = bestOptionScore(needle, option);
    if (!best || score > best.score) {
      best = { value: option.value, score };
    }
  }

  return best && best.score >= MATCH_THRESHOLD ? best.value : null;
}
