# WorldSmith Web — Style Guide

This document defines the unified design language, writing conventions, and code patterns for WorldSmith Web. All contributors (human and AI) should follow these rules to keep the project consistent.

---

## 1. CSS Design System

### Variables (defined in `:root`)

| Token         | Value                               | Usage                                   |
| ------------- | ----------------------------------- | --------------------------------------- |
| `--bg`        | `#0f1220`                           | Page background                         |
| `--panel`     | `#171b2e`                           | Panel / card background                 |
| `--text`      | `#e8e9f3`                           | Primary text                            |
| `--muted`     | `#a6abcc`                           | Secondary text, hints, units            |
| `--border`    | `rgba(255,255,255,0.1)`             | Borders, dividers                       |
| `--focus`     | `rgba(126,178,255,0.45)`            | Focus rings, accent highlights          |
| `--good`      | `#7cffb2`                           | Positive status (badges, indicators)    |
| `--warn`      | `#ffd37c`                           | Warning status                          |
| `--bad`       | `#ff7c97`                           | Error / danger status                   |
| `--radius`    | `16px`                              | Primary border-radius (panels)          |
| `--radius-sm` | `12px`                              | Secondary border-radius (inputs, cards) |
| `--pad`       | `16px`                              | Standard padding                        |
| `--gap`       | `16px`                              | Standard grid/flex gap                  |
| `--mono`      | `ui-monospace, SFMono-Regular, ...` | Code, readouts, numeric values          |
| `--sans`      | `ui-sans-serif, system-ui, ...`     | Body text, labels                       |

Always use tokens instead of hard-coded colours or sizes. If a new semantic colour is needed, add a variable rather than inlining a value.

### Class naming

BEM-lite: `block__element` for structural children, `.is-state` for boolean states.

```
.panel              → block
.panel__header      → structural child
.panel__body        → structural child
.is-active          → boolean state modifier
.dd-suggest-item--alt → variant modifier (double-dash)
```

Avoid deep nesting. One level of `__` is the maximum. Use `--variant` for visual alternatives.

### Component inventory

| Component       | Class(es)                                                   | Purpose                                           |
| --------------- | ----------------------------------------------------------- | ------------------------------------------------- |
| Panel           | `.panel`, `.panel__header`, `.panel__body`, `.panel__title` | Primary container with header/body split          |
| KPI card        | `.kpi`, `.kpi__label`, `.kpi__value`, `.kpi__meta`          | Single-stat display in `.kpi-grid`                |
| Form row        | `.form-row`                                                 | Label + input on a 2-column grid (`1fr 140px`)    |
| Label           | `.label`                                                    | Bold field/section label (600 weight)             |
| Hint            | `.hint`                                                     | Muted helper text below a label (12px, `--muted`) |
| Unit            | `.unit`                                                     | Inline unit suffix (12px mono, `--muted`)         |
| Derived readout | `.derived-readout`                                          | Read-only monospace output block                  |
| Badge           | `.badge`, `.badge.good/.warn/.bad`                          | Status pill with semantic colour                  |
| Button row      | `.button-row`                                               | Horizontal button group (flex, gap)               |
| Subsection      | `.subsection`, `.subsection__title`                         | Grouped block within a panel body                 |
| Input pair      | `.input-pair`                                               | Number + range slider stack                       |
| Tooltip         | `.tip-icon` + `.tooltip-bubble`                             | Info icon that shows a popup on hover             |

### Responsive

Single breakpoint: `@media (max-width: 980px)` switches `.grid-2` from 2-column to 1-column.

### KPI cards

KPI cards display single-stat readouts inside a `.kpi-grid` (2-column CSS grid, `10px` gap). Every KPI is wrapped in a `.kpi-wrap` container that holds the grid slot while the inner card lifts out on hover.

#### HTML structure

```html
<div class="kpi-grid">
  <div class="kpi-wrap">
    <div class="kpi">
      <div class="kpi__label">Label ${tipIcon(TIP_LABEL["Label"])}</div>
      <div class="kpi__value">42</div>
      <div class="kpi__meta">Extra detail shown on hover</div>
    </div>
  </div>
</div>
```

#### Layout mechanics

| Element       | Role                                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| `.kpi-wrap`   | Grid item. `position: relative; min-height: 68px`. Holds the slot when the card lifts out.            |
| `.kpi`        | Flex column card. Opaque background (`#1e2133`), `border-radius: 14px`, `padding: 10px 12px`.         |
| `.kpi__label` | Muted 11px label text.                                                                                |
| `.kpi__value` | Bold 16px value with `margin-top: 4px` (not flex `gap` — avoids phantom spacing from collapsed meta). |
| `.kpi__meta`  | Hidden at rest (`max-height: 0; overflow: hidden; opacity: 0`). Revealed on hover inside the card.    |

#### Expand-on-hover behaviour

Cards with non-empty `.kpi__meta` expand when hovered:

1. A chevron indicator (`▾`, 13px, 0.55 opacity) appears after the label via `::after` on `.kpi__label`.
2. On `.kpi-wrap:hover`, the `.kpi` lifts to `position: absolute` (top/left/right: 0, `z-index: 10`) — overlays neighbours without pushing content.
3. `.kpi__meta` animates open (`max-height: 200px`, `padding-top: 6px`, `opacity: 1`) with a 0.2s transition.
4. On mouse-leave, closing is **instant** (no transition on the base state) to prevent layout shift.

The card itself grows as one unit — meta inherits the card's background, borders, and gradients seamlessly.

#### Variants

| Modifier                 | Usage                                                                                        | Notes                                                                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.kpi--colour`           | Colour swatch cards (sky, vegetation, star colour).                                          | Sets `--kpi-colour`, `--kpi-colour-center`, `--kpi-colour-edge` via inline `style`. Border: `rgba(0,0,0,0.12)`.                                                                        |
| `data-gradient="radial"` | Sky colour "dome" gradient (centre → edge).                                                  | Adds `::before`/`::after` pseudo-elements for specular highlight and vignette. `overflow: hidden` clips them.                                                                          |
| `data-gradient="linear"` | Vegetation gradient (pale → deep, left to right).                                            | Simple `linear-gradient(to right, ...)`.                                                                                                                                               |
| `data-horizon="1"`       | Low-sun sky variant.                                                                         | Overrides the radial gradient to use darker centre + warm rim. Disables `::before`/`::after` overlays.                                                                                 |
| `data-light="0\|1"`      | Contrast-aware text. `0` = dark background (light text), `1` = light background (dark text). | Computed via `relativeLuminance(hex) > 0.18` threshold. Affects label, value, meta, tip-icon, chevron, and veg-details-btn colours.                                                    |
| `.kpi--preview`          | Gas giant appearance card.                                                                   | Fixed `height: 68px; overflow: hidden` at rest (centre-crops the canvas). On hover: `height: auto; overflow: visible`. Label uses `text-shadow` for readability over the planet image. |

#### Label length

Keep labels short enough that the label text + tooltip icon + chevron fit on a single line. Wrapping increases card height and misaligns the grid row. Prefer concise labels (e.g. "Sky Colour (Low Sun)" not "Sky Colour (Sun Near Horizon)").

---

## 2. Tooltip Writing Style

Every page defines a `TIP_LABEL` dictionary mapping label strings to tooltip text. The `tipIcon(text)` helper renders an `(i)` icon; `attachTooltips(root)` wires up hover behaviour.

### Structure

Each tooltip follows a **three-part pattern** (not all parts are required):

1. **Definition** (1–2 sentences) — What the field is and what it controls.
2. **Context** (0–2 sentences) — Real-world analog, valid ranges, or how it interacts with other fields.
3. **Reference line** (optional) — Unit conversion and/or citation.

Separate conceptual blocks with `\n\n` inside the string.

### Rules

| Rule                 | Do                                                                       | Don't                                |
| -------------------- | ------------------------------------------------------------------------ | ------------------------------------ |
| **Units**            | Always explicit, space before unit: `1 Msol`, `5,776 K`                  | `1Msol`, `5776K`                     |
| **Unit conversions** | Include on the reference line: `"Our sun = 1 Lsol = 3.846E26 watts"`     | Omit conversions for common units    |
| **Notation**         | Plain-text exponents: `L = M^4`, `10^(2*[Fe/H])`                         | Unicode superscripts (`M⁴`) or LaTeX |
| **Abbreviations**    | Spell out on first use: `"mean-motion resonance (MMR)"`                  | Abbreviation without expansion       |
| **Ranges**           | Use en-dash `\u2013` for numeric ranges: `0.1\u20133.5 MEarth`           | Hyphen for ranges                    |
| **Arrows**           | Use `\u2192` for resonance transitions: `3:2 \u2192 2:1`                 | `->` or `→` literal in source        |
| **Tone**             | Technical, pedagogical, declarative                                      | Casual, first-person, speculative    |
| **Citations**        | `"Author et al. (Year, Journal Vol, Page)"` for key algorithms           | Bare URLs or no attribution          |
| **Length**           | 1–4 sentences for simple fields; up to ~150 words for complex algorithms | Single-word tooltips or essay-length |

### Template

```js
"Field Name":
  "What it is and what it does (1–2 sentences)."
  + "\n\nContext: valid range, real-world analog, or interaction with other fields."
  + "\n\nReference: Unit = conversion. Source: Author (Year).",
```

### Examples

**Good — concise field:**

```js
"Inner edge":
  "Inner boundary of the debris disk in AU. In resonance-sculpted disks, this is set by interior mean-motion resonances (e.g. 4:1, 2:1) with the nearest gas giant.",
```

**Good — algorithm with citation:**

```js
"Luminosity":
  "Derived from mass using the Eker et al. (2018, MNRAS 479, 5491) six-piece empirical relation, calibrated from 509 eclipsing binary stars. Replaces the classical textbook L = M^4 approximation, which overestimated K-dwarf luminosities by 30\u201385%.\n\nOur sun = 1 Lsol = 3.846E26 watts",
```

**Good — multi-part with ranges:**

```js
"Mass":
  "Planet mass in Earth masses.\n\nTerrestrial planets: 0.1\u201310 MEarth.\nHabitable Earth-like planets: 0.1\u20133.5 MEarth.\n\nEarth = 1 MEarth = 5.972E24 kg",
```

---

## 3. Changelog Style

`CHANGELOG.md` lives at the project root. All notable changes go here, grouped by version.

### Version headers

```markdown
## Unreleased (post-X.Y.Z) ← work in progress

## X.Y.Z — YYYY-MM-DD ← released version
```

Use semantic versioning: major (breaking data model changes), minor (new features), patch (bug fixes).

### Feature entries

Each feature gets an `### H3` heading, then one or more **bold sub-headings** scoped to the affected files:

```markdown
### Feature Title

**What changed** (engine/file.js, ui/page.js)

1–3 paragraphs explaining the change: what was wrong or missing, what the new
behaviour is, and why it matters. Quantify impact where possible (e.g.
"error drops from +8% to +2%").

Tables are encouraged for structured data (e.g. mass–luminosity segments,
resonance constants).

**Tests** (tests/file.test.js)

- Bullet list of new or updated tests

**References**

- Author, A. B. & Author, C. D. (Year), "Title", Journal Vol, Pages
```

### Rules

| Rule               | Convention                                                                              |
| ------------------ | --------------------------------------------------------------------------------------- |
| **Scope tags**     | Parenthetical after bold heading: `(engine/star.js, ui/starPage.js)`                    |
| **Tone**           | Technical, third-person, past tense for completed work: "Replaced…", "Added…", "Fixed…" |
| **Quantification** | Include before/after numbers when correcting accuracy: "overestimated by 30–85%"        |
| **Citations**      | Full academic style at end of feature block under `**References**`                      |
| **Tables**         | Use for structured data (segments, constants, mappings)                                 |
| **Test notes**     | Always document new/changed tests under `**Tests**` sub-heading                         |
| **Bug fixes**      | Use `### Bug Fixes` (H3) with bullet list if multiple small fixes in one release        |
| **Line width**     | Wrap prose at ~80 characters for readability in plain-text editors                      |

---

## 4. Engine Code Conventions

Engine modules live in `engine/` and are pure ESM (Node globals only, no browser APIs). They are the single source of truth for all calculations.

### File header

Each engine file starts with a block comment describing the module, its methodology, and its inputs/outputs:

```js
// Planet model (spreadsheet-faithful port)
// Implements the PLANET sheet logic as closely as possible.
//
// Inputs follow the original model (only user-editable fields
// are exposed in the UI). Star mass comes from the Star tab
// (shared world model).
```

For algorithmic functions, use JSDoc with `@param` / `@returns` and cite the source:

```js
/**
 * Converts effective temperature (K) to a hex colour string
 * using Tanner Helland's empirical blackbody approximation
 * (valid 1000–40000 K, R^2 > 0.987).
 *
 * Algorithm: tannerhelland.com/2012/09/18/...
 *
 * @param {number} tempK - Effective temperature in Kelvin
 * @returns {string} Hex colour string (#RRGGBB)
 */
```

Self-evident utility functions (`clamp`, `toFinite`, `round`) do not need JSDoc.

### Return shape

Calculator functions return a structured object with up to three tiers:

```js
return {
  inputs: { massMsol, ageGyr },        // echoed back for reference
  star: { luminosityLsol, tempK },     // derived numeric values
  display: { luminosity: fmt(...) },   // pre-formatted strings for UI
};
```

- **`inputs`** — echo of clamped/normalised inputs so the UI can display what the engine actually used.
- **Derived tier** (name varies: `star`, `planet`, `moon`, etc.) — intermediate numeric results for downstream calculations.
- **`display`** — formatted strings ready for rendering. Use `fmt()` from `engine/utils.js`.

### Naming

| Convention     | Example                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------- |
| **Parameters** | camelCase with unit suffix: `massMsol`, `ageGyr`, `tempK`, `radiusRsol`, `luminosityLsol` |
| **Constants**  | UPPER_SNAKE at module top: `const RES_3_2 = Math.pow(3 / 2, 2 / 3)`                       |
| **Exports**    | Named exports only: `export function calcStar(...)`                                       |
| **Imports**    | Relative paths with `.js` extension: `import { toFinite } from "./utils.js"`              |

### Shared utilities

`engine/utils.js` owns the following — never duplicate them locally:

- `clamp(n, min, max)` — bounded numeric value
- `toFinite(n, fallback)` — safe `Number()` with fallback for NaN/Infinity
- `round(n, dp)` — round to `dp` decimal places (default 3)
- `fmt(n, dp)` — locale-formatted string (`en-US`, dot decimal, comma thousands)

### Magic numbers

Document inline or define as named constants:

```js
// Good: named constant with comment
const RES_2_1 = Math.pow(2 / 1, 2 / 3); // 2:1 MMR semi-major axis ratio

// Good: inline with source comment
const frost = 4.85 * Math.sqrt(sLum); // Hayashi (1981) frost line

// Bad: unexplained literal
const x = val * 1.5874;
```

---

## 5. Store & Data Model

`ui/store.js` owns all persistent state. It reads/writes to `localStorage` under a versioned key (`worldsmith.world.v1`) and exposes a clean API for the rest of the UI.

### Schema versioning

```js
const SCHEMA_VERSION = 37; // bump on any breaking world-model change
```

When the schema changes, add a migration block inside `migrateWorld()` that transforms old data to the new shape. Never silently drop fields — migrate or delete explicitly.

### Function naming

| Prefix                | Purpose                     | Example                                    |
| --------------------- | --------------------------- | ------------------------------------------ |
| `load*`               | Read from store             | `loadWorld()`                              |
| `update*`             | Merge partial changes       | `updateWorld({ star: { massMsol: 1.2 } })` |
| `save*`               | Write a specific collection | `saveSystemDebrisDisks(disks)`             |
| `list*`               | Return array of items       | `listPlanets(world)`                       |
| `get*`                | Single item (nullable)      | `getSelectedPlanet(world)`                 |
| `create*` / `delete*` | Add or remove an item       | `createPlanet()`, `deleteMoon(id)`         |
| `select*` / `toggle*` | Change selection state      | `selectPlanet(id)`                         |
| `assign*`             | Link items together         | `assignPlanetToSlot(planetId, slotIndex)`  |
| `normalize*`          | Sanitise raw input          | `normalizeGasGiant(raw, idx)`              |

### Normalisation pattern

Every entity type has a `normalize*` function that coerces raw input (from import, preset, or user entry) into a valid shape:

```js
function normalizeGasGiant(raw, idx = 1) {
  const au = Number(raw?.au ?? raw?.semiMajorAxisAu); // alias support
  const fixedAu = Number.isFinite(au) && au > 0 ? au : 0;
  return {
    id: String(raw?.id || `gg${idx}`),
    name: String(raw?.name || `Gas giant ${idx}`),
    au: fixedAu,
    // ... more fields with safe defaults
  };
}
```

Rules:

- Always use `Number.isFinite()` before using a numeric value.
- Support legacy field aliases via `??` fallback: `raw?.au ?? raw?.semiMajorAxisAu`.
- Default IDs use prefix + counter: `gg1`, `dd1`, `planet1`.
- Boolean fields default to `false` unless explicitly `true`.

### Collection shape

Ordered collections use a two-part structure for predictable ordering plus fast lookup:

```js
{ order: ["gg1", "gg2"], byId: { gg1: {...}, gg2: {...} } }
```

### Exported constants

Bounds and step values are exported so the UI can share them for sliders and validation:

```js
export const GAS_GIANT_RADIUS_MIN_RJ = 0.35;
export const GAS_GIANT_RADIUS_MAX_RJ = 2.14;
export const GAS_GIANT_RADIUS_STEP_RJ = 0.01;
```

---

## 6. UI Page Structure

Page controllers live in `ui/` (browser globals). Each file exports a single `init*Page(containerEl)` function that owns one page's lifecycle.

### File anatomy

```js
import { loadWorld, updateWorld } from "./store.js";
import { calcStar } from "../engine/star.js";
import { tipIcon, attachTooltips, escapeHtml, fmt } from "./uiHelpers.js";

const TIP_LABEL = {
  // ── Inputs ──
  "Field Name": "Tooltip text following Section 2 rules.",
  // ── Outputs ──
  "Derived Field": "Tooltip text.",
};

export function initStarPage(containerEl) {
  // 1. Cache DOM references
  const inputsEl = containerEl.querySelector("#starInputs");
  const outputsEl = containerEl.querySelector("#starOutputs");

  // 2. Local state (not persisted)
  let hydrating = false;

  // 3. Render function
  function render() { ... }

  // 4. Event listeners (inside init, after first render)
  render();
}
```

### HTML layout

Every page follows a two-column grid: inputs on the left, outputs on the right.

```html
<div class="page">
  <!-- Header panel -->
  <div class="panel">
    <div class="panel__header">
      <h1 class="panel__title">
        <span class="ws-icon icon--star"></span>
        <span>Star</span>
      </h1>
      <div class="badge">Interactive tool</div>
    </div>
    <div class="panel__body">
      <div class="hint">Brief page description.</div>
    </div>
  </div>

  <!-- Two-column content -->
  <div class="grid-2">
    <div class="panel">
      <div class="panel__header"><h2>Inputs</h2></div>
      <div class="panel__body" id="starInputs">
        <!-- form-rows, labels, hints, input-pairs -->
      </div>
    </div>
    <div class="panel">
      <div class="panel__header"><h2>Outputs</h2></div>
      <div class="panel__body" id="starOutputs">
        <div class="kpi-grid" id="kpis"></div>
        <div class="derived-readout" id="details"></div>
      </div>
    </div>
  </div>
</div>
```

### Render cycle

1. Read world state: `const world = loadWorld()`
2. Run engine: `const model = calcStar({ ... })`
3. Build HTML strings and assign to `innerHTML`
4. Call `attachTooltips(containerEl)` after each render
5. Wire event listeners (set `hydrating = true` during programmatic input updates to avoid save loops)

### Button conventions

| Button         | Class           | Label verb             | Usage                               |
| -------------- | --------------- | ---------------------- | ----------------------------------- |
| Primary action | `.primary`      | "Apply"                | Commit input changes                |
| Preset         | (default)       | "Sol preset" / "Reset" | Load known configuration            |
| Danger         | `.small.danger` | "Remove" / "Delete"    | Destructive action on a single item |
| Add            | `.small`        | "Add" / "New"          | Create a new item in a collection   |

### Event listener pattern

Listeners are attached after `render()` inside the `init*` function. Use delegation where possible:

```js
containerEl.addEventListener("input", (e) => {
  if (hydrating) return; // skip programmatic updates
  const el = e.target;
  if (el.id === "starMass") {
    updateWorld({ star: { massMsol: Number(el.value) } });
    render();
  }
});
```

For dynamically rendered collections (gas giants, debris disks, moons), re-attach listeners inside the render function after setting `innerHTML`, guarded by `hydrating`.

---

## 7. Testing Conventions

Tests live in `tests/` and run under Node's built-in `node:test` runner. Test files need both Node and browser globals (jsdom is used for UI tests).

### File naming

```
tests/<module>.test.js      ← mirrors engine/<module>.js or ui/<module>.js
```

### Test structure

```js
import test from "node:test";
import assert from "node:assert/strict";
import { calcStar } from "../engine/star.js";

test("descriptive name: input → expected outcome", () => {
  const result = calcStar({ massMsol: 1.0, ageGyr: 4.6 });
  assert.ok(result.star.luminosityLsol > 0.9 && result.star.luminosityLsol < 1.1);
});
```

### Naming convention

Test names follow the pattern: **subject → condition → expected result**.

```
"sun-like star returns corrected habitable zone values"
"1 gas giant → all zones returned; contiguous ones marked not recommended"
"orbital period scales with semi-major axis (Kepler's third law)"
```

Use arrow `→` (unicode `\u2192` or plain `->` in test names) to separate input from expectation.

### Assertion patterns

| Pattern                  | When to use                                        |
| ------------------------ | -------------------------------------------------- |
| `assert.equal(a, b)`     | Exact match (strings, integers, booleans)          |
| `assert.ok(cond, msg)`   | Range checks, boolean conditions                   |
| `approxEqual(a, b, tol)` | Floating-point comparisons (define helper locally) |
| `assert.throws(fn)`      | Expected errors                                    |

Define `approxEqual` as a local helper when needed:

```js
function approxEqual(actual, expected, tolerance = 0.05) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance * Math.abs(expected),
    `${actual} not within ${tolerance * 100}% of ${expected}`,
  );
}
```

### What to test

| Category            | Example                                                                 |
| ------------------- | ----------------------------------------------------------------------- |
| **Baseline values** | "Jupiter density ~1.33 g/cm^3" — anchor against known real-world data   |
| **Edge cases**      | "zero input", "NaN input", "negative values" — verify graceful handling |
| **Monotonicity**    | "brighter star → planet appears brighter" — directional correctness     |
| **Continuity**      | "MLR continuous across segment boundaries" — no discontinuities         |
| **Round-trip**      | "export → import preserves data" — serialisation fidelity               |
| **Regression**      | Named after the bug: "contiguous zones filtered by <= not <"            |

### npm scripts

| Script                | What it runs                                       |
| --------------------- | -------------------------------------------------- |
| `npm test`            | Full test suite (`node --test tests/**/*.test.js`) |
| `npm run test:engine` | Engine tests only (explicit file list, no UI deps) |
| `npm run check`       | Syntax check + ESLint + Prettier + full test suite |
| `npm run format`      | Prettier `--write` on all files                    |

Always run `npm run check` before considering work complete. All tests must pass, and there must be zero lint or formatting errors.

---

## 8. Release Announcement (Discord)

When a new version ships, post a short announcement in Discord. Follow this format:

### Template

```
# **WorldSmith Web vX.Y.Z** is live! https://thebrokenwheel.co.uk/worldsmith/

## **Feature Name** — 1–2 sentence summary of the feature and why it matters.
## **Feature Name** — 1–2 sentence summary.
## **Feature Name** — 1–2 sentence summary.
```

### Rules

| Rule              | Convention                                                                    |
| ----------------- | ----------------------------------------------------------------------------- |
| **Opening line**  | Bold version string + "is live!" + live URL                                   |
| **Feature lines** | Bold feature name + em dash + concise description (1–2 sentences max)         |
| **Tone**          | Excited but factual — highlight what users can do, not implementation details |
| **Length**        | 3–6 feature lines; keep the whole post under ~200 words                       |
| **Formatting**    | Discord markdown: `# **bold**` for headings, `## **bold**` for features       |
| **Order**         | Biggest / most visible change first                                           |
| **No changelogs** | This is a highlight reel — point users to the About page for full details     |
