# Sinag Ukit ERP — Theme Notes

How the brand infographic was translated into UI tokens, and what I had to
assume because the brand kit was built for marketing/print, not a dense
admin/POS interface.

**2026-07-22 — updated to the Sinag Ukit Design System V3 kit.** The V3 kit
supersedes the original infographic as the source of truth for brand color
and typography. Notable changes from the original mapping below:
- All five brand hexes shifted slightly (see table) and gained official
  hover/active steps, a 050–900 ramp per color, and official
  Success/Warning/Info/Danger values — the "things I had to invent" in §3
  are now officially specified, not guesses.
- The V3 kit's own semantic layer maps **Secondary = Ember Red** (grouped
  with Destructive) and **Accent = Antique Bronze** — the reverse of this
  app's original `secondary`=Bronze/`accent`=pale-gold-tint convention.
  Since neither the `--secondary` nor `--accent` shadcn token is actually
  consumed anywhere in the app (all real UI reads the `--color-*` hex layer
  in `app/globals.css`, not `bg-secondary`/`bg-accent`), this was a
  zero-visual-impact decision — the shadcn layer's `--secondary`/`--accent`
  now follow the V3 kit's own Red/Bronze labels for future-consumer
  correctness. The **live** `--color-*` layer never had a "secondary" or
  solid "accent" concept to begin with (its accent-ish role, `--color-bg`
  hover tint, is unaffected).
- Adds a three-typeface system (Cormorant Garamond / Manrope / Inter),
  loaded via `next/font/google` in `app/layout.tsx` — see §5.
- Adds `--chart-cat-*`, a colorblind-validated categorical chart palette
  (separate from the `--chart-1..5` tokens below, which remain unused
  legacy). Re-validated against the V3 gold via the dataviz skill's
  `validate_palette.js`: the light-mode gold slot uses the literal new
  brand gold (`#C9A24B`) unchanged; the dark-mode step could not reuse it
  (fails the lightness band and CVD separation from the green slot on a
  dark surface) and instead uses `#B07914` — same hue family, tuned to pass.

## 1. Direct mappings (no ambiguity)

| Brand color | Hex (V3) | Role in infographic | Role in ERP |
|---|---|---|---|
| Warm Ivory | `#FAF6EF` | Primary background (60%) | `background` — app shell, page background |
| Deep Charcoal | `#161616` | Primary foundation / text (25%) | `foreground` (light mode) text, and the dark `sidebar` surface |
| Heritage Gold | `#C9A24B` | Primary accent (10%) | `primary` — main buttons, active nav state, links |
| Ember Red | `#D62828` | CTA/highlight, used sparingly (5%) | `destructive` — delete/cancel actions, error states |
| Antique Bronze | `#8A6B39` | Secondary accent (5%) | Bronze itself isn't consumed by any live token today (see note above) |

The infographic's own usage ratio (60/25/10/5/5) maps surprisingly well onto
a typical admin UI: ivory as the dominant background, charcoal for text and
the nav rail, gold for primary actions, and red/bronze reserved for the
minority of elements that need to stand out (destructive actions, status
flags).

## 2. Accessibility check on the literal hex values

Ran contrast ratios because Heritage Gold is the `primary` button color and
needs readable text on top of it:

- **White text on Heritage Gold**: ~3.0:1 — fails WCAG AA for normal text
  (needs 4.5:1), only passes for large/bold text (3:1 threshold).
- **Deep Charcoal text on Heritage Gold**: ~5.45:1 — passes AA comfortably.

So `--primary-foreground` is set to Charcoal, not white. If you've already
got gold buttons with white text somewhere, that's a contrast bug — swap to
dark text or darken the gold for that specific use.

Ember Red on white (`--destructive-foreground`) is around 4.6:1 — passes AA
at normal text size, so white text on red buttons is fine as-is.

## 3. Things I had to invent (please confirm or override)

The brand kit is a 5-color marketing palette. It doesn't define everything a
business management system needs:

- **Success / Warning / Info colors** — there's no green, amber, or blue in
  the original kit (order/inventory statuses like "fulfilled," "low stock,"
  "pending" need something). I picked an in-family muted green for success,
  a slightly more saturated gold for warning, and a neutral steel blue for
  info, so they don't clash with the brand but they are *not* brand-defined
  colors — flag if you want these chosen more deliberately, e.g. with brand
  guidance, or to avoid the extra blue hue entirely.
- **Dark mode** — the brand kit shows no dark variant; "Warm Ivory" as a
  background is explicitly the spec. I extrapolated a dark mode by
  inverting charcoal/ivory roles and lightening gold slightly for contrast
  on dark backgrounds. If the ERP doesn't need dark mode, ignore the `.dark`
  block entirely.
- **Sidebar = Charcoal + Gold** — the infographic's "Premium & Bold"
  combination example (Charcoal / Gold / Ivory / Red bar) reads to me as
  the intended high-impact pairing, so I used it for the persistent nav
  rail rather than the page background. This is a judgment call, not
  specified anywhere — an all-ivory sidebar with charcoal text would also
  be on-brand and is a simpler alternative if you'd rather not have a dark
  nav rail.
- **Hover/selected row tint (`accent`)** — derived as a pale tint of gold
  (92% lightness) since the kit doesn't define a "muted accent" — used for
  table row hover, selected items, etc.

## 4. Files

- `globals-theme.css` / `tailwind.config.additions.ts` are **historical
  scaffolding, not live config** — their content was hand-merged into
  `app/globals.css` early on, and this project has no `tailwind.config.ts`
  at all (Tailwind v4, CSS-based config via `@theme inline`). They're kept
  in sync with the current palette for documentation purposes only; editing
  them has no effect on the running app. The actual token source of truth is
  `app/globals.css`, which — confusingly — carries **two** color layers:
  the shadcn HSL layer described above (dead; nothing in the app reads
  `bg-primary`/`text-foreground`/etc.), and a separate `--color-*` raw-hex
  layer consumed everywhere via `bg-(--color-x)` arbitrary values. Both are
  kept in sync when the palette changes, but only the second one paints
  pixels.

## 5. Typography (V3)

Three-typeface system, all loaded via `next/font/google` in `app/layout.tsx`
(no `<link>`/`@import` — the kit's own Google Fonts CDN loading was swapped
for the project's existing font-loading mechanism... except there wasn't
one: before this change the app used only the system font stack. This is
new infrastructure, not a swap of an existing pattern):

- **Cormorant Garamond** → `--font-serif-display` — marketing hero headlines
  only. Loaded and available, but nothing in the ERP references it — no
  screen in this dashboard should ever set `font-family:
  var(--font-serif-display)`.
- **Manrope** → `--font-sans-heading` (aliased `--font-display`) — section/
  page titles (`h1`–`h6`, global rule), nav links, and buttons.
- **Inter** → `--font-sans-body` (aliased `--font-body`, and the app's
  default `--font-sans`) — body copy, forms, tables, numbers; everything
  that isn't a heading/nav/button inherits this from `body { font-family:
  var(--font-sans) }`.
- **Oswald** — logo/wordmark only, unchanged, not loaded by the app (no live
  text logo exists to load it for).

`next/font`'s generated variables are set on `<html>` via `className`, not
redeclared in `globals.css` — a `:root` redeclaration of the same variable
name would win the CSS cascade over the `html`-scoped one (pseudo-class
beats element selector) and silently break font loading, so `--font-sans` /
`--font-display` / `--font-body` reference `var(--font-sans-heading|body)`
rather than redefining them.

## 6. Spacing / radius — deliberately untouched

The V3 kit's `tokens/spacing.css` reuses the exact same variable names this
app already has (`--space-*`, `--radius-*`) for a **different scale**
(kit's `--space-6` = 32px; this app's `--space-6` = 24px/1.5rem, matching
Tailwind's own numbering instead). Importing the kit's spacing.css wholesale
would have silently corrupted every existing `--space-*`/`--radius-*`
consumer in the app. Left the existing scale as-is; flagging here instead of
guessing which callers could tolerate the change.
