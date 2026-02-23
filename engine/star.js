// Star calculator
// Mass-luminosity from Eker et al. (2018, MNRAS 479, 5491) — six-piece
// empirical relation calibrated from 509 eclipsing binary components.
// Mass-radius from Eker (2018) quadratic (M ≤ 1 Msol) and Demircan &
// Kahraman (1991) power law (M > 1 Msol).
// Habitable Zone uses temperature-dependent Seff polynomials from
// Chromant's Desmos Star System Visualizer (Kopparapu-style correction).
// Inputs:
//  - massMsol: Mass in solar masses (M☉)
//  - ageGyr: Current age in Gyr
//
// Outputs match the sheet fields:
//  - maxAgeGyr, radiusRsol, luminosityLsol, densityDsol, densityGcm3, tempK,
//    spectralClass, habitableZoneAu, habitableZoneMillionKm, earthLikeLifePossible

import { clamp, fmt, toFinite } from "./utils.js";

const HZ_SOLAR_TEFF_K = 5778;
const HZ_MIN_FLUX = 1e-6;

// ---------------------------------------------------------------------------
// Mass-Luminosity Relation: Eker et al. (2018, MNRAS 479, 5491)
// ---------------------------------------------------------------------------
// Six-piece empirical relation calibrated from 509 detached eclipsing binary
// components.  Form: L = c × M^α  (L in Lsol, M in Msol).
// Exponents (α) are from Eker Table 4.  Coefficients (c) are adjusted from
// the published values to enforce continuity at each mass boundary and to
// anchor L = 1.0 Lsol at M = 1.0 Msol (solar normalisation).  All
// adjustments fall within Eker's quoted ±0.026–0.176 uncertainties on the
// log-space intercept b.
// Below 0.179 Msol (Eker calibration floor) the lowest segment is
// extrapolated; above 31 Msol the highest segment is extrapolated.
const MLR = [
  { maxM: 0.45, alpha: 2.028, c: 0.0892 }, // fully convective M dwarfs
  { maxM: 0.72, alpha: 4.572, c: 0.68 }, // late-K / early-M transition
  { maxM: 1.05, alpha: 5.743, c: 1.0 }, // solar-type (G/K boundary)
  { maxM: 2.4, alpha: 4.329, c: 1.072 }, // F/A stars
  { maxM: 7.0, alpha: 3.967, c: 1.471 }, // B stars
  { maxM: Infinity, alpha: 2.865, c: 12.55 }, // O / early-B stars
];

/**
 * Converts stellar mass to luminosity using the Eker et al. (2018, MNRAS 479,
 * 5491) six-piece empirical relation, calibrated from 509 detached eclipsing
 * binary components. Mass is clamped to 0.075--100 Msol before evaluation.
 * Below 0.179 Msol (Eker calibration floor) the lowest segment is
 * extrapolated; above 31 Msol the highest segment is extrapolated.
 *
 * @param {number} massMsol - Stellar mass in solar masses (Msol)
 * @returns {number} Luminosity in solar luminosities (Lsol)
 */
export function massToLuminosity(massMsol) {
  const m = clamp(massMsol, 0.075, 100);
  for (const seg of MLR) {
    if (m < seg.maxM) return seg.c * m ** seg.alpha;
  }
  const last = MLR[MLR.length - 1];
  return last.c * m ** last.alpha;
}

// ---------------------------------------------------------------------------
// Mass-Radius Relation
// ---------------------------------------------------------------------------
// M ≤ 1.0 Msol: Eker et al. (2018) quadratic (Table 5) from eclipsing
// binaries:  R = 0.438 M² + 0.479 M + 0.075  (calibrated 0.179–1.5 Msol).
// Normalised by dividing by R(1.0) = 0.992 so the Sun gives exactly 1.0 Rsol.
// M > 1.0 Msol: R = M^0.57  (Demircan & Kahraman 1991 upper branch).
// Both evaluate to 1.0 at M = 1.0, ensuring continuity at the boundary.
const MRR_NORM = 1.0 / 0.992;

/**
 * Converts stellar mass to radius using a two-piece relation: Eker et al.
 * (2018) quadratic for M <= 1 Msol, Demircan & Kahraman (1991) power law
 * for M > 1 Msol. Both pieces evaluate to exactly 1.0 Rsol at 1.0 Msol,
 * ensuring continuity at the boundary. Mass is clamped to 0.075--100 Msol.
 *
 * @param {number} massMsol - Stellar mass in solar masses (Msol)
 * @returns {number} Radius in solar radii (Rsol)
 */
export function massToRadius(massMsol) {
  const m = clamp(massMsol, 0.075, 100);
  if (m <= 1.0) return (0.438 * m * m + 0.479 * m + 0.075) * MRR_NORM;
  return m ** 0.57;
}

/**
 * Converts effective temperature (K) to a hex colour string (#RRGGBB) using
 * Tanner Helland's empirical blackbody approximation (valid 1000–40000 K,
 * R² > 0.987). Temperatures outside this range are clamped before calculation.
 *
 * Replaces the WS8 spreadsheet's 7-band flat lookup (STAR!C13 conditional
 * formatting), which produced only seven discrete colours with hard jumps.
 * The Planckian locus approach (CIE xy → XYZ → sRGB matrix pipeline) was
 * considered but rejected as significantly more complex for negligible visual
 * gain in a worldbuilding context.
 *
 * Algorithm: tannerhelland.com/2012/09/18/convert-temperature-rgb-algorithm-code.html
 */
export function starColourHexFromTempK(tempK) {
  const t = Number(tempK);
  if (!Number.isFinite(t) || t <= 0) return "#FFD2A1";

  // Work in units of K/100, clamped to the algorithm's valid range.
  const temp = clamp(t, 1000, 40000) / 100;

  // Red
  let r;
  if (temp <= 66) {
    r = 255;
  } else {
    r = clamp(329.698727446 * (temp - 60) ** -0.1332047592, 0, 255);
  }

  // Green
  let g;
  if (temp <= 66) {
    g = clamp(99.4708025861 * Math.log(temp) - 161.1195681661, 0, 255);
  } else {
    g = clamp(288.1221695283 * (temp - 60) ** -0.0755148492, 0, 255);
  }

  // Blue
  let b;
  if (temp >= 66) {
    b = 255;
  } else if (temp <= 19) {
    b = 0;
  } else {
    b = clamp(138.5177312231 * Math.log(temp - 10) - 305.0447927307, 0, 255);
  }

  const hex2 = (v) => Math.round(v).toString(16).padStart(2, "0");
  return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
}

/**
 * Estimates the effective temperature proxy used by the habitable-zone Seff
 * polynomials. Applies the Chromant Desmos correction: Teff = 5778 * M^0.55.
 * Mass is clamped to 0.075--100 Msol before evaluation.
 *
 * @param {number} massMsol - Stellar mass in solar masses (Msol)
 * @returns {number} Estimated effective temperature in Kelvin (K)
 */
export function estimateHabitableTeffKFromMass(massMsol) {
  const m = clamp(massMsol, 0.075, 100);
  // Updated habitable-zone model (Chromant Desmos correction):
  // Teff proxy used for Seff polynomials.
  return HZ_SOLAR_TEFF_K * m ** 0.55;
}

/**
 * Computes inner and outer habitable-zone flux limits (Seff) from effective
 * temperature using Chromant's corrected Kopparapu-style polynomials. The
 * polynomials express Seff as a 4th-order function of dT = Teff - 5778 K.
 * Flux values are floored at 1e-6 to avoid division-by-zero downstream.
 *
 * @param {number} teffK - Effective temperature in Kelvin (K)
 * @returns {{ sIn: number, sOut: number, dT: number }} Inner and outer Seff
 *   flux limits (dimensionless, relative to solar flux) and the temperature
 *   offset dT used in the polynomial evaluation
 */
export function habitableFluxLimitsFromTeffK(teffK) {
  const t = Number(teffK);
  // Kopparapu polynomials are calibrated for ~2600–7200 K; clamp dT to
  // that range so the 4th-order terms don't blow up for extreme masses.
  const rawDT = (Number.isFinite(t) ? t : HZ_SOLAR_TEFF_K) - HZ_SOLAR_TEFF_K;
  const dT = clamp(rawDT, 2600 - HZ_SOLAR_TEFF_K, 7200 - HZ_SOLAR_TEFF_K);

  // Chromant's corrected HZ flux polynomials (based on Kopparapu-style Seff fits):
  // S_in (inner edge) and S_out (outer edge) as functions of dT.
  const sInRaw =
    1.107 + 1.332e-4 * dT + 1.58e-8 * dT ** 2 - 8.308e-12 * dT ** 3 - 5.073e-15 * dT ** 4;

  const sOutRaw =
    0.356 + 6.171e-5 * dT + 1.698e-9 * dT ** 2 - 3.198e-12 * dT ** 3 - 5.575e-16 * dT ** 4;

  return {
    sIn: Math.max(HZ_MIN_FLUX, sInRaw),
    sOut: Math.max(HZ_MIN_FLUX, sOutRaw),
    dT,
  };
}

/**
 * Calculates the inner and outer edges of the habitable zone in AU from
 * stellar luminosity and effective temperature. Uses temperature-dependent
 * Seff polynomials (Chromant Desmos correction) to derive flux limits, then
 * converts to orbital distance via d = sqrt(L / Seff).
 *
 * @param {object} params
 * @param {number} params.luminosityLsol - Stellar luminosity in solar
 *   luminosities (Lsol)
 * @param {number} params.teffK - Effective temperature in Kelvin (K), used
 *   for the Seff polynomial correction
 * @returns {{ innerAu: number, outerAu: number, sIn: number, sOut: number,
 *   dT: number }} Inner and outer HZ edges in AU, plus the Seff flux limits
 *   and temperature offset used in the calculation
 */
export function calcHabitableZoneAu({ luminosityLsol, teffK }) {
  const L = Math.max(0, Number(luminosityLsol) || 0);
  const flux = habitableFluxLimitsFromTeffK(teffK);
  const innerAu = L > 0 ? Math.sqrt(L / flux.sIn) : 0;
  const outerAu = L > 0 ? Math.sqrt(L / flux.sOut) : 0;
  return {
    innerAu,
    outerAu,
    sIn: flux.sIn,
    sOut: flux.sOut,
    dT: flux.dT,
  };
}

// ---------------------------------------------------------------------------
// Giant Planet Probability: Fischer & Valenti (2005, ApJ 622, 1102)
// ---------------------------------------------------------------------------
// Probability that a solar-type star hosts a giant planet (>0.3 Mjup) scales
// as P ∝ 10^(2·[Fe/H]).  Baseline ~10% at solar metallicity for FGK dwarfs
// (Cumming et al. 2008, PASP 120, 531).  Clamped to [0, 1].
export function giantPlanetProbability(metallicityFeH) {
  const feH = clamp(toFinite(metallicityFeH, 0), -3, 1);
  return clamp(0.1 * Math.pow(10, 2 * feH), 0, 1);
}

// Stellar population label based on [Fe/H].
export function populationLabel(metallicityFeH) {
  const feH = toFinite(metallicityFeH, 0);
  if (feH <= -1.0) return "Population II (metal-poor halo/thick disk)";
  if (feH <= -0.3) return "Intermediate (old thin disk)";
  if (feH <= 0.15) return "Population I (solar neighbourhood)";
  return "Metal-rich (inner disk)";
}

/**
 * Master star calculator. Derives all physical properties from mass and age,
 * with optional overrides for radius, luminosity, and temperature. When two
 * of the three Stefan-Boltzmann quantities (R, L, T) are overridden, the
 * third is derived from SB: L = R^2 * (T/5776)^4. Outputs match the STAR
 * sheet fields (maxAgeGyr, spectralClass, habitableZoneAu, etc.).
 *
 * @param {object} params
 * @param {number} params.massMsol - Stellar mass in solar masses (0.075--100)
 * @param {number} params.ageGyr - Current age in Gyr (clamped 0--20)
 * @param {number} [params.radiusRsolOverride] - Optional radius override (Rsol)
 * @param {number} [params.luminosityLsolOverride] - Optional luminosity
 *   override (Lsol)
 * @param {number} [params.tempKOverride] - Optional temperature override (K)
 * @param {number} [params.metallicityFeH] - Metallicity [Fe/H] (default 0)
 * @returns {object} Full star model containing inputs, derived physical
 *   properties (radiusRsol, luminosityLsol, tempK, densityDsol, densityGcm3,
 *   maxAgeGyr, spectralClass), habitable-zone boundaries (AU and million km),
 *   habitability flags, metric conversions, and pre-formatted display strings
 */
export function calcStar({
  massMsol,
  ageGyr,
  radiusRsolOverride,
  luminosityLsolOverride,
  tempKOverride,
  metallicityFeH,
}) {
  // Match sheet validation note: 0.075 <= mass <= 100
  const m = clamp(massMsol, 0.075, 100);
  const age = clamp(ageGyr, 0, 20); // sanity clamp; sheet doesn't hard-limit

  const radiusRsolAuto = massToRadius(m);
  const luminosityLsolAuto = massToLuminosity(m);

  // Three-way Stefan-Boltzmann resolution.
  // Solar-normalised SB: L = R² × (T/5776)⁴
  // Any two of (R, L, T) determine the third.
  const rOv = Number(radiusRsolOverride);
  const lOv = Number(luminosityLsolOverride);
  const tOv = Number(tempKOverride);
  const hasR = Number.isFinite(rOv) && rOv > 0;
  const hasL = Number.isFinite(lOv) && lOv > 0;
  const hasT = Number.isFinite(tOv) && tOv > 0;

  let radiusRsol, luminosityLsol, resolutionMode;

  if (hasR && hasL) {
    // R + L given → derive T (T override ignored if also provided)
    radiusRsol = rOv;
    luminosityLsol = lOv;
    resolutionMode = hasT ? "R+L→T (T ignored)" : "R+L→T";
  } else if (hasR && hasT) {
    // R + T given → derive L via SB
    radiusRsol = rOv;
    luminosityLsol = rOv ** 2 * (tOv / 5776) ** 4;
    resolutionMode = "R+T→L";
  } else if (hasL && hasT) {
    // L + T given → derive R via SB
    luminosityLsol = lOv;
    radiusRsol = Math.sqrt(lOv) * (5776 / tOv) ** 2;
    resolutionMode = "L+T→R";
  } else if (hasT) {
    // T only → use mass-derived R, derive L
    radiusRsol = radiusRsolAuto;
    luminosityLsol = radiusRsolAuto ** 2 * (tOv / 5776) ** 4;
    resolutionMode = "T→L (mass R)";
  } else if (hasR) {
    radiusRsol = rOv;
    luminosityLsol = luminosityLsolAuto;
    resolutionMode = "R override";
  } else if (hasL) {
    radiusRsol = radiusRsolAuto;
    luminosityLsol = lOv;
    resolutionMode = "L override";
  } else {
    radiusRsol = radiusRsolAuto;
    luminosityLsol = luminosityLsolAuto;
    resolutionMode = "mass-derived";
  }

  // C8 maximum age (Gyr): (mass / luminosity) * 10  — fuel supply / burn rate
  // The spreadsheet comment reads "10 / m^2.5" but the actual cell formula is
  // (m / L) * 10.  For ideal main-sequence stars the two are numerically
  // equivalent, but (m/L)*10 is what the spreadsheet implements and is more
  // physically meaningful (main-sequence lifetime ∝ M/L).
  const maxAgeGyr = (m / luminosityLsol) * 10;

  // C11 density (Dsol): m / radius^3
  const densityDsol = m / radiusRsol ** 3;

  // F11 density g/cm^3: 1.408 * Dsol
  const densityGcm3 = 1.408 * densityDsol;

  // C12 temperature (K): ((L / R^2)^0.25) * 5776
  const tempK = (luminosityLsol / radiusRsol ** 2) ** 0.25 * 5776;

  // Habitable zone (AU), updated from spreadsheet constants:
  // Use temperature-dependent Seff polynomials (Chromant Desmos correction).
  const hzTeffK = estimateHabitableTeffKFromMass(m);
  const hz = calcHabitableZoneAu({ luminosityLsol, teffK: hzTeffK });
  const hzInnerAu = hz.innerAu;
  const hzOuterAu = hz.outerAu;

  // million km: AU * 149.6
  const hzInnerMkm = hzInnerAu * 149.6;
  const hzOuterMkm = hzOuterAu * 149.6;

  // Earth-like life?
  // IF(AND(m>=0.5,m<=1.4), IF(age>=3.5,"Yes","Star Too Young"), "No")
  const earthLikeLifePossible =
    m >= 0.5 && m <= 1.4 ? (age >= 3.5 ? "Yes" : "Star Too Young") : "No";

  // Spectral class mirrors Calculations!B4:C10 logic:
  const spectralClass = calcSpectralClassFromTemp(tempK);

  // Extra physical values also shown in STAR sheet (right-side metric conversions)
  const massKg = 1.989e30 * m;
  const radiusKm = 696340 * radiusRsol;
  const luminosityW = 3.828e26 * luminosityLsol;

  return {
    inputs: { massMsol: m, ageGyr: age, metallicityFeH: toFinite(metallicityFeH, 0) },
    radiusRsolAuto,
    luminosityLsolAuto,
    radiusOverridden: hasR,
    luminosityOverridden: hasL,
    tempKOverridden: hasT,
    resolutionMode,

    spectralClass,

    maxAgeGyr,
    radiusRsol,
    luminosityLsol,
    densityDsol,
    densityGcm3,
    tempK,

    habitableZoneAu: { inner: hzInnerAu, outer: hzOuterAu },
    habitableZoneMillionKm: { inner: hzInnerMkm, outer: hzOuterMkm },
    habitableZoneModel: {
      teffK: hzTeffK,
      sIn: hz.sIn,
      sOut: hz.sOut,
      dT: hz.dT,
      source: "Temperature-dependent HZ Seff polynomial (Chromant Desmos correction)",
    },

    earthLikeLifePossible,
    giantPlanetProbability: giantPlanetProbability(metallicityFeH),
    populationLabel: populationLabel(metallicityFeH),

    metric: {
      massKg,
      radiusKm,
      luminosityW,
    },

    // handy pre-formatted strings for UI
    display: {
      hzAu: `${fmt(hzInnerAu, 3)} - ${fmt(hzOuterAu, 3)}`,
      hzMkm: `${fmt(hzInnerMkm, 2)} - ${fmt(hzOuterMkm, 2)}`,
    },
    starColourHex: starColourHexFromTempK(tempK),
  };
}

// Mirrors Calculations sheet: letter based on temperature ranges, subtype based on linear mapping.
// The spreadsheet uses exclusive comparisons with bounds (e.g. 6000>t and t>5200).
function calcSpectralClassFromTemp(tempK) {
  const t = Number(tempK);
  if (!Number.isFinite(t)) return "NA";

  // Each bucket:
  // M: 2000 < t < 3700, subtype: ROUNDDOWN(((1 - (t-2000)/1700))*10,1) & "V"
  // K: 3700 < t < 5200, denom 1500
  // G: 5200 < t < 6000, denom 800
  // F: 6000 < t < 7500, denom 1500
  // A: 7500 < t < 10000, denom 2500
  // B: 10000 < t < 33000, denom 23000
  // O: 33000 < t < 95000, denom 62000

  const buckets = [
    { letter: "M", lo: 2000, hi: 3700, denom: 1700 },
    { letter: "K", lo: 3700, hi: 5200, denom: 1500 },
    { letter: "G", lo: 5200, hi: 6000, denom: 800 },
    { letter: "F", lo: 6000, hi: 7500, denom: 1500 },
    { letter: "A", lo: 7500, hi: 10000, denom: 2500 },
    { letter: "B", lo: 10000, hi: 33000, denom: 23000 },
    { letter: "O", lo: 33000, hi: 95000, denom: 62000 },
  ];

  const b = buckets.find((x) => t >= x.lo && t < x.hi);
  if (!b) return "NA";

  const raw = (1 - (t - b.lo) / b.denom) * 10;
  // Excel: ROUNDDOWN(value, 1)
  const subtype = Math.floor(raw * 10) / 10;

  return `${b.letter}${subtype}V`;
}
