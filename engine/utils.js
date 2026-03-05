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

/**
 * Goldreich & Peale (1966) spin-orbit resonance selection.
 * Eccentricity functions H(p, e) determine the width of each resonance.
 * Higher eccentricity enables higher-order resonances (3:2, 2:1, 5:2).
 *
 * @param {number} eccentricity - Orbital eccentricity
 * @returns {{ ratio: string, p: number }} Selected resonance state
 */
export function spinOrbitResonance(eccentricity) {
  const e = eccentricity;
  const H_52 = (845 / 48) * e ** 3;
  const H_21 = (17 / 2) * e ** 2;
  const H_32 = (7 / 2) * e;
  if (H_52 > 0.5) return { ratio: "5:2", p: 2.5 };
  if (H_21 > 0.5) return { ratio: "2:1", p: 2.0 };
  if (H_32 > 0.25) return { ratio: "3:2", p: 1.5 };
  return { ratio: "1:1", p: 1.0 };
}

// ── Moon volatile inventory ─────────────────────────────────────────
// Vacuum sublimation temperatures (K at ~1 Pa vapor pressure), computed
// from Clausius-Clapeyron using Fray & Schmitt (2009, PSS 57, 2053)
// triple-point data.  These are LOWER than the triple-point temperatures
// used in planet.js because moons are in near-vacuum.
//
// maxRho: maximum bulk density (g/cm³) for the species to be present as
// primordial surface ice.  SO₂ uses Infinity because it comes from
// volcanism, not primordial ice (detected via tidalFeedbackActive).
//
// Thermodynamic reference data (triple-point) for vapor pressure:
//   pTp (Pa), tTp (K), dhSub (J/mol) — sublimation enthalpy at triple point.
export const MOON_VOLATILE_TABLE = [
  {
    species: "N\u2082",
    label: "nitrogen",
    massAmu: 28,
    subK: 35,
    maxRho: 2.5,
    pTp: 12500,
    tTp: 63.15,
    dhSub: 6200,
  },
  {
    species: "CO",
    label: "carbon monoxide",
    massAmu: 28,
    subK: 35,
    maxRho: 2.5,
    pTp: 15400,
    tTp: 68.1,
    dhSub: 6000,
  },
  {
    species: "CH\u2084",
    label: "methane",
    massAmu: 16,
    subK: 50,
    maxRho: 2.5,
    pTp: 11700,
    tTp: 90.7,
    dhSub: 8700,
  },
  {
    species: "CO\u2082",
    label: "carbon dioxide",
    massAmu: 44,
    subK: 115,
    maxRho: 3.2,
    pTp: 518000,
    tTp: 216.6,
    dhSub: 26100,
  },
  {
    species: "NH\u2083",
    label: "ammonia",
    massAmu: 17,
    subK: 130,
    maxRho: 2.5,
    pTp: 6060,
    tTp: 195.4,
    dhSub: 31200,
  },
  {
    species: "SO\u2082",
    label: "sulfur dioxide",
    massAmu: 64,
    subK: 140,
    maxRho: Infinity,
    pTp: 1670,
    tTp: 197.7,
    dhSub: 31400,
  },
  {
    species: "H\u2082O",
    label: "water",
    massAmu: 18,
    subK: 210,
    maxRho: 3.2,
    pTp: 611,
    tTp: 273.16,
    dhSub: 51100,
  },
];

/**
 * Jeans escape parameter λ = m v_esc² / (2 k_B T).
 * λ > 6 → retained; 3–6 → marginal; < 3 → escaping.
 */
export function jeansParameter(massAmu, escVelocityMs, tempK) {
  if (tempK <= 0 || escVelocityMs <= 0) return 0;
  return (massAmu * 1.6605e-27 * escVelocityMs ** 2) / (2 * 1.3806e-23 * tempK);
}

/**
 * Clausius-Clapeyron vapor pressure estimate.
 * P = P_tp × exp(-(ΔH/R)(1/T - 1/T_tp))
 * Returns pressure in Pa.  Accurate to factor ~2-3 for T < T_tp.
 */
export function vaporPressurePa(vol, tempK) {
  if (tempK <= 0 || tempK >= vol.tTp) return vol.pTp; // at/above triple point
  const R = 8.314; // J/(mol·K)
  return vol.pTp * Math.exp(-(vol.dhSub / R) * (1 / tempK - 1 / vol.tTp));
}

/**
 * Atmospheric escape timescale (seconds) for a species with Jeans parameter λ.
 *
 * τ_esc ≈ P / (g × √(m / (2π k_B T)) × (1 + λ) × exp(−λ))
 *
 * where P is surface vapor pressure, g is surface gravity, m is molecular mass,
 * T is surface temperature, and λ is the Jeans parameter.  Returns Infinity
 * when τ exceeds Number.MAX_VALUE (effectively permanent retention).
 */
export function escapeTimescaleSeconds(pressurePa, gravityMs2, massAmu, tempK, lambda) {
  if (pressurePa <= 0 || gravityMs2 <= 0 || tempK <= 0) return Infinity;
  const m = massAmu * 1.6605e-27; // kg per molecule
  const kB = 1.3806e-23;
  const thermalFactor = Math.sqrt(m / (2 * Math.PI * kB * tempK));
  const exponent = (1 + lambda) * Math.exp(-lambda);
  if (exponent === 0) return Infinity; // λ so large exp(-λ) underflows
  const lossRate = gravityMs2 * thermalFactor * exponent;
  if (lossRate === 0) return Infinity;
  return pressurePa / lossRate;
}
