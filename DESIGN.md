---
name: DeployDeck
description: Night-desk macOS console for Vercel and Cloudflare deployments
colors:
  bg: "oklch(0.985 0.003 75)"
  bg-dark: "oklch(0.145 0.008 255)"
  surface: "oklch(0.958 0.004 75)"
  surface-dark: "oklch(0.178 0.009 255)"
  surface-2: "oklch(0.925 0.005 75)"
  surface-2-dark: "oklch(0.218 0.01 255)"
  ink: "oklch(0.205 0.012 75)"
  ink-dark: "oklch(0.945 0.008 75)"
  muted: "oklch(0.405 0.012 75)"
  muted-dark: "oklch(0.695 0.012 75)"
  line: "oklch(0.865 0.006 75)"
  ember: "oklch(0.515 0.125 70)"
  ember-dark: "oklch(0.75 0.14 72)"
  ready: "oklch(0.49 0.115 150)"
  failed: "oklch(0.5 0.155 25)"
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
    textColor: "oklch(0.99 0.01 91)"
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

**Creative North Star: "The Night Desk Console"**

A developer utility that should feel like it shipped with the Mac: system type, hairline divisions, compact rows, one ember indicator. Design serves the task. The first-run guide is a short setup, not a brand film.

**Key Characteristics:**
- System font only
- Tonal layering instead of drop shadows
- Ember used on primary actions and current selection
- 140-220ms state motion with ease-out-expo

## 2. Colors

Restrained graphite neutrals. Light mode is a low-chroma mineral white; dark mode is a subtly cool graphite chassis. Ember is the only brand hue.

### Primary
- **Desk Ember** (`oklch(0.515 0.125 70)` light / `oklch(0.75 0.14 72)` dark): primary buttons, active nav icon, and the current setup control. The light value meets AA against both its foreground and the window background.

### Neutral
- **Paper / Chassis** (`oklch(0.985 0.003 75)` / `oklch(0.145 0.008 255)`): window background.
- **Rail** (`oklch(0.958 0.004 75)` / `oklch(0.178 0.009 255)`): sidebar and inset panels.
- **Ink** (`oklch(0.205 0.012 75)`): body text.
- **Quiet Ink** (`oklch(0.405 0.012 75)`): secondary text. Must stay ≥4.5:1.

**The One Ember Rule.** Ember occupies well under 10% of any screen. Status green and red are operational, not decorative.

## 3. Typography

**Display Font:** SF Pro / system-ui
**Body Font:** same family
**Label/Mono Font:** SF Mono for SHAs, logs, env keys

### Hierarchy
- **Title** (600, 15px): screen titles, setup headings
- **Body** (400, 13px): default UI
- **Label** (500, 12px): field labels, table headers
- **Mono** (400, 12px): identifiers

**The Fixed Scale Rule.** No fluid clamp type. Product UI stays at a fixed rem scale.

## 4. Elevation

Flat by default. Depth comes from surface steps and 1px lines. The selected sidebar row uses a 1px inset hairline; only portal surfaces such as dialogs and menus may use the defined popover shadow, without also adding a decorative border.

## 5. Components

### Buttons
- **Shape:** 8px radius, 32px height
- **Primary:** ember fill
- **Secondary / Ghost:** surface or transparent, ink text
- **Active:** 1px press, never a bounce

### Component foundation
- Radix primitives supply Select, Switch, Checkbox, Tabs, Dialog, Alert Dialog, menus, and tooltips.
- CVA defines variants; Lucide provides one consistent 1.75px icon language.
- Native form controls are not mixed into product screens except where the platform itself must own the interaction.
- Every control has explicit hover, focus, active, disabled, and loading states.

### Inputs / Fields
- Hairline border, 8px radius, 32px height
- Focus: ember ring, no glow bloom

### Navigation
- 232px sidebar rail
- Active item is a filled pill with a sliding indicator
- Titlebar is a drag region with the current screen name

## 6. Do's and Don'ts

### Do:
- **Do** keep tables dense and keyboardable.
- **Do** make first-run setup real (tokens, theme, tray).
- **Do** honor reduced motion with a crossfade or instant cut.

### Don't:
- **Don't** use marketing SaaS dashboards with giant metric cards and uptime theater.
- **Don't** wrap the app in website-in-Electron chrome (glass stacks, gradient blobs).
- **Don't** use neon cyberpunk / AI-purple tool skins.
- **Don't** use a multi-page onboarding carousel that delays first value.
- **Don't** use side-stripe borders, gradient text, or 32px+ card radii.
