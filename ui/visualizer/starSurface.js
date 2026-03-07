// SPDX-License-Identifier: MPL-2.0
import { createSeededRng } from "../../engine/stellarActivity.js";
import { clamp } from "../../engine/utils.js";

export function hexToRgba(hex, alpha = 1) {
  if (!hex) return `rgba(160,200,255,${alpha})`;
  const raw = hex.replace("#", "").trim();
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function hexToRgb(hex) {
  const raw = String(hex || "")
    .trim()
    .replace(/^#/, "");
  const expanded = raw.length === 3 ? raw.replace(/(.)/g, "$1$1") : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return { r: 255, g: 244, b: 220 };
  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
}

export function mixHex(hexA, hexB, t = 0.5) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const u = clamp(Number(t), 0, 1);
  const r = Math.round(a.r + (b.r - a.r) * u);
  const g = Math.round(a.g + (b.g - a.g) * u);
  const bCh = Math.round(a.b + (b.b - a.b) * u);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bCh.toString(16).padStart(2, "0")}`;
}

export function mixRgb(rgbA, rgbB, t = 0.5) {
  const u = clamp(Number(t), 0, 1);
  return {
    r: Math.round(rgbA.r + (rgbB.r - rgbA.r) * u),
    g: Math.round(rgbA.g + (rgbB.g - rgbA.g) * u),
    b: Math.round(rgbA.b + (rgbB.b - rgbA.b) * u),
  };
}

export function rgbToCss(rgb, alpha = 1) {
  const a = clamp(Number(alpha), 0, 1);
  return `rgba(${clamp(Math.round(rgb.r), 0, 255)},${clamp(Math.round(rgb.g), 0, 255)},${clamp(Math.round(rgb.b), 0, 255)},${a})`;
}

export function getStarSurfaceSeed(snapshot) {
  const rawSeed =
    snapshot?.starSeed ??
    `${snapshot?.starName || "Star"}:${Number(snapshot?.starTempK || 5776).toFixed(0)}:${Number(
      snapshot?.starAgeGyr || 4.6,
    ).toFixed(2)}`;
  return String(rawSeed);
}

function drawSoftBlob(cctx, x, y, r, rgb, alphaInner, alphaOuter = 0) {
  if (!(r > 0)) return;
  const gradient = cctx.createRadialGradient(x, y, 0, x, y, r);
  gradient.addColorStop(0, rgbToCss(rgb, alphaInner));
  gradient.addColorStop(1, rgbToCss(rgb, alphaOuter));
  cctx.fillStyle = gradient;
  cctx.beginPath();
  cctx.arc(x, y, r, 0, Math.PI * 2);
  cctx.fill();
}

export function paintStarSurfaceTexture(
  cctx,
  size,
  { baseHex = "#fff4dc", seed = "star", tempK = 5776, activity = 0.2 } = {},
) {
  const s = Math.max(64, Number(size) || 512);
  const cx = s * 0.5;
  const cy = s * 0.5;
  const r = s * 0.48;
  const baseRgb = hexToRgb(baseHex);
  const coreRgb = hexToRgb(mixHex(baseHex, "#fff7e6", 0.42));
  const limbRgb = hexToRgb(mixHex(baseHex, "#1d1410", 0.35));
  const brightRgb = hexToRgb(mixHex(baseHex, "#fff3dc", 0.58));
  const darkRgb = hexToRgb(mixHex(baseHex, "#130d0b", 0.62));
  const faculaRgb = hexToRgb(mixHex(baseHex, "#ffd9ad", 0.54));
  const tempNorm = clamp((Number(tempK) - 3000) / 7000, 0, 1);
  const activityNorm = clamp(Number(activity), 0, 1);
  const contrast = 1 - tempNorm * 0.28;
  const rng = createSeededRng(
    `${seed}:star-surface:${Math.round(tempK)}:${Math.round(activityNorm * 100)}`,
  );

  cctx.clearRect(0, 0, s, s);
  cctx.save();
  cctx.beginPath();
  cctx.arc(cx, cy, r, 0, Math.PI * 2);
  cctx.clip();

  const baseGrad = cctx.createRadialGradient(cx - r * 0.11, cy - r * 0.13, r * 0.04, cx, cy, r);
  baseGrad.addColorStop(0.0, rgbToCss(coreRgb, 1));
  baseGrad.addColorStop(0.56, rgbToCss(baseRgb, 1));
  baseGrad.addColorStop(0.9, rgbToCss(limbRgb, 1));
  baseGrad.addColorStop(1.0, rgbToCss(mixRgb(limbRgb, { r: 0, g: 0, b: 0 }, 0.15), 1));
  cctx.fillStyle = baseGrad;
  cctx.fillRect(0, 0, s, s);

  const grainCount = Math.round(s * (4.2 + activityNorm * 3.4));
  for (let i = 0; i < grainCount; i += 1) {
    const rr = r * Math.sqrt(rng()) * 0.985;
    const ang = rng() * Math.PI * 2;
    const x = cx + Math.cos(ang) * rr;
    const y = cy + Math.sin(ang) * rr;
    const edge = clamp(1 - rr / r, 0, 1);
    const radius = s * (0.0028 + rng() * 0.0105) * (0.45 + edge * 0.8);
    const isBright = rng() > 0.43;
    const alpha = (0.022 + rng() * 0.085) * (0.35 + edge * 0.75) * contrast;
    const tone = isBright
      ? mixRgb(brightRgb, coreRgb, rng() * 0.4)
      : mixRgb(darkRgb, baseRgb, rng() * 0.32);
    drawSoftBlob(cctx, x, y, radius, tone, alpha, 0);
  }

  const cellCount = Math.round(72 + activityNorm * 80);
  for (let i = 0; i < cellCount; i += 1) {
    const rr = r * (0.08 + rng() * 0.84);
    const ang = rng() * Math.PI * 2;
    const x = cx + Math.cos(ang) * rr;
    const y = cy + Math.sin(ang) * rr;
    const radius = s * (0.02 + rng() * 0.06);
    const brightCell = rng() > 0.55;
    const tone = brightCell
      ? mixRgb(brightRgb, faculaRgb, rng() * 0.35)
      : mixRgb(darkRgb, limbRgb, rng() * 0.25);
    const alpha = (0.025 + rng() * 0.06) * contrast;
    drawSoftBlob(cctx, x, y, radius, tone, alpha, 0);
  }

  const spotCount = Math.round(1 + activityNorm * 7);
  for (let i = 0; i < spotCount; i += 1) {
    const rr = r * (0.12 + rng() * 0.74);
    const ang = rng() * Math.PI * 2;
    const x = cx + Math.cos(ang) * rr;
    const y = cy + Math.sin(ang) * rr;
    const spotR = s * (0.014 + rng() * 0.042) * (0.7 + activityNorm * 0.85);
    const penumbraRgb = mixRgb(darkRgb, limbRgb, 0.18 + rng() * 0.18);
    const umbraRgb = mixRgb(darkRgb, { r: 0, g: 0, b: 0 }, 0.35 + rng() * 0.25);
    drawSoftBlob(cctx, x, y, spotR * 1.4, penumbraRgb, 0.24 + rng() * 0.16, 0);
    drawSoftBlob(cctx, x, y, spotR * (0.52 + rng() * 0.16), umbraRgb, 0.45 + rng() * 0.2, 0);
  }

  const faculaCount = Math.round(16 + activityNorm * 20);
  for (let i = 0; i < faculaCount; i += 1) {
    const rr = r * (0.72 + rng() * 0.25);
    const ang = rng() * Math.PI * 2;
    const x = cx + Math.cos(ang) * rr;
    const y = cy + Math.sin(ang) * rr;
    const facR = s * (0.005 + rng() * 0.017);
    drawSoftBlob(cctx, x, y, facR, faculaRgb, (0.08 + rng() * 0.09) * contrast, 0);
  }

  cctx.restore();

  const rimGrad = cctx.createRadialGradient(cx, cy, r * 0.92, cx, cy, r * 1.03);
  rimGrad.addColorStop(0, rgbToCss(faculaRgb, 0));
  rimGrad.addColorStop(0.76, rgbToCss(faculaRgb, 0.5 + activityNorm * 0.2));
  rimGrad.addColorStop(0.95, rgbToCss(mixRgb(faculaRgb, brightRgb, 0.4), 0.22));
  rimGrad.addColorStop(1, rgbToCss(faculaRgb, 0));
  cctx.fillStyle = rimGrad;
  cctx.beginPath();
  cctx.arc(cx, cy, r * 1.03, 0, Math.PI * 2);
  cctx.fill();
}
