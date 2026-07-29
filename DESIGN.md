# Design Brief

## Direction

Terminal Ledger — a dark, dense trading journal that treats every trade decision as forensic data for bias detection.

## Tone

Dark editorial restraint (Linear × Bloomberg Terminal): high information density, monospace numbers, one sharp amber accent — disciplined, not decorative.

## Differentiation

A single amber-gold accent on near-black ink with tabular monospace numerics — every P&L, confidence score, and bias flag reads like a terminal tick, not a marketing card.

## Color Palette

| Token      | OKLCH (dark)     | Role                                   |
| ---------- | ---------------- | -------------------------------------- |
| background | 0.145 0.012 260  | near-black ink, primary surface        |
| foreground | 0.95 0.008 260   | high-contrast text                     |
| card       | 0.18 0.014 260   | elevated trade cards, panels           |
| primary    | 0.78 0.16 75     | amber-gold — CTAs, active states, ticks|
| accent     | 0.78 0.16 75     | highlights, bias flags                 |
| secondary  | 0.22 0.018 260   | secondary buttons, chips               |
| muted      | 0.22 0.018 260   | input backgrounds, table stripes       |
| muted-fg   | 0.58 0.012 260   | metadata, labels                       |
| success    | 0.7 0.16 150     | winning trades, copy-link "copied"     |
| warning    | 0.78 0.15 75     | bias flags, caution                    |
| destructive| 0.6 0.21 25      | losing trades, missing bear case       |
| ai-suggested | 0.24 0.025 200 | AI-routed field background tint       |
| ai-suggested-border | 0.42 0.07 200 | AI field hairline + left accent |
| ai-suggested-badge | 0.7 0.09 200  | "AI" provenance pill (muted teal)    |
| mic        | 0.22 0.018 260   | mic button idle surface                |
| mic-active | 0.78 0.16 75     | recording state (amber fill)           |
| mic-processing | 0.62 0.11 75  | processing state (muted amber)         |
| border     | 0.27 0.015 260   | hairline dividers                      |
| chart-1..5 | amber/green/red/blue/violet | bias analytics series        |

## Typography

- Display: Space Grotesk — headings, section labels, sidebar nav (technical, confident)
- Body: DM Sans — paragraphs, form labels, UI text (neutral, dense)
- Mono: JetBrains Mono — prices, P&L, confidence scores, ticker symbols, timestamps
- Scale: hero `text-4xl font-bold tracking-tight`, h2 `text-2xl font-semibold tracking-tight`, label `text-xs font-semibold uppercase tracking-widest`, body `text-sm`, mono numerics `font-mono tnum`

## Elevation & Depth

Flat surfaces with hairline borders define hierarchy; `shadow-subtle` on cards, `shadow-elevated` on popovers/dropdowns only — no glow, no neon.

## Structural Zones

| Zone    | Background              | Border              | Notes                                  |
| ------- | ----------------------- | ------------------- | -------------------------------------- |
| Sidebar | `bg-sidebar`            | `border-r`          | fixed nav, amber active indicator       |
| Header  | `bg-card`               | `border-b`          | page title + filter bar, sticky         |
| Content | `bg-background`         | —                   | cards on `bg-card`, alternating `bg-muted/30` for analytics sections |
| Footer  | `bg-muted/40`           | `border-t`          | status line, threshold progress         |

## Spacing & Rhythm

Compact density: `gap-3`/`gap-4` between cards, `p-4` card padding, `space-y-6` between page sections — productivity tool, not a showcase.

## Component Patterns

- Buttons: primary `bg-primary text-primary-foreground` sharp 6px radius, hover slight L lift; secondary `bg-secondary border`
- Cards: `bg-card border rounded-md shadow-subtle`, dense `p-4`
- Badges: origin tags (self/social) pill `rounded-full`, bias flags amber `bg-warning/15 text-warning`
- Tables: monospace numerics, `tnum` utility, hairline `border-b` rows
- Confidence slider: amber track, numeric mono readout
- AI-suggested fields: `.ai-field` (teal-tinted gradient bg, teal left-border, `.ai-badge` "AI" pill top-right) + amber "Accept" button; on confirm → `.ai-field-confirmed` (card bg, amber left-border, badge removed) with `animate-ai-confirm-pop`
- Mic control: floating `.mic-btn` (rounded-full, `shadow-mic-float`); recording → `.mic-btn-recording` (amber fill + `animate-mic-recording-ring` halo + `.mic-dot-recording` pulse); processing → `.mic-btn-processing` (muted amber spin). Persistent global affordance, not a card button
- Share link: `.share-link-btn` (ghost, mono, hairline border, muted text); copied → `.share-link-btn-copied` (success tint border + green check)

## Motion

- Entrance: `animate-fade-in` 0.25s on page/card mount
- Hover: `transition-smooth` 0.2s — subtle bg shift, no scale bounce
- Decorative: `animate-pulse-subtle` only on live recording indicator and pending bias flags
- Mic recording: `animate-mic-recording-ring` 1.8s expanding amber halo (box-shadow, not opacity); processing: `animate-mic-processing-spin` 1.2s
- AI confirm: `animate-ai-confirm-pop` 0.3s scale pop when a field is accepted

## Constraints

- Dark mode primary; light mode is a tuned fallback (same hue family, inverted L)
- No purple gradients, no neon glows, no full-page gradient backgrounds
- All numerics in `font-mono tnum` — prices, P&L, confidence, timestamps
- Maximum 3–5 colors visible per screen; amber is the only user-action chromatic accent
- Muted teal (`ai-suggested`) is reserved exclusively for machine-provenance — AI-suggested fields and the "AI" badge. Never used for user-confirmed actions
- Mic halo is restrained amber box-shadow ring, never a neon glow
- Productivity density over decoration — no hero illustrations on internal pages

## Signature Detail

Tabular monospace numerics with amber active-state ticks — every trade row reads like a Bloomberg terminal line, making bias patterns visible at a glance without dashboards feeling like marketing. A second, muted-teal "machine-provenance" channel (AI-suggested fields + AI badge) sits beside the amber "user-confirmed" channel so the origin of every field is legible at a glance.
