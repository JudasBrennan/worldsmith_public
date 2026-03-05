// Star calculator
// Mass-luminosity from Eker et al. (2018, MNRAS 479, 5491) — six-piece
// empirical relation calibrated from 509 eclipsing binary components.
// Mass-radius: Schweitzer (2019) linear for M ≤ 0.5 Msol, blended to
// Eker (2018) quadratic over 0.5–0.7, Eker quadratic for 0.7–1.5 Msol,
// Eker MTR + Stefan-Boltzmann derivation for M > 1.5 Msol.
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
// Mass-Temperature Relation: Eker et al. (2018, MNRAS 479, 5491)
// ---------------------------------------------------------------------------
// For M > 1.5 Msol: log Teff = −0.170 (log M)² + 0.888 log M + 3.671
// Used with MLR and Stefan-Boltzmann to derive radius for high-mass stars.

/**
 * Converts stellar mass to effective temperature using the Eker et al. (2018)
 * mass-temperature relation (MTR). Intended for M > 1.5 Msol where the MRR
 * quadratic is not calibrated.
 *
 * @param {number} massMsol - Stellar mass in solar masses (Msol)
 * @returns {number} Effective temperature in Kelvin (K)
 */
export function massToTeff(massMsol) {
  const logM = Math.log10(massMsol);
  return 10 ** (-0.17 * logM * logM + 0.888 * logM + 3.671);
}

// ---------------------------------------------------------------------------
// Mass-Radius Relation
// ---------------------------------------------------------------------------
// Four-piece relation, each boundary blended for continuity:
//
// M ≤ 0.5 Msol: Schweitzer et al. (2019, A&A 625, A68) linear relation
//   R = 0.0282 + 0.935 M  (55 detached eclipsing M-dwarf binaries,
//   0.09–0.6 Msol, RMS scatter ~0.02 Rsol).
// 0.5 < M ≤ 0.7 Msol: Linear blend between Schweitzer and Eker quadratic.
// 0.7 < M ≤ 1.5 Msol: Eker et al. (2018) quadratic (Table 5) from
//   eclipsing binaries:  R = 0.438 M² + 0.479 M + 0.075  (calibrated
//   0.179–1.5 Msol). Normalised so R(1.0) = 1.0 Rsol.
// M > 1.5 Msol: Derived from Eker MLR + MTR via Stefan-Boltzmann
//   (R = √L × (5776/T)²), with a normalisation factor to ensure
//   continuity at the 1.5 Msol boundary.
const MRR_NORM = 1.0 / 0.992;
const MRR_SB_NORM = (() => {
  const quadAt1_5 = (0.438 * 2.25 + 0.479 * 1.5 + 0.075) * MRR_NORM;
  const L = massToLuminosity(1.5);
  const T = massToTeff(1.5);
  return quadAt1_5 / (Math.sqrt(L) * (5776 / T) ** 2);
})();

/** Schweitzer (2019) linear M-dwarf MRR. */
function schweitzerRadius(m) {
  return 0.0282 + 0.935 * m;
}

/** Eker (2018) quadratic MRR, solar-normalised. */
function ekerQuadRadius(m) {
  return (0.438 * m * m + 0.479 * m + 0.075) * MRR_NORM;
}

/**
 * Converts stellar mass to radius using a four-piece relation:
 *
 * - M ≤ 0.5: Schweitzer et al. (2019) linear (M-dwarf eclipsing binaries)
 * - 0.5 < M ≤ 0.7: linear blend from Schweitzer to Eker quadratic
 * - 0.7 < M ≤ 1.5: Eker et al. (2018) quadratic (solar-normalised)
 * - M > 1.5: Stefan-Boltzmann derivation from Eker MLR + MTR
 *
 * The Sun (1.0 Msol) gives exactly 1.0 Rsol. All boundaries are continuous.
 * Mass is clamped to 0.075--100 Msol.
 *
 * @param {number} massMsol - Stellar mass in solar masses (Msol)
 * @returns {number} Radius in solar radii (Rsol)
 */
export function massToRadius(massMsol) {
  const m = clamp(massMsol, 0.075, 100);
  if (m <= 0.5) return schweitzerRadius(m);
  if (m <= 0.7) {
    // Linear blend: t=0 at 0.5 (Schweitzer), t=1 at 0.7 (Eker quadratic)
    const t = (m - 0.5) / 0.2;
    return schweitzerRadius(m) * (1 - t) + ekerQuadRadius(m) * t;
  }
  if (m <= 1.5) return ekerQuadRadius(m);
  const L = massToLuminosity(m);
  const T = massToTeff(m);
  return Math.sqrt(L) * (5776 / T) ** 2 * MRR_SB_NORM;
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
// Giant Planet Probability
// ---------------------------------------------------------------------------
// Probability that a star hosts at least one giant planet (>0.3 Mjup).
// Metallicity scaling: P ∝ 10^(2·[Fe/H]) (Fischer & Valenti 2005, still
// broadly accepted).  Baseline refined to ~7% at solar mass and metallicity
// from Kepler-era surveys (Petigura et al. 2018; Zink et al. 2023).
// Stellar mass dependence: f(M) ≈ M (Johnson et al. 2010, PASP 122, 905).
// Optional massMsol defaults to 1.0 for backwards compatibility.
export function giantPlanetProbability(metallicityFeH, massMsol) {
  const feH = clamp(toFinite(metallicityFeH, 0), -3, 1);
  const mass = clamp(toFinite(massMsol, 1), 0.075, 10);
  return clamp(0.07 * mass * 10 ** (2 * feH), 0, 1);
}

// Stellar population label based on [Fe/H].
export function populationLabel(metallicityFeH) {
  const feH = toFinite(metallicityFeH, 0);
  if (feH <= -1.0) return "Population II (metal-poor halo/thick disk)";
  if (feH <= -0.3) return "Intermediate (old thin disk)";
  if (feH <= 0.15) return "Population I (solar neighbourhood)";
  return "Metal-rich (inner disk)";
}

// ===========================================================================
// Main-Sequence Evolution (Hurley, Pols & Tout 2000; Tout et al. 1996)
// ===========================================================================
// Adds age- and metallicity-dependent stellar properties.  When evolutionMode
// is "evolved", luminosity and radius evolve from ZAMS values to terminal-MS
// values over the main-sequence lifetime.  Coefficients are polynomials in
// ζ = log10(Z/0.02), where Z is the metal mass fraction (Z_☉ = 0.02 in the
// Hurley convention).

const Z_SUN_SSE = 0.02;

/** Convert [Fe/H] to metal mass fraction Z (SSE convention, Z☉ = 0.02). */
export function feHtoZ(feH) {
  return Z_SUN_SSE * 10 ** clamp(toFinite(feH, 0), -3, 1);
}

/** Evaluate polynomial c[0] + c[1]ζ + c[2]ζ² + … */
function zpoly(z, c) {
  let v = 0;
  for (let i = c.length - 1; i >= 0; i--) v = v * z + c[i];
  return v;
}

// ---- ZAMS Luminosity (Tout et al. 1996, MNRAS 281, 257) -------------------
// L = (a0·M^5.5 + a1·M^11) / (a2 + M^3 + a3·M^5 + a4·M^7 + a5·M^8 + a6·M^9.5)
const ZL = [
  [0.3970417, -0.3291357, 0.3477669, 0.3747085, 0.0901192],
  [8.527626, -24.41226, 56.435971, 37.061526, 5.456241],
  [0.00025546, -0.00123461, -0.00023246, 0.00045519, 0.00016176],
  [5.432889, -8.621578, 13.44202, 14.515841, 3.397931],
  [5.563579, -10.323452, 19.44323, 18.973613, 4.169031],
  [0.7886606, -2.908709, 6.547135, 4.056067, 0.5328732],
  [0.00586685, -0.01704237, 0.03872348, 0.02570041, 0.00383376],
];

/** Tout et al. (1996) ZAMS luminosity (Lsol) from mass and Z. */
export function zamsLuminosity(massMsol, Z) {
  const m = clamp(massMsol, 0.1, 100);
  const z = Math.log10(clamp(Z, 1e-4, 0.1) / Z_SUN_SSE);
  const a = ZL.map((c) => zpoly(z, c));
  return (
    (a[0] * m ** 5.5 + a[1] * m ** 11) /
    (a[2] + m ** 3 + a[3] * m ** 5 + a[4] * m ** 7 + a[5] * m ** 8 + a[6] * m ** 9.5)
  );
}

// ---- ZAMS Radius (Tout et al. 1996) ---------------------------------------
// R = (a0·M^2.5+a1·M^6.5+a2·M^11+a3·M^19+a4·M^19.5) /
//     (a5+a6·M^2+a7·M^8.5+M^18.5+a8·M^19.5)
const ZR = [
  [1.715359, 0.6224621, -0.9255776, -1.1699697, -0.3063149],
  [6.597788, -0.4245004, -12.133394, -10.735095, -2.514871],
  [10.08855, -7.117271, -31.671195, -24.248483, -5.33609],
  [1.012495, 0.3269969, -0.009234, -0.038769, -0.004128],
  [0.07490166, 0.02410413, 0.07233664, 0.03040467, 0.00197741],
  [0.01077422, 0, 0, 0, 0],
  [3.082234, 0.9447205, -2.152009, -2.492195, -0.6384874],
  [17.84778, -7.4534569, -48.960669, -40.053861, -9.093318],
  [0.00022582, -0.00186899, 0.00388783, 0.00142402, -0.00007671],
];

/** Tout et al. (1996) ZAMS radius (Rsol) from mass and Z. */
export function zamsRadius(massMsol, Z) {
  const m = clamp(massMsol, 0.1, 100);
  const z = Math.log10(clamp(Z, 1e-4, 0.1) / Z_SUN_SSE);
  const a = ZR.map((c) => zpoly(z, c));
  return (
    (a[0] * m ** 2.5 + a[1] * m ** 6.5 + a[2] * m ** 11 + a[3] * m ** 19 + a[4] * m ** 19.5) /
    (a[5] + a[6] * m ** 2 + a[7] * m ** 8.5 + m ** 18.5 + a[8] * m ** 19.5)
  );
}

// ---- MS Lifetime (Hurley 2000, eq. 4) -------------------------------------
// t_BGB = (a0+a1·M^4+a2·M^5.5+M^7) / (a3·M^2+a4·M^7)  [Myr]
const TBGB = [
  [1593.89, 2053.038, 1231.226, 232.7785],
  [2706.708, 1483.131, 577.2723, 74.1123],
  [146.6143, -104.8442, -67.9537, -13.9113],
  [0.0414196, 0.04564888, 0.02958542, 0.005571483],
  [0.3426349, 0, 0, 0],
];

/** Main-sequence lifetime in Gyr (≈ 0.95 × t_BGB). */
export function msLifetimeGyr(massMsol, Z) {
  const m = clamp(massMsol, 0.1, 100);
  const z = Math.log10(clamp(Z, 1e-4, 0.1) / Z_SUN_SSE);
  const a = TBGB.map((c) => zpoly(z, c));
  const tBgb = (a[0] + a[1] * m ** 4 + a[2] * m ** 5.5 + m ** 7) / (a[3] * m ** 2 + a[4] * m ** 7);
  return (0.95 * tBgb) / 1000;
}

// ---- Terminal MS Luminosity (Hurley 2000, eq. 8) --------------------------
// L_TMS = (a11·M^3+a12·M^4+a13·M^(a16+1.8)) / (a14+a15·M^5+M^a16)
// a11 = a11_raw×a14, a12 = a12_raw×a14
const LTMS = [
  [1.031538, -0.243448, 7.732821, 6.460705, 1.374484],
  [1.043715, -1.577474, -5.168234, -5.596506, -1.299394],
  [785.9573, -8.542048, -26.42511, -9.585707, 0],
  [3858.911, 2459.681, -76.30093, -348.6057, -48.61703],
  [288.872, 295.2979, 185.0341, 37.97254, 0],
  [7.19658, 0.5613746, 0.3805871, 0.08398728, 0],
];

function tmsLuminosity(massMsol, Z) {
  const m = clamp(massMsol, 0.1, 100);
  const z = Math.log10(clamp(Z, 1e-4, 0.1) / Z_SUN_SSE);
  const r = LTMS.map((c) => zpoly(z, c));
  const a14 = r[3];
  const a11 = r[0] * a14;
  const a12 = r[1] * a14;
  const a16 = r[5];
  return (a11 * m ** 3 + a12 * m ** 4 + r[2] * m ** (a16 + 1.8)) / (a14 + r[4] * m ** 5 + m ** a16);
}

// ---- Terminal MS Radius (Hurley 2000, eq. 9) ------------------------------
// Low-mass (M≤a17):  max(1.5·R_ZAMS, (a18+a19·M^a21)/(a20+M^a22))
// High-mass (M>a17): (c1·M^3+a23·M^a26+a24·M^(a26+1.5))/(a25+M^5)
const RTMS_LO = [
  [0.2187715, -2.154437, -3.768678, -1.975518, -0.3021475],
  [1.46644, 1.839725, 6.442199, 4.023635, 0.6957529],
  [26.52091, 81.78458, 115.6058, 76.33811, 19.50698],
  [1.472103, -2.947609, -3.312828, -0.9945065, 0],
  [3.071048, -5.679941, -9.745523, -3.594543, 0],
];
const RTMS_HI = [
  [2.61789, 1.019135, -0.03292551, -0.07445123, 0],
  [0.01075567, 0.01773287, 0.009610479, 0.001732469, 0],
  [1.476246, 1.899331, 1.19501, 0.3035051, 0],
  [5.502535, -0.06601663, 0.09968707, 0.03599801, 0],
];

function tmsRadius(massMsol, Z) {
  const m = clamp(massMsol, 0.1, 100);
  const z = Math.log10(clamp(Z, 1e-4, 0.1) / Z_SUN_SSE);
  const logZ = Math.log10(clamp(Z, 1e-4, 0.1));
  const e1 = 0.097 - 0.1072 * (logZ + 3);
  const e2 = 0.1462 + 0.1237 * (logZ + 2);
  const a17 = 10 ** Math.max(e1, Math.max(0.097, Math.min(0.1461, e2)));
  const lo = RTMS_LO.map((c) => zpoly(z, c));
  const a20 = lo[2];
  const rLo = Math.max(
    1.5 * zamsRadius(m, Z),
    (lo[0] * a20 + lo[1] * a20 * m ** lo[3]) / (a20 + m ** lo[4]),
  );
  const hi = RTMS_HI.map((c) => zpoly(z, c));
  const a26 = hi[3];
  const rHi = Math.max(
    0.1,
    (-0.08672073 * m ** 3 + hi[0] * m ** a26 + hi[1] * m ** (a26 + 1.5)) / (hi[2] + m ** 5),
  );
  if (m <= a17) return rLo;
  if (m >= a17 + 0.1) return rHi;
  const f = (m - a17) / 0.1;
  return rLo * (1 - f) + rHi * f;
}

// ---- Luminosity evolution rate α_L (Hurley 2000, eq. 19) ------------------
function ssAlphaL(M, zeta) {
  const a45 = zpoly(zeta, [0.23214, 0.001828, -0.02232, -0.003379]);
  const a46 = zpoly(zeta, [0.01164, 0.003428, 0.001421, -0.003711]);
  const a47 = zpoly(zeta, [0.01048, -0.01232, -0.01687, -0.004234]);
  const a48 = zpoly(zeta, [1.55559, -0.32239, -0.51974, -0.10664]);
  const alHi = (a45 + a46 * M ** a48) / (M ** 0.4 + a47 * M ** 1.9);
  if (M >= 2.0) return alHi;
  const a49 = Math.max(0.145, zpoly(zeta, [0.0977, -0.231, -0.0753]));
  if (M <= 0.5) return a49;
  if (M <= 0.7) return a49 + 5 * (0.3 - a49) * (M - 0.5);
  const a50 = Math.min(0.306 + 0.053 * zeta, zpoly(zeta, [0.24, 0.18, 0.595]));
  const a51 = Math.min(0.3625 + 0.062 * zeta, zpoly(zeta, [0.33, 0.132, 0.218]));
  const a52 = Math.max(0.9, zpoly(zeta, [1.1064, 0.415, 0.18]));
  const a53 = Math.max(1.0, zpoly(zeta, [1.19, 0.377, 0.176]));
  if (M <= a52) return 0.3 + ((a50 - 0.3) * (M - 0.7)) / (a52 - 0.7);
  if (M <= a53) return a50 + ((a51 - a50) * (M - a52)) / (a53 - a52);
  const al2 = (a45 + a46 * 2 ** a48) / (2 ** 0.4 + a47 * 2 ** 1.9);
  return a51 + ((al2 - a51) * (M - a53)) / (2 - a53);
}

// ---- Luminosity curvature β_L (Hurley 2000, eq. 20) ----------------------
function ssBetaL(M, zeta) {
  const a54 = zpoly(zeta, [0.3855707, -0.6104166, 5.676742, 10.60894, 5.284014]);
  const a55 = zpoly(zeta, [0.3579064, -0.6442936, 5.494644, 10.54952, 5.280991]);
  const a56 = zpoly(zeta, [0.9587587, 0.8777464, 0.2017321]);
  return Math.max(0, a54 - a55 * M ** a56);
}

// ---- Radius evolution rate α_R (Hurley 2000, simplified) ------------------
function ssAlphaR(M, zeta) {
  if (M >= 2.0) {
    const a58 = zpoly(zeta, [0.4907546, -0.1683928, -0.3108742, -0.07202918]);
    const a59 = zpoly(zeta, [4.53707, -4.465455, -1.61269, -1.623246]);
    const a60 = zpoly(zeta, [1.79622, 0.281402, 1.423325, 0.3421036]);
    const a61 = zpoly(zeta, [2.256216, 0.37734, 1.537867, 0.4396373]);
    return (a58 * M ** a60) / (a59 + M ** a61);
  }
  return Math.max(0.065, zpoly(zeta, [0.0843, -0.0475, -0.0352]));
}

// ---- Top-level evolution functions ----------------------------------------

/**
 * Evolved luminosity (Lsol) at a given age.  Uses Tout ZAMS as baseline and
 * Hurley (2000) parametric evolution: log(L/L_ZAMS) = α·τ + β·τ^η + γ·τ²
 * where τ = age / t_MS and γ ensures L(1) = L_TMS.
 */
export function evolvedLuminosity(massMsol, Z, ageGyr) {
  const m = clamp(massMsol, 0.1, 100);
  const Zc = clamp(Z, 1e-4, 0.1);
  const tMS = msLifetimeGyr(m, Zc);
  const tau = tMS > 0 ? clamp(ageGyr / tMS, 0, 1) : 0;
  const lZams = zamsLuminosity(m, Zc);
  const lTms = tmsLuminosity(m, Zc);
  if (lZams <= 0 || lTms <= 0) return lZams;
  const lx = Math.log10(lTms / lZams);
  const zeta = Math.log10(Zc / Z_SUN_SSE);
  const aL = ssAlphaL(m, zeta);
  const bL = ssBetaL(m, zeta);
  const eta = m <= 1.0 ? 10 : m >= 1.1 ? 20 : 10 + 100 * (m - 1);
  const logRatio = aL * tau + bL * tau ** eta + (lx - aL - bL) * tau ** 2;
  return lZams * 10 ** logRatio;
}

/**
 * Evolved radius (Rsol) at a given age.  Uses Tout ZAMS as baseline and
 * Hurley (2000) parametric evolution: log(R/R_ZAMS) = α·τ + γ·τ³
 * where γ ensures R(1) = R_TMS.
 */
export function evolvedRadius(massMsol, Z, ageGyr) {
  const m = clamp(massMsol, 0.1, 100);
  const Zc = clamp(Z, 1e-4, 0.1);
  const tMS = msLifetimeGyr(m, Zc);
  const tau = tMS > 0 ? clamp(ageGyr / tMS, 0, 1) : 0;
  const rZams = zamsRadius(m, Zc);
  const rTms = tmsRadius(m, Zc);
  if (rZams <= 0 || rTms <= 0) return rZams;
  const rx = Math.log10(rTms / rZams);
  const zeta = Math.log10(Zc / Z_SUN_SSE);
  const aR = ssAlphaR(m, zeta);
  const logRatio = aR * tau + (rx - aR) * tau ** 3;
  return rZams * 10 ** logRatio;
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
 * @param {string} [params.evolutionMode="zams"] - "zams" for static scaling
 *   laws, "evolved" for age-dependent Hurley (2000) evolution
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
  evolutionMode,
}) {
  // Match sheet validation note: 0.075 <= mass <= 100
  const m = clamp(massMsol, 0.075, 100);
  const age = clamp(ageGyr, 0, 20); // sanity clamp; sheet doesn't hard-limit
  const evolved = evolutionMode === "evolved";
  const Z = evolved ? feHtoZ(metallicityFeH) : Z_SUN_SSE;

  const radiusRsolAuto = evolved ? evolvedRadius(m, Z, age) : massToRadius(m);
  const luminosityLsolAuto = evolved ? evolvedLuminosity(m, Z, age) : massToLuminosity(m);

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

  // Maximum age (Gyr).  In evolved mode use the Hurley (2000) t_BGB formula
  // which accounts for metallicity; in ZAMS mode keep the WS8 (M/L)×10 proxy.
  const maxAgeGyr = evolved ? msLifetimeGyr(m, Z) : (m / luminosityLsol) * 10;

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
    evolutionMode: evolved ? "evolved" : "zams",
    radiusRsolAuto,
    luminosityLsolAuto,
    radiusRsolZams: evolved ? zamsRadius(m, Z) : null,
    luminosityLsolZams: evolved ? zamsLuminosity(m, Z) : null,
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
    giantPlanetProbability: giantPlanetProbability(metallicityFeH, m),
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
