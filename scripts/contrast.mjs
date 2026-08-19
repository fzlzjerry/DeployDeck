#!/usr/bin/env node
/**
 * Verifies the design tokens in src/renderer/styles/globals.css against WCAG AA.
 *
 * DESIGN.md requires every colour pair to be re-checked before it changes, so
 * this reads the real stylesheet rather than a copy of the values: if a token
 * moves and its contrast drops, `npm run contrast` fails.
 *
 * Usage: node scripts/contrast.mjs [--verbose]
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSS = path.join(ROOT, "src/renderer/styles/globals.css");
const VERBOSE = process.argv.includes("--verbose");

/* ---------------------------------------------------------------- colour ---- */

function oklchToLinear(L, C, H) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** Returns linear-light RGB in 0..1, clamped into sRGB. */
function linearRgb({ L, C, H }) {
  return oklchToLinear(L, C, H).map(clamp01);
}

function outOfGamut({ L, C, H }) {
  return oklchToLinear(L, C, H).some((v) => v < -0.002 || v > 1.002);
}

function relativeLuminance(linear) {
  const [r, g, b] = linear;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Composites `fg` (which may carry alpha) over an opaque `bg`. */
function composite(fg, bg) {
  const a = fg.alpha ?? 1;
  if (a >= 1) return linearRgb(fg);
  const f = linearRgb(fg);
  const b = linearRgb(bg);
  return f.map((v, i) => v * a + b[i] * (1 - a));
}

function contrast(fg, bg) {
  const l1 = relativeLuminance(composite(fg, bg));
  const l2 = relativeLuminance(linearRgb(bg));
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/* ------------------------------------------------------------------ parse ---- */

const css = readFileSync(CSS, "utf8");

/** Pulls `--name: oklch(...)` declarations out of one top-level rule block. */
function parseBlock(selector) {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`Could not find "${selector} {" in ${CSS}`);
  const open = css.indexOf("{", start);
  let depth = 0;
  let end = open;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = css.slice(open + 1, end);
  const tokens = {};
  const re = /--([\w-]+)\s*:\s*oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)\s*)?\)/g;
  let match;
  while ((match = re.exec(body))) {
    const [, name, L, C, H, alpha] = match;
    tokens[name] = {
      L: Number(L),
      C: Number(C),
      H: Number(H),
      ...(alpha === undefined ? {} : { alpha: Number(alpha) }),
    };
  }
  return tokens;
}

const light = parseBlock(":root");
const dark = { ...light, ...parseBlock(".dark") };

/* ------------------------------------------------------------------ rules ---- */

/** Every opaque surface that body or status text is allowed to land on. */
const SURFACES = ["canvas", "bg", "panel", "panel-header", "surface", "surface-2", "surface-sunken"];
const STATUSES = ["ready", "failed", "warning", "building", "queued", "canceled", "ember"];

/** Every check is `{ fg, bg, min, label }`. 4.5 for text, 3.0 for UI boundaries. */
function buildChecks() {
  const checks = [];

  for (const bg of SURFACES) {
    for (const fg of ["ink", "muted", "subtle"]) {
      checks.push({ fg, bg, min: 4.5, group: "body text" });
    }
  }

  // Status ink must survive both the plain surfaces and its own pill wash.
  // surface-sunken is included because log output is status-coloured text on it.
  for (const status of STATUSES) {
    for (const bg of ["canvas", "bg", "panel", "panel-header", "surface", "surface-sunken"]) {
      checks.push({ fg: `${status}-ink`, bg, min: 4.5, group: "status text" });
    }
    checks.push({ fg: `${status}-ink`, bg: `${status}-soft`, min: 4.5, group: "status pill" });
  }

  // Text sitting on a filled control.
  checks.push({ fg: "ember-fg", bg: "ember", min: 4.5, group: "filled control" });
  checks.push({ fg: "failed-fg", bg: "failed", min: 4.5, group: "filled control" });

  // Non-text UI: focus ring and hairlines need 3:1 against what they separate.
  for (const bg of ["canvas", "bg", "panel", "surface"]) {
    checks.push({ fg: "focus-ring", bg, min: 3, group: "focus ring" });
  }

  return checks;
}

/* ------------------------------------------------------------------- run ---- */

let failures = 0;
let gamutFailures = 0;
const rows = [];

for (const [modeName, tokens] of [
  ["light", light],
  ["dark", dark],
]) {
  for (const { fg, bg, min, group } of buildChecks()) {
    const fgToken = tokens[fg];
    const bgToken = tokens[bg];
    if (!fgToken || !bgToken) {
      console.error(`MISSING  ${modeName}: --${!fgToken ? fg : bg} is not defined`);
      failures++;
      continue;
    }
    const ratio = contrast(fgToken, bgToken);
    const pass = ratio >= min;
    if (!pass) failures++;
    if (!pass || VERBOSE) {
      rows.push(
        `${pass ? "ok  " : "FAIL"}  ${modeName.padEnd(5)} ${ratio.toFixed(2).padStart(6)} (min ${min})  ${fg} on ${bg}  [${group}]`,
      );
    }
  }

  // Values that clip out of sRGB render differently than the maths predicts.
  for (const [name, token] of Object.entries(tokens)) {
    if (token.alpha !== undefined) continue;
    if (outOfGamut(token)) {
      rows.push(`GAMUT ${modeName.padEnd(5)} --${name} is outside sRGB`);
      gamutFailures++;
    }
  }
}

for (const row of rows) console.log(row);

const total = buildChecks().length * 2;
if (failures || gamutFailures) {
  console.error(
    `\n${failures} contrast failure(s), ${gamutFailures} out-of-gamut token(s) across ${total} checks.`,
  );
  process.exit(1);
}
console.log(`\nAll ${total} contrast checks pass, every token inside sRGB.`);
