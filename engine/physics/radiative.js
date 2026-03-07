import { auToMeters } from "./orbital.js";

const SOLAR_LUMINOSITY_W = 3.828e26;
const STEFAN_BOLTZ_WM2K4 = 5.6704e-8;
const SOLAR_CONSTANT_WM2 = 1361;

export function calcInsolationEarthRatio({ starLuminosityLsol, orbitalDistanceAu }) {
  if (orbitalDistanceAu <= 0) return 0;
  return starLuminosityLsol / orbitalDistanceAu ** 2;
}

export function insolationEarthRatio(starLuminosityLsol, distanceAu) {
  return calcInsolationEarthRatio({
    starLuminosityLsol,
    orbitalDistanceAu: distanceAu,
  });
}

export function calcStellarFluxWm2({ starLuminosityLsol, orbitalDistanceAu }) {
  if (orbitalDistanceAu <= 0) return 0;
  const orbitalDistanceM = auToMeters(orbitalDistanceAu);
  return (starLuminosityLsol * SOLAR_LUMINOSITY_W) / (4 * Math.PI * orbitalDistanceM ** 2);
}

export function stellarFluxWm2(starLuminosityLsol, distanceAu) {
  return calcStellarFluxWm2({
    starLuminosityLsol,
    orbitalDistanceAu: distanceAu,
  });
}

export function calcAbsorbedFluxWm2({
  insolationEarthRatio,
  albedoBond,
  solarConstantWm2 = SOLAR_CONSTANT_WM2,
}) {
  return (insolationEarthRatio * solarConstantWm2 * (1 - albedoBond)) / 4;
}

export function absorbedFluxWm2(
  insolationEarth,
  albedoBond,
  solarConstantWm2 = SOLAR_CONSTANT_WM2,
) {
  return calcAbsorbedFluxWm2({
    insolationEarthRatio: insolationEarth,
    albedoBond,
    solarConstantWm2,
  });
}

export function calcEquilibriumFourthPowerFromFluxWm2({
  stellarFluxAtDistanceWm2,
  albedoBond,
  redistributionFactor = 4,
}) {
  if (stellarFluxAtDistanceWm2 <= 0 || redistributionFactor <= 0) return 0;
  return (
    (stellarFluxAtDistanceWm2 * (1 - albedoBond)) / (redistributionFactor * STEFAN_BOLTZ_WM2K4)
  );
}

export function equilibriumFourthPowerFromFluxWm2(
  stellarFluxAtDistanceWm2,
  albedoBond,
  redistributionFactor = 4,
) {
  return calcEquilibriumFourthPowerFromFluxWm2({
    stellarFluxAtDistanceWm2,
    albedoBond,
    redistributionFactor,
  });
}

export function calcEquilibriumTemperatureFromFluxK({
  stellarFluxAtDistanceWm2,
  albedoBond,
  redistributionFactor = 4,
}) {
  const fourthPower = calcEquilibriumFourthPowerFromFluxWm2({
    stellarFluxAtDistanceWm2,
    albedoBond,
    redistributionFactor,
  });
  return fourthPower > 0 ? Math.sqrt(Math.sqrt(fourthPower)) : 0;
}

export function equilibriumTemperatureFromFluxK(
  stellarFluxAtDistanceWm2,
  albedoBond,
  redistributionFactor = 4,
) {
  return calcEquilibriumTemperatureFromFluxK({
    stellarFluxAtDistanceWm2,
    albedoBond,
    redistributionFactor,
  });
}

export function calcEquilibriumTemperatureAtDistanceK({
  starLuminosityLsol,
  albedoBond,
  orbitalDistanceAu,
  coefficientK = 279,
  luminosityExponent = 0.25,
}) {
  if (orbitalDistanceAu <= 0) return 0;
  return (
    (coefficientK * starLuminosityLsol ** luminosityExponent * (1 - albedoBond) ** 0.25) /
    Math.sqrt(orbitalDistanceAu)
  );
}

export function equilibriumTemperatureK({
  starLuminosityLsol,
  albedoBond,
  distanceAu,
  coefficientK = 279,
  luminosityExponent = 0.25,
}) {
  return calcEquilibriumTemperatureAtDistanceK({
    starLuminosityLsol,
    albedoBond,
    orbitalDistanceAu: distanceAu,
    coefficientK,
    luminosityExponent,
  });
}
