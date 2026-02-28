// Utility helpers used across calculators.

export function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, x));
}

// Shared guard used by every engine module: coerce to finite number or return fallback.
// Centralised here to avoid identical local copies scattered across engine files.
export function toFinite(n, fallback) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

export function round(n, dp = 3) {
  const x = Number(n);
  if (!Number.isFinite(x)) return NaN;
  const p = 10 ** dp;
  return Math.round(x * p) / p;
}

// WCAG relative luminance (0 = black, 1 = white).
// Used by UI colour KPIs to choose dark or light text for readability.
export function relativeLuminance(hex) {
  const h = (hex || "").replace("#", "");
  if (h.length !== 6) return 0;
  const toLinear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const r = toLinear(parseInt(h.slice(0, 2), 16) / 255);
  const g = toLinear(parseInt(h.slice(2, 4), 16) / 255);
  const b = toLinear(parseInt(h.slice(4, 6), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Uses a fixed 'en-US' locale so that decimal separators are always '.' regardless
// of the user's system locale.  Locale-sensitive formatting (e.g. German '1,5') would
// make display-string comparisons in tests non-deterministic across machines.
export function fmt(n, dp = 3) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "NA";
  return round(x, dp).toLocaleString("en-US", { maximumFractionDigits: dp });
}

/**
 * Wisdom (2004/2008) eccentricity function for tidal heating of a
 * synchronous rotator.  Replaces the simple e² truncation with a
 * series accurate to <0.1% for e < 0.8.
 *
 * N_a(e) / (1−e²)^(15/2)  where N_a = 1 + 15.5e² + 31.875e⁴ + …
 */
/**
 * Love number k₂ for a homogeneous elastic sphere (Munk & MacDonald 1960).
 * Used for tidal locking and dissipation in both planet.js and moon.js.
 *
 * @param {number} densityKgM3 - Bulk density (kg/m³)
 * @param {number} gravityMs2  - Surface gravity (m/s²)
 * @param {number} radiusM     - Body radius (m)
 * @param {number} [rigidity=30e9] - Shear rigidity μ (Pa)
 * @returns {number}
 */
export function k2LoveNumber(densityKgM3, gravityMs2, radiusM, rigidity = 30e9) {
  return 1.5 / (1 + (19 * rigidity) / (2 * densityKgM3 * gravityMs2 * radiusM));
}

export function eccentricityFactor(e) {
  if (e === 0) return 0;
  const e2 = e * e;
  const Na = 1 + 15.5 * e2 + 31.875 * e2 ** 2 + 11.5625 * e2 ** 3 + 0.390625 * e2 ** 4;
  return (Na * e2) / (1 - e2) ** 7.5;
}
