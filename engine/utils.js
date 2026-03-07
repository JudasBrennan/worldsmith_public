// SPDX-License-Identifier: MPL-2.0
// Utility helpers used across calculators.

export { eccentricityFactor, k2LoveNumber, spinOrbitResonance } from "./physics/rotation.js";

export function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, x));
}

// Shared guard used by every engine module: coerce to finite number or return fallback.
// Centralized here to avoid identical local copies scattered across engine files.
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
// Used by UI color KPIs to choose dark or light text for readability.
export function relativeLuminance(hex) {
  const h = (hex || "").replace("#", "");
  if (h.length !== 6) return 0;
  const toLinear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const r = toLinear(parseInt(h.slice(0, 2), 16) / 255);
  const g = toLinear(parseInt(h.slice(2, 4), 16) / 255);
  const b = toLinear(parseInt(h.slice(4, 6), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Uses a fixed en-US locale so decimal separators stay "." across machines.
export function fmt(n, dp = 3) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "NA";
  return round(x, dp).toLocaleString("en-US", { maximumFractionDigits: dp });
}

// Rotation/tidal helpers moved to engine/physics/rotation.js.
// Moon volatile inventory:
// Vacuum sublimation temperatures (K at ~1 Pa vapor pressure), computed
// from Clausius-Clapeyron using Fray & Schmitt (2009, PSS 57, 2053)
// triple-point data. These are lower than the triple-point temperatures
// used in planet.js because moons are in near-vacuum.
//
// maxRho: maximum bulk density (g/cm^3) for the species to be present as
// primordial surface ice. SO2 uses Infinity because it comes from
// volcanism, not primordial ice (detected via tidalFeedbackActive).
//
// Thermodynamic reference data (triple-point) for vapor pressure:
// pTp (Pa), tTp (K), dhSub (J/mol): sublimation enthalpy at triple point.
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

// Jeans escape parameter lambda = m v_esc^2 / (2 k_B T).
// lambda > 6 -> retained; 3-6 -> marginal; < 3 -> escaping.
export function jeansParameter(massAmu, escVelocityMs, tempK) {
  if (tempK <= 0 || escVelocityMs <= 0) return 0;
  return (massAmu * 1.6605e-27 * escVelocityMs ** 2) / (2 * 1.3806e-23 * tempK);
}

// Clausius-Clapeyron vapor pressure estimate.
// P = P_tp * exp(-(dH/R)(1/T - 1/T_tp))
// Returns pressure in Pa. Accurate to factor ~2-3 for T < T_tp.
export function vaporPressurePa(vol, tempK) {
  if (tempK <= 0 || tempK >= vol.tTp) return vol.pTp;
  const R = 8.314;
  return vol.pTp * Math.exp(-(vol.dhSub / R) * (1 / tempK - 1 / vol.tTp));
}

// Atmospheric escape timescale (seconds) for a species with Jeans parameter lambda.
//
// tau_esc ~= P / (g * sqrt(m / (2pi k_B T)) * (1 + lambda) * exp(-lambda))
//
// where P is surface vapor pressure, g is surface gravity, m is molecular mass,
// T is surface temperature, and lambda is the Jeans parameter. Returns Infinity
// when tau exceeds Number.MAX_VALUE (effectively permanent retention).
export function escapeTimescaleSeconds(pressurePa, gravityMs2, massAmu, tempK, lambda) {
  if (pressurePa <= 0 || gravityMs2 <= 0 || tempK <= 0) return Infinity;
  const m = massAmu * 1.6605e-27;
  const kB = 1.3806e-23;
  const thermalFactor = Math.sqrt(m / (2 * Math.PI * kB * tempK));
  const exponent = (1 + lambda) * Math.exp(-lambda);
  if (exponent === 0) return Infinity;
  const lossRate = gravityMs2 * thermalFactor * exponent;
  if (lossRate === 0) return Infinity;
  return pressurePa / lossRate;
}
