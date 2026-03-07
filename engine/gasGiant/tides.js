// SPDX-License-Identifier: MPL-2.0
import { round } from "../utils.js";
import { calcEccentricityFactor } from "../physics/rotation.js";

const JUPITER_RADIUS_KM = 69911;

export function calcTidalEffects(
  massMjup,
  radiusKm,
  orbitAu,
  eccentricity,
  starMassMsol,
  starAgeGyr,
) {
  const age = Math.max(0.1, starAgeGyr);
  const aRatio = orbitAu / 0.05;
  const rRatio = radiusKm / JUPITER_RADIUS_KM;
  const lockingGyr = (aRatio ** 6 * massMjup) / (rRatio ** 5 * starMassMsol ** 2);
  const eFactor = eccentricity > 0.001 ? calcEccentricityFactor({ eccentricity }) : 1;
  const circularisationGyr =
    (aRatio ** 6.5 * massMjup) / (rRatio ** 5 * starMassMsol ** 2) / Math.max(1, eFactor);
  return {
    lockingTimescaleGyr: round(lockingGyr, 3),
    isTidallyLocked: lockingGyr < age,
    circularisationTimescaleGyr: round(circularisationGyr, 3),
    isCircularised: circularisationGyr < age,
  };
}
