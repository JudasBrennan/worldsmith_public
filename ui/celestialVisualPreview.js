import {
  FLARE_E0_ERG,
  createSeededRng,
  flareClassFromEnergy,
  scheduleNextCme,
  scheduleNextFlare,
} from "../engine/stellarActivity.js";
import { clamp } from "../engine/utils.js";
import { loadThreeCore } from "./threeBridge2d.js";
import { composeCelestialDescriptor, paintCelestialTexture } from "./celestialComposer.js";
import {
  canvasFromMapPayload,
  requestCelestialTextureBundle,
  supportsCelestialTextureWorker,
} from "./celestialTextureWorkerClient.js";
import { loadTexturesFromIDB, storeTexturesToIDB, clearStaleTextures } from "./textureCache.js";

const DEFAULT_SPEED_DAYS_PER_SEC = 0.5;
const STAR_BURST_SIZE_SCALE = 0.3;
const STAR_CME_RENDER_SCALE = 0.099;
const MAX_FLARES_PER_TICK = 48;
const MAX_CMES_PER_TICK = 48;
const MAX_SURFACE_FLARES_PER_TICK = 96;
const MAX_STAR_BURSTS = 48;
const STAR_BURST_INITIAL_AGE_SEC = 0.08;
const SURFACE_FLARE_EMIN_ERG = 1e30;
const SURFACE_FLARE_EMAX_ERG = FLARE_E0_ERG * 0.999;
const SURFACE_TEXTURE_SIZE = 512;
const STAR_PREVIEW_FILL = 0.36;
const CELESTIAL_DEFAULT_LOD = "medium";
const CELESTIAL_DPR_MIN = 1;
const CELESTIAL_DPR_MAX = 2;
const CELESTIAL_TEXTURE_CACHE = new Map();
const CELESTIAL_TEXTURE_CACHE_MAX = 64;
const CELESTIAL_TEXTURE_PIPELINE_VERSION = 9;

/* Purge IDB entries from older pipeline versions (fire-and-forget) */
clearStaleTextures(CELESTIAL_TEXTURE_PIPELINE_VERSION);

function hashUnit(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function normalizeHex(hex, fallback = "#fff4dc") {
  const raw = String(hex || "")
    .trim()
    .replace(/^#/, "");
  const full = raw.length === 3 ? raw.replace(/(.)/g, "$1$1") : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return fallback;
  return `#${full.toLowerCase()}`;
}

function hexToRgb(hex) {
  const safe = normalizeHex(hex);
  return {
    r: parseInt(safe.slice(1, 3), 16),
    g: parseInt(safe.slice(3, 5), 16),
    b: parseInt(safe.slice(5, 7), 16),
  };
}

function hexToRgba(hex, alpha = 1) {
  const rgb = hexToRgb(hex);
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${clamp(Number(alpha), 0, 1)})`;
}

function mixRgb(rgbA, rgbB, t = 0.5) {
  const u = clamp(Number(t), 0, 1);
  return {
    r: Math.round(rgbA.r + (rgbB.r - rgbA.r) * u),
    g: Math.round(rgbA.g + (rgbB.g - rgbA.g) * u),
    b: Math.round(rgbA.b + (rgbB.b - rgbA.b) * u),
  };
}

function mixHex(hexA, hexB, t = 0.5) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const mixed = mixRgb(a, b, t);
  return `#${mixed.r.toString(16).padStart(2, "0")}${mixed.g.toString(16).padStart(2, "0")}${mixed.b.toString(16).padStart(2, "0")}`;
}

function rgbToCss(rgb, alpha = 1) {
  return `rgba(${clamp(Math.round(rgb.r), 0, 255)},${clamp(Math.round(rgb.g), 0, 255)},${clamp(Math.round(rgb.b), 0, 255)},${clamp(Number(alpha), 0, 1)})`;
}

function lerp(a, b, t) {
  return a + (b - a) * clamp(Number(t), 0, 1);
}

function smoothstep(edge0, edge1, x) {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function fract(x) {
  return x - Math.floor(x);
}

function hash3(x, y, z, seed = 0) {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 19.19) * 43758.5453123;
  return fract(h);
}

function valueNoise3(x, y, z, seed = 0) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const w = zf * zf * (3 - 2 * zf);

  const n000 = hash3(xi, yi, zi, seed);
  const n100 = hash3(xi + 1, yi, zi, seed);
  const n010 = hash3(xi, yi + 1, zi, seed);
  const n110 = hash3(xi + 1, yi + 1, zi, seed);
  const n001 = hash3(xi, yi, zi + 1, seed);
  const n101 = hash3(xi + 1, yi, zi + 1, seed);
  const n011 = hash3(xi, yi + 1, zi + 1, seed);
  const n111 = hash3(xi + 1, yi + 1, zi + 1, seed);

  const x00 = lerp(n000, n100, u);
  const x10 = lerp(n010, n110, u);
  const x01 = lerp(n001, n101, u);
  const x11 = lerp(n011, n111, u);
  const y0 = lerp(x00, x10, v);
  const y1 = lerp(x01, x11, v);
  return lerp(y0, y1, w);
}

function fbm3Fast(x, y, z, seed = 0, octaves = 5, lacunarity = 2, gain = 0.5) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    sum += valueNoise3(x * freq, y * freq, z * freq, seed + i * 17.31) * amp;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return norm > 0 ? sum / norm : 0;
}

function ridgedFbm3Fast(x, y, z, seed = 0, octaves = 5, lacunarity = 2, gain = 0.5) {
  const n = fbm3Fast(x, y, z, seed, octaves, lacunarity, gain);
  return 1 - Math.abs(n * 2 - 1);
}

function sphericalWrapLonDelta(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function drawSoftBlob(ctx, x, y, radius, rgb, alphaInner, alphaOuter = 0) {
  if (!(radius > 0)) return;
  const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
  grad.addColorStop(0, rgbToCss(rgb, alphaInner));
  grad.addColorStop(1, rgbToCss(rgb, alphaOuter));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function paintStarSurfaceTexture(
  ctx,
  size,
  { baseHex = "#fff4dc", seed = "star", tempK = 5776, activity = 0.2 } = {},
) {
  const s = Math.max(64, Number(size) || SURFACE_TEXTURE_SIZE);
  const cx = s * 0.5;
  const cy = s * 0.5;
  const radius = s * 0.48;
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
    `${seed}:star-surface:${Math.round(Number(tempK) || 5776)}:${Math.round(activityNorm * 100)}`,
  );

  ctx.clearRect(0, 0, s, s);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();

  const baseGrad = ctx.createRadialGradient(
    cx - radius * 0.11,
    cy - radius * 0.13,
    radius * 0.04,
    cx,
    cy,
    radius,
  );
  baseGrad.addColorStop(0, rgbToCss(coreRgb, 1));
  baseGrad.addColorStop(0.56, rgbToCss(baseRgb, 1));
  baseGrad.addColorStop(0.9, rgbToCss(limbRgb, 1));
  baseGrad.addColorStop(1, rgbToCss(mixRgb(limbRgb, { r: 0, g: 0, b: 0 }, 0.15), 1));
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, s, s);

  const grainCount = Math.round(s * (4.2 + activityNorm * 3.4));
  for (let i = 0; i < grainCount; i += 1) {
    const rr = radius * Math.sqrt(rng()) * 0.985;
    const angle = rng() * Math.PI * 2;
    const x = cx + Math.cos(angle) * rr;
    const y = cy + Math.sin(angle) * rr;
    const edge = clamp(1 - rr / radius, 0, 1);
    const blobR = s * (0.0028 + rng() * 0.0105) * (0.45 + edge * 0.8);
    const bright = rng() > 0.43;
    const alpha = (0.022 + rng() * 0.085) * (0.35 + edge * 0.75) * contrast;
    const tone = bright
      ? mixRgb(brightRgb, coreRgb, rng() * 0.4)
      : mixRgb(darkRgb, baseRgb, rng() * 0.32);
    drawSoftBlob(ctx, x, y, blobR, tone, alpha, 0);
  }

  const cellCount = Math.round(72 + activityNorm * 80);
  for (let i = 0; i < cellCount; i += 1) {
    const rr = radius * (0.08 + rng() * 0.84);
    const angle = rng() * Math.PI * 2;
    const x = cx + Math.cos(angle) * rr;
    const y = cy + Math.sin(angle) * rr;
    const blobR = s * (0.02 + rng() * 0.06);
    const brightCell = rng() > 0.55;
    const tone = brightCell
      ? mixRgb(brightRgb, faculaRgb, rng() * 0.35)
      : mixRgb(darkRgb, limbRgb, rng() * 0.25);
    const alpha = (0.025 + rng() * 0.06) * contrast;
    drawSoftBlob(ctx, x, y, blobR, tone, alpha, 0);
  }

  const spotCount = Math.round(1 + activityNorm * 7);
  for (let i = 0; i < spotCount; i += 1) {
    const rr = radius * (0.12 + rng() * 0.74);
    const angle = rng() * Math.PI * 2;
    const x = cx + Math.cos(angle) * rr;
    const y = cy + Math.sin(angle) * rr;
    const spotR = s * (0.014 + rng() * 0.042) * (0.7 + activityNorm * 0.85);
    const penumbraRgb = mixRgb(darkRgb, limbRgb, 0.18 + rng() * 0.18);
    const umbraRgb = mixRgb(darkRgb, { r: 0, g: 0, b: 0 }, 0.35 + rng() * 0.25);
    drawSoftBlob(ctx, x, y, spotR * 1.4, penumbraRgb, 0.24 + rng() * 0.16, 0);
    drawSoftBlob(ctx, x, y, spotR * (0.52 + rng() * 0.16), umbraRgb, 0.45 + rng() * 0.2, 0);
  }

  const faculaCount = Math.round(16 + activityNorm * 20);
  for (let i = 0; i < faculaCount; i += 1) {
    const rr = radius * (0.72 + rng() * 0.25);
    const angle = rng() * Math.PI * 2;
    const x = cx + Math.cos(angle) * rr;
    const y = cy + Math.sin(angle) * rr;
    const facR = s * (0.005 + rng() * 0.017);
    drawSoftBlob(ctx, x, y, facR, faculaRgb, (0.08 + rng() * 0.09) * contrast, 0);
  }

  ctx.restore();

  const rimGrad = ctx.createRadialGradient(cx, cy, radius * 0.92, cx, cy, radius * 1.03);
  rimGrad.addColorStop(0, rgbToCss(faculaRgb, 0));
  rimGrad.addColorStop(0.76, rgbToCss(faculaRgb, 0.5 + activityNorm * 0.2));
  rimGrad.addColorStop(0.95, rgbToCss(mixRgb(faculaRgb, brightRgb, 0.4), 0.22));
  rimGrad.addColorStop(1, rgbToCss(faculaRgb, 0));
  ctx.fillStyle = rimGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 1.03, 0, Math.PI * 2);
  ctx.fill();
}

function flareVisualProfile(flareClass) {
  switch (flareClass) {
    case "super":
      return { spread: 0.22, reach: 1.9, intensity: 0.34, ttl: 1.45 };
    case "large":
      return { spread: 0.17, reach: 1.45, intensity: 0.27, ttl: 1.1 };
    case "medium":
      return { spread: 0.13, reach: 1.1, intensity: 0.21, ttl: 0.86 };
    case "small":
      return { spread: 0.09, reach: 0.82, intensity: 0.16, ttl: 0.62 };
    case "micro":
    default:
      return { spread: 0.06, reach: 0.58, intensity: 0.11, ttl: 0.42 };
  }
}

function flareEnergyNorm(energyErg) {
  const e = Math.max(1, Number(energyErg) || 1e30);
  return clamp((Math.log10(e) - 30) / 5, 0, 1);
}

function cycleValueAt(preview, simSec) {
  if (preview.params?.teffBin !== "FGK") return 0.5;
  const phase = (simSec / preview.cyclePeriodSec) * Math.PI * 2 + preview.cyclePhase;
  return 0.5 + 0.5 * Math.sin(phase);
}

function pushBurst(preview, { type, flareClass, energyErg, angle, activityCycle = 0.5 }) {
  if (preview.bursts.length >= MAX_STAR_BURSTS) return false;

  const rng = preview.rng || Math.random;
  const base = flareVisualProfile(flareClass);
  const isCme = type === "cme";
  const isSurface = type === "surface";
  let hasLoops = false;
  if (!isCme && !isSurface) {
    hasLoops = preview.loopToggle !== false;
    preview.loopToggle = !hasLoops;
  }

  const energyNorm = flareEnergyNorm(energyErg);
  const n32 = Math.max(0, Number(preview.params?.N32) || 0);
  const activityNorm = clamp(Math.log10(1 + n32) / Math.log10(31), 0, 1);
  const cycleNorm = clamp(Number(activityCycle), 0, 1);
  const jitter = (rng() - 0.5) * 0.25;

  const spread = Math.max(
    0.03,
    base.spread *
      (isCme ? 1.45 : isSurface ? 0.65 : 1) *
      (1 + jitter) *
      (0.88 + energyNorm * 0.42 + activityNorm * 0.18),
  );
  const reach = Math.max(
    0.2,
    base.reach *
      (isCme ? 2 : isSurface ? 0.35 : 1) *
      (1 + jitter) *
      (0.9 + energyNorm * 0.8 + cycleNorm * 0.25),
  );
  const intensity = Math.max(
    0.06,
    base.intensity *
      (isCme ? 0.86 : isSurface ? 0.72 : 1) *
      (1 + jitter * 0.5) *
      (0.84 + energyNorm * 0.82 + activityNorm * 0.32),
  );
  const ttl = Math.max(
    0.2,
    base.ttl *
      (isCme ? 1.95 : isSurface ? 0.55 : 1) *
      (1 + jitter * 0.2) *
      (0.9 + energyNorm * 0.45),
  );
  const loopCount = clamp(
    Math.round(
      (isCme ? 2.2 : 1.2) +
        energyNorm * (isCme ? 3 : 2.2) +
        activityNorm * 1.4 +
        cycleNorm * 0.9 +
        (rng() - 0.5) * 1.2,
    ),
    1,
    isCme ? 7 : 5,
  );
  const radialStartNorm = isCme
    ? clamp(0.28 + rng() * 0.16 + energyNorm * 0.08, 0.22, 0.64)
    : clamp(0.07 + rng() * 0.09 + energyNorm * 0.04, 0.05, 0.26);
  const radialEndNorm = isCme
    ? clamp(
        1.15 + energyNorm * 0.9 + activityNorm * 0.25 + cycleNorm * 0.2 + rng() * 0.18,
        1.08,
        2.6,
      )
    : clamp(0.5 + energyNorm * 0.32 + cycleNorm * 0.15 + rng() * 0.08, 0.42, 1.15);
  const surfaceRadiusNorm = isSurface ? Math.pow(rng(), 0.62) * 0.9 : 0;
  const surfaceSpotScale = isSurface ? clamp(0.65 + energyNorm * 0.9 + rng() * 0.35, 0.5, 1.7) : 1;

  preview.bursts.push({
    type: isCme ? "cme" : isSurface ? "surface" : "flare",
    flareClass,
    energyErg,
    angle,
    spread,
    reach,
    intensity,
    ttl,
    age: Math.min(STAR_BURST_INITIAL_AGE_SEC, ttl * 0.22),
    loops: loopCount,
    hasLoops,
    loopRise: clamp(0.5 + energyNorm * 0.4 + (isCme ? 0.18 : 0), 0.45, 1.25),
    energyNorm,
    activityNorm,
    radialStartNorm,
    radialEndNorm,
    curl: (rng() - 0.5) * 0.45,
    surfaceRadiusNorm,
    surfaceSpotScale,
  });
  return true;
}

function updateBursts(preview, dtSec) {
  if (!(dtSec > 0)) return;

  if (preview.bursts.length) {
    for (const burst of preview.bursts) burst.age += dtSec;
    preview.bursts = preview.bursts.filter((burst) => burst.age < burst.ttl);
  }

  const nowActivitySec = preview.activityDays * 86400;
  let flareIterations = 0;
  while (
    Number.isFinite(preview.nextFlareTimeSec) &&
    preview.nextFlareTimeSec <= nowActivitySec &&
    flareIterations < MAX_FLARES_PER_TICK &&
    preview.bursts.length < MAX_STAR_BURSTS
  ) {
    const flareEnergy = Number(preview.nextFlareEnergyErg) || FLARE_E0_ERG;
    const flareClass = flareClassFromEnergy(flareEnergy);
    const activityCycle = cycleValueAt(preview, preview.nextFlareTimeSec);
    pushBurst(preview, {
      type: "flare",
      flareClass,
      energyErg: flareEnergy,
      angle: (preview.rng || Math.random)() * Math.PI * 2,
      activityCycle,
    });
    const next = scheduleNextFlare(preview.nextFlareTimeSec, preview.params, preview.rng);
    preview.nextFlareTimeSec = next.timeSec;
    preview.nextFlareEnergyErg = next.energyErg;
    flareIterations += 1;
  }
  if (
    (flareIterations >= MAX_FLARES_PER_TICK || preview.bursts.length >= MAX_STAR_BURSTS) &&
    preview.nextFlareTimeSec <= nowActivitySec
  ) {
    const next = scheduleNextFlare(nowActivitySec, preview.params, preview.rng);
    preview.nextFlareTimeSec = next.timeSec;
    preview.nextFlareEnergyErg = next.energyErg;
  }

  let surfaceIterations = 0;
  while (
    Number.isFinite(preview.nextSurfaceFlareTimeSec) &&
    preview.nextSurfaceFlareTimeSec <= nowActivitySec &&
    surfaceIterations < MAX_SURFACE_FLARES_PER_TICK &&
    preview.bursts.length < MAX_STAR_BURSTS
  ) {
    const flareEnergy = Number(preview.nextSurfaceFlareEnergyErg) || SURFACE_FLARE_EMIN_ERG;
    const flareClass = flareClassFromEnergy(flareEnergy);
    const activityCycle = cycleValueAt(preview, preview.nextSurfaceFlareTimeSec);
    pushBurst(preview, {
      type: "surface",
      flareClass,
      energyErg: flareEnergy,
      angle: (preview.rng || Math.random)() * Math.PI * 2,
      activityCycle,
    });
    const next = scheduleNextFlare(
      preview.nextSurfaceFlareTimeSec,
      preview.surfaceParams,
      preview.rng,
    );
    preview.nextSurfaceFlareTimeSec = next.timeSec;
    preview.nextSurfaceFlareEnergyErg = next.energyErg;
    surfaceIterations += 1;
  }
  if (
    (surfaceIterations >= MAX_SURFACE_FLARES_PER_TICK ||
      preview.bursts.length >= MAX_STAR_BURSTS) &&
    preview.nextSurfaceFlareTimeSec <= nowActivitySec
  ) {
    const next = scheduleNextFlare(nowActivitySec, preview.surfaceParams, preview.rng);
    preview.nextSurfaceFlareTimeSec = next.timeSec;
    preview.nextSurfaceFlareEnergyErg = next.energyErg;
  }

  const associatedRatePerDay = Math.max(0, Number(preview.params?.cmeAssociatedRatePerDay) || 0);
  const backgroundRatePerDay = Math.max(0, Number(preview.params?.cmeBackgroundRatePerDay) || 0);

  let associatedIterations = 0;
  while (
    Number.isFinite(preview.nextAssociatedCmeTimeSec) &&
    preview.nextAssociatedCmeTimeSec <= nowActivitySec &&
    associatedIterations < MAX_CMES_PER_TICK &&
    preview.bursts.length < MAX_STAR_BURSTS
  ) {
    const burstTime = preview.nextAssociatedCmeTimeSec;
    const activityCycle = cycleValueAt(preview, burstTime);
    const activeFlares = preview.bursts.filter(
      (burst) => burst.type === "flare" && burst.age < burst.ttl * 0.85,
    );
    let angle = (preview.rng || Math.random)() * Math.PI * 2;
    let energyErg = FLARE_E0_ERG * (1 + (preview.rng || Math.random)() * 2.5);
    if (activeFlares.length) {
      const anchor = activeFlares[Math.floor((preview.rng || Math.random)() * activeFlares.length)];
      angle = anchor.angle + ((preview.rng || Math.random)() - 0.5) * 0.2;
      energyErg = Math.max(FLARE_E0_ERG, Number(anchor.energyErg) || FLARE_E0_ERG);
    }
    pushBurst(preview, {
      type: "cme",
      flareClass: flareClassFromEnergy(energyErg),
      energyErg,
      angle,
      activityCycle,
    });
    preview.nextAssociatedCmeTimeSec = scheduleNextCme(
      preview.nextAssociatedCmeTimeSec,
      associatedRatePerDay,
      preview.rng,
    );
    associatedIterations += 1;
  }
  if (
    (associatedIterations >= MAX_CMES_PER_TICK || preview.bursts.length >= MAX_STAR_BURSTS) &&
    preview.nextAssociatedCmeTimeSec <= nowActivitySec
  ) {
    preview.nextAssociatedCmeTimeSec = scheduleNextCme(
      nowActivitySec,
      associatedRatePerDay,
      preview.rng,
    );
  }

  let backgroundIterations = 0;
  while (
    Number.isFinite(preview.nextBackgroundCmeTimeSec) &&
    preview.nextBackgroundCmeTimeSec <= nowActivitySec &&
    backgroundIterations < MAX_CMES_PER_TICK &&
    preview.bursts.length < MAX_STAR_BURSTS
  ) {
    const burstTime = preview.nextBackgroundCmeTimeSec;
    const activityCycle = cycleValueAt(preview, burstTime);
    const energyErg = FLARE_E0_ERG * (0.55 + (preview.rng || Math.random)() * 1.3);
    pushBurst(preview, {
      type: "cme",
      flareClass: flareClassFromEnergy(energyErg),
      energyErg,
      angle: (preview.rng || Math.random)() * Math.PI * 2,
      activityCycle,
    });
    preview.nextBackgroundCmeTimeSec = scheduleNextCme(
      preview.nextBackgroundCmeTimeSec,
      backgroundRatePerDay,
      preview.rng,
    );
    backgroundIterations += 1;
  }
  if (
    (backgroundIterations >= MAX_CMES_PER_TICK || preview.bursts.length >= MAX_STAR_BURSTS) &&
    preview.nextBackgroundCmeTimeSec <= nowActivitySec
  ) {
    preview.nextBackgroundCmeTimeSec = scheduleNextCme(
      nowActivitySec,
      backgroundRatePerDay,
      preview.rng,
    );
  }
}

function drawStarBursts(preview, cx, cy, starR, starColourHex) {
  if (!preview.bursts.length || !preview.ctx) return;
  const ctx = preview.ctx;

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const burstHotHex = mixHex(starColourHex, "#ffd4a8", 0.4);
  const burstTrailHex = mixHex(starColourHex, "#ffb581", 0.72);
  const loopHaloHex = mixHex(starColourHex, "#ff9f6d", 0.78);
  const loopCoreHex = mixHex(starColourHex, "#fff6e2", 0.62);

  for (const burst of preview.bursts) {
    const t = clamp(burst.age / burst.ttl, 0, 1);
    const fade = Math.sin(Math.PI * t) * burst.intensity;
    if (!(fade > 0.001)) continue;

    const energyNorm = clamp(Number(burst.energyNorm) || flareEnergyNorm(burst.energyErg), 0, 1);
    const activityNorm = clamp(Number(burst.activityNorm) || 0, 0, 1);
    const hasLoops = burst.hasLoops !== false;
    const loopRise = clamp(Number(burst.loopRise) || 0.7, 0.45, 1.35);
    const loopCount = clamp(
      Number.isFinite(Number(burst.loops)) ? Number(burst.loops) : burst.type === "cme" ? 3 : 2,
      1,
      burst.type === "cme" ? 8 : 6,
    );
    const isCme = burst.type === "cme";
    const isSurface = burst.type === "surface";
    const rInner = starR * 1.03;
    const burstReach = Math.max(0.2, Number(burst.reach) || 0.7);
    const rSpan = starR * burstReach * STAR_BURST_SIZE_SCALE;
    const radialStartNorm = clamp(Number(burst.radialStartNorm) || (isCme ? 0.32 : 0.1), 0.04, 3);
    const radialEndNormRaw = Number(burst.radialEndNorm);
    const radialEndNorm = Math.max(
      radialStartNorm + 0.05,
      Number.isFinite(radialEndNormRaw) ? radialEndNormRaw : isCme ? 1.5 : 0.75,
    );
    const radialNorm = radialStartNorm + (radialEndNorm - radialStartNorm) * t;
    const spreadBase = burst.spread * STAR_BURST_SIZE_SCALE;
    const spread = spreadBase * (isCme ? 1.22 - 0.28 * t : 1 - 0.25 * t);

    if (isSurface) {
      const dirX = Math.cos(burst.angle);
      const dirY = Math.sin(burst.angle);
      const surfaceRadiusNorm = clamp(Number(burst.surfaceRadiusNorm) || 0.5, 0.02, 0.92);
      const surfaceSpotScale = clamp(Number(burst.surfaceSpotScale) || 1, 0.5, 1.8);
      const px = cx + dirX * (starR * surfaceRadiusNorm);
      const py = cy + dirY * (starR * surfaceRadiusNorm);
      const tangentialA = burst.angle + Math.PI * 0.5;
      const tangentialDx = Math.cos(tangentialA);
      const tangentialDy = Math.sin(tangentialA);
      const spotR = Math.max(0.8, starR * (0.015 + 0.018 * energyNorm) * surfaceSpotScale);
      const streakLen = spotR * (1.8 + energyNorm * 0.7);
      const sx = px - tangentialDx * streakLen * 0.5;
      const sy = py - tangentialDy * streakLen * 0.5;
      const ex = px + tangentialDx * streakLen * 0.5;
      const ey = py + tangentialDy * streakLen * 0.5;
      const streakGrad = ctx.createLinearGradient(sx, sy, ex, ey);
      streakGrad.addColorStop(0, hexToRgba(loopHaloHex, 0));
      streakGrad.addColorStop(0.45, hexToRgba(loopCoreHex, Math.min(0.88, fade * 1.2)));
      streakGrad.addColorStop(1, hexToRgba(loopHaloHex, 0));
      ctx.strokeStyle = streakGrad;
      ctx.lineWidth = Math.max(0.8, spotR * 0.65);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      const coreGrad = ctx.createRadialGradient(px, py, spotR * 0.12, px, py, spotR * 1.45);
      coreGrad.addColorStop(0, hexToRgba(loopCoreHex, Math.min(0.9, fade * 1.5)));
      coreGrad.addColorStop(0.45, hexToRgba(loopHaloHex, fade * 0.65));
      coreGrad.addColorStop(1, hexToRgba(loopHaloHex, 0));
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(px, py, spotR * 1.4, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    if (isCme) {
      const cmeScale = STAR_CME_RENDER_SCALE;
      const cmeSpread = spread * (1.16 + 0.26 * energyNorm) * cmeScale;
      const rOuter = rInner + rSpan * radialNorm * cmeScale * (1.05 + 0.2 * energyNorm);
      const a0 = burst.angle - cmeSpread;
      const a1 = burst.angle + cmeSpread;
      const g = ctx.createRadialGradient(cx, cy, rInner, cx, cy, rOuter);
      g.addColorStop(0, hexToRgba(starColourHex, Math.min(0.34, fade + 0.06)));
      g.addColorStop(0.42, hexToRgba(burstHotHex, fade * (0.74 + 0.1 * energyNorm)));
      g.addColorStop(0.76, hexToRgba(loopHaloHex, fade * 0.34));
      g.addColorStop(1, hexToRgba(burstTrailHex, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a0) * rInner, cy + Math.sin(a0) * rInner);
      ctx.arc(cx, cy, rOuter, a0, a1);
      ctx.lineTo(cx + Math.cos(a1) * rInner, cy + Math.sin(a1) * rInner);
      ctx.arc(cx, cy, rInner, a1, a0, true);
      ctx.closePath();
      ctx.fill();

      const cmeLoopCount = clamp(loopCount + 2, 3, 10);
      for (let li = 0; li < cmeLoopCount; li += 1) {
        const u = (li + 1) / (cmeLoopCount + 1);
        const loopCenterA =
          burst.angle +
          (u - 0.5) * cmeSpread * 1.7 +
          (Number(burst.curl) || 0) * (0.55 - 0.2 * u) * (1 - t);
        const footDelta = Math.max(cmeSpread * (0.34 + (1 - u) * 0.96), 0.05 + energyNorm * 0.05);
        const leftA = loopCenterA - footDelta;
        const rightA = loopCenterA + footDelta;
        const extraLift = starR * (0.06 + energyNorm * 0.08) * (1 - u * 0.55);
        const archApexR =
          rInner +
          (rOuter - rInner) * clamp((0.62 + loopRise * 0.4) * (0.75 + 0.25 * u), 0.46, 1.3) +
          extraLift;
        const apexA = loopCenterA + (Number(burst.curl) || 0) * (0.45 + u * 0.45) * (1 - t);
        const lsx = cx + Math.cos(leftA) * rInner;
        const lsy = cy + Math.sin(leftA) * rInner;
        const lex = cx + Math.cos(rightA) * rInner;
        const ley = cy + Math.sin(rightA) * rInner;
        const lmx = cx + Math.cos(apexA) * archApexR;
        const lmy = cy + Math.sin(apexA) * archApexR;

        ctx.strokeStyle = hexToRgba(
          loopHaloHex,
          fade * (0.36 + 0.24 * (1 - u)) * (0.9 + activityNorm * 0.45),
        );
        ctx.lineWidth = Math.max(0.95, starR * (0.026 - u * 0.01));
        ctx.beginPath();
        ctx.moveTo(lsx, lsy);
        ctx.quadraticCurveTo(lmx, lmy, lex, ley);
        ctx.stroke();

        ctx.strokeStyle = hexToRgba(loopCoreHex, fade * (0.54 + 0.3 * (1 - u)));
        ctx.lineWidth = Math.max(0.65, starR * (0.013 - u * 0.004));
        ctx.beginPath();
        ctx.moveTo(lsx, lsy);
        ctx.quadraticCurveTo(lmx, lmy, lex, ley);
        ctx.stroke();
      }
      continue;
    }

    const rOuter = rInner + rSpan * radialNorm;
    const a0 = burst.angle - spread;
    const a1 = burst.angle + spread;
    const plumeGrad = ctx.createRadialGradient(cx, cy, rInner, cx, cy, rOuter);
    plumeGrad.addColorStop(0, hexToRgba(starColourHex, Math.min(0.38, fade + 0.08)));
    plumeGrad.addColorStop(0.45, hexToRgba(burstHotHex, fade * 0.68));
    plumeGrad.addColorStop(0.78, hexToRgba(loopHaloHex, fade * 0.3));
    plumeGrad.addColorStop(1, hexToRgba(burstTrailHex, 0));
    ctx.fillStyle = plumeGrad;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a0) * rInner, cy + Math.sin(a0) * rInner);
    ctx.arc(cx, cy, rOuter, a0, a1);
    ctx.lineTo(cx + Math.cos(a1) * rInner, cy + Math.sin(a1) * rInner);
    ctx.arc(cx, cy, rInner, a1, a0, true);
    ctx.closePath();
    ctx.fill();

    const footA = burst.angle + (Number(burst.curl) || 0) * 0.18 * (1 - t);
    const footX = cx + Math.cos(footA) * (rInner + 1.5);
    const footY = cy + Math.sin(footA) * (rInner + 1.5);
    const footR = Math.max(0.9, starR * (0.026 + 0.012 * energyNorm));
    const footGrad = ctx.createRadialGradient(
      footX,
      footY,
      footR * 0.12,
      footX,
      footY,
      footR * 1.35,
    );
    footGrad.addColorStop(0, hexToRgba(loopCoreHex, Math.min(0.85, fade * 1.8)));
    footGrad.addColorStop(0.5, hexToRgba(loopHaloHex, fade * 0.45));
    footGrad.addColorStop(1, hexToRgba(loopHaloHex, 0));
    ctx.fillStyle = footGrad;
    ctx.beginPath();
    ctx.arc(footX, footY, footR * 1.6, 0, Math.PI * 2);
    ctx.fill();

    if (hasLoops) {
      for (let li = 0; li < loopCount; li += 1) {
        const u = (li + 1) / (loopCount + 1);
        const loopCenterA =
          burst.angle +
          (u - 0.5) * spread * 1.55 +
          (Number(burst.curl) || 0) * (0.58 - 0.2 * u) * (1 - t);
        const minLoopHalfAngle = (0.05 + energyNorm * 0.05) * (0.85 + 0.25 * (1 - u));
        const footDelta = Math.max(spread * (0.34 + (1 - u) * 0.9), minLoopHalfAngle);
        const leftA = loopCenterA - footDelta;
        const rightA = loopCenterA + footDelta;
        const extraLift = starR * (0.035 + energyNorm * 0.055) * (1 - u * 0.6);
        const archApexR =
          rInner +
          (rOuter - rInner) * clamp((0.56 + loopRise * 0.36) * (0.7 + 0.3 * u), 0.4, 1.2) +
          extraLift;
        const apexA = loopCenterA + (Number(burst.curl) || 0) * (0.45 + u * 0.55) * (1 - t);
        const sx = cx + Math.cos(leftA) * rInner;
        const sy = cy + Math.sin(leftA) * rInner;
        const ex = cx + Math.cos(rightA) * rInner;
        const ey = cy + Math.sin(rightA) * rInner;
        const mx = cx + Math.cos(apexA) * archApexR;
        const my = cy + Math.sin(apexA) * archApexR;

        ctx.lineCap = "round";
        ctx.strokeStyle = hexToRgba(
          loopHaloHex,
          fade * (0.34 + 0.24 * (1 - u)) * (0.85 + activityNorm * 0.5),
        );
        ctx.lineWidth = Math.max(0.8, starR * (0.026 - u * 0.01));
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(mx, my, ex, ey);
        ctx.stroke();

        ctx.strokeStyle = hexToRgba(loopCoreHex, fade * (0.5 + 0.3 * (1 - u)));
        ctx.lineWidth = Math.max(0.55, starR * (0.012 - u * 0.004));
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(mx, my, ex, ey);
        ctx.stroke();
      }
    }
  }

  ctx.restore();
}

function ensureCanvasSize(preview) {
  if (!preview.canvas || !preview.ctx) return;
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  const cssWidth = Math.max(
    120,
    Math.round(preview.canvas.clientWidth || Number(preview.canvas.getAttribute("width")) || 180),
  );
  const cssHeight = Math.max(
    120,
    Math.round(preview.canvas.clientHeight || Number(preview.canvas.getAttribute("height")) || 180),
  );
  const targetWidth = Math.round(cssWidth * dpr);
  const targetHeight = Math.round(cssHeight * dpr);
  if (preview.canvas.width !== targetWidth || preview.canvas.height !== targetHeight) {
    preview.canvas.width = targetWidth;
    preview.canvas.height = targetHeight;
  }
  preview.dpr = dpr;
  preview.cssWidth = cssWidth;
  preview.cssHeight = cssHeight;
  preview.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function ensureSurfaceTexture(preview) {
  const starColor = preview.model.starColourHex;
  const seed = preview.model.seed;
  const tempK = preview.model.starTempK;
  const activity = preview.model.starActivityLevel;
  const key = `${starColor}:${seed}:${Math.round(tempK)}:${Math.round(activity * 100)}`;
  if (preview.surfaceTexture && preview.surfaceTextureKey === key) return;

  const surfaceCanvas = document.createElement("canvas");
  surfaceCanvas.width = SURFACE_TEXTURE_SIZE;
  surfaceCanvas.height = SURFACE_TEXTURE_SIZE;
  const surfaceCtx = surfaceCanvas.getContext("2d");
  if (!surfaceCtx) return;
  paintStarSurfaceTexture(surfaceCtx, SURFACE_TEXTURE_SIZE, {
    baseHex: starColor,
    seed,
    tempK,
    activity,
  });
  preview.surfaceTexture = surfaceCanvas;
  preview.surfaceTextureKey = key;
}

function drawFrame(preview, dtSec) {
  if (!preview.canvas || !preview.ctx) return;
  ensureCanvasSize(preview);
  ensureSurfaceTexture(preview);

  preview.activityDays += dtSec * preview.speedDaysPerSec;
  updateBursts(preview, dtSec);

  const ctx = preview.ctx;
  const W = preview.cssWidth;
  const H = preview.cssHeight;
  const cx = W * 0.5;
  const cy = H * 0.5;
  const starR = Math.max(30, Math.min(W, H) * STAR_PREVIEW_FILL);
  const starColor = preview.model.starColourHex;
  const starCoreHex = mixHex(starColor, "#ffffff", 0.34);
  const starLimbHex = mixHex(starColor, "#0d1420", 0.2);
  const starActivity = preview.model.starActivityLevel;
  const glowPulse =
    0.55 + 0.45 * Math.sin(preview.activityDays * 0.08 + preview.model.starMassMsol * 0.45);
  const starSurfaceRotation = preview.activityDays * 0.004 + preview.surfaceRotationOffset;
  const canvasRadius = Math.min(W, H) * 0.5;

  ctx.clearRect(0, 0, W, H);

  const coronaOuterR = Math.min(canvasRadius * 0.98, starR * (2.05 + 0.16 * glowPulse));
  const coronaGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coronaOuterR);
  coronaGrad.addColorStop(0, hexToRgba(starColor, 0.19));
  coronaGrad.addColorStop(0.22, hexToRgba(starColor, 0.13));
  coronaGrad.addColorStop(0.5, hexToRgba(starColor, 0.07));
  coronaGrad.addColorStop(0.78, hexToRgba(starColor, 0.02));
  coronaGrad.addColorStop(1, hexToRgba(starColor, 0));
  ctx.fillStyle = coronaGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, coronaOuterR, 0, Math.PI * 2);
  ctx.fill();

  const innerHaloGrad = ctx.createRadialGradient(cx, cy, starR * 0.55, cx, cy, starR * 1.55);
  innerHaloGrad.addColorStop(0, hexToRgba(starCoreHex, 0.36));
  innerHaloGrad.addColorStop(0.4, hexToRgba(starColor, 0.22));
  innerHaloGrad.addColorStop(1, hexToRgba(starColor, 0));
  ctx.fillStyle = innerHaloGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, starR * 1.55, 0, Math.PI * 2);
  ctx.fill();

  if (preview.surfaceTexture) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(starSurfaceRotation);
    ctx.globalAlpha = 0.99;
    ctx.drawImage(preview.surfaceTexture, -starR * 1.03, -starR * 1.03, starR * 2.06, starR * 2.06);
    ctx.restore();
  } else {
    const photosphereGrad = ctx.createRadialGradient(
      cx - starR * 0.11,
      cy - starR * 0.13,
      starR * 0.05,
      cx,
      cy,
      starR,
    );
    photosphereGrad.addColorStop(0, starCoreHex);
    photosphereGrad.addColorStop(0.6, starColor);
    photosphereGrad.addColorStop(0.9, starLimbHex);
    photosphereGrad.addColorStop(1, mixHex(starLimbHex, "#000000", 0.2));
    ctx.fillStyle = photosphereGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, starR, 0, Math.PI * 2);
    ctx.fill();
  }

  const rimTint = mixHex(starColor, "#ffd9ad", 0.46);
  const rimGrad = ctx.createRadialGradient(cx, cy, starR * 0.9, cx, cy, starR * 1.05);
  rimGrad.addColorStop(0, hexToRgba(rimTint, 0));
  rimGrad.addColorStop(0.8, hexToRgba(rimTint, 0.5 + starActivity * 0.2));
  rimGrad.addColorStop(1, hexToRgba(rimTint, 0));
  ctx.fillStyle = rimGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, starR * 1.05, 0, Math.PI * 2);
  ctx.fill();

  drawStarBursts(preview, cx, cy, starR, starColor);
}

function stopLoop(preview) {
  preview.running = false;
  preview.lastTs = 0;
  if (preview.rafId != null) {
    cancelAnimationFrame(preview.rafId);
    preview.rafId = null;
  }
}

function startLoop(preview) {
  if (preview.running || !preview.canvas || !preview.ctx) return;
  preview.running = true;
  const frame = (ts) => {
    if (!preview.running) return;
    if (!preview.canvas || !preview.canvas.isConnected) {
      stopLoop(preview);
      return;
    }
    if (!preview.lastTs) preview.lastTs = ts;
    const dt = clamp((ts - preview.lastTs) / 1000, 1 / 120, 0.12);
    preview.lastTs = ts;
    drawFrame(preview, dt);
    preview.rafId = requestAnimationFrame(frame);
  };
  preview.rafId = requestAnimationFrame(frame);
}

function buildModelSignature(model) {
  return [
    model.seed,
    model.starColourHex,
    model.starTempK.toFixed(2),
    model.starMassMsol.toFixed(6),
    model.energeticRatePerDay.toFixed(6),
    model.totalRatePerDay.toFixed(6),
    model.cmeAssociatedRatePerDay.toFixed(6),
    model.cmeBackgroundRatePerDay.toFixed(6),
    model.teffBin,
    model.ageBand,
  ].join("|");
}

function normalizeModel(input) {
  const activity = input?.activity || {};
  const n32 = Math.max(0, Number(activity.N32) || 0);
  const energeticRatePerDay = Math.max(
    0,
    Number(activity.energeticFlareRatePerDay) || Number(activity.N32) || 0,
  );
  const totalRatePerDay = Math.max(
    energeticRatePerDay,
    Number(activity.totalFlareRatePerDay) || energeticRatePerDay,
  );
  const cmeAssociatedRatePerDay = Math.max(0, Number(activity.cmeAssociatedRatePerDay) || 0);
  const cmeBackgroundRatePerDay = Math.max(0, Number(activity.cmeBackgroundRatePerDay) || 0);
  const starName = String(input?.starName || "Star");
  const starMassMsol = Number(input?.starMassMsol) || 1;
  const starAgeGyr = Number(input?.starAgeGyr) || 4.6;
  const starTempK = Number(input?.starTempK) || 5776;
  const starColourHex = normalizeHex(input?.starColourHex || "#fff4dc");
  const seed = `${starName}:${starMassMsol.toFixed(6)}:${starAgeGyr.toFixed(6)}:${starTempK.toFixed(2)}`;
  return {
    starName,
    starMassMsol,
    starAgeGyr,
    starTempK,
    starColourHex,
    seed,
    n32,
    energeticRatePerDay,
    totalRatePerDay,
    cmeAssociatedRatePerDay,
    cmeBackgroundRatePerDay,
    teffBin: String(activity.teffBin || "FGK"),
    ageBand: String(activity.ageBand || "old"),
    starActivityLevel: clamp(Math.log10(1 + n32) / Math.log10(31), 0, 1),
  };
}

function applyModel(preview, input) {
  const model = normalizeModel(input);
  const signature = buildModelSignature(model);
  if (signature === preview.signature) return;

  preview.model = model;
  preview.signature = signature;
  preview.surfaceRotationOffset = hashUnit(`${model.seed}:surface-rotation`) * Math.PI * 2;

  preview.params = {
    teffBin: model.teffBin,
    ageBand: model.ageBand,
    N32: model.n32,
    lambdaFlarePerDay: model.energeticRatePerDay,
    EminErg: FLARE_E0_ERG,
    cmeAssociatedRatePerDay: model.cmeAssociatedRatePerDay,
    cmeBackgroundRatePerDay: model.cmeBackgroundRatePerDay,
  };
  preview.surfaceParams = {
    teffBin: model.teffBin,
    ageBand: model.ageBand,
    N32: model.n32,
    lambdaFlarePerDay: Math.max(0, model.totalRatePerDay - model.energeticRatePerDay),
    EminErg: SURFACE_FLARE_EMIN_ERG,
    EmaxErg: SURFACE_FLARE_EMAX_ERG,
  };

  preview.rng = createSeededRng(model.seed);
  preview.loopToggle = preview.rng() >= 0.5;
  preview.cyclePhase = preview.rng() * Math.PI * 2;
  preview.cyclePeriodSec = (8 + preview.rng() * 6) * 365.25 * 86400;
  preview.bursts = [];

  const nowActivitySec = preview.activityDays * 86400;
  const nextFlare = scheduleNextFlare(nowActivitySec, preview.params, preview.rng);
  preview.nextFlareTimeSec = nextFlare.timeSec;
  preview.nextFlareEnergyErg = nextFlare.energyErg;
  const nextSurfaceFlare = scheduleNextFlare(nowActivitySec, preview.surfaceParams, preview.rng);
  preview.nextSurfaceFlareTimeSec = nextSurfaceFlare.timeSec;
  preview.nextSurfaceFlareEnergyErg = nextSurfaceFlare.energyErg;
  preview.nextAssociatedCmeTimeSec = scheduleNextCme(
    nowActivitySec,
    model.cmeAssociatedRatePerDay,
    preview.rng,
  );
  preview.nextBackgroundCmeTimeSec = scheduleNextCme(
    nowActivitySec,
    model.cmeBackgroundRatePerDay,
    preview.rng,
  );

  preview.surfaceTexture = null;
  preview.surfaceTextureKey = "";
}

export function createSunVisualPreviewController({
  speedDaysPerSec = DEFAULT_SPEED_DAYS_PER_SEC,
} = {}) {
  const preview = {
    canvas: null,
    ctx: null,
    dpr: 1,
    cssWidth: 180,
    cssHeight: 180,
    speedDaysPerSec: Math.max(0, Number(speedDaysPerSec) || DEFAULT_SPEED_DAYS_PER_SEC),
    activityDays: 0,
    running: false,
    rafId: null,
    lastTs: 0,
    signature: "",
    model: normalizeModel({}),
    rng: Math.random,
    params: null,
    surfaceParams: null,
    loopToggle: true,
    cyclePhase: 0,
    cyclePeriodSec: 11 * 365.25 * 86400,
    nextFlareTimeSec: Infinity,
    nextFlareEnergyErg: null,
    nextSurfaceFlareTimeSec: Infinity,
    nextSurfaceFlareEnergyErg: null,
    nextAssociatedCmeTimeSec: Infinity,
    nextBackgroundCmeTimeSec: Infinity,
    bursts: [],
    surfaceTexture: null,
    surfaceTextureKey: "",
    surfaceRotationOffset: 0,
  };

  applyModel(preview, {});

  return {
    attach(canvas, model) {
      if (canvas !== preview.canvas) {
        preview.canvas = canvas || null;
        preview.ctx = preview.canvas ? preview.canvas.getContext("2d") : null;
      }
      if (model) applyModel(preview, model);
      if (!preview.canvas || !preview.ctx) {
        stopLoop(preview);
        return;
      }
      if (!preview.running) startLoop(preview);
    },

    update(model) {
      applyModel(preview, model || {});
      if (preview.canvas && preview.ctx && !preview.running) startLoop(preview);
    },

    detach() {
      preview.canvas = null;
      preview.ctx = null;
      stopLoop(preview);
    },

    dispose() {
      preview.bursts = [];
      preview.surfaceTexture = null;
      preview.surfaceTextureKey = "";
      this.detach();
    },
  };
}

/**
 * Render a single static star frame to a canvas (for posters / thumbnails).
 * Uses the same visual system as the animated star preview — corona, surface
 * texture, limb darkening — but without animation or flare bursts.
 *
 * @param {HTMLCanvasElement} canvas  destination (must have width/height set)
 * @param {object} [starInput]       star data passed to normalizeModel
 * @param {number} [fillFraction]    fraction of canvas half-dim for body radius
 */
export function renderStarSnapshot(canvas, starInput, fillFraction) {
  if (!canvas) return;
  const W = canvas.width;
  const H = canvas.height;
  if (!(W > 0) || !(H > 0)) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const fill = Number(fillFraction) || STAR_PREVIEW_FILL;
  const model = normalizeModel(starInput || {});
  const cx = W * 0.5;
  const cy = H * 0.5;
  const starR = Math.max(6, Math.min(W, H) * fill);
  const starColor = model.starColourHex;
  const starCoreHex = mixHex(starColor, "#ffffff", 0.34);
  const starLimbHex = mixHex(starColor, "#0d1420", 0.2);
  const canvasRadius = Math.min(W, H) * 0.5;

  ctx.clearRect(0, 0, W, H);

  /* corona */
  const coronaOuterR = Math.min(canvasRadius * 0.98, starR * 2.05);
  const coronaGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coronaOuterR);
  coronaGrad.addColorStop(0, hexToRgba(starColor, 0.19));
  coronaGrad.addColorStop(0.22, hexToRgba(starColor, 0.13));
  coronaGrad.addColorStop(0.5, hexToRgba(starColor, 0.07));
  coronaGrad.addColorStop(0.78, hexToRgba(starColor, 0.02));
  coronaGrad.addColorStop(1, hexToRgba(starColor, 0));
  ctx.fillStyle = coronaGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, coronaOuterR, 0, Math.PI * 2);
  ctx.fill();

  /* inner halo */
  const innerHaloGrad = ctx.createRadialGradient(cx, cy, starR * 0.55, cx, cy, starR * 1.55);
  innerHaloGrad.addColorStop(0, hexToRgba(starCoreHex, 0.36));
  innerHaloGrad.addColorStop(0.4, hexToRgba(starColor, 0.22));
  innerHaloGrad.addColorStop(1, hexToRgba(starColor, 0));
  ctx.fillStyle = innerHaloGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, starR * 1.55, 0, Math.PI * 2);
  ctx.fill();

  /* surface texture (procedural convection / granulation) */
  const surfaceCanvas = document.createElement("canvas");
  surfaceCanvas.width = SURFACE_TEXTURE_SIZE;
  surfaceCanvas.height = SURFACE_TEXTURE_SIZE;
  const surfaceCtx = surfaceCanvas.getContext("2d");
  if (surfaceCtx) {
    paintStarSurfaceTexture(surfaceCtx, SURFACE_TEXTURE_SIZE, {
      baseHex: starColor,
      seed: model.seed,
      tempK: model.starTempK,
      activity: model.starActivityLevel,
    });
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, starR, 0, Math.PI * 2);
    ctx.clip();
    const sz = starR * 2.06;
    ctx.drawImage(surfaceCanvas, cx - sz * 0.5, cy - sz * 0.5, sz, sz);
    ctx.restore();
  } else {
    const photosphereGrad = ctx.createRadialGradient(
      cx - starR * 0.11,
      cy - starR * 0.13,
      starR * 0.05,
      cx,
      cy,
      starR,
    );
    photosphereGrad.addColorStop(0, starCoreHex);
    photosphereGrad.addColorStop(0.6, starColor);
    photosphereGrad.addColorStop(0.9, starLimbHex);
    photosphereGrad.addColorStop(1, mixHex(starLimbHex, "#000000", 0.2));
    ctx.fillStyle = photosphereGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, starR, 0, Math.PI * 2);
    ctx.fill();
  }

  /* rim */
  const rimTint = mixHex(starColor, "#ffd9ad", 0.46);
  const rimGrad = ctx.createRadialGradient(cx, cy, starR * 0.9, cx, cy, starR * 1.05);
  rimGrad.addColorStop(0, hexToRgba(rimTint, 0));
  rimGrad.addColorStop(0.8, hexToRgba(rimTint, 0.5 + model.starActivityLevel * 0.2));
  rimGrad.addColorStop(1, hexToRgba(rimTint, 0));
  ctx.fillStyle = rimGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, starR * 1.05, 0, Math.PI * 2);
  ctx.fill();
}

function clampPreviewDpr(dpr) {
  const v = Number(dpr);
  if (!Number.isFinite(v) || v <= 0) return 1;
  return clamp(v, CELESTIAL_DPR_MIN, CELESTIAL_DPR_MAX);
}

function isStarModel(model) {
  if (!model || typeof model !== "object") return false;
  if (String(model.bodyType || "").toLowerCase() === "star") return true;
  return "activity" in model || "starColourHex" in model || "starTempK" in model;
}

function inferCelestialLod(canvas) {
  if (!canvas) return CELESTIAL_DEFAULT_LOD;
  const width = Number(canvas.clientWidth || canvas.width || 180);
  const wrap = canvas.closest(".kpi-wrap");
  const expanded = !!(wrap && (wrap.matches(":hover") || wrap.matches(":focus-within")));
  if (expanded && width >= 170) return "high";
  if (width <= 64) return "tiny";
  if (width <= 96) return "low";
  return CELESTIAL_DEFAULT_LOD;
}

function previewPbrMaterial(THREE) {
  const hasPhysical = typeof THREE.MeshPhysicalMaterial === "function";
  const MatCtor = hasPhysical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const mat = new MatCtor({
    map: null,
    normalMap: null,
    roughnessMap: null,
    emissiveMap: null,
    roughness: 0.66,
    metalness: 0.03,
    emissive: new THREE.Color(0x000000),
    emissiveIntensity: 0.12,
    transparent: false,
    opacity: 1,
    depthWrite: true,
  });
  if (hasPhysical) {
    mat.clearcoat = 0.08;
    mat.clearcoatRoughness = 0.42;
  }
  if (mat.normalScale?.set) mat.normalScale.set(0.6, 0.6);
  return mat;
}

function createAtmosphereMaterial(THREE) {
  if (typeof THREE.ShaderMaterial !== "function") {
    return new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.12,
      color: 0x9cc2ff,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0x9cc2ff) },
      uOpacity: { value: 0.12 },
      uPower: { value: 2.15 },
      uFalloff: { value: 0.66 },
    },
    vertexShader: `
      varying vec3 vNormalWorld;
      varying vec3 vViewDir;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vNormalWorld = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uPower;
      uniform float uFalloff;
      varying vec3 vNormalWorld;
      varying vec3 vViewDir;
      void main() {
        float ndv = clamp(dot(normalize(vNormalWorld), normalize(vViewDir)), 0.0, 1.0);
        float rim = pow(max(0.0, 1.0 - ndv), uPower);
        float alpha = clamp(rim * uOpacity, 0.0, 1.0);
        if (alpha < 0.001) discard;
        vec3 color = uColor * mix(uFalloff, 1.0, rim);
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function hasLayer(descriptor, id, predicate = null) {
  if (!descriptor || !Array.isArray(descriptor.layers)) return false;
  for (const layer of descriptor.layers) {
    if (layer?.id !== id) continue;
    if (!predicate || predicate(layer)) return true;
  }
  return false;
}

function createCanvasTexture(THREE, canvas, { srgb = false } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearMipmapLinearFilter || THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  if (srgb && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function getCanvas2dContext(canvas, { readback = false } = {}) {
  if (!canvas?.getContext) return null;
  if (readback) {
    return canvas.getContext("2d", { willReadFrequently: true }) || canvas.getContext("2d") || null;
  }
  return canvas.getContext("2d") || null;
}

function makeFlatMapCanvas(width, height, [r, g, b, a = 255]) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = getCanvas2dContext(canvas, { readback: false });
  if (!ctx) return canvas;
  ctx.fillStyle = `rgba(${clamp(Math.round(r), 0, 255)},${clamp(Math.round(g), 0, 255)},${clamp(Math.round(b), 0, 255)},${clamp(a / 255, 0, 1)})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

function blendHorizontalSeam(canvas, seamWidth = 10) {
  if (!canvas) return;
  const ctx = getCanvas2dContext(canvas, { readback: true });
  if (!ctx) return;
  const width = Number(canvas.width) || 0;
  const height = Number(canvas.height) || 0;
  if (width < 4 || height < 2) return;
  const seam = clamp(Math.floor(seamWidth), 1, Math.floor(width / 4));
  const img = ctx.getImageData(0, 0, width, height);
  const data = img.data;
  const px = (x, y) => (y * width + x) * 4;

  for (let y = 0; y < height; y += 1) {
    for (let i = 0; i < seam; i += 1) {
      const xL = i;
      const xR = width - 1 - i;
      const falloff = seam <= 1 ? 0 : i / (seam - 1);
      const blendToAvg = 1 - falloff;
      const li = px(xL, y);
      const ri = px(xR, y);
      for (let c = 0; c < 4; c += 1) {
        const left = data[li + c];
        const right = data[ri + c];
        const avg = (left + right) * 0.5;
        data[li + c] = Math.round(avg * blendToAvg + left * (1 - blendToAvg));
        data[ri + c] = Math.round(avg * blendToAvg + right * (1 - blendToAvg));
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

function getLayerParams(descriptor, id) {
  if (!descriptor || !Array.isArray(descriptor.layers)) return null;
  const layer = descriptor.layers.find((entry) => entry?.id === id);
  return layer?.params || null;
}

function getOceanLayerConfig(descriptor) {
  const params = getLayerParams(descriptor, "ocean-fill");
  return {
    coverage: clamp(Number(params?.coverage) || 0, 0, 1),
    frozen: !!params?.frozen,
  };
}

function getCloudRenderConfig(descriptor) {
  const layer = getLayerParams(descriptor, "clouds") || {};
  const cloudParams = descriptor?.clouds?.params || {};
  const bodyType = String(descriptor?.bodyType || "rocky");
  const defaults =
    bodyType === "gasGiant"
      ? {
          coverage: 0.24,
          macroScale: 3.2,
          detailScale: 24,
          warp: 0.16,
          edgeSoftness: 0.03,
          latitudeBands: 2.2,
          aniso: 0.18,
          selfShadow: 0.62,
        }
      : bodyType === "moon"
        ? {
            coverage: 0.18,
            macroScale: 3.6,
            detailScale: 20,
            warp: 0.14,
            edgeSoftness: 0.034,
            latitudeBands: 1.8,
            aniso: 0.14,
            selfShadow: 0.56,
          }
        : {
            coverage: 0.42,
            macroScale: 4.4,
            detailScale: 28,
            warp: 0.2,
            edgeSoftness: 0.03,
            latitudeBands: 3.1,
            aniso: 0.24,
            selfShadow: 0.68,
          };
  const cfg = { ...defaults, ...layer, ...cloudParams };
  const coverageFallback = clamp(Number(descriptor?.clouds?.opacity) || 0.2, 0.05, 0.9) * 1.15;
  return {
    coverage: clamp(Number(cfg.coverage) || coverageFallback, 0.02, 0.98),
    macroScale: clamp(Number(cfg.macroScale) || defaults.macroScale, 1.4, 9.5),
    detailScale: clamp(Number(cfg.detailScale) || defaults.detailScale, 8, 68),
    warp: clamp(Number(cfg.warp) || defaults.warp, 0.04, 0.5),
    edgeSoftness: clamp(Number(cfg.edgeSoftness) || defaults.edgeSoftness, 0.01, 0.1),
    latitudeBands: clamp(Number(cfg.latitudeBands) || defaults.latitudeBands, 0.8, 6.5),
    aniso: clamp(Number(cfg.aniso) || defaults.aniso, 0, 0.65),
    selfShadow: clamp(Number(cfg.selfShadow) || defaults.selfShadow, 0, 1),
  };
}

function shouldFlattenStyleMaps(descriptor) {
  if (!descriptor || typeof descriptor !== "object") return false;
  if (descriptor.flattenStyleMaps === false) return false;
  if (descriptor.flattenStyleMaps === true) return true;
  return descriptor.bodyType === "gasGiant";
}

function buildSphericalCoordCache(width, height) {
  const lon = new Float32Array(width);
  const cosLon = new Float32Array(width);
  const sinLon = new Float32Array(width);
  const lat = new Float32Array(height);
  const cosLat = new Float32Array(height);
  const sinLat = new Float32Array(height);

  for (let x = 0; x < width; x += 1) {
    const u = (x + 0.5) / Math.max(1, width);
    const v = (u - 0.5) * Math.PI * 2;
    lon[x] = v;
    cosLon[x] = Math.cos(v);
    sinLon[x] = Math.sin(v);
  }
  for (let y = 0; y < height; y += 1) {
    const v = (y + 0.5) / Math.max(1, height);
    const a = (0.5 - v) * Math.PI;
    lat[y] = a;
    cosLat[y] = Math.cos(a);
    sinLat[y] = Math.sin(a);
  }
  return { lon, cosLon, sinLon, lat, cosLat, sinLat };
}

function sampleWarpedNoise3(dirX, dirY, dirZ, scale, seedBase, warpAmp, octaves, lacunarity, gain) {
  const sx = dirX * scale;
  const sy = dirY * scale;
  const sz = dirZ * scale;
  const wx = fbm3Fast(sx * 0.9 + 13.7, sy * 0.9 - 5.1, sz * 0.9 + 3.3, seedBase + 11, 3, 2.1, 0.55);
  const wy = fbm3Fast(sx * 0.9 - 7.4, sy * 0.9 + 9.6, sz * 0.9 - 4.2, seedBase + 37, 3, 2.1, 0.55);
  const wz = fbm3Fast(sx * 0.9 + 2.5, sy * 0.9 + 6.8, sz * 0.9 - 9.3, seedBase + 71, 3, 2.1, 0.55);
  const px = sx + (wx * 2 - 1) * warpAmp;
  const py = sy + (wy * 2 - 1) * warpAmp;
  const pz = sz + (wz * 2 - 1) * warpAmp;
  return fbm3Fast(px, py, pz, seedBase + 101, octaves, lacunarity, gain);
}

function buildGasStormSeeds(descriptor, count) {
  const rng = createSeededRng(`${descriptor.seed}:gas-storms:${descriptor.lod}:${count}`);
  const storms = [];
  for (let i = 0; i < count; i += 1) {
    storms.push({
      lon: (rng() - 0.5) * Math.PI * 2,
      lat: (rng() - 0.5) * Math.PI * 0.9,
      radius: 0.1 + rng() * 0.22,
      strength: 0.26 + rng() * 0.78,
      swirl: (rng() - 0.5) * 0.95,
    });
  }
  return storms;
}

function getGasProceduralTuning(descriptor, detail) {
  const profileId = String(descriptor?.profileId || "").toLowerCase();
  const visual = descriptor?.gasVisual || {};
  const family = String(visual?.family || "").toLowerCase();
  const safeFamily =
    family === "solid" || family === "banded" || family === "patchy" || family === "hazy"
      ? family
      : "banded";

  const tuning = {
    warpScale: 3.2,
    turbulenceScale: 8.6 + detail * 1.8,
    shearScale: 4.9,
    latBandFreq: 24 + detail * 12,
    fineBandFreq: 48 + detail * 20,
    flowLatWeight: 0.62,
    flowFineWeight: 0.2,
    flowTurbWeight: 0.18,
    reliefFlowWeight: 0.5,
    reliefStormWeight: 0.16,
    reliefWarpWeight: 0.12,
    stormWeight: 1,
    stormCountScale: 1,
    bandContrastScale: 1,
    stormLiftScale: 1,
    stormWarmScale: 1,
    polarHazeScale: 1,
    tintR: 0,
    tintG: 0,
    tintB: 0,
  };

  if (safeFamily === "solid") {
    tuning.turbulenceScale = 5.9 + detail * 1.2;
    tuning.latBandFreq = 12 + detail * 4;
    tuning.fineBandFreq = 24 + detail * 8;
    tuning.flowLatWeight = 0.16;
    tuning.flowFineWeight = 0.06;
    tuning.flowTurbWeight = 0.78;
    tuning.stormWeight = 0.2;
    tuning.stormCountScale = 0.4;
    tuning.bandContrastScale = 0.22;
    tuning.stormLiftScale = 0.24;
    tuning.stormWarmScale = 0.1;
    tuning.polarHazeScale = 1.4;
    tuning.tintR = -0.01;
    tuning.tintG = 0.03;
    tuning.tintB = 0.06;
  } else if (safeFamily === "patchy") {
    tuning.turbulenceScale = 10.9 + detail * 2.4;
    tuning.latBandFreq = 18 + detail * 8;
    tuning.fineBandFreq = 34 + detail * 13;
    tuning.flowLatWeight = 0.42;
    tuning.flowFineWeight = 0.16;
    tuning.flowTurbWeight = 0.42;
    tuning.stormWeight = 1.34;
    tuning.stormCountScale = 1.28;
    tuning.bandContrastScale = 0.72;
    tuning.stormLiftScale = 1.04;
    tuning.stormWarmScale = 0.24;
    tuning.polarHazeScale = 1.12;
    tuning.tintR = -0.02;
    tuning.tintG = 0.01;
    tuning.tintB = 0.05;
  } else if (safeFamily === "hazy") {
    tuning.turbulenceScale = 6.9 + detail * 1.6;
    tuning.latBandFreq = 14 + detail * 6;
    tuning.fineBandFreq = 28 + detail * 10;
    tuning.flowLatWeight = 0.24;
    tuning.flowFineWeight = 0.1;
    tuning.flowTurbWeight = 0.66;
    tuning.stormWeight = 0.34;
    tuning.stormCountScale = 0.54;
    tuning.bandContrastScale = 0.32;
    tuning.stormLiftScale = 0.4;
    tuning.stormWarmScale = 0.34;
    tuning.polarHazeScale = 1.42;
    tuning.tintR = 0.03;
    tuning.tintG = 0.02;
    tuning.tintB = -0.01;
  }

  if (profileId.includes("saturn")) {
    tuning.flowLatWeight = 0.74;
    tuning.flowFineWeight = 0.16;
    tuning.flowTurbWeight = 0.1;
    tuning.stormWeight *= 0.7;
    tuning.stormCountScale *= 0.72;
    tuning.bandContrastScale *= 0.74;
    tuning.stormLiftScale *= 0.56;
    tuning.stormWarmScale *= 0.48;
    tuning.tintR += 0.01;
    tuning.tintG += 0.01;
    tuning.tintB += 0.02;
  } else if (profileId.includes("neptune")) {
    tuning.stormWeight *= 1.18;
    tuning.stormCountScale *= 1.16;
    tuning.bandContrastScale *= 0.92;
    tuning.polarHazeScale *= 1.08;
    tuning.tintB += 0.03;
  } else if (
    profileId.includes("hot-jupiter") ||
    profileId.includes("alkali") ||
    profileId.includes("silicate")
  ) {
    tuning.stormWeight *= 1.22;
    tuning.stormCountScale *= 1.18;
    tuning.bandContrastScale *= 1.08;
    tuning.stormWarmScale *= 1.32;
    tuning.tintR += 0.06;
    tuning.tintG += 0.02;
    tuning.tintB -= 0.02;
  } else if (profileId.includes("jupiter") || profileId.includes("super-jupiter")) {
    tuning.stormWeight *= 1.08;
    tuning.stormCountScale *= 1.06;
    tuning.bandContrastScale *= 1.06;
    tuning.stormWarmScale *= 1.04;
  }

  const bandContrast = clamp(Number(visual?.bandContrast) || 0.58, 0.05, 1.4);
  const turbulence = clamp(Number(visual?.turbulence) || 0.34, 0.08, 0.95);
  const shearStrength = clamp(Number(visual?.shearStrength) || 0.24, 0.05, 0.9);
  const stormCoupling = clamp(Number(visual?.stormCoupling) || 0.56, 0.08, 1);
  const patchiness = clamp(Number(visual?.patchiness) || 0.24, 0, 1);
  const polarHaze = clamp(Number(visual?.polarHaze) || 0.18, 0, 1);
  const hazeStrength = clamp(Number(visual?.hazeStrength) || 0.1, 0, 1);

  tuning.bandContrastScale = clamp(
    tuning.bandContrastScale * (0.35 + bandContrast * 1.05),
    0.08,
    1.8,
  );
  tuning.turbulenceScale = clamp(tuning.turbulenceScale * (0.65 + turbulence * 0.9), 3.8, 20);
  tuning.shearScale = clamp(tuning.shearScale * (0.65 + shearStrength * 1.1), 2.2, 9.8);
  tuning.stormWeight = clamp(tuning.stormWeight * (0.6 + stormCoupling * 0.8), 0.1, 2.2);
  tuning.stormCountScale = clamp(tuning.stormCountScale * (0.7 + patchiness * 0.9), 0.3, 2.4);
  tuning.polarHazeScale = clamp(
    tuning.polarHazeScale * (0.5 + polarHaze * 1.1 + hazeStrength * 0.4),
    0.4,
    2.2,
  );

  return tuning;
}

function buildProceduralSurfaceFields(descriptor, width, height) {
  const count = width * height;
  const relief = new Uint8Array(count);
  const oceanMask = new Uint8Array(count);
  const oceanDepth = new Uint8Array(count);
  const flow = new Uint8Array(count);
  const storm = new Uint8Array(count);
  const sampleStep = 1;
  const sampleWidth = Math.max(1, Math.ceil(width / sampleStep));
  const sampleHeight = Math.max(1, Math.ceil(height / sampleStep));
  const sampleCount = sampleWidth * sampleHeight;
  const sampleRelief = new Float32Array(sampleCount);
  const sampleOceanMask = new Float32Array(sampleCount);
  const sampleOceanDepth = new Float32Array(sampleCount);
  const sampleFlow = new Float32Array(sampleCount);
  const sampleStorm = new Float32Array(sampleCount);
  const coord = buildSphericalCoordCache(sampleWidth, sampleHeight);
  const detail = clamp(Number(descriptor?.detail) || 1, 0.25, 2);
  const sea = getOceanLayerConfig(descriptor);
  const hasLiquidOcean = sea.coverage > 0.01 && !sea.frozen;
  const oceanThreshold = clamp(0.62 - sea.coverage * 0.48, 0.14, 0.72);
  const craterParams = getLayerParams(descriptor, "craters");
  const craterCount = Math.max(0, Number(craterParams?.count) || 0);
  const craterStrength = clamp(craterCount / 64, 0, descriptor.bodyType === "moon" ? 0.52 : 0.26);
  const seedBase = Math.floor(
    hashUnit(`${descriptor.seed}:${descriptor.profileId || "default"}:${descriptor.lod}`) * 100000,
  );
  const gasTuning =
    descriptor.bodyType === "gasGiant" ? getGasProceduralTuning(descriptor, detail) : null;
  const gasStormCount =
    descriptor.bodyType === "gasGiant"
      ? clamp(Math.round((2 + detail * 6) * gasTuning.stormCountScale), 1, 18)
      : 0;
  const gasStorms =
    descriptor.bodyType === "gasGiant" ? buildGasStormSeeds(descriptor, gasStormCount) : [];

  let sampleIdx = 0;
  for (let y = 0; y < sampleHeight; y += 1) {
    const cy = coord.cosLat[y];
    const sy = coord.sinLat[y];
    const lat = coord.lat[y];
    for (let x = 0; x < sampleWidth; x += 1) {
      const dirX = cy * coord.cosLon[x];
      const dirY = sy;
      const dirZ = cy * coord.sinLon[x];
      const lon = coord.lon[x];

      if (descriptor.bodyType === "gasGiant") {
        const warp = sampleWarpedNoise3(
          dirX,
          dirY,
          dirZ,
          gasTuning.warpScale,
          seedBase + 410,
          0.32,
          4,
          2.1,
          0.53,
        );
        const turbulence = sampleWarpedNoise3(
          dirX,
          dirY,
          dirZ,
          gasTuning.turbulenceScale,
          seedBase + 480,
          0.24,
          3,
          2.08,
          0.52,
        );
        const shear =
          (sampleWarpedNoise3(
            dirX,
            dirY,
            dirZ,
            gasTuning.shearScale,
            seedBase + 540,
            0.25,
            3,
            2.07,
            0.55,
          ) -
            0.5) *
          1.45;
        const latBands =
          Math.sin(lat * gasTuning.latBandFreq + shear * 2.8 + (seedBase % 157) * 0.01) * 0.5 + 0.5;
        const fineBands =
          Math.sin(lat * gasTuning.fineBandFreq + warp * 5.2 + (seedBase % 211) * 0.013) * 0.5 +
          0.5;

        let stormMask = 0;
        for (const gasStorm of gasStorms) {
          const dLon =
            sphericalWrapLonDelta(lon, gasStorm.lon) *
            Math.max(0.25, Math.cos((lat + gasStorm.lat) * 0.5));
          const dLat = lat - gasStorm.lat;
          const dist = Math.hypot(dLon, dLat);
          if (dist > gasStorm.radius * 2) continue;
          const influence = Math.exp(-(dist * dist) / (2 * gasStorm.radius * gasStorm.radius));
          const swirlWave = 0.5 + 0.5 * Math.sin((dLon * 9 + dLat * 7) * gasStorm.swirl);
          stormMask += influence * gasStorm.strength * (0.74 + swirlWave * 0.52);
        }
        stormMask = clamp(stormMask * gasTuning.stormWeight, 0, 1);
        const flowN = clamp(
          gasTuning.flowLatWeight * latBands +
            gasTuning.flowFineWeight * fineBands +
            gasTuning.flowTurbWeight * turbulence,
          0,
          1,
        );
        const reliefN = clamp(
          0.34 +
            flowN * gasTuning.reliefFlowWeight +
            stormMask * gasTuning.reliefStormWeight +
            (warp - 0.5) * gasTuning.reliefWarpWeight,
          0,
          1,
        );

        sampleRelief[sampleIdx] = reliefN;
        sampleFlow[sampleIdx] = flowN;
        sampleStorm[sampleIdx] = stormMask;
      } else {
        const macro = sampleWarpedNoise3(
          dirX,
          dirY,
          dirZ,
          0.95,
          seedBase + 40,
          0.34,
          4,
          2.07,
          0.56,
        );
        const ridged = ridgedFbm3Fast(
          dirX * 1.25,
          dirY * 1.25,
          dirZ * 1.25,
          seedBase + 71,
          4,
          2.08,
          0.53,
        );
        const meso = sampleWarpedNoise3(
          dirX,
          dirY,
          dirZ,
          4.2 + detail * 0.8,
          seedBase + 130,
          0.22,
          4,
          2.1,
          0.53,
        );
        const micro = sampleWarpedNoise3(
          dirX,
          dirY,
          dirZ,
          24 + detail * 12,
          seedBase + 210,
          0.14,
          3,
          2.0,
          0.5,
        );
        let reliefN = clamp(
          0.7 * (macro * 0.62 + ridged * 0.38) + 0.25 * meso + 0.05 * micro,
          0,
          1,
        );

        if (craterStrength > 0.001) {
          const craterField = ridgedFbm3Fast(
            dirX * (12 + detail * 4),
            dirY * (12 + detail * 4),
            dirZ * (12 + detail * 4),
            seedBase + 280,
            3,
            2.2,
            0.57,
          );
          const craterDepression = Math.pow(clamp(craterField, 0, 1), 4) * craterStrength;
          reliefN = clamp(reliefN - craterDepression * 0.5, 0, 1);
        }

        sampleRelief[sampleIdx] = reliefN;
        sampleFlow[sampleIdx] = micro;
        if (hasLiquidOcean && reliefN < oceanThreshold) {
          sampleOceanMask[sampleIdx] = 1;
          const depth = clamp((oceanThreshold - reliefN) / Math.max(0.02, oceanThreshold), 0, 1);
          sampleOceanDepth[sampleIdx] = depth;
        }
      }
      sampleIdx += 1;
    }
  }

  let idx = 0;
  for (let y = 0; y < height; y += 1) {
    const sy = Math.min(sampleHeight - 1, Math.floor(y / sampleStep));
    const row = sy * sampleWidth;
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(sampleWidth - 1, Math.floor(x / sampleStep));
      const sidx = row + sx;
      relief[idx] = Math.round(clamp(sampleRelief[sidx], 0, 1) * 255);
      flow[idx] = Math.round(clamp(sampleFlow[sidx], 0, 1) * 255);
      storm[idx] = Math.round(clamp(sampleStorm[sidx], 0, 1) * 255);
      oceanMask[idx] = sampleOceanMask[sidx] > 0.5 ? 255 : 0;
      oceanDepth[idx] = Math.round(clamp(sampleOceanDepth[sidx], 0, 1) * 255);
      idx += 1;
    }
  }

  return {
    width,
    height,
    relief,
    oceanMask,
    oceanDepth,
    flow,
    storm,
  };
}

function applyProceduralSurfaceDetail(surfaceCanvas, descriptor, fields) {
  if (!surfaceCanvas || !fields) return;
  const ctx = surfaceCanvas.getContext("2d");
  if (!ctx) return;
  const width = surfaceCanvas.width;
  const height = surfaceCanvas.height;
  if (!(width > 0) || !(height > 0)) return;
  const src = ctx.getImageData(0, 0, width, height);
  const data = src.data;
  const count = width * height;
  const detail = clamp(Number(descriptor?.detail) || 1, 0.25, 2);
  const gasTuning =
    descriptor?.bodyType === "gasGiant" ? getGasProceduralTuning(descriptor, detail) : null;

  for (let i = 0; i < count; i += 1) {
    const di = i * 4;
    let r = data[di] / 255;
    let g = data[di + 1] / 255;
    let b = data[di + 2] / 255;
    const relief = fields.relief[i] / 255;
    const flow = fields.flow[i] / 255;
    const storm = fields.storm[i] / 255;
    const ocean = fields.oceanMask[i] > 0;

    if (descriptor.bodyType === "gasGiant") {
      const bandContrast = (flow - 0.5) * 0.3 * gasTuning.bandContrastScale;
      const stormLift = storm * 0.16 * gasTuning.stormLiftScale;
      const stormWarm = storm * 0.34 * gasTuning.stormWarmScale;
      const polarY = Math.floor(i / width);
      const latAbs = Math.abs(((polarY + 0.5) / height) * 2 - 1);
      const polarHaze = smoothstep(0.66, 0.98, latAbs) * 0.18 * gasTuning.polarHazeScale;

      r = clamp(r + bandContrast * 0.75 + stormLift * 0.5, 0, 1);
      g = clamp(g + bandContrast * 0.62 + stormLift * 0.46, 0, 1);
      b = clamp(b + bandContrast * 0.45 + stormLift * 0.35, 0, 1);

      r = clamp(lerp(r, r * 1.15 + 0.05, stormWarm), 0, 1);
      g = clamp(lerp(g, g * 1.06 + 0.02, stormWarm * 0.85), 0, 1);
      b = clamp(lerp(b, b * 0.9, stormWarm * 0.75), 0, 1);

      r = clamp(lerp(r, 0.88, polarHaze), 0, 1);
      g = clamp(lerp(g, 0.9, polarHaze), 0, 1);
      b = clamp(lerp(b, 0.95, polarHaze * 1.2), 0, 1);
      const tintBlend = 0.4 + storm * 0.35 + polarHaze * 0.35;
      r = clamp(r + gasTuning.tintR * tintBlend, 0, 1);
      g = clamp(g + gasTuning.tintG * tintBlend, 0, 1);
      b = clamp(b + gasTuning.tintB * tintBlend, 0, 1);
    } else if (ocean) {
      const depth = fields.oceanDepth[i] / 255;
      const depthMix = clamp(0.22 + depth * 0.52, 0, 0.74);
      r = clamp(lerp(r, r * 0.58, depthMix), 0, 1);
      g = clamp(lerp(g, g * 0.7, depthMix), 0, 1);
      b = clamp(lerp(b, b * 0.86, depthMix * 0.75), 0, 1);
    } else {
      const reliefContrast = (relief - 0.5) * 0.24;
      const grain = (flow - 0.5) * 0.08;
      r = clamp(r + reliefContrast * 0.78 + grain, 0, 1);
      g = clamp(g + reliefContrast * 0.7 + grain * 0.85, 0, 1);
      b = clamp(b + reliefContrast * 0.6 + grain * 0.7, 0, 1);
    }

    data[di] = Math.round(clamp(r, 0, 1) * 255);
    data[di + 1] = Math.round(clamp(g, 0, 1) * 255);
    data[di + 2] = Math.round(clamp(b, 0, 1) * 255);
  }

  ctx.putImageData(src, 0, 0);
}

function buildSurfaceAuxiliaryCanvases(surfaceCanvas, descriptor, fields = null) {
  const width = surfaceCanvas?.width || 0;
  const height = surfaceCanvas?.height || 0;
  if (!(width > 0) || !(height > 0)) return null;

  const srcCtx = getCanvas2dContext(surfaceCanvas, { readback: true });
  if (!srcCtx) return null;
  const src = srcCtx.getImageData(0, 0, width, height);
  const srcData = src.data;
  const count = width * height;

  const normalCanvas = document.createElement("canvas");
  normalCanvas.width = width;
  normalCanvas.height = height;
  const normalCtx = getCanvas2dContext(normalCanvas, { readback: true });

  const roughnessCanvas = document.createElement("canvas");
  roughnessCanvas.width = width;
  roughnessCanvas.height = height;
  const roughnessCtx = getCanvas2dContext(roughnessCanvas, { readback: true });

  const emissiveCanvas = document.createElement("canvas");
  emissiveCanvas.width = width;
  emissiveCanvas.height = height;
  const emissiveCtx = getCanvas2dContext(emissiveCanvas, { readback: true });

  if (!normalCtx || !roughnessCtx || !emissiveCtx) return null;

  const proceduralFields = fields || buildProceduralSurfaceFields(descriptor, width, height);
  const gray = proceduralFields.relief;
  const roughData = roughnessCtx.createImageData(width, height);
  const emissiveData = emissiveCtx.createImageData(width, height);
  const warmEmissive =
    hasLayer(descriptor, "molten-fissures") ||
    hasLayer(descriptor, "volcanic-system") ||
    descriptor.profileId === "lava-world" ||
    descriptor.profileId === "molten-companion" ||
    descriptor.profileId === "io";
  const coolEmissive =
    hasLayer(descriptor, "plume-haze") ||
    hasLayer(descriptor, "fractures") ||
    descriptor.profileId === "europa" ||
    descriptor.profileId === "enceladus" ||
    descriptor.profileId === "triton";
  const hasLiquidOcean = proceduralFields.oceanMask.some((v) => v > 0);
  const baseRough =
    descriptor.bodyType === "gasGiant" ? 0.46 : descriptor.bodyType === "moon" ? 0.8 : 0.7;
  const bumpScale =
    descriptor.bodyType === "gasGiant" ? 0.72 : descriptor.bodyType === "moon" ? 1.36 : 1.08;

  for (let i = 0; i < count; i += 1) {
    const si = i * 4;
    const r = srcData[si] / 255;
    const g = srcData[si + 1] / 255;
    const b = srcData[si + 2] / 255;
    const lum = clamp(0.2126 * r + 0.7152 * g + 0.0722 * b, 0, 1);
    const h = gray[i] / 255;
    const flowN = proceduralFields.flow[i] / 255;
    const stormN = proceduralFields.storm[i] / 255;
    const oceanDepthN = proceduralFields.oceanDepth[i] / 255;
    const py = Math.floor(i / width);
    const latAbs = Math.abs(((py + 0.5) / height) * 2 - 1);

    const blueDominant = b > r * 1.06 && b > g * 1.03;
    const warmDominant = r > g * 1.1 && g > b * 0.9;
    const cyanDominant = b > r * 1.02 && g > r * 1.01;
    const brightCloud = lum > 0.78 && Math.abs(r - g) < 0.1 && Math.abs(g - b) < 0.1;

    let rough = baseRough + (0.5 - h) * 0.14 + (0.5 - flowN) * 0.08;
    if (descriptor.bodyType === "gasGiant") {
      rough = 0.32 + Math.abs(flowN - 0.5) * 0.22 + stormN * 0.16 + (0.5 - lum) * 0.04;
    } else if (proceduralFields.oceanMask[i] > 0 && hasLiquidOcean && blueDominant) {
      const windBand = 0.5 + 0.5 * Math.sin(latAbs * 7.4 + flowN * 6.2);
      rough = 0.02 + oceanDepthN * 0.05 + windBand * 0.03;
    }
    if (brightCloud) rough += 0.1;
    if (warmEmissive && warmDominant) rough -= 0.2;
    rough = clamp(rough, 0.03, 0.98);
    const rv = Math.round(rough * 255);
    roughData.data[si] = rv;
    roughData.data[si + 1] = rv;
    roughData.data[si + 2] = rv;
    roughData.data[si + 3] = 255;

    let emissive = 0;
    if (warmEmissive && warmDominant && lum > 0.34) {
      emissive = Math.max(emissive, 0.18 + (r - b) * 0.5 + lum * 0.28);
    }
    if (coolEmissive && cyanDominant && lum > 0.3) {
      emissive = Math.max(emissive, 0.14 + (b - r) * 0.42 + lum * 0.2);
    }
    emissive = clamp(emissive, 0, 1);
    emissiveData.data[si] = Math.round(srcData[si] * emissive * (warmDominant ? 1.08 : 0.8));
    emissiveData.data[si + 1] = Math.round(srcData[si + 1] * emissive * 1.05);
    emissiveData.data[si + 2] = Math.round(
      srcData[si + 2] * emissive * (cyanDominant ? 1.15 : 0.9),
    );
    emissiveData.data[si + 3] = Math.round(255 * clamp(emissive * 0.95, 0, 1));
  }
  roughnessCtx.putImageData(roughData, 0, 0);
  emissiveCtx.putImageData(emissiveData, 0, 0);

  const normalData = normalCtx.createImageData(width, height);
  const idxAt = (x, y) => {
    const nx = ((x % width) + width) % width;
    const ny = y < 0 ? 0 : y >= height ? height - 1 : y;
    return ny * width + nx;
  };
  for (let y = 0; y < height; y += 1) {
    const lat = (0.5 - (y + 0.5) / height) * Math.PI;
    const lonScale = 1 / Math.max(0.3, Math.cos(lat));
    for (let x = 0; x < width; x += 1) {
      const tl = gray[idxAt(x - 1, y - 1)];
      const tc = gray[idxAt(x, y - 1)];
      const tr = gray[idxAt(x + 1, y - 1)];
      const ml = gray[idxAt(x - 1, y)];
      const mr = gray[idxAt(x + 1, y)];
      const bl = gray[idxAt(x - 1, y + 1)];
      const bc = gray[idxAt(x, y + 1)];
      const br = gray[idxAt(x + 1, y + 1)];

      const sx = -tl - 2 * ml - bl + tr + 2 * mr + br;
      const sy = -tl - 2 * tc - tr + bl + 2 * bc + br;
      let nx = (-sx / 255) * bumpScale * lonScale * 0.6;
      let ny = (-sy / 255) * bumpScale;
      let nz = 1;
      const invLen = 1 / Math.hypot(nx, ny, nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;
      const di = (y * width + x) * 4;
      normalData.data[di] = Math.round((nx * 0.5 + 0.5) * 255);
      normalData.data[di + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      normalData.data[di + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      normalData.data[di + 3] = 255;
    }
  }
  normalCtx.putImageData(normalData, 0, 0);

  return {
    normal: normalCanvas,
    roughness: roughnessCanvas,
    emissive: emissiveCanvas,
  };
}

function paintCloudTexture(ctx, size, descriptor) {
  ctx.clearRect(0, 0, size, size);
  if (!descriptor?.clouds?.enabled) return;
  const colour = descriptor.clouds.colour || "#ffffff";
  const cloudRgb = hexToRgb(colour);
  const alphaBase = clamp(Number(descriptor.clouds.opacity) || 0.2, 0.05, 0.9);
  const detail = clamp(Number(descriptor.detail) || 1, 0.25, 2);
  const isGas = descriptor.bodyType === "gasGiant";
  const isMoon = descriptor.bodyType === "moon";
  const isRocky = descriptor.bodyType === "rocky";
  const cfg = getCloudRenderConfig(descriptor);
  const seedBase = Math.floor(
    hashUnit(`${descriptor.seed}:cloud-shell:${descriptor.lod}`) * 100000,
  );
  const sampleStep = 1;
  const sampleWidth = Math.max(1, Math.ceil(size / sampleStep));
  const sampleHeight = Math.max(1, Math.ceil(size / sampleStep));
  const coord = buildSphericalCoordCache(sampleWidth, sampleHeight);
  const sampleCount = sampleWidth * sampleHeight;
  const coverage = new Float32Array(sampleCount);
  const thickness = new Float32Array(sampleCount);
  const alpha = new Float32Array(sampleCount);
  const wispy = new Float32Array(sampleCount);

  const macroScale = cfg.macroScale * (0.92 + detail * 0.18);
  const clusterScale = macroScale * (isRocky ? 1.8 : isMoon ? 1.55 : 1.42);
  const detailScale = cfg.detailScale * (0.88 + detail * 0.24);
  const breakupScale = macroScale * (isRocky ? 3.3 : isMoon ? 2.9 : 2.5);
  const thresholdBase = clamp(1 - cfg.coverage * 0.86, 0.12, 0.94);

  let idx = 0;
  for (let y = 0; y < sampleHeight; y += 1) {
    const cy = coord.cosLat[y];
    const sy = coord.sinLat[y];
    const lat = coord.lat[y];
    for (let x = 0; x < sampleWidth; x += 1) {
      const dirX = cy * coord.cosLon[x];
      const dirY = sy;
      const dirZ = cy * coord.sinLon[x];
      const lon = coord.lon[x];
      const aniso = cfg.aniso;
      const ax = dirX * (1 + aniso * 0.9);
      const ay = dirY;
      const az = dirZ * Math.max(0.18, 1 - aniso * 0.5);
      const invLen = 1 / Math.hypot(ax, ay, az);
      const sx = ax * invLen;
      const syy = ay * invLen;
      const sz = az * invLen;

      const coverageMacro = sampleWarpedNoise3(
        sx,
        syy,
        sz,
        macroScale,
        seedBase + 100,
        cfg.warp,
        4,
        2.1,
        0.54,
      );
      const coverageCluster = sampleWarpedNoise3(
        sx,
        syy,
        sz,
        clusterScale,
        seedBase + 170,
        cfg.warp * 0.82,
        3,
        2.08,
        0.53,
      );
      const cloudDetail = sampleWarpedNoise3(
        sx,
        syy,
        sz,
        detailScale + detail * 5,
        seedBase + 230,
        cfg.warp * 0.55,
        3,
        2.02,
        0.5,
      );
      const breakupNoise = sampleWarpedNoise3(
        sx,
        syy,
        sz,
        breakupScale + detail * 2.2,
        seedBase + 260,
        cfg.warp * 0.88,
        4,
        2.08,
        0.52,
      );
      const wispNoise = sampleWarpedNoise3(
        sx,
        syy,
        sz,
        detailScale * 1.66 + detail * 7,
        seedBase + 340,
        cfg.warp * 0.42,
        2,
        2.15,
        0.48,
      );
      let wispyMask = 1;
      if (isRocky) {
        const filamentRidged = ridgedFbm3Fast(
          sx * (detailScale * 0.5),
          syy * (detailScale * 0.2),
          sz * (detailScale * 0.5),
          seedBase + 390,
          4,
          2.14,
          0.52,
        );
        const filamentWarp = sampleWarpedNoise3(
          sx,
          syy,
          sz,
          detailScale * 0.95,
          seedBase + 430,
          cfg.warp * 0.6,
          3,
          2.08,
          0.52,
        );
        const filamentWave =
          Math.sin(
            (lon + (filamentWarp - 0.5) * 0.95) * (22 + detail * 9) + lat * (8.5 + detail * 2.8),
          ) *
            0.5 +
          0.5;
        const filament = clamp(0.58 * filamentRidged + 0.42 * filamentWave, 0, 1);
        wispyMask = smoothstep(0.56, 0.9, filament);
      }

      let coverNoise =
        0.42 * coverageMacro + 0.34 * coverageCluster + 0.16 * cloudDetail + 0.08 * breakupNoise;
      const latBandWeight =
        0.72 +
        0.28 *
          (0.5 +
            0.5 *
              Math.cos(
                lat * clamp(cfg.latitudeBands * (isGas ? 1.4 : 2.2), 0.6, 13) +
                  coverageCluster * 1.8,
              ));
      const longStreak =
        0.5 +
        0.5 *
          Math.sin(
            lon * (isRocky ? 2.6 + cfg.aniso * 2.8 : 2 + cfg.aniso * 2.2) +
              lat * cfg.latitudeBands * (isRocky ? 2.1 : 1.2) +
              (coverageCluster - 0.5) * 3.2,
          );
      coverNoise = clamp(coverNoise * (0.76 + latBandWeight * 0.24) + longStreak * 0.08, 0, 1);
      if (isGas) {
        const latBand =
          Math.sin(lat * (20 + detail * 10) + lon * 0.5 + coverageCluster * 5.5) * 0.5 + 0.5;
        coverNoise = coverNoise * 0.72 + latBand * 0.28;
      }
      const coverBase = smoothstep(
        thresholdBase - cfg.edgeSoftness,
        thresholdBase + cfg.edgeSoftness,
        coverNoise,
      );
      const breakupMask = smoothstep(
        isGas ? 0.36 : 0.42,
        isGas ? 0.86 : 0.88,
        breakupNoise * 0.7 + cloudDetail * 0.3,
      );
      const erosionBase = (1 - breakupMask) * (isGas ? 0.1 : isMoon ? 0.18 : 0.24);
      const erosion = clamp(erosionBase + (isRocky ? (1 - wispyMask) * 0.2 : 0), 0, 0.52);
      const cover = clamp(coverBase - erosion, 0, 1);
      const rockyWispyBoost = isRocky ? 0.62 + wispyMask * 0.58 : 1;
      const thick = clamp(
        cover *
          (0.35 +
            0.65 *
              sampleWarpedNoise3(
                dirX,
                dirY,
                dirZ,
                clusterScale * 1.6,
                seedBase + 300,
                0.16,
                3,
                2.06,
                0.52,
              ) *
              (0.82 + wispNoise * 0.32) *
              rockyWispyBoost),
        0,
        1,
      );
      const edgeDetail = clamp(
        0.38 + 0.62 * (cloudDetail * 0.4 + wispNoise * 0.4 + (isRocky ? wispyMask * 0.2 : 0)),
        0,
        1,
      );
      const tradeStretch = isMoon ? 0.92 : 1 - Math.abs(sy) * (isGas ? 0.06 : 0.1);
      const rockyWeight = isRocky ? 0.76 + wispyMask * 0.34 : 1;
      const latFade = clamp(0.76 + latBandWeight * 0.34, 0.56, 1.16);

      coverage[idx] = cover;
      thickness[idx] = thick;
      wispy[idx] = wispyMask;
      alpha[idx] = clamp(
        cover * edgeDetail * tradeStretch * rockyWeight * latFade * alphaBase,
        0,
        1,
      );
      idx += 1;
    }
  }

  const lightDx = Math.max(1, Math.round(sampleWidth * 0.0065));
  const lightDy = Math.max(1, Math.round(sampleHeight * 0.0045));
  const fieldAt = (field, fx, fy) => {
    const y0 = fy < 0 ? 0 : fy >= sampleHeight - 1 ? sampleHeight - 1 : Math.floor(fy);
    const y1 = Math.min(sampleHeight - 1, y0 + 1);
    const ty = clamp(fy - y0, 0, 1);
    const xBase = Math.floor(fx);
    const tx = clamp(fx - xBase, 0, 1);
    const x0 = ((xBase % sampleWidth) + sampleWidth) % sampleWidth;
    const x1 = (x0 + 1) % sampleWidth;
    const i00 = y0 * sampleWidth + x0;
    const i10 = y0 * sampleWidth + x1;
    const i01 = y1 * sampleWidth + x0;
    const i11 = y1 * sampleWidth + x1;
    const top = field[i00] + (field[i10] - field[i00]) * tx;
    const bottom = field[i01] + (field[i11] - field[i01]) * tx;
    return top + (bottom - top) * ty;
  };

  const image = ctx.createImageData(size, size);
  const data = image.data;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const fx = (x + 0.5) / sampleStep - 0.5;
      const fy = (y + 0.5) / sampleStep - 0.5;
      const cover = fieldAt(coverage, fx, fy);
      const alphaN = fieldAt(alpha, fx, fy);
      if (!(cover > 0.001 && alphaN > 0.001)) {
        continue;
      }
      const thick = fieldAt(thickness, fx, fy);
      const wispyN = fieldAt(wispy, fx, fy);
      const sh1 = fieldAt(thickness, fx + lightDx, fy - lightDy);
      const sh2 = fieldAt(thickness, fx + lightDx * 2, fy - lightDy * 2);
      const sh3 = fieldAt(thickness, fx + lightDx * 3, fy - lightDy * 3);
      const shadowRaw = clamp(sh1 * 0.48 + sh2 * 0.33 + sh3 * 0.19 - thick * 0.26, 0, 1);
      const shadow = shadowRaw * cfg.selfShadow;
      const lightEdge = clamp(thick - shadow * 0.9, 0, 1);
      const edgeLift = clamp((1 - cover) * 0.35 + lightEdge * 0.4 + wispyN * 0.1, 0, 1);
      const shade = clamp(
        0.64 + lightEdge * 0.35 + edgeLift * 0.12 + wispyN * 0.08 - shadow * 0.28,
        0.3,
        1.12,
      );
      const di = (y * size + x) * 4;
      data[di] = Math.round(clamp((cloudRgb.r / 255) * shade, 0, 1) * 255);
      data[di + 1] = Math.round(clamp((cloudRgb.g / 255) * shade, 0, 1) * 255);
      data[di + 2] = Math.round(clamp((cloudRgb.b / 255) * shade, 0, 1) * 255);
      const wispyAlpha = isRocky ? 0.52 + wispyN * 0.48 : 1;
      data[di + 3] = Math.round(
        clamp(alphaN * (0.5 + thick * 0.3 + edgeLift * 0.16) * wispyAlpha, 0, 1) * 255,
      );
    }
  }
  ctx.putImageData(image, 0, 0);
}

async function initBodyRuntime(canvas, { preserveDrawingBuffer = false } = {}) {
  const THREE = await loadThreeCore();
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer,
  });
  renderer.setPixelRatio(1);
  if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
  if (typeof THREE.ACESFilmicToneMapping !== "undefined") {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
  }
  renderer.toneMappingExposure = 1.02;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0, 3.5);

  const root = new THREE.Group();
  scene.add(root);

  const bodyGeom = new THREE.SphereGeometry(1, 112, 84);
  const bodyMat = previewPbrMaterial(THREE);
  const body = new THREE.Mesh(bodyGeom, bodyMat);
  body.renderOrder = 0;
  root.add(body);

  const cloudGeom = new THREE.SphereGeometry(1.03, 90, 64);
  const cloudMat = new THREE.MeshStandardMaterial({
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    depthTest: true,
    alphaTest: 0.005,
    premultipliedAlpha: false,
    roughness: 0.9,
    metalness: 0,
    color: 0xffffff,
    side: THREE.FrontSide,
  });
  const clouds = new THREE.Mesh(cloudGeom, cloudMat);
  clouds.renderOrder = 2;
  clouds.visible = false;
  root.add(clouds);

  const hazeGeom = new THREE.SphereGeometry(1.08, 90, 64);
  const hazeMat = createAtmosphereMaterial(THREE);
  const haze = new THREE.Mesh(hazeGeom, hazeMat);
  haze.renderOrder = 3;
  haze.visible = false;
  root.add(haze);

  const fill = new THREE.HemisphereLight(0xffffff, 0x091124, 0.8);
  scene.add(fill);
  const key = new THREE.DirectionalLight(0xffffff, 1.02);
  key.position.set(-3, 2, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8eb7ff, 0.28);
  rim.position.set(2.1, -1.2, -2.8);
  scene.add(rim);

  renderer.render(scene, camera);

  return {
    THREE,
    renderer,
    scene,
    camera,
    root,
    body,
    clouds,
    haze,
    ring: null,
    ringMat: null,
    cloudMat,
    hazeMat,
    keyLight: key,
    rimLight: rim,
    fillLight: fill,
    surfaceTexture: null,
    cloudTexture: null,
    normalTexture: null,
    roughnessTexture: null,
    emissiveTexture: null,
    descriptorSignature: "",
    descriptor: null,
    rotationOffset: 0,
    disposed: false,
    pendingTextureSignature: "",
    pendingTextureRequestId: 0,
  };
}

function disposeRingMesh(runtime) {
  if (!runtime?.ring) {
    runtime.ring = null;
    runtime.ringMat = null;
    return;
  }
  try {
    runtime.root?.remove?.(runtime.ring);
  } catch {}
  try {
    runtime.ring.geometry?.dispose?.();
  } catch {}
  try {
    if (Array.isArray(runtime.ring.material)) {
      for (const mat of runtime.ring.material) mat?.dispose?.();
    } else {
      runtime.ring.material?.dispose?.();
    }
  } catch {}
  runtime.ring = null;
  runtime.ringMat = null;
}

let _ringAlphaMap = null;

function ringAlphaMap(THREE) {
  if (_ringAlphaMap) return _ringAlphaMap;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(1, size);
  for (let i = 0; i < size; i++) {
    const t = i / (size - 1);
    const fadeIn = Math.min(1, t / 0.18);
    const fadeOut = Math.min(1, (1 - t) / 0.18);
    const v = Math.round(Math.min(fadeIn, fadeOut) * 255);
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  _ringAlphaMap = tex;
  return tex;
}

function ensureRingMesh(runtime) {
  if (!runtime || runtime.ring) return runtime?.ring || null;
  const THREE = runtime.THREE;
  const ringGeom = new THREE.RingGeometry(1.22, 1.95, 128);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xd8c7a8,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    alphaMap: ringAlphaMap(THREE),
    toneMapped: false,
  });
  const ring = new THREE.Mesh(ringGeom, ringMat);
  // Render after body (0) so depth test hides ring behind the planet while
  // the front arc composites on top.  Before clouds (2) and haze (3).
  ring.renderOrder = 1;
  ring.rotation.x = THREE.MathUtils.degToRad(100);
  ring.visible = false;
  runtime.root?.add?.(ring);
  runtime.ring = ring;
  runtime.ringMat = ringMat;
  return ring;
}

function disposeBodyRuntime(runtime) {
  if (!runtime) return;
  runtime.disposed = true;
  runtime.pendingTextureRequestId += 1;
  runtime.pendingTextureSignature = "";
  try {
    runtime.surfaceTexture?.dispose?.();
  } catch {}
  try {
    runtime.cloudTexture?.dispose?.();
  } catch {}
  try {
    runtime.normalTexture?.dispose?.();
  } catch {}
  try {
    runtime.roughnessTexture?.dispose?.();
  } catch {}
  try {
    runtime.emissiveTexture?.dispose?.();
  } catch {}
  for (const mesh of [runtime.body, runtime.clouds, runtime.haze]) {
    if (!mesh) continue;
    try {
      mesh.geometry?.dispose?.();
    } catch {}
    try {
      if (Array.isArray(mesh.material)) {
        for (const m of mesh.material) m?.dispose?.();
      } else {
        mesh.material?.dispose?.();
      }
    } catch {}
  }
  disposeRingMesh(runtime);
  try {
    runtime.renderer?.forceContextLoss?.();
  } catch {}
  try {
    runtime.renderer?.dispose?.();
  } catch {}
}

function applyBodyCanvasSize(runtime, canvas) {
  if (!runtime || !canvas) return;
  const dpr = clampPreviewDpr(window.devicePixelRatio || 1);
  const w = Number(canvas.clientWidth) || Number(canvas.width) || 180;
  const h = Number(canvas.clientHeight) || Number(canvas.height) || w;
  const pxW = Math.max(1, Math.round(w * dpr));
  const pxH = Math.max(1, Math.round(h * dpr));
  runtime.renderer.setSize(pxW, pxH, false);
  runtime.renderer.setPixelRatio(1);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  runtime.camera.aspect = w / Math.max(1, h);
  runtime.camera.updateProjectionMatrix();
}

function pickPreviewTextureSize(runtime, requestedSize) {
  const requested = Math.max(64, Number(requestedSize) || 256);
  const canvas = runtime?.renderer?.domElement;
  if (!canvas) return requested;
  const pxW = Number(canvas.width) || 0;
  const pxH = Number(canvas.height) || 0;
  const maxPx = Math.max(pxW, pxH);
  if (!(maxPx > 0)) return requested;
  const desired = Math.max(64, Math.ceil(maxPx * 1.18));
  const snapped = desired <= 96 ? 64 : desired <= 192 ? 128 : desired <= 320 ? 256 : 384;
  return Math.min(requested, snapped, 384);
}

function buildDescriptorSignature(descriptor, textureSize = descriptor?.textureSize) {
  if (!descriptor) return "";
  return JSON.stringify({
    texPipeline: CELESTIAL_TEXTURE_PIPELINE_VERSION,
    bodyType: descriptor.bodyType,
    seed: descriptor.seed,
    profileId: descriptor.profileId || "",
    lod: descriptor.lod,
    texSize: Math.max(1, Number(textureSize) || 0),
    rot: descriptor.rotationPeriodDays,
    tilt: descriptor.axialTiltDeg,
    layers: descriptor.layers,
    atmosphere: descriptor.atmosphere,
    clouds: descriptor.clouds,
    ring: descriptor.ring,
    aurora: descriptor.aurora,
    gasVisual: descriptor.gasVisual,
    flattenStyleMaps: shouldFlattenStyleMaps(descriptor),
  });
}

function cloneCanvas(source) {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.drawImage(source, 0, 0);
  return canvas;
}

function cacheTextures(signature, entry) {
  if (
    !signature ||
    !entry?.surface ||
    !entry?.cloud ||
    !entry?.normal ||
    !entry?.roughness ||
    !entry?.emissive
  ) {
    return;
  }
  if (CELESTIAL_TEXTURE_CACHE.has(signature)) {
    const prev = CELESTIAL_TEXTURE_CACHE.get(signature);
    CELESTIAL_TEXTURE_CACHE.delete(signature);
    CELESTIAL_TEXTURE_CACHE.set(signature, prev);
    return;
  }
  CELESTIAL_TEXTURE_CACHE.set(signature, {
    surface: cloneCanvas(entry.surface),
    cloud: cloneCanvas(entry.cloud),
    normal: cloneCanvas(entry.normal),
    roughness: cloneCanvas(entry.roughness),
    emissive: cloneCanvas(entry.emissive),
  });
  /* Persist to IndexedDB for cross-session cache (fire-and-forget) */
  storeTexturesToIDB(signature, entry, CELESTIAL_TEXTURE_PIPELINE_VERSION);
  if (CELESTIAL_TEXTURE_CACHE.size <= CELESTIAL_TEXTURE_CACHE_MAX) return;
  const oldestKey = CELESTIAL_TEXTURE_CACHE.keys().next().value;
  if (oldestKey) CELESTIAL_TEXTURE_CACHE.delete(oldestKey);
}

function getCachedTextures(signature) {
  if (!signature || !CELESTIAL_TEXTURE_CACHE.has(signature)) return null;
  const entry = CELESTIAL_TEXTURE_CACHE.get(signature);
  CELESTIAL_TEXTURE_CACHE.delete(signature);
  CELESTIAL_TEXTURE_CACHE.set(signature, entry);
  return {
    surface: cloneCanvas(entry.surface),
    cloud: cloneCanvas(entry.cloud),
    normal: cloneCanvas(entry.normal),
    roughness: cloneCanvas(entry.roughness),
    emissive: cloneCanvas(entry.emissive),
  };
}

function generateCelestialTextureCanvasesLocal(descriptor, textureSize) {
  const flattenStyleMaps = shouldFlattenStyleMaps(descriptor);
  const flattenAuxMaps = flattenStyleMaps && descriptor?.bodyType === "gasGiant";
  const proceduralFields = buildProceduralSurfaceFields(descriptor, textureSize, textureSize);
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = textureSize;
  textureCanvas.height = textureSize;
  const tctx = getCanvas2dContext(textureCanvas, { readback: true });
  if (tctx) paintCelestialTexture(tctx, textureSize, descriptor, 0);
  applyProceduralSurfaceDetail(textureCanvas, descriptor, proceduralFields);

  const cloudCanvas = document.createElement("canvas");
  cloudCanvas.width = textureSize;
  cloudCanvas.height = textureSize;
  const cctx = getCanvas2dContext(cloudCanvas, { readback: true });
  if (cctx) {
    paintCloudTexture(cctx, textureSize, descriptor);
    blendHorizontalSeam(cloudCanvas, 10);
  }
  if (flattenStyleMaps && tctx && cctx) {
    tctx.save();
    tctx.globalCompositeOperation = "source-over";
    tctx.drawImage(cloudCanvas, 0, 0);
    tctx.restore();
    cctx.clearRect(0, 0, textureSize, textureSize);
  }
  blendHorizontalSeam(textureCanvas, 12);

  const aux = flattenAuxMaps
    ? null
    : buildSurfaceAuxiliaryCanvases(textureCanvas, descriptor, proceduralFields);
  const normalCanvas =
    aux?.normal || makeFlatMapCanvas(textureSize, textureSize, [128, 128, 255, 255]);
  const roughnessCanvas =
    aux?.roughness ||
    makeFlatMapCanvas(
      textureSize,
      textureSize,
      flattenAuxMaps ? [240, 240, 240, 255] : [180, 180, 180, 255],
    );
  const emissiveCanvas =
    aux?.emissive || makeFlatMapCanvas(textureSize, textureSize, [0, 0, 0, 255]);
  if (!flattenAuxMaps) {
    blendHorizontalSeam(normalCanvas, 8);
    blendHorizontalSeam(roughnessCanvas, 8);
    blendHorizontalSeam(emissiveCanvas, 8);
  }
  return {
    surface: textureCanvas,
    cloud: cloudCanvas,
    normal: normalCanvas,
    roughness: roughnessCanvas,
    emissive: emissiveCanvas,
  };
}

function applyDescriptorMapsToRuntime(runtime, descriptor, signature, entry) {
  if (!runtime || runtime.disposed || !descriptor || !entry?.surface || !entry?.cloud) return;
  const textureCanvas = entry.surface;
  const cloudCanvas = entry.cloud;
  const textureSize = Number(textureCanvas.width || descriptor.textureSize || 512);
  const normalCanvas =
    entry.normal || makeFlatMapCanvas(textureSize, textureSize, [128, 128, 255, 255]);
  const roughnessCanvas =
    entry.roughness || makeFlatMapCanvas(textureSize, textureSize, [180, 180, 180, 255]);
  const emissiveCanvas =
    entry.emissive || makeFlatMapCanvas(textureSize, textureSize, [0, 0, 0, 255]);

  const nextSurfaceTex = createCanvasTexture(runtime.THREE, textureCanvas, { srgb: true });
  const nextCloudTex = createCanvasTexture(runtime.THREE, cloudCanvas, { srgb: true });
  const nextNormalTex = createCanvasTexture(runtime.THREE, normalCanvas);
  const nextRoughnessTex = createCanvasTexture(runtime.THREE, roughnessCanvas);
  const nextEmissiveTex = createCanvasTexture(runtime.THREE, emissiveCanvas, { srgb: true });
  nextCloudTex.premultiplyAlpha = false;
  const maxAnisotropy = runtime.renderer?.capabilities?.getMaxAnisotropy?.() || 1;
  const anisotropy = clamp(Math.round(maxAnisotropy), 1, 8);
  nextSurfaceTex.anisotropy = anisotropy;
  nextCloudTex.anisotropy = anisotropy;
  nextNormalTex.anisotropy = anisotropy;
  nextRoughnessTex.anisotropy = anisotropy;
  nextEmissiveTex.anisotropy = anisotropy;

  runtime.surfaceTexture?.dispose?.();
  runtime.cloudTexture?.dispose?.();
  runtime.normalTexture?.dispose?.();
  runtime.roughnessTexture?.dispose?.();
  runtime.emissiveTexture?.dispose?.();
  runtime.surfaceTexture = nextSurfaceTex;
  runtime.cloudTexture = nextCloudTex;
  runtime.normalTexture = nextNormalTex;
  runtime.roughnessTexture = nextRoughnessTex;
  runtime.emissiveTexture = nextEmissiveTex;

  runtime.body.material.map = runtime.surfaceTexture;
  runtime.body.material.normalMap = runtime.normalTexture;
  runtime.body.material.roughnessMap = runtime.roughnessTexture;
  runtime.body.material.emissiveMap = runtime.emissiveTexture;
  runtime.body.material.emissive?.set?.("#ffffff");
  runtime.body.material.needsUpdate = true;

  const hasOcean = hasLayer(
    descriptor,
    "ocean-fill",
    (layer) => !layer?.params?.frozen && Number(layer?.params?.coverage || 0) > 0.12,
  );
  const warmEmissive =
    hasLayer(descriptor, "molten-fissures") ||
    hasLayer(descriptor, "volcanic-system") ||
    descriptor.profileId === "lava-world" ||
    descriptor.profileId === "molten-companion" ||
    descriptor.profileId === "io";
  const coolEmissive =
    hasLayer(descriptor, "fractures") ||
    hasLayer(descriptor, "plume-haze") ||
    descriptor.profileId === "europa" ||
    descriptor.profileId === "enceladus" ||
    descriptor.profileId === "triton";

  if (descriptor.bodyType === "gasGiant") {
    runtime.body.material.roughness = 1.0;
    runtime.body.material.metalness = 0;
    if (runtime.body.material.normalScale?.set) runtime.body.material.normalScale.set(0.4, 0.4);
    if ("clearcoat" in runtime.body.material) runtime.body.material.clearcoat = 0;
    if ("clearcoatRoughness" in runtime.body.material)
      runtime.body.material.clearcoatRoughness = 1.0;
  } else if (descriptor.bodyType === "moon") {
    runtime.body.material.roughness = 0.82;
    runtime.body.material.metalness = 0.01;
    if (runtime.body.material.normalScale?.set) runtime.body.material.normalScale.set(0.9, 0.9);
    if ("clearcoat" in runtime.body.material) runtime.body.material.clearcoat = 0.03;
    if ("clearcoatRoughness" in runtime.body.material)
      runtime.body.material.clearcoatRoughness = 0.58;
  } else {
    runtime.body.material.roughness = hasOcean ? 0.88 : 0.82;
    runtime.body.material.metalness = 0.02;
    if (runtime.body.material.normalScale?.set) {
      const terrainScale = hasOcean ? 0.62 : 0.78;
      runtime.body.material.normalScale.set(terrainScale, terrainScale);
    }
    if ("clearcoat" in runtime.body.material)
      runtime.body.material.clearcoat = hasOcean ? 0.02 : 0.02;
    if ("clearcoatRoughness" in runtime.body.material) {
      runtime.body.material.clearcoatRoughness = hasOcean ? 0.3 : 0.48;
    }
  }

  runtime.body.material.emissiveIntensity = warmEmissive ? 0.72 : coolEmissive ? 0.48 : 0.08;

  if (runtime.keyLight)
    runtime.keyLight.intensity = descriptor.bodyType === "gasGiant" ? 1.08 : 1.02;
  if (runtime.rimLight) runtime.rimLight.intensity = descriptor.bodyType === "moon" ? 0.24 : 0.3;
  if (runtime.fillLight) runtime.fillLight.intensity = descriptor.bodyType === "moon" ? 0.76 : 0.82;

  runtime.clouds.material.map = runtime.cloudTexture;
  runtime.clouds.material.alphaMap = runtime.cloudTexture;
  runtime.clouds.material.needsUpdate = true;
  const flattenStyleMaps = shouldFlattenStyleMaps(descriptor);
  const showCloudShell =
    !flattenStyleMaps && descriptor.bodyType !== "gasGiant" && !!descriptor.clouds?.enabled;
  runtime.clouds.visible = showCloudShell;
  runtime.clouds.scale.setScalar(showCloudShell ? Number(descriptor.clouds?.scale) || 1.03 : 1.03);
  runtime.cloudMat.opacity = showCloudShell
    ? clamp(Number(descriptor.clouds?.opacity) || 0.2, 0.04, 0.9)
    : 0;

  const showHaze = !!descriptor.atmosphere?.enabled;
  runtime.haze.visible = showHaze;
  runtime.haze.scale.setScalar(showHaze ? Number(descriptor.atmosphere?.scale) || 1.06 : 1.06);
  const hazeColour = descriptor.atmosphere?.colour || "#90b4ec";
  const hazeOpacity = showHaze
    ? clamp(Number(descriptor.atmosphere?.opacity) || 0.12, 0.03, 0.4)
    : 0;
  const hazeScale = clamp(Number(descriptor.atmosphere?.scale) || 1.06, 1, 1.6);
  if (runtime.hazeMat?.uniforms?.uColor) {
    runtime.hazeMat.uniforms.uColor.value.set(hazeColour);
    runtime.hazeMat.uniforms.uOpacity.value = hazeOpacity;
    const powerBase =
      descriptor.bodyType === "gasGiant" ? 1.85 : descriptor.bodyType === "moon" ? 2.45 : 2.15;
    runtime.hazeMat.uniforms.uPower.value = clamp(powerBase - (hazeScale - 1) * 1.05, 1.35, 2.8);
    runtime.hazeMat.uniforms.uFalloff.value =
      descriptor.bodyType === "gasGiant" ? 0.72 : descriptor.bodyType === "moon" ? 0.62 : 0.66;
  } else {
    runtime.hazeMat.color.set(hazeColour);
    runtime.hazeMat.opacity = hazeOpacity;
  }

  const showRing = !!descriptor.ring?.enabled;
  if (showRing) ensureRingMesh(runtime);
  if (!showRing) {
    disposeRingMesh(runtime);
  } else if (runtime.ring && runtime.ringMat) {
    runtime.ring.visible = true;
    const inner = clamp(Number(descriptor.ring.inner) || 1.22, 1.1, 2.5);
    const outer = clamp(Number(descriptor.ring.outer) || 1.95, inner + 0.05, 3.2);
    runtime.ring.geometry.dispose();
    runtime.ring.geometry = new runtime.THREE.RingGeometry(inner, outer, 192);
    runtime.ring.rotation.x = runtime.THREE.MathUtils.degToRad(
      Number(descriptor.ring.tiltDeg) || 100,
    );
    runtime.ring.rotation.z = runtime.THREE.MathUtils.degToRad(
      Number(descriptor.ring.yawDeg) || 20,
    );
    runtime.ringMat.color.set(descriptor.ring.colour || "#d8c7a8");
    runtime.ringMat.opacity = clamp(Number(descriptor.ring.opacity) || 0.35, 0.05, 0.8);
  }

  // Pull the camera back when rings are visible so the full ring system
  // fits within the frustum.  FOV = 34° → half-FOV ≈ 17° → tan ≈ 0.3057.
  // Required z = outerRadius / tan(halfFOV) + small margin.
  if (showRing) {
    const outer = clamp(Number(descriptor.ring.outer) || 1.95, 1.2, 3.2);
    const halfFovTan = Math.tan((runtime.camera.fov / 2) * (Math.PI / 180));
    runtime.camera.position.z = Math.max(3.5, (outer + 0.15) / halfFovTan);
  } else {
    runtime.camera.position.z = 3.5;
  }
  runtime.camera.updateProjectionMatrix();

  if (runtime.renderer && "toneMappingExposure" in runtime.renderer) {
    runtime.renderer.toneMappingExposure =
      descriptor.bodyType === "gasGiant" ? 1.06 : descriptor.bodyType === "moon" ? 0.98 : 1.03;
  }

  runtime.descriptor = descriptor;
  runtime.descriptorSignature = signature;
  runtime.rotationOffset = hashUnit(`${descriptor.seed}:body-rot`) * Math.PI * 2;
}

function applyDescriptorToRuntime(runtime, descriptor, model) {
  if (!runtime || runtime.disposed || !descriptor) return;
  const textureSize = pickPreviewTextureSize(runtime, descriptor.textureSize);
  const signature = buildDescriptorSignature(descriptor, textureSize);
  if (signature === runtime.descriptorSignature) return;
  if (runtime.pendingTextureSignature === signature) return;

  const cached = getCachedTextures(signature);
  if (cached) {
    runtime.pendingTextureSignature = "";
    applyDescriptorMapsToRuntime(runtime, descriptor, signature, cached);
    return;
  }

  const requestId = runtime.pendingTextureRequestId + 1;
  runtime.pendingTextureRequestId = requestId;
  runtime.pendingTextureSignature = signature;

  if (descriptor.lod !== "tiny" && model) {
    const tiers =
      descriptor.lod === "high"
        ? ["medium", "low", "tiny"]
        : descriptor.lod === "medium"
          ? ["low", "tiny"]
          : ["tiny"];
    let placeholderApplied = false;
    for (const tier of tiers) {
      const ld = composeCelestialDescriptor(model, { lod: tier });
      const ls = pickPreviewTextureSize(runtime, ld.textureSize);
      const lsig = buildDescriptorSignature(ld, ls);
      const lcached = getCachedTextures(lsig);
      if (lcached) {
        applyDescriptorMapsToRuntime(runtime, descriptor, lsig, lcached);
        placeholderApplied = true;
        break;
      }
    }
    if (!placeholderApplied && supportsCelestialTextureWorker()) {
      const tinyDescriptor = composeCelestialDescriptor(model, { lod: "tiny" });
      const tinySize = pickPreviewTextureSize(runtime, tinyDescriptor.textureSize);
      const tinySig = buildDescriptorSignature(tinyDescriptor, tinySize);
      requestCelestialTextureBundle({
        signature: tinySig,
        descriptor: tinyDescriptor,
        textureSize: tinySize,
      })
        .then((result) => {
          if (!runtime || runtime.disposed) return;
          if (runtime.pendingTextureRequestId !== requestId) return;
          if (runtime.descriptorSignature === signature) return;
          const maps = result?.maps || null;
          const wm = {
            surface: canvasFromMapPayload(maps?.surface),
            cloud: canvasFromMapPayload(maps?.cloud),
            normal: canvasFromMapPayload(maps?.normal),
            roughness: canvasFromMapPayload(maps?.roughness),
            emissive: canvasFromMapPayload(maps?.emissive),
          };
          if (!wm.surface || !wm.cloud || !wm.normal) return;
          cacheTextures(tinySig, wm);
          applyDescriptorMapsToRuntime(runtime, descriptor, tinySig, wm);
        })
        .catch(() => {});
    }
  }

  const applyLocalFallback = () => {
    if (!runtime || runtime.disposed) return;
    if (runtime.pendingTextureRequestId !== requestId) return;
    const localMaps = generateCelestialTextureCanvasesLocal(descriptor, textureSize);
    cacheTextures(signature, localMaps);
    applyDescriptorMapsToRuntime(runtime, descriptor, signature, localMaps);
    if (runtime.pendingTextureRequestId === requestId) runtime.pendingTextureSignature = "";
  };

  if (!supportsCelestialTextureWorker()) {
    applyLocalFallback();
    return;
  }

  requestCelestialTextureBundle({ signature, descriptor, textureSize })
    .then((result) => {
      if (!runtime || runtime.disposed) return;
      if (runtime.pendingTextureRequestId !== requestId) return;
      const maps = result?.maps || null;
      const workerMaps = {
        surface: canvasFromMapPayload(maps?.surface),
        cloud: canvasFromMapPayload(maps?.cloud),
        normal: canvasFromMapPayload(maps?.normal),
        roughness: canvasFromMapPayload(maps?.roughness),
        emissive: canvasFromMapPayload(maps?.emissive),
      };
      if (!workerMaps.surface || !workerMaps.cloud || !workerMaps.normal) {
        throw new Error("Worker payload missing required texture maps");
      }
      cacheTextures(signature, workerMaps);
      applyDescriptorMapsToRuntime(runtime, descriptor, signature, workerMaps);
      if (runtime.pendingTextureRequestId === requestId) runtime.pendingTextureSignature = "";
    })
    .catch(() => {
      applyLocalFallback();
    });
}

function renderBodyFrame(state, dtSec) {
  if (!state.runtime || !state.runtime.descriptor) return;
  const rt = state.runtime;
  const descriptor = rt.descriptor;
  const days = state.activityDays;
  const rotPeriod = Math.max(0.1, Number(descriptor.rotationPeriodDays) || 1);
  const bodyTurns = days / rotPeriod;
  const bodyRot = bodyTurns * Math.PI * 2 + rt.rotationOffset;
  rt.body.rotation.y = bodyRot;
  rt.body.rotation.z = rt.THREE.MathUtils.degToRad(Number(descriptor.axialTiltDeg) || 0);

  if (rt.clouds.visible) {
    const driftFactor = Math.max(1, Number(descriptor.clouds?.driftFactor) || 1.25);
    rt.clouds.rotation.y = bodyRot * driftFactor;
    rt.clouds.rotation.z = rt.body.rotation.z;
  }

  if (rt.haze.visible) rt.haze.rotation.y = bodyRot * 0.35;

  rt.renderer.render(rt.scene, rt.camera);
  void dtSec;
}

function createBodyVisualPreviewController({ speedDaysPerSec = DEFAULT_SPEED_DAYS_PER_SEC } = {}) {
  const state = {
    canvas: null,
    runtime: null,
    pendingRuntime: null,
    running: false,
    paused: false,
    rafId: null,
    lastTs: 0,
    speedDaysPerSec: Math.max(0, Number(speedDaysPerSec) || DEFAULT_SPEED_DAYS_PER_SEC),
    activityDays: 0,
    model: null,
    modelSignature: "",
    lod: CELESTIAL_DEFAULT_LOD,
    modelDirty: true,
  };

  function stopLoop() {
    state.running = false;
    state.lastTs = 0;
    if (state.rafId != null) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
  }

  function ensureRuntime() {
    if (!state.canvas) return;
    if (state.runtime || state.pendingRuntime) return;
    const canvas = state.canvas;
    state.pendingRuntime = initBodyRuntime(canvas)
      .then((runtime) => {
        state.pendingRuntime = null;
        if (!state.canvas || state.canvas !== canvas || !canvas.isConnected) {
          disposeBodyRuntime(runtime);
          return;
        }
        state.runtime = runtime;
        state.modelDirty = true;
      })
      .catch(() => {
        state.pendingRuntime = null;
      });
  }

  function setModel(model) {
    const sig = JSON.stringify(model || {});
    if (sig === state.modelSignature) return;
    state.modelSignature = sig;
    state.model = model || null;
    state.modelDirty = true;
  }

  function tick(ts) {
    if (!state.running) return;
    if (!state.canvas || !state.canvas.isConnected) {
      stopLoop();
      return;
    }
    ensureRuntime();
    if (!state.lastTs) state.lastTs = ts;
    const dtSec = clamp((ts - state.lastTs) / 1000, 1 / 120, 0.12);
    state.lastTs = ts;
    if (!state.paused) state.activityDays += dtSec * state.speedDaysPerSec;

    if (state.runtime) {
      applyBodyCanvasSize(state.runtime, state.canvas);
      const nextLod = inferCelestialLod(state.canvas);
      if (nextLod !== state.lod) {
        state.lod = nextLod;
        state.modelDirty = true;
      }
      if (state.modelDirty && state.model) {
        const descriptor = composeCelestialDescriptor(state.model, { lod: state.lod });
        applyDescriptorToRuntime(state.runtime, descriptor, state.model);
        state.modelDirty = false;
      }
      renderBodyFrame(state, dtSec);
    }
    state.rafId = requestAnimationFrame(tick);
  }

  function startLoop() {
    if (state.running || !state.canvas) return;
    state.running = true;
    state.rafId = requestAnimationFrame(tick);
  }

  return {
    attach(canvas, model) {
      if (canvas !== state.canvas) {
        stopLoop();
        if (state.runtime) {
          disposeBodyRuntime(state.runtime);
          state.runtime = null;
        }
        state.pendingRuntime = null;
        state.canvas = canvas || null;
      }
      setModel(model);
      if (!state.canvas) return;
      ensureRuntime();
      startLoop();
    },
    update(model) {
      setModel(model);
      if (state.canvas && !state.running) startLoop();
    },
    detach() {
      stopLoop();
      if (state.runtime) {
        disposeBodyRuntime(state.runtime);
        state.runtime = null;
      }
      state.pendingRuntime = null;
      state.canvas = null;
    },
    dispose() {
      this.detach();
      state.model = null;
      state.modelSignature = "";
    },
    setPaused(v) {
      state.paused = !!v;
    },
  };
}

export function createCelestialVisualPreviewController({
  speedDaysPerSec = DEFAULT_SPEED_DAYS_PER_SEC,
} = {}) {
  const sunController = createSunVisualPreviewController({ speedDaysPerSec });
  const bodyController = createBodyVisualPreviewController({ speedDaysPerSec });
  let active = "none";

  function switchMode(next) {
    if (active === next) return;
    if (active === "star") sunController.detach();
    if (active === "body") bodyController.detach();
    active = next;
  }

  return {
    attach(canvas, model) {
      if (isStarModel(model)) {
        switchMode("star");
        sunController.attach(canvas, model);
      } else {
        switchMode("body");
        bodyController.attach(canvas, model);
      }
    },
    update(model) {
      if (isStarModel(model)) {
        if (active !== "star") switchMode("star");
        sunController.update(model);
      } else {
        if (active !== "body") switchMode("body");
        bodyController.update(model);
      }
    },
    detach() {
      if (active === "star") sunController.detach();
      if (active === "body") bodyController.detach();
      active = "none";
    },
    dispose() {
      sunController.dispose();
      bodyController.dispose();
      active = "none";
    },
    setPaused(v) {
      bodyController.setPaused(v);
    },
  };
}

/* ── One-shot recipe snapshot renderer ──────────────────────── */

let _recipeRuntime = null;
let _recipeRuntimeInit = null;
let _recipeQueue = Promise.resolve();

async function ensureRecipeRuntime() {
  if (_recipeRuntime && !_recipeRuntime.disposed) return _recipeRuntime;
  if (_recipeRuntimeInit) return _recipeRuntimeInit;
  const offscreen = document.createElement("canvas");
  offscreen.width = 180;
  offscreen.height = 180;
  _recipeRuntimeInit = initBodyRuntime(offscreen, { preserveDrawingBuffer: true })
    .then((rt) => {
      _recipeRuntime = rt;
      _recipeRuntimeInit = null;
      return rt;
    })
    .catch(() => {
      _recipeRuntimeInit = null;
      return null;
    });
  return _recipeRuntimeInit;
}

async function doRecipeSnapshot(targetCanvas, model, { shouldContinue = null } = {}) {
  if (!shouldContinueWork(shouldContinue)) return false;
  if (!targetCanvas) return false;
  const runtime = await ensureRecipeRuntime();
  if (!shouldContinueWork(shouldContinue)) return false;
  if (!runtime || runtime.disposed) return false;

  const descriptor = composeCelestialDescriptor(model, { lod: "low" });
  const textureSize = descriptor.textureSize || 128;
  const signature = buildDescriptorSignature(descriptor, textureSize);

  let maps = getCachedTextures(signature);
  if (!maps) {
    maps = generateCelestialTextureCanvasesLocal(descriptor, textureSize);
    cacheTextures(signature, maps);
  }

  if (!shouldContinueWork(shouldContinue)) return false;
  applyDescriptorMapsToRuntime(runtime, descriptor, signature, maps);
  runtime.descriptor = descriptor;
  runtime.descriptorSignature = signature;

  const size = 180;
  const offscreen = runtime.renderer.domElement;
  runtime.renderer.setSize(size, size, false);
  runtime.renderer.setPixelRatio(1);
  runtime.camera.aspect = 1;
  runtime.camera.updateProjectionMatrix();

  const spin = Number.isFinite(model?.spinRad)
    ? model.spinRad
    : hashUnit(descriptor.seed || "recipe") * Math.PI * 2;
  const af = model?.axisFrame;
  if (af && af.axis && af.uDir && af.vDir) {
    // Build root rotation from the overlay's orthonormal frame so that
    // local X = vDir, local Y = axis (pole), local Z = uDir.
    // This ensures body.rotation.y = spin matches the overlay's equatorial
    // parameterisation: at spin=t the front of the sphere is at u*cos(t)+v*sin(t).
    const THREE = runtime.THREE;
    const m = new THREE.Matrix4().set(
      af.vDir.x,
      af.axis.x,
      af.uDir.x,
      0,
      af.vDir.y,
      af.axis.y,
      af.uDir.y,
      0,
      af.vDir.z,
      af.axis.z,
      af.uDir.z,
      0,
      0,
      0,
      0,
      1,
    );
    runtime.root.quaternion.setFromRotationMatrix(m);
    // Children rotate in the now-oriented local frame.
    runtime.body.rotation.set(0, spin, 0);
    if (runtime.clouds.visible) runtime.clouds.rotation.set(0, spin * 1.25, 0);
    if (runtime.haze.visible) runtime.haze.rotation.set(0, spin * 0.35, 0);
  } else {
    // Legacy path: identity root, Euler tilt on body.
    runtime.root.quaternion.identity();
    runtime.body.rotation.y = spin;
    runtime.body.rotation.z = runtime.THREE.MathUtils.degToRad(descriptor.axialTiltDeg || 0);
    if (runtime.clouds.visible) {
      runtime.clouds.rotation.y = spin * 1.25;
      runtime.clouds.rotation.z = runtime.body.rotation.z;
    }
    if (runtime.haze.visible) runtime.haze.rotation.y = spin * 0.35;
  }

  if (!shouldContinueWork(shouldContinue)) return false;
  runtime.renderer.render(runtime.scene, runtime.camera);

  // Store the camera-to-base-z ratio so callers can scale the sprite to
  // compensate for the camera pulling back (e.g. when rings are visible).
  const cameraScale = runtime.camera.position.z / 3.5;
  targetCanvas.dataset.cameraScale = cameraScale.toFixed(3);

  const w = Number(targetCanvas.width) || 90;
  const h = Number(targetCanvas.height) || 90;
  const ctx2d = targetCanvas.getContext("2d");
  if (!ctx2d) return false;
  ctx2d.clearRect(0, 0, w, h);
  ctx2d.drawImage(offscreen, 0, 0, w, h);
  return true;
}

/**
 * Render a one-shot celestial preview from a model object.
 * Uses a shared offscreen WebGL renderer — safe for many recipe cards.
 *
 * @param {HTMLCanvasElement} targetCanvas - destination (uses 2D context)
 * @param {object} model - same shape as celestialPreviewController.attach() model
 * @returns {Promise<boolean>}
 */
export function renderCelestialRecipeSnapshot(targetCanvas, model) {
  const options =
    arguments.length > 2 && arguments[2] && typeof arguments[2] === "object" ? arguments[2] : {};
  const task = _recipeQueue
    .then(() => doRecipeSnapshot(targetCanvas, model, options))
    .catch(() => false);
  _recipeQueue = task;
  return task;
}

/* ── Cached batch recipe renderer ──────────────────────────── */

const _snapshotCache = new Map();

function snapshotCacheKey(model) {
  return `${model.bodyType || ""}:${model.recipeId || model.styleId || ""}`;
}

/**
 * Render an array of recipe previews with caching and browser yields
 * so thumbnails appear progressively. Cached items paint instantly.
 *
 * @param {{ canvas: HTMLCanvasElement, model: object }[]} items
 * @param {(done: number, total: number) => void} [onProgress]
 * @returns {Promise<void>}
 */
export async function renderCelestialRecipeBatch(items, onProgress) {
  const total = items.length;
  let done = 0;

  /* First pass — paint cached items instantly */
  const uncached = [];
  for (const { canvas, model } of items) {
    const key = snapshotCacheKey(model);
    const cached = _snapshotCache.get(key);
    if (cached) {
      const w = Number(canvas.width) || 90;
      const h = Number(canvas.height) || 90;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(cached, 0, 0, w, h);
      }
      canvas.dataset.loaded = "1";
      done++;
    } else {
      uncached.push({ canvas, model, key });
    }
  }
  if (onProgress) onProgress(done, total);
  if (!uncached.length) return;

  /* Warm up the shared WebGL runtime before timing the loop */
  await ensureRecipeRuntime();

  /* Second pass — render uncached, yielding between frames */
  for (const { canvas, model, key } of uncached) {
    if (!canvas.isConnected) {
      done++;
      if (onProgress) onProgress(done, total);
      continue;
    }
    const ok = await doRecipeSnapshot(canvas, model);
    if (ok) {
      try {
        const w = Number(canvas.width) || 90;
        const h = Number(canvas.height) || 90;
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        c.getContext("2d").drawImage(canvas, 0, 0);
        _snapshotCache.set(key, c);
      } catch {
        /* cache miss is fine */
      }
    }
    canvas.dataset.loaded = "1";
    done++;
    if (onProgress) onProgress(done, total);
    /* Yield to browser so it paints the latest thumbnail */
    await new Promise((r) => requestAnimationFrame(r));
  }
}

/* ── IndexedDB → in-memory cache bridge ────────────────────── */

function canvasFromIDBPayload(buffer, width, height) {
  if (!buffer || !(width > 0) || !(height > 0)) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(buffer), width, height), 0, 0);
  return canvas;
}

async function loadFromIDBToCache(signature) {
  if (!signature) return false;
  if (CELESTIAL_TEXTURE_CACHE.has(signature)) return true;
  const rec = await loadTexturesFromIDB(signature);
  if (!rec) return false;
  const maps = {
    surface: canvasFromIDBPayload(rec.surface, rec.width, rec.height),
    cloud: canvasFromIDBPayload(rec.cloud, rec.width, rec.height),
    normal: canvasFromIDBPayload(rec.normal, rec.width, rec.height),
    roughness: canvasFromIDBPayload(rec.roughness, rec.width, rec.height),
    emissive: canvasFromIDBPayload(rec.emissive, rec.width, rec.height),
  };
  if (!maps.surface || !maps.cloud || !maps.normal) return false;
  cacheTextures(signature, maps);
  return true;
}

/* ── Batch pre-warm (worker + IDB aware) ───────────────────── */

function shouldContinueWork(guard) {
  return typeof guard !== "function" || guard();
}

async function warmSingle(descriptor, textureSize, signature, shouldContinue = null) {
  if (!shouldContinueWork(shouldContinue)) return;
  if (await loadFromIDBToCache(signature)) return;
  if (!shouldContinueWork(shouldContinue)) return;
  if (supportsCelestialTextureWorker()) {
    try {
      const result = await requestCelestialTextureBundle({
        signature,
        descriptor,
        textureSize,
      });
      if (!shouldContinueWork(shouldContinue)) return;
      const maps = result?.maps;
      const wm = {
        surface: canvasFromMapPayload(maps?.surface),
        cloud: canvasFromMapPayload(maps?.cloud),
        normal: canvasFromMapPayload(maps?.normal),
        roughness: canvasFromMapPayload(maps?.roughness),
        emissive: canvasFromMapPayload(maps?.emissive),
      };
      if (wm.surface && wm.cloud && wm.normal) {
        cacheTextures(signature, wm);
        return;
      }
    } catch {
      /* fall through to local */
    }
  }
  if (!shouldContinueWork(shouldContinue)) return;
  const localMaps = generateCelestialTextureCanvasesLocal(descriptor, textureSize);
  if (!shouldContinueWork(shouldContinue)) return;
  cacheTextures(signature, localMaps);
}

/**
 * Pre-generate textures for a batch of body models so they are cached
 * (both in-memory and IDB) before the render loop needs them.
 * Checks: in-memory → IDB → Web Worker → local fallback.
 *
 * @param {{ bodyType: string, [key: string]: any }[]} models
 * @param {{ lod?: string }} [opts]
 * @returns {Promise<void>}
 */
export async function preWarmTextures(models, opts = {}) {
  if (!models?.length) return;
  const lod = opts.lod || "low";
  const shouldContinue = typeof opts.shouldContinue === "function" ? opts.shouldContinue : null;
  const tasks = [];
  for (const model of models) {
    if (!shouldContinueWork(shouldContinue)) return;
    const descriptor = composeCelestialDescriptor(model, { lod });
    const textureSize = descriptor.textureSize || 128;
    const signature = buildDescriptorSignature(descriptor, textureSize);
    if (CELESTIAL_TEXTURE_CACHE.has(signature)) continue;
    tasks.push(warmSingle(descriptor, textureSize, signature, shouldContinue));
  }
  await Promise.all(tasks);
}

/* ── Exports for external 3D mesh creation ─────────────────── */
export {
  previewPbrMaterial,
  createAtmosphereMaterial,
  createCanvasTexture,
  generateCelestialTextureCanvasesLocal,
  buildDescriptorSignature,
  getCachedTextures,
  cacheTextures,
  makeFlatMapCanvas,
  hasLayer,
  shouldFlattenStyleMaps,
  loadFromIDBToCache,
};
