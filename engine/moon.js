// Moon physics engine (spreadsheet-faithful port + tidal heating extension)
//
// Derives physical, orbital, and tidal properties for a natural satellite
// orbiting a rocky planet or gas giant, faithfully reproducing the MOON
// and Calculations sheets from the WorldSmith 8 spreadsheet.
//
// Methodology:
//   - Physical properties (radius, gravity, escape velocity) from lunar-
//     normalised mass and density.
//   - Orbital zone limits via Roche limit (inner) and Hill sphere (outer);
//     semi-major axis is guardrailed to stay within the valid zone.
//   - Sidereal period from Kepler's third law; synodic period relative
//     to the planet's orbital period around its star.
//   - Composition-based material properties (rigidity μ and quality
//     factor Q) derived from bulk density as a proxy for rock/ice ratio.
//   - Tidal locking via Love number k₂ and quality factor Q dissipation
//     model; lock times compared against system age to determine status.
//   - Tidal heating via Peale et al. (1979) equilibrium formula:
//     dE/dt = (21/2)(k₂/Q)(G M²_p R⁵_m n e²) / a⁶
//   - Tidal forces expressed as a fraction of Earth's combined lunar +
//     solar tides using the spreadsheet's reference constant.
//
// Inputs:  star mass (M☉), star age (Gyr), parent planet parameters
//          (mass, density, radius, orbit, rotation) or a parentOverride
//          object, and moon parameters (mass, density, albedo, orbit).
// Outputs: structured object with inputs, physical, orbit, tides, and
//          display tiers (see STYLE_GUIDE.md § Return shape).
import { clamp, fmt } from "./utils.js";
import { calcPlanetExact } from "./planet.js";
import { massToLuminosity, massToRadius } from "./star.js";

const PI = Math.PI;

// Constants chosen to match the spreadsheet's literals.
const G = 6.67e-11;

// Conversions used in the MOON sheet.
const KG_PER_MSOL = 1.989e30; // MOON!F3 uses 1.989E+30
const KG_PER_MEARTH = 5.972e24; // used in sidereal period formula
const KG_PER_MEARTH_OUTER = 5.97e24; // used in Moon Zone (Outer) formula
const KG_PER_MMOON = 7.342e22; // used in sidereal period formula
const KG_PER_MMOON_F = 7.35e22; // MOON!F21 uses 7.35E+22
const KM_PER_AU_OUTER = 150000000; // used in Moon Zone (Outer) formula
const M_PER_AU = 149600000000; // Calculations D239 / E239

const KM_PER_REARTH = 6371;
const KM_PER_RMOON = 1737.4;

const SEC_PER_DAY = 86400;
const SECONDS_TO_GYR = 3.171e-17; // spreadsheet literal seconds -> Gyr

// Tides calculator constants (Calculations sheet)
const RIGIDITY = 30000000000.0; // C248 — used for planet k₂ (unchanged)
const Q_PLANET = 13.0; // D245
const EARTH_TIDES_REF = 1501373691439.2996; // C273
const EARTH_GEOTHERMAL_WM2 = 0.09; // Earth mean geothermal heat flux (W/m²)

// Recession corrections.  The homogeneous-body Love number formula
// overestimates k₂ for differentiated planets (~0.82 vs 0.30 for Earth).
// Multiplying by 0.37 calibrates to PREM k₂ = 0.299 and gives realistic
// recession rates (Earth-Moon ≈ 3.8 cm/yr).
const K2_DIFFERENTIATION = 0.37;
// Gas/ice giants dissipate orders of magnitude less per orbit than rocky
// planets.  Q_PLANET (13) is appropriate for rocky mantles; giant planets
// have Q ~ 10⁴–10⁶ (Goldreich & Soter 1966; Lainey et al. 2009/2020).
const Q_GAS_GIANT = 1e5;

// ── Composition-based material properties ────────────────────────────
// Density serves as a proxy for rock/ice ratio.  Anchor points define
// rigidity (μ) and tidal quality factor (Q) at representative densities;
// intermediate values are smoothly interpolated (log-space for μ, linear
// for Q).  Sources: Henning et al. 2009, Tobie et al. 2005, Fischer &
// Spohn 1999; calibrated against Io, Europa, and Enceladus observations.
const COMPOSITION_ANCHORS = [
  // { rho: g/cm³, mu: rigidity (Pa), Q: quality factor }
  { rho: 0.5, mu: 3.5e9, Q: 5 }, // Very icy / cometary
  { rho: 1.0, mu: 3.5e9, Q: 5 }, // Very icy boundary
  { rho: 1.5, mu: 4e9, Q: 10 }, // Icy (Enceladus, Tethys)
  { rho: 2.0, mu: 4e9, Q: 10 }, // Icy boundary
  { rho: 2.5, mu: 20e9, Q: 15 }, // Mixed rock/ice (Europa)
  { rho: 3.0, mu: 20e9, Q: 15 }, // Mixed boundary
  { rho: 4.0, mu: 50e9, Q: 30 }, // Rocky (Io, Moon)
  { rho: 5.0, mu: 50e9, Q: 30 }, // Rocky boundary
  { rho: 5.5, mu: 100e9, Q: 80 }, // Iron-rich transition
  { rho: 8.0, mu: 100e9, Q: 80 }, // Iron-rich (Mercury-like)
];

/**
 * Returns composition-dependent rigidity (Pa) and quality factor Q
 * for a body of given bulk density.
 *
 * @param {number} densityGcm3 - Bulk density in g/cm³
 * @returns {{ mu: number, Q: number, compositionClass: string }}
 */
export function compositionFromDensity(densityGcm3) {
  const rho = clamp(densityGcm3, 0.5, 8.0);
  const anchors = COMPOSITION_ANCHORS;

  let lo = anchors[0];
  let hi = anchors[anchors.length - 1];
  for (let i = 0; i < anchors.length - 1; i++) {
    if (rho >= anchors[i].rho && rho <= anchors[i + 1].rho) {
      lo = anchors[i];
      hi = anchors[i + 1];
      break;
    }
  }

  const t = hi.rho === lo.rho ? 0 : (rho - lo.rho) / (hi.rho - lo.rho);
  const mu = Math.exp(Math.log(lo.mu) + t * (Math.log(hi.mu) - Math.log(lo.mu)));
  const Q = lo.Q + t * (hi.Q - lo.Q);

  let compositionClass;
  if (densityGcm3 < 1.0) compositionClass = "Very icy";
  else if (densityGcm3 < 2.0) compositionClass = "Icy";
  else if (densityGcm3 < 3.2) compositionClass = "Mixed rock/ice";
  else if (densityGcm3 <= 5.0) compositionClass = "Rocky";
  else compositionClass = "Iron-rich";

  return { mu, Q, compositionClass };
}

/**
 * Returns canonical material properties for a named composition class.
 * Used when the user overrides the density-derived composition.
 */
function compositionFromClass(className) {
  const MAP = {
    "Very icy": { mu: 3.5e9, Q: 5, compositionClass: "Very icy" },
    Icy: { mu: 4e9, Q: 10, compositionClass: "Icy" },
    "Subsurface ocean": { mu: 0.3e9, Q: 2, compositionClass: "Subsurface ocean" },
    "Mixed rock/ice": { mu: 20e9, Q: 15, compositionClass: "Mixed rock/ice" },
    Rocky: { mu: 50e9, Q: 30, compositionClass: "Rocky" },
    "Partially molten": { mu: 10e9, Q: 10, compositionClass: "Partially molten" },
    "Iron-rich": { mu: 100e9, Q: 80, compositionClass: "Iron-rich" },
  };
  return MAP[className] || null;
}

/**
 * Wisdom (2004/2008) eccentricity function for tidal heating of a
 * synchronous rotator.  Replaces the simple e² truncation with a
 * series accurate to <0.1% for e < 0.8.
 *
 * N_a(e) / (1−e²)^(15/2)  where N_a = 1 + 15.5e² + 31.875e⁴ + …
 */
function eccentricityFactor(e) {
  if (e === 0) return 0;
  const e2 = e * e;
  const Na = 1 + 15.5 * e2 + 31.875 * e2 ** 2 + 11.5625 * e2 ** 3 + 0.390625 * e2 ** 4;
  return (Na * e2) / (1 - e2) ** 7.5;
}

function k2LoveNumber(densityKgM3, gravityMs2, radiusM, rigidity) {
  // 1.5/(1+(19*Rigidity)/(2*density*gravity*radius))
  return 1.5 / (1 + (19 * rigidity) / (2 * densityKgM3 * gravityMs2 * radiusM));
}

function lockTimeSeconds(omega, aM, I, Q, mOtherKg, k2, radiusM) {
  // (omega * a^6 * I * Q) / (3*G*mOther^2*k2*R^5)
  return (omega * aM ** 6 * I * Q) / (3 * G * mOtherKg ** 2 * k2 * radiusM ** 5);
}

function planetLockStatusFromGyr(tGyr) {
  if (tGyr < 0.001) return "Very Likely Locked";
  if (tGyr < 0.01) return "Maybe (~Myr)";
  if (tGyr < 0.1) return "Maybe (~10s Myr)";
  if (tGyr < 1) return "Maybe (~100s Myr)";
  if (tGyr < 10) return "Maybe (~Gyr)";
  if (tGyr < 100) return "Maybe (~10s Gyr)";
  if (tGyr >= 100) return "Maybe (~100s Gyr)";
  return "";
}

function formatRecession(cmYr) {
  if (!Number.isFinite(cmYr) || Math.abs(cmYr) < 1e-10) return "Stable";
  const dir = cmYr > 0 ? "outward" : "inward";
  const abs = Math.abs(cmYr);
  if (abs < 0.01) return abs.toExponential(1) + " cm/yr (" + dir + ")";
  return (cmYr > 0 ? "+" : "\u2212") + fmt(abs, 2) + " cm/yr (" + dir + ")";
}

function formatOrbitalFate(dadt, toRocheGyr, toEscapeGyr) {
  if (!Number.isFinite(dadt) || Math.abs(dadt) < 1e-30) return "Stable";
  if (dadt < 0 && Number.isFinite(toRocheGyr)) {
    if (toRocheGyr < 0.001) return "Roche limit in < 1 Myr";
    if (toRocheGyr < 1) return "Roche limit in ~" + fmt(toRocheGyr * 1000, 0) + " Myr";
    return "Roche limit in ~" + fmt(toRocheGyr, 1) + " Gyr";
  }
  if (dadt > 0 && Number.isFinite(toEscapeGyr)) {
    if (toEscapeGyr < 0.001) return "Escape in < 1 Myr";
    if (toEscapeGyr < 1) return "Escape in ~" + fmt(toEscapeGyr * 1000, 0) + " Myr";
    return "Escape in ~" + fmt(toEscapeGyr, 1) + " Gyr";
  }
  return "Stable";
}

/**
 * Computes full moon properties from host-star, planet, and moon inputs.
 *
 * When called for a moon orbiting a rocky planet, the parent's derived
 * values are obtained via `calcPlanetExact`; for gas-giant moons, pass
 * a pre-computed parent object as `parentOverride`.
 *
 * @param {object}  params
 * @param {number}  params.starMassMsol   - Host star mass (M☉)
 * @param {number}  params.starAgeGyr     - System age (Gyr)
 * @param {object}  params.planet         - Planet input fields (mass, orbit, etc.)
 * @param {object}  params.moon           - Moon input fields (mass, density, albedo, orbit)
 * @param {object}  [params.parentOverride] - Pre-computed parent body (gas giant);
 *                                            bypasses calcPlanetExact when provided
 * @returns {object} Structured result with star, planet, inputs, physical,
 *                   orbit, tides, and display tiers
 */
export function calcMoonExact({ starMassMsol, starAgeGyr, planet, moon, parentOverride }) {
  // Parent body values — use parentOverride for gas giants, calcPlanetExact for rocky planets
  const p = parentOverride || calcPlanetExact({ starMassMsol, starAgeGyr, planet });

  // Inputs
  const mStarMsol = clamp(starMassMsol, 0.01, 100);
  const ageGyr = clamp(starAgeGyr, 0, 20);

  const mPlanetME = clamp(p.inputs.massEarth, 0.001, 10000);
  const rhoPlanetGcm3 = clamp(p.derived.densityGcm3, 0.1, 100);
  const rPlanetRE = clamp(p.derived.radiusEarth, 0.01, 1000);
  const aPlanetAU = clamp(p.inputs.semiMajorAxisAu, 0.001, 1e6);
  const ePlanet = clamp(p.inputs.eccentricity, 0, 0.99);

  const rotPlanetHours = clamp(p.inputs.rotationPeriodHours, 0.1, 1e6);

  const mMoonMM = clamp(moon.massMoon ?? 1.0, 0.001, 10000);
  const rhoMoonGcm3 = clamp(moon.densityGcm3 ?? 3.34, 0.1, 100);
  const albedo = clamp(moon.albedo ?? 0.11, 0, 0.95);

  const aMoonKmInput = clamp(moon.semiMajorAxisKm ?? 384748, 10, 1e9);
  const eMoon = clamp(moon.eccentricity ?? 0.055, 0, 0.99);
  const inc = clamp(moon.inclinationDeg ?? 5.15, 0, 180);

  // Star derived values (Eker et al. 2018 relations from star.js)
  const rStarRsol = massToRadius(mStarMsol);
  const lStarLsol = massToLuminosity(mStarMsol);

  // Planet values per MOON sheet
  const periPlanetAU = aPlanetAU * (1 - ePlanet);
  const periodPlanetDays = Math.sqrt(aPlanetAU ** 3 / mStarMsol) * 365.256; // MOON!C16

  // --- Moon physical (MOON!C23..C26)
  const rMoonRM = Math.pow(mMoonMM / (rhoMoonGcm3 / 3.34), 1 / 3); // C23
  const gMoon_g = (mMoonMM / rMoonRM ** 2) * 0.1654; // C24
  const vEscKmS = Math.sqrt(mMoonMM / rMoonRM) * 2.38; // C25

  // --- Orbital characteristics (MOON!C30..C40)
  const zoneInnerKm =
    2.44 * rPlanetRE * KM_PER_REARTH * Math.pow(rhoPlanetGcm3 / rhoMoonGcm3, 1 / 3); // C30
  const zoneOuterKm =
    aPlanetAU *
    KM_PER_AU_OUTER *
    Math.pow((mPlanetME * KG_PER_MEARTH_OUTER) / (3 * mStarMsol * 1.99e30), 1 / 3);
  // C31: note the literal 1.99e30 is the value the spreadsheet cell uses for
  // kg/Msol in this formula, which differs slightly from KG_PER_MSOL (1.989e30)
  // used elsewhere.  Both literals are kept to preserve exact spreadsheet output.
  // Guardrail: keep the moon's semi-major axis inside the valid moon zone.
  // Too small risks collision/disruption; too large risks becoming unbound.
  const periFactor = Math.max(1e-6, 1 - eMoon);
  const apoFactor = 1 + eMoon;
  const minAMoonKm = zoneInnerKm / periFactor;
  const maxAMoonKm = zoneOuterKm / apoFactor;

  let aMoonKm = aMoonKmInput;
  let semiMajorAxisGuard = "none";
  if (Number.isFinite(minAMoonKm) && Number.isFinite(maxAMoonKm) && maxAMoonKm >= minAMoonKm) {
    if (aMoonKmInput < minAMoonKm) {
      aMoonKm = minAMoonKm;
      semiMajorAxisGuard = "raised_to_avoid_collision";
    } else if (aMoonKmInput > maxAMoonKm) {
      aMoonKm = maxAMoonKm;
      semiMajorAxisGuard = "lowered_to_remain_bound";
    }
  } else {
    const zMin = Math.min(zoneInnerKm, zoneOuterKm);
    const zMax = Math.max(zoneInnerKm, zoneOuterKm);
    const clampedFallback = clamp(aMoonKmInput, zMin, zMax);
    if (clampedFallback !== aMoonKmInput) semiMajorAxisGuard = "clamped_to_moon_zone";
    aMoonKm = clampedFallback;
  }

  const periKm = aMoonKm * (1 - eMoon); // C34
  const apoKm = aMoonKm * (1 + eMoon); // C35

  // C37: "Undefined" is only reached when inc === 90 exactly (inc is clamped
  // to [0,180] above), matching the spreadsheet's boundary behaviour.
  const orbitalDirection =
    inc >= 0 && inc < 90 ? "Prograde" : inc > 90 && inc <= 180 ? "Retrograde" : "Undefined"; // C37

  const periodSiderealDays =
    (2 *
      PI *
      Math.sqrt(
        (aMoonKm * 1000) ** 3 / (G * (mPlanetME * KG_PER_MEARTH + mMoonMM * KG_PER_MMOON)),
      )) /
    SEC_PER_DAY; // C38
  const synodicDenom = Math.abs(1 / periodSiderealDays - 1 / periodPlanetDays);
  const periodSynodicDays = synodicDenom > 0 ? 1 / synodicDenom : Infinity; // C39

  // --- Tides calculator (Calculations sheet block)
  // Conversions (match MOON!F* references used by Calculations)
  const mMoonKg = mMoonMM * KG_PER_MMOON_F; // MOON!F21 uses 7.35E+22
  const rMoonM = rMoonRM * KM_PER_RMOON * 1000; // MOON!F23*1000
  const rhoMoonKgM3 = rhoMoonGcm3 * 1000; // C242
  const gMoonMs2 = gMoon_g * 9.81; // MOON!F24

  const mPlanetKg = mPlanetME * 5.972e24; // MOON!F8 uses 5.972E+24
  const rPlanetM = rPlanetRE * KM_PER_REARTH * 1000; // MOON!F11*1000
  const rhoPlanetKgM3 = rhoPlanetGcm3 * 1000; // D242
  const gPlanetMs2 = (mPlanetME / rPlanetRE ** 2) * 9.81; // MOON!F12 equivalent

  const mStarKg = mStarMsol * KG_PER_MSOL; // MOON!F3

  // Angular speeds (C238/D238)
  // omegaMoon uses the spreadsheet's hardcoded 12-hour initial rotation period
  // (C238 literal).  This is a model assumption: the moon is assumed to have
  // started spinning once every 12 hours before tidal forces slowed it down.
  // The output (tMoonLockGyr) tells you how long it takes to reach tidal lock
  // from that initial state, matching the WorldSmith 8 spreadsheet exactly.
  const omegaMoon = (2 * PI) / (12 * 3600); // C238 — fixed 12 h initial rotation
  const omegaPlanet = (2 * PI) / (rotPlanetHours * 3600); // D238

  // Distances (C239/D239/E239)
  const aMoonM = aMoonKm * 1000;
  const aPlanetM = aPlanetAU * M_PER_AU;

  // Moments of inertia (C244/D244)
  const I_moon = 0.4 * mMoonKg * rMoonM ** 2;
  const I_planet = 0.4 * mPlanetKg * rPlanetM ** 2;

  // Composition-based material properties for the moon
  const moonComp =
    (moon.compositionOverride && compositionFromClass(moon.compositionOverride)) ||
    compositionFromDensity(rhoMoonGcm3);

  // k2 (C247/D247) — moon uses composition-appropriate rigidity
  const k2_moon = k2LoveNumber(rhoMoonKgM3, gMoonMs2, rMoonM, moonComp.mu);
  const k2_planet = k2LoveNumber(rhoPlanetKgM3, gPlanetMs2, rPlanetM, RIGIDITY);

  // Lock times (C252/C253, C255/C256, C266/C267)
  const tMoonLockGyr =
    lockTimeSeconds(omegaMoon, aMoonM, I_moon, moonComp.Q, mPlanetKg, k2_moon, rMoonM) *
    SECONDS_TO_GYR;
  const tPlanetLockToMoonGyr =
    lockTimeSeconds(omegaPlanet, aMoonM, I_planet, Q_PLANET, mMoonKg, k2_planet, rPlanetM) *
    SECONDS_TO_GYR;
  const tPlanetLockToStarGyr =
    lockTimeSeconds(omegaPlanet, aPlanetM, I_planet, Q_PLANET, mStarKg, k2_planet, rPlanetM) *
    SECONDS_TO_GYR;

  // Tidal forces (C270/C271)
  const tideMoon = (2 * G * mMoonKg * mPlanetKg) / aMoonM ** 3;
  const tideStar = (2 * G * mPlanetKg * mStarKg) / aPlanetM ** 3;
  const tideTotal = tideMoon + tideStar;

  const totalEarthTides = (tideMoon + tideStar) / EARTH_TIDES_REF; // MOON!C44
  const moonContributionPct = tideTotal > 0 ? (tideMoon / tideTotal) * 100 : 0; // MOON!C45
  const starContributionPct = tideTotal > 0 ? (tideStar / tideTotal) * 100 : 0; // MOON!C46

  // ── Tidal heating (Wisdom 2008; Peale et al. 1979) ─────────────────
  // dE/dt = (21/2)(k₂/Q)(G M_p² R_m⁵ n / a⁶) · f(e)
  // where f(e) is the full Wisdom eccentricity function (replaces e²).
  // Note: obliquity term (1.5·sin²ε) is omitted — orbital inclination
  // is NOT the same as spin-axis obliquity, and the forced obliquity of
  // tidally locked moons requires Cassini-state theory to compute.
  const nMeanMotion = (2 * PI) / (periodSiderealDays * SEC_PER_DAY);
  const tidalHeatingW =
    (21 / 2) *
    (k2_moon / moonComp.Q) *
    ((G * mPlanetKg ** 2 * rMoonM ** 5 * nMeanMotion) / aMoonM ** 6) *
    eccentricityFactor(eMoon);
  const surfaceAreaM2 = 4 * PI * rMoonM ** 2;
  const tidalHeatingWm2 = surfaceAreaM2 > 0 ? tidalHeatingW / surfaceAreaM2 : 0;
  const tidalHeatingEarth = tidalHeatingWm2 / EARTH_GEOTHERMAL_WM2;

  // ── Tidal recession (Leconte et al. 2010) ─────────────────────────
  // Corrected k₂ for differentiation, and Q scaled for parent type.
  const isGasGiant = rhoPlanetGcm3 < 2;
  const k2PlanetEff = k2_planet * K2_DIFFERENTIATION;
  const qPlanetEff = isGasGiant ? Q_GAS_GIANT : Q_PLANET;
  // Planet tide: outward when planet spins faster than moon orbits
  const signFactor = Math.sign(omegaPlanet - nMeanMotion);
  const dadt_planet =
    signFactor *
    3 *
    (k2PlanetEff / qPlanetEff) *
    (mMoonKg / mPlanetKg) *
    nMeanMotion *
    (rPlanetM ** 5 / aMoonM ** 4);
  // Moon tide: always inward for a locked moon (eccentricity damping)
  const dadt_moon =
    ((-21 / 2) *
      (k2_moon / moonComp.Q) *
      (mPlanetKg / mMoonKg) *
      nMeanMotion *
      (rMoonM ** 5 * eMoon ** 2)) /
    aMoonM ** 4;
  const dadt_total = dadt_planet + dadt_moon; // m/s
  const recessionCmYr = dadt_total * 100 * 365.25 * SEC_PER_DAY; // cm/year

  // Linear time estimates to orbital boundaries
  const distToRocheM = aMoonM - zoneInnerKm * 1000;
  const distToHillM = zoneOuterKm * 1000 - aMoonM;
  const timeToRocheGyr =
    dadt_total < 0 && distToRocheM > 0
      ? (distToRocheM / Math.abs(dadt_total)) * SECONDS_TO_GYR
      : Infinity;
  const timeToEscapeGyr =
    dadt_total > 0 && distToHillM > 0 ? (distToHillM / dadt_total) * SECONDS_TO_GYR : Infinity;

  const moonLockedToPlanet = tMoonLockGyr <= ageGyr ? "Yes" : "No"; // MOON!C48
  const planetLockedToMoon = planetLockStatusFromGyr(tPlanetLockToMoonGyr); // MOON!C49 concat block
  // User-friendly guardrail: compare lock time against current system age.
  const planetLockedToStar = tPlanetLockToStarGyr <= ageGyr ? "Yes" : "No";

  const rotationPeriodDays = moonLockedToPlanet === "Yes" ? periodSynodicDays : null; // MOON!C40

  return {
    // Context (mirrors top of sheet)
    star: { massMsol: mStarMsol, radiusRsol: rStarRsol, luminosityLsol: lStarLsol, ageGyr },
    planet: {
      massEarth: mPlanetME,
      cmfPct: p.inputs.cmfPct,
      densityGcm3: rhoPlanetGcm3,
      radiusEarth: rPlanetRE,
      gravityG: p.derived.gravityG,
      semiMajorAxisAu: aPlanetAU,
      eccentricity: ePlanet,
      periapsisAu: periPlanetAU,
      orbitalPeriodDays: periodPlanetDays,
      rotationPeriodHours: rotPlanetHours,
    },

    inputs: {
      massMoon: mMoonMM,
      densityGcm3: rhoMoonGcm3,
      albedo,
      semiMajorAxisKmInput: aMoonKmInput,
      semiMajorAxisKm: aMoonKm,
      eccentricity: eMoon,
      inclinationDeg: inc,
    },

    physical: {
      radiusMoon: rMoonRM,
      gravityG: gMoon_g,
      escapeVelocityKmS: vEscKmS,
    },

    orbit: {
      moonZoneInnerKm: zoneInnerKm,
      moonZoneOuterKm: zoneOuterKm,
      semiMajorAxisAllowedMinKm: minAMoonKm,
      semiMajorAxisAllowedMaxKm: maxAMoonKm,
      semiMajorAxisGuard,
      periapsisKm: periKm,
      apoapsisKm: apoKm,
      orbitalDirection,
      orbitalPeriodSiderealDays: periodSiderealDays,
      orbitalPeriodSynodicDays: periodSynodicDays,
      rotationPeriodDays,
    },

    tides: {
      totalEarthTides,
      moonContributionPct,
      starContributionPct,
      tidalHeatingW,
      tidalHeatingWm2,
      tidalHeatingEarth,
      compositionClass: moonComp.compositionClass,
      k2Moon: k2_moon,
      qMoon: moonComp.Q,
      rigidityMoonGPa: moonComp.mu / 1e9,
      compositionOverride: moon.compositionOverride || null,
      recessionCmYr,
      timeToRocheGyr,
      timeToEscapeGyr,
      moonLockedToPlanet,
      planetLockedToMoon,
      planetLockedToStar,
      lockingTimesGyr: {
        moonToPlanet: tMoonLockGyr,
        planetToMoon: tPlanetLockToMoonGyr,
        planetToStar: tPlanetLockToStarGyr,
      },
    },

    display: {
      // Physical
      radius: fmt(rMoonRM, 3) + " R☾",
      gravity: fmt(gMoon_g, 3) + " g",
      esc: fmt(vEscKmS, 2) + " km/s",
      // Orbit
      zoneInner: fmt(zoneInnerKm, 0) + " km",
      zoneOuter: fmt(zoneOuterKm, 0) + " km",
      peri: fmt(periKm, 0) + " km",
      apo: fmt(apoKm, 0) + " km",
      sidereal: fmt(periodSiderealDays, 3) + " days",
      synodic: fmt(periodSynodicDays, 3) + " days",
      rot:
        rotationPeriodDays === null ? "Not tidally locked" : fmt(rotationPeriodDays, 3) + " days",
      // Tides
      tides: fmt(totalEarthTides, 3) + " Earth tides",
      moonPct: fmt(moonContributionPct, 1) + " %",
      starPct: fmt(starContributionPct, 1) + " %",
      compositionClass: moonComp.compositionClass,
      tidalHeating:
        tidalHeatingWm2 < 1e-6
          ? "Negligible"
          : tidalHeatingWm2 < 0.001
            ? tidalHeatingWm2.toExponential(2) + " W/m\u00B2"
            : fmt(tidalHeatingWm2, 4) + " W/m\u00B2",
      tidalHeatingTotal:
        tidalHeatingW < 1
          ? "Negligible"
          : tidalHeatingW < 1e6
            ? fmt(tidalHeatingW, 0) + " W"
            : tidalHeatingW.toExponential(2) + " W",
      tidalHeatingXEarth:
        tidalHeatingEarth < 1e-4 ? "Negligible" : fmt(tidalHeatingEarth, 2) + "\u00D7 Earth",
      recession: formatRecession(recessionCmYr),
      orbitalFate: formatOrbitalFate(dadt_total, timeToRocheGyr, timeToEscapeGyr),
      moonLocked: moonLockedToPlanet,
      planetLockedMoon: planetLockedToMoon || "—",
      planetLockedStar: planetLockedToStar,
      tMoonLock: fmt(tMoonLockGyr, 6) + " Gyr",
      tPlanetMoon: fmt(tPlanetLockToMoonGyr, 6) + " Gyr",
      tPlanetStar: fmt(tPlanetLockToStarGyr, 6) + " Gyr",
    },
  };
}

/**
 * Alias for {@link calcMoonExact} — retained for backwards compatibility
 * with early Moon tab versions.
 *
 * @param {object} params - Same parameters as calcMoonExact
 * @returns {object} Same structured result as calcMoonExact
 */
export const calcMoon = calcMoonExact;
