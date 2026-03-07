import { clamp } from "../utils.js";

export const SILICATE_RIGIDITY_PA = 30e9;
export const HIGH_PRESSURE_ICE_RIGIDITY_PA = 3.5e9;
export const PARTIALLY_MOLTEN_RIGIDITY_PA = 10e9;
export const ICY_TIDAL_QUALITY_FACTOR = 7;
export const ROCKY_PLANET_BASE_TIDAL_Q = 12;
export const EARTHLIKE_HOST_TIDAL_QUALITY_FACTOR = 13;
export const GAS_GIANT_HOST_TIDAL_QUALITY_FACTOR = 1e5;
export const ROCKY_MOON_BULK_DENSITY_KGM3 = 2500;
export const ROCKY_MOON_COLD_RIGIDITY_PA = 65e9;
export const ROCKY_MOON_COLD_TIDAL_QUALITY_FACTOR = 100;
export const PARTIALLY_MOLTEN_TIDAL_QUALITY_FACTOR = 10;

export const MOON_MATERIAL_ANCHORS = [
  { rho: 0.5, mu: 3.5e9, Q: 5 },
  { rho: 1.0, mu: 3.5e9, Q: 5 },
  { rho: 1.5, mu: 4e9, Q: 10 },
  { rho: 2.0, mu: 4e9, Q: 10 },
  { rho: 2.5, mu: 20e9, Q: 15 },
  { rho: 3.0, mu: 20e9, Q: 15 },
  { rho: 4.0, mu: 50e9, Q: 30 },
  { rho: 5.0, mu: 50e9, Q: 30 },
  { rho: 5.5, mu: 100e9, Q: 80 },
  { rho: 8.0, mu: 100e9, Q: 80 },
];

export const MOON_MATERIAL_PRESETS = {
  "Very icy": { mu: 3.5e9, Q: 5, compositionClass: "Very icy" },
  Icy: { mu: 4e9, Q: 10, compositionClass: "Icy" },
  "Subsurface ocean": { mu: 0.3e9, Q: 2, compositionClass: "Subsurface ocean" },
  "Mixed rock/ice": { mu: 20e9, Q: 15, compositionClass: "Mixed rock/ice" },
  Rocky: { mu: 50e9, Q: 30, compositionClass: "Rocky" },
  "Partially molten": {
    mu: PARTIALLY_MOLTEN_RIGIDITY_PA,
    Q: PARTIALLY_MOLTEN_TIDAL_QUALITY_FACTOR,
    compositionClass: "Partially molten",
  },
  "Iron-rich": { mu: 100e9, Q: 80, compositionClass: "Iron-rich" },
};

export function interpolateLinear(startValue, endValue, fraction) {
  return startValue + fraction * (endValue - startValue);
}

export function interpolateLog(startValue, endValue, fraction) {
  return Math.exp(Math.log(startValue) + fraction * (Math.log(endValue) - Math.log(startValue)));
}

export function blendMaterialProperty(primaryValue, secondaryValue, secondaryFraction) {
  const fraction = clamp(secondaryFraction, 0, 1);
  return interpolateLinear(primaryValue, secondaryValue, fraction);
}

export function calcRockyPlanetRigidityPa({ coreMassFraction, waterMassFraction = 0 }) {
  const ironBoostPa = 50e9 * Math.max(0, coreMassFraction - 0.33);
  const dryRigidityPa = SILICATE_RIGIDITY_PA + ironBoostPa;
  if (waterMassFraction <= 0) return dryRigidityPa;
  return blendMaterialProperty(dryRigidityPa, HIGH_PRESSURE_ICE_RIGIDITY_PA, waterMassFraction);
}

export function rockyPlanetRigidityPa(coreMassFraction, waterMassFraction = 0) {
  return calcRockyPlanetRigidityPa({
    coreMassFraction,
    waterMassFraction,
  });
}

export function calcRockyPlanetTidalQualityFactor({ coreMassFraction, waterMassFraction = 0 }) {
  const dryQualityFactor = ROCKY_PLANET_BASE_TIDAL_Q + 70 * Math.max(0, coreMassFraction - 0.2);
  if (waterMassFraction <= 0) return dryQualityFactor;
  return blendMaterialProperty(dryQualityFactor, ICY_TIDAL_QUALITY_FACTOR, waterMassFraction);
}

export function rockyPlanetTidalQualityFactor(coreMassFraction, waterMassFraction = 0) {
  return calcRockyPlanetTidalQualityFactor({
    coreMassFraction,
    waterMassFraction,
  });
}

export function classifyMoonCompositionFromDensity({ densityGcm3 }) {
  if (densityGcm3 < 1.0) return "Very icy";
  if (densityGcm3 < 2.0) return "Icy";
  if (densityGcm3 < 3.2) return "Mixed rock/ice";
  if (densityGcm3 <= 5.0) return "Rocky";
  return "Iron-rich";
}

export function moonCompositionClassFromDensity(densityGcm3) {
  return classifyMoonCompositionFromDensity({ densityGcm3 });
}

export function interpolateAnchoredMaterialProfile(value, anchors, valueKey = "rho") {
  let lowerAnchor = anchors[0];
  let upperAnchor = anchors[anchors.length - 1];

  for (let index = 0; index < anchors.length - 1; index++) {
    const left = anchors[index];
    const right = anchors[index + 1];
    if (value >= left[valueKey] && value <= right[valueKey]) {
      lowerAnchor = left;
      upperAnchor = right;
      break;
    }
  }

  const fraction =
    upperAnchor[valueKey] === lowerAnchor[valueKey]
      ? 0
      : (value - lowerAnchor[valueKey]) / (upperAnchor[valueKey] - lowerAnchor[valueKey]);

  return {
    mu: interpolateLog(lowerAnchor.mu, upperAnchor.mu, fraction),
    Q: interpolateLinear(lowerAnchor.Q, upperAnchor.Q, fraction),
  };
}

export function calcMoonMaterialProfileFromDensity({ densityGcm3 }) {
  const clampedDensityGcm3 = clamp(densityGcm3, 0.5, 8.0);
  const profile = interpolateAnchoredMaterialProfile(clampedDensityGcm3, MOON_MATERIAL_ANCHORS);
  return {
    ...profile,
    compositionClass: classifyMoonCompositionFromDensity({ densityGcm3 }),
  };
}

export function moonMaterialProfileFromDensity(densityGcm3) {
  return calcMoonMaterialProfileFromDensity({ densityGcm3 });
}

export function getMoonMaterialProfileByClass({ className }) {
  const profile = MOON_MATERIAL_PRESETS[className];
  return profile ? { ...profile } : null;
}

export function moonMaterialProfileFromClass(className) {
  return getMoonMaterialProfileByClass({ className });
}
