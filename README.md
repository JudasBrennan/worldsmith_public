# WorldSmith Web 1.21.0

WorldSmith Web is a browser-based worldbuilding toolkit by Judas Brennan for generating stars, planetary systems, planets, moons, debris disks, local stellar neighborhoods, and supporting reference outputs for tabletop and fiction workflows.

This project is based on WorldSmith 8.0 by Artifexian.

## Current Highlights

- Star modelling with metallicity, advanced R/L/T overrides, stellar evolution, and animated flare/CME preview.
- Planetary system generation with habitable zone, frost line, orbit-slot assignment, and system poster view.
- Rocky planets with composition, atmosphere, magnetic field, tectonics, sky/vegetation colours, periapsis/apoapsis temperatures, volatile sublimation flags, and gas giant resonance.
- Gas giants with eccentricity/inclination/tilt inputs, Christensen energy-flux dynamo, Chapman-Ferraro magnetopause with moon plasma inflation, per-species Jeans escape, and spin-orbit resonance.
- Moons with tidal heating, tidal recession, volatile inventory, surface ices, thin atmospheres, and magnetospheric radiation.
- Unified body rendering pipeline across Planet, System Poster, Visualiser, and Apparent views.
- Resonance-driven debris disk suggestions and derived disk physics.
- Tectonics with mountain ranges, shield volcanoes, rift valleys, seafloor spreading, and plate canvas with Voronoi tessellation.
- Climate zones with latitude-based Koppen classification, aridity profiles, and tidally-locked zone modelling.
- Population modelling with carrying capacity, logistic growth, land-use cascades, and Zipf rank-size distribution.
- Apparent size and brightness modelling for stars, planets, and moons.
- Calendar builder for solar, lunar, and lunisolar systems.
- Local cluster generator with editable nearby systems.
- Desktop sidebar with collapsible rail, persistent lock-open control, light/dark mode toggle, and splash-screen toggle.
- Lessons page with 20-lesson progressive curriculum, Basic/Advanced toggle, and embedded mini-calculators.
- Science and Maths reference page with equations and interactive calculators.
- Import/export with JSON, legacy WorldSmith 8.x XLSX import, and built-in presets.

## App Sections

- `Star`
- `Planetary System`
- `Planets`
- `Moons`
- `Other Objects`
- `Local Cluster`
- `Visualiser`
- `Import/Export`
- `Apparent Size and Brightness`
- `Tectonics`
- `Climate Zones`
- `Population`
- `Calendar`
- `Lessons`
- `Science and Maths`
- `About WorldSmith`

## Local Development

Install dependencies first:

```bash
npm install
```

Recommended development workflow:

```bash
npm run dev
```

Then open `http://127.0.0.1:4173`.

This command:

- builds the app into `dist-dev/`
- serves `dist-dev/` with the project static server
- watches the repo and rebuilds automatically when source or asset files change

Refresh the browser after a rebuild to see changes. This workflow does not inject Live Server reload scripts, so it remains compatible with the app's CSP.

For a production-style local serve without watch mode:

```bash
npm run build
npm run serve
```

Do not use the raw project root with VS Code Live Server. The app now relies on npm-managed modules that are bundled for browser delivery, and Live Server also injects an inline reload script that the CSP blocks.

## Developer Setup

Requirements:

- Node.js 20+ recommended
- npm

Install dependencies:

```bash
npm install
```

Install the Playwright browser once for local browser smoke tests:

```bash
npx playwright install chromium
```

## NPM Scripts

- `npm run check:syntax` - Validate JavaScript syntax across the project.
- `npm run check:runtime-deps` - Validate bundled runtime dependency configuration.
- `npm run check:mojibake` - Detect UTF-8 mojibake and replacement-character corruption in text files.
- `npm run check:bundle-budget` - Verify the built entry bundle and largest lazy chunk stay within budget.
- `npm run lint` - Run ESLint.
- `npm run lint:fix` - Run ESLint with auto-fixes.
- `npm run format:check` - Check formatting with Prettier.
- `npm run format` - Apply Prettier formatting.
- `npm run serve` - Serve the built `dist/` folder locally.
- `npm run serve:dist` - Serve the built `dist/` folder locally for smoke testing.
- `npm run dev` - Build, serve, and rebuild `dist/` automatically for local development.
- `npm run test:engine` - Run engine-focused tests.
- `npm run test:ui` - Run UI-focused tests.
- `npm run test:browser` - Run Playwright smoke tests against the built production app.
- `npm run test` - Run the full test suite with custom reporter output.
- `npm run test:report` - Generate `test-results.md`.
- `npm run check` - Run syntax, runtime dependency, mojibake, lint, format, and test checks.
- `npm run assets:runtime` - Sync KaTeX and Draco runtime assets into `assets/vendor/`.
- `npm run build` - Bundle production files into `dist/`.
- `npm run backup:live` - Create a zip backup of live deploy files in `Backup/`.
- `npm run profile:engine` - Run the engine profiling harness and compare against the checked-in baseline.
- `npm run release:verify` - Run checks, build, bundle budget verification, and browser smoke tests.

## Build Output

`npm run build` creates a production `dist/` folder:

- Bundled production JavaScript (`app.js`, route chunks as needed, worker bundle)
- Copied only the runtime files and assets needed for deployment
- `index.html` with cache-busting query strings removed
- `build-summary.json` with machine-readable entry and lazy-chunk size metadata for release verification

## Data Storage and Safety

- World data is stored in browser storage, primarily IndexedDB with `localStorage` reserved for lightweight settings and migration markers.
- Debounced world saves are flushed when the tab is hidden or closed, reducing the risk of losing the latest edits during shutdown.
- If the current saved world becomes unreadable, the app now shows a recovery flow that clears only the broken current save while preserving backups.
- Imports create in-app restore points before replacement.
- Export/import JSON is the recommended way to move worlds between browsers or devices.
- Built-in presets are available for Sol, Realmspace, and Arrakis.
- Clearing browser site data removes local saves.

## Release Verification

- `npm run release:verify` is the automated pre-release gate.
- `RELEASE_CHECKLIST.md` covers the manual clean-install, build-output, and browser-pass steps.

## Runtime Dependencies

Critical client-side libraries are now sourced from the local npm install in development and bundled into the production build:

- Three.js for WebGL rendering and previews
- XLSX for WorldSmith 8.x workbook import
- KaTeX for formula rendering on the Science and Maths and Lessons pages

Static runtime assets required by these libraries are synced into `assets/vendor/` during `npm install` and before `npm run build`.

WorldSmith no longer relies on remote runtime fallbacks for core browser features. If a local runtime asset fails to load, the app surfaces a local-only error instead of loading a CDN substitute.

## Repository Layout

- `engine/` - Core calculation and physics modules.
- `ui/` - Page modules, renderers, state store, and UI utilities.
- `ui/lessons/` - 20-lesson curriculum modules.
- `tests/` - Node and Playwright test suites.
- `scripts/` - Build, backup, syntax check, and test reporter scripts.
- `assets/` - Static assets, including the splash planet model.

## Credits

- Artifexian YouTube: https://www.youtube.com/c/Artifexian
- WorldSmith 8.0 spreadsheet: https://docs.google.com/spreadsheets/d/1AML0mIQcWDrrEHj-InXoYsV_QlhlFVuUalE3o-TwQco/copy
- Chromant Desmos correction model: https://www.desmos.com/calculator/gcgvefvuc7

Community:

- Artifexian Discord: https://discord.com/invite/hPvqDBPkhg
- Judas Brennan Discord: https://discord.gg/f63SfkW7vh

## Changelog

See `CHANGELOG.md` for full release history and detailed change notes.
