// SPDX-License-Identifier: MPL-2.0
import { clamp, fmt, round, toFinite } from "../utils.js";

const JUPITER_RADIUS_KM = 69911;
const EARTH_RADIUS_KM = 6371;
const EARTH_MASS_PER_MJUP = 317.83;
const RJ_PER_RE = JUPITER_RADIUS_KM / EARTH_RADIUS_KM;
const ICE_GIANT_MASS_MJUP = 0.15;

const C_N = 0.861;
const EXP_N = 0.53;
const BOUNDARY_ME = 131.6;
const EXP_J = -0.044;
const C_J_RAW = C_N * BOUNDARY_ME ** EXP_N * BOUNDARY_ME ** -EXP_J;

const SOLAR_CH4_PCT = 0.075;
const SOLAR_NH3_PCT = 0.008;
const SOLAR_H2O_PCT = 0.025;
const SOLAR_CO_PCT = 0.05;

function massToRadiusEarth(massEarth) {
  const mass = Math.max(1, massEarth);
  if (mass < BOUNDARY_ME) return C_N * mass ** EXP_N;
  return C_J_RAW * mass ** EXP_J;
}

function radiusToMassEarth(radiusEarth) {
  const radius = Math.max(0.5, radiusEarth);
  const mNept = (radius / C_N) ** (1 / EXP_N);
  if (mNept < BOUNDARY_ME) return mNept;
  return EARTH_MASS_PER_MJUP;
}

export function massToRadiusRj(massMjup) {
  const massEarth = toFinite(massMjup, 1) * EARTH_MASS_PER_MJUP;
  const radiusEarth = massToRadiusEarth(massEarth);
  return radiusEarth / RJ_PER_RE;
}

export function radiusToMassMjup(radiusRj) {
  const radiusEarth = toFinite(radiusRj, 1) * RJ_PER_RE;
  const massEarth = radiusToMassEarth(radiusEarth);
  return massEarth / EARTH_MASS_PER_MJUP;
}

export function estimateMetallicity(massMjup) {
  const mass = clamp(toFinite(massMjup, 1), 0.01, 13);
  const logZ = 0.66 - 0.68 * Math.log10(mass);
  return clamp(round(10 ** logZ, 1), 1, 200);
}

export function stellarMetallicityScaleFromFeH(feH) {
  const dex = clamp(toFinite(feH, 0), -3, 1);
  return 10 ** dex;
}

export function getAtmosphere(massMjup, teqK, metallicity) {
  const z = clamp(metallicity, 0.1, 200);
  const isIceGiant = massMjup < ICE_GIANT_MASS_MJUP;
  const isHot = teqK > 1000;

  const baseH2 = isIceGiant ? 80 : isHot ? 85 : 86;
  const baseHe = isIceGiant ? 18 : 14;

  const ch4 = isHot ? 0 : Math.min(SOLAR_CH4_PCT * z, 8);
  const nh3 = Math.min(SOLAR_NH3_PCT * z, 2);
  const h2o = isHot ? Math.min(SOLAR_H2O_PCT * z * 0.3, 1) : Math.min(SOLAR_H2O_PCT * z, 3);
  const co = isHot ? Math.min(SOLAR_CO_PCT * z, 5) : 0;

  const totalMetals = ch4 + nh3 + h2o + co;
  const scaleFactor = (100 - totalMetals) / (baseH2 + baseHe);
  const h2 = baseH2 * scaleFactor;
  const he = baseHe * scaleFactor;

  const traces = [
    { name: "CH\u2084", pct: ch4 },
    { name: "CO", pct: co },
    { name: "H\u2082O", pct: h2o },
    { name: "NH\u2083", pct: nh3 },
  ];
  const best = traces.reduce((left, right) => (left.pct >= right.pct ? left : right));
  const dominantTrace = best.pct > 0 ? best.name : "CH\u2084";

  return {
    h2Pct: round(h2, 1),
    hePct: round(he, 1),
    ch4Pct: round(ch4, 2),
    nh3Pct: round(nh3, 3),
    h2oPct: round(h2o, 3),
    coPct: round(co, 2),
    dominantTrace,
    metallicitySolar: round(z, 1),
  };
}

export function calcInterior(massMjup) {
  const totalHeavy = 49.3 * massMjup ** 0.61;
  const coreMass = Math.min(totalHeavy * 0.5, 25);
  const totalMassEarth = massMjup * EARTH_MASS_PER_MJUP;
  const bulkZ = clamp(totalHeavy / totalMassEarth, 0, 1);
  return {
    totalHeavyElementsMearth: round(totalHeavy, 1),
    estimatedCoreMassMearth: round(coreMass, 1),
    bulkMetallicityFraction: round(bulkZ, 4),
  };
}

export function calcAgeRadiusCorrection(massMjup, radiusRj, starAgeGyr, teqK) {
  const age = Math.max(0.1, starAgeGyr);
  const inflationFactor = 1 + 0.1 * (5 / age) ** 0.35;
  let proximityBonus = 0;
  if (teqK > 1000) {
    proximityBonus = 0.1 + 0.2 * clamp((teqK - 1000) / 1000, 0, 1);
  }
  const baseRj = massToRadiusRj(massMjup);
  const suggestedRj = round(baseRj * inflationFactor + proximityBonus, 3);
  const deviation = radiusRj - suggestedRj;
  let note;
  if (Math.abs(deviation) < 0.05) {
    note = `Radius consistent with ${fmt(age, 1)} Gyr cooling`;
  } else if (deviation > 0) {
    note = `Radius ${fmt(deviation, 2)} Rj larger than expected at ${fmt(age, 1)} Gyr`;
  } else {
    note = `Radius ${fmt(Math.abs(deviation), 2)} Rj smaller than expected at ${fmt(age, 1)} Gyr`;
  }
  return {
    suggestedRadiusRj: suggestedRj,
    radiusInflationFactor: round(inflationFactor, 3),
    proximityInflationRj: round(proximityBonus, 3),
    radiusAgeNote: note,
  };
}
