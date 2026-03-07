// SPDX-License-Identifier: MPL-2.0
import { clamp } from "../utils.js";
import {
  auToKilometers,
  calcOrbitalPeriodDaysKepler,
  calcTwoBodyOrbitalPeriodSeconds,
  earthMassToKg,
  moonMassToKg,
  orbitalDirectionFromInclination,
  solarMassToKg,
} from "../physics/orbital.js";

const KM_PER_REARTH = 6371;
const SEC_PER_DAY = 86400;

export function computeMoonOrbit({
  starMassMsol,
  planetMassEarth,
  planetDensityGcm3,
  planetRadiusEarth,
  planetSemiMajorAxisAu,
  planetEccentricity,
  moonMassMoon,
  moonDensityGcm3,
  moonSemiMajorAxisKmInput,
  moonEccentricity,
  moonInclinationDeg,
}) {
  const periPlanetAu = planetSemiMajorAxisAu * (1 - planetEccentricity);
  const periodPlanetDays = calcOrbitalPeriodDaysKepler({
    semiMajorAxisAu: planetSemiMajorAxisAu,
    centralMassMsol: starMassMsol,
    daysPerYear: 365.256,
  });

  const zoneInnerKm =
    2.44 * planetRadiusEarth * KM_PER_REARTH * (planetDensityGcm3 / moonDensityGcm3) ** (1 / 3);
  const zoneOuterKm =
    auToKilometers(planetSemiMajorAxisAu) *
    (earthMassToKg(planetMassEarth) / (3 * solarMassToKg(starMassMsol))) ** (1 / 3);

  const periFactor = Math.max(1e-6, 1 - moonEccentricity);
  const apoFactor = 1 + moonEccentricity;
  const minAMoonKm = zoneInnerKm / periFactor;
  const maxAMoonKm = zoneOuterKm / apoFactor;

  let semiMajorAxisKm = moonSemiMajorAxisKmInput;
  let semiMajorAxisGuard = "none";
  if (Number.isFinite(minAMoonKm) && Number.isFinite(maxAMoonKm) && maxAMoonKm >= minAMoonKm) {
    if (moonSemiMajorAxisKmInput < minAMoonKm) {
      semiMajorAxisKm = minAMoonKm;
      semiMajorAxisGuard = "raised_to_avoid_collision";
    } else if (moonSemiMajorAxisKmInput > maxAMoonKm) {
      semiMajorAxisKm = maxAMoonKm;
      semiMajorAxisGuard = "lowered_to_remain_bound";
    }
  } else {
    const zMin = Math.min(zoneInnerKm, zoneOuterKm);
    const zMax = Math.max(zoneInnerKm, zoneOuterKm);
    const clampedFallback = clamp(moonSemiMajorAxisKmInput, zMin, zMax);
    if (clampedFallback !== moonSemiMajorAxisKmInput) semiMajorAxisGuard = "clamped_to_moon_zone";
    semiMajorAxisKm = clampedFallback;
  }

  const periapsisKm = semiMajorAxisKm * (1 - moonEccentricity);
  const apoapsisKm = semiMajorAxisKm * (1 + moonEccentricity);
  const orbitalDirection = orbitalDirectionFromInclination(moonInclinationDeg);

  const orbitalPeriodSiderealDays =
    calcTwoBodyOrbitalPeriodSeconds({
      semiMajorAxisM: semiMajorAxisKm * 1000,
      primaryMassKg: earthMassToKg(planetMassEarth),
      secondaryMassKg: moonMassToKg(moonMassMoon),
    }) / SEC_PER_DAY;
  const synodicDenom = Math.abs(1 / orbitalPeriodSiderealDays - 1 / periodPlanetDays);
  const orbitalPeriodSynodicDays = synodicDenom > 0 ? 1 / synodicDenom : Infinity;

  return {
    periPlanetAu,
    periodPlanetDays,
    zoneInnerKm,
    zoneOuterKm,
    minAMoonKm,
    maxAMoonKm,
    semiMajorAxisKm,
    semiMajorAxisGuard,
    periapsisKm,
    apoapsisKm,
    orbitalDirection,
    orbitalPeriodSiderealDays,
    orbitalPeriodSynodicDays,
  };
}
