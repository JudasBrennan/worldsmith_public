# WorldSmith Web 1.19.0

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

## Run Locally (No Build Required)

Option 1 (Python):

```bash
python -m http.server 8080
```

Option 2 (Node static server):

```bash
npx serve .
```

Then open `http://localhost:8080`.

## Developer Setup

Requirements:

- Node.js 20+ recommended
- npm

Install dependencies:

```bash
npm install
```

## NPM Scripts

- `npm run check:syntax` - Validate JavaScript syntax across the project.
- `npm run lint` - Run ESLint.
- `npm run lint:fix` - Run ESLint with auto-fixes.
- `npm run format:check` - Check formatting with Prettier.
- `npm run format` - Apply Prettier formatting.
- `npm run test:engine` - Run engine-focused tests.
- `npm run test:ui` - Run UI-focused tests.
- `npm run test` - Run the full test suite with custom reporter output.
- `npm run test:report` - Generate `test-results.md`.
- `npm run check` - Run syntax, lint, format check, and tests.
- `npm run build` - Bundle production files into `dist/`.
- `npm run backup:live` - Create a zip backup of live deploy files in `Backup/`.

## Build Output

`npm run build` creates a production `dist/` folder:

- Bundled `app.js` (esbuild, minified, sourcemap)
- Copied `styles.css`, `favicon.svg`, and `assets/`
- `index.html` with cache-busting query strings removed

## Data Storage and Safety

- World data is stored in browser LocalStorage.
- Imports create in-app restore points before replacement.
- Export/import JSON is the recommended way to move worlds between browsers or devices.
- Built-in presets are available for Sol, Realmspace, and Arrakis.
- Clearing browser site data removes local saves.

## External Runtime Dependencies

The app is static-first, but some features load libraries from `cdn.jsdelivr.net` at runtime:

- XLSX parser for WorldSmith 8.x workbook import.
- Three.js modules for WebGL rendering (3D previews, visualiser, system poster).
- KaTeX for formula rendering on the Science and Maths and Lessons pages.

If a remote dependency fails, affected features degrade gracefully where possible.

## Repository Layout

- `engine/` - Core calculation and physics modules.
- `ui/` - Page modules, renderers, state store, and UI utilities.
- `ui/lessons/` - 20-lesson curriculum modules.
- `tests/` - Node test suite (engine and UI tests).
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
