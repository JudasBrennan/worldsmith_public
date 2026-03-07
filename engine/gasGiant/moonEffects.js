// SPDX-License-Identifier: MPL-2.0
import {
  PARTIALLY_MOLTEN_RIGIDITY_PA,
  PARTIALLY_MOLTEN_TIDAL_QUALITY_FACTOR,
  ROCKY_MOON_BULK_DENSITY_KGM3,
  ROCKY_MOON_COLD_RIGIDITY_PA,
  ROCKY_MOON_COLD_TIDAL_QUALITY_FACTOR,
} from "../physics/materials.js";
import { calcTwoBodyOrbitalPeriodSeconds, moonMassToKg } from "../physics/orbital.js";
import { evaluateVolatileRetention } from "../physics/escape.js";
import { calcEccentricityFactor } from "../physics/rotation.js";
import { clamp, jeansParameter, MOON_VOLATILE_TABLE, vaporPressurePa } from "../utils.js";

const G = 6.674e-11;
const ICE_GIANT_MASS_MJUP = 0.15;
const MELT_FLUX_THRESHOLD = 0.02;

const K_SPUT = 6.5e-6;
const P_SPUT_SAT = 10;

function moonSelfTidalHeating(moonMassKg, semiMajorAxisM, eccentricity, planetMassKg) {
  if (eccentricity <= 0 || semiMajorAxisM <= 0 || moonMassKg <= 0) return 0;

  const rMoonM = Math.cbrt((3 * moonMassKg) / (4 * Math.PI * ROCKY_MOON_BULK_DENSITY_KGM3));
  const gMoon = (G * moonMassKg) / (rMoonM * rMoonM);
  const k2Cold =
    1.5 /
    (1 + (19 * ROCKY_MOON_COLD_RIGIDITY_PA) / (2 * ROCKY_MOON_BULK_DENSITY_KGM3 * gMoon * rMoonM));
  const meanMotion = Math.sqrt((G * planetMassKg) / semiMajorAxisM ** 3);
  const fe = calcEccentricityFactor({ eccentricity });

  const coldHeating =
    (21 / 2) *
    (k2Cold / ROCKY_MOON_COLD_TIDAL_QUALITY_FACTOR) *
    ((G * planetMassKg ** 2 * rMoonM ** 5 * meanMotion) / semiMajorAxisM ** 6) *
    fe;

  const surfaceArea = 4 * Math.PI * rMoonM ** 2;
  const coldFlux = coldHeating / surfaceArea;

  if (coldFlux > 0.001) {
    const meltFraction = 1 / (1 + (coldFlux / MELT_FLUX_THRESHOLD) ** -3);
    if (meltFraction > 0.01) {
      const effMu = Math.exp(
        Math.log(ROCKY_MOON_COLD_RIGIDITY_PA) * (1 - meltFraction) +
          Math.log(PARTIALLY_MOLTEN_RIGIDITY_PA) * meltFraction,
      );
      const effQ =
        ROCKY_MOON_COLD_TIDAL_QUALITY_FACTOR * (1 - meltFraction) +
        PARTIALLY_MOLTEN_TIDAL_QUALITY_FACTOR * meltFraction;
      const k2Eff = 1.5 / (1 + (19 * effMu) / (2 * ROCKY_MOON_BULK_DENSITY_KGM3 * gMoon * rMoonM));
      return (
        (21 / 2) *
        (k2Eff / effQ) *
        ((G * planetMassKg ** 2 * rMoonM ** 5 * meanMotion) / semiMajorAxisM ** 6) *
        fe
      );
    }
  }

  return coldHeating;
}

export function totalMoonSelfHeating(moons, planetMassKg) {
  if (!moons || moons.length === 0) return 0;
  let total = 0;
  for (const moon of moons) {
    const moonMassKg = moonMassToKg(Number(moon.massMoon) || 0);
    const semiMajorAxisM = (Number(moon.semiMajorAxisKm) || 0) * 1000;
    const eccentricity = Number(moon.eccentricity) || 0;
    if (moonMassKg <= 0 || semiMajorAxisM <= 0) continue;
    total += moonSelfTidalHeating(moonMassKg, semiMajorAxisM, eccentricity, planetMassKg);
  }
  return total;
}

function moonSputteringPlasmaW(input, starLuminosityLsol, orbitAu, ageGyr) {
  const moonMassKg = moonMassToKg(Number(input.massMoon) || 0);
  if (moonMassKg <= 0) return 0;

  const rhoKgM3 = (Number(input.densityGcm3) || ROCKY_MOON_BULK_DENSITY_KGM3 / 1000) * 1000;
  const rhoGcm3 = rhoKgM3 / 1000;
  const albedo = clamp(Number(input.albedo) || 0.3, 0, 0.95);

  const rMoonM = Math.cbrt((3 * moonMassKg) / (4 * Math.PI * rhoKgM3));
  const gMoon = (G * moonMassKg) / (rMoonM * rMoonM);
  const vEscMs = Math.sqrt((2 * G * moonMassKg) / rMoonM);
  const tSurfK =
    orbitAu > 0
      ? (279 * Math.pow(1 - albedo, 0.25) * Math.sqrt(starLuminosityLsol)) / Math.sqrt(orbitAu)
      : 0;
  if (tSurfK <= 0 || gMoon <= 0) return 0;

  let bestPressure = 0;

  for (const volatile of MOON_VOLATILE_TABLE) {
    if (volatile.species === "SO\u2082") continue;
    if (rhoGcm3 >= volatile.maxRho) continue;
    if (tSurfK < volatile.subK) continue;
    if (tSurfK >= volatile.tTp) continue;
    const lambda = jeansParameter(volatile.massAmu, vEscMs, tSurfK);
    const pressurePa = vaporPressurePa(volatile, tSurfK);
    if (
      !evaluateVolatileRetention({
        pressurePa,
        gravityMs2: gMoon,
        massAmu: volatile.massAmu,
        tempK: tSurfK,
        lambda,
        ageGyr,
      }).retained
    ) {
      continue;
    }
    if (pressurePa > bestPressure) bestPressure = pressurePa;
  }

  if (bestPressure <= 0) return 0;
  const pEff = Math.min(bestPressure, P_SPUT_SAT);
  return (pEff * Math.PI * rMoonM * rMoonM * K_SPUT) / gMoon;
}

export function totalMoonSputteringPlasmaW(moons, starLuminosityLsol, orbitAu, ageGyr) {
  if (!moons || moons.length === 0) return 0;
  let total = 0;
  for (const moon of moons)
    total += moonSputteringPlasmaW(moon, starLuminosityLsol, orbitAu, ageGyr);
  return total;
}

export function gasGiantK2(massMjup) {
  const k2Floor = 0.09;
  const k2Ceil = 0.385;
  const logMid = -1.14;
  const steepness = 15;
  const logM = Math.log10(clamp(massMjup, 0.001, 100));
  return k2Floor + (k2Ceil - k2Floor) / (1 + Math.exp(-steepness * (logM - logMid)));
}

export function gasGiantTidalQ(massMjup) {
  if (massMjup >= 0.8) return 3.5e4;
  if (massMjup >= 0.5) {
    const t = (massMjup - 0.5) / 0.3;
    return 10 ** (Math.log10(2500) + t * (Math.log10(35000) - Math.log10(2500)));
  }
  if (massMjup >= 0.2) return 2500;
  if (massMjup >= ICE_GIANT_MASS_MJUP) {
    const t = (massMjup - ICE_GIANT_MASS_MJUP) / (0.2 - ICE_GIANT_MASS_MJUP);
    return 10 ** (Math.log10(15000) + t * (Math.log10(2500) - Math.log10(15000)));
  }
  return 1.5e4;
}

function ggTidalHeatingFromMoon(
  k2,
  q,
  radiusM,
  moonMassKg,
  semiMajorAxisM,
  orbitalPeriodS,
  eccentricity,
) {
  if (semiMajorAxisM <= 0 || orbitalPeriodS <= 0 || eccentricity <= 0) return 0;
  const meanMotion = (2 * Math.PI) / orbitalPeriodS;
  return (
    (21 / 2) *
    (k2 / q) *
    ((G * moonMassKg ** 2 * radiusM ** 5 * meanMotion) / semiMajorAxisM ** 6) *
    calcEccentricityFactor({ eccentricity })
  );
}

export function totalGasGiantTidalHeating(moons, k2, q, massKg, radiusM) {
  if (!moons || moons.length === 0) return 0;
  let total = 0;
  for (const moon of moons) {
    const moonMassKg = moonMassToKg(Number(moon.massMoon) || 0);
    const semiMajorAxisM = (Number(moon.semiMajorAxisKm) || 0) * 1000;
    const eccentricity = Number(moon.eccentricity) || 0;
    if (moonMassKg <= 0 || semiMajorAxisM <= 0) continue;
    const orbitalPeriodS = calcTwoBodyOrbitalPeriodSeconds({
      semiMajorAxisM,
      primaryMassKg: massKg,
    });
    total += ggTidalHeatingFromMoon(
      k2,
      q,
      radiusM,
      moonMassKg,
      semiMajorAxisM,
      orbitalPeriodS,
      eccentricity,
    );
  }
  return total;
}
