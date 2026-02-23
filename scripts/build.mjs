/**
 * Production build — bundles app.js and copies static assets to dist/.
 *
 * Usage:  node scripts/build.mjs
 */

import { build } from "esbuild";
import { cpSync, rmSync, readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = resolve(ROOT, "dist");

// Clean previous build
rmSync(DIST, { recursive: true, force: true });

// 1. Bundle app.js → dist/app.js (single file, minified)
await build({
  entryPoints: [resolve(ROOT, "app.js")],
  bundle: true,
  outfile: resolve(DIST, "app.js"),
  format: "esm",
  minify: true,
  sourcemap: true,
  target: ["es2020", "safari14"],
  logLevel: "info",
});

// 2. Copy static assets
cpSync(resolve(ROOT, "styles.css"), resolve(DIST, "styles.css"));
cpSync(resolve(ROOT, "favicon.svg"), resolve(DIST, "favicon.svg"));
cpSync(resolve(ROOT, "assets"), resolve(DIST, "assets"), { recursive: true });

// 3. Copy index.html with cache-busted references removed
//    (the bundled app.js has everything, no need for ?release= cache busting)
let html = readFileSync(resolve(ROOT, "index.html"), "utf8");
html = html.replace(/src="\.\/app\.js[^"]*"/, 'src="./app.js"');
html = html.replace(/href="\.\/styles\.css[^"]*"/, 'href="./styles.css"');
writeFileSync(resolve(DIST, "index.html"), html);

console.log("\nBuild complete → dist/");
