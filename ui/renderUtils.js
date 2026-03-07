// SPDX-License-Identifier: MPL-2.0
// ─── Shared canvas rendering utilities ──────────────────────────────
//
// Common helpers used by celestial body visual systems (rocky planets,
// gas giants, moons). Extracted to avoid duplication across modules.

import { clamp } from "../engine/utils.js";

/**
 * Deterministic pseudo-random number generator from a string seed.
 * Uses a murmur-like hash for the seed, then an LCG for the sequence.
 *
 * @param {string} seed
 * @returns {() => number} Function returning values in [0, 1)
 */
export function seededRng(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h = (Math.imul(h, 1597334677) + 1013904223) | 0;
    return ((h >>> 0) / 4294967296 + 0.5) % 1;
  };
}

/**
 * Convert a hex colour string to an rgba() CSS string.
 *
 * @param {string} hex - e.g. "#c4a882"
 * @param {number} a   - alpha 0..1
 * @returns {string} rgba(...) string
 */
export function hexToRgba(hex, a) {
  const n = parseInt((hex || "#888888").replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/**
 * Multiply each RGB channel of a hex colour by a factor, clamping to 0–255.
 *
 * @param {string} hex    - e.g. "#c4a882"
 * @param {number} factor - brightness multiplier (1 = unchanged)
 * @returns {string} hex colour string
 */
export function scaleHex(hex, factor) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const sc = (v) => Math.max(0, Math.min(255, Math.round(v * factor)));
  return "#" + [sc(r), sc(g), sc(b)].map((v) => v.toString(16).padStart(2, "0")).join("");
}

/**
 * Modulate a {c1, c2, c3} palette's brightness based on albedo.
 * Albedo 0 → 0.7× (darker), 0.5 → 1.0× (unchanged), 1.0 → 1.3× (brighter).
 *
 * @param {{c1: string, c2: string, c3: string}} palette
 * @param {number} albedo - 0..1
 * @returns {{c1: string, c2: string, c3: string}}
 */
export function tintPalette(palette, albedo) {
  const factor = 0.7 + clamp(albedo, 0, 1) * 0.6;
  return {
    c1: scaleHex(palette.c1, factor),
    c2: scaleHex(palette.c2, factor),
    c3: scaleHex(palette.c3, factor),
  };
}
