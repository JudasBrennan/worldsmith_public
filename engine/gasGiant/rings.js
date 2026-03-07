// SPDX-License-Identifier: MPL-2.0
import { round } from "../utils.js";

const SATURN_MASS_MJUP = 0.2994;

export function calcRingProperties(massMjup, teqK, rocheLimitRockKm, rocheLimitIceKm) {
  let ringType;
  let ringComposition;
  if (teqK < 150) {
    ringType = "Icy";
    ringComposition = "Water ice, ammonia ice";
  } else if (teqK < 300) {
    ringType = "Mixed";
    ringComposition = "Ice and silicate dust";
  } else {
    ringType = "Rocky";
    ringComposition = "Silicate dust, rocky debris";
  }

  const baseMassKg = 1e12 * Math.sqrt(massMjup);
  const logM = Math.log10(Math.max(0.01, massMjup));
  const logMPeak = Math.log10(SATURN_MASS_MJUP);
  const sigma = 0.12;
  const enhancement = Math.exp(-((logM - logMPeak) ** 2) / (2 * sigma * sigma));
  const estimatedMassKg = baseMassKg + 3e19 * enhancement;
  const areaKm2 = Math.PI * (rocheLimitIceKm ** 2 - rocheLimitRockKm ** 2);
  const surfaceDensity = areaKm2 > 0 ? estimatedMassKg / (areaKm2 * 1e6) : 0;
  const opticalDepth = surfaceDensity / 67;

  let opticalDepthClass;
  if (opticalDepth > 1) opticalDepthClass = "Dense";
  else if (opticalDepth > 0.1) opticalDepthClass = "Moderate";
  else opticalDepthClass = "Tenuous";

  return {
    ringType,
    ringComposition,
    estimatedMassKg,
    opticalDepthClass,
    opticalDepth: round(opticalDepth, 3),
    innerRadiusKm: round(rocheLimitRockKm, 0),
    outerRadiusKm: round(rocheLimitIceKm, 0),
  };
}
