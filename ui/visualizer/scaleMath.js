// SPDX-License-Identifier: MPL-2.0
import { clamp } from "../../engine/utils.js";
import { GAS_GIANT_RADIUS_MAX_RJ, GAS_GIANT_RADIUS_MIN_RJ } from "../store.js";
import { gasStylePalette } from "../gasGiantStyles.js";

export const SOL_RADIUS_KM = 696340;
export const JUPITER_RADIUS_KM = 71492;
export const EARTH_RADIUS_KM = 6371;
export const MOON_RADIUS_KM = 1737.4;
export const EARTH_PER_MSOL = 332946;
export const MJUP_PER_MSOL = 1047.35;
export const PHYS_VIS_THRESHOLD_PX = 1.5;
export const MOON_LABEL_MIN_ZOOM = 2.0;
export const MOON_LABEL_FADE = 0.8;

const DEBRIS_PARTICLE_DENSITY = 0.007;
const DEBRIS_PARTICLE_MIN = 180;
const DEBRIS_PARTICLE_MAX = 900;

export function hashUnit(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export function dbg(enabled, ...args) {
  if (!enabled) return;
  console.log("[viz]", ...args);
}

export function gasGiantRadiusToPx(radiusRj, style) {
  const radius = clamp(
    Number.isFinite(radiusRj) ? radiusRj : 1,
    GAS_GIANT_RADIUS_MIN_RJ,
    GAS_GIANT_RADIUS_MAX_RJ,
  );
  const span = Math.max(0.001, GAS_GIANT_RADIUS_MAX_RJ - GAS_GIANT_RADIUS_MIN_RJ);
  const t = (radius - GAS_GIANT_RADIUS_MIN_RJ) / span;
  const baseSize = 8 + t * 12;
  const palSize = gasStylePalette(style).size;
  return baseSize * (palSize / 14);
}

export function planetRadiusToPx(radiusEarth) {
  const radius = Number.isFinite(radiusEarth) && radiusEarth > 0 ? radiusEarth : 1;
  return clamp(radius * 5.5, 3.2, 16);
}

export function representativePlanetBaseRadiusPx(node, bodyZoom = 1) {
  const radiusEarth =
    Number.isFinite(node?.radiusEarth) && node.radiusEarth > 0
      ? node.radiusEarth
      : Number.isFinite(node?.radiusKm) && node.radiusKm > 0
        ? node.radiusKm / EARTH_RADIUS_KM
        : 1;
  return planetRadiusToPx(radiusEarth) * Math.max(0, Number(bodyZoom) || 1);
}

export function representativeGasBaseRadiusPx(node, bodyZoom = 1) {
  return gasGiantRadiusToPx(node?.radiusRj, node?.style) * Math.max(0, Number(bodyZoom) || 1);
}

export function applyRepresentativeBodyRadiusConstraints(rawRadiusPx, metrics) {
  const raw = Number(rawRadiusPx);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  const scale = Number(metrics?.repBodyScale);
  const minVisiblePx = Number(metrics?.repBodyMinPx);
  const starCapPx = Number(metrics?.starR);
  let r = raw * (Number.isFinite(scale) && scale > 0 ? scale : 1);
  if (Number.isFinite(minVisiblePx) && minVisiblePx > 0) r = Math.max(minVisiblePx, r);
  if (Number.isFinite(starCapPx) && starCapPx > 0) r = Math.min(starCapPx, r);
  return r;
}

export function representativeMoonR(moonKm, parentKm, parentPr) {
  const mk = Number(moonKm);
  const pk = Number(parentKm);
  if (mk > 0 && pk > 0) {
    const ratio = Math.pow(mk / pk, 0.4);
    return Math.max(1.2, parentPr * clamp(ratio, 0.08, 0.3));
  }
  return Math.max(1.2, parentPr * 0.2);
}

export function physicalRadiusToPx(
  bodyRadiusKm,
  starRadiusPx,
  starRadiusKm,
  minPx = 0.35,
  maxPx = 24,
) {
  const bodyKm = Number(bodyRadiusKm);
  const starKm = Number(starRadiusKm);
  if (
    !Number.isFinite(bodyKm) ||
    bodyKm <= 0 ||
    !Number.isFinite(starKm) ||
    starKm <= 0 ||
    !Number.isFinite(starRadiusPx) ||
    starRadiusPx <= 0
  ) {
    return minPx;
  }
  return clamp((bodyKm / starKm) * starRadiusPx, minPx, maxPx);
}

export function computeDebrisParticleTarget(innerPx, outerPx, innerAu, outerAu) {
  const rIn = Math.max(0, Number(innerPx) || 0);
  const rOut = Math.max(rIn + 0.001, Number(outerPx) || rIn + 0.001);
  const areaPx2 = Math.PI * Math.max(0, rOut * rOut - rIn * rIn);
  const widthAu = Math.max(0, (Number(outerAu) || 0) - (Number(innerAu) || 0));
  const target = Math.round(areaPx2 * DEBRIS_PARTICLE_DENSITY + widthAu * 10 + 50);
  return clamp(target, DEBRIS_PARTICLE_MIN, DEBRIS_PARTICLE_MAX);
}

export function sampleDebrisAu(innerAu, outerAu, seedBase) {
  const aIn = Math.max(0, Number(innerAu) || 0);
  const aOut = Math.max(aIn + 0.001, Number(outerAu) || aIn + 0.001);
  const width = aOut - aIn;
  const tCore = (hashUnit(`${seedBase}:r1`) + hashUnit(`${seedBase}:r2`)) * 0.5;
  const radialJitter = (hashUnit(`${seedBase}:rj`) - 0.5) * width * 0.08;
  return clamp(aIn + width * tCore + radialJitter, aIn, aOut);
}

export function debrisKeepChance(angleRad, seedBase) {
  const phaseA = hashUnit(`${seedBase}:phaseA`) * Math.PI * 2;
  const phaseB = hashUnit(`${seedBase}:phaseB`) * Math.PI * 2;
  const clumpA = 0.58 + 0.26 * Math.sin(angleRad * 5.2 + phaseA);
  const clumpB = 0.18 + 0.18 * Math.sin(angleRad * 11.4 + phaseB);
  return clamp(clumpA + clumpB, 0.22, 0.98);
}
