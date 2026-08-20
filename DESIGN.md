---
name: DeployDeck
description: Geist-based macOS control plane for Vercel and Cloudflare
colors:
  canvas: "oklch(0.9875 0 0)"
  canvas-dark: "oklch(0.1 0 0)"
  base: "oklch(1 0 0)"
  base-dark: "oklch(0.17 0 0)"
  elevated: "oklch(0.98 0 0)"
  elevated-dark: "oklch(0.12 0 0)"
  recessed: "oklch(0.96 0 0)"
  recessed-dark: "oklch(0.269 0 0)"
  tint: "oklch(0.97 0 0)"
  tint-dark: "oklch(0.15 0 0)"
  ink: "oklch(0.21 0.006 285.885)"
  ink-dark: "oklch(0.97 0 0)"
  muted: "oklch(0.5 0 0)"
  muted-dark: "oklch(0.708 0 0)"
  subtle: "oklch(0.54 0 0)"
  subtle-dark: "oklch(0.645 0 0)"
  hairline: "oklch(0.935 0 0)"
  hairline-dark: "oklch(0.269 0 0)"
  brand: "oklch(0.5772 0.2324 260)"
  brand-dark: "oklch(0.55 0.21 260)"
  brand-ink: "oklch(0.424 0.199 265.638)"
  brand-ink-dark: "oklch(0.707 0.13 254.624)"
  brand-soft: "oklch(0.94 0.02 255.6)"
  brand-soft-dark: "oklch(0.26 0.07 260)"
  cloudflare: "oklch(0.735 0.173 60)"
  cloudflare-ink: "oklch(0.51 0.123 58)"
  chassis-glow-dark: "oklch(0.82 0 0 / 0.1)"
rounded:
  control: "8px"
  surface: "12px"
typography:
  family: "Geist Variable, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
  mono: "Geist Mono Variable, SF Mono, ui-monospace, monospace"
  body: "14px / 20px"
  section: "16px / 22px"
  title: "20px / 26px"
  console: "24px / 30px"
---

# DeployDeck design system

## 1. Direction

DeployDeck combines **Vercel Geist's precision** with **Cloudflare Kumo's product structure**:

- Geist Sans for the full interface; Geist Mono only for identifiers, logs, DNS values, environment keys, and shortcuts.
- Neutral black/white product chrome. No blue-steel tint and no decorative warm wash.
- Vercel-style high-contrast global actions; Kumo blue for page-local mutations and checked controls.
- Cloudflare orange identifies Cloudflare itself and the console lamp. It is not the generic primary action colour.
- Resource work happens inside a `ResourceListFrame → Panel → Table` surface, not on a bare canvas.

The target is a credible developer control plane, not a themed Electron dashboard.

## 2. Typography

- All navigation, buttons, inputs, menu items, descriptions, table headers, and table cells are **14px**.
- Headings begin at 16px; the screen title is 20px. The first-run console alone may use 24px.
- Do not change letter spacing. Geist's native spacing is part of the design.
- Use `font-semibold` for headings and `font-medium` for inline emphasis. Never use `font-bold`.
- Mono mixed into prose is slightly smaller; mono data rails use the normal 14px content size.
- Headings use sentence case. Provider and product names retain their official casing.

## 3. Semantic colour

Surface order, outermost to innermost:

1. `canvas` — page background.
2. `base` — default component and resource-list surface.
3. `elevated` — sidebar and secondary application chrome.
4. `recessed` — segmented controls, wells, and quiet grouped controls.
5. `tint` — hover and selected-row feedback only.

Other roles:

- `hairline` separates flat surfaces and is used as a ring on cards.
- `line` is reserved for stronger sticky or sectional divisions.
- `brand` is the blue mutation/control colour.
- `cloudflare` / `ember` is reserved for the Cloudflare glyph and lamp state.
- Status colours always split into solid indicator, readable ink, and tint background.

Every foreground/background pair must pass `npm run contrast`. Do not add raw Tailwind palette colours or `dark:` colour overrides.

## 4. Materials

### Resource surfaces and panels

- `Panel` is the local LayerCard equivalent: base fill, 1px hairline ring, 12px radius, and a short 1–2px edge shadow.
- Never combine a solid border with a wide drop shadow.
- Header and footer remain on the base surface; hierarchy comes from dividers and spacing, not gray title bars.
- Do not nest `Panel` inside `Panel`. Use divided bodies and rows.
- Portal surfaces use 12px radius and the popover shadow, with no border.

### Concentric radius

When a floating surface uses 4px padding, its 8px child items sit inside a 12px outer radius. Inner and outer corners must be concentric.

## 5. Application frame

- Expanded sidebar: 232px. Icon rail: 64px.
- The rail stays expanded at normal desktop widths and collapses automatically below 1100px.
- The workspace/account selector sits below the brand, not as a large block at the bottom.
- `New resource` lives in the sidebar. The titlebar carries only global search, so it does not compete with page-local actions.
- Active navigation uses a neutral base fill and hairline; provider colour does not leak into general navigation.
- Sidebar width changes are immediate. Do not remove labels during a simultaneous width animation.

## 6. Page structure

- The shell renders one `PageHeader`: 20px title, 14px action-led description, base surface, bottom hairline.
- Resource screens use `ResourceListFrame` with 24px outer gutters and one `Panel` containing toolbar, loading/empty/error state, table, and pagination.
- A screen may have one filled page-local action. Search, filters, counts, and secondary actions remain in the resource toolbar.
- Overview uses a compact status strip, one recent-deployments list, and a narrow activity/project column. Do not recreate a 2×2 metric-card dashboard.
- Settings exposes one category at a time through vertical or horizontal section navigation.

## 7. Components

### Buttons

- Heights: small 32px, default 34px, large 40px.
- `default`: high-contrast ink/base action.
- `accent`: blue page-local mutation.
- `secondary`: control fill + hairline ring.
- `ghost`: transparent, tint on hover.
- `danger`: destructive fill.
- Loading keeps the original width, colour, and focus. It sets `aria-busy` and blocks repeat activation without native disabling.
- Hover colour changes are immediate. Only opacity, transform, progress width, and state motion may transition.

### Inputs and selects

- 34px default height; 8px radius; 14px content.
- Hairline at rest, stronger boundary on hover, accessible neutral focus ring.
- Menus use 12px outer radius, 4px padding, and 8px items.

### Tables

- Tables always live inside a resource `Panel`.
- Header and data text are 14px; headers are semibold.
- Compact rows are 40px; comfortable rows are 48px; headers are 40px.
- Use Geist-style status dots for deployment lifecycle. A row should not display two competing coloured pills.
- Provider marks are explicit: Vercel triangle in ink, Cloudflare cloud in orange.
- Low-priority columns compress, hide, or move to the inspector before core actions become unreachable.
- Time uses `2m ago`, `5h ago`, or `4d ago`; after seven days use `Aug 1, 2026`.
- Row menus expose one kebab control; destructive items appear after a separator.

### Rows

- Static rows use `PanelRow`; interactive rows use `PanelRowButton` with native button props.
- Two-line rows align icons and trailing controls to the first 20px text line.
- Hover colour is immediate and uses `tint`.

### Loading, empty, and error states

- Initial loading mirrors the final table rails; do not show a zero count next to a skeleton.
- Background refresh preserves existing rows and shows a quiet `Updating…` label.
- Empty states teach the next action and remain inside the resource surface.
- Errors include a local retry action and do not replace unrelated cached content.

## 8. Inspectors and dialogs

- At 1400px and above inspectors may remain inline.
- Below 1400px inspectors are modal right-side sheets with an overlay, focus trap, Escape handling, and deterministic focus return.
- Every inspector has an explicit close button and an accessible name.
- Dialogs remain mounted and use their `open` state for animation.

## 9. Motion

- Hover colours are instant.
- Workspace state motion is 140–220ms with ease-out-expo.
- Sidebar selection and segmented-control indicators may use layout motion.
- Progress bars may animate width; spinners may rotate.
- The first-run flow alone may use choreographed GSAP motion.
- `prefers-reduced-motion` reduces all nonessential motion to an instant state change.

## 10. Accessibility and QA

- Body and control text meet WCAG AA in both themes.
- Keyboard paths are required for navigation, tables, menus, command palette, and inspectors.
- Command palette and all inputs have accessible names.
- Menus and dialogs return focus to their trigger.
- Root pages never horizontally overflow at 1024×680, 1280×820, or 1440×900. Table scrolling stays inside the resource card.
- Visual regression covers Overview, Deployments, Domains, DNS, and Settings in light and dark mode.
- Required gates: `typecheck`, `lint`, `contrast`, `test:all`, `package`, and real Electron interaction QA.

## 11. Bans

- No gradient text, glass stacks, decorative grid backgrounds, or neon tool skins.
- No gray-blue wash across the entire app.
- No orange generic primary buttons.
- No 11px or 12px interactive text, manual tracking, or animated hover colours.
- No bare data tables on the canvas.
- No four-button action rails in table rows.
- No icon-only desktop sidebar at the normal 1280px window width.
- No inspector that visually overlays content while leaving background controls focusable.
