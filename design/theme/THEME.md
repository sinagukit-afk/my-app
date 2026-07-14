# Sinag Ukit ERP — Theme Notes

How the brand infographic was translated into UI tokens, and what I had to
assume because the brand kit was built for marketing/print, not a dense
admin/POS interface.

## 1. Direct mappings (no ambiguity)

| Brand color | Hex | Role in infographic | Role in ERP |
|---|---|---|---|
| Warm Ivory | `#F6EFE4` | Primary background (60%) | `background` — app shell, page background |
| Deep Charcoal | `#1F1F1F` | Primary foundation / text (25%) | `foreground` (light mode) text, and the dark `sidebar` surface |
| Heritage Gold | `#B68E44` | Primary accent (10%) | `primary` — main buttons, active nav state, links |
| Ember Red | `#D84A3A` | CTA/highlight, used sparingly (5%) | `destructive` — delete/cancel actions, error states |
| Antique Bronze | `#8A673E` | Secondary accent (5%) | `secondary` — secondary buttons, less-prominent emphasis |

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

- `globals-theme.css` — merge into your `app/globals.css`, inside the
  existing `@layer base { :root {...} .dark {...} }` block from shadcn init.
- `tailwind.config.additions.ts` — merge the `colors` additions (status
  colors + `brand.*` raw hex) into your existing `tailwind.config.ts`.

After merging, things like `bg-primary`, `text-destructive`,
`bg-success/10 text-success`, or `bg-brand-gold` (for marketing-style pages
that want the literal hex rather than the semantic token) should all work
through shadcn components without further changes.
