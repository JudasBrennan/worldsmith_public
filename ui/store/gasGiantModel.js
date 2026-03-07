// SPDX-License-Identifier: MPL-2.0
import { clamp } from "../../engine/utils.js";

// Practical giant-planet radius bounds in Jupiter radii (Rj):
// lower bound ~= Neptune-size (~0.35 Rj), upper bound ~= inflated HAT-P-67 b (2.14 Rj).
export const GAS_GIANT_RADIUS_MIN_RJ = 0.35;
export const GAS_GIANT_RADIUS_MAX_RJ = 2.14;
export const GAS_GIANT_RADIUS_STEP_RJ = 0.01;
// Gas giant mass bounds in Jupiter masses (Mj):
// lower bound ~3 Earth masses, upper bound = deuterium burning limit.
export const GAS_GIANT_MASS_MIN_MJUP = 0.01;
export const GAS_GIANT_MASS_MAX_MJUP = 13.0;
export const GAS_GIANT_MASS_STEP_MJUP = 0.01;
// Gas giant atmospheric metallicity bounds (x solar):
// 0.1x = very metal-poor, 200x = extreme ice-giant enrichment.
export const GAS_GIANT_METALLICITY_MIN = 0.1;
export const GAS_GIANT_METALLICITY_MAX = 200;
export const GAS_GIANT_METALLICITY_STEP = 0.1;

const GAS_GIANT_STYLE_ALIASES = { ice: "neptune", hot: "hot-jupiter" };

function roundToStep(v, step = 1) {
  const s = Number(step);
  if (!Number.isFinite(v) || !Number.isFinite(s) || s <= 0) return v;
  const inv = 1 / s;
  return Math.round(v * inv) / inv;
}

function seededUnit(seed) {
  const src = String(seed || "gas-giant-radius");
  let h = 2166136261;
  for (let i = 0; i < src.length; i++) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export function clampGasGiantRadiusRj(value) {
  return roundToStep(
    clamp(Number(value), GAS_GIANT_RADIUS_MIN_RJ, GAS_GIANT_RADIUS_MAX_RJ),
    GAS_GIANT_RADIUS_STEP_RJ,
  );
}

export function seededGasGiantRadiusRj(seed) {
  const unit = seededUnit(seed);
  const span = GAS_GIANT_RADIUS_MAX_RJ - GAS_GIANT_RADIUS_MIN_RJ;
  return clampGasGiantRadiusRj(GAS_GIANT_RADIUS_MIN_RJ + unit * span);
}

export function randomGasGiantRadiusRj() {
  const span = GAS_GIANT_RADIUS_MAX_RJ - GAS_GIANT_RADIUS_MIN_RJ;
  return clampGasGiantRadiusRj(GAS_GIANT_RADIUS_MIN_RJ + Math.random() * span);
}

export function normalizeGasGiantStyle(style) {
  const normalized = String(style || "jupiter").toLowerCase();
  return GAS_GIANT_STYLE_ALIASES[normalized] || normalized;
}

export function normalizeGasGiant(raw, idx = 1) {
  const au = Number(raw?.au ?? raw?.semiMajorAxisAu);
  const fixedAu = Number.isFinite(au) && au > 0 ? au : 0;
  const rawRadius =
    raw?.radiusRj ?? raw?.radiusJupiter ?? raw?.sizeRj ?? raw?.radiusRadiiJupiter ?? null;
  const parsedRadius = Number(rawRadius);
  const radiusRj = Number.isFinite(parsedRadius)
    ? clampGasGiantRadiusRj(parsedRadius)
    : seededGasGiantRadiusRj(raw?.id || raw?.name || `gg${idx}`);
  const rawMass = raw?.massMjup ?? raw?.massJupiter ?? raw?.massMj ?? null;
  const parsedMass = Number(rawMass);
  const massMjup =
    rawMass != null && Number.isFinite(parsedMass) && parsedMass > 0 ? parsedMass : null;
  const rawRot = raw?.rotationPeriodHours ?? raw?.rotationHours ?? raw?.rotPeriodH ?? null;
  const parsedRot = Number(rawRot);
  const rotationPeriodHours =
    rawRot != null && Number.isFinite(parsedRot) && parsedRot > 0 ? parsedRot : null;
  const rawSlot = Number(raw?.slotIndex);
  const slotIndex =
    Number.isFinite(rawSlot) && rawSlot >= 1 && rawSlot <= 20 ? Math.round(rawSlot) : null;
  const rawMet = raw?.metallicity ?? raw?.metallicitySolar ?? null;
  const parsedMet = Number(rawMet);
  const metallicity =
    rawMet != null && Number.isFinite(parsedMet) && parsedMet > 0 ? parsedMet : null;
  const appearanceRecipeId = String(raw?.appearanceRecipeId || raw?.recipeId || "").trim();
  const rawEcc = Number(raw?.eccentricity ?? raw?.ecc);
  const eccentricity = Number.isFinite(rawEcc) && rawEcc >= 0 && rawEcc <= 0.99 ? rawEcc : null;
  const rawInc = Number(raw?.inclinationDeg ?? raw?.inclination);
  const inclinationDeg = Number.isFinite(rawInc) && rawInc >= 0 && rawInc <= 180 ? rawInc : null;
  const rawTilt = Number(raw?.axialTiltDeg ?? raw?.axialTilt ?? raw?.obliquity);
  const axialTiltDeg = Number.isFinite(rawTilt) && rawTilt >= 0 && rawTilt <= 180 ? rawTilt : null;
  return {
    id: String(raw?.id || `gg${idx}`),
    name: String(raw?.name || `Gas giant ${idx}`),
    au: fixedAu,
    slotIndex,
    style: normalizeGasGiantStyle(raw?.style),
    rings: raw?.rings === true,
    radiusRj,
    massMjup,
    rotationPeriodHours,
    metallicity,
    eccentricity,
    inclinationDeg,
    axialTiltDeg,
    appearanceRecipeId: appearanceRecipeId || "",
  };
}
