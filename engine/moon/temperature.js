// SPDX-License-Identifier: MPL-2.0
import {
  calcEquilibriumFourthPowerFromFluxWm2,
  calcEquilibriumTemperatureFromFluxK,
  calcStellarFluxWm2,
} from "../physics/radiative.js";
import { earthMassToKg } from "../physics/orbital.js";

const STEFAN_BOLTZ = 5.6704e-8;
const EARTH_INTERNAL_HEAT_W = 44e12;
const KG_PER_MEARTH = earthMassToKg(1);

export function computeMoonTemperature({
  albedo,
  planetSemiMajorAxisAu,
  starLuminosityLsol,
  surfaceAreaM2,
  moonMassKg,
  radioisotopeAbundance,
  tidalHeatingWm2,
}) {
  const stellarFluxAtDistanceWm2 = calcStellarFluxWm2({
    starLuminosityLsol,
    orbitalDistanceAu: planetSemiMajorAxisAu,
  });
  const equilibriumFourthPower = calcEquilibriumFourthPowerFromFluxWm2({
    stellarFluxAtDistanceWm2,
    albedoBond: albedo,
    redistributionFactor: 4,
  });
  const equilibriumK = calcEquilibriumTemperatureFromFluxK({
    stellarFluxAtDistanceWm2,
    albedoBond: albedo,
    redistributionFactor: 4,
  });

  const radiogenicWm2 =
    surfaceAreaM2 > 0
      ? (EARTH_INTERNAL_HEAT_W * (moonMassKg / KG_PER_MEARTH) * radioisotopeAbundance) /
        surfaceAreaM2
      : 0;

  const surfaceFourthPower =
    equilibriumFourthPower + tidalHeatingWm2 / STEFAN_BOLTZ + radiogenicWm2 / STEFAN_BOLTZ;
  const surfaceK =
    surfaceFourthPower > 0 ? Math.round(Math.sqrt(Math.sqrt(surfaceFourthPower))) : 0;

  return {
    equilibriumK,
    surfaceK,
    surfaceC: surfaceK - 273,
    radiogenicWm2,
  };
}
