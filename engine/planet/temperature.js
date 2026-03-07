import {
  calcAbsorbedFluxWm2,
  calcEquilibriumTemperatureAtDistanceK,
} from "../physics/radiative.js";
import { auToMeters } from "../physics/orbital.js";

const STEFAN_BOLTZ_ERG = 0.000056703; // erg*cm^-2*s^-1*K^-4
const L_SOL_ERG_S = 3.846e33;
const AU_CM = auToMeters(1) * 100;
const GREENHOUSE_EQ_COEFF = 278;

export function equilibriumTemperatureK(starLuminosityLsol, albedoBond, distanceAu) {
  return calcEquilibriumTemperatureAtDistanceK({
    starLuminosityLsol,
    albedoBond,
    orbitalDistanceAu: distanceAu,
    coefficientK: GREENHOUSE_EQ_COEFF,
  });
}

export function computePlanetSurfaceTemperature({
  starLuminosityLsol,
  albedoBond,
  semiMajorAxisAu,
  greenhouseEffect,
  greenhouseScale,
  surfaceDivisorMin,
}) {
  const luminosityErgS = L_SOL_ERG_S * starLuminosityLsol;
  const distanceCm = AU_CM * semiMajorAxisAu;
  const tGreenhouse = greenhouseEffect * greenhouseScale;
  const x = Math.sqrt(((1 - albedoBond) * luminosityErgS) / (16 * Math.PI * STEFAN_BOLTZ_ERG));
  const tEff = Math.sqrt(x) * (1 / Math.sqrt(distanceCm));
  const tEq4 = tEff ** 4 * (1 + (3 * tGreenhouse) / 4);
  const surfDiv = 1 - (1 - surfaceDivisorMin) * Math.min(tGreenhouse, 1);
  const tSur4 = tEq4 / surfDiv;
  const surfaceTempK = Math.round(Math.sqrt(Math.sqrt(tSur4)));
  return {
    surfaceTempK,
    surfaceTempC: surfaceTempK - 273,
    greenhouseTauEquivalent: tGreenhouse,
    surfaceDivisor: surfDiv,
  };
}

export function computePeriapsisApoapsisTemperatures({
  starLuminosityLsol,
  albedoBond,
  periapsisAu,
  apoapsisAu,
  fallbackK,
}) {
  return {
    periapsisK:
      periapsisAu > 0
        ? equilibriumTemperatureK(starLuminosityLsol, albedoBond, periapsisAu)
        : fallbackK,
    apoapsisK:
      apoapsisAu > 0
        ? equilibriumTemperatureK(starLuminosityLsol, albedoBond, apoapsisAu)
        : fallbackK,
  };
}

export function computeAbsorbedFluxWm2(insolationEarth, albedoBond) {
  return calcAbsorbedFluxWm2({
    insolationEarthRatio: insolationEarth,
    albedoBond,
  });
}
