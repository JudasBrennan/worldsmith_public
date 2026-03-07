// SPDX-License-Identifier: MPL-2.0
import { round } from "../utils.js";

const G = 6.674e-11;
const ICE_GIANT_MASS_MJUP = 0.15;
const JUPITER_MASS_KG = 1.8982e27;
const JUPITER_RADIUS_KM = 69911;

export function calcDynamics(massMjup, radiusKm, rotationHours, tEffK) {
  const isIceGiant = massMjup < ICE_GIANT_MASS_MJUP;
  const omega = (2 * Math.PI) / (rotationHours * 3600);
  const radiusM = radiusKm * 1000;
  const uWind = 150 * Math.sqrt(Math.max(tEffK, 50) / 125);
  const beta = (2 * omega) / radiusM;
  const lRhines = beta > 0 ? Math.PI * Math.sqrt(uWind / beta) : radiusM;
  const bandCount = Math.max(2, Math.min(30, Math.round((Math.PI * radiusM) / lRhines)));
  const eqWind = isIceGiant ? uWind * 0.8 : uWind;
  return {
    bandCount,
    equatorialWindMs: round(eqWind, 1),
    windDirection: isIceGiant ? "Westward" : "Eastward",
  };
}

export function calcOblateness(massMjup, radiusKm, rotationHours, densityGcm3) {
  const densityKgM3 = densityGcm3 * 1000;
  const radiusM = radiusKm * 1000;
  const massKg = massMjup * JUPITER_MASS_KG;
  const omega = (2 * Math.PI) / (rotationHours * 3600);
  const q = (omega ** 2 * radiusM ** 3) / (G * massKg);
  let f = 1.25 * q;
  if (massMjup > 0.2) {
    const jupQ = (2 * Math.PI) / (9.925 * 3600);
    const qJup = (jupQ ** 2 * (JUPITER_RADIUS_KM * 1000) ** 3) / (G * JUPITER_MASS_KG);
    const fJupTheory = 1.25 * qJup;
    const scale = 0.0649 / fJupTheory;
    const saturnToJupiterScale = 0.9 + 0.1 * Math.min(Math.max((massMjup - 0.3) / 0.7, 0), 1);
    f *= scale * saturnToJupiterScale;
  } else {
    const maclaurinCoeff = densityKgM3 > 0 ? (5 * omega ** 2) / (4 * Math.PI * G * densityKgM3) : 0;
    const iceGiantScale = Math.min(Math.max(0.98 - 0.27 * densityGcm3, 0.5), 0.7);
    f = Math.min(f, maclaurinCoeff) * iceGiantScale;
  }
  const eqRadiusKm = radiusKm * (1 + f / 3);
  const polRadiusKm = radiusKm * (1 - (2 * f) / 3);
  const j2 = (2 * f - q) / 3;
  return {
    flattening: round(f, 5),
    equatorialRadiusKm: round(eqRadiusKm, 0),
    polarRadiusKm: round(polRadiusKm, 0),
    j2: round(j2, 6),
  };
}
