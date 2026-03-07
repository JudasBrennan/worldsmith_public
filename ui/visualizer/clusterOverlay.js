import { clamp } from "../../engine/utils.js";
import { getClusterObjectVisual, normalizeClusterObjectKey } from "../clusterObjectVisuals.js";

let starfieldCache = null;

export function drawStarDot(ctx, cx, cy, radius, color, alpha) {
  const hex = String(color || "#ffffff").replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const cr = Math.min(255, Math.round(r * 0.5 + 255 * 0.5));
  const cg = Math.min(255, Math.round(g * 0.5 + 255 * 0.5));
  const cb = Math.min(255, Math.round(b * 0.5 + 255 * 0.5));
  const outerR = Math.max(radius * 2.6, 2);
  const grad = ctx.createRadialGradient(cx, cy, radius * 0.12, cx, cy, outerR);
  grad.addColorStop(0, `rgba(${cr},${cg},${cb},${alpha})`);
  grad.addColorStop(0.42, `rgba(${r},${g},${b},${(alpha * 0.78).toFixed(2)})`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.62, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;
  ctx.fill();
}

export function drawClusterCompanions(ctx, px, py, primaryRadius, components, perspective) {
  const companionCount = components.length - 1;
  if (companionCount <= 0) return;
  const cRadius = clamp(primaryRadius * 0.55, 1.0, 5.5);
  const spacing = cRadius * 2.4;
  const startX = px + primaryRadius * 1.15;
  const startY = py - primaryRadius * 0.85;
  const p = clamp(perspective, 0.35, 2.3);
  const alpha = clamp(0.38 + p * 0.2, 0.28, 0.78);
  for (let i = 0; i < companionCount; i += 1) {
    const comp = components[i + 1];
    const compVisual = getClusterObjectVisual(comp.objectClassKey);
    drawStarDot(ctx, startX + i * spacing, startY, cRadius, compVisual.color, alpha);
  }
}

export function clusterClassLabel(system) {
  if (!Array.isArray(system.components) || system.components.length <= 1) {
    const key = system.objectClassKey;
    return key === "LTY" ? "L/T/Y" : key === "OTHER" ? "Other" : key;
  }
  return system.components
    .map((component) => {
      const key = normalizeClusterObjectKey(component.objectClassKey);
      return key === "LTY" ? "L/T/Y" : key === "OTHER" ? "Other" : key;
    })
    .join(" + ");
}

export function ensureStarfield(count = 400) {
  if (starfieldCache && starfieldCache.length === count) return starfieldCache;
  const stars = [];
  let seed = 48271;
  const rng = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < count; i += 1) {
    stars.push({
      u: rng(),
      v: rng(),
      radius: 0.3 + rng() * 0.7,
      alpha: 0.15 + rng() * 0.35,
    });
  }
  starfieldCache = stars;
  return stars;
}

export function drawClusterStarfield(ctx, width, height, count = 400) {
  const stars = ensureStarfield(count);
  for (const star of stars) {
    const x = star.u * width;
    const y = star.v * height;
    ctx.beginPath();
    ctx.arc(x, y, star.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(200,210,240,${star.alpha.toFixed(2)})`;
    ctx.fill();
  }
}
