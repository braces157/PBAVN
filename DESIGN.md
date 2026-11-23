# PBA Hub — Design System (`DESIGN.md`)

## 1. Component Stack & Craft Foundation

Built on real, production-grade React UI libraries instead of hand-rolled primitives:

- **shadcn/ui** (`@radix-ui/react-tabs`, `@radix-ui/react-popover`, `@radix-ui/react-dialog`, `@radix-ui/react-separator`, `@radix-ui/react-slot`, `class-variance-authority`, `clsx`, `tailwind-merge`)
- **NumberFlow** (`@number-flow/react`) for smooth Apple-grade rolling live score transitions
- **Motion** (`motion/react`) for hardware-accelerated spring tab indicators (`layoutId`) and smooth view transitions
- **cmdk** (`cmdk`) for an instant `⌘K` / `/` Command Palette player & route search
- **Lucide React** (`lucide-react`) for crisp, uniform 1.75px stroke iconography

## 2. Typography (`Geist` + `Geist Mono`)

- **UI, Headings & Display:** `Geist` (`--font-sans`, via `next/font/google`) — zero narrow/condensed webfont squishing on Windows ClearType. Clean weight & tracking hierarchy (`-0.025em` display headings, `14px` body).
- **Telemetry, Clocks & Data:** `Geist Mono` (`--font-mono`) with `tabular-nums` for scores, averages, innings, ranks, dates, and keyboard shortcuts.

## 3. Color Tokens (Neutral Zinc Light + Pure Obsidian Dark)

| Role | Light | Dark | Token |
| :--- | :--- | :--- | :--- |
| Canvas | `#FAFAFA` | `#09090B` | `--background` / `--bg` |
| Card / Surface | `#FFFFFF` | `#111114` | `--card` / `--surface` |
| Secondary / Muted | `#F4F4F5` | `#18181B` | `--secondary` / `--surface-2` |
| Border | `#E4E4E7` | `#27272A` | `--border` / `--line` |
| Primary Ink | `#09090B` | `#FAFAFA` | `--foreground` / `--ink` |
| Secondary Ink | `#52525B` | `#A1A1AA` | `--ink-2` |
| Muted Ink | `#71717A` | `#71717A` | `--muted-foreground` / `--ink-3` |
| Arena Stage | `#09090B` | `#111114` | `--arena` |
| PBA Blue | `#2563EB` | `#60A5FA` | `--pba` |
| LPBA Magenta | `#DB2777` | `#F472B6` | `--lpba` |
| Live Crimson | `#DC2626` | `#EF4444` | `--live` |
| Carom Gold | `#B45309` / `#F59E0B` | `#FBBF24` | `--gold` / `--gold-bright` |

## 4. Six Edge States Contract

1. **Empty:** Contextual empty state with direct reset or navigation action.
2. **Loading:** Geometry-matched skeletons in `--secondary` surface tones.
3. **Overflow & Density:** Proper `min-w-0` flex truncation, zero horizontal page overflow.
4. **Error & Image Fallback:** Layered `SafeImage` initials underneath `revealOnLoad` portraits so 404 or slow photos never leave blank boxes.
5. **Keyboard & Focus:** Global `⌘K` / `/` Command Palette dialog, Radix keyboard navigation in Tabs & Popovers, `Escape` dismissal, visible focus rings.
6. **Contrast & Reduced Motion:** `>= 4.5:1` body contrast across Light/Dark/Arena surfaces; `@media (prefers-reduced-motion: reduce)` honored by CSS and Motion/NumberFlow.
