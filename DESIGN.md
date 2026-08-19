---
name: DeployDeck
description: Night-desk macOS console for Vercel and Cloudflare deployments
colors:
  canvas: "oklch(0.958 0.005 252)"
  canvas-dark: "oklch(0.118 0.011 252)"
  bg: "oklch(0.975 0.004 252)"
  bg-dark: "oklch(0.135 0.011 252)"
  panel: "oklch(0.995 0.002 252)"
  panel-dark: "oklch(0.172 0.013 252)"
  panel-header: "oklch(0.974 0.004 252)"
  panel-header-dark: "oklch(0.15 0.012 252)"
  surface: "oklch(0.948 0.006 252)"
  surface-dark: "oklch(0.171 0.013 252)"
  surface-2: "oklch(0.912 0.008 252)"
  surface-2-dark: "oklch(0.212 0.015 252)"
  surface-sunken: "oklch(0.928 0.006 252)"
  surface-sunken-dark: "oklch(0.105 0.01 252)"
  ink: "oklch(0.205 0.018 252)"
  ink-dark: "oklch(0.955 0.006 252)"
  muted: "oklch(0.448 0.018 252)"
  muted-dark: "oklch(0.705 0.014 252)"
  subtle: "oklch(0.505 0.016 252)"
  subtle-dark: "oklch(0.605 0.016 252)"
  line: "oklch(0.878 0.008 252)"
  line-dark: "oklch(0.315 0.014 252 / 0.7)"
  line-strong: "oklch(0.828 0.01 252)"
  line-strong-dark: "oklch(0.375 0.016 252 / 0.85)"
  control: "oklch(0.998 0.001 252)"
  control-dark: "oklch(0.158 0.012 252)"
  control-hover: "oklch(0.955 0.005 252)"
  control-hover-dark: "oklch(0.2 0.014 252)"
  ember: "oklch(0.735 0.173 60)"
  ember-dark: "oklch(0.795 0.148 62)"
  ember-ink: "oklch(0.51 0.123 58)"
  ember-ink-dark: "oklch(0.795 0.148 62)"
  ember-soft: "oklch(0.945 0.034 58)"
  ember-soft-dark: "oklch(0.264 0.059 62)"
  ember-fg: "oklch(0.17 0.03 60)"
  ready: "oklch(0.51 0.119 158)"
  ready-ink: "oklch(0.485 0.114 158)"
  ready-ink-dark: "oklch(0.78 0.145 158)"
  ready-soft: "oklch(0.945 0.047 158)"
  ready-soft-dark: "oklch(0.264 0.058 158)"
  ready-lamp: "oklch(0.66 0.155 158)"
  ready-lamp-dark: "oklch(0.8 0.16 158)"
  failed: "oklch(0.545 0.175 25)"
  failed-ink: "oklch(0.52 0.175 25)"
  failed-ink-dark: "oklch(0.745 0.155 22)"
  failed-soft: "oklch(0.945 0.027 25)"
  failed-soft-dark: "oklch(0.264 0.06 22)"
  building-ink: "oklch(0.505 0.112 68)"
  building-ink-dark: "oklch(0.8 0.142 68)"
  building-soft: "oklch(0.945 0.039 68)"
  building-soft-dark: "oklch(0.264 0.057 68)"
  queued-ink: "oklch(0.5 0.151 252)"
  queued-ink-dark: "oklch(0.75 0.1 252)"
  queued-soft: "oklch(0.945 0.027 252)"
  queued-soft-dark: "oklch(0.264 0.04 252)"
  canceled-ink: "oklch(0.5 0.014 252)"
  canceled-ink-dark: "oklch(0.715 0.012 252)"
  canceled-soft: "oklch(0.945 0.005 252)"
  canceled-soft-dark: "oklch(0.264 0.006 252)"
  warning-ink: "oklch(0.505 0.108 75)"
  warning-ink-dark: "oklch(0.82 0.135 78)"
  warning-soft: "oklch(0.945 0.045 75)"
  warning-soft-dark: "oklch(0.264 0.054 78)"
typography:
  console:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Display, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "30px"
    letterSpacing: "-0.025em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "26px"
    letterSpacing: "-0.02em"
  section:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "22px"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
    letterSpacing: "-0.01em"
  dense:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, sans-serif"
    fontSize: "13px"
    lineHeight: "18px"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
  micro:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, sans-serif"
    fontSize: "11px"
    lineHeight: "16px"
  mono:
    fontFamily: "Geist Mono Variable, SF Mono, ui-monospace, Menlo, Consolas, monospace"
    fontSize: "13px"
rounded:
  control: "8px"
  panel: "12px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ember}"
    textColor: "{colors.ember-fg}"
    rounded: "{rounded.control}"
    height: "34px"
    padding: "0 12px"
  button-secondary:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "34px"
  input:
    backgroundColor: "{colors.control}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "34px"
    padding: "0 12px"
  panel:
    backgroundColor: "{colors.panel}"
    borderColor: "{colors.line}"
    rounded: "{rounded.panel}"
  status-pill:
    backgroundColor: "{colors.ready-soft}"
    textColor: "{colors.ready-ink}"
    rounded: "6px"
    height: "22px"
---

# Design System: DeployDeck

## 1. Overview

**Creative North Star: "Cold chassis, one warm lamp"**

A developer utility that should feel like a hardware instrument on a night desk: cold blue-steel panel, system type, hairline divisions, compact rows, and warmth reserved entirely for indicators. Design serves the task. The first run is the console powering on; the workspace afterwards is quiet.

**Key Characteristics:**
- System sans for everything; Geist Mono for technical readouts
- Raised panels on a recessed canvas, held by hairlines rather than drop shadows
- Warmth is signal, never brand decoration
- 140-220ms state motion with ease-out-expo in the workspace; the first-run flow is choreographed with GSAP

**Density is earned, not maximal.** An instrument is legible first and dense second. Body text is 14px, page titles are 20px, gutters are 24px, and no tier goes below 11px. Compressing the scale further does not read as precision, it reads as unfinished.

## 2. Colors

Every neutral sits on one blue-steel hue (252). That coldness is load-bearing: it is what lets a single amber indicator read as a lamp instead of as a brand colour. Light mode is a cool mineral grey; dark mode is the reference, a graphite chassis.

**Do not warm the neutrals.** A warm-tinted near-white background (OKLCH L 0.84-0.97, chroma < 0.06, hue 40-100) reads as cream/paper/parchment no matter what the token is called, and it is the saturated default of current generated UI. It also destroys the instrument read, because warm-on-warm turns the indicator into decoration.

### Primary — two accent roles

The lit amber is bright enough to fill a control but too bright to be text on a light surface (2.29:1). So it splits:

- **Lamp** `--ember` (`oklch(0.735 0.173 60)` light / `oklch(0.795 0.148 62)` dark): the *fill* of a lit control or indicator. Always paired with `--ember-fg` (`oklch(0.17 0.03 60)`) for any text on top.
- **Lamp Ink** `--ember-ink` (`oklch(0.53 0.127 58)` light / same as lamp in dark): the accent for *text and icons*. Guaranteed ≥4.5:1 on bg and surface.

Never use `--ember` as a text colour, and never use `--ember-ink` as a large fill.

### Status — the same three roles, for every state

The ember split is not special to the accent; it is how any saturated colour has to behave. Each status therefore carries three tokens:

| Role | Token | Used for |
|---|---|---|
| Fill | `--ready` | the indicator dot |
| Ink | `--ready-ink` | pill text and icons, ≥4.5:1 on every surface it lands on |
| Wash | `--ready-soft` | the pill background the ink sits on |

The same holds for `failed`, `building`, `queued`, `canceled`, and `warning`. A pill's border is its own ink at 25% alpha, so it tracks the tone without needing a fourth token.

**Washes are mixed toward the canvas, never toward `--surface-2`.** Status ink only reaches about 4.2:1 on `--surface-2`, and `canceled` fails outright there. Keep pills on the canvas or panel tones.

### Neutral
- **Canvas** (`oklch(0.958 0.005 252)` / `oklch(0.118 0.011 252)`): the recessed page bed.
- **Panel** (`oklch(0.995 0.002 252)` / `oklch(0.172 0.013 252)`): raised cards. Brighter than the canvas in *both* modes, so a panel always reads as lifted.
- **Chassis** (`oklch(0.975 0.004 252)` / `oklch(0.135 0.011 252)`): dialogs, inspector panels, the active nav pill.
- **Rail** (`oklch(0.948 0.006 252)` / `oklch(0.171 0.013 252)`): sidebar and inset panels.
- **Sunken** (`oklch(0.928 0.006 252)` / `oklch(0.105 0.01 252)`): recessed wells — log canvas, token slots, lamp bezels.
- **Ink** / **Quiet Ink** / **Subtle**: body, secondary, tertiary text. All three clear 4.5:1 on every surface they are used on.

**The One Lamp Rule.** Warm colour occupies well under 10% of any screen and only ever marks state: primary action, current selection, live indicator. Status green and red are operational, not decorative.

**Verify before you commit.** `npm run contrast` parses `globals.css`, checks every documented pair against AA, and fails on any token that clips out of sRGB. Every value here passes it. Do not hand-tune a colour without re-running it.

## 3. Typography

**Display Font:** SF Pro / system-ui
**Body Font:** same family
**Mono Font:** Geist Mono for SHAs, logs, env keys, DNS records, raw payloads

Geist Mono is bundled locally (`@fontsource-variable/geist-mono`) and imported from `main.tsx`, not via `@import` in `globals.css` — Tailwind's PostCSS plugin resolves `@import` itself and does not rebase the package's relative `url()` paths, which leaves the woff2 files unbundled and silently falls back to SF Mono.

### Hierarchy

Every step is a `--text-*` theme token, so it is `text-body`, never `text-[14px]`.

| Token | Size / line | Used for |
|---|---|---|
| `text-console` | 24px / 30px, 600 | the first-run console heading only |
| `text-title` | 20px / 26px, 600 | screen titles, in `PageHeader` |
| `text-section` | 16px / 22px, 600 | panel and section headings |
| `text-body` | 14px / 20px | default UI, table cells |
| `text-dense` | 13px / 18px | secondary text, mono readouts, inspector detail |
| `text-label` | 12px / 16px | field labels, table headers |
| `text-micro` | 11px / 16px | the floor: keycaps and the quietest metadata |

**The Fixed Scale Rule.** No fluid clamp type. Product UI stays at a fixed scale; steps run 12 → 14 → 16 → 20.

**The floor.** There is no 10px tier. If text needs to be smaller than `text-micro` to fit, the layout is wrong, not the type.

**The one size exception.** 24px is reserved for the first-run console. Everything inside the workspace tops out at 20px, and only `PageHeader` uses that. A screen title and a panel heading must never be the same size; `PanelHeader` and `SectionHeader` take `size="sm"` when they sit under one.

**One title per screen.** The shell renders the `PageHeader` from `SCREEN_LABEL` and `SCREEN_DESCRIPTION` in `app-shell.tsx`. A screen must not also render its own copy of its name.

## 4. Elevation

Depth comes from surface steps and 1px lines, never from a border paired with a wide shadow. Only portal surfaces — dialogs, menus, the command palette — may use the defined popover shadow, and they carry no border when they do.

There are exactly two levels in the content area:

- **Canvas** — the page bed. `body` and every screen's scroll container.
- **Panel** — anything the canvas holds. `--panel` fill, 1px `--line` border, 12px radius, and a `--panel-header` bar for its title and footer rows.

Panel is brighter than canvas in light mode *and* in dark mode. That direction is the whole point: it is why a card reads as lifted rather than as a hole. Do not build a panel out of `--surface`, which is the sidebar tone and sits darker than the canvas in light mode.

**Nesting stops at one level.** A panel inside a panel is always wrong; use `PanelBody divided` and `PanelRow` instead.

Two material treatments exist, both earned rather than decorative:

- **Chassis wash** (`.chassis`): a soft top-down falloff, as if a desk lamp sits above the panel. Visible in dark, near-imperceptible in light. Used on the first-run console.
- **Lamp bloom**: a small glow carried by a lit indicator, sized to its state. This is the one place glow is allowed, because the glow *is* the information.

Recessed wells use `--surface-sunken` with a short inset shadow. Reserved for things you feed input into or read output from.

## 5. Components

### Buttons
- **Shape:** `rounded-control` (8px). Heights: `sm` 28px, default 34px, `lg` 40px
- **Primary:** ember fill
- **Secondary / Ghost:** surface or transparent, ink text
- **Active:** 1px press, never a bounce

**One toolbar rail.** Buttons, inputs, and selects all sit at 34px by default, so a row of mixed controls lines up without per-call-site nudging.

**Disabled fills go neutral, not faded.** A filled button drops to `--surface-2` with `--subtle` text when disabled. Fading a saturated fill to 40% opacity reads as a smudge, and it spends the one-lamp budget on a control that cannot be pressed. Ghost, outline, and secondary keep the opacity treatment.

**One primary per row.** If a row already has a primary action, a second action in it steps down to `secondary`. Two ember fills side by side means the accent is no longer telling you where to go.

### Component foundation
- Radix primitives supply Select, Switch, Checkbox, RadioGroup, Tabs, Dialog, Alert Dialog, menus, and tooltips.
- CVA defines variants; Lucide provides one consistent 1.75px icon language.
- Native form controls are not mixed into product screens except where the platform itself must own the interaction.
- Every control has explicit hover, focus, active, disabled, and loading states.
- One shared component per job. Before building a row, header, menu item, badge, empty state, or segmented control, check `components/ui` and `components/common` — the same task appearing twice with two appearances is the defect this system exists to prevent.

### Shared vocabulary
- **`Panel` / `PanelHeader` / `PanelBody` / `PanelFooter` / `PanelRow`** (`components/ui/panel`): the container system. `PanelHeader` takes `count` for a quiet tally and `actions` for a trailing control; `PanelBody` takes `padding`, `scroll`, and `divided`. `PanelRow` is the one list row — it takes `leading`, `title`, `description`, `trailing`, and `onActivate` to become a button. Never hand-roll a `-mx-2 flex min-h-10 … hover:bg-surface` row again.
- **`Readout` / `ReadoutStrip`**: a horizontal label/value strip for tallies. Deliberately not a metric card.
- **`PageHeader`** (`components/ui/layout`): the screen title block. Rendered by the shell, one per screen.
- **`Badge`**: the only pill. Carries `dot` and `pulse`, plus a variant per status that pairs `-soft` with `-ink`. `StatusBadge` composes on it rather than reimplementing it.
- **`SegmentedControl`** (Radix RadioGroup): any 2-3 option choice. Sliding `layoutId` indicator, arrow-key navigation. `SelectControl` is for longer lists.
- **`Lamp` / `LampReadout` / `LampBank`**: state indicators. `off` shows a visible unlit bezel, `verifying` pulses amber, `live` is green, `fault` is red.
- **`ProviderGlyph` / `ProviderTile`**: real Vercel and Cloudflare geometry. Never a letter in a box.
- **`TableSkeleton`**: loading for `.data-table` screens. Loading is never an `EmptyState` with the word "Loading".
- **`EmptyState` / `ScreenError`**: both take `size="inline"` for inspector panels and sections.
- **`DetailRow`**, **menu wrappers** in `components/ui/menu`: one appearance for label/value pairs and for menu items regardless of trigger.

### Inputs / Fields
- Hairline border, `rounded-control` (8px), 34px height
- Hover strengthens the border to `--line-strong`; focus is an ember ring, no glow bloom
- Token and identifier inputs use mono for the value and sans for the placeholder

### Table rows
Hover, selection, and focus must compose, not overwrite each other. The cascade order in `globals.css` is hover, then `[aria-selected]`, then `:focus-visible` (an inset ring, so it layers over selection). Set `aria-selected` on the row rather than adding a Tailwind background, or the CSS hover rule will out-specify it.

Rows are 36px compact / 44px comfortable, under a 38px header.

**Column rails.** Declare columns once as a `COLUMNS` array and render both `<colgroup>` and `<thead>` from it, then add `data-table-fixed` so those widths are authoritative and `truncate` works on any cell. The loading skeleton renders from the same array, which is what keeps it from drifting out of alignment with the real rows. Time and duration columns carry `data-numeric`, which right-aligns them and turns on tabular figures.

**Per-row detail belongs in its own row.** Anything taller than a line — DNS verification records, expanded payloads — goes in a following `<tr>` with a `colSpan` cell on `--surface-sunken`. Nesting it inside a cell makes every row a different height and destroys the table's rhythm.

### Log output
One CSS grid for the whole log, not a flex row per line, so the timestamp and level columns size to their widest content across every row and form real rails. Levels use the status `-ink` tokens; `--surface-sunken` is in the contrast matrix because of it.

### Timelines
Encode kind with an icon in a muted tile, not with colour. Six status colours would carry the same information at the cost of the one-lamp budget. Group by calendar day with one panel per day; `dayKey` and `dayLabel` in `lib/format` own the bucketing.

### Navigation
- 232px sidebar rail, user-collapsible to a 64px icon rail; windows at or below 1180px collapse automatically
- Active item is a filled pill with a sliding indicator
- The titlebar is a 48px drag region holding the global New menu and command palette entry. The screen name lives below it in `PageHeader`, not in the bar.
- Connected-account controls move into a bottom popover while the rail is collapsed; no provider context disappears.

### Inspectors and creation
- `InspectorPanel` is inline above 1180px and becomes a right-side overlay Sheet below it. It must never reduce a table to an unusable sliver.
- Every inspector closes with Escape, keeps an explicit close button, and returns focus through its triggering flow.
- Multi-step project/deployment creation is a dedicated workspace surface, not a modal. The sequence is Resource → Source & build → Environment → Review.

### DNS forms
- Record types come from the shared provider-aware registry. Cloudflare exposes 21 current API types; Vercel exposes only its supported subset.
- Advanced records use structured fields and a canonical-name preview. Unknown future types preserve their raw provider type and remain read-only.
- Batch selection is the only time DNS rows gain checkboxes; bulk TTL, proxy, delete, import, and export remain in one action rail.

### Stacking
Use the semantic `--z-*` scale (`sticky`, `panel-overlay`, `dropdown`, `overlay`, `modal`, `toast`, `tooltip`) as `z-[var(--z-dropdown)]`. Never a bare `z-50`.

## 6. Motion

Two engines, split by surface. Do not mix them within one feature.

- **Workspace — `motion`.** The sidebar pill `layoutId`, segmented controls, sheets, and state transitions use 140-220ms motion. Screen content swaps immediately so a hidden Electron window cannot pause an exit transition and leave two pages stacked.
- **First run — GSAP.** The one choreographed surface. `useGSAP` from `@gsap/react` handles cleanup; `useStepFlow` in `features/onboarding/setup-steps.tsx` owns the step timeline.

**First-run choreography**
- Power-on runs once: mark, then meter, then chrome, overlapping via negative offsets.
- Step changes animate out, then swap, then animate in. Rows are tagged `data-row` and stagger at ~0.06s with `power3.out`.
- Stage height tweens between measured values so the footer does not jump. This is the one sanctioned layout-property animation; it is cleared with `clearProps` afterwards.

**Reduced motion.** Use `prefersReducedMotion()` from `lib/motion`, not `gsap.matchMedia()`. A matchMedia instance created inside `useGSAP` is not reverted by its context and leaks a listener on every run. Reduced motion collapses durations to ~0 and drops all `y` offsets; the flow still works, it just cuts.

## 7. First-run flow

Three steps, each of which does real work: **Channels** (connect a provider), **Console** (preferences), **Launch** (confirm and open). Progress is a segmented meter, not dots; completed steps stay clickable.

- No step may exist to explain a feature. If a step has nothing to submit, delete it.
- Continue is gated on the step actually being satisfiable — Channels blocks until a provider is live.
- Copy must stay honest against real state. Launch cannot claim the deck is live if the user went back and disconnected.

## 8. Do's and Don'ts

### Do:
- **Do** keep tables dense and keyboardable, at 14px.
- **Do** put content in a `Panel`. A bare `border-t` hairline is a divider, not a container.
- **Do** run `npm run contrast` after touching any colour token.
- **Do** make first-run setup real (tokens, theme, tray).
- **Do** honor reduced motion with a crossfade or instant cut.
- **Do** let indicators carry state. A lamp changing colour beats a sentence changing wording.
- **Do** reach for mono when a value is technical. It does more for the instrument read than any decoration.

### Don't:
- **Don't** use marketing SaaS dashboards with giant metric cards and uptime theater.
- **Don't** wrap the app in website-in-Electron chrome (glass stacks, gradient blobs).
- **Don't** use neon cyberpunk / AI-purple tool skins.
- **Don't** add a first-run step that only explains something. Steps submit work or they do not exist.
- **Don't** use side-stripe borders, gradient text, or 32px+ card radii.
- **Don't** warm the neutrals toward cream, sand, paper, or parchment. See section 2.
- **Don't** put a marketing rail, positioning headline, or feature tour on the first-run console. It is a panel you power on, not a page that sells.
- **Don't** pair a 1px border with a wide soft drop shadow on the same element.
- **Don't** write `text-[13px]` or any other arbitrary size. Use the `--text-*` steps.
- **Don't** turn the readout strip on Overview into metric cards. Same ban as section 8, one tier subtler.
- **Don't** build a panel from `--surface`, or nest a panel inside a panel.
