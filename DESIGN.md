---
name: DeployDeck
description: Night-desk macOS console for Vercel and Cloudflare deployments
colors:
  bg: "oklch(0.975 0.004 252)"
  bg-dark: "oklch(0.135 0.011 252)"
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
  ember: "oklch(0.735 0.173 60)"
  ember-dark: "oklch(0.795 0.148 62)"
  ember-ink: "oklch(0.53 0.127 58)"
  ember-ink-dark: "oklch(0.795 0.148 62)"
  ember-fg: "oklch(0.17 0.03 60)"
  ready: "oklch(0.51 0.119 158)"
  ready-dark: "oklch(0.78 0.145 158)"
  ready-lamp: "oklch(0.66 0.16 158)"
  ready-lamp-dark: "oklch(0.8 0.16 158)"
  failed: "oklch(0.545 0.175 25)"
  failed-dark: "oklch(0.705 0.17 22)"
typography:
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.3
  mono:
    fontFamily: "SF Mono, ui-monospace, Menlo, Consolas, monospace"
    fontSize: "12px"
rounded:
  sm: "6px"
  md: "8px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ember}"
    textColor: "{colors.ember-fg}"
    rounded: "{rounded.md}"
    height: "32px"
    padding: "0 12px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "32px"
  input:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "32px"
    padding: "0 10px"
---

# Design System: DeployDeck

## 1. Overview

**Creative North Star: "Cold chassis, one warm lamp"**

A developer utility that should feel like a hardware instrument on a night desk: cold blue-steel panel, system type, hairline divisions, compact rows, and warmth reserved entirely for indicators. Design serves the task. The first run is the console powering on; the workspace afterwards is quiet.

**Key Characteristics:**
- System font only; SF Mono for technical readouts
- Tonal layering instead of drop shadows
- Warmth is signal, never brand decoration
- 140-220ms state motion with ease-out-expo in the workspace; the first-run flow is choreographed with GSAP

## 2. Colors

Every neutral sits on one blue-steel hue (252). That coldness is load-bearing: it is what lets a single amber indicator read as a lamp instead of as a brand colour. Light mode is a cool mineral grey; dark mode is the reference, a graphite chassis.

**Do not warm the neutrals.** A warm-tinted near-white background (OKLCH L 0.84-0.97, chroma < 0.06, hue 40-100) reads as cream/paper/parchment no matter what the token is called, and it is the saturated default of current generated UI. It also destroys the instrument read, because warm-on-warm turns the indicator into decoration.

### Primary — two accent roles

The lit amber is bright enough to fill a control but too bright to be text on a light surface (2.29:1). So it splits:

- **Lamp** `--ember` (`oklch(0.735 0.173 60)` light / `oklch(0.795 0.148 62)` dark): the *fill* of a lit control or indicator. Always paired with `--ember-fg` (`oklch(0.17 0.03 60)`) for any text on top.
- **Lamp Ink** `--ember-ink` (`oklch(0.53 0.127 58)` light / same as lamp in dark): the accent for *text and icons*. Guaranteed ≥4.5:1 on bg and surface.

Never use `--ember` as a text colour, and never use `--ember-ink` as a large fill.

### Neutral
- **Chassis** (`oklch(0.975 0.004 252)` / `oklch(0.135 0.011 252)`): window background.
- **Rail** (`oklch(0.948 0.006 252)` / `oklch(0.171 0.013 252)`): sidebar and inset panels.
- **Sunken** (`oklch(0.928 0.006 252)` / `oklch(0.105 0.01 252)`): recessed wells — log canvas, token slots, lamp bezels.
- **Ink** / **Quiet Ink** / **Subtle**: body, secondary, tertiary text. All three clear 4.5:1 on every surface they are used on.

**The One Lamp Rule.** Warm colour occupies well under 10% of any screen and only ever marks state: primary action, current selection, live indicator. Status green and red are operational, not decorative. Every value in this file was solved for AA and clamped into sRGB; re-verify with a contrast script before changing any of them.

## 3. Typography

**Display Font:** SF Pro / system-ui
**Body Font:** same family
**Label/Mono Font:** SF Mono for SHAs, logs, env keys

### Hierarchy
- **Console Title** (600, 22px, -0.025em): the first-run console heading only
- **Title** (600, 15px): screen titles
- **Section** (600, 13px): section headings inside a screen, below a screen title
- **Body** (400, 13px): default UI
- **Label** (500, 12px): field labels, table headers
- **Mono** (400, 11-12px): identifiers, SHAs, log lines, and panel readouts such as lamp state

**The Fixed Scale Rule.** No fluid clamp type. Product UI stays at a fixed rem scale.

**The one size exception.** 22px is reserved for the first-run console. Everything inside the workspace tops out at 15px. Screen title and section heading must not both be 15px; `SectionHeader` takes `size="sm"` when it sits under a screen title.

## 4. Elevation

Flat by default. Depth comes from surface steps and 1px lines (as `inset 0 0 0 1px`, not a border paired with a wide shadow). The selected sidebar row uses a 1px inset hairline; only portal surfaces such as dialogs and menus may use the defined popover shadow, without also adding a decorative border.

Two material treatments exist, both earned rather than decorative:

- **Chassis wash** (`.chassis`): a soft top-down falloff, as if a desk lamp sits above the panel. Visible in dark, near-imperceptible in light. Used on the first-run console.
- **Lamp bloom**: a small glow carried by a lit indicator, sized to its state. This is the one place glow is allowed, because the glow *is* the information.

Recessed wells use `--surface-sunken` with a short inset shadow. Reserved for things you feed input into or read output from.

## 5. Components

### Buttons
- **Shape:** 8px radius, 32px height
- **Primary:** ember fill
- **Secondary / Ghost:** surface or transparent, ink text
- **Active:** 1px press, never a bounce

### Component foundation
- Radix primitives supply Select, Switch, Checkbox, RadioGroup, Tabs, Dialog, Alert Dialog, menus, and tooltips.
- CVA defines variants; Lucide provides one consistent 1.75px icon language.
- Native form controls are not mixed into product screens except where the platform itself must own the interaction.
- Every control has explicit hover, focus, active, disabled, and loading states.
- One shared component per job. Before building a row, header, menu item, badge, empty state, or segmented control, check `components/ui` and `components/common` — the same task appearing twice with two appearances is the defect this system exists to prevent.

### Shared vocabulary
- **`SegmentedControl`** (Radix RadioGroup): any 2-3 option choice. Sliding `layoutId` indicator, arrow-key navigation. `SelectControl` is for longer lists.
- **`Lamp` / `LampReadout` / `LampBank`**: state indicators. `off` shows a visible unlit bezel, `verifying` pulses amber, `live` is green, `fault` is red.
- **`ProviderGlyph` / `ProviderTile`**: real Vercel and Cloudflare geometry. Never a letter in a box.
- **`TableSkeleton`**: loading for `.data-table` screens. Loading is never an `EmptyState` with the word "Loading".
- **`EmptyState` / `ScreenError`**: both take `size="inline"` for inspector panels and sections.
- **`DetailRow`**, **menu wrappers** in `components/ui/menu`: one appearance for label/value pairs and for menu items regardless of trigger.

### Inputs / Fields
- Hairline border, 8px radius, 32px height
- Focus: ember ring, no glow bloom
- Token and identifier inputs use mono for the value and sans for the placeholder

### Table rows
Hover, selection, and focus must compose, not overwrite each other. The cascade order in `globals.css` is hover, then `[aria-selected]`, then `:focus-visible` (an inset ring, so it layers over selection). Set `aria-selected` on the row rather than adding a Tailwind background, or the CSS hover rule will out-specify it.

### Navigation
- 232px sidebar rail
- Active item is a filled pill with a sliding indicator
- Titlebar is a drag region with the current screen name

## 6. Motion

Two engines, split by surface. Do not mix them within one feature.

- **Workspace — `motion`.** Screen crossfades, the sidebar pill `layoutId`, the segmented control indicator. State transitions of 140-220ms. Motion conveys state and nothing else; no orchestrated page loads.
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
- **Do** keep tables dense and keyboardable.
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
