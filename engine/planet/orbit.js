// SPDX-License-Identifier: MPL-2.0
import {
  auToMeters,
  calcOrbitalPeriodYearsKepler,
  calcTwoBodyOrbitalPeriodSeconds,
  earthMassToKg,
  moonMassToKg,
  orbitalDirectionFromInclination as sharedOrbitalDirectionFromInclination,
} from "../physics/orbital.js";
import { calcEccentricityFactor, calcTidalLockTimeGyr } from "../physics/rotation.js";

const G = 6.67e-11;
const C_ATM_TIDE = 12;

function planetTidalHeatingFromMoon(
  k2Planet,
  qualityFactor,
  radiusM,
  moonMassKg,
  semiMajorAxisM,
  orbitalPeriodS,
  ecc,
) {
  if (semiMajorAxisM <= 0 || orbitalPeriodS <= 0 || ecc <= 0) return 0;
  const meanMotion = (2 * Math.PI) / orbitalPeriodS;
  return (
    (21 / 2) *
    (k2Planet / qualityFactor) *
    ((G * moonMassKg ** 2 * radiusM ** 5 * meanMotion) / semiMajorAxisM ** 6) *
    calcEccentricityFactor({ eccentricity: ecc })
  );
}

export function atmosphereTideRatio(pressureAtm, insolationEarth, gravityMs2, tEqK) {
  if (pressureAtm <= 0 || tEqK <= 0 || gravityMs2 <= 0) return 0;
  return (C_ATM_TIDE * pressureAtm * insolationEarth) / (gravityMs2 * tEqK);
}

export function totalPlanetTidalHeating(moons, k2Planet, qualityFactor, mPlanetKg, radiusM) {
  if (!moons || moons.length === 0) return 0;
  let total = 0;
  for (const moon of moons) {
    const moonMassKg = moonMassToKg(Number(moon.massMoon) || 0);
    const semiMajorAxisM = (Number(moon.semiMajorAxisKm) || 0) * 1000;
    const ecc = Number(moon.eccentricity) || 0;
    if (moonMassKg <= 0 || semiMajorAxisM <= 0) continue;
    const orbitalPeriodS = calcTwoBodyOrbitalPeriodSeconds({
      semiMajorAxisM,
      primaryMassKg: mPlanetKg,
    });
    total += planetTidalHeatingFromMoon(
      k2Planet,
      qualityFactor,
      radiusM,
      moonMassKg,
      semiMajorAxisM,
      orbitalPeriodS,
      ecc,
    );
  }
  return total;
}

export function tidalLockTimeGyr(omega, orbitM, momentI, qualityFactor, mOtherKg, k2, radiusM) {
  return calcTidalLockTimeGyr({
    spinRateRadPerSec: omega,
    orbitalSeparationM: orbitM,
    momentOfInertiaKgM2: momentI,
    qualityFactor,
    otherMassKg: mOtherKg,
    loveNumberK2: k2,
    radiusM,
  });
}

export function planetMassEarthToKg(massEarth) {
  return earthMassToKg(massEarth);
}

export function semiMajorAxisAuToMeters(semiMajorAxisAu) {
  return auToMeters(semiMajorAxisAu);
}

export function orbitalPeriodEarthYears(semiMajorAxisAu, starMassMsol) {
  return calcOrbitalPeriodYearsKepler({
    semiMajorAxisAu,
    centralMassMsol: starMassMsol,
  });
}

export function orbitalDirectionFromInclination(inclinationDeg) {
  return sharedOrbitalDirectionFromInclination(inclinationDeg);
}
