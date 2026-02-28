# Three.js Native Migration (Complete Rewrite)

## Scope

Replace HTML5 Canvas2D render surfaces with native Three.js scene rendering and shader/material pipelines, then provide generated 3D-rendered asset sprites for all body families.

## Migration Plan

1. Inventory every Canvas2D render surface and preserve behaviors/toggles.
2. Implement native Three runtime per major page (visualizer, poster, apparent sky).
3. Replace preview canvases with native Three shader/material previews.
4. Generate a complete asset pack (stars, rocky, moons, gas giants, debris) and wire deterministic mappings.
5. Keep Canvas2D fallback only for runtime failure, not as primary path.
6. Validate with syntax, lint, tests, and production build.

## Implemented Components

### Native renderers

- `ui/visualizerPage.js`: Native Three system/cluster rendering path, asset sprites, labels, rings, moons, orbital elements, and interactive hit regions.
- `ui/systemPosterNativeThree.js`: Native Three poster renderer with labels, guides, starfield, zones, debris bands, moons, and gas rings.
- `ui/apparentSkyNativeThree.js`: Native Three apparent-sky renderer with split/unified scale behavior, moon phase darkening, reference rings, labels, and day/night treatment.
- `ui/threeNativePreview.js`: Native Three shader-material previews for rocky, moon, and gas style canvases.

### Asset pipeline

- Generator: `scripts/generate-three-render-assets.mjs`
- Output root: `assets/three-renders/`
- Mapping layer: `ui/threeRenderAssetMap.js`
- NPM script: `npm run assets:three`

### Generated asset coverage

- Stars: 8 spectral render assets (`o,b,a,f,g,k,m,d`)
- Gas giant styles: 17 assets (all `GAS_GIANT_STYLES` — realistic only)
- Rocky variants: 19 assets (recipes + fallback classes)
- Moon variants: 17 assets (recipes + fallback classes)
- Debris disk variants: 6 assets

## Integration Status

- [x] Visualizer large canvas native-first
- [x] System poster large canvas native-first
- [x] Apparent sky large canvas native-first
- [x] Rocky/gas/moon 180x180 previews native
- [x] Rocky/gas/moon 90x90 recipe previews native
- [x] Asset bundle generated and mapped
- [x] Runtime cleanup/disposal hooks for native canvases

## Verification

- [x] `npm run check:syntax`
- [x] `npm run lint`
- [x] `npm run test`
- [x] `npm run build`

## Notes

- The renderer is now native Three-first across migrated canvases.
- Canvas2D code remains as resilience fallback where native initialization is unavailable.

## Parity Audit vs v1.13.0 Canvas

Status keys:

- `Tests`: Testing complete. Feature working.
- `Implemented`: Native Three path appears feature-complete.
- `Partial`: Native Three path exists but behavior differs from v1.13.0 canvas logic.
- `Missing`: No native equivalent currently in active Three path.

### Visualiser - System View (`ui/visualizerPage.js`)

1. `Tested` - Orbit pan/zoom controls and hit regions.
2. `Tested` - Label toggle for star/planets/gas/moons/debris.
3. `Tested` - Distance label toggle (AU text).
4. `Tested` - Log vs linear AU scaling.
5. `Tested` - Representative vs physical size mode switch.
6. `Tested` - Body scale slider wiring in representative mode.
7. `Tested` - AU grid rendering in native path (`chk-grid`).
8. `Tested` - Habitable zone band (native band exists, style/label placement differs).
9. `Tested` - Frost line rendering (native ring exists, dashed style/label behavior differs).
10. `Tested` - Debris disk bands and particles (native curved bands + density-varied particle fields + labels).
11. `Tested` - Rocky/gas orbit rings in circular mode.
12. `Tested` - Eccentric rocky/gas orbit ring geometry.
13. `Tested` - Pe/Ap markers for rocky/gas eccentric orbits.
14. `Tested` - Hill sphere markers for rocky/gas bodies.
15. `Tested` - Lagrange markers for rocky/gas bodies with focused L1-L3 reveal.
16. `Tested` - Planet rendering (native uses sprite assets, not full procedural rocky draw path).
17. `Tested` - Gas giant rendering (native uses sprite assets and simplified ring treatment).
18. `Tested` - Moon rendering (native uses sprite assets, simplified shading/placement).
19. `Tested` - Moon orbit rings, including eccentric/inclined paths.
20. `Tested` - Moon Pe/Ap markers in native path.
21. `Removed` - Rotation overlay helpers (`chk-rotation`) in native path.
22. `Removed` - Axial tilt overlay helpers (`chk-axial-tilt`) in native path.
23. `Tested` - Sub-pixel physical-mode crosshair indicators (`PHYS_VIS_THRESHOLD_PX` behavior).
24. `Tested` - Collision-aware body-label placement for native planet/gas labels.
25. `Tested` - Depth-aware body layering around the star (front/back ordering).
26. `Tested` - Star flare/CME burst overlay parity in native path.
27. `Tested` - Transition progress bars + threshold-trigger handling in native system path.

### Visualiser - Cluster View (`ui/visualizerPage.js` + `ui/vizClusterRenderer.js`)

1. `Implemented` - Native cluster scene camera/orbit controls and plotted systems.
2. `Implemented` - Cluster labels toggle (name + metadata labels).
3. `Implemented` - Cluster links toggle.
4. `Implemented` - Cluster axes toggle with X/Y/Z lines and labels.
5. `Implemented` - Range grid toggle with rings, bearing ticks, and labels.
6. `Implemented` - Bearing unit parity (degrees vs mils labels).
7. `Partial` - Hover pick/tooltip parity (native hover labels exist; dense-scene behavior still differs).
8. `Implemented` - Cursor pointer-on-hover behavior parity.
9. `Implemented` - Label collision placement parity for dense clusters.
10. `Partial` - Star/system marker styling and metadata label parity (canvas had richer labels).
11. `Implemented` - Cluster transition progress bar and threshold trigger handling in native draw path.

### System Poster (`ui/systemPage.js` + `ui/systemPosterNativeThree.js`)

1. `Tested` - Poster canvas native runtime and resize behavior.
2. `Tested` - Toggle plumbing for labels/moons/hz/frost/debris/guides/starfield/scale.
3. `Tested` - Starfield points.
4. `Tested` - Habitable zone geometry (native uses curved, star-centered arc bands with boundary strokes).
5. `Tested` - Frost line style and label parity (native dashed line + label).
6. `Tested` - Debris disk geometry and particle treatment parity (curved arcs + seeded particle fields + labels).
7. `Tested` - Guide line visual parity (horizontal orbit lines from star edge to each body).
8. `Tested` - Star rendering parity (procedural `renderStarSnapshot` with corona, limb darkening, surface texture).
9. `Tested` - Planet rendering parity (procedural `renderCelestialRecipeSnapshot` with visual profiles).
10. `Tested` - Gas giant rendering parity (procedural `renderCelestialRecipeSnapshot` with style-specific bands, storms; ring camera pullback scales dynamically to ring outer radius).
11. `Tested` - Moon rendering parity (procedural `renderCelestialRecipeSnapshot` with moon visual profiles).
12. `Tested` - Body and AU labels.
13. `Tested` - Empty-system poster message parity.

### Apparent Sky (`ui/apparentPage.js` + `ui/apparentSkyNativeThree.js`)

1. `Implemented` - Native runtime and resize.
2. `Tested` - Split-scale logic for large star vs non-star objects.
3. `Tested` - Day/night background parity (zenith-to-horizon gradient using planet-generated sky colours; night uses fixed deep-blue gradient).
4. `Tested` - Night starfield points.
5. `Tested` - Star disk/glow parity (procedural `renderStarSnapshot` with corona, limb darkening, surface texture).
6. `Tested` - Reference ring style parity (dotted Sol/Luna rings on first object, Jupiter ring on last; italic labels, brightness-adaptive ring colour).
7. `Tested` - Moon phase shading parity (arc+ellipse crescent shadow overlay driven by moon phase slider).
8. `Tested` - Body rendering parity (procedural `renderCelestialRecipeSnapshot` for rocky, gas, and moon bodies; log-scale sizing for sub-pixel objects; magnitude-based glow).
9. `Tested` - Body and angular-size labels.
10. `Tested` - No-objects center message parity.

### Small Previews and Recipe Canvases (`ui/rockyPlanetStyles.js`, `ui/gasGiantStyles.js`, `ui/moonStyles.js`, `ui/threeNativePreview.js`)

1. `Tested` - 180x180 rocky preview native path.
2. `Tested` - 180x180 gas giant preview native path.
3. `Tested` - 180x180 moon preview native path.
4. `Tested` - 90x90 rocky recipe preview native path.
5. `Tested` - 90x90 gas giant recipe preview native path.
6. `Tested` - 90x90 moon recipe preview native path.
7. `Tested` - Visual fidelity parity with legacy procedural canvas previews (native uses baked texture assets + shader lighting).
8. `Removed` - Canvas fallback retained on native load failure.

### Unified Celestial Preview (`ui/celestialVisualPreview.js` + `ui/celestialComposer.js`)

1. `Tested` - `starVisualPreview` promoted to `celestialVisualPreview` with compatibility re-export.
2. `Tested` - Unified controller supports star, rocky planet, gas giant, and moon preview models.
3. `Tested` - Planet and Moon KPI appearance cards now use the unified animated controller.
4. `Tested` - Preview timebase standardised to `0.5` simulated Earth days per second.
5. `Tested` - Modular layer stack composer (`base`, `continents`, `ocean`, `ice`, `clouds`, `craters`, `bands`, `storms`, `fractures`, `molten fissures`).
6. `Tested` - Rule-driven model composition from existing physics outputs and visual profiles.
7. `Tested` - LOD tiers (`tiny`, `low`, `medium`, `high`) with hover-aware promotion.
8. `Tested` - Deterministic seeded generation and descriptor texture caching.
9. `Tested` - Preset asset manifest generation for established families (`scripts/generate-celestial-preset-assets.mjs`, `assets/celestial-presets/manifest.json`).
10. `Tested` - Full suite art-profile mapping for established rocky/moon recipes and gas styles, with modular layer directives (`ui/celestialArtProfiles.js`) and expanded texture modules (dunes, caustics, rifts, impacts, shears, haze/plumes).
11. `Tested` - Preview quality pass: higher LOD texture tiers, physically based body material, and generated normal/roughness/emissive maps for richer planetary/moon surface lighting.

### Export and Utility Surfaces

1. `Implemented` - PNG export from rendering canvas.
2. `Implemented` - GIF capture from rendering canvas.
3. `Implemented` - Native renderer preserveDrawingBuffer path for export capture.

### Canvas2D Touchpoint Review (2026-02-25)

- `Primary render surfaces`: Visualiser, System Poster, Apparent Sky, and 180/90 previews are all Three-native-first.
- `Fallback-only 2D paths`: `ui/visualizerPage.js`, `ui/systemPage.js`, `ui/apparentPage.js`, `ui/rockyPlanetStyles.js`, `ui/gasGiantStyles.js`, `ui/moonStyles.js`.
- `2D utility for native`: text-to-texture canvas in `ui/visualizerPage.js`, `ui/systemPosterNativeThree.js`, `ui/apparentSkyNativeThree.js`.
- `Compatibility bridge`: offscreen 2D bridge in `ui/threeBridge2d.js` remains available but is not the active render path.

## QA Execution Template

Use this section while testing from top to bottom.

### Test Worlds (freeze these first)

1. `W1 Sol baseline`: normal, known-good reference.
2. `W2 Dense stress`: many planets/moons/debris for label and overlap stress.
3. `W3 Eccentric stress`: high eccentricity/inclination for orbit/marker stress.

### Pass Rule (write before testing each item)

- `Pass criterion`: one sentence describing exactly what must be true.
- `Scope`: which mode/page + toggles must be on.
- `Evidence`: screenshot or note with exact state.

### Per-Item Log Template

Copy this block for each parity item you test:

```md
#### [Section] Item X - <feature name>

- Result: Pass | Partial | Fail
- World: W1 | W2 | W3
- Mode/Page: System | Cluster | Poster | Apparent | Preview
- Camera state: zoom=<value>, pan=<value>, yaw=<value>, pitch=<value>
- Toggles used: <list>
- Pass criterion: <one sentence>
- Observed behavior: <one sentence>
- Evidence: <screenshot filename or short reference>
- Regression check: Export PNG/GIF + fullscreen + play/pause (Pass/Fail)
- Notes: <optional>
```

### Suggested Execution Order

1. Test all `Implemented` visualiser items once in `W1`, then spot-check in `W2` and `W3`.
2. Test every `Partial` item in all three worlds.
3. After every 5 items, run a quick regression sweep:
   `labels`, `hit regions`, `fullscreen`, `transitions`, `PNG/GIF export`.
4. Reclassify each item status in this document immediately after testing.
