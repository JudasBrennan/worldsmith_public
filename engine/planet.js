// Planet model (spreadsheet-faithful port)
//
// Derives physical, orbital, thermal, and atmospheric properties for a
// terrestrial planet from user inputs plus host-star parameters.  Implements
// the PLANET sheet and the temperature / atmosphere sections of the
// Calculations sheet as closely as possible.
//
// Methodology:
//   - Density from mass + core-mass fraction (CMF) via empirical power-law
//     with a floor for sub-Earth masses (< 0.6 M⊕).
//   - Radius, surface gravity, and escape velocity from density + mass.
//   - Surface temperature via a Stefan-Boltzmann effective-temperature chain
//     with greenhouse and surface-divisor corrections.
//   - Atmospheric partial pressures, mean molecular weight, and density from
//     an N₂/O₂/CO₂/Ar gas mix at a given surface pressure.
//   - Circulation cell count keyed to rotation period.
//   - Sky colours from a PanoptesV-inspired lookup table interpolated over
//     star temperature and effective surface pressure (adjusted for
//     gravity/temperature column-density), with CO₂ tint correction.
//     Interpolation uses OKLab colour space for perceptual uniformity.
//
// Inputs:  starMassMsol, starAgeGyr, and a planet object containing mass,
//          CMF, axial tilt, albedo, greenhouse effect, observer height,
//          rotation period, orbital elements, surface pressure, and gas
//          mix percentages.
// Outputs: { star, inputs, derived, display } — clamped inputs echoed back,
//          numeric derived values for downstream use, and pre-formatted
//          display strings for the UI.

import { clamp, fmt } from "./utils.js";
import { calcStar } from "./star.js";
import { findNearestResonance } from "./debrisDisk.js";
import {
  calcRockyPlanetRigidityPa,
  calcRockyPlanetTidalQualityFactor,
} from "./physics/materials.js";
import { calcK2LoveNumber, selectSpinOrbitResonance } from "./physics/rotation.js";
import {
  buildVegetationGradient,
  skyColoursFromSpectralAndPressure,
  vegetationColours,
} from "./planet/appearance.js";
import { calcInsolationEarthRatio } from "./physics/radiative.js";
import {
  analyseVolatiles,
  bodyClass,
  classifyClimateState,
  compositionClass,
  suggestedCmfFromMetallicity,
  waterBoilingK,
  waterRadiusInflation,
  waterRegime,
} from "./planet/composition.js";
import {
  atmosphereTideRatio,
  orbitalDirectionFromInclination,
  orbitalPeriodEarthYears as calcOrbitalPeriodEarthYears,
  planetMassEarthToKg,
  semiMajorAxisAuToMeters,
  tidalLockTimeGyr,
  totalPlanetTidalHeating,
} from "./planet/orbit.js";
import { magneticFieldModel } from "./planet/magnetism.js";
import {
  applyAtmosphericEscape,
  computeAtmosphereProfile,
  computeExobaseTemp,
  computeGreenhouseTau as calcGreenhouseTau,
  computeJeansEscape,
  computeXuvFluxRatio,
} from "./planet/atmosphere.js";
import {
  computeAbsorbedFluxWm2,
  computePeriapsisApoapsisTemperatures,
  computePlanetSurfaceTemperature,
  equilibriumTemperatureK,
} from "./planet/temperature.js";
import {
  tectonicAdvisory,
  tectonicProbabilities as calcTectonicProbabilities,
} from "./planet/tectonics.js";

export { tectonicProbabilities } from "./planet/tectonics.js";
export { computeGreenhouseTau } from "./planet/atmosphere.js";

const PI = Math.PI;

// Constants used by the model (from the reference):
const STAR_MASS_TO_KG = 1.989e30;

const EARTH_RADIUS_KM = 6371;
const EARTH_DENSITY_GCM3 = 5.51; // Earth mean bulk density (g/cm³)
const DAYS_PER_YEAR = 365.256; // Julian year (IAU)

const VELOCITY_EARTH_KMS = 11.186;
const GRAVITY_EARTH_MS2 = 9.81;

// Earth's total internal heat output (~44 TW), used to normalise moon tidal
// heating on the planet.  Scales linearly with mass for other bodies.
const EARTH_INTERNAL_HEAT_W = 44e12;

// Present-day fractional contribution of each isotope to Earth's radiogenic heat.
export const ISOTOPE_HEAT_FRACTIONS = { u238: 0.39, u235: 0.04, th232: 0.4, k40: 0.17 };

// Spin-orbit resonance selection is imported from physics/rotation.js.

// --- Moon tidal heating on the planet ---

// --- Mantle outgassing model ---
// Ortenzi et al. (2020, Sci. Rep. 10, 10907): mantle redox state
// controls whether outgassing is CO₂+H₂O (oxidised) or H₂+CO (reduced).
const MANTLE_OXIDATION_MAP = {
  "highly-reduced": { deltaIW: -4, primarySpecies: "H\u2082 + CO", label: "Highly reduced" },
  reduced: {
    deltaIW: -2,
    primarySpecies: "H\u2082 + CO\u2082 (mixed)",
    label: "Moderately reduced",
  },
  earth: { deltaIW: 1, primarySpecies: "CO\u2082 + H\u2082O", label: "Earth-like" },
  oxidized: { deltaIW: 3, primarySpecies: "CO\u2082 + H\u2082O + SO\u2082", label: "Oxidized" },
};

function mantleOutgassing(oxidationState) {
  const entry = MANTLE_OXIDATION_MAP[oxidationState] || MANTLE_OXIDATION_MAP.earth;
  let hint;
  if (entry.deltaIW <= -3) {
    // ΔIW ≤ −3: strongly reducing (e.g. enstatite chondrite mantle)
    hint =
      "Reducing mantle produces H\u2082-rich atmospheres with low molecular weight and large scale height.";
  } else if (entry.deltaIW <= -1) {
    // ΔIW −3 to −1: moderately reducing
    hint = "Moderately reducing mantle produces a mix of H\u2082, CO, and CO\u2082.";
  } else if (entry.deltaIW <= 2) {
    // ΔIW −1 to +2: Earth-like oxidizing (IW+1 to IW+3 range)
    hint =
      "Oxidizing mantle produces CO\u2082 and H\u2082O, creating denser, opaque atmospheres typical of Earth/Venus.";
  } else {
    hint =
      "Highly oxidized mantle produces CO\u2082, H\u2082O, and volcanic SO\u2082 (e.g. early Venus).";
  }
  return {
    primarySpecies: entry.primarySpecies,
    oxidationLabel: entry.label,
    atmosphereHint: hint,
  };
}

const GREENHOUSE_SCALE = 0.5841; // calibrated to reproduce Earth T_surf (288 K) from T_eff (255 K)
// Surface divisor: accounts for the temperature difference between the
// atmospheric effective-emission level and the actual surface in the
// presence of convective transport.  Only physically meaningful when an
// atmosphere exists, so it ramps from 1.0 (vacuum) to 0.9 (Earth-like+).
const SURFACE_DIVISOR_MIN = 0.9;

function buildPlanetSummaryResult({
  star,
  massEarth,
  cmfPct,
  wmfPct,
  rotationPeriodHours,
  semiMajorAxisAu,
  eccentricity,
  pressureAtm,
  radioisotopeAbundance,
  densityGcm3,
  radiusEarth,
  gravityG,
  surfaceTempK,
  orbitalPeriodEarthYears,
  orbitalPeriodEarthDays,
  localDaysPerYear,
}) {
  return {
    star,
    inputs: {
      massEarth,
      cmfPct,
      wmfPct,
      rotationPeriodHours,
      semiMajorAxisAu,
      eccentricity,
      pressureAtm,
      radioisotopeAbundance,
    },
    derived: {
      densityGcm3,
      radiusEarth,
      gravityG,
      surfaceTempK,
      orbitalPeriodEarthYears,
      orbitalPeriodEarthDays,
      localDaysPerYear,
    },
  };
}

/**
 * Calculate comprehensive terrestrial-planet properties from host-star
 * parameters and user-editable planet inputs.  Mirrors the PLANET and
 * Calculations sheets of the WS8 spreadsheet.
 *
 * @param {object}  params
 * @param {number}  params.starMassMsol        Host star mass (M☉)
 * @param {number}  params.starAgeGyr          Host star age (Gyr)
 * @param {object}  params.planet              Planet input fields
 * @param {number}  params.planet.massEarth    Mass (M⊕)
 * @param {number}  params.planet.cmfPct       Core-mass fraction (%)
 * @param {number}  params.planet.axialTiltDeg Axial tilt (degrees, 0–180)
 * @param {number}  params.planet.albedoBond   Bond albedo (0–0.95)
 * @param {number}  params.planet.greenhouseEffect Dimensionless greenhouse factor
 * @param {number}  params.planet.observerHeightM  Observer height (metres)
 * @param {number}  params.planet.rotationPeriodHours Sidereal rotation period (hours)
 * @param {number}  params.planet.semiMajorAxisAu    Semi-major axis (AU)
 * @param {number}  params.planet.eccentricity       Orbital eccentricity (0–0.99)
 * @param {number}  params.planet.inclinationDeg     Orbital inclination (degrees)
 * @param {number}  params.planet.longitudeOfPeriapsisDeg Longitude of periapsis (degrees)
 * @param {number}  params.planet.subsolarLongitudeDeg    Sub-solar longitude (degrees)
 * @param {number}  params.planet.pressureAtm  Surface pressure (atm)
 * @param {number}  params.planet.o2Pct        Oxygen fraction (%)
 * @param {number}  params.planet.co2Pct       CO₂ fraction (%)
 * @param {number}  params.planet.arPct        Argon fraction (%)
 * @param {number} [params.planet.h2oPct=0]    Water vapor fraction (%)
 * @param {number} [params.planet.ch4Pct=0]    Methane fraction (%)
 * @param {number} [params.planet.h2Pct=0]     Hydrogen fraction (%)
 * @param {number} [params.planet.hePct=0]     Helium fraction (%)
 * @param {number} [params.planet.so2Pct=0]    Sulfur dioxide fraction (%)
 * @param {number} [params.planet.nh3Pct=0]    Ammonia fraction (%)
 * @param {string} [params.planet.greenhouseMode="manual"] "core"|"full"|"manual"
 * @returns {object} { star, inputs, derived, display }
 */
export function calcPlanetExact({
  starMassMsol,
  starAgeGyr,
  starRadiusRsolOverride,
  starLuminosityLsolOverride,
  starTempKOverride,
  starEvolutionMode,
  planet,
  moons,
  gasGiants,
  detailLevel = "full",
}) {
  const star = calcStar({
    massMsol: starMassMsol,
    ageGyr: starAgeGyr,
    radiusRsolOverride: starRadiusRsolOverride,
    luminosityLsolOverride: starLuminosityLsolOverride,
    tempKOverride: starTempKOverride,
    evolutionMode: starEvolutionMode,
  });

  // Suggested CMF from stellar metallicity (needed before input resolution)
  const suggestedCmf = suggestedCmfFromMetallicity(star.metallicityFeH ?? 0);
  const suggestedCmfPct = suggestedCmf * 100;

  // Inputs (clamped to sensible bounds)
  const massEarth = clamp(planet.massEarth, 0.0001, 1000);
  const cmfIsAuto = planet.cmfPct < 0 || planet.cmfPct == null;
  const cmfPct = cmfIsAuto ? suggestedCmfPct : clamp(planet.cmfPct, 0, 100); // percent
  const wmfPct = clamp(planet.wmfPct ?? 0, 0, 50); // water mass fraction %
  const axialTiltDeg = clamp(planet.axialTiltDeg, 0, 180);

  const albedoBond = clamp(planet.albedoBond, 0, 0.95); // ≤0.95: prevents runaway cooling
  const greenhouseMode = planet.greenhouseMode || "manual";
  const greenhouseEffectManual = clamp(planet.greenhouseEffect, 0, 500); // 500 K max — Venus-like upper bound

  const observerHeightM = clamp(planet.observerHeightM, 0, 10000); // 10 km — above tropopause

  const rotationPeriodHours = clamp(planet.rotationPeriodHours, 0.1, 1e6); // 0.1 h = breakup speed for rocky body
  const semiMajorAxisAu = clamp(planet.semiMajorAxisAu, 0.01, 1e6);
  const eccentricity = clamp(planet.eccentricity, 0, 0.99);
  const inclinationDeg = clamp(planet.inclinationDeg, 0, 180);
  const longitudeOfPeriapsisDeg = clamp(planet.longitudeOfPeriapsisDeg, 0, 360);
  const subsolarLongitudeDeg = clamp(planet.subsolarLongitudeDeg, 0, 360);

  const pressureAtm = clamp(planet.pressureAtm, 0, 100);

  let o2Pct = clamp(planet.o2Pct, 0, 100);
  let co2Pct = clamp(planet.co2Pct, 0, 100);
  let arPct = clamp(planet.arPct, 0, 100);
  let h2oPct = clamp(planet.h2oPct ?? 0, 0, 100);
  let ch4Pct = clamp(planet.ch4Pct ?? 0, 0, 100);
  let h2Pct = clamp(planet.h2Pct ?? 0, 0, 100);
  let hePct = clamp(planet.hePct ?? 0, 0, 100);
  let so2Pct = clamp(planet.so2Pct ?? 0, 0, 100);
  let nh3Pct = clamp(planet.nh3Pct ?? 0, 0, 100);
  const radioisotopeMode = planet.radioisotopeMode || "simple";
  let radioisotopeAbundance;
  if (radioisotopeMode === "advanced") {
    const u238 = clamp(planet.u238Abundance ?? 1, 0, 5);
    const u235 = clamp(planet.u235Abundance ?? 1, 0, 5);
    const th232 = clamp(planet.th232Abundance ?? 1, 0, 5);
    const k40 = clamp(planet.k40Abundance ?? 1, 0, 5);
    radioisotopeAbundance = Math.max(
      u238 * ISOTOPE_HEAT_FRACTIONS.u238 +
        u235 * ISOTOPE_HEAT_FRACTIONS.u235 +
        th232 * ISOTOPE_HEAT_FRACTIONS.th232 +
        k40 * ISOTOPE_HEAT_FRACTIONS.k40,
      0.01,
    );
  } else {
    radioisotopeAbundance = clamp(planet.radioisotopeAbundance ?? 1, 0.1, 3.0);
  }
  // User-friendly guardrail: do not allow derived N2 to go negative.
  // These are from the raw user inputs; if Jeans escape auto-strip is active,
  // they are recomputed below from the effective (post-strip) gas percentages.
  const rawGasInputTotalPct =
    o2Pct + co2Pct + arPct + h2oPct + ch4Pct + h2Pct + hePct + so2Pct + nh3Pct;
  const rawN2PctRaw = 100 - rawGasInputTotalPct;
  const rawGasMixOverflowPct = Math.max(0, rawGasInputTotalPct - 100);
  const rawGasMixClamped = rawGasMixOverflowPct > 0;
  let n2Pct = Math.max(0, rawN2PctRaw);
  // Star derived (also present on PLANET sheet)
  const starMassKg = STAR_MASS_TO_KG * starMassMsol;
  const hzInnerAuRaw = Number(star.habitableZoneAu?.inner);
  const hzOuterAuRaw = Number(star.habitableZoneAu?.outer);
  const hzInnerAu = Number.isFinite(hzInnerAuRaw) ? hzInnerAuRaw : 0;
  const hzOuterAu = Number.isFinite(hzOuterAuRaw) ? hzOuterAuRaw : 0;

  // Physical characteristics (PLANET C13..C16)
  const cmf = cmfPct / 100;
  const wmf = wmfPct / 100;

  // Radius-first mass–radius relation (Zeng+2016 CMF scaling with
  // mass-dependent compression exponent calibrated to Solar System):
  //   R(M, CMF) = (1.07 − 0.21 × CMF) × M^α
  //   α(M) = min(1/3, 0.257 − 0.0161 × ln M)
  // At low mass α → 1/3 (uncompressed spheres); at M = 1 M⊕ α = 0.257
  // (self-compression). Validated: Mercury 0.3%, Venus 0.8%, Earth 0.2%,
  // Mars 0.5%. Replaces the WS8 density-floor formula (16-21% off for
  // sub-Earth iron-rich bodies).
  const lnM = Math.log(Math.max(massEarth, 1e-6));
  const alpha = Math.min(1 / 3, 0.257 - 0.0161 * lnM); // Zeng+2016 compression exponent fit
  const radiusDry = (1.07 - 0.21 * cmf) * massEarth ** alpha; // Zeng+2016 CMF-scaled radius
  const densityDryGcm3 = (massEarth * EARTH_DENSITY_GCM3) / radiusDry ** 3;

  // Water-layer radius inflation (Zeng+Sasselov 2016 interpolation)
  const waterInflation = waterRadiusInflation(massEarth, wmf);
  const radiusEarth = radiusDry * waterInflation;
  const radiusKm = radiusEarth * EARTH_RADIUS_KM;

  // Effective bulk density (recomputed from inflated radius)
  const densityGcm3 =
    wmf > 0 ? (massEarth * EARTH_DENSITY_GCM3) / radiusEarth ** 3 : densityDryGcm3;

  const gravityG = massEarth / radiusEarth ** 2;
  const gravityMs2 = gravityG * GRAVITY_EARTH_MS2;

  const escapeVelocityVEarth = Math.sqrt(massEarth / radiusEarth);
  const escapeVelocityKms = escapeVelocityVEarth * VELOCITY_EARTH_KMS;

  // ── Jeans escape ──────────────────────────────────────────────────
  // Equilibrium temperature (no greenhouse) — same formula as tEqK below.
  const tEqNoGh = equilibriumTemperatureK(star.luminosityLsol, albedoBond, semiMajorAxisAu);

  // XUV flux ratio relative to present-day Earth at 1 AU (Ribas et al. 2005)
  const fXuvRatio = computeXuvFluxRatio(star.luminosityLsol, starAgeGyr, semiMajorAxisAu);

  // Exobase temperature: XUV-heated thermosphere countered by CO₂ cooling.
  const co2Frac = clamp(planet.co2Pct ?? 0, 0, 100) / 100;
  const exobaseTempK = computeExobaseTemp(tEqNoGh, fXuvRatio, pressureAtm, co2Frac);

  // Per-species Jeans escape analysis
  const jeansSpecies = computeJeansEscape(escapeVelocityKms, exobaseTempK);

  // Auto-strip: when enabled, zero out gases with "Lost" status and recompute
  // N₂ and gas-mix totals.  The original user inputs are preserved in the
  // `inputs` return object; only the physics uses the effective values.
  const atmosphericEscape = !!planet.atmosphericEscape;
  const escapeResult = applyAtmosphericEscape({
    atmosphericEscape,
    jeansSpecies,
    gasPercentages: { o2Pct, co2Pct, arPct, h2oPct, ch4Pct, h2Pct, hePct, so2Pct, nh3Pct },
  });
  const stripped = escapeResult.stripped;
  n2Pct = escapeResult.n2Pct;
  ({ o2Pct, co2Pct, arPct, h2oPct, ch4Pct, h2Pct, hePct, so2Pct, nh3Pct } =
    escapeResult.gasPercentages);

  // Greenhouse mode: compute τ from gases (core/full) or use manual input.
  const isFull = greenhouseMode === "full";
  const computedTau = calcGreenhouseTau({
    pressureAtm,
    co2Pct,
    h2oPct,
    ch4Pct,
    h2Pct,
    n2Pct,
    so2Pct,
    nh3Pct,
    full: isFull,
  });
  const computedGreenhouseEffect = computedTau / GREENHOUSE_SCALE;
  const greenhouseEffect =
    greenhouseMode === "manual" ? greenhouseEffectManual : computedGreenhouseEffect;

  // Temperature chain (Calculations C128..C135)
  const { surfaceTempK: tKel, surfaceTempC: tC } = computePlanetSurfaceTemperature({
    starLuminosityLsol: star.luminosityLsol,
    albedoBond,
    semiMajorAxisAu,
    greenhouseEffect,
    greenhouseScale: GREENHOUSE_SCALE,
    surfaceDivisorMin: SURFACE_DIVISOR_MIN,
  });

  const orbitalPeriodEarthYears = calcOrbitalPeriodEarthYears(semiMajorAxisAu, starMassMsol); // F36
  const orbitalPeriodEarthDays = orbitalPeriodEarthYears * DAYS_PER_YEAR; // F37
  const localDaysPerYear = (orbitalPeriodEarthDays * 24) / rotationPeriodHours; // C37

  if (detailLevel === "summary") {
    return buildPlanetSummaryResult({
      star,
      massEarth,
      cmfPct,
      wmfPct,
      rotationPeriodHours,
      semiMajorAxisAu,
      eccentricity,
      pressureAtm,
      radioisotopeAbundance,
      densityGcm3,
      radiusEarth,
      gravityG,
      surfaceTempK: tKel,
      orbitalPeriodEarthYears,
      orbitalPeriodEarthDays,
      localDaysPerYear,
    });
  }

  // Composition labels
  const compClass = compositionClass(cmf, wmf);
  const bClass = bodyClass(massEarth);
  const watRegime = waterRegime(wmf);

  // Core radius fraction (Zeng & Jacobsen 2017): CRF ≈ CMF^0.5
  const coreRadiusFraction = cmf > 0 ? Math.sqrt(cmf) : 0;
  const coreRadiusKm = coreRadiusFraction * radiusKm;

  // Insolation relative to Earth (L/d²)
  const insolationEarth = calcInsolationEarthRatio({
    starLuminosityLsol: star.luminosityLsol,
    orbitalDistanceAu: semiMajorAxisAu,
  });

  // Habitable zone membership
  const inHabitableZone =
    hzInnerAu > 0 && semiMajorAxisAu >= hzInnerAu && semiMajorAxisAu <= hzOuterAu;

  // Tidal lock to star (composition-dependent rigidity and Q)
  const rigidity = calcRockyPlanetRigidityPa({
    coreMassFraction: cmf,
    waterMassFraction: wmf,
  });
  const qualityFactor = calcRockyPlanetTidalQualityFactor({
    coreMassFraction: cmf,
    waterMassFraction: wmf,
  });
  const radiusM = radiusKm * 1000;
  const densityKgM3 = densityGcm3 * 1000;
  const mPlanetKg = planetMassEarthToKg(massEarth);
  const orbitM = semiMajorAxisAuToMeters(semiMajorAxisAu);
  const omegaPlanet = (2 * PI) / (rotationPeriodHours * 3600);
  const I_planet = 0.4 * mPlanetKg * radiusM ** 2;
  const k2Planet = calcK2LoveNumber({
    densityKgM3,
    gravityMs2,
    radiusM,
    rigidityPa: rigidity,
  });
  const tidalLockBodyGyr = tidalLockTimeGyr(
    omegaPlanet,
    orbitM,
    I_planet,
    qualityFactor,
    starMassKg,
    k2Planet,
    radiusM,
  );

  // Atmospheric thermal-tide resistance (Leconte+ 2015).
  // Thick atmospheres generate a pressure-asymmetry torque opposing synchronisation.
  const tEqK = equilibriumTemperatureK(star.luminosityLsol, albedoBond, semiMajorAxisAu);
  const bAtm = atmosphereTideRatio(pressureAtm, insolationEarth, gravityMs2, tEqK);
  const atmospherePreventsLocking = bAtm >= 1;

  // Effective lock timescale: atmospheric torque slows or prevents despinning.
  const tidalLockStarGyr = atmospherePreventsLocking
    ? Infinity
    : Number.isFinite(tidalLockBodyGyr)
      ? tidalLockBodyGyr / (1 - bAtm)
      : tidalLockBodyGyr;

  // Spin-orbit resonance selection (Goldreich & Peale 1966).
  // When tidally evolved, eccentricity determines which resonance the planet
  // was captured into during despinning (3:2 for Mercury, 1:1 for most).
  const tidallyEvolved =
    !atmospherePreventsLocking &&
    Number.isFinite(tidalLockStarGyr) &&
    tidalLockStarGyr <= starAgeGyr;
  const resonance = tidallyEvolved ? selectSpinOrbitResonance({ eccentricity }) : null;

  // Orbital period in hours (for resonance rotation period)
  // Kepler's third law: P² = a³/M → P = √(a³/M) years
  const orbPeriodYears = calcOrbitalPeriodEarthYears(semiMajorAxisAu, starMassMsol);
  const resonanceRotationHours = resonance
    ? (orbPeriodYears * DAYS_PER_YEAR * 24) / resonance.p
    : null;

  // Only true for 1:1 synchronous lock — higher resonances still illuminate all sides
  const tidallyLockedToStar = tidallyEvolved && resonance.ratio === "1:1";

  // Moon tidal heating on the planet (Peale et al. 1979, reciprocal formula).
  // Tidal dissipation from orbiting moons heats the planet's interior,
  // potentially extending core liquid lifetime and sustaining the dynamo.
  const planetTidalHeatingW = totalPlanetTidalHeating(
    moons,
    k2Planet,
    qualityFactor,
    mPlanetKg,
    radiusM,
  );
  const surfaceAreaM2 = 4 * PI * radiusM ** 2;
  const planetTidalHeatingWm2 = surfaceAreaM2 > 0 ? planetTidalHeatingW / surfaceAreaM2 : 0;
  const internalHeatW = EARTH_INTERNAL_HEAT_W * massEarth * radioisotopeAbundance;
  const planetTidalFraction = internalHeatW > 0 ? planetTidalHeatingW / internalHeatW : 0;

  // Magnetic field model
  const magField = magneticFieldModel({
    cmf,
    massEarth,
    radiusEarth,
    densityGcm3,
    rotationPeriodHours,
    ageGyr: starAgeGyr,
    tidalFraction: planetTidalFraction,
    radioisotopeAbundance,
  });

  // Mantle outgassing and tectonic advisory
  const outgassing = mantleOutgassing(planet.mantleOxidation || "earth");
  const tecProbs = calcTectonicProbabilities(massEarth, starAgeGyr, wmf, cmf, planetTidalFraction);
  const tecRegimeInput = planet.tectonicRegime || "auto";
  const tecRegime = tecRegimeInput === "auto" ? tecProbs.suggested : tecRegimeInput;
  const tecAdvisory = tectonicAdvisory(massEarth, starAgeGyr, wmf, planetTidalFraction);

  // Axial tilt derived text outputs
  const rotationDirection =
    axialTiltDeg === 90
      ? "Undefined"
      : axialTiltDeg >= 0 && axialTiltDeg < 90
        ? "Prograde"
        : "Retrograde";

  const tropics =
    axialTiltDeg < 90 ? `0 - ${fmt(axialTiltDeg, 2)}` : `0 - ${fmt(180 - axialTiltDeg, 2)}`;

  const polarCircles =
    axialTiltDeg < 90
      ? `${fmt(90 - axialTiltDeg, 2)} - 90`
      : `${fmt(90 - (180 - axialTiltDeg), 2)} - 90`;

  // Liquid water check (Clausius-Clapeyron boiling point model)
  const liquidWaterPossible =
    pressureAtm >= 0.006 && tKel >= 273 && tKel <= waterBoilingK(pressureAtm);

  // Absorbed stellar flux (W/m²) — globally averaged after albedo
  const absorbedFluxWm2 = computeAbsorbedFluxWm2(insolationEarth, albedoBond);

  // Climate state classification (snowball / greenhouse flags)
  const climateState = classifyClimateState(tKel, absorbedFluxWm2, watRegime !== "Dry");

  // Sky colours (after gravity + temperature are known for column-density correction)
  const sky = skyColoursFromSpectralAndPressure({
    starTempK: star.tempK,
    pressureAtm,
    gravityMs2,
    surfaceTempK: tKel,
    co2Fraction: co2Pct / 100,
  });

  // Vegetation colours (manual override or auto-calculated)
  let veg;
  if (planet.vegOverride && planet.vegPaleHexOverride && planet.vegDeepHexOverride) {
    const pale = planet.vegPaleHexOverride;
    const deep = planet.vegDeepHexOverride;
    veg = {
      paleHex: pale,
      deepHex: deep,
      stops: buildVegetationGradient(pale, deep),
      twilightPaleHex: null,
      twilightDeepHex: null,
      twilightStops: null,
      note: "Manual override",
    };
  } else {
    veg = vegetationColours({
      starTempK: star.tempK,
      pressureAtm,
      insolationEarth,
      tidallyLocked: tidallyLockedToStar,
    });
  }

  // Horizon distance (PLANET C27)
  const horizonKm =
    Math.sqrt(2 * radiusEarth * (EARTH_RADIUS_KM * 1000) * observerHeightM + observerHeightM ** 2) /
    1000;

  // Orbit characteristics (PLANET C34..C37, F36..F37)
  const periapsisAu = semiMajorAxisAu * (1 - eccentricity);
  const apoapsisAu = semiMajorAxisAu * (1 + eccentricity);

  // Equilibrium temperature at periapsis and apoapsis (blackbody + albedo,
  // no greenhouse).  Same formula as tEqK (line above) but substituting
  // the actual distance at orbital extremes.
  const { periapsisK: tEqPeriK, apoapsisK: tEqApoK } = computePeriapsisApoapsisTemperatures({
    starLuminosityLsol: star.luminosityLsol,
    albedoBond,
    periapsisAu,
    apoapsisAu,
    fallbackK: tEqK,
  });

  // Volatile sublimation analysis (dwarf planets only)
  const isDwarfPlanet = massEarth < 0.01;
  const volatileFlags = isDwarfPlanet ? analyseVolatiles(tEqPeriK, tEqApoK) : null;

  // Nearest gas giant mean-motion resonance
  const nearestResonance = findNearestResonance(
    semiMajorAxisAu,
    Array.isArray(gasGiants) ? gasGiants : [],
  );

  // "Undefined" is only reached when inclinationDeg === 90 exactly (clamped
  // to [0,180] above), matching the spreadsheet's boundary behaviour.
  const orbitalDirection = orbitalDirectionFromInclination(inclinationDeg);

  // Atmosphere
  const {
    pressureKpa,
    ppO2Atm,
    ppCO2Atm,
    ppArAtm,
    ppN2Atm,
    ppH2OAtm,
    ppCH4Atm,
    ppH2Atm,
    ppHeAtm,
    ppSO2Atm,
    ppNH3Atm,
    ppO2Kpa,
    ppCO2Kpa,
    ppArKpa,
    ppN2Kpa,
    ppH2OKpa,
    ppCH4Kpa,
    ppH2Kpa,
    ppHeKpa,
    ppSO2Kpa,
    ppNH3Kpa,
    atmWeightKgMol,
    atmDensityKgM3,
  } = computeAtmosphereProfile({
    pressureAtm,
    temperatureK: tKel,
    gasPercentages: { o2Pct, co2Pct, arPct, n2Pct, h2oPct, ch4Pct, h2Pct, hePct, so2Pct, nh3Pct },
  });

  // Atmospheric circulation cells (PLANET C60..C67)
  let cellCount = "NA";
  if (rotationPeriodHours >= 48) cellCount = "1";
  else if (rotationPeriodHours >= 6 && rotationPeriodHours < 48) cellCount = "3";
  else if (rotationPeriodHours >= 3 && rotationPeriodHours < 6) cellCount = "7";
  else if (rotationPeriodHours > 0 && rotationPeriodHours < 3) cellCount = "5";

  const cellRanges = [];
  function addCell(n, range) {
    cellRanges.push({ name: `Cell ${n}`, rangeDegNS: range });
  }
  if (cellCount === "1") {
    addCell(1, "0-90");
  } else if (cellCount === "3") {
    addCell(1, "0-30");
    addCell(2, "30-60");
    addCell(3, "60-90");
  } else if (cellCount === "7") {
    addCell(1, "0-24");
    addCell(2, "24-27");
    addCell(3, "27-31");
    addCell(4, "31-41");
    addCell(5, "41-58");
    addCell(6, "58-71");
    addCell(7, "71-90");
  } else if (cellCount === "5") {
    addCell(1, "0-23");
    addCell(2, "23-30");
    addCell(3, "30-47");
    addCell(4, "47-56");
    addCell(5, "56-90°");
  }

  // Apparent size of star (Calculations C146)
  const apparentStarDeg = (star.radiusRsol / semiMajorAxisAu) * 0.5332;

  return {
    star,
    inputs: {
      massEarth,
      cmfPct,
      wmfPct,
      axialTiltDeg,
      albedoBond,
      greenhouseEffect: greenhouseEffectManual,
      observerHeightM,
      rotationPeriodHours,
      semiMajorAxisAu,
      eccentricity,
      inclinationDeg,
      longitudeOfPeriapsisDeg,
      subsolarLongitudeDeg,
      pressureAtm,
      o2Pct,
      co2Pct,
      arPct,
      h2oPct,
      ch4Pct,
      h2Pct,
      hePct,
      so2Pct,
      nh3Pct,
      greenhouseMode,
      tectonicRegime: tecRegime,
      mantleOxidation: planet.mantleOxidation || "earth",
      radioisotopeAbundance,
      radioisotopeMode,
      u238Abundance:
        radioisotopeMode === "advanced" ? clamp(planet.u238Abundance ?? 1, 0, 5) : undefined,
      u235Abundance:
        radioisotopeMode === "advanced" ? clamp(planet.u235Abundance ?? 1, 0, 5) : undefined,
      th232Abundance:
        radioisotopeMode === "advanced" ? clamp(planet.th232Abundance ?? 1, 0, 5) : undefined,
      k40Abundance:
        radioisotopeMode === "advanced" ? clamp(planet.k40Abundance ?? 1, 0, 5) : undefined,
    },
    derived: {
      starMassKg,
      starRadiusRsol: star.radiusRsol,
      starLuminosityLsol: star.luminosityLsol,
      hzInnerAu,
      hzOuterAu,
      inHabitableZone,
      insolationEarth,
      tidalLockStarGyr,
      tidallyLockedToStar,
      tidallyEvolved,
      atmospherePreventsLocking,
      spinOrbitResonance: resonance ? resonance.ratio : null,
      resonanceRotationHours,
      liquidWaterPossible,

      skyColourDayHex: sky.dayHex,
      skyColourDayEdgeHex: sky.dayEdgeHex,
      skyColourHorizonHex: sky.horizonHex,
      skyColourHorizonEdgeHex: sky.horizonEdgeHex,
      skySpectralKey: sky.spectralKey,

      densityGcm3,
      radiusEarth,
      radiusKm,
      gravityG,
      gravityMs2,
      escapeVelocityVEarth,
      escapeVelocityKms,
      rotationDirection,
      tropics,
      polarCircles,

      surfaceTempK: tKel,
      surfaceTempC: tC,
      absorbedFluxWm2,
      climateState,

      horizonKm,

      periapsisAu,
      apoapsisAu,
      tEqPeriK: Math.round(tEqPeriK),
      tEqApoK: Math.round(tEqApoK),
      volatileFlags,
      nearestResonance,
      orbitalPeriodEarthYears,
      orbitalPeriodEarthDays,
      localDaysPerYear,
      orbitalDirection,

      pressureKpa,
      n2Pct,
      n2PctRaw: rawN2PctRaw,
      gasInputTotalPct: rawGasInputTotalPct,
      gasMixOverflowPct: rawGasMixOverflowPct,
      gasMixClamped: rawGasMixClamped,
      greenhouseMode,
      greenhouseEffect,
      computedGreenhouseEffect,
      computedGreenhouseTau: computedTau,

      ppO2Atm,
      ppCO2Atm,
      ppArAtm,
      ppN2Atm,
      ppH2OAtm,
      ppCH4Atm,
      ppH2Atm,
      ppHeAtm,
      ppSO2Atm,
      ppNH3Atm,
      ppO2Kpa,
      ppCO2Kpa,
      ppArKpa,
      ppN2Kpa,
      ppH2OKpa,
      ppCH4Kpa,
      ppH2Kpa,
      ppHeKpa,
      ppSO2Kpa,
      ppNH3Kpa,
      atmWeightKgMol,
      atmDensityKgM3,

      // Jeans escape
      jeansEscape: {
        exobaseTempK: Math.round(exobaseTempK),
        xuvFluxRatio: fXuvRatio,
        tEqNoGhK: Math.round(tEqNoGh),
        species: jeansSpecies,
        stripped,
        atmosphericEscape,
      },

      circulationCellCount: cellCount,
      circulationCellRanges: cellRanges,

      apparentStarDeg,

      // Classification & composition (Phase A)
      bodyClass: bClass,
      compositionClass: compClass,
      waterRegime: watRegime,
      coreRadiusFraction,
      coreRadiusKm,
      suggestedCmfPct,
      cmfIsAuto,

      // Magnetic field (Phase B)
      dynamoActive: magField.dynamoActive,
      dynamoReason: magField.dynamoReason,
      coreState: magField.coreState,
      fieldMorphology: magField.fieldMorphology,
      surfaceFieldEarths: magField.surfaceFieldEarths,
      fieldLabel: magField.fieldLabel,
      planetTidalHeatingW,
      planetTidalHeatingWm2,
      planetTidalFraction,
      planetTidalHeatingEarth: planetTidalHeatingWm2 / 0.087,

      // Mantle & tectonics (Phase C)
      tectonicRegime: tecRegime,
      tectonicSuggested: tecProbs.suggested,
      tectonicProbabilities: tecProbs,
      tectonicAdvisory: tecAdvisory,
      mantleOxidation: outgassing.oxidationLabel,
      primaryOutgassedSpecies: outgassing.primarySpecies,
      outgassingHint: outgassing.atmosphereHint,
      radioisotopeAbundance,

      vegetationPaleHex: veg.paleHex,
      vegetationDeepHex: veg.deepHex,
      vegetationStops: veg.stops,
      vegetationTwilightPaleHex: veg.twilightPaleHex,
      vegetationTwilightDeepHex: veg.twilightDeepHex,
      vegetationTwilightStops: veg.twilightStops,
      vegetationNote: veg.note,
    },
    display: {
      hz: `${fmt(hzInnerAu, 3)} – ${fmt(hzOuterAu, 3)} AU`,
      starRadiusKm: fmt(star.radiusRsol * 696340, 0) + " km",
      starLuminosity: fmt(star.luminosityLsol, 6) + " L☉",
      density: fmt(densityGcm3, 3) + " g/cm³",
      radius: fmt(radiusEarth, 3) + " R⊕",
      gravity: fmt(gravityG, 3) + " g",
      escape: fmt(escapeVelocityKms, 2) + " km/s",
      tempK: fmt(tKel, 0) + " K",
      tempC: fmt(tC, 0) + " °C",
      horizon: fmt(horizonKm, 2) + " km",
      peri: fmt(periapsisAu, 4) + " AU",
      apo: fmt(apoapsisAu, 4) + " AU",
      tempPeri:
        eccentricity > 0.005
          ? fmt(Math.round(tEqPeriK), 0) + " K (" + fmt(Math.round(tEqPeriK) - 273, 0) + " \u00b0C)"
          : null,
      tempApo:
        eccentricity > 0.005
          ? fmt(Math.round(tEqApoK), 0) + " K (" + fmt(Math.round(tEqApoK) - 273, 0) + " \u00b0C)"
          : null,
      volatileSummary: volatileFlags
        ? volatileFlags
            .filter((v) => v.canSublimate)
            .map((v) => v.note)
            .join("; ") || "All surface ices stable"
        : null,
      resonance: nearestResonance
        ? `${nearestResonance.label} (${fmt(nearestResonance.resonanceAu, 3)} AU, ${fmt(nearestResonance.deltaPct * 100, 1)}% off)`
        : "No nearby resonance",
      yearDays: fmt(orbitalPeriodEarthDays, 2) + " days",
      localDays: fmt(localDaysPerYear, 2) + " local days",
      pressureKpa: fmt(pressureKpa, 2) + " kPa",
      atmWeight: fmt(atmWeightKgMol, 5) + " kg/mol",
      atmDensity: fmt(atmDensityKgM3, 4) + " kg/m³",
      apparentStar: fmt(apparentStarDeg, 3) + "°",
      insolation: fmt(insolationEarth, 3) + "× Earth",
      tidalLock: atmospherePreventsLocking
        ? "Atmosphere-stabilised"
        : tidallyLockedToStar
          ? "Synchronous (1:1)"
          : tidallyEvolved
            ? `Spin-orbit resonance (${resonance.ratio})`
            : fmt(tidalLockStarGyr, 2) + " Gyr to despinning",
      bodyClass: bClass,
      compositionClass: compClass,
      waterRegime: watRegime,
      climateState,
      absorbedFlux: fmt(absorbedFluxWm2, 1) + " W/m\u00b2",
      coreRadius: `${fmt(coreRadiusFraction, 2)} R (${fmt(coreRadiusKm, 0)} km)`,
      suggestedCmf: `~${fmt(suggestedCmfPct, 0)}%`,
      suggestedCmfNote:
        (star.metallicityFeH ?? 0) === 0
          ? "solar metallicity"
          : `[Fe/H] ${(star.metallicityFeH ?? 0) > 0 ? "+" : ""}${fmt(star.metallicityFeH ?? 0, 2)}, ${(star.metallicityFeH ?? 0) > 0 ? "iron-rich" : "iron-poor"}`,
      cmfIsAuto,
      magneticField: magField.dynamoActive
        ? `${magField.fieldLabel} (${fmt(magField.surfaceFieldEarths, 2)}\u00d7 Earth)`
        : "None",
      fieldMorphology:
        magField.fieldMorphology === "none"
          ? "\u2014"
          : magField.fieldMorphology.charAt(0).toUpperCase() + magField.fieldMorphology.slice(1),
      outgassing: outgassing.primarySpecies,
      moonTidalHeating:
        planetTidalHeatingWm2 / 0.087 >= 0.01
          ? `${fmt(planetTidalHeatingWm2 / 0.087, 2)}\u00d7 Earth geothermal`
          : null,
      tectonicRegime:
        tecRegime === "plutonic-squishy"
          ? "Plutonic-Squishy"
          : tecRegime.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      tectonicIsAuto: tecRegimeInput === "auto",
      radioisotopeAbundance:
        radioisotopeAbundance === 1
          ? "Earth (1.0\u00d7)"
          : fmt(radioisotopeAbundance, 2) + "\u00d7 Earth",
    },
  };
}
