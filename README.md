# WorldSmith Web 1.5.0

WorldSmith Web is a browser-based implementation of the WorldSmith project.

The underlying model and methodology are based on **WorldSmith 8.0** by **Artifexian**:

- Spreadsheet: https://docs.google.com/spreadsheets/d/1AML0mIQcWDrrEHj-InXoYsV_QlhlFVuUalE3o-TwQco/copy
- YouTube: https://www.youtube.com/c/Artifexian

This web implementation is by **Judas Brennan**.

## Features

- Star generation and derived stellar outputs
- Planetary system generation and slot management
- Inner planet editing and assignment
- Outer objects editing (gas giants and debris disks)
- Moon editing and assignment
- Apparent size and brightness modelling (star/object/moon visibility)
- Calendar modelling (solar, lunar, and lunisolar)
- System visualiser with labels, orbit toggles, debris display, and animation
- Local cluster generation (Galaxy tab model: neighbourhood object/system counts + seeded coordinates)
- Local cluster 3D visualiser with drag-rotate and zoom
- Import/export via JSON
- WorldSmith 8.x spreadsheet import (`.xlsx`) with automatic Star/System/Planet/Moon tab detection

Notes:

- The `.xlsx` importer loads its spreadsheet parser module from a CDN at runtime.

## Changelog

### 1.5.0

- Added the new **Apparent Size** page to model star/object/moon apparent magnitude, brightness, and angular size outputs.
- Added the new **Calendar** page with world-linked calendar design and month/detailed views.
- Enabled direct navigation to the `Apparent Size` and `Calendar` tools in the main UI.

### 1.4.0

- Added a new **Apparent Size** page with star/object/moon apparent magnitude, brightness, and size outputs.
- Added a new **Calendar** page with solar, lunar, and lunisolar calendar derivations from orbital/rotation periods.
- Enabled direct navigation to the new `Apparent Size` and `Calendar` tools in the UI.

### 1.3.1

- Fixed System Visualiser depth layering so planets and gas giants correctly render behind or in front of the star.

### 1.3

- Added a Logarithmic/Linear orbit scale toggle to the System Visualiser and fixed the linear-scale orbit placement bug.
- Improved System Visualiser controls and layout (scale toggle placement, clearer labels, styling aligned with newer visualiser UI).
- Added moon orbit guardrails so semi-major axis is constrained to valid moon-zone bounds on Apply (with whole-number rounding).
- Improved Local Cluster Visualiser interaction: corrected drag rotation direction and refined link projection to the nearest X/Z plane point.
- Added range/bearing grid features in Local Cluster Visualiser, including toggles and degrees/mils display modes.
- Added support for renaming local stars and showing those names in the visualiser labels.
- Unified control panel styling across visualisers and applied consistent page spacing/card styling (including Import/Export).
- Refined Planet tab sky colour cells, especially "sun near horizon," to better match the target look while keeping text readable.

### 1.2

- Updated habitable-zone maths to use the corrected temperature-dependent model.
- Added a habitable-zone band in the System Visualiser (green inner-to-outer HZ overlay) with a display toggle.

### 1.1

- Added direct `.xlsx` import for WorldSmith 8.x workbooks.
- Added structural sheet detection for Star/System/Planet/Moon tabs (tab reordering supported).
- Added multi-tab Planet and Moon import (imports as `Planet 1..N` and `Moon 1..N`).
- Improved XLSX import preview to show debris disk range from Planetary System `C38`.
- Improved visualiser focus-follow behavior for planets and gas giants.

## Run Locally

No build step is required.

Option 1 (Python):

- `python -m http.server 8080`
- Open `http://localhost:8080`

Option 2 (VS Code):

- Use a static server extension such as Live Server

## Developer Tooling (Node.js)

The project now includes a lightweight Node.js toolchain for automated checks.

Setup:

- `npm install`

Commands:

- `npm run backup:live` - Zip live deploy files into `Backup/` and keep only the latest 3 archives.
- `npm run check:syntax` - Validate JavaScript syntax across the project.
- `npm run lint` - Run ESLint on `.js` files.
- `npm run lint:fix` - Auto-fix lint issues where possible.
- `npm run format:check` - Check formatting with Prettier.
- `npm run format` - Apply Prettier formatting.
- `npm run test` - Run regression tests for core engine logic.
- `npm run check` - Run syntax, lint, and tests in sequence.

## Data Storage

- World data is stored in browser local storage.
- Import/export allows full backup and transfer of world data.

## Community

- Artifexian Discord: https://discord.com/invite/hPvqDBPkhg
- Judas Brennan Discord: https://discord.gg/f63SfkW7vh
