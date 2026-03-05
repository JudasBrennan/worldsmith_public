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
import {
  clamp,
  eccentricityFactor,
  escapeTimescaleSeconds,
  fmt,
  jeansParameter,
  k2LoveNumber,
  MOON_VOLATILE_TABLE,
  toFinite,
  vaporPressurePa,
} from "./utils.js";
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

// Surface temperature constants (SI units).
const STEFAN_BOLTZ = 5.6704e-8; // W m⁻² K⁻⁴
const L_SOL_W = 3.828e26; // Solar luminosity (W)

// Radiogenic heating — same value used in planet.js.
const EARTH_INTERNAL_HEAT_W = 44e12; // 44 TW

// Magnetospheric radiation constants.
const EARTH_SURFACE_FIELD_GAUSS = 0.31; // Earth equatorial dipole (Gauss)

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
 * Analyse which volatile ices are present on a moon's surface, whether
 * they sublimate, and whether the released gas is gravitationally retained
 * over geological timescales.
 *
 * A species requires BOTH instantaneous retention (Jeans λ > 6) AND
 * geological retention (escape timescale > system age) to sustain a
 * thin atmosphere.  SO₂ from active volcanism is exempt from the
 * timescale check because volcanic venting continuously resupplies gas.
 *
 * @param {number} densityGcm3 - Moon bulk density
 * @param {number} tSurfK - Surface temperature (K)
 * @param {number} vEscKmS - Escape velocity (km/s)
 * @param {number} gravityMs2 - Moon surface gravity (m/s²)
 * @param {number} ageGyr - System age (Gyr)
 * @param {boolean} tidalFeedbackActive - True if moon is partially molten (volcanic)
 * @returns {Array<Object>} Per-species volatile status
 */
function analyseMoonVolatiles(
  densityGcm3,
  tSurfK,
  vEscKmS,
  gravityMs2,
  ageGyr,
  tidalFeedbackActive,
) {
  const vEscMs = vEscKmS * 1000;
  const ageSeconds = ageGyr * 3.156e16;
  return MOON_VOLATILE_TABLE.map((vol) => {
    // SO₂ requires active volcanism (direct volcanic venting); others need low density
    const present = vol.species === "SO\u2082" ? tidalFeedbackActive : densityGcm3 < vol.maxRho;
    // SO₂ on volcanically active moons is outgassed directly, not surface-sublimated
    const sublimating =
      present && (vol.species === "SO\u2082" ? tidalFeedbackActive : tSurfK >= vol.subK);
    const lambda = sublimating ? jeansParameter(vol.massAmu, vEscMs, tSurfK) : 0;
    const pressurePa = sublimating ? vaporPressurePa(vol, tSurfK) : 0;

    // Instantaneous retention (λ > 6) is necessary but not sufficient.
    // Geological retention requires escape timescale > system age,
    // except for volcanically resupplied SO₂.
    let retained = lambda > 6;
    if (retained && vol.species !== "SO\u2082") {
      const tEsc = escapeTimescaleSeconds(pressurePa, gravityMs2, vol.massAmu, tSurfK, lambda);
      retained = tEsc > ageSeconds;
    }

    let status;
    if (!present) status = "Absent";
    else if (!sublimating) status = "Stable ice";
    else if (retained) status = "Thin atmosphere";
    else status = "Exosphere";

    return {
      species: vol.species,
      label: vol.label,
      massAmu: vol.massAmu,
      present,
      sublimating,
      retained,
      lambda,
      pressurePa,
      status,
    };
  });
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

function radiationLabel(remDay) {
  if (remDay < 0.001) return "Negligible";
  if (remDay < 0.01) return "Low";
  if (remDay < 0.1) return "Moderate";
  if (remDay < 1) return "High";
  if (remDay < 100) return "Very High";
  return "Extreme";
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
export function calcMoonExact({
  starMassMsol,
  starAgeGyr,
  starRadiusRsolOverride,
  starLuminosityLsolOverride,
  starTempKOverride,
  starEvolutionMode,
  planet,
  moon,
  parentOverride,
}) {
  // Parent body values — use parentOverride for gas giants, calcPlanetExact for rocky planets
  const p =
    parentOverride ||
    calcPlanetExact({
      starMassMsol,
      starAgeGyr,
      starRadiusRsolOverride,
      starLuminosityLsolOverride,
      starTempKOverride,
      starEvolutionMode,
      planet,
    });

  // Inputs
  const mStarMsol = clamp(starMassMsol, 0.01, 100);
  const ageGyr = clamp(starAgeGyr, 0, 20);

  const mPlanetME = clamp(p.inputs.massEarth, 0.001, 10000);
  const rhoPlanetGcm3 = clamp(p.derived.densityGcm3, 0.1, 100);
  const rPlanetRE = clamp(p.derived.radiusEarth, 0.01, 1000);
  const aPlanetAU = clamp(p.inputs.semiMajorAxisAu, 0.001, 1e6);
  const ePlanet = clamp(p.inputs.eccentricity, 0, 0.99);

  const rotPlanetHours = clamp(p.inputs.rotationPeriodHours, 0.1, 1e6);

  // Magnetic field and radioisotope abundance from parent (rocky planet or gas giant)
  const surfaceFieldEarths = clamp(p.derived?.surfaceFieldEarths ?? 0, 0, 1000);
  const radioisotopeAbundance = clamp(p.derived?.radioisotopeAbundance ?? 1, 0.01, 5);

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
  const rMoonRM = (mMoonMM / (rhoMoonGcm3 / 3.34)) ** (1 / 3); // C23
  const gMoon_g = (mMoonMM / rMoonRM ** 2) * 0.1654; // C24
  const vEscKmS = Math.sqrt(mMoonMM / rMoonRM) * 2.38; // C25

  // --- Orbital characteristics (MOON!C30..C40)
  const zoneInnerKm = 2.44 * rPlanetRE * KM_PER_REARTH * (rhoPlanetGcm3 / rhoMoonGcm3) ** (1 / 3); // C30
  const zoneOuterKm =
    aPlanetAU *
    KM_PER_AU_OUTER *
    ((mPlanetME * KG_PER_MEARTH_OUTER) / (3 * mStarMsol * 1.99e30)) ** (1 / 3);
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
  // Initial rotation period defaults to the spreadsheet's 12-hour assumption
  // (C238 literal) but can be overridden via moon.initialRotationPeriodHours.
  // Faster initial spin → more angular momentum to dissipate → longer lock time.
  const initialRotHours = moon.initialRotationPeriodHours
    ? toFinite(moon.initialRotationPeriodHours, 12)
    : 12;
  const omegaMoon = (2 * PI) / (initialRotHours * 3600); // C238
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
  const surfaceAreaM2 = 4 * PI * rMoonM ** 2;
  const tidalGeomFactor =
    (21 / 2) *
    ((G * mPlanetKg ** 2 * rMoonM ** 5 * nMeanMotion) / aMoonM ** 6) *
    eccentricityFactor(eMoon);

  // Initial tidal heating with cold (density-derived) material properties.
  const tidalHeatingW0 = tidalGeomFactor * (k2_moon / moonComp.Q);
  const tidalFlux0 = surfaceAreaM2 > 0 ? tidalHeatingW0 / surfaceAreaM2 : 0;

  // ── Tidal-thermal feedback (Moore 2003; Segatz et al. 1988) ───────
  // Intense tidal heating partially melts a rocky interior, lowering
  // rigidity μ and quality factor Q, which further amplifies dissipation.
  // This positive feedback is the key mechanism behind Io's extreme
  // volcanism in the Laplace resonance (Io-Europa-Ganymede 1:2:4).
  //
  // We apply the feedback when: (a) no manual composition override,
  // (b) density indicates silicate mantle (ρ ≥ 3.2), and (c) the cold-
  // state tidal flux exceeds a critical threshold for partial melting.
  // The threshold (0.02 W/m²) corresponds to the convective cooling
  // capacity of a silicate mantle (Fischer & Spohn 1999).
  const MELT_FLUX_CRIT = 0.02; // W/m² — onset of significant partial melting
  const MELT_MU = 10e9; // Pa — partially molten rigidity
  const MELT_Q = 10; // — partially molten quality factor

  let tidalFeedbackActive = false;
  let meltFraction = 0;
  let effMu = moonComp.mu;
  let effQ = moonComp.Q;
  let tidalHeatingW = tidalHeatingW0;

  if (!moon.compositionOverride && rhoMoonGcm3 >= 3.2 && tidalFlux0 > 0) {
    // Melt fraction: smooth logistic based on ratio of flux to critical flux.
    // f → 0 when flux << flux_crit; f → 1 when flux >> flux_crit.
    const ratio = tidalFlux0 / MELT_FLUX_CRIT;
    meltFraction = ratio > 0 ? 1 / (1 + ratio ** -3) : 0;

    if (meltFraction > 0.01) {
      tidalFeedbackActive = true;
      // Blend rigidity (log-space) and Q (linear) toward molten values.
      effMu = Math.exp(
        Math.log(moonComp.mu) * (1 - meltFraction) + Math.log(MELT_MU) * meltFraction,
      );
      effQ = moonComp.Q * (1 - meltFraction) + MELT_Q * meltFraction;
      const k2Eff = k2LoveNumber(rhoMoonKgM3, gMoonMs2, rMoonM, effMu);
      tidalHeatingW = tidalGeomFactor * (k2Eff / effQ);
    }
  }

  const tidalHeatingWm2 = surfaceAreaM2 > 0 ? tidalHeatingW / surfaceAreaM2 : 0;
  const tidalHeatingEarth = tidalHeatingWm2 / EARTH_GEOTHERMAL_WM2;

  // ── Surface temperature ─────────────────────────────────────────────
  // Equilibrium temperature for an airless body (no greenhouse):
  //   T_eq⁴ = L★(1 − a) / (16πσd²)
  const starDistanceM = aPlanetAU * M_PER_AU;
  const tEq4 =
    starDistanceM > 0
      ? (lStarLsol * L_SOL_W * (1 - albedo)) / (16 * PI * STEFAN_BOLTZ * starDistanceM ** 2)
      : 0;
  const tEqK = tEq4 > 0 ? Math.sqrt(Math.sqrt(tEq4)) : 0;

  // Radiogenic heat flux on moon surface (scales from Earth's 44 TW by mass × A)
  const radiogenicWm2 =
    surfaceAreaM2 > 0
      ? (EARTH_INTERNAL_HEAT_W * (mMoonKg / KG_PER_MEARTH) * radioisotopeAbundance) / surfaceAreaM2
      : 0;

  // Total surface temperature (stellar + tidal + radiogenic)
  const tSurf4 = tEq4 + tidalHeatingWm2 / STEFAN_BOLTZ + radiogenicWm2 / STEFAN_BOLTZ;
  const tSurfK = tSurf4 > 0 ? Math.round(Math.sqrt(Math.sqrt(tSurf4))) : 0;
  const tSurfC = tSurfK - 273;

  // ── Volatile inventory ────────────────────────────────────────────────
  const volatileResults = analyseMoonVolatiles(
    rhoMoonGcm3,
    tSurfK,
    vEscKmS,
    gMoonMs2,
    ageGyr,
    tidalFeedbackActive,
  );
  const retained = volatileResults.filter((v) => v.status === "Thin atmosphere");
  const primary =
    retained.length > 0 ? retained.reduce((a, b) => (a.pressurePa > b.pressurePa ? a : b)) : null;
  const stableIces = volatileResults.filter((v) => v.status === "Stable ice");

  // ── Magnetospheric radiation ────────────────────────────────────────
  // Dipole field at moon orbit: B(r) = B_surface × (R_planet / r)³
  const rPlanetKm = rPlanetRE * KM_PER_REARTH;
  const lShell = rPlanetKm > 0 ? aMoonKm / rPlanetKm : Infinity;
  const bSurfGauss = surfaceFieldEarths * EARTH_SURFACE_FIELD_GAUSS;
  const bAtMoonGauss = lShell > 0 ? bSurfGauss / lShell ** 3 : 0;

  // Magnetopause standoff distance in planet radii.
  // For gas giants: use pre-computed magnetopauseRp from gasGiant.js.
  // For rocky planets: Chapman-Ferraro scaling from Earth (10 R_E at 1 AU).
  const magnetopauseLShell =
    p.derived?.magnetopauseRp ??
    (surfaceFieldEarths > 0 ? 10 * Math.cbrt(surfaceFieldEarths) * Math.cbrt(aPlanetAU) : 0);

  // Radiation dose (B³ scaling, calibrated to Jupiter-Europa: 540 rem/day).
  // Jupiter B at Europa orbit ≈ 5.14×10⁻³ G → K = 540 / (5.14e-3)³ ≈ 3.97×10⁹.
  const EUROPA_K = 3.97e9; // rem day⁻¹ G⁻³
  let magnetosphericRadRemDay = 0;
  if (surfaceFieldEarths > 0 && lShell < magnetopauseLShell && bAtMoonGauss > 0) {
    magnetosphericRadRemDay = EUROPA_K * bAtMoonGauss ** 3;
    // Magnetopause shadowing: energetic particle drift orbits intersect
    // the magnetopause on the dayside, depleting the outer radiation belts.
    // Logistic rolloff onset ≈ 30% of magnetopause distance, steepness
    // calibrated to Callisto (L/L_mp ≈ 0.35 → observed ~5× below pure B³).
    const lFrac = lShell / magnetopauseLShell;
    magnetosphericRadRemDay /= 1 + Math.exp(25 * (lFrac - 0.3));
  }

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

  // Rotation period: synchronous if locked, otherwise exponential despinning estimate.
  // ω(t) = n + (ω₀ − n)·exp(−t/τ)  where τ = tLock/5 so exp(−5) ≈ 0.7% residual.
  let rotationPeriodDays;
  if (moonLockedToPlanet === "Yes") {
    rotationPeriodDays = periodSynodicDays; // MOON!C40
  } else {
    const tau = tMoonLockGyr / 5;
    const nSync = (2 * PI) / (periodSynodicDays * 24 * 3600);
    const omegaCurrent = nSync + (omegaMoon - nSync) * Math.exp(-ageGyr / tau);
    rotationPeriodDays = omegaCurrent > 0 ? (2 * PI) / omegaCurrent / (24 * 3600) : null;
  }

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
      initialRotationPeriodHours: initialRotHours,
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

    temperature: {
      equilibriumK: Math.round(tEqK),
      surfaceK: tSurfK,
      surfaceC: tSurfC,
      radiogenicWm2,
    },

    volatiles: {
      inventory: volatileResults,
      primaryAtmosphere: primary ? primary.species : null,
      surfacePressurePa: primary ? primary.pressurePa : 0,
      hasVolatileAtmosphere: retained.length > 0,
    },

    radiation: {
      magnetosphericRadRemDay,
      magnetosphericLabel: radiationLabel(magnetosphericRadRemDay),
      magnetopauseLShell,
      bAtMoonGauss,
      lShell,
      insideMagnetosphere: lShell < magnetopauseLShell && surfaceFieldEarths > 0,
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
      tidalFeedbackActive,
      meltFraction,
      qEffective: effQ,
      rigidityEffectiveGPa: effMu / 1e9,
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
      equilibriumTemp: Math.round(tEqK) + " K",
      surfaceTemp: tSurfK + " K (" + tSurfC + " \u00B0C)",
      // Orbit
      zoneInner: fmt(zoneInnerKm, 0) + " km",
      zoneOuter: fmt(zoneOuterKm, 0) + " km",
      peri: fmt(periKm, 0) + " km",
      apo: fmt(apoKm, 0) + " km",
      sidereal: fmt(periodSiderealDays, 3) + " days",
      synodic: fmt(periodSynodicDays, 3) + " days",
      rot:
        rotationPeriodDays === null
          ? "Not tidally locked"
          : moonLockedToPlanet === "Yes"
            ? fmt(rotationPeriodDays, 3) + " days (locked)"
            : fmt(rotationPeriodDays, 3) + " days (est.)",
      initialRot: fmt(initialRotHours, 2) + " hours",
      // Tides
      tides: fmt(totalEarthTides, 3) + " Earth tides",
      moonPct: fmt(moonContributionPct, 1) + " %",
      starPct: fmt(starContributionPct, 1) + " %",
      compositionClass: tidalFeedbackActive
        ? moonComp.compositionClass + " (partially molten)"
        : moonComp.compositionClass,
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
      radiogenicHeating:
        radiogenicWm2 < 1e-6
          ? "Negligible"
          : radiogenicWm2 < 0.001
            ? radiogenicWm2.toExponential(2) + " W/m\u00B2"
            : fmt(radiogenicWm2, 4) + " W/m\u00B2",
      magnetosphericRad:
        magnetosphericRadRemDay < 0.001
          ? "Negligible"
          : magnetosphericRadRemDay < 1
            ? fmt(magnetosphericRadRemDay, 3) + " rem/day"
            : magnetosphericRadRemDay < 1000
              ? fmt(magnetosphericRadRemDay, 1) + " rem/day"
              : magnetosphericRadRemDay.toExponential(2) + " rem/day",
      magnetosphericLabel: radiationLabel(magnetosphericRadRemDay),
      recession: formatRecession(recessionCmYr),
      orbitalFate: formatOrbitalFate(dadt_total, timeToRocheGyr, timeToEscapeGyr),
      moonLocked: moonLockedToPlanet,
      planetLockedMoon: planetLockedToMoon || "—",
      planetLockedStar: planetLockedToStar,
      surfaceIces: stableIces.map((v) => v.species).join(", ") || "None",
      volatileAtmosphere: primary
        ? primary.pressurePa >= 1
          ? primary.species + " (~" + fmt(primary.pressurePa, 0) + " Pa)"
          : primary.species + " (~" + primary.pressurePa.toExponential(1) + " Pa)"
        : "None",
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
