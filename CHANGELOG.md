# Changelog

All notable changes to WorldSmith Web will be documented in this file.

## 1.15.0 — 2026-03-02

### Tectonics Phase 2 — Science Enhancements

**New engine functions** (engine/tectonics.js)

Added eight new exported functions with full scientific references:
`spreadingRate`, `volcanicArcDistance`, `airyRootDepth`, `prattDensity`,
`continentalMarginProfile`, `maxShieldHeight`, `shieldVolcanoProfile`,
`riftProfile`. Extended `calcTectonics()` to compute all new features.

New constants: crustal/mantle densities (Turcotte & Schubert 2014),
slab depth 110 km (Syracuse & Abers 2006), shield volcano reference
10 km (McGovern & Solomon 1993/1998), spreading rate ranges
(Dalton et al. 2022).

**New UI features** (ui/tectonicsPage.js)

- Seafloor spreading rate slider with regime-dependent range and KPI
- Slab angle slider per Andean/Laramide range with volcanic arc
  distance marker on cross-section canvas
- Isostasy toggle (Off / Airy / Pratt) with root polygon and
  density-zone visualisations on the cross-section
- Continental margin canvas with shelf/slope/rise/abyssal zones
  and adjustable shelf width, depth, and slope angle
- Shield volcano subsection with height/slope cards and profile
  canvases; max shield height KPI scales with 1/g
- Rift valley subsection with add/remove cards, graben
  width/depth/fault angle inputs, and profile canvases

**Store** (ui/store.js)

Schema version bumped from 47 to 48. New fields: `spreadingRateFraction`,
`isostasyMode`, `margin`, `shieldVolcanoes`, `riftValleys`, `plates`,
`plateTimeMyr`. Migration adds `slabAngleDeg: 45` to existing mountain
ranges.

**Tests** (tests/tectonics.test.js)

- ~35 new tests covering all Phase 2 functions (68 total, all passing)

**References**

- Turcotte, D. L. & Schubert, G. (2014), Geodynamics, Ch. 2
- Syracuse, E. & Abers, G. (2006), G³, 7
- McGovern, P. J. & Solomon, S. C. (1993, 1998), JGR
- Dalton, C. A. et al. (2022), GRL

### Tectonics Phase 3 — Interactive Plate Canvas

**New engine** (engine/plates.js)

Spherical Voronoi tessellation via 3D incremental convex hull (dual
graph). Functions: `latLonToXYZ`, `xyzToLatLon`, `convexHull3D`,
`sphericalVoronoi`, `rotateAroundPole`, `classifyBoundaryWithSeeds`,
`calcPlates`. Rigid kinematic plates with Euler pole rotation and
convergent/divergent/transform boundary classification.

**New UI** (ui/tectonicsPage.js)

Full-width plate canvas panel below the existing two-column grid:

- Equirectangular projection (Plate Carrée) with lat/lon grid
- Click to place plate seeds (up to 20), drag to reposition,
  right-click to toggle continental/oceanic type
- Colour-coded cells (warm tones = continental, blues = oceanic)
- Boundary lines: red = convergent, blue = divergent,
  green = transform
- Timeline slider (0–500 Myr) with live redraw
- Earth preset (8 major plates with approximate Euler poles)
- Plate summary table with type toggle and remove buttons

**Tests** (tests/plates.test.js)

- 20 new tests: coordinate transforms, convex hull, Voronoi cells,
  Euler rotation, boundary classification, calcPlates integration

### Science & Maths Page — Tectonics Section

**New section** (ui/sciencePage.js)

Added "Tectonics & Geodynamics" section with 11 formulas:
maximum mountain height (Weisskopf 1975), ocean subsidence (PSM 1977),
Airy/Pratt isostasy (Turcotte & Schubert 2014), volcanic arc distance
(Syracuse & Abers 2006), linear erosion, spreading rate categories
(Dalton et al. 2022), shield volcano scaling (McGovern & Solomon),
continental margin dimensions, and tectonic regime probabilities.

Interactive calculator: gravity slider → max mountain height + max
shield volcano height + Airy root depth.

Moved tectonic regime probability formula from Interior & Composition
into the new section. Added 3 new divergence entries (ocean subsidence
intersection constant, shield volcano 1/g scaling, continental margin
fixed dimensions).

### Science & Maths Page — Complete Formula Audit

Cross-referenced all 14 engine modules against the Science & Maths
page and expanded coverage from 12 sections / ~108 equations to
18 sections / ~160 equations.

**6 new sections** (ui/sciencePage.js)

- **Stellar Evolution** (7 formulas) — metallicity conversion,
  ZAMS luminosity/radius (Tout et al. 1996), main-sequence lifetime
  (Hurley 2000), terminal-age luminosity/radius, evolved L/R
  parametric tracks.
- **Gas Giant Physics** (12 formulas) — Chen & Kipping mass-radius,
  Sudarsky classification, Lodders & Fegley cloud condensation
  layers, Thorngren & Fortney atmospheric metallicity,
  mass-dependent internal heat ratio, Christensen dipole scaling,
  Rhines atmospheric dynamics, Darwin-Radau oblateness, Ribas XUV
  mass loss, Thorngren core mass, Fortney radius inflation,
  Gaussian ring model.
- **Lagrange Points** (4 formulas) — Hill sphere, L1/L2, L3,
  L4/L5 equilateral points.
- **Climate Classification** (7 formulas) — temperature at
  latitude with equator-pole gradient, seasonal amplitude,
  three-zone moisture index, Köppen decision tree (E/B/A/D/C),
  tidally locked substellar/terminator/antistellar zones,
  environmental lapse rate.
- **Population Dynamics** (5 formulas) — ocean fraction by water
  regime, latitude-weighted habitability fraction, tech-era
  carrying capacity with crop efficiency scaling, Verhulst
  logistic growth, Zipf rank-size distribution.
- **Debris Disks** (9 formulas) — mean-motion resonance positions,
  Lodders condensation sequence, dust equilibrium temperature,
  Wyatt fractional luminosity, blowout grain size, PR drag
  timescale, collisional lifetime, Wisdom chaotic zone, Planck
  IR excess at 24 μm.

**4 sections expanded** (ui/sciencePage.js)

- **Tectonics & Geodynamics** (+4 formulas, 14 total) — added
  composition-dependent peak heights table, elastic lithosphere
  thickness, volcanic activity index, climate-adjusted erosion
  scaling.
- **Stellar Activity** (+2 formulas, 7 total) — added N₃₂
  reference table with age-band boundaries per spectral bin,
  flare cycle multiplier ranges (FGK/early-M/late-M).
- **Local Cluster** (+1 formula, 7 total) — added metallicity
  gradient model (radial −0.06 dex/kpc, vertical −0.30 dex/kpc)
  and per-class multiplicity fractions table (O through L/T/Y).
- **Interior & Composition** (+2 formulas, 7 total) — added
  composition classification thresholds (WMF/CMF → class label)
  and mantle outgassing oxidation states (Ortenzi et al. 2020).

**Fixes** (ui/sciencePage.js)

- Replaced stale CME Association Probability table. Old values
  (0.2/0.5/0.8/0.95) did not match engine truth; corrected to
  0.005/0.12/0.4/0.75 at energy breaks 10³²/10³³/10³⁴ erg,
  matching `stellarActivity.js`.
- Corrected equation counts in SECTIONS array: Planetary Physics
  11 (was 12), Orbital Mechanics 13 (was 11).

**6 new divergence entries** (ui/sciencePage.js)

- Gas giant internal heat ratio ramps (WS-derived)
- Gas giant ring mass Gaussian model (WS-derived)
- Gas giant oblateness MOI interpolation (WS-derived)
- Population tech era density/growth tables (WS-derived)
- Climate moisture index zone model (WS-derived)
- Climate tidally-locked temperature model (WS-derived)

**References**

- Chen, J. & Kipping, D. (2017), ApJ 834
- Christensen, U. R. (2009), Space Sci. Rev. 152
- Fortney, J. J. et al. (2007), ApJ 659
- Hurley, J. R. et al. (2000), MNRAS 315
- Lodders, K. (2003), ApJ 591
- Lodders, K. & Fegley, B. (2002), Icarus 155
- Luck, R. E. & Lambert, D. L. (2011), AJ 142
- Ortenzi, G. et al. (2020), Sci. Rep. 10
- Ribas, I. et al. (2005), ApJ 622
- Schlesinger, K. J. et al. (2014), ApJ 791
- Thorngren, D. P. & Fortney, J. J. (2019), ApJL 874
- Thorngren, D. P. et al. (2016), ApJ 831
- Tout, C. A. et al. (1996), MNRAS 281
- Wyatt, M. C. (2007), ApJ 663
- Yashiro, S. et al. (2006), ApJL 650

### Tooltip Audit & Style Guide Compliance

**Full tooltip review** (ui/\*.js)

Audited all page controllers for style guide compliance. Rewrote
tooltips across moonPage, outerObjectsPage, and visualizerPage to
use declarative tone, Unicode units (g/cm³, m/s²), and correct
reference names ("Sun" not "Sol", "Moon" not "Our Moon"). Added
missing tipIcon calls on visualiser download buttons. Removed all
imperative verbs ("Choose", "Select", "Set") in favour of
declarative phrasing.

Added ~80 new tooltips across tectonicsPage, climatePage, and
populationPage covering all previously undocumented inputs and
outputs.

### Preset Schema Compliance

**Updated all presets to schema version 51** (ui/solPreset.js,
ui/realmspacePreset.js, ui/arrakisPreset.js)

All three presets (Sol, Realmspace, Arrakis) updated from version
44 to 51 with the following additions:

- Star: `evolutionMode`, `activityModelVersion`
- Gas giants: explicit `style` and `rings` fields (Saturn gets
  rings; Uranus/Neptune/Revona get "neptune" style)
- Planets: `wmfPct`, `tectonicRegime`, `mantleOxidation`,
  `greenhouseMode` where missing
- Moons: `compositionOverride: null` on all moon inputs
- Top-level: `clusterAdjustments` collection

**Data corruption fix** — Venus (Sol) and Toril (Realmspace) had
`cmfPct: 32.0`, which the v43 migration silently converts to −1
(auto). Changed Venus to 31.17% and Toril to 33.0% to preserve
intended values.

**Tectonic regime fix** — The v42 migration unconditionally
converts `"mobile"` to `"auto"`. Changed Earth and Toril presets
to use `"auto"` directly to match post-migration state.

### Import/Export Improvements

**Extended import summary** (ui/importExportPage.js)

The import preview now shows all nine world sections: Star,
Planets, Moons, Gas Giants, Debris Disks, Tectonics (with range/
volcano/rift/inactive counts), Population (tech era), Climate
(altitude), and Calendar (present/absent).

**Fixed default world** (ui/store.js)

Added missing `climate: { altitudeM: 0 }` to `defaultWorld()`.
Without this, a fresh install (no localStorage) returned a world
object missing the climate section, causing the Climate page to
fail on first load.

### Build Fix

**GIF encoder path resolution** (ui/canvasExport.js)

Changed `new URL("../assets/vendor/gif.js", import.meta.url)` to
page-relative string `"./assets/vendor/gif.js"`. The old pattern
resolved correctly in development but escaped the `dist/` root
after esbuild bundling, breaking GIF export in production builds.

## 1.14.0 — 2026-02-28

### Bug Fixes

- Unified Visualiser cluster mode now renders from canvas
  backing-store dimensions (instead of client dimensions), removing
  fractional bottom-edge artifact strips on large/high-DPR canvases.
- Cluster star rendering now culls fully off-canvas glows/companion
  dots to prevent clipped edge speckling at the canvas border.
- System Poster and Apparent Sky canvases now use the same
  `ceil + backing-store` sizing path, preventing sub-pixel underpaint
  rows in normal and fullscreen layouts.
- Lagrange/Hill display toggles now trigger an immediate visualiser
  redraw instead of waiting for the next animation frame.
- Focus camera follow now couples pan with zoom ratio when
  selecting/focusing bodies, removing the brief snap toward the host
  star.
- In System Poster fullscreen mode, the hide/show poster control is
  now disabled and visibly greyed out for consistent behaviour.
- Gas giant atmospheric metallicity now defaults to the mass-derived
  Thorngren relation scaled by host-star metallicity (`10^[Fe/H]`)
  when left blank, while manual metallicity overrides remain unchanged.
- Debris disk composition now includes stellar metallicity influence:
  condensed-species weighting and ice-to-rock ratio are modulated by
  host-star `[Fe/H]` while retaining temperature-driven condensation
  presence and class labels.
- Planet and moon Appearance KPI preview cards now hide Recipes and
  Pause buttons when collapsed, preventing the buttons from pushing
  the canvas downward. Buttons reappear on hover or focus-within.
- Gas giant preview materials now use a fully matte PBR finish
  (roughness 1.0, metalness 0, clearcoat 0), removing the glossy
  specular highlight that was inconsistent with gas giant appearance
  at planetary scales.

**Tests** (tests/debrisDisk.test.js, tests/gasGiant.test.js)

- 2 new tests: metal-poor stars increase debris disk ice/rock ratio
  while metal-rich decrease it; composition class stays
  temperature-driven across metallicity extremes.
- 1 new test: gas giant derived atmospheric metallicity scales with
  host-star `[Fe/H]` when metallicity input is blank.

### Rendering Platform

**Three.js native rendering pipeline**
(ui/celestialVisualPreview.js, ui/celestialComposer.js,
ui/celestialArtProfiles.js, ui/threeNativePreview.js,
ui/threeBridge2d.js, ui/threeRenderAssetMap.js,
ui/apparentSkyNativeThree.js, ui/systemPosterNativeThree.js,
ui/celestialTextureWorker.js, ui/celestialTextureWorkerClient.js,
ui/starVisualPreview.js, ui/visualizerPage.js, ui/systemPage.js,
ui/apparentPage.js, ui/planetPage.js, ui/moonPage.js,
ui/gasGiantStyles.js, ui/rockyPlanetStyles.js, ui/moonStyles.js)

Completed a full migration from Canvas2D to native Three.js WebGL
rendering across all major render surfaces: the Unified Visualiser
system view, System Poster, Apparent Sky comparison, and all body
preview canvases.

- Added a lazy-loading Three.js bridge (`ui/threeBridge2d.js`) for CDN
  import (v0.170.0) with retry on failure.
- Migrated rocky/gas/moon preview and recipe canvases to native Three
  shader/material previews (`ui/threeNativePreview.js`) with a custom
  `ShaderMaterial` implementing UV-mapped texture, diffuse lighting,
  rim lighting, ambient term, and alpha transparency.
- Added generated 3D-render asset pipeline
  (`scripts/generate-three-render-assets.mjs`) producing SVG sprites
  for 8 star, 17 gas giant, 19 rocky, 17 moon, and 6 debris disk
  variants under `assets/three-renders/`, with an asset-map module
  (`ui/threeRenderAssetMap.js`) for runtime lookup.
- Promoted the star-only preview runtime into a unified
  `ui/celestialVisualPreview.js` controller with compatibility
  re-export from `ui/starVisualPreview.js`. Supports `attach/detach`,
  `setPaused`, rotation animation at configurable speed, and disposal.
- Added a modular rule-driven composition engine
  (`ui/celestialComposer.js`) for rocky, gas giant, and moon textures
  using deterministic seeded layer stacks. Layers include base
  gradient, noise-based terrain, band patterns, oceans, ice caps,
  vegetation, clouds, volcanic features, craters, and more.
  Equirectangular texture maps are generated using 3D value noise,
  fBm, ridged fBm, and domain warping.
- Added full per-type celestial art-profile library
  (`ui/celestialArtProfiles.js`) covering all established rocky
  recipes, moon recipes, and gas styles, then wired those directives
  into `ui/celestialComposer.js`. Includes 11 new procedural texture
  modules: `dune-streaks`, `caustic-bloom`, `terminator-band`,
  `impact-rays`, `rift-lines`, `plume-haze`, `band-shear`,
  `storm-fronts`, `polar-haze`, `aurora-ovals`, `geo-grid`.
- Added off-thread texture generation via a Web Worker
  (`ui/celestialTextureWorker.js`,
  `ui/celestialTextureWorkerClient.js`) with request queueing,
  signature-based deduplication, and error recovery.
- Added descriptor texture caching + hover-aware LOD tiers
  (`low`/`medium`/`high`/`ultra`) for preview performance and quality
  scaling.
- Added preset-asset catalog generation
  (`scripts/generate-celestial-preset-assets.mjs`) and generated
  `assets/celestial-presets/manifest.json` covering established
  rocky/gas/moon families.
- Updated planet and moon Appearance KPI previews to use the unified
  animated controller, with rotation driven at `0.5` simulated Earth
  days per second. Added Pause/Play buttons that appear on
  hover/focus-within.
- Persisted recipe identifiers (`appearanceRecipeId`) through
  rocky/moon/gas flows so preview rendering keeps deterministic
  type-specific visual signatures across edits and reloads.
- Upgraded celestial preview rendering quality with higher LOD texture
  tiers, physically based body materials, and generated
  normal/roughness/emissive maps for richer lighting detail on planets
  and moons.
- Migrated the System Poster to Three.js orthographic rendering
  (`ui/systemPosterNativeThree.js`) with textured body spheres, star
  glow, habitable-zone arc band, frost line, debris disk particles,
  orbital guides, and starfield background. Removed ~430 lines of
  Canvas2D poster drawing code from `ui/systemPage.js`.
- Migrated the Apparent Sky angular-size comparison to Three.js
  (`ui/apparentSkyNativeThree.js`) with textured body spheres,
  Sol/Luna/Jupiter reference outlines, star glow, and day/night sky
  backgrounds. Removed ~450 lines of Canvas2D sky drawing code from
  `ui/apparentPage.js`.
- Added Three.js native body mesh cache in the Visualiser system view
  with LOD swapping, texture generation, atmosphere materials, and
  spin animation. Moon labels fade in based on zoom level.
- Replaced the canvas-drawn transition bar (`ui/vizTransition.js`)
  with a native HTML transition overlay with progress bar. Added an
  off-scale zone notice for bodies beyond the visible viewport.
- Removed the Canvas2D body-rendering dispatch layer
  (`ui/bodyRenderer.js`) — responsibilities absorbed by the Three.js
  pipeline.
- Removed 2D Canvas rendering functions from `gasGiantStyles.js`,
  `moonStyles.js`, and `rockyPlanetStyles.js` (preview, visualiser,
  and recipe-thumbnail renderers), replaced by Three.js native
  preview calls.

**Tests** (tests/celestialArtProfiles.test.js,
tests/celestialComposer.test.js, tests/celestialVisual.test.js,
tests/three.test.js, tests/visualHelpers.js)

- Added visual regression test infrastructure
  (`tests/visualHelpers.js`) with `@napi-rs/canvas` and `pixelmatch`
  for pixel-perfect snapshot comparison. Reference snapshots stored
  in `tests/snapshots/`.
- Patched `tests/domHarness.js` to delegate `getContext("2d")` to
  `@napi-rs/canvas` for real pixel-level rendering in headless tests.
- New test file `tests/celestialArtProfiles.test.js`: art profile
  resolution for every rocky/moon/gas recipe, layer verification,
  noise parameter coverage, gas ring/atmosphere specs.
- New test file `tests/celestialComposer.test.js`: descriptor
  defaults, ring enabling, subsurface-ocean mapping, LOD fallback,
  recipe-like model handling.
- New test file `tests/celestialVisual.test.js`: deterministic
  texture generation, pixel-perfect snapshot comparison, visual
  differentiation between body types.
- New test file `tests/three.test.js`: Three.js core constructors,
  vector/matrix operations, colour parsing, geometry vertex counts,
  colour space constants.
- Removed `tests/bodyRenderer.test.js` (superseded by celestial
  composer/art profile tests).

### Cluster Visualiser

**Pure 2D overlay rendering**
(ui/visualizerPage.js, ui/vizClusterRenderer.js)

Rewrote the cluster visualiser to render entirely on a single 2D
canvas overlay, eliminating the hybrid WebGL + Canvas2D split that
caused compositing judder during camera rotation. Three.js is used
only for projection math (camera matrix); all visual elements —
background gradient, starfield, grid rings, bearing labels, axes,
boundary circle, vertical links, star dots with radial gradients,
companion stars, system labels, and hover highlights — are drawn on
one `<canvas>` surface.

- Stars render as radial-gradient dots with bright cores and soft
  glow, matching the v1.13.0 Canvas2D visual style, instead of flat
  `SphereGeometry` meshes.
- System labels use native `ctx.fillText` with collision detection
  instead of Three.js `Sprite` objects, restoring readable text at
  all zoom levels.
- Boundary circle is drawn as a screen-facing 2D arc instead of a 3D
  `RingGeometry` on the XZ plane that appeared as a tilted ellipse.
- Home star remains pinned to the projected centre during rotation.
- Added a toggleable starfield background (400 seeded random stars)
  with a "Starfield" checkbox in the cluster controls panel.
- Moved `vizClusterRenderer.js` to a data-only module
  (`buildClusterSnapshot`); all rendering code now lives in
  `visualizerPage.js`.

### Stellar Activity

**Structured activity model with split-rate CME channels**
(engine/stellarActivity.js, ui/starPage.js,
scripts/calibrate-stellar-activity.mjs)

Added a structured three-tier stellar-activity model
(`inputs` / `activity` / `display`) with activity-cycle-aware flare
rate modulation, a comprehensive CME rate model, recalibrated CME
association probabilities, smooth saturation curves replacing hard
caps, and support for nested parameter shapes — while maintaining
backward compatibility through the existing `computeFlareParams`
entry point.

- New primary entry point `computeStellarActivityModel(star)` returns
  all numeric outputs and pre-formatted display strings in a
  three-tier object.
- Activity-cycle modulation: `flareCycleMultiplierFromCycle()` applies
  spectral-bin-specific min/max multipliers (FGK 0.35–1.65, earlyM
  0.6–1.4, lateM 0.75–1.25) from a new `FLARE_CYCLE_MULTIPLIER_TABLE`.
- Comprehensive CME rate model via `computeCmeRateModel()`: associated
  rate (power-law-weighted mean association probability × flare rate),
  background rate (FGK: fills to cycle target; M-dwarf: activity-norm
  scaled), and total rate.
- Recalibrated `baseCmeProbability()` from a hardcoded if/else chain
  to a data-driven `CME_PROBABILITY_BREAKS` table with updated values
  (micro-flares 0.02→0.005, super-flares 0.5→0.75).
- Replaced hard CME cutoff logic in `maybeSpawnCME()` with a smooth
  `cmeSaturationFactor()` that gradually reduces probability as
  recent count exceeds the target.
- Added `scheduleNextCme()` Poisson-process CME scheduler.
- Updated the visualiser flare/CME runtime to consume the v2 model:
  flare cadence follows energetic flare rate, while CMEs are
  scheduled from associated/background channels with separate queues
  and backlog guards.
- Updated Star page to show seven activity metrics: energetic flare
  rate, energetic flare recurrence, total flare rate (>10³⁰ erg),
  total flare recurrence, associated CME rate, background CME rate,
  and total CME rate.
- Added animated star visual preview on the Star page with real-time
  flare bursts and CME events driven by the activity model, rotating
  at 0.5 simulated days per second.
- Added schema migration for `star.activityModelVersion` (`v1` legacy,
  `v2` split-rate model) and persisted it through Star page
  apply/preset/reset flows.
- Added `data/stellarActivity/calibration.v2.json` as a v2
  stellar-activity calibration anchor dataset.
- Added `scripts/calibrate-stellar-activity.mjs` and
  `npm run calibrate:activity` for calibration regression checks.

**Tests** (tests/stellarActivity.test.js)

- New test: `computeStellarActivityModel` returns correct structure
  and rates for a Sun-like star (Teff 5770, age 4.6 Gyr).
- Rewritten CME throttling test validates soft-suppression curve
  instead of binary pass/fail.
- New test: nested `{ inputs, activity, display }` params accepted
  by `scheduleNextFlare`, `expectedRateAboveEnergyPerDay`, and
  `maybeSpawnCME`.
- New test: `flareCycleMultiplierFromCycle` returns 1.0 at midpoint
  (cycle 0.5) for all spectral bins.
- New test: `computeCmeRateModel` FGK associated + background matches
  cycle target envelope.
- New test: `scheduleNextCme` is deterministic with seeded RNG.

### Gas Giant Styles

**Fantastical styles removed, palette tuning**
(ui/gasGiantStyles.js, ui/store.js, tests/gasGiantStyles.test.js)

- Removed the 7 Fantastical gas giant styles; the style library now
  contains 17 Realistic styles only.
- Removed the `"exotic"→"crystal"` legacy alias from the store
  migration.
- Tuned colour palettes across all Realistic styles for higher
  saturation and contrast (Jupiter, Saturn, Neptune, Uranus, Hot
  Jupiter, etc.).
- Added `inferGasStyleFamily()` and `enrichGasStyleDef()` helpers.

### Splash Screen Toggle

**Persistent splash-screen opt-out**
(app.js, index.html, styles.css)

Added a "Splash" checkbox in the header controls that persists to
`localStorage`. When unchecked, the splash overlay is skipped
entirely and the app starts directly. Defaults to enabled.

### Initial State

**Empty initial world** (ui/store.js)

New worlds now start with no planets and no moons. The previous
default (one Earth-like planet "New Planet" and one Luna-like moon)
has been removed. Schema version advanced from 45 to 46.

- `clearAllData()` now removes all `worldsmith.*` localStorage keys
  (previously only removed backup keys), ensuring theme preferences,
  splash state, and visualizer flags are also reset.

### Internal

**Refactoring and deduplication**

- Extracted `eccentricityFactor(e)` (Wisdom 2004/2008 tidal heating
  function) from `engine/moon.js` and `engine/planet.js` into
  `engine/utils.js` as a single shared export.
- Extracted `escapeHtml()` from five UI files into `ui/uiHelpers.js`.
- Stellar population label shortened on the Star page: display value
  uses `shortPopulationLabel()` (e.g. "Pop I"), full label moved to
  meta text.
- "Exotic" style alias removed from `gasGiantStyles.js`
  `normalizeStyleId`; "storm" normalises to "neptune".
- About page changelog wording updated: "many real and fantastical
  types" changed to "many realistic types".

**CSS** (styles.css)

- Added `.header-controls` container and `.splash-toggle` component
  for the header splash opt-out checkbox.
- Added responsive `.top-nav__link` font scaling at 1640 px and
  1505 px breakpoints.
- Added `backdrop-filter: blur(8px)` to `button.small` and the
  splash overlay.
- Replaced `.brand__mark` gradient with `favicon.svg` background
  image.
- Added `.kpi--sun-preview` card styles with expandable animated
  canvas.
- Added `.rp-picker-progress` recipe-picker progress bar with
  animated fill and fade-out.
- Added `#viz-overlay` absolute-positioned overlay canvas for the
  cluster visualiser.
- Added `.viz-native-transition` progress bar and
  `.viz-offscale-note` positioned note for the visualiser.
- Added `.viz-help-overlay` modal with close button, two-column
  grid, and `<kbd>` styled shortcut keys.
- Added poster fullscreen layout improvements and disabled-state
  styling for the collapse button.

**New devDependencies**

- `three` (^0.183.1) — Three.js 3D library
- `@napi-rs/canvas` (^0.1.95) — native Node canvas for headless
  rendering in tests
- `pixelmatch` (^7.1.0) — pixel-level image comparison for visual
  regression

**New npm scripts**

- `npm run assets:three` — generate Three.js SVG sprite assets
- `npm run assets:celestial` — generate celestial preset manifest
- `npm run calibrate:activity` — stellar activity calibration check

## 1.13.0 — 2026-02-24

### Bug Fixes

**Star overrides not propagated to System page layout**
(engine/system.js, ui/systemPage.js, ui/visualizerPage.js,
ui/planetPage.js, ui/outerObjectsPage.js)

- `calcSystem` computed habitable zone, frost line, and inner limit
  from mass-derived luminosity and radius only, ignoring Advanced-mode
  R/L/T overrides and stellar evolution. Added optional
  `luminosityLsolOverride` and `radiusRsolOverride` parameters to
  `calcSystem`; all five UI call sites now resolve star properties via
  `calcStar` with full overrides before passing resolved L/R through.
- System Poster `calcStar` call only received mass and age — evolution
  mode, metallicity, and R/L/T overrides were missing. Gas giant poster
  calcs used the resulting non-evolved luminosity. Hoisted the
  `calcStar` call to the top of `render()` with full `getStarOverrides`
  propagation.
- System page star resolution now also passes `metallicityFeH` into
  `calcStar`, so evolved-mode metallicity-dependent outputs match the
  Star page's physics path.
- Rocky planet poster visuals (`calcPlanetExact`) received raw
  `p.inputs` instead of slot-AU-corrected inputs, so climate and sky
  colours were computed at the stored semi-major axis rather than the
  assigned orbit slot. Applied the `{ ...p.inputs, semiMajorAxisAu:
slotAu }` override pattern already used by the Visualiser.
- Moon parent planet inputs passed to `calcMoonExact` on the System
  page also lacked the slot-AU override. Added a
  `correctedInputsByPlanetId` lookup built from assigned slot positions,
  matching the Visualiser's existing pattern.

**Tests** (tests/system.test.js)

- 4 new tests: luminosity override affects frost line and HZ, radius
  override affects inner limit and density, both overrides together,
  invalid overrides (negative, zero, NaN) fall back to mass-derived
  values

### Planet Visualisation System

**Unified rocky/gas/moon visualisation pipeline**
(ui/bodyRenderer.js, ui/renderUtils.js, ui/rockyPlanetStyles.js,
ui/gasGiantStyles.js, ui/moonStyles.js, ui/systemPage.js,
ui/visualizerPage.js, ui/apparentPage.js)

- Added a shared body-rendering pipeline so rocky planets, gas giants,
  and moons use one consistent rendering path across Planet, System
  Poster, Visualiser, and Apparent views.
- Centralised scale-aware rendering decisions and fallback behaviour so
  bodies keep consistent style and readability across different canvas
  sizes and page contexts.
- Unified profile-driven rendering hooks for all three body classes to
  reduce duplicate draw logic and keep cross-page visuals in sync.

### Gas Giant Visual Automation

**Auto-ring detection and style-sync for gas giants**
(ui/planetPage.js, ui/gasGiantStyles.js,
tests/gasGiantSuggest.test.js, tests/gasGiant-nasa-validation.test.js)

- Gas giant ring visibility is now auto-derived from physics output:
  `Dense`/`Moderate` ring optical-depth classes enable rings, otherwise
  rings are hidden.
- Planet page gas giant visuals now auto-sync style and ring state after
  edits and recipe application, removing manual style/ring drift from
  the physics model.
- Style suggestion now keeps Class I Saturn-mass, ring-prominent giants
  in the Saturn-like family while still allowing hazy candidates for
  high-metallicity cases.

### Debris Disk Engine & Outer Objects Page

**Resonance-sculpted debris disk physics** (engine/debrisDisk.js,
ui/outerObjectsPage.js)

Added a debris disk engine and dedicated Outer Objects page for
configuring asteroid-belt and Kuiper-belt-like zones. Disks are
auto-suggested from gas giant positions using mean-motion resonance
(MMR) placement across five priority levels, or from the frost line
when no gas giants are present.

The engine computes comprehensive disk properties from orbital
boundaries, host-star parameters, and gas giant positions:

- **Resonance placement** — Five priority tiers: primary outer belt
  (outermost giant 3:2→2:1 exterior MMR), primary inner belt
  (innermost giant 4:1→2:1 interior MMR), inter-giant gap disks,
  extended outer belt (2:1→5:2), and warm inner belt (8:1→4:1).
  Verified against Solar System: Kuiper belt 39.4–47.7 AU from
  Neptune, asteroid belt 2.06–3.28 AU from Jupiter.
- **Composition** — Condensation-sequence classification (Lodders 2003)
  from equilibrium temperature: Refractory silicate, Mixed rock/ice,
  Icy, or Ultra-cold. Twelve species from corundum (1700 K) to N₂ ice
  (22 K) with mass fractions.
- **Fractional luminosity** — Wyatt et al. (2007) steady-state maximum:
  f_max ∝ r^(7/3) × (Δr/r) × t^(-1). Optical depth derived from
  fractional luminosity.
- **Grain physics** — Radiation-pressure blowout size (Burns, Lamy &
  Soter 1979), Poynting-Robertson drag timescale, and collisional
  lifetime. Collision vs PR-drag dominance classification.
- **Mass estimation** — Dohnanyi (1969) cascade from optical depth, or
  user override with reverse-derived optical depth.
- **Collision dynamics** — Kepler velocity at midpoint, eccentricity-
  scaled collision velocity, and regime classification (gentle/
  erosive/catastrophic).
- **IR detectability** — 24 μm excess from Planck-function ratio of
  disk and star emission, with detection-threshold labels.
- **Zodiacal delivery** — PR-drag inflow rate of small grains toward
  the inner system.
- **Dynamical stability** — Chaotic-zone overlap check against gas
  giant positions using Wisdom (1980) zone widths.
- **Surface density** — Absolute value and ratio to the Minimum Mass
  Solar Nebula (MMSN) profile.

The UI page provides inputs for disk name, inner/outer edges (or
center + width), eccentricity, inclination, and optional mass override.
Auto-sync updates suggested disks when gas giant positions change.

**NASA validation** (tests/debrisDisk-nasa-validation.test.js)

Validated against Solar System asteroid belt and classical Kuiper belt
using observed values from Pitjeva & Pitjev (2018), JPL Kirkwood gap
diagrams, and Stern & Colwell (1997).

**Tests** (tests/debrisDisk.test.js,
tests/debrisDisk-nasa-validation.test.js)

- 68 tests: resonance suggestions (frost-line fallback, single/multi-
  giant placement, count limiting, overlap filtering), disk physics
  (temperature, composition, luminosity, mass, grains, collision
  regime, stability, IR excess, zodiacal delivery), NASA validation
  (asteroid belt and Kuiper belt properties)

**References**

- Wyatt, M. C. et al. (2007), "Steady State Evolution of Debris
  Disks around A Stars", ApJ 663, 365
- Dohnanyi, J. S. (1969), "Collisional Model of Asteroids and Their
  Debris", JGR 74, 2531
- Burns, J. A., Lamy, P. L. & Soter, S. (1979), "Radiation forces on
  small particles in the solar system", Icarus 40, 1
- Lodders, K. (2003), "Solar System Abundances and Condensation
  Temperatures of the Elements", ApJ 591, 1220
- Pitjeva, E. V. & Pitjev, N. P. (2018), "Mass of the Kuiper belt",
  Astron. Lett. 44, 554

## 1.12.0

### 3D Planet Splash Screen

**Interactive loading overlay with Three.js planet**
(ui/splashOverlay.js, app.js, styles.css, index.html)

Added a full-screen splash overlay shown on every page load. A 3D
model of the planet (`assets/planet.glb`, created in Blender) is
rendered via Three.js loaded lazily from the jsdelivr CDN. The planet
auto-rotates and can be grabbed and spun on its axis via OrbitControls
(rotation only — no zoom or pan). Biome colouring is applied at
runtime from vertex positions: ocean (blue), latitude-driven biomes
(tropical, savanna, desert, temperate, boreal, tundra, polar), and
elevation-based mountain/snow colouring. Clouds render as translucent
white, the atmosphere as a faint blue rim, and city lights as warm
amber dots on the night side. Day/night lighting uses a directional
sun with a dim cool-blue fill on the dark side.

The user dismisses the overlay by clicking "Enter WorldSmith", which
triggers a 0.5 s fade-out transition. All Three.js resources
(renderer, geometries, materials, controls) are disposed on dismiss.
If Three.js or the GLB fails to load, the enter button still appears
so the user is never blocked. Respects `prefers-reduced-motion` by
disabling auto-rotation.

- CSP updated: `wasm-unsafe-eval` added to `script-src`;
  `https://cdn.jsdelivr.net` added to `connect-src` for Draco decoder
- Three.js + GLTFLoader + DRACOLoader + OrbitControls loaded via
  dynamic `import()` from CDN with cached promise (retry on failure)
- Draco decoder forced to JS-only mode to avoid WASM CSP issues

### Rocky Planet Visual Rendering

**Physics-driven canvas visuals for rocky planets**
(ui/rockyPlanetStyles.js, ui/planetPage.js, ui/systemPage.js,
ui/visualizerPage.js, styles.css)

Rocky planets now render with the same visual richness as gas giants.
A new physics-driven rendering system translates engine-derived
properties (composition class, water regime, surface temperature,
tectonic regime, atmospheric pressure, vegetation, axial tilt) into
a layered canvas visual — no user-selectable style presets, everything
is determined by the planet's physics.

- **Surface palettes** — Seven composition classes (Earth-like,
  Mars-like, Mercury-like, Iron world, Coreless, Ice world, Ocean
  world) each with a three-tone colour palette
- **Oceans** — Coverage from water regime (Dry → 0, Shallow → 0.3,
  Extensive → 0.65, Global → 0.95, Deep → 1.0); frozen when T < 273 K
- **Ice caps** — Piecewise-linear extent from surface temperature with
  axial-tilt asymmetry between poles
- **Clouds** — Coverage from pressure × water vapour; Venus-like
  worlds get near-total yellowish cloud cover
- **Atmosphere rim** — Logarithmic thickness from surface pressure,
  coloured by sky colour
- **Terrain** — Cratered (stagnant + airless), worn (stagnant +
  atmosphere), continental (mobile), volcanic (episodic), or smooth
  (plutonic-squishy)
- **Vegetation** — Semi-transparent tinted patches near the equator
  for habitable worlds with vegetation hex values
- **Special effects** — Lava cracks (T > 1200 K), frozen crystalline
  highlight (T < 100 K + airless)
- **Tidal lock** — Terminator darkening on the far side
- **Deterministic** — Seeded RNG from planet name for reproducible
  rendering across reloads

Integrated into three rendering contexts: 180 px preview card on the
Planet page (matching the gas giant preview), the System Poster on the
Planetary System page, and the system Visualiser — all with
star-directed lighting and scale-aware detail simplification.

**Tests** (tests/rockyPlanetStyles.test.js)

- 44 new tests across 9 groups: palette (8), ocean (8), ice caps (5),
  clouds (3), atmosphere (4), terrain (5), special effects (3),
  vegetation (3), determinism and edge cases (5)

### Gas Giant Engine — Six New Physics Features

**Oblateness, mass loss, interior, age-radius cooling, ring properties,
and tidal effects** (engine/gasGiant.js, ui/planetPage.js)

Added six new physics subsystems to the gas giant engine, bringing it
closer to parity with the rocky planet engine. All six features are
computed from the existing user inputs (mass, radius, orbit, rotation,
star parameters) and appear in the derived-readout panel.

1. **Oblateness** — Rotational flattening via Darwin-Radau approximation
   with calibrated effective C/(MR²). Returns flattening, equatorial and
   polar radii, and J₂. Gas giants use log-mass interpolation between
   Saturn and Jupiter calibration points; ice giants use a
   density-dependent MOI. Equatorial gravity (GM/R_eq²) matches the NASA
   convention for surface gravity reporting.

2. **Atmospheric mass loss** — XUV-driven energy-limited escape (Ribas
   et al. 2005 power-law decay). Returns mass-loss rate (kg/s),
   evaporation timescale (Gyr), XUV flux at orbit, Roche lobe radius
   (Eggleton 1983), and overflow flag. Uses `starAgeGyr` (previously
   accepted but unused).

3. **Interior structure** — Heavy-element mass from Thorngren et al.
   (2016): M_Z = 49.3 × (M/Mj)^0.61 M⊕. Core mass capped at 25 M⊕
   (Juno constraint). Returns total heavy elements, estimated core mass,
   and bulk metallicity fraction.

4. **Age-dependent radius** — Fortney et al. (2007) cooling
   approximation: R(t)/R(5 Gyr) ≈ 1 + 0.1 × (5/t)^0.35. Hot Jupiters
   (T_eq > 1000 K) receive proximity inflation (+0.1 to +0.3 Rj).
   Returns suggested radius, inflation factor, and diagnostic note.

5. **Ring properties** — Temperature-dependent composition (Icy < 150 K,
   Mixed 150–300 K, Rocky > 300 K). Mass scaled from Saturn:
   3×10¹⁹ × (M/M_Saturn)^0.5 kg. Returns ring type, composition,
   estimated mass, optical depth class, and radial extent.

6. **Tidal effects** — Locking timescale ∝ a⁶ and circularisation
   timescale ∝ a^6.5, both compared to star age for locked/circularised
   flags. Hot Jupiters at 0.03 AU are tidally locked; Jupiter at 5.2 AU
   is not.

**Tests** (tests/gasGiant.test.js)

- 22 new tests: oblateness (5), mass loss (4), interior (3),
  age-radius (3), rings (3), tidal (4)

### Gas Giant NASA Validation

**Engine vs NASA/JPL factsheet comparison** (engine/gasGiant.js,
tests/gasGiant-nasa-validation.test.js)

Created a NASA validation test suite comparing engine outputs for
Jupiter, Saturn, Uranus, and Neptune against observed values from
NASA/JPL Planetary Fact Sheets (references/\*-factsheet.md). Ten
properties are compared per planet with error percentages displayed
in a summary table.

The Darwin-Radau oblateness model reduced flattening errors from
3.6–35.1% to under 0.3% for all four giants. Equatorial gravity
(GM/R_eq²) matches NASA's convention, reducing gravity error from
4.6–7.2% to under 0.5%. J₂ uses the first-order hydrostatic relation
(2f − q)/3 instead of the previous q/3 approximation.

| Property                | Before          | After |
| ----------------------- | --------------- | ----- |
| Flattening (worst)      | 35.1% (Neptune) | 0.3%  |
| Gravity (worst)         | 7.2% (Uranus)   | 0.5%  |
| Fair comparisons ≤ 1.5% | 24/28           | 32/32 |

Effective temperature and bond albedo remain footnoted as model
limitations (Sudarsky classification vs real atmospheric properties).

**Tests** (tests/gasGiant-nasa-validation.test.js)

- 33 new tests: summary table (1), per-planet assertions for density,
  escape velocity, orbital period, orbital velocity, equatorial radius,
  polar radius, flattening, and equatorial gravity (8 × 4 planets)

**References**

- Ribas, I. et al. (2005), "Evolution of the Solar Activity over Time
  and Effects on Planetary Atmospheres", ApJ 622, 680
- Thorngren, D. P. et al. (2016), "The Mass–Metallicity Relation for
  Giant Planets", ApJ 831, 64
- Fortney, J. J. et al. (2007), "Planetary Radii across Cool Jupiters
  to Hot Neptunes", ApJ 659, 1661
- Eggleton, P. P. (1983), "Approximations to the Radii of Roche
  Lobes", ApJ 268, 368
- NASA/JPL Planetary Fact Sheets (science.nasa.gov)

### Lagrange Points in the System Visualiser

**L1–L5 equilibrium point overlay** (engine/lagrange.js, ui/visualizerPage.js)

Added a toggle-able Lagrange point overlay to the system visualiser.
When enabled, L4/L5 Trojan points appear as small teal diamonds on every
body's orbit. Clicking a body promotes the display to all five L-points
(L1–L5) rendered as labelled cross markers. L1/L2 use the Hill sphere
approximation; L3 uses the restricted three-body mass-ratio correction;
L4/L5 are the exact equilateral points at +/-60 degrees.

- Teal/cyan colour (`rgba(80,200,200,X)`) distinct from purple Hill
  spheres, green HZ, and blue frost line
- Works with log/linear scale, eccentric orbits, and 3D rotation
- Separate render blocks for gas giants (Jupiter-mass units) and rocky
  planets (Earth-mass units)

**Tests** (tests/lagrange.test.js)

- 9 new tests: Earth-Sun and Jupiter-Sun Hill radii, L4/L5 symmetry,
  L3 mass correction, monotonicity, and invalid-input guards

### Metallicity in Local Cluster Star Generation

**Per-system [Fe/H] assignment** (engine/localCluster.js,
ui/localClusterPage.js, ui/vizClusterRenderer.js)

Each generated star system now receives a metallicity value based on
galactic position and spectral class. The mean [Fe/H] is shifted by a
radial gradient (-0.06 dex/kpc, Luck & Lambert 2011) and a vertical
gradient (-0.30 dex/kpc, Schlesinger et al. 2014), with per-class
offsets (O/B slightly metal-rich, brown dwarfs slightly metal-poor) and
Gaussian scatter (sigma 0.20 dex, Nordstrom et al. 2004). The home
system uses the value set on the Star page.

- [Fe/H] and P(giant) columns added to the system coordinates table
- Giant planet probability per system via Fischer & Valenti (2005):
  P = 0.1 x 10^(2 x [Fe/H])
- Cluster visualiser labels now show [Fe/H] on hover and when labels
  are enabled
- Deterministic generation via Box-Muller transform on the existing
  Park-Miller PRNG (phase offset 37)

**Tests** (tests/localCluster.test.js)

- 8 new tests: determinism, physical range, home system override,
  solar neighbourhood mean, radial gradient direction, seed variation

**References**

- Nordstrom, B. et al. (2004), "The Geneva-Copenhagen survey", A&A 418
- Luck, R. E. & Lambert, D. L. (2011), "The Distribution of the
  Elements in the Galactic Disk", AJ 142, 136
- Schlesinger, K. J. et al. (2014), "The Vertical Metallicity Gradient
  of the Milky Way Disk", ApJ 791, 112
- Fischer, D. A. & Valenti, J. (2005), "The Planet-Metallicity
  Correlation", ApJ 622, 1102

### Stellar Evolution Engine

**Main-sequence luminosity, radius, and temperature evolution**
(engine/star.js, ui/starPage.js, ui/store.js)

Added a stellar evolution mode based on Hurley, Pols & Tout (2000)
analytical single-star evolution (SSE) formulae. When the "Evolved"
toggle is enabled on the Star page, the engine computes age-dependent
luminosity, radius, and temperature instead of the static Eker (2018)
mass–luminosity/mass–radius relations. Metallicity ([Fe/H]) feeds
into Tout et al. (1996) ZAMS baselines and Hurley evolution rates.

- **ZAMS baseline** — Tout et al. (1996) rational-function fits for
  zero-age main-sequence luminosity and radius as functions of mass
  and metallicity Z
- **MS lifetime** — Hurley (2000) eq. 4 for time to base of giant
  branch (t_BGB), with t_MS ≈ 0.95 × t_BGB
- **Luminosity evolution** — Parametric interpolation
  log(L/L_ZAMS) = α·τ + β·τ^η + γ·τ² with piecewise α_L, β_L from
  Hurley eqs. 19–20, constrained so L(τ=1) = L_TMS
- **Radius evolution** — log(R/R_ZAMS) = α·τ + γ·τ³ with α_R from
  Hurley, constrained so R(τ=1) = R_TMS
- **Temperature** — Stefan-Boltzmann: T = (L/R²)^0.25 × 5772 K
- **Override propagation** — Star R/L/T overrides from the evolved
  model flow through to planet insolation, surface temperature,
  habitable zone, and moon illumination via all UI call sites
- **Store schema** — Migrated to v45; new `evolutionMode` field
  ("zams" default, "evolved") persisted in localStorage
- **Star page toggle** — "Evolved" checkbox wired to applyFromInputs,
  updateWorld, Sol preset, and Reset handlers

**NASA validation** (tests/star-evolution-nasa-validation.test.js)

Validated against 9 benchmark main-sequence stars (Sun, Alpha Cen A/B,
Tau Ceti, 70 Oph A, Epsilon Eridani, 61 Cyg A, Sirius A, Pi3 Orionis)
with observed L, R, T from IAU 2015, Kervella+ 2017, Bond+ 2017, and
other interferometric sources. Also validated downstream propagation
to planet insolation and habitable zone boundaries.

| Metric          | Mean error | Max error |
| --------------- | ---------- | --------- |
| Luminosity (L)  | 9.8%       | 15.5%     |
| Radius (R)      | 1.1%       | 4.4%      |
| Temperature (T) | 1.7%       | 3.8%      |

R and T accuracy is near the practical ceiling of Hurley analytical
SSE. The ~10% mean L error is intrinsic to the polynomial fits
(Tout 1996 ZAMS baseline + Hurley evolution rates); sub-2% L accuracy
would require tabulated MIST/MESA isochrone grids.

**Tests** (tests/star.test.js, tests/star-evolution-nasa-validation.test.js)

- 22 new unit tests: feHtoZ conversion, ZAMS L/R values and
  monotonicity, MS lifetime scaling, evolved Sun at 4.6 Gyr,
  evolution-exceeds-ZAMS at mid-MS, age=0 matches ZAMS, calcStar
  evolved/zams mode fields, metallicity effects on lifetime and
  luminosity
- 10 NASA validation tests: per-star L/R/T assertions, ZAMS vs
  standard solar model, MS lifetime benchmarks, calcStar integration,
  evolved-vs-ZAMS comparison, metallicity effects, planet insolation
  propagation, HZ boundary shift, summary table with quality gates

**References**

- Hurley, J. R., Pols, O. R. & Tout, C. A. (2000), "Comprehensive
  analytic formulae for stellar evolution as a function of mass and
  metallicity", MNRAS 315, 543
- Tout, C. A. et al. (1996), "Rapid fitting formulae for the ZAMS",
  MNRAS 281, 257
- Eker, Z. et al. (2018), "Interrelated main-sequence mass–luminosity,
  mass–radius, and mass–effective temperature relations", MNRAS 479, 5491

## 1.11.1

### System Poster

**Dynamic solar system lineup visualization**
(ui/systemPage.js, styles.css)

Added a System Poster panel at the top of the Planetary System page.
The poster renders a poster-style lineup of all bodies in the current
system: the star as a glowing half-disk on the left, with rocky planets,
gas giants, debris disks, and moons arranged left-to-right by orbital
distance.

- **Body sizing** — Power-law scale so rocky planets remain visible
  next to gas giants (`(radiusKm / EARTH_R_KM) ^ 0.45`)
- **Gas giants** — Full banded rendering with rings, spots, and
  special effects via `drawGasGiantViz`
- **Rocky planets** — Radial gradient spheres using sky colours from
  the planet engine, lit from the star direction
- **Moons** — Stacked vertically below parent bodies with name labels
- **Habitable zone** — Semi-transparent green arc band curving around
  the star
- **Frost line** — Dashed vertical line
- **Debris disks** — Curved arc bands with irregular asteroid rock
  particles and fine dust, with name labels
- **Control panel** — Toggle visibility of labels, moons, habitable
  zone, frost line, debris disks, orbital guides, and starfield
- **Scale modes** — Logarithmic (default) and Linear scale toggle
- **Fullscreen** — Fullscreen API integration for immersive viewing
- **Export PNG** — Download poster as timestamped PNG
- **Collapsible** — Click header or arrow button to collapse/expand

## 1.11.0

### Apparent Size & Brightness

**Moon distance bug fix + angular diameters + multi-moon support**
(engine/apparent.js, ui/apparentPage.js)

Fixed a bug in moon apparent magnitude where the heliocentric distance
was squared (`home ** 2` instead of `home`). At 1 AU the error cancels
(log₁₀(1) = 0), but at 2 AU moons appeared ~1.5 mag too dim.

Added angular diameter computation for stars, planets, and moons.
Results are returned as arcseconds and a smart label that switches
between degrees, arcminutes, and arcseconds depending on magnitude.
All three tables on the Apparent Size page now include an angular
diameter column.

Replaced the single-moon selector with automatic multi-moon rendering:
the moon table now shows all moons assigned to the home world. A global
phase slider applies to every moon. Added a Sol System References panel
showing familiar objects (Sun, Full Moon, Venus, Jupiter, Mars, Sirius)
for comparison.

**Moon brightness calibration**
(engine/apparent.js, ui/apparentPage.js, ui/store.js, engine/moon.js)

Corrected default Moon Bond albedo from 0.136 to 0.11 (NASA factsheet).
Added Bond-to-geometric albedo conversion in the UI using phase integral
q ≈ 0.9 for regolith-covered rocky bodies. Updated the full-moon
reference magnitude from −12.67 to −12.74. Moon brightness ratio now
reads 1.0 for an Earth-like moon at 1 AU, matching observation.

Updated Bond albedo tooltip references across Moon and Planet pages to
match NASA factsheets: Mercury 0.068, Venus 0.77, Jupiter 0.343,
Moon 0.11.

**Tests** (tests/apparent.test.js, tests/nasa-validation.test.js)

- 18 apparent engine tests updated for geometric albedo 0.12
- 6 new NASA validation tests: absolute magnitudes for 7 planets,
  Sun/Moon from Earth (magnitude + angular diameter), planets at
  opposition, Galilean moons from Jupiter surface, summary table

### Sol System Preset Accuracy

**Updated 19 planets and moons to NASA/JPL reference values**
(ui/solPreset.js)

Audited every value in the Sol preset against NASA Planetary Fact
Sheets and JPL Solar System Dynamics. Corrected semi-major axes,
eccentricities, inclinations, densities, albedos, and rotation
parameters across 4 rocky planets, 4 gas giants, and 11 moons.

Notable fixes:

| Body    | Parameter | Old     | New     |
| ------- | --------- | ------- | ------- |
| Venus   | albedo    | 0.76    | 0.77    |
| Saturn  | radiusRj  | 0.843   | 0.862   |
| Uranus  | radiusRj  | 0.357   | 0.366   |
| Neptune | radiusRj  | 0.346   | 0.354   |
| Triton  | inc (°)   | 156.885 | 157.345 |
| Triton  | albedo    | 0.719   | 0.70    |

Gas giant radii were systematically ~2.2% too small because the old
values divided equatorial radius by Jupiter's equatorial radius
(71,492 km), but the engine converts back using volumetric mean
radius (69,911 km). Corrected all four to use equatorial / 69,911.

### Sky Canvas

**Angular size comparison chart with day/night toggle**
(ui/apparentPage.js, styles.css)

Added a canvas-based visualization to the Apparent Size page that
renders all system objects as disks at their true relative angular
sizes. The star is drawn with a radial gradient in its spectral
colour, moons as grey disks with albedo-scaled lightness and a
phase crescent that follows the moon phase slider, and planets as
brightness-scaled point-source dots with glow halos.

Dotted reference outlines overlay familiar Solar System objects
(Sun, Luna, Venus, Jupiter, Mars) for intuitive comparison. The
Sol outline on the star uses a high-contrast dark stroke when the
star disk is larger than the Sun, switching to a light stroke when
smaller. When the star is more than 10× larger than any other
object, a split scale is used: the star appears at reduced scale
on the left with moons and planets at full scale on the right.

A Night/Day toggle switches the background between a starfield and
the home world's computed sky colour (zenith-to-horizon gradient
from the planet engine's spectral/pressure sky model). All labels
use drop shadows for legibility against any sky background.

## 1.10.0

### Rocky Planet Composition

**CMF/WMF-driven interior model with seven composition classes**
(engine/planet.js, ui/planetPage.js, ui/store.js)

Replaced the old density-floor formula with a full interior
composition model driven by Core Mass Fraction (CMF) and Water Mass
Fraction (WMF). The mass–radius relation uses Zeng et al. (2016) CMF
scaling with a mass-dependent compression exponent calibrated to
Solar System data:

    R(M, CMF) = (1.07 − 0.21 × CMF) × M^α
    α(M) = min(1/3, 0.257 − 0.0161 × ln M)

Solar System validation: Mercury 0.3% error, Venus 0.8%, Earth 0.2%,
Mars 0.5%. The old formula was 16–21% off for iron-rich sub-Earths.

Seven composition classes are derived from CMF/WMF thresholds:

| Class        | Condition   | Example      |
| ------------ | ----------- | ------------ |
| Ice world    | WMF > 10%   | Europa       |
| Ocean world  | WMF 0.1–10% | —            |
| Iron world   | CMF > 60%   | —            |
| Mercury-like | CMF 45–60%  | Mercury      |
| Earth-like   | CMF 25–45%  | Earth, Venus |
| Mars-like    | CMF 10–25%  | Mars         |
| Coreless     | CMF < 10%   | —            |

Six water regimes (Dry through Ice world) describe surface hydrology.
CMF can be auto-suggested from stellar metallicity [Fe/H] via molar
mass balance (Schulze et al. 2021).

Core radius is derived from the Zeng & Jacobsen (2017)
approximation CRF = √CMF, and water-layer radius inflation uses a
Zeng & Sasselov (2016) interpolation between dry and 50%-water
endmembers.

Tidal rigidity and quality factor Q now scale continuously with
composition: silicate baseline 30 GPa with iron boost above CMF 0.33,
ice layers at 3.5 GPa, and Q ranging from 12 (low CMF) to ~47
(Mercury-like).

**References**

- Zeng, L. et al. (2016), "Mass–Radius Relation for Rocky Planets
  Based on PREM", ApJ 819, 127
- Zeng, L. & Jacobsen, S. B. (2017), "A Simple Analytical Model for
  Rocky Planet Interiors", ApJ 837, 164
- Zeng, L. & Sasselov, D. (2013), "A Detailed Model Grid for Solid
  Planets from 0.1 to 100 Earth Masses", PASP 125, 227
- Schulze, J. G. et al. (2021), "An Earth-like Stellar Abundances
  Proxy for Rocky Planet Composition", PSJ 2, 113

### Rocky Planet Atmosphere

**Ten-gas atmosphere model with three greenhouse modes**
(engine/planet.js, ui/planetPage.js)

Built a physically-grounded atmosphere system with ten gases across
three user-selectable modes:

| Mode   | Gases                                        |
| ------ | -------------------------------------------- |
| Manual | User sets greenhouse effect directly (0–500) |
| Core   | N₂, O₂, CO₂, Ar, H₂O, CH₄                    |
| Full   | Core gases + H₂, He, SO₂, NH₃ (expert gases) |

The greenhouse model computes optical depth τ from partial pressures
using functional forms grounded in published physics — logarithmic
for CO₂ and H₂O (band saturation, Myhre 1998), square-root for CH₄
(IPCC TAR). Coefficients are calibrated to simultaneously match
NASA Planetary Fact Sheet surface temperatures: Earth 288 K,
Venus 737 K, Mars 211 K.

Band-overlap suppression prevents double-counting where absorption
bands coincide: CO₂–H₂O overlap at k = 6, SO₂ at k = 8, NH₃ at
k = 20. Expert gases include H₂–N₂ collision-induced absorption
(CIA) for reducing atmospheres.

Mantle outgassing guidance (Ortenzi et al. 2020) suggests primary
species by oxidation state: highly reduced mantles outgas H₂ + CO,
Earth-like mantles outgas CO₂ + H₂O, and oxidised mantles add SO₂.

Additional atmosphere-derived outputs:

- **Sky colours** from a PanoptesV-inspired lookup table interpolated
  in OKLab colour space over star temperature and effective surface
  pressure, with CO₂ tint correction. Outputs high-sun and horizon
  colour pairs rendered as radial gradients.
- **Vegetation colours** from a spectral-class × pressure LUT with
  pale/deep pigment stops, insolation correction, and twilight
  variants for tidally locked K/M worlds.
- **Circulation cells** (1, 3, 5, or 7 Hadley cells) keyed to
  rotation period.
- **Atmospheric tide resistance** — when atmospheric thermal torque
  exceeds gravitational torque (b_atm ≥ 1), tidal synchronisation
  is prevented (explains Venus's slow retrograde rotation).
- **Liquid water feasibility** from Clausius–Clapeyron boiling point
  at the surface pressure and temperature.

**References**

- Myhre, G. et al. (1998), "New estimates of radiative forcing due
  to well mixed greenhouse gases", Geophys. Res. Lett. 25, 2715
- Ortenzi, G. et al. (2020), "Mantle redox state drives outgassing
  chemistry and atmospheric composition", Sci. Rep. 10, 10907
- Leconte, J. et al. (2015), "Asynchronous rotation of Earth-mass
  planets in the habitable zone of lower-mass stars", Science 347, 632

### Magnetic Field Model

**Self-normalised dynamo with dipolar/multipolar regimes**
(engine/planet.js, ui/planetPage.js)

The magnetic field model determines dynamo activity from CMF, planet
mass, age, and rotation period. Core solidification timescale uses
τ = 2 + 12 × CMF × √M Gyr, giving a three-phase convective boost:
ramping during early solidification, peaking at 50–85% solid fraction
(compositional convection), then exponentially suppressed as the
liquid shell thins.

A dipolar/multipolar transition at P_dip = 96√M × √(CMF/0.33) hours
determines whether the field is coherent (dipolar) or fragmented
(multipolar, 10× weaker). Field strength follows Olson & Christensen
(2006) scaling with buoyancy flux.

Solar System validation: 96% of rocky-planet fields within 5% of
observed values, 98% within 15%.

**References**

- Olson, P. & Christensen, U. R. (2006), "Dipole moment scaling for
  convection-driven planetary dynamos", EPSL 250, 561–571

### Tectonic Regime Probabilities

**Four-regime probability model** (engine/planet.js, ui/planetPage.js)

Assigns probability weights across four tectonic regimes — stagnant
lid, mobile lid (plate tectonics), episodic resurfacing, and
plutonic-squishy — using five multiplicative factors: mass, age,
surface water, CMF, and tidal heating. Each factor applies
Gaussian preference curves tuned to published GCM and geodynamic
results. The highest-probability regime is suggested with a
qualitative advisory.

### Divergences from Published Science

**22 documented deviations on the Science page** (ui/sciencePage.js)

Added a new section to the Science & Maths page cataloguing every
place where WorldSmith diverges from a single published formula.
Each entry states what was changed, why, and whether the deviation
is a simplification, calibration, or novel parameterisation. Covers
greenhouse coefficients, band-overlap suppression, mass–radius
exponent, core solidification, magnetic field phases, CRF
approximation, tectonic probabilities, atmospheric tides,
composition-dependent rigidity, vegetation extrapolation, spin-orbit
thresholds, flare rate binning, and more.

The Science page now documents 93 equations across 11 sections.

### NASA Validation Suite

**41 Solar System validation tests** (tests/planet-nasa-validation.test.js)

A dedicated test suite compares engine outputs for Mercury, Venus,
Earth, and Mars against NASA Planetary Fact Sheet data (compiled in
the references/ folder from JPL SSD and science.nasa.gov). Tests
cover density, radius, gravity, surface temperature, core radius,
composition class, magnetic field activity, habitable-zone
membership, and tidal evolution. Tolerance-based assertions use
percentage-error checks to allow for model approximations while
catching regressions.

### Light / Dark Theme

**Full light-mode theme with toggle** (styles.css, app.js, index.html,
STYLE_GUIDE.md)

Added a light theme activated via `data-theme="light"` on the root
element. All ~170 hardcoded `rgba()` colour values were extracted into
CSS custom properties using an RGB-channel technique:

| Variable          | Dark            | Light           |
| ----------------- | --------------- | --------------- |
| `--overlay-color` | `255, 255, 255` | `0, 0, 0`       |
| `--bg-rgb`        | `15, 18, 32`    | `240, 241, 245` |
| `--panel-rgb`     | `23, 27, 46`    | `255, 255, 255` |
| `--accent-rgb`    | `126, 178, 255` | `48, 112, 200`  |

A sun/moon toggle button in the header saves the preference to
localStorage and falls back to the OS `prefers-color-scheme` media
query. The moons.svg icon was updated from a hardcoded fill to
`currentColor` for theme compatibility.

Dark mode appearance is unchanged from 1.9.1.

### Tests

**448 tests total** (tests/)

- 79 planet model tests (composition, atmosphere, sky/vegetation
  colours, tectonic regimes, magnetic field)
- 41 NASA validation tests (Mercury, Venus, Earth, Mars)
- 36 moon tests (tidal heating, recession, composition overrides)
- Remaining tests cover star, system, calendar, apparent magnitude,
  local cluster, gas giants, debris disks, import/export, and
  utilities

## 1.9.1

### Cluster Import

**Paste-to-import for Local Cluster** (ui/localClusterPage.js)

Added an Import Cluster panel to the Local Cluster page. Users can
paste a tab-separated table of star systems (name, coordinates,
distance, constituents) to replace the generated neighbourhood with
custom data.

The parser handles:

- Tab-separated columns with optional header row
- Coordinates in `(x, y, z)` format
- Spectral types: main sequence (F9V, MV, KV), giants (MIII),
  brown dwarfs (L, T), white dwarfs (D)
- Multi-star systems via `+` separator (e.g. `MV + MV`, `L + L + T`)
- Trailing notes stripped (e.g. `MIII, originally GV`)
- Home system auto-detected from `(0, 0, 0)` coordinates
- Neighbourhood radius auto-expanded to fit farthest system
- System names preserved (including Unicode)

## 1.9.0

### Tidal Heating

**Wisdom (2008) eccentricity-accurate tidal dissipation model**
(engine/moon.js, ui/moonPage.js, ui/sciencePage.js)

Added a full tidal heating calculation for moons using the standard
Peale, Cassen & Reynolds (1979) formula with the Wisdom (2004/2008)
eccentricity function replacing the simple e² truncation:

    Ė = (21/2)(k₂/Q)(G M_p² R_m⁵ n / a⁶) · f(e)

The eccentricity function f(e) uses a polynomial series accurate to
<0.1% for e < 0.8, giving correct heating at high eccentricities
where the e² truncation underestimates by 5× at e=0.3 and 30× at
e=0.5.

Love number k₂ and quality factor Q are derived from bulk density
via a 10-point interpolation table spanning 0.5–8.0 g/cm³, with
rigidity interpolated in log-space for physical accuracy.

Outputs include total power (W), surface heat flux (W/m²), and flux
normalised to Earth's mean geothermal heat (0.09 W/m²).

### Composition Override System

**Interior-state-aware material properties** (engine/moon.js,
ui/moonPage.js, ui/store.js)

Bulk density is a reliable proxy for cold, geologically quiet moons,
but systematically underestimates heating for bodies with extreme
interiors. Two calibrated override classes address this:

| Class            | μ (GPa) | Q   | Calibration target | Accuracy |
| ---------------- | ------- | --- | ------------------ | -------- |
| Partially molten | 10      | 10  | Io (10¹⁴ W)        | ~1%      |
| Subsurface ocean | 0.3     | 2   | Enceladus (10¹⁰ W) | ~10%     |

A composition override dropdown on the Moon page allows users to
select from seven classes: Very icy, Icy, Mixed rock/ice, Rocky,
Iron-rich, Subsurface ocean, and Partially molten. "Auto (from
density)" is the default.

### Tidal Recession

**Orbital migration rate and fate** (engine/moon.js, ui/moonPage.js)

Computes da/dt from two competing tidal torques using the constant-
time-lag model (Leconte et al. 2010):

- **Planet tide** — when the planet spins faster than the moon
  orbits, angular momentum transfers outward (Earth–Moon: +3.8 cm/yr)
- **Moon tide** — eccentricity damping always drives inward migration

Linear extrapolation estimates time to Roche limit (inward) or Hill
sphere escape (outward). Output includes recession rate (cm/yr),
direction, and orbital fate.

### Solar System Validation

**NASA reference data and validation suite** (references/,
scripts/tidal-heating-validation.mjs)

Added 14 NASA factsheet reference files compiled from JPL Solar
System Dynamics and science.nasa.gov, covering the Sun, all eight
planets, Earth's Moon, the four Galilean satellites, Saturn's major
moons, and Triton.

A validation script tests WorldSmith predictions against observed
Solar System values:

| Body           | Override         | Predicted / Observed     |
| -------------- | ---------------- | ------------------------ |
| Io             | Partially molten | 1.01×                    |
| Enceladus      | Subsurface ocean | 1.11×                    |
| Europa         | —                | 1.42×                    |
| Earth's Moon   | —                | 0.91×                    |
| Moon recession | —                | 0.90× (3.5 vs 3.8 cm/yr) |

### Science Page Updates

**Two new equations** (ui/sciencePage.js)

Added Tidal Heating and Tidal Recession formulas to the Orbital
Mechanics section with full variable legends, the composition class
table, calibration rationale, and validation summary. The science
page now documents 66 equations across ten sections.

### Moon Page Enhancements

**New outputs and tooltips** (ui/moonPage.js)

- Six new KPI cards: Tidal Heating (total power, surface flux, Earth
  comparison), Orbital Recession (rate, direction), and Orbital Fate
- Expanded tooltips for Composition and Composition Override
  explaining the physical meaning of each class, when to use each
  override, calibration notes, and caveats

**Tests** (tests/moon.test.js)

- 36 moon tests total (up from 20), including:
- Io tidal heating ~10¹⁴ W order of magnitude
- Enceladus with Subsurface ocean matches ~1.6×10¹⁰ W
- Higher-order e: e=0.3 produces much more heating than e² truncation
- Earth–Moon recession ≈ 3.8 cm/yr outward
- Fast/slow planet spin → outward/inward recession
- Composition override uses correct μ/Q values
- Override null falls back to density-derived

**References**

- Peale, S. J., Cassen, P. & Reynolds, R. T. (1979), "Melting of Io
  by Tidal Dissipation", Science 203, 892–894
- Wisdom, J. (2004), "Spin-Orbit Secondary Resonance Dynamics of
  Enceladus", AJ 128, 484–491
- Wisdom, J. (2008), "Tidal dissipation at arbitrary eccentricity and
  obliquity", Icarus 193, 637–640
- Leconte, J. et al. (2010), "Tidal dissipation within hot Jupiters:
  a new appraisal", A&A 516, A64

## 1.8.1

### Atmospheric System & Greenhouse Effect Overhaul

**Three-mode greenhouse calculation** (engine/planet.js, ui/planetPage.js)

Overhauled the rocky planet atmospheric system with a new tiered
greenhouse effect model:

- **Core mode** — Derives the greenhouse optical depth (tau) from
  atmospheric composition using species-specific absorption
  coefficients for CO2, H2O, CH4, and H2-N2 collision-induced
  absorption (CIA). Includes cross-suppression logic: H2O contribution
  is reduced in CO2-dominated atmospheres (Venus-like), and SO2 is
  suppressed under high CO2 partial pressures.
- **Full mode** — Extends Core with additional trace gases (SO2, NH3,
  H2, He) for fine-grained control over exotic atmospheres.
- **Manual mode** — Bypasses all gas-based calculation and applies a
  user-specified greenhouse effect value directly.

Gas balance enforces physical consistency: the nine tracked gases
(N2, O2, CO2, Ar, H2O, CH4, SO2, NH3, He) always sum to 100%, with
N2 acting as the remainder gas.

### Sol Preset NASA Corrections

**Cross-referenced against NASA Planetary Fact Sheet**
(ui/solPreset.js, tests/importExport.test.js)

All Sol preset values audited and corrected to match the NASA
Planetary Fact Sheet:

| Body    | Field           | Old      | New       |
| ------- | --------------- | -------- | --------- |
| Mercury | Axial tilt      | 0.03°    | 0.034°    |
| Venus   | Eccentricity    | 0.0068   | 0.0067    |
| Venus   | Rotation period | 5832.0h  | 5832.5h   |
| Venus   | Argon %         | 3.5%     | 0.007%    |
| Earth   | Rotation period | 24.0h    | 23.934h   |
| Mars    | Eccentricity    | 0.0934   | 0.0935    |
| Mars    | O2 %            | 0.13%    | 0.146%    |
| Mars    | CO2 %           | 95.3%    | 95.32%    |
| Jupiter | Semi-major axis | 5.20 AU  | 5.203 AU  |
| Saturn  | Semi-major axis | 9.58 AU  | 9.583 AU  |
| Saturn  | Radius          | 0.84 Rj  | 0.843 Rj  |
| Uranus  | Semi-major axis | 19.2 AU  | 19.19 AU  |
| Uranus  | Radius          | 0.36 Rj  | 0.357 Rj  |
| Uranus  | Mass            | 0.046 Mj | 0.0457 Mj |
| Neptune | Semi-major axis | 30.05 AU | 30.07 AU  |
| Neptune | Radius          | 0.35 Rj  | 0.346 Rj  |

### Local Cluster Manual Editing

**Add/remove stars and companions** (ui/localClusterPage.js,
ui/store.js, ui/vizClusterRenderer.js, styles.css)

Added interactive editing to the Local Cluster page:

- **Random seed button** — generates a new random seed and
  regenerates the cluster in one click.
- **+/− buttons** on the Stellar Object Breakdown table — manually
  add or remove systems of any spectral class. Added systems receive
  random coordinates within the neighbourhood sphere (cube-root
  uniform-in-volume sampling with disk z-compression).
- **Right-click context menu** on the Star System Coordinates table —
  add or remove companion stars to change system multiplicity
  (single → binary → triple → quadruple, max 4 components). Users
  select the companion's spectral class from a visual menu.
- **Confirmation prompt** — Apply, Randomise, and Reset actions warn
  the user before discarding manual adjustments.
- **Visualiser sync** — manually added or modified systems appear
  correctly in the 3D cluster visualiser.

Adjustments are stored as a layered data model
(`clusterAdjustments`) on top of the engine-generated baseline and
persist across page navigation. They are cleared when Apply or Reset
regenerates the cluster from seed.

## 1.8.0

### Sky Colour Calculations

**Gravity, temperature, and CO₂ corrections** (engine/planet.js,
ui/planetPage.js)

Sky colours now account for atmospheric column density via scale height.
Lower gravity or higher surface temperature increases the column depth,
shifting colours toward thicker-atmosphere look-up table entries.
CO₂-rich atmospheres receive a warm amber tint, with strength
proportional to the square root of CO₂ fraction (perceptually gradual
curve, negligible at Earth-like 0.04%).

Effective pressure is computed as:

    P_eff = P_surface × (T / T⊕) × (g⊕ / g)

Colour interpolation uses OKLab space for perceptual uniformity. Two
KPI cards display the results: "Sky Colour (Sun High)" and "Sky Colour
(Low Sun)", each with a radial gradient swatch and hex value.

**References**

- PanoptesV radiative-transfer simulations
  (panoptesv.com/SciFi/ColorsOfAlienWorlds/AlienSkies.php)
- Bjorn Ottosson (2020), "A perceptual color space for image
  processing" (OKLab)

### Vegetation Colours (0.1–100 atm)

**Pressure-dependent plant colour range with tidally locked variants**
(engine/planet.js, ui/planetPage.js)

Plant colours now span 0.1 to 100 atm via log-pressure interpolation
across a two-dimensional look-up table keyed by spectral class (A0–M9)
and pressure (1, 3, 10 atm anchors). Below 1 atm the 1→3 atm trend is
reversed with 50% dampening; above 10 atm the 3→10 atm trend continues
with 50% dampening.

Tidally locked planets orbiting K- and M-class stars receive dedicated
twilight-adapted vegetation variants — paler, more tan/brown colours
reflecting permanent terminator-zone conditions where plants receive
only scattered and refracted starlight. An insolation-darkening factor
is applied to all variants: low-light environments favour
broader-spectrum absorption (darker pigments).

Output is a 6-stop gradient from pale to deep, with a Details button
revealing the full colour breakdown on hover.

**References**

- Kiang, N. Y. et al. (2007), "Spectral Signatures of Photosynthesis.
  II. Coevolution with Other Stars and the Atmosphere on Extrasolar
  Worlds", Astrobiology 7, 252–274
- Lehmer, O. R. et al. (2021), "Peak Absorbance Wavelength of
  Photosynthetic Pigments Around Other Stars From Spectral Optimization",
  Frontiers in Astronomy and Space Sciences 8, 689441
- Arp, T. B. et al. (2020), "Quieting a Noisy Antenna Reproduces
  Photosynthetic Light-Harvesting Spectra", Science 368, 1490–1495

### Science & Maths Reference Page

**New page** (ui/sciencePage.js)

A comprehensive reference documenting all 61 equations used across the
engine, organised into nine sections: Stellar Physics, Planetary
Physics, Orbital Mechanics, Photometry & Magnitudes, Atmosphere &
Colour, Stellar Activity, Calendar Systems, Local Cluster, and System
Architecture.

Each equation includes:

- LaTeX-rendered formula (via KaTeX, loaded on demand from CDN)
- Variable legend with units
- Plain-language explanation and calibration notes
- Citation to the originating paper or textbook

Seven interactive calculators are embedded for live exploration:
mass-to-luminosity, habitable zone, planet density, H-magnitude, flare
rate, leap cycles, and galactic habitable zone probability.

### Planet Temperature Accuracy

**Scaled surface divisor and recalibrated Sol preset**
(engine/planet.js, ui/solPreset.js)

The four-step temperature chain (Stefan-Boltzmann energy balance →
Eddington grey-atmosphere greenhouse → surface correction → fourth-root
recovery) is unchanged in structure, but the surface divisor — which
accounts for the temperature difference between the atmospheric
effective-emission level and the surface — now ramps with optical depth
instead of being a flat 0.9:

    surfDiv = 1 − (1 − 0.9) × min(τ, 1)

This gives 1.0 for airless bodies (τ = 0) and 0.9 for Earth-like or
thicker atmospheres (τ ≥ 1). The old flat divisor inflated airless-body
temperatures by ~2.7% (e.g. Mercury: +12 K, Mars: +7 K).

Sol preset values recalibrated against NASA Planetary Fact Sheet data:

| Planet  | Old GH | New GH | Model | NASA  | Error |
| ------- | ------ | ------ | ----- | ----- | ----- |
| Mercury | 0.0    | 0.0    | 440 K | 440 K | 0 K   |
| Venus   | 200.0  | 217.0  | 737 K | 737 K | 0 K   |
| Earth   | 1.65   | 1.19   | 288 K | 288 K | 0 K   |
| Mars    | 0.15   | 0.05   | 211 K | 210 K | +1 K  |

Bond albedos also updated to match NASA values (Mercury: 0.088 → 0.068,
Venus: 0.77 → 0.76).

### General UI Improvements

**Expandable KPI cards** (styles.css, all page files)

KPI output cards now expand on hover to reveal additional detail. The
card itself grows — background, borders, and gradients extend seamlessly
with the content. A `.kpi-wrap` container holds the grid slot while the
inner card lifts to `position: absolute`, overlaying neighbours without
pushing content below. A chevron indicator marks cards with hidden
detail. Closing is instant (no transition) to prevent layout shift.

**Contrast-aware text** (engine/utils.js, ui/planetPage.js,
ui/starPage.js)

Text colour on colour-swatch KPIs (sky colour, vegetation, star colour)
now automatically switches between dark and light based on WCAG 2.0
relative luminance of the background. A `data-light` attribute is
computed from `relativeLuminance(hex)` at a threshold of 0.18, and CSS
rules adjust label, value, meta, tooltip, and chevron colours
accordingly.

**Unified outputs and tooltips** (all page files)

Tooltip dictionaries expanded across all pages to cover new features
(gravity correction, CO₂ tint, twilight variants, greenhouse effect,
atmospheric composition). Engine files received JSDoc headers and
`@param`/`@returns` documentation for all exported functions.

## 1.7.0

### Unified Visualiser

The System Visualiser and Local Cluster Visualiser are now a single page.
Zoom out past the outermost system object and the view seamlessly transitions
into the 3D local stellar neighbourhood — no page navigation required. Zoom
back into the home star to return to the system view.

- **Single canvas, two modes** — the draw loop dispatches to either the system
  renderer or the cluster renderer based on the current mode. Controls in the
  dropdown swap dynamically (system toggles vs cluster toggles).
- **Zoom-based transitions** — shrink → mode switch → expand animation plays
  entirely on one canvas. A progress bar appears at the bottom as you
  approach the transition threshold.
- **First-load toast** — "Tip: Zoom out past the system to view your local
  stellar neighbourhood" appears until the user completes the transition once
  (tracked in localStorage).
- **Representative body zoom scaling** — planets, gas giants, and moons now
  grow proportionally as you zoom in on representative scale (zoom^0.4
  factor). Physical-scale mode is unchanged.
- Navigation consolidated: both top-nav and side-nav now show a single
  "Visualiser" entry instead of separate System / Cluster links.
- Cluster rendering extracted into `ui/vizClusterRenderer.js` as pure
  functions (no closure dependencies on page state).

### Stellar Metallicity [Fe/H]

**New input** (engine/star.js, ui/starPage.js)

Added stellar metallicity [Fe/H] as a worldbuilding input — a slider ranging
from −3.0 (extreme metal-poor halo) to +1.0 (super-metal-rich), defaulting to
0.0 (solar). Metallicity does not modify the Eker mass–luminosity or
mass–radius relations (their empirical scatter already includes metallicity
variation). Instead it drives two new downstream outputs:

- **Giant Planet Probability** — Fischer & Valenti (2005, ApJ 622, 1102)
  scaling: P = 10% × 10^(2·[Fe/H]). At solar metallicity the probability is
  ~10%; at [Fe/H] = +0.3 it rises to ~40%; at [Fe/H] = −0.5 it drops to ~1%.
  Baseline from Cumming et al. (2008, PASP 120, 531).
- **Stellar Population label** — Pop I (solar neighbourhood), Intermediate
  (old thin disk), Pop II (metal-poor halo/thick disk), or Metal-rich (inner
  disk).

Both appear as KPI cards in the Star page outputs panel.

**References**

- Fischer, D. A. & Valenti, J. (2005), "The Planet–Metallicity Correlation",
  ApJ 622, 1102–1117
- Cumming, A. et al. (2008), "The Keck Planet Search: Detectability and the
  Minimum Mass and Orbital Period Distribution of Extrasolar Planets", PASP
  120, 531–554

### Star Generation — Scientific Accuracy Overhaul

**Mass-Luminosity Relation** (engine/star.js)

Replaced the classical textbook three-piece approximation (L = 0.23 M^2.3 /
M^4 / 1.4 M^3.5) with the Eker et al. (2018, MNRAS 479, 5491) six-piece
empirical relation, calibrated from 509 detached eclipsing binary components.

The old formula significantly overestimated luminosity for K-dwarf and low-mass
M-dwarf stars — by 33–86% in the 0.5–0.9 Msol range — which cascaded to:

- Maximum age underestimated by 25–46% (e.g. a 0.70 Msol K5V star showed
  ~29 Gyr instead of ~46 Gyr)
- Habitable zone pushed ~25% too far out (HZ scales as sqrt(L))
- Effective temperature and spectral class off by ~1 subtype for K dwarfs

The new relation uses Eker's published exponents with coefficients adjusted to
enforce continuity at each mass boundary and to anchor L = 1.0 at M = 1.0 Msol
(all adjustments within Eker's quoted uncertainties).

| Segment                   | Mass range     | Exponent (alpha) |
| ------------------------- | -------------- | ---------------- |
| Fully convective M dwarfs | < 0.45 Msol    | 2.028            |
| Late-K / early-M          | 0.45–0.72 Msol | 4.572            |
| Solar-type (G/K)          | 0.72–1.05 Msol | 5.743            |
| F/A stars                 | 1.05–2.40 Msol | 4.329            |
| B stars                   | 2.40–7.0 Msol  | 3.967            |
| O / early-B               | > 7.0 Msol     | 2.865            |

**Mass-Radius Relation** (engine/star.js)

Replaced the simple power-law (R = M^0.8 for M < 1, R = M^0.57 for M >= 1)
with:

- M <= 1.0 Msol: Eker et al. (2018) quadratic from eclipsing binaries
  (R = 0.438 M^2 + 0.479 M + 0.075, normalised to R = 1.0 at M = 1.0)
- M > 1.0 Msol: R = M^0.57 (Demircan & Kahraman 1991), continuous at boundary

The quadratic improves radius accuracy for K dwarfs (e.g. Alpha Centauri B
error drops from +8% to +2%).

**Tooltips** (ui/starPage.js)

Updated Luminosity, Radius, Maximum Age, and override tooltips to cite the
Eker et al. (2018) source and explain the derivation method.

**Tests** (tests/star.test.js)

- Replaced old formula-branch tests with new Eker segment verification tests
- Added MLR continuity test across all 5 segment boundaries
- Added MLR monotonicity test across full mass range
- Added MRR continuity test at M = 1.0 boundary
- Added benchmark star accuracy tests: 61 Cyg A, epsilon Eridani, Alpha Cen A/B,
  Sirius A (all within 15% of observed luminosities; most within 10%)

**References**

- Eker, Z. et al. (2018), "Interrelated main-sequence mass–luminosity,
  mass–radius and mass–effective temperature relations", MNRAS 479, 5491–5511.
  arXiv:1807.02568
- Demircan, O. & Kahraman, G. (1991), "Stellar mass-luminosity and
  mass-radius relations", Ap&SS 181, 313–322
