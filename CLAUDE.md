# WorldSmith Web

Sci-fi worldbuilding toolkit. Pure browser app (vanilla JS, no framework, no bundler).

## Key files

- `engine/` — pure ESM calculation modules (Node globals only)
- `ui/` — page controllers (browser globals only)
- `ui/store.js` — persistent state (localStorage)
- `app.js` — root browser entry point
- `tests/` — `node:test` runner (Node + browser globals via jsdom)
- `styles.css` — single stylesheet
- `STYLE_GUIDE.md` — **design language, writing conventions, and code patterns — read before making changes**
- `CHANGELOG.md` — version history

## Commands

- `npm run check` — syntax + eslint + prettier + full test suite (run before finishing any work)
- `npm run format` — prettier --write
- `npm run test:engine` — engine tests only
- `npm test` — full test suite

## Rules

- Follow `STYLE_GUIDE.md` for all CSS, tooltips, changelog entries, engine code, store patterns, UI structure, and tests.
- `toFinite`, `clamp`, `round`, `fmt` live in `engine/utils.js` — never duplicate locally.
- Named exports only. Relative imports with `.js` extension.
- ESLint flat config (v9). No `--ext` flag. `no-useless-escape` is enabled.
