// ─── Unified celestial body visual rendering ────────────────────────
//
// Thin dispatch layer that routes to body-type-specific modules:
//   rocky planet  → rockyPlanetStyles.js
//   gas giant     → gasGiantStyles.js
//   moon          → moonStyles.js
//
// Extensible via registerBodyRenderer() for future body types
// (comets, dwarf planets, asteroids).

import {
  computeRockyVisualProfile,
  drawRockyPlanetPreview,
  drawRockyPlanetViz,
} from "./rockyPlanetStyles.js";
import {
  computeGasGiantVisualProfile,
  drawGasGiantPreview,
  drawGasGiantViz,
} from "./gasGiantStyles.js";
import { computeMoonVisualProfile, drawMoonPreview, drawMoonViz } from "./moonStyles.js";

// ── Renderer registry ───────────────────────────────────────────────

const RENDERERS = {
  rocky: {
    computeProfile: (data) => computeRockyVisualProfile(data.derived, data.inputs),
    drawPreview: (canvas, profile, opts) => drawRockyPlanetPreview(canvas, profile, opts),
    drawViz: (ctx, x, y, r, profile, opts) => drawRockyPlanetViz(ctx, x, y, r, profile, opts),
  },
  gasGiant: {
    computeProfile: (data) => computeGasGiantVisualProfile(data.ggCalc),
    drawPreview: (canvas, profile, opts) => drawGasGiantPreview(canvas, profile.styleId, opts),
    drawViz: (ctx, x, y, r, profile, opts) => drawGasGiantViz(ctx, x, y, r, profile.styleId, opts),
  },
  moon: {
    computeProfile: (data) => computeMoonVisualProfile(data.moonCalc),
    drawPreview: (canvas, profile, opts) => drawMoonPreview(canvas, profile, opts),
    drawViz: (ctx, x, y, r, profile, opts) => drawMoonViz(ctx, x, y, r, profile, opts),
  },
};

// ── Public API ──────────────────────────────────────────────────────

/**
 * Compute a visual profile for any body type.
 *
 * @param {"rocky"|"gasGiant"|"moon"} bodyType
 * @param {object} data - Type-specific data
 * @returns {object} Visual profile (shape varies by type)
 */
export function computeBodyProfile(bodyType, data) {
  const renderer = RENDERERS[bodyType];
  if (!renderer) throw new Error(`Unknown body type: ${bodyType}`);
  return renderer.computeProfile(data);
}

/**
 * Draw a 180×180 px preview for any body type.
 *
 * @param {"rocky"|"gasGiant"|"moon"} bodyType
 * @param {HTMLCanvasElement} canvas
 * @param {object} profile - From computeBodyProfile()
 * @param {object} [opts]
 */
export function drawBodyPreview(bodyType, canvas, profile, opts = {}) {
  const renderer = RENDERERS[bodyType];
  if (!renderer) return;
  renderer.drawPreview(canvas, profile, opts);
}

/**
 * Draw a body at system visualiser scale (8–20 px).
 *
 * @param {"rocky"|"gasGiant"|"moon"} bodyType
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} r
 * @param {object} profile
 * @param {object} [opts]
 */
export function drawBodyViz(bodyType, ctx, x, y, r, profile, opts = {}) {
  const renderer = RENDERERS[bodyType];
  if (!renderer) return;
  renderer.drawViz(ctx, x, y, r, profile, opts);
}

/**
 * Register a new body type renderer for extensibility.
 *
 * @param {string} bodyType - e.g. "comet", "dwarfPlanet", "asteroid"
 * @param {{ computeProfile: Function, drawPreview: Function, drawViz: Function }} renderer
 */
export function registerBodyRenderer(bodyType, renderer) {
  RENDERERS[bodyType] = renderer;
}
