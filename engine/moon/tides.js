import { fmt } from "../utils.js";
import {
  EARTHLIKE_HOST_TIDAL_QUALITY_FACTOR,
  GAS_GIANT_HOST_TIDAL_QUALITY_FACTOR,
  getMoonMaterialProfileByClass,
  SILICATE_RIGIDITY_PA,
} from "../physics/materials.js";
import { auToMeters, earthMassToKg, moonMassToKg, solarMassToKg } from "../physics/orbital.js";
import {
  calcEccentricityFactor,
  calcK2LoveNumber,
  calcTidalLockTimeSeconds,
} from "../physics/rotation.js";

const PI = Math.PI;
const G = 6.67e-11;
const KM_PER_REARTH = 6371;
const KM_PER_RMOON = 1737.4;
const SEC_PER_DAY = 86400;
const SECONDS_TO_GYR = 3.171e-17;
const LEGACY_TIDAL_MOON_MASS_KG = 7.35e22;
const TIDAL_MOON_MASS_SCALE = LEGACY_TIDAL_MOON_MASS_KG / moonMassToKg(1);

const RIGIDITY = SILICATE_RIGIDITY_PA;
const EARTH_TIDES_REF = 1501373691439.2996;
const EARTH_GEOTHERMAL_WM2 = 0.09;

const K2_DIFFERENTIATION = 0.37;

const MELT_FLUX_CRIT = 0.02;
const PARTIALLY_MOLTEN_PROFILE = getMoonMaterialProfileByClass({
  className: "Partially molten",
});
const MELT_MU = PARTIALLY_MOLTEN_PROFILE.mu;
const MELT_Q = PARTIALLY_MOLTEN_PROFILE.Q;

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

export function formatRecession(cmYr) {
  if (!Number.isFinite(cmYr) || Math.abs(cmYr) < 1e-10) return "Stable";
  const direction = cmYr > 0 ? "outward" : "inward";
  const magnitude = Math.abs(cmYr);
  if (magnitude < 0.01) return `${magnitude.toExponential(1)} cm/yr (${direction})`;
  return `${cmYr > 0 ? "+" : "−"}${fmt(magnitude, 2)} cm/yr (${direction})`;
}

export function formatOrbitalFate(dadt, toRocheGyr, toEscapeGyr) {
  if (!Number.isFinite(dadt) || Math.abs(dadt) < 1e-30) return "Stable";
  if (dadt < 0 && Number.isFinite(toRocheGyr)) {
    if (toRocheGyr < 0.001) return "Roche limit in < 1 Myr";
    if (toRocheGyr < 1) return `Roche limit in ~${fmt(toRocheGyr * 1000, 0)} Myr`;
    return `Roche limit in ~${fmt(toRocheGyr, 1)} Gyr`;
  }
  if (dadt > 0 && Number.isFinite(toEscapeGyr)) {
    if (toEscapeGyr < 0.001) return "Escape in < 1 Myr";
    if (toEscapeGyr < 1) return `Escape in ~${fmt(toEscapeGyr * 1000, 0)} Myr`;
    return `Escape in ~${fmt(toEscapeGyr, 1)} Gyr`;
  }
  return "Stable";
}

export function computeMoonTidalState({
  systemAgeGyr,
  starMassMsol,
  planetMassEarth,
  planetDensityGcm3,
  planetRadiusEarth,
  planetSemiMajorAxisAu,
  planetRotationHours,
  moonMassMoon,
  moonDensityGcm3,
  moonRadiusMoon,
  moonGravityG,
  moonSemiMajorAxisKm,
  moonEccentricity,
  initialRotationPeriodHours,
  zoneInnerKm,
  zoneOuterKm,
  orbitalPeriodSiderealDays,
  orbitalPeriodSynodicDays,
  composition,
  hasCompositionOverride,
}) {
  const moonMassKg = moonMassToKg(moonMassMoon) * TIDAL_MOON_MASS_SCALE;
  const moonRadiusM = moonRadiusMoon * KM_PER_RMOON * 1000;
  const moonDensityKgM3 = moonDensityGcm3 * 1000;
  const moonGravityMs2 = moonGravityG * 9.81;

  const planetMassKg = earthMassToKg(planetMassEarth);
  const planetRadiusM = planetRadiusEarth * KM_PER_REARTH * 1000;
  const planetDensityKgM3 = planetDensityGcm3 * 1000;
  const planetGravityMs2 = (planetMassEarth / planetRadiusEarth ** 2) * 9.81;
  const starMassKg = solarMassToKg(starMassMsol);

  const omegaMoon = (2 * PI) / (initialRotationPeriodHours * 3600);
  const omegaPlanet = (2 * PI) / (planetRotationHours * 3600);
  const moonSemiMajorAxisM = moonSemiMajorAxisKm * 1000;
  const planetSemiMajorAxisM = auToMeters(planetSemiMajorAxisAu);

  const inertiaMoon = 0.4 * moonMassKg * moonRadiusM ** 2;
  const inertiaPlanet = 0.4 * planetMassKg * planetRadiusM ** 2;

  const k2Moon = calcK2LoveNumber({
    densityKgM3: moonDensityKgM3,
    gravityMs2: moonGravityMs2,
    radiusM: moonRadiusM,
    rigidityPa: composition.mu,
  });
  const k2Planet = calcK2LoveNumber({
    densityKgM3: planetDensityKgM3,
    gravityMs2: planetGravityMs2,
    radiusM: planetRadiusM,
    rigidityPa: RIGIDITY,
  });

  const tMoonLockGyr =
    calcTidalLockTimeSeconds({
      spinRateRadPerSec: omegaMoon,
      orbitalSeparationM: moonSemiMajorAxisM,
      momentOfInertiaKgM2: inertiaMoon,
      qualityFactor: composition.Q,
      otherMassKg: planetMassKg,
      loveNumberK2: k2Moon,
      radiusM: moonRadiusM,
    }) * SECONDS_TO_GYR;
  const tPlanetLockToMoonGyr =
    calcTidalLockTimeSeconds({
      spinRateRadPerSec: omegaPlanet,
      orbitalSeparationM: moonSemiMajorAxisM,
      momentOfInertiaKgM2: inertiaPlanet,
      qualityFactor: EARTHLIKE_HOST_TIDAL_QUALITY_FACTOR,
      otherMassKg: moonMassKg,
      loveNumberK2: k2Planet,
      radiusM: planetRadiusM,
    }) * SECONDS_TO_GYR;
  const tPlanetLockToStarGyr =
    calcTidalLockTimeSeconds({
      spinRateRadPerSec: omegaPlanet,
      orbitalSeparationM: planetSemiMajorAxisM,
      momentOfInertiaKgM2: inertiaPlanet,
      qualityFactor: EARTHLIKE_HOST_TIDAL_QUALITY_FACTOR,
      otherMassKg: starMassKg,
      loveNumberK2: k2Planet,
      radiusM: planetRadiusM,
    }) * SECONDS_TO_GYR;

  const tideMoon = (2 * G * moonMassKg * planetMassKg) / moonSemiMajorAxisM ** 3;
  const tideStar = (2 * G * planetMassKg * starMassKg) / planetSemiMajorAxisM ** 3;
  const tideTotal = tideMoon + tideStar;

  const totalEarthTides = (tideMoon + tideStar) / EARTH_TIDES_REF;
  const moonContributionPct = tideTotal > 0 ? (tideMoon / tideTotal) * 100 : 0;
  const starContributionPct = tideTotal > 0 ? (tideStar / tideTotal) * 100 : 0;

  const nMeanMotion = (2 * PI) / (orbitalPeriodSiderealDays * SEC_PER_DAY);
  const surfaceAreaM2 = 4 * PI * moonRadiusM ** 2;
  const tidalGeomFactor =
    (21 / 2) *
    ((G * planetMassKg ** 2 * moonRadiusM ** 5 * nMeanMotion) / moonSemiMajorAxisM ** 6) *
    calcEccentricityFactor({ eccentricity: moonEccentricity });

  const tidalHeatingW0 = tidalGeomFactor * (k2Moon / composition.Q);
  const tidalFlux0 = surfaceAreaM2 > 0 ? tidalHeatingW0 / surfaceAreaM2 : 0;

  let tidalFeedbackActive = false;
  let meltFraction = 0;
  let effectiveRigidity = composition.mu;
  let effectiveQ = composition.Q;
  let tidalHeatingW = tidalHeatingW0;

  if (!hasCompositionOverride && moonDensityGcm3 >= 3.2 && tidalFlux0 > 0) {
    const ratio = tidalFlux0 / MELT_FLUX_CRIT;
    meltFraction = ratio > 0 ? 1 / (1 + ratio ** -3) : 0;
    if (meltFraction > 0.01) {
      tidalFeedbackActive = true;
      effectiveRigidity = Math.exp(
        Math.log(composition.mu) * (1 - meltFraction) + Math.log(MELT_MU) * meltFraction,
      );
      effectiveQ = composition.Q * (1 - meltFraction) + MELT_Q * meltFraction;
      const k2Effective = calcK2LoveNumber({
        densityKgM3: moonDensityKgM3,
        gravityMs2: moonGravityMs2,
        radiusM: moonRadiusM,
        rigidityPa: effectiveRigidity,
      });
      tidalHeatingW = tidalGeomFactor * (k2Effective / effectiveQ);
    }
  }

  const tidalHeatingWm2 = surfaceAreaM2 > 0 ? tidalHeatingW / surfaceAreaM2 : 0;
  const tidalHeatingEarth = tidalHeatingWm2 / EARTH_GEOTHERMAL_WM2;

  const isGasGiant = planetDensityGcm3 < 2;
  const k2PlanetEff = k2Planet * K2_DIFFERENTIATION;
  const qPlanetEff = isGasGiant
    ? GAS_GIANT_HOST_TIDAL_QUALITY_FACTOR
    : EARTHLIKE_HOST_TIDAL_QUALITY_FACTOR;
  const signFactor = Math.sign(omegaPlanet - nMeanMotion);
  const dadtPlanet =
    signFactor *
    3 *
    (k2PlanetEff / qPlanetEff) *
    (moonMassKg / planetMassKg) *
    nMeanMotion *
    (planetRadiusM ** 5 / moonSemiMajorAxisM ** 4);
  const dadtMoon =
    ((-21 / 2) *
      (k2Moon / composition.Q) *
      (planetMassKg / moonMassKg) *
      nMeanMotion *
      (moonRadiusM ** 5 * moonEccentricity ** 2)) /
    moonSemiMajorAxisM ** 4;
  const dadtTotal = dadtPlanet + dadtMoon;
  const recessionCmYr = dadtTotal * 100 * 365.25 * SEC_PER_DAY;

  const distToRocheM = moonSemiMajorAxisM - zoneInnerKm * 1000;
  const distToHillM = zoneOuterKm * 1000 - moonSemiMajorAxisM;
  const timeToRocheGyr =
    dadtTotal < 0 && distToRocheM > 0
      ? (distToRocheM / Math.abs(dadtTotal)) * SECONDS_TO_GYR
      : Infinity;
  const timeToEscapeGyr =
    dadtTotal > 0 && distToHillM > 0 ? (distToHillM / dadtTotal) * SECONDS_TO_GYR : Infinity;

  const moonLockedToPlanet = tMoonLockGyr <= systemAgeGyr ? "Yes" : "No";
  const planetLockedToMoon = planetLockStatusFromGyr(tPlanetLockToMoonGyr);
  const planetLockedToStar = tPlanetLockToStarGyr <= systemAgeGyr ? "Yes" : "No";

  let rotationPeriodDays;
  if (moonLockedToPlanet === "Yes") {
    rotationPeriodDays = orbitalPeriodSynodicDays;
  } else {
    const tau = tMoonLockGyr / 5;
    const nSync = (2 * PI) / (orbitalPeriodSynodicDays * 24 * 3600);
    const omegaCurrent = nSync + (omegaMoon - nSync) * Math.exp(-systemAgeGyr / tau);
    rotationPeriodDays = omegaCurrent > 0 ? (2 * PI) / omegaCurrent / (24 * 3600) : null;
  }

  return {
    totalEarthTides,
    moonContributionPct,
    starContributionPct,
    tidalHeatingW,
    tidalHeatingWm2,
    tidalHeatingEarth,
    compositionClass: composition.compositionClass,
    k2Moon,
    qMoon: composition.Q,
    rigidityMoonGPa: composition.mu / 1e9,
    tidalFeedbackActive,
    meltFraction,
    qEffective: effectiveQ,
    rigidityEffectiveGPa: effectiveRigidity / 1e9,
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
    rotationPeriodDays,
    dadtTotal,
    surfaceAreaM2,
    moonMassKg,
    moonGravityMs2,
  };
}
