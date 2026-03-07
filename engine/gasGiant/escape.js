// SPDX-License-Identifier: MPL-2.0
import {
  evaluateJeansEscapeSpecies,
  xuvFluxAtOrbitErgCm2S,
  xuvFluxRatioEarth,
} from "../physics/escape.js";
import { auToKilometers } from "../physics/orbital.js";
import { round } from "../utils.js";

const G = 6.674e-11;
const JUPITER_MASS_KG = 1.8982e27;
const MSOL_PER_MJUP = 1047.35;
const S_PER_GYR = 3.156e16;

const HEATING_EFFICIENCY = 0.15;
const MW_H2 = 0.002;
const MW_HE = 0.004;
const MW_CH4 = 0.016;
const MW_NH3 = 0.017;
const MW_H2O = 0.018;
const MW_CO = 0.028;

const GG_EXOBASE_BASE_K = 200;
const GG_EXOBASE_XUV_COEFF = 3.5;
const GG_EXOBASE_MAX_K = 10000;

const GAS_SPECIES = [
  { key: "h2", label: "H\u2082", mw: MW_H2 },
  { key: "he", label: "He", mw: MW_HE },
  { key: "ch4", label: "CH\u2084", mw: MW_CH4 },
  { key: "nh3", label: "NH\u2083", mw: MW_NH3 },
  { key: "h2o", label: "H\u2082O", mw: MW_H2O },
  { key: "co", label: "CO", mw: MW_CO },
];

export function calcMassLoss(
  massMjup,
  radiusKm,
  orbitAu,
  starMassMsol,
  starLuminosityLsol,
  starAgeGyr,
) {
  const massKg = massMjup * JUPITER_MASS_KG;
  const radiusM = radiusKm * 1000;
  const fXuvAtOrbit = xuvFluxAtOrbitErgCm2S({
    starLuminosityLsol,
    starAgeGyr,
    orbitAu,
  });
  const fXuvSI = fXuvAtOrbit * 1e-3;
  const massLossKgS = (HEATING_EFFICIENCY * Math.PI * radiusM ** 3 * fXuvSI) / (G * massKg);
  const evapTimescaleGyr = massKg / Math.max(massLossKgS, 1e-30) / S_PER_GYR;
  const starMassMjup = starMassMsol * MSOL_PER_MJUP;
  const rocheLobeKm = 0.462 * auToKilometers(orbitAu) * (massMjup / (3 * starMassMjup)) ** (1 / 3);
  const rocheOverflow = radiusKm > rocheLobeKm;
  return {
    massLossRateKgS: massLossKgS,
    evaporationTimescaleGyr: round(Math.min(evapTimescaleGyr, 1e12), 3),
    xuvFluxErgCm2S: round(fXuvAtOrbit, 4),
    xuvFluxRatioEarth: xuvFluxRatioEarth({
      starLuminosityLsol,
      starAgeGyr,
      orbitAu,
    }),
    rocheLobeRadiusKm: round(rocheLobeKm, 0),
    rocheLobeOverflow: rocheOverflow,
  };
}

export function computeGasGiantExobaseTemp(tEffK, fXuvRatio) {
  if (tEffK <= 0) return 0;
  const base = Math.max(tEffK, GG_EXOBASE_BASE_K);
  return Math.min(
    base * (1 + GG_EXOBASE_XUV_COEFF * Math.sqrt(Math.max(0, fXuvRatio))),
    GG_EXOBASE_MAX_K,
  );
}

export function computeGasGiantJeansEscape(escapeVelocityKms, exobaseTempK) {
  return evaluateJeansEscapeSpecies({
    escapeVelocityKms,
    exobaseTempK,
    gasSpecies: GAS_SPECIES,
    lambdaDigits: 1,
  });
}
