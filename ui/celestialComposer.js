import { createSeededRng } from "../engine/stellarActivity.js";
import { clamp } from "../engine/utils.js";
import { getStyleById, computeGasGiantVisualProfile } from "./gasGiantStyles.js";
import { computeRockyVisualProfile } from "./rockyPlanetStyles.js";
import { computeMoonVisualProfile } from "./moonStyles.js";
import {
  buildGasArtProfile,
  buildMoonArtProfile,
  buildRockyArtProfile,
} from "./celestialArtProfiles.js";

const LOD_PRESETS = {
  tiny: { textureSize: 64, detail: 0.2 },
  low: { textureSize: 128, detail: 0.4 },
  medium: { textureSize: 256, detail: 0.65 },
  high: { textureSize: 384, detail: 0.85 },
};

function normalizeHex(hex, fallback = "#bdb8aa") {
  const raw = String(hex || "")
    .trim()
    .replace(/^#/, "");
  const full = raw.length === 3 ? raw.replace(/(.)/g, "$1$1") : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return fallback;
  return `#${full.toLowerCase()}`;
}

function hexToRgb(hex, fallback = "#bdb8aa") {
  const safe = normalizeHex(hex, fallback);
  return {
    r: parseInt(safe.slice(1, 3), 16),
    g: parseInt(safe.slice(3, 5), 16),
    b: parseInt(safe.slice(5, 7), 16),
  };
}

function mixHex(hexA, hexB, t = 0.5) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const u = clamp(Number(t), 0, 1);
  const r = Math.round(a.r + (b.r - a.r) * u);
  const g = Math.round(a.g + (b.g - a.g) * u);
  const b2 = Math.round(a.b + (b.b - a.b) * u);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b2.toString(16).padStart(2, "0")}`;
}

function rgba(hex, alpha = 1, fallback = "#bdb8aa") {
  const rgb = hexToRgb(hex, fallback);
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${clamp(Number(alpha), 0, 1)})`;
}

const LAYER_FIELD_CACHE = new Map();
const LAYER_FIELD_CACHE_MAX = 32;

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

function hashUnit(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
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

function buildRenderCacheKey(descriptor, size, phase) {
  return [
    descriptor?.seed || "unknown",
    descriptor?.profileId || "",
    descriptor?.lod || "medium",
    Math.max(1, Number(size) || 1),
    Math.round((Number(phase) || 0) * 1000),
  ].join("|");
}

function getRenderFieldCache(descriptor, size, phase = 0) {
  const key = buildRenderCacheKey(descriptor, size, phase);
  if (LAYER_FIELD_CACHE.has(key)) {
    const entry = LAYER_FIELD_CACHE.get(key);
    LAYER_FIELD_CACHE.delete(key);
    LAYER_FIELD_CACHE.set(key, entry);
    return entry;
  }
  const entry = {
    size: Math.max(1, Number(size) || 1),
    seed: String(descriptor?.seed || "unknown"),
    fields: new Map(),
    dir: null,
  };
  LAYER_FIELD_CACHE.set(key, entry);
  if (LAYER_FIELD_CACHE.size > LAYER_FIELD_CACHE_MAX) {
    const oldest = LAYER_FIELD_CACHE.keys().next().value;
    if (oldest) LAYER_FIELD_CACHE.delete(oldest);
  }
  return entry;
}

function getDirectionField(fieldCache) {
  if (fieldCache?.dir) return fieldCache.dir;
  const size = Math.max(1, Number(fieldCache?.size) || 1);
  const count = size * size;
  const dirX = new Float32Array(count);
  const dirY = new Float32Array(count);
  const dirZ = new Float32Array(count);
  const latAbs = new Float32Array(count);
  let idx = 0;
  for (let y = 0; y < size; y += 1) {
    const v = (y + 0.5) / size;
    const lat = (0.5 - v) * Math.PI;
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);
    const latNorm = Math.abs((v - 0.5) * 2);
    for (let x = 0; x < size; x += 1) {
      const u = (x + 0.5) / size;
      const lon = (u - 0.5) * Math.PI * 2;
      dirX[idx] = cosLat * Math.cos(lon);
      dirY[idx] = sinLat;
      dirZ[idx] = cosLat * Math.sin(lon);
      latAbs[idx] = latNorm;
      idx += 1;
    }
  }
  const out = { dirX, dirY, dirZ, latAbs };
  fieldCache.dir = out;
  return out;
}

function parseCssColor(input, fallback = "#ffffff", fallbackAlpha = 1) {
  const str = String(input || "").trim();
  const rgbaMatch = /^rgba?\(([^)]+)\)$/i.exec(str);
  if (rgbaMatch) {
    const parts = rgbaMatch[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length >= 3) {
      const r = clamp(Math.round(Number(parts[0]) || 0), 0, 255);
      const g = clamp(Math.round(Number(parts[1]) || 0), 0, 255);
      const b = clamp(Math.round(Number(parts[2]) || 0), 0, 255);
      const a = parts.length >= 4 ? clamp(Number(parts[3]), 0, 1) : clamp(fallbackAlpha, 0, 1);
      return { r, g, b, a };
    }
  }
  const hex = normalizeHex(str || fallback, fallback);
  const rgb = hexToRgb(hex, fallback);
  return { ...rgb, a: clamp(fallbackAlpha, 0, 1) };
}

function wrapUnitDelta(a, b) {
  let d = a - b;
  while (d > 0.5) d -= 1;
  while (d < -0.5) d += 1;
  return d;
}

function histogramThreshold(field, targetFractionAbove, bins = 256) {
  const n = field?.length || 0;
  if (!n) return 0.5;
  const hist = new Uint32Array(Math.max(8, bins));
  for (let i = 0; i < n; i += 1) {
    const v = clamp(Number(field[i]) || 0, 0, 1);
    const bi = Math.min(hist.length - 1, Math.floor(v * hist.length));
    hist[bi] += 1;
  }
  const target = clamp(Number(targetFractionAbove) || 0.5, 0, 1) * n;
  let acc = 0;
  for (let i = hist.length - 1; i >= 0; i -= 1) {
    acc += hist[i];
    if (acc >= target) return (i + 0.5) / hist.length;
  }
  return 0.5;
}

function blurFieldWrapX(field, size, radius = 1, passes = 1) {
  const n = field?.length || 0;
  if (!n || !(size > 1) || radius <= 0 || passes <= 0) return field;
  let src = field;
  let dst = new Float32Array(n);
  for (let pass = 0; pass < passes; pass += 1) {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        let sum = 0;
        let wsum = 0;
        for (let dy = -radius; dy <= radius; dy += 1) {
          const yy = clamp(y + dy, 0, size - 1);
          const wy = radius + 1 - Math.abs(dy);
          for (let dx = -radius; dx <= radius; dx += 1) {
            const xx = (x + dx + size) % size;
            const wx = radius + 1 - Math.abs(dx);
            const w = wy * wx;
            sum += src[yy * size + xx] * w;
            wsum += w;
          }
        }
        dst[y * size + x] = wsum > 0 ? sum / wsum : src[y * size + x];
      }
    }
    const tmp = src;
    src = dst;
    dst = tmp;
  }
  return src;
}

function mixRgb(a, b, t) {
  const u = clamp(Number(t), 0, 1);
  return {
    r: Math.round(a.r + (b.r - a.r) * u),
    g: Math.round(a.g + (b.g - a.g) * u),
    b: Math.round(a.b + (b.b - a.b) * u),
  };
}

function buildContinentsField(fieldCache, descriptor, params) {
  const size = Math.max(1, Number(fieldCache?.size) || 1);
  const key = JSON.stringify({
    type: "continents-heightfield",
    size,
    seed: descriptor?.seed || "",
    profileId: descriptor?.profileId || "",
    landFraction: Number(params?.landFraction) || 0.5,
    macroScale: Number(params?.macroScale) || 0.9,
    warp: Number(params?.warp) || 0.28,
    coastErode: Number(params?.coastErode) || 0.2,
    ridgeStrength: Number(params?.ridgeStrength) || 0.4,
  });
  if (fieldCache.fields.has(key)) return fieldCache.fields.get(key);

  const { dirX, dirY, dirZ } = getDirectionField(fieldCache);
  const count = size * size;
  const height = new Float32Array(count);
  const colorVar = new Float32Array(count);
  const ridge = new Float32Array(count);
  const seedBase = Math.floor(hashUnit(`${descriptor?.seed || "world"}:continents`) * 100000);
  const macroScale = clamp(Number(params?.macroScale) || 0.9, 0.32, 2.4);
  const warp = clamp(Number(params?.warp) || 0.28, 0.02, 0.8);
  const landFraction = clamp(Number(params?.landFraction) || 0.5, 0.04, 0.96);
  const coastErode = clamp(Number(params?.coastErode) || 0.2, 0, 0.9);
  const edgeSoftness = clamp(Number(params?.edgeSoftness) || 0.03, 0.004, 0.12);

  let minH = Infinity;
  let maxH = -Infinity;
  for (let i = 0; i < count; i += 1) {
    const dx = dirX[i];
    const dy = dirY[i];
    const dz = dirZ[i];
    const macro = sampleWarpedNoise3(dx, dy, dz, macroScale, seedBase + 21, warp, 4, 2.08, 0.55);
    const meso = sampleWarpedNoise3(
      dx,
      dy,
      dz,
      macroScale * 3.1,
      seedBase + 71,
      warp * 0.72,
      4,
      2.12,
      0.53,
    );
    const micro = sampleWarpedNoise3(
      dx,
      dy,
      dz,
      macroScale * 10.2,
      seedBase + 131,
      warp * 0.45,
      3,
      2.06,
      0.5,
    );
    const ridgeN = ridgedFbm3Fast(
      dx * (macroScale * 2.8),
      dy * (macroScale * 2.8),
      dz * (macroScale * 2.8),
      seedBase + 181,
      4,
      2.1,
      0.55,
    );
    const h = clamp(macro * 0.56 + meso * 0.24 + micro * 0.08 + ridgeN * 0.12, 0, 1);
    height[i] = h;
    colorVar[i] = clamp(meso * 0.6 + micro * 0.4, 0, 1);
    ridge[i] = ridgeN;
    if (h < minH) minH = h;
    if (h > maxH) maxH = h;
  }

  const invRange = maxH > minH ? 1 / (maxH - minH) : 1;
  for (let i = 0; i < count; i += 1) {
    height[i] = clamp((height[i] - minH) * invRange, 0, 1);
  }

  const t0 = histogramThreshold(height, landFraction);
  const rawMask = new Float32Array(count);
  const coastNoise = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const dx = dirX[i];
    const dy = dirY[i];
    const dz = dirZ[i];
    const cn = sampleWarpedNoise3(
      dx,
      dy,
      dz,
      macroScale * 13.2,
      seedBase + 233,
      0.18 + coastErode * 0.08,
      3,
      2.1,
      0.52,
    );
    coastNoise[i] = cn;
    rawMask[i] = smoothstep(t0 - edgeSoftness, t0 + edgeSoftness, height[i]);
  }
  for (let i = 0; i < count; i += 1) {
    const edge = 1 - Math.abs(rawMask[i] * 2 - 1);
    rawMask[i] = clamp(rawMask[i] + (coastNoise[i] - 0.5) * coastErode * edge, 0, 1);
  }

  let softened = blurFieldWrapX(rawMask, size, 1, coastErode > 0.2 ? 2 : 1);
  if (!softened || softened.length !== count) softened = rawMask;
  const t1 = histogramThreshold(softened, landFraction);
  const mask = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    mask[i] = smoothstep(t1 - edgeSoftness, t1 + edgeSoftness, softened[i]);
  }

  const out = { mask, colorVar, ridge };
  fieldCache.fields.set(key, out);
  return out;
}

function isValidBodyType(value) {
  return value === "rocky" || value === "gasGiant" || value === "moon";
}

function inferBodyType(model) {
  const explicit = String(model?.bodyType || "").trim();
  if (isValidBodyType(explicit)) return explicit;
  if (model?.gasCalc || model?.styleId || model?.gasProfile) return "gasGiant";
  if (model?.moonCalc || model?.moonProfile) return "moon";
  return "rocky";
}

function normalizeLod(lod) {
  if (!lod) return "medium";
  const key = String(lod).toLowerCase();
  return LOD_PRESETS[key] ? key : "medium";
}

function firstBooleanValue(...values) {
  for (const value of values) {
    if (typeof value === "boolean") return value;
  }
  return null;
}

function deriveRingPresenceFromGasCalc(gasCalc) {
  const ringProps = gasCalc?.ringProperties;
  if (!ringProps || typeof ringProps !== "object") return null;
  const depthClass = String(ringProps?.opticalDepthClass || "")
    .trim()
    .toLowerCase();
  if (
    depthClass &&
    (depthClass === "none" ||
      depthClass === "no" ||
      depthClass === "absent" ||
      depthClass === "tenuous" ||
      depthClass === "n/a" ||
      depthClass === "na")
  ) {
    return false;
  }

  const tau = Number(ringProps?.opticalDepth);
  if (Number.isFinite(tau) && tau > 0.02) return true;

  const ringMass = Number(ringProps?.estimatedMassKg);
  if (Number.isFinite(ringMass) && ringMass > 1e14) return true;

  if (depthClass) return true;
  return null;
}

function resolveGasRingVisibility(model, gasCalc) {
  const fromCalc = deriveRingPresenceFromGasCalc(gasCalc);
  if (typeof fromCalc === "boolean") return fromCalc;
  const explicit = firstBooleanValue(model?.showRings, model?.rings, model?.hasRings);
  if (typeof explicit === "boolean") return explicit;
  return false;
}

function normalizeGasFamily(value, fallback = "banded") {
  const key = String(value || "")
    .trim()
    .toLowerCase();
  if (key === "solid" || key === "banded" || key === "patchy" || key === "hazy") {
    return key;
  }
  return fallback;
}

function inferGasVisualFamily(styleDef, styleId, recipeId, gasCalc) {
  const explicit = normalizeGasFamily(styleDef?.family, "");
  if (explicit) return explicit;

  const styleKey =
    `${String(styleId || "").toLowerCase()} ${String(recipeId || "").toLowerCase()}`.trim();
  if (
    styleKey.includes("uranus") ||
    styleKey.includes("helium") ||
    styleKey.includes("cloudless")
  ) {
    return "solid";
  }
  if (styleKey.includes("neptune")) return "patchy";
  if (
    styleKey.includes("hazy") ||
    styleKey.includes("sub-neptune") ||
    styleKey.includes("alkali")
  ) {
    return "hazy";
  }

  const teq = Number(gasCalc?.thermal?.equilibriumTempK);
  const metallicity = Number(gasCalc?.atmosphere?.metallicitySolar);
  const massMjup = Number(gasCalc?.inputs?.massMjup);
  const sudarskyClass = String(gasCalc?.classification?.sudarsky || "").toUpperCase();

  if (Number.isFinite(teq) && teq >= 1100) return "hazy";
  if (Number.isFinite(metallicity) && metallicity >= 10) return "hazy";
  if (sudarskyClass === "I-ICE") {
    if (Number.isFinite(massMjup) && massMjup <= 0.06) return "solid";
    return "patchy";
  }
  if (Number.isFinite(massMjup) && massMjup < 0.09) return "patchy";
  return "banded";
}

function normalizeRockyModel(model) {
  const visualProfile =
    model?.rockyProfile ||
    model?.visualProfile ||
    computeRockyVisualProfile(model?.derived || {}, model?.inputs || {});
  const name = String(model?.name || model?.seed || model?.inputs?.name || "Rocky world");
  const rotationHours = Math.max(
    0.1,
    Number(model?.rotationPeriodHours ?? model?.inputs?.rotationPeriodHours ?? 24) || 24,
  );
  const tiltDeg = Number(model?.axialTiltDeg ?? model?.inputs?.axialTiltDeg ?? 0) || 0;
  return {
    bodyType: "rocky",
    name,
    recipeId: String(model?.recipeId || model?.inputs?.appearanceRecipeId || ""),
    rotationPeriodDays: rotationHours / 24,
    axialTiltDeg: tiltDeg,
    visualProfile,
  };
}

function normalizeGasModel(model) {
  const gasProfile = model?.gasProfile ||
    model?.visualProfile ||
    (model?.gasCalc ? computeGasGiantVisualProfile(model.gasCalc) : null) || {
      bodyType: "gasGiant",
      styleId: String(model?.styleId || "jupiter"),
    };
  const styleId = String(gasProfile.styleId || model?.styleId || "jupiter");
  const styleDef = getStyleById(styleId);
  const name = String(model?.name || model?.seed || model?.inputs?.name || "Gas giant");
  const rotationHours = Math.max(
    0.1,
    Number(model?.rotationPeriodHours ?? model?.gasCalc?.inputs?.rotationPeriodHours ?? 10) || 10,
  );
  const gasCalc = model?.gasCalc || null;
  const showRings = resolveGasRingVisibility(model, gasCalc);
  const gasVisualFamily = inferGasVisualFamily(
    styleDef,
    styleId,
    model?.recipeId || model?.appearanceRecipeId || "",
    gasCalc,
  );
  return {
    bodyType: "gasGiant",
    name,
    recipeId: String(model?.recipeId || model?.appearanceRecipeId || ""),
    rotationPeriodDays: rotationHours / 24,
    axialTiltDeg: Number(model?.axialTiltDeg || 0) || 0,
    styleId,
    styleDef,
    hasRings: !!showRings,
    showRings: !!showRings,
    gasVisualFamily,
    gasCalc,
  };
}

function normalizeMoonModel(model) {
  const moonProfile =
    model?.moonProfile ||
    model?.visualProfile ||
    (model?.moonCalc ? computeMoonVisualProfile(model.moonCalc) : null) ||
    computeMoonVisualProfile(null);
  const name = String(model?.name || model?.seed || model?.inputs?.name || "Moon");
  const rotationDays = Number(
    model?.rotationPeriodDays ??
      model?.moonCalc?.orbit?.rotationPeriodDays ??
      model?.moonCalc?.orbit?.periodSiderealDays ??
      27.3,
  );
  return {
    bodyType: "moon",
    name,
    recipeId: String(
      model?.recipeId ||
        model?.moonCalc?.inputs?.appearanceRecipeId ||
        model?.inputs?.appearanceRecipeId ||
        "",
    ),
    rotationPeriodDays: Math.max(0.1, Number.isFinite(rotationDays) ? rotationDays : 27.3),
    axialTiltDeg: Number(model?.axialTiltDeg || 0) || 0,
    moonProfile,
    moonCalc: model?.moonCalc || null,
  };
}

function normalizeBodyModel(model) {
  const bodyType = inferBodyType(model);
  if (bodyType === "gasGiant") return normalizeGasModel(model);
  if (bodyType === "moon") return normalizeMoonModel(model);
  return normalizeRockyModel(model);
}

function cloneLayers(layers) {
  return (layers || []).map((layer) => ({
    ...layer,
    params: layer?.params ? { ...layer.params } : {},
  }));
}

function mergeLayerParams(baseParams, patchParams) {
  return { ...(baseParams || {}), ...(patchParams || {}) };
}

function applyArtProfile(base, artProfile) {
  if (!artProfile) return base;

  const layers = cloneLayers(base.layers);
  for (const edit of artProfile.layerEdits || []) {
    if (!edit?.id) continue;
    const idx = layers.findIndex((layer) => layer.id === edit.id);
    if (idx >= 0) {
      layers[idx] = {
        ...layers[idx],
        params: mergeLayerParams(layers[idx].params, edit.params),
      };
    } else {
      layers.push({ id: edit.id, params: { ...(edit.params || {}) } });
    }
  }

  const prepend = (artProfile.prependLayers || []).map((layer) => ({
    ...layer,
    params: { ...(layer?.params || {}) },
  }));
  const append = (artProfile.appendLayers || []).map((layer) => ({
    ...layer,
    params: { ...(layer?.params || {}) },
  }));

  return {
    ...base,
    profileId: artProfile.profileId || base.profileId || "",
    layers: [...prepend, ...layers, ...append],
    atmosphere: artProfile.atmosphere
      ? { ...(base.atmosphere || {}), ...artProfile.atmosphere }
      : base.atmosphere,
    clouds: artProfile.clouds ? { ...(base.clouds || {}), ...artProfile.clouds } : base.clouds,
    ring: artProfile.ring ? { ...(base.ring || {}), ...artProfile.ring } : base.ring,
    aurora: artProfile.aurora ? { ...(base.aurora || {}), ...artProfile.aurora } : base.aurora,
    gasVisual: artProfile.gasVisual
      ? { ...(base.gasVisual || {}), ...artProfile.gasVisual }
      : base.gasVisual,
  };
}

function rockyLayers(model, detail) {
  const p = model.visualProfile || {};
  const oceanCoverage = clamp(Number(p?.ocean?.coverage) || 0, 0, 1);
  const cloudCoverage = clamp(Number(p?.clouds?.coverage) || 0, 0, 1);
  const craterDensity = clamp(Number(p?.terrain?.craterDensity) || 0, 0, 1);
  const iceNorth = clamp(Number(p?.iceCaps?.north) || 0, 0, 1);
  const iceSouth = clamp(Number(p?.iceCaps?.south) || 0, 0, 1);
  const vegetationCoverage = clamp(Number(p?.vegetation?.coverage) || 0, 0, 1);
  const atmosphereThickness = clamp(Number(p?.atmosphere?.thickness) || 0, 0, 0.22);
  const cloudsAlpha = clamp(0.12 + cloudCoverage * 0.55, 0.08, 0.8);
  const plateAlpha = clamp((1 - oceanCoverage) * 0.75, 0.08, 0.86);
  const landFraction = clamp(1 - oceanCoverage, 0.05, 0.95);
  const continentsMacroScale = clamp(0.72 + (1 - oceanCoverage) * 0.58 + detail * 0.18, 0.45, 1.8);
  const continentsWarp = clamp(0.16 + oceanCoverage * 0.22 + detail * 0.06, 0.08, 0.52);
  const coastErode = clamp(0.16 + oceanCoverage * 0.36, 0.08, 0.6);
  const ridgeStrength = clamp(0.22 + (1 - oceanCoverage) * 0.34, 0.16, 0.72);
  const cloudParams = {
    coverage: clamp(cloudCoverage, 0, 0.98),
    macroScale: clamp(3.2 + (1 - oceanCoverage) * 1.8 + detail * 0.7, 2.2, 7.8),
    detailScale: clamp(16 + detail * 18 + cloudCoverage * 14, 12, 48),
    warp: clamp(0.12 + cloudCoverage * 0.18, 0.08, 0.36),
    edgeSoftness: clamp(0.06 - cloudCoverage * 0.03, 0.018, 0.08),
    latitudeBands: clamp(2.2 + cloudCoverage * 2.5, 1.4, 5.2),
    aniso: clamp(0.14 + cloudCoverage * 0.24, 0.08, 0.44),
    selfShadow: clamp(0.45 + cloudCoverage * 0.35, 0.35, 0.88),
  };

  const layers = [
    {
      id: "base-gradient",
      params: {
        c1: normalizeHex(p?.palette?.c1 || "#c4a882"),
        c2: normalizeHex(p?.palette?.c2 || "#8b6e4e"),
        c3: normalizeHex(p?.palette?.c3 || "#4a3726"),
      },
    },
    {
      id: "grain",
      params: { amount: Math.round(180 + 520 * detail), alpha: 0.06 + 0.05 * detail },
    },
  ];

  if (oceanCoverage > 0.01) {
    layers.push({
      id: "ocean-fill",
      params: {
        coverage: oceanCoverage,
        colour: normalizeHex(p?.ocean?.colour || "#1a4a7a"),
        frozen: !!p?.ocean?.frozen,
      },
    });
  }

  layers.push({
    id: "continents",
    params: {
      mode: "heightfield",
      landFraction,
      macroScale: continentsMacroScale,
      warp: continentsWarp,
      coastErode,
      ridgeStrength,
      edgeSoftness: 0.028,
      count: Math.round((3 + detail * 8) * Math.max(0.15, 1 - oceanCoverage * 0.9)),
      alpha: plateAlpha,
      c1: normalizeHex(p?.landPalette?.c1 || p?.palette?.c1 || "#b98f64"),
      c2: normalizeHex(p?.landPalette?.c2 || p?.palette?.c2 || "#7f6446"),
    },
  });

  if (vegetationCoverage > 0.03 && p?.vegetation?.colour) {
    layers.push({
      id: "vegetation",
      params: {
        alpha: clamp(0.12 + vegetationCoverage * 0.5, 0.08, 0.55),
        colour: normalizeHex(p.vegetation.colour, "#2e6131"),
        count: Math.round(10 + detail * 22),
      },
    });
  }

  if (craterDensity > 0.03) {
    layers.push({
      id: "craters",
      params: {
        count: Math.round(8 + craterDensity * 42 * detail),
        alpha: clamp(0.15 + craterDensity * 0.3, 0.1, 0.5),
      },
    });
  }

  if (iceNorth > 0.02 || iceSouth > 0.02) {
    layers.push({
      id: "ice-caps",
      params: {
        north: iceNorth,
        south: iceSouth,
        colour: normalizeHex(p?.iceCaps?.colour || "#e8f0ff"),
      },
    });
  }

  if (cloudCoverage > 0.02) {
    layers.push({
      id: "clouds",
      params: {
        count: Math.round(8 + cloudCoverage * 36 * detail),
        alpha: cloudsAlpha,
        colour: normalizeHex(p?.clouds?.colour || "#ffffff"),
        ...cloudParams,
      },
    });
  }

  if (p?.special === "lava") {
    layers.push({
      id: "volcanic-system",
      params: {
        hotspots: Math.round(4 + detail * 8),
        glowAlpha: 0.38,
        flowAlpha: 0.26,
        depositAlpha: 0.18,
      },
    });
  }

  const base = {
    layers,
    atmosphere: {
      enabled: atmosphereThickness > 0.002,
      colour: normalizeHex(p?.atmosphere?.colour || "#7ea2d8"),
      opacity: clamp(0.08 + atmosphereThickness * 2.8, 0.06, 0.38),
      scale: 1 + atmosphereThickness * 1.8,
    },
    clouds: {
      enabled: cloudCoverage > 0.02,
      colour: normalizeHex(p?.clouds?.colour || "#ffffff"),
      opacity: clamp(cloudsAlpha * 0.9, 0.08, 0.7),
      scale: 1.02 + cloudCoverage * 0.05,
      driftFactor: 1.25,
      params: cloudParams,
    },
    ring: { enabled: false },
  };

  return applyArtProfile(base, buildRockyArtProfile(model, detail));
}

function gasLayers(model, detail) {
  const style = model.styleDef || getStyleById(model.styleId);
  const gasCalc = model.gasCalc || {};
  const eqTemp = Number(gasCalc?.thermal?.equilibriumTempK) || 200;
  const hasAurora = (Number(gasCalc?.magnetic?.surfaceFieldGauss) || 0) > 20;
  const ringProps = gasCalc?.ringProperties || {};
  const ringOpticalDepth = String(ringProps?.opticalDepthClass || "");
  const ringTau = Number(ringProps?.opticalDepth);
  const ringOpacity = Number.isFinite(ringTau)
    ? clamp(0.08 + ringTau * 0.28, 0.08, 0.68)
    : ringOpticalDepth === "Dense"
      ? 0.55
      : ringOpticalDepth === "Moderate"
        ? 0.38
        : 0.16;
  const rawBands = Array.isArray(style?.bands) ? style.bands : [];
  const spots = Array.isArray(style?.spots) ? style.spots : [];
  const styleId = String(model.styleId || style?.id || "").toLowerCase();
  const family = normalizeGasFamily(model?.gasVisualFamily || style?.family || "banded");
  const familySettings =
    family === "solid"
      ? {
          hasVisibleBands: false,
          bandContrast: 0.16,
          bandCount: 2,
          turbulence: 0.16,
          shearStrength: 0.1,
          bandWiggle: 0.011,
          stormCoupling: 0.18,
          patchiness: 0.08,
          latProfile: "subtle",
          hazeStrength: 0.2,
          polarHaze: 0.32,
        }
      : family === "patchy"
        ? {
            hasVisibleBands: true,
            bandContrast: 0.44,
            bandCount: 5,
            turbulence: 0.52,
            shearStrength: 0.3,
            bandWiggle: 0.05,
            stormCoupling: 0.78,
            patchiness: 0.62,
            latProfile: "stormy",
            hazeStrength: 0.14,
            polarHaze: 0.26,
          }
        : family === "hazy"
          ? {
              hasVisibleBands: false,
              bandContrast: 0.2,
              bandCount: 3,
              turbulence: 0.22,
              shearStrength: 0.12,
              bandWiggle: 0.014,
              stormCoupling: 0.26,
              patchiness: 0.28,
              latProfile: "subtle",
              hazeStrength: 0.3,
              polarHaze: 0.38,
            }
          : {
              hasVisibleBands: true,
              bandContrast: 0.58,
              bandCount: 8,
              turbulence: 0.34,
              shearStrength: 0.24,
              bandWiggle: 0.032,
              stormCoupling: 0.56,
              patchiness: 0.24,
              latProfile: "jovian",
              hazeStrength: 0.1,
              polarHaze: 0.16,
            };

  const styleHasVisibleBands =
    typeof style?.hasVisibleBands === "boolean"
      ? style.hasVisibleBands
      : familySettings.hasVisibleBands;
  const bandCountBase =
    Number.isFinite(style?.bandCountDefault) && style.bandCountDefault > 0
      ? style.bandCountDefault
      : familySettings.bandCount;
  const bandContrastBase =
    Number.isFinite(style?.bandContrastDefault) && style.bandContrastDefault > 0
      ? style.bandContrastDefault
      : familySettings.bandContrast;
  const turbulenceBase =
    Number.isFinite(style?.turbulenceDefault) && style.turbulenceDefault > 0
      ? style.turbulenceDefault
      : familySettings.turbulence;
  const shearBase =
    Number.isFinite(style?.shearDefault) && style.shearDefault >= 0
      ? style.shearDefault
      : familySettings.shearStrength;
  const hazeBase =
    Number.isFinite(style?.defaultHaze) && style.defaultHaze >= 0
      ? style.defaultHaze
      : familySettings.hazeStrength;
  const polarHazeBase =
    Number.isFinite(style?.polarHaze) && style.polarHaze >= 0
      ? style.polarHaze
      : familySettings.polarHaze;

  const latProfile =
    family === "solid"
      ? "subtle"
      : family === "patchy"
        ? "stormy"
        : family === "hazy"
          ? "subtle"
          : styleId.includes("saturn") || styleId.includes("uranus")
            ? "subtle"
            : styleId.includes("neptune")
              ? "stormy"
              : styleId.includes("hot")
                ? "extreme"
                : "jovian";
  const bandCount = clamp(
    Math.round(bandCountBase + detail * (family === "banded" ? 2.2 : 1.1)),
    1,
    18,
  );
  const bandContrast = clamp(
    bandContrastBase +
      detail *
        (family === "banded"
          ? 0.04
          : family === "patchy"
            ? 0.07
            : family === "solid"
              ? -0.02
              : 0.02),
    0.05,
    1.25,
  );
  const turbulence = clamp(
    turbulenceBase +
      detail *
        (family === "patchy"
          ? 0.12
          : family === "banded"
            ? 0.08
            : family === "hazy"
              ? 0.03
              : 0.06) +
      (eqTemp > 900 ? 0.1 : 0),
    0.08,
    0.92,
  );
  const shearStrength = clamp(
    shearBase + detail * (family === "banded" ? 0.08 : family === "patchy" ? 0.1 : 0.04),
    0.05,
    0.78,
  );
  const bandWiggle = clamp(
    familySettings.bandWiggle + detail * (family === "patchy" ? 0.018 : 0.01),
    0.008,
    0.09,
  );
  const stormCoupling = clamp(
    familySettings.stormCoupling +
      detail * (family === "patchy" ? 0.14 : 0.08) +
      (spots.length ? 0.08 : 0),
    0.08,
    0.96,
  );
  const patchiness = clamp(
    familySettings.patchiness + detail * (family === "patchy" ? 0.08 : 0.03),
    0,
    1,
  );
  const hazeStrength = clamp(
    hazeBase + (family === "hazy" ? 0.08 : 0) + detail * (family === "solid" ? 0.02 : 0.01),
    0,
    0.62,
  );
  const polarHaze = clamp(
    polarHazeBase + detail * (family === "solid" || family === "hazy" ? 0.04 : 0.02),
    0,
    0.72,
  );
  const hasVisibleBands =
    styleHasVisibleBands &&
    rawBands.length > 0 &&
    !(family === "hazy" && bandContrast < 0.22) &&
    !(family === "solid" && bandContrast < 0.2);

  const scaleBandAlpha = (band, alphaScale = 1) => {
    const rgbaBand = parseCssColor(band?.colour || "rgba(255,255,255,0.18)", "#ffffff", 0.2);
    return {
      ...band,
      colour: `rgba(${rgbaBand.r},${rgbaBand.g},${rgbaBand.b},${clamp(rgbaBand.a * alphaScale, 0, 1)})`,
    };
  };
  const selectBandsForCount = (bands, count) => {
    if (!Array.isArray(bands) || !bands.length) return [];
    if (count >= bands.length) return bands;
    if (count <= 1) return [bands[Math.floor((bands.length - 1) * 0.5)]];
    const selected = [];
    for (let i = 0; i < count; i += 1) {
      const t = i / Math.max(1, count - 1);
      const idx = Math.round(t * (bands.length - 1));
      selected.push(bands[idx]);
    }
    return selected;
  };
  const filteredBands = selectBandsForCount(rawBands, bandCount).map((band) =>
    scaleBandAlpha(
      band,
      family === "solid" ? 0.2 : family === "hazy" ? 0.36 : family === "patchy" ? 0.86 : 1,
    ),
  );

  const layers = [
    {
      id: "base-gradient",
      params: {
        c1: normalizeHex(style?.palette?.c1 || "#f5ddbc"),
        c2: normalizeHex(style?.palette?.c2 || "#c6976d"),
        c3: normalizeHex(style?.palette?.c3 || "#704b36"),
      },
    },
    {
      id: "grain",
      params: { amount: Math.round(140 + 380 * detail), alpha: 0.04 + 0.05 * detail },
    },
    {
      id: "gas-bands",
      params: {
        mode: "dynamic",
        family,
        hasVisibleBands,
        bands: filteredBands,
        alpha: clamp(
          (family === "solid" ? 0.22 : family === "hazy" ? 0.34 : 0.82) + detail * 0.18,
          0.14,
          1,
        ),
        spots,
        bandCount,
        bandContrast,
        turbulence,
        shearStrength,
        bandWiggle,
        latProfile,
        stormCoupling,
        patchiness,
        wiggleScale: 1,
        shearScale: 1,
        turbScale: 1,
        patchScale: 1,
        noiseWarp: 1,
      },
    },
  ];

  if (spots.length) {
    layers.push({
      id: "gas-spots",
      params: {
        spots,
        alpha: clamp(
          family === "solid"
            ? 0.35 + detail * 0.14
            : family === "hazy"
              ? 0.42 + detail * 0.2
              : 0.68 + detail * 0.25,
          0.2,
          1,
        ),
      },
    });
  }

  layers.push({
    id: "storms",
    params: {
      count: Math.round(
        (family === "patchy" ? 5 : family === "solid" ? 1 : family === "hazy" ? 2 : 3) +
          (family === "patchy" ? 10 : 7) * detail +
          (eqTemp > 900 ? 4 : 0),
      ),
      alpha: clamp(
        family === "patchy"
          ? 0.18 + detail * 0.08
          : family === "solid"
            ? 0.08 + detail * 0.04
            : family === "hazy"
              ? 0.1 + detail * 0.04
              : 0.14 + detail * 0.06,
        0.04,
        0.3,
      ),
      colour: normalizeHex(mixHex(style?.palette?.c1 || "#ffffff", "#ffffff", 0.6)),
    },
  });
  layers.push({
    id: "gas-turbulence",
    params: {
      family,
      intensity: clamp(
        family === "patchy"
          ? 0.24 + detail * 0.12
          : family === "solid"
            ? 0.12 + detail * 0.03
            : family === "hazy"
              ? 0.18 + detail * 0.04
              : 0.2 + detail * 0.08,
        0.08,
        0.46,
      ),
      patchiness,
    },
  });
  if (family === "solid" || family === "hazy") {
    layers.push({
      id: "polar-haze",
      params: {
        alpha: clamp(0.1 + polarHaze * 0.5, 0.08, 0.5),
        colour: normalizeHex(mixHex(style?.palette?.c1 || "#e5f2ff", "#dce8ff", 0.35)),
      },
    });
  }

  const ringGap = clamp(Number(style?.ringStyle?.gap) || 0.74, 0.52, 1.12);
  const ringWidth = clamp(Number(style?.ringStyle?.width) || 0.32, 0.1, 0.92);
  const ringInner = clamp(1.14 + (ringGap - 0.7) * 0.72, 1.08, 2.2);
  const ringOuter = clamp(ringInner + 0.45 + ringWidth * 1.5, ringInner + 0.08, 3.1);
  const hazeEnabled =
    (family === "hazy" && hazeStrength > 0.06) || (family === "solid" && hazeStrength > 0.08);
  const hazeColour =
    family === "hazy"
      ? normalizeHex(mixHex(style?.palette?.c1 || "#d9c3a8", "#f0e3c5", 0.46))
      : normalizeHex(mixHex(style?.palette?.c1 || "#dce8ff", "#d2f2ff", 0.3));
  const base = {
    layers,
    atmosphere: {
      enabled: hazeEnabled,
      colour: hazeColour,
      opacity: hazeEnabled ? clamp(0.06 + hazeStrength * 0.68, 0.06, 0.42) : 0,
      scale: hazeEnabled ? clamp(1.04 + hazeStrength * 0.32, 1.04, 1.22) : 1,
    },
    clouds: {
      enabled: false,
      colour: normalizeHex(style?.palette?.c1 || "#f5ddbc"),
      opacity: 0,
      scale: 1.022,
      driftFactor: 1.45,
    },
    ring: {
      enabled: !!model.hasRings,
      colour: normalizeHex(style?.ringStyle?.colour || style?.palette?.ring || "#d8c7a8"),
      opacity: clamp(ringOpacity, 0.12, 0.65),
      inner: ringInner,
      outer: ringOuter,
      yawDeg: 22,
      tiltDeg: 100,
    },
    aurora: {
      enabled: hasAurora,
      colour: "#7dffd2",
      alpha: 0.16,
    },
    gasVisual: {
      family,
      hasVisibleBands,
      bandCount,
      bandContrast,
      turbulence,
      shearStrength,
      bandWiggle,
      latProfile,
      stormCoupling,
      patchiness,
      hazeStrength,
      polarHaze,
      wiggleScale: 1,
      shearScale: 1,
      turbScale: 1,
      patchScale: 1,
      noiseWarp: 1,
    },
  };

  return applyArtProfile(base, buildGasArtProfile(model, detail));
}

function moonLayers(model, detail) {
  const p = model.moonProfile || computeMoonVisualProfile(null);
  const craterDensity = clamp(Number(p?.terrain?.craterDensity) || 0, 0, 1);
  const iceCoverage = clamp(Number(p?.iceCoverage) || 0, 0, 1);
  const tidalIntensity = clamp(Number(p?.tidalHeating?.intensity) || 0, 0, 1);
  const hasVolcanic = p?.special === "volcanic" || p?.special === "molten" || tidalIntensity > 0.45;
  const hasOceanCracks = p?.special === "subsurface-ocean";

  const layers = [
    {
      id: "base-gradient",
      params: {
        c1: normalizeHex(p?.palette?.c1 || "#b8b0a8"),
        c2: normalizeHex(p?.palette?.c2 || "#888078"),
        c3: normalizeHex(p?.palette?.c3 || "#4a4540"),
      },
    },
    {
      id: "grain",
      params: { amount: Math.round(120 + 380 * detail), alpha: 0.05 + detail * 0.05 },
    },
  ];

  if (iceCoverage > 0.03) {
    layers.push({
      id: "ice-coverage",
      params: {
        coverage: iceCoverage,
        colour: normalizeHex(p?.iceColour || "#e8f0ff"),
      },
    });
  }

  layers.push({
    id: "craters",
    params: {
      count: Math.round(10 + craterDensity * 38 * detail),
      alpha: clamp(0.16 + craterDensity * 0.34, 0.12, 0.5),
    },
  });

  if (hasOceanCracks) {
    layers.push({
      id: "fractures",
      params: {
        count: Math.round(4 + 8 * detail),
        colour: "#8fd5ff",
        alpha: 0.34,
      },
    });
  }

  if (hasVolcanic) {
    layers.push({
      id: "volcanic-system",
      params: {
        hotspots: Math.round(3 + detail * 5 + tidalIntensity * 8),
        glowAlpha: clamp(0.16 + tidalIntensity * 0.3, 0.12, 0.52),
        flowAlpha: clamp(0.12 + tidalIntensity * 0.22, 0.08, 0.42),
        depositAlpha: clamp(0.08 + tidalIntensity * 0.18, 0.06, 0.3),
      },
    });
  }

  const atmosphereThickness = clamp(Number(p?.atmosphere?.thickness) || 0, 0, 0.1);
  const base = {
    layers,
    atmosphere: {
      enabled: atmosphereThickness > 0.001,
      colour: normalizeHex(p?.atmosphere?.colour || "#9db8de"),
      opacity: clamp(0.06 + atmosphereThickness * 3, 0.05, 0.28),
      scale: 1 + atmosphereThickness * 1.6,
    },
    clouds: { enabled: false },
    ring: { enabled: false },
  };

  return applyArtProfile(base, buildMoonArtProfile(model, detail));
}

export function composeCelestialDescriptor(inputModel, opts = {}) {
  const model = normalizeBodyModel(inputModel || {});
  const lod = normalizeLod(opts?.lod);
  const preset = LOD_PRESETS[lod];
  const detail = preset.detail;
  const flattenStyleMaps = opts?.flattenStyleMaps !== false;

  let composed;
  if (model.bodyType === "gasGiant") composed = gasLayers(model, detail);
  else if (model.bodyType === "moon") composed = moonLayers(model, detail);
  else composed = rockyLayers(model, detail);

  const seedDiscriminator =
    composed.profileId ||
    model.recipeId ||
    (model.bodyType === "gasGiant" ? model.styleId : "") ||
    "";
  const seed = `${model.bodyType}:${model.name}:${seedDiscriminator}`;

  return {
    bodyType: model.bodyType,
    name: model.name,
    seed,
    profileId: composed.profileId || "",
    lod,
    textureSize: preset.textureSize,
    detail,
    rotationPeriodDays: Math.max(0.1, Number(model.rotationPeriodDays) || 1),
    axialTiltDeg: Number(model.axialTiltDeg) || 0,
    layers: composed.layers,
    atmosphere: composed.atmosphere || { enabled: false },
    clouds:
      model.bodyType === "gasGiant"
        ? { ...(composed.clouds || {}), enabled: false, opacity: 0 }
        : composed.clouds || { enabled: false },
    ring: composed.ring || { enabled: false },
    aurora: composed.aurora || { enabled: false },
    gasVisual: model.bodyType === "gasGiant" ? composed.gasVisual || null : null,
    flattenStyleMaps,
  };
}

const LAYER_MODULES = {
  "base-gradient": {
    paint(ctx, size, layer) {
      const c = layer.params || {};
      // Latitude-based gradient: equator (c1) bright, mid-latitudes (c2),
      // poles (c3) dark.  Correct for equirectangular maps where y = latitude
      // and all 3D lighting is applied later by the sphere projection.
      const grad = ctx.createLinearGradient(0, 0, 0, size);
      grad.addColorStop(0, rgba(c.c3 || "#5d513f", 1));
      grad.addColorStop(0.18, rgba(c.c2 || "#a08d72", 1));
      grad.addColorStop(0.5, rgba(c.c1 || "#d7cab6", 1));
      grad.addColorStop(0.82, rgba(c.c2 || "#a08d72", 1));
      grad.addColorStop(1, rgba(c.c3 || "#5d513f", 1));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    },
  },
  grain: {
    paint(ctx, size, layer, rng) {
      const p = layer.params || {};
      const count = Math.max(0, Math.round(Number(p.amount) || 0));
      const alpha = clamp(Number(p.alpha) || 0.06, 0, 0.3);
      for (let i = 0; i < count; i += 1) {
        const x = rng() * size;
        const y = rng() * size;
        const r = size * (0.001 + rng() * 0.0035);
        const bright = rng() > 0.5 ? 255 : 0;
        ctx.fillStyle = `rgba(${bright},${bright},${bright},${alpha * (0.35 + rng() * 0.75)})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  "ocean-fill": {
    paint(ctx, size, layer) {
      const p = layer.params || {};
      const alpha = clamp(0.12 + Number(p.coverage || 0) * 0.65, 0, 0.78);
      const colour = p.frozen ? mixHex(p.colour || "#1a4a7a", "#d8f1ff", 0.35) : p.colour;
      ctx.fillStyle = rgba(colour || "#1a4a7a", alpha);
      ctx.fillRect(0, 0, size, size);
    },
  },
  continents: {
    paint(ctx, size, layer, rng, phase = 0, descriptor = null, fieldCache = null) {
      void rng;
      void phase;
      const p = layer.params || {};
      const mode = String(p.mode || "").toLowerCase();
      if (mode === "heightfield" && descriptor && fieldCache) {
        const alphaBase = clamp(Number(p.alpha) || 0.5, 0.08, 0.95);
        const c1 = hexToRgb(p.c1 || "#b08f65");
        const c2 = hexToRgb(p.c2 || "#7a6145");
        const ridgeStrength = clamp(Number(p.ridgeStrength) || 0.4, 0, 1);
        const field = buildContinentsField(fieldCache, descriptor, p);
        const mask = field.mask;
        const variation = field.colorVar;
        const ridge = field.ridge;
        const image = ctx.getImageData(0, 0, size, size);
        const data = image.data;
        const count = size * size;

        for (let i = 0; i < count; i += 1) {
          const m = mask[i];
          if (!(m > 0.001)) continue;
          const di = i * 4;
          const tone = clamp(
            variation[i] * (0.75 - ridgeStrength * 0.12) + ridge[i] * (0.25 + ridgeStrength * 0.32),
            0,
            1,
          );
          const tint = mixRgb(c1, c2, tone);
          const alpha = clamp(alphaBase * (0.62 + m * 0.38) * m, 0, 1);
          data[di] = Math.round(lerp(data[di], tint.r, alpha));
          data[di + 1] = Math.round(lerp(data[di + 1], tint.g, alpha));
          data[di + 2] = Math.round(lerp(data[di + 2], tint.b, alpha));
          data[di + 3] = 255;
        }

        ctx.putImageData(image, 0, 0);
        return;
      }

      const count = Math.max(1, Math.round(Number(p.count) || 8));
      const alpha = clamp(Number(p.alpha) || 0.5, 0.08, 0.95);
      const cx = size * 0.5;
      const cy = size * 0.5;
      const r = size * 0.47;
      for (let i = 0; i < count; i += 1) {
        const px = cx + (rng() - 0.5) * r * 1.6;
        const py = cy + (rng() - 0.5) * r * 1.4;
        const rx = r * (0.08 + rng() * 0.28);
        const ry = rx * (0.4 + rng() * 0.8);
        const rot = rng() * Math.PI;
        const col = rng() > 0.45 ? p.c1 || "#b08f65" : p.c2 || "#7a6145";
        ctx.fillStyle = rgba(col, alpha * (0.65 + rng() * 0.35));
        ctx.beginPath();
        ctx.ellipse(px, py, rx, ry, rot, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  vegetation: {
    paint(ctx, size, layer, rng) {
      const p = layer.params || {};
      const count = Math.max(1, Math.round(Number(p.count) || 18));
      const alpha = clamp(Number(p.alpha) || 0.22, 0.08, 0.6);
      const colour = p.colour || "#2e6131";
      const cx = size * 0.5;
      const cy = size * 0.5;
      const r = size * 0.45;
      for (let i = 0; i < count; i += 1) {
        const px = cx + (rng() - 0.5) * r * 1.7;
        const py = cy + (rng() - 0.5) * r * 1.5;
        const rr = r * (0.05 + rng() * 0.11);
        const grad = ctx.createRadialGradient(px, py, 0, px, py, rr);
        grad.addColorStop(0, rgba(colour, alpha * 0.8));
        grad.addColorStop(1, rgba(colour, 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, rr, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  craters: {
    paint(ctx, size, layer, rng) {
      const p = layer.params || {};
      const count = Math.max(1, Math.round(Number(p.count) || 12));
      const alpha = clamp(Number(p.alpha) || 0.22, 0.08, 0.8);
      for (let i = 0; i < count; i += 1) {
        const x = rng() * size;
        const y = rng() * size;
        const r = size * (0.008 + rng() * 0.028);
        ctx.fillStyle = `rgba(0,0,0,${alpha * (0.45 + rng() * 0.4)})`;
        ctx.beginPath();
        ctx.arc(x + r * 0.12, y + r * 0.12, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${alpha * 0.26})`;
        ctx.beginPath();
        ctx.arc(x - r * 0.16, y - r * 0.18, r * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  "ice-caps": {
    paint(ctx, size, layer) {
      const p = layer.params || {};
      const colour = p.colour || "#e8f0ff";
      const north = clamp(Number(p.north) || 0, 0, 1);
      const south = clamp(Number(p.south) || 0, 0, 1);
      const cx = size * 0.5;
      const r = size * 0.47;

      const drawCap = (isNorth, coverage) => {
        if (!(coverage > 0.01)) return;
        const centerY = size * (isNorth ? 0.14 : 0.86);
        const rx = r * (0.22 + coverage * 0.36);
        const ry = r * (0.13 + coverage * 0.08);
        const baseAlpha = clamp(0.18 + coverage * 0.56, 0.14, 0.88);

        // Soft radial body removes the hard ellipse edge.
        ctx.save();
        ctx.translate(cx, centerY);
        ctx.scale(rx, ry);
        const radial = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.22);
        radial.addColorStop(0, rgba(colour, baseAlpha * 0.74));
        radial.addColorStop(0.58, rgba(colour, baseAlpha * 0.44));
        radial.addColorStop(1, rgba(colour, 0));
        ctx.fillStyle = radial;
        ctx.beginPath();
        ctx.arc(0, 0, 1.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Polar weighting keeps the cap brighter near the pole and feathered toward lower latitudes.
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, centerY, rx * 1.06, ry * 1.14, 0, 0, Math.PI * 2);
        ctx.clip();
        const yTop = centerY - ry * 1.45;
        const yBottom = centerY + ry * 1.45;
        const polar = ctx.createLinearGradient(0, yTop, 0, yBottom);
        if (isNorth) {
          polar.addColorStop(0, rgba(colour, baseAlpha * 0.72));
          polar.addColorStop(0.42, rgba(colour, baseAlpha * 0.38));
          polar.addColorStop(1, rgba(colour, 0));
        } else {
          polar.addColorStop(0, rgba(colour, 0));
          polar.addColorStop(0.58, rgba(colour, baseAlpha * 0.38));
          polar.addColorStop(1, rgba(colour, baseAlpha * 0.72));
        }
        ctx.fillStyle = polar;
        ctx.fillRect(cx - rx * 1.3, yTop, rx * 2.6, yBottom - yTop);
        ctx.restore();
      };

      drawCap(true, north);
      drawCap(false, south);
    },
  },
  clouds: {
    paint(ctx, size, layer, rng, phase = 0) {
      const p = layer.params || {};
      const count = Math.max(1, Math.round(Number(p.count) || 20));
      const alpha = clamp(Number(p.alpha) || 0.2, 0.05, 0.9);
      const colour = p.colour || "#ffffff";
      const drift = Math.sin(phase * Math.PI * 2) * size * 0.06;
      for (let i = 0; i < count; i += 1) {
        const x = (rng() * size + drift + size) % size;
        const y = rng() * size;
        const rx = size * (0.05 + rng() * 0.14);
        const ry = rx * (0.2 + rng() * 0.45);
        ctx.fillStyle = rgba(colour, alpha * (0.4 + rng() * 0.5));
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, rng() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  "gas-bands": {
    paint(ctx, size, layer, _rng, phase = 0, descriptor = null, fieldCache = null) {
      void _rng;
      void phase;
      const p = layer.params || {};
      const bands = Array.isArray(p.bands) ? p.bands : [];
      const alphaScale = clamp(Number(p.alpha) || 1, 0.2, 1.5);
      if (!bands.length) return;
      const mode = String(p.mode || "").toLowerCase();
      const family = normalizeGasFamily(p.family || descriptor?.gasVisual?.family || "banded");
      const hasVisibleBands = p.hasVisibleBands !== false;
      const bandContrast = clamp(
        Number(p.bandContrast) || Number(descriptor?.gasVisual?.bandContrast) || 0.56,
        0.04,
        1.4,
      );
      if (!hasVisibleBands && family !== "solid" && family !== "hazy") return;
      if (mode !== "dynamic" || !descriptor || !fieldCache) {
        for (const band of bands) {
          const y = clamp(Number(band.y) || 0.5, 0, 1);
          const h = clamp(Number(band.h) || 0.08, 0.01, 0.25);
          const color = String(band.colour || "rgba(255,255,255,0.18)");
          const midY = size * y;
          const bandH = size * h;
          const grad = ctx.createLinearGradient(0, midY - bandH * 0.8, 0, midY + bandH * 0.8);
          grad.addColorStop(0, "rgba(0,0,0,0)");
          grad.addColorStop(
            0.5,
            color.replace(/rgba\(([^)]+)\)/, (_, inside) => {
              const chunks = inside.split(",").map((s) => s.trim());
              if (chunks.length < 4) return `rgba(${inside},${0.2 * alphaScale})`;
              chunks[3] = `${clamp(Number(chunks[3]) * alphaScale * bandContrast, 0, 1)}`;
              return `rgba(${chunks.join(",")})`;
            }),
          );
          grad.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = grad;
          ctx.fillRect(0, midY - bandH, size, bandH * 2);
        }
        return;
      }

      const parsedBands = bands.map((band) => {
        const y = clamp(Number(band?.y) || 0.5, 0, 1);
        const h = clamp(Number(band?.h) || 0.08, 0.008, 0.3);
        const color = parseCssColor(
          String(band?.colour || "rgba(255,255,255,0.18)"),
          "#ffffff",
          0.18,
        );
        return { y, h, color };
      });
      const requestedBandCount = clamp(
        Math.round(
          Number(p.bandCount) ||
            Number(descriptor?.gasVisual?.bandCount) ||
            parsedBands.length ||
            1,
        ),
        1,
        18,
      );
      const sortedBands = [...parsedBands].sort((a, b) => a.y - b.y);
      const interpolateBand = (targetY) => {
        if (!sortedBands.length) return null;
        if (targetY <= sortedBands[0].y) return sortedBands[0];
        if (targetY >= sortedBands[sortedBands.length - 1].y)
          return sortedBands[sortedBands.length - 1];
        for (let i = 1; i < sortedBands.length; i += 1) {
          if (targetY > sortedBands[i].y) continue;
          const a = sortedBands[i - 1];
          const b = sortedBands[i];
          const span = Math.max(1e-6, b.y - a.y);
          const t = clamp((targetY - a.y) / span, 0, 1);
          return {
            y: targetY,
            h: lerp(a.h, b.h, t),
            color: {
              r: lerp(a.color.r, b.color.r, t),
              g: lerp(a.color.g, b.color.g, t),
              b: lerp(a.color.b, b.color.b, t),
              a: lerp(a.color.a, b.color.a, t),
            },
          };
        }
        return sortedBands[sortedBands.length - 1];
      };
      const workingBands = [];
      if (requestedBandCount <= sortedBands.length) {
        for (let i = 0; i < requestedBandCount; i += 1) {
          const t = requestedBandCount <= 1 ? 0.5 : i / (requestedBandCount - 1);
          const idx = Math.round(t * (sortedBands.length - 1));
          workingBands.push(sortedBands[idx]);
        }
      } else {
        for (let i = 0; i < requestedBandCount; i += 1) {
          const t = requestedBandCount <= 1 ? 0.5 : i / (requestedBandCount - 1);
          const targetY = lerp(0.08, 0.92, t);
          const band = interpolateBand(targetY);
          if (band) workingBands.push(band);
        }
      }
      const spots = Array.isArray(p.spots) ? p.spots : [];
      const parsedSpots = spots.map((spot) => ({
        x: clamp(Number(spot?.x) || 0.5, 0, 1),
        y: clamp(Number(spot?.y) || 0.5, 0, 1),
        rx: clamp(Number(spot?.rx) || 0.08, 0.015, 0.25),
        ry: clamp(Number(spot?.ry) || 0.04, 0.01, 0.2),
      }));
      const turbulence = clamp(Number(p.turbulence) || 0.28, 0, 1);
      const shearStrength = clamp(Number(p.shearStrength) || 0.24, 0, 1);
      const bandWiggle = clamp(Number(p.bandWiggle) || 0.032, 0, 0.12);
      const stormCoupling = clamp(Number(p.stormCoupling) || 0.48, 0, 1);
      const patchiness = clamp(Number(p.patchiness) || 0.2, 0, 1);
      const latProfile = String(p.latProfile || "jovian").toLowerCase();
      const wiggleScale = clamp(Number(p.wiggleScale) || 1, 0.2, 3);
      const shearScale = clamp(Number(p.shearScale) || 1, 0.2, 3);
      const turbScale = clamp(Number(p.turbScale) || 1, 0.2, 3);
      const patchScale = clamp(Number(p.patchScale) || 1, 0.2, 3);
      const noiseWarp = clamp(Number(p.noiseWarp) || 1, 0.3, 2.5);

      const fieldKey = JSON.stringify({
        type: "gas-band-field",
        size,
        seed: descriptor.seed,
        profileId: descriptor.profileId || "",
        turbulence,
        shearStrength,
        bandWiggle,
        latProfile,
        patchiness,
        family,
        bandContrast,
        wiggleScale,
        shearScale,
        turbScale,
        patchScale,
        noiseWarp,
      });
      let field = fieldCache.fields.get(fieldKey);
      if (!field) {
        const { dirX, dirY, dirZ, latAbs } = getDirectionField(fieldCache);
        const count = size * size;
        const wiggle = new Float32Array(count);
        const shear = new Float32Array(count);
        const turb = new Float32Array(count);
        const patch = new Float32Array(count);
        const latWeight = new Float32Array(count);
        const seedBase = Math.floor(hashUnit(`${descriptor.seed}:gas-bands`) * 100000);
        for (let i = 0; i < count; i += 1) {
          const dx = dirX[i];
          const dy = dirY[i];
          const dz = dirZ[i];
          wiggle[i] = sampleWarpedNoise3(
            dx,
            dy,
            dz,
            3.2 * wiggleScale,
            seedBase + 31,
            0.22 * noiseWarp,
            4,
            2.1,
            0.54,
          );
          shear[i] = sampleWarpedNoise3(
            dx,
            dy,
            dz,
            5.9 * shearScale,
            seedBase + 61,
            0.2 * noiseWarp,
            3,
            2.06,
            0.52,
          );
          turb[i] = sampleWarpedNoise3(
            dx,
            dy,
            dz,
            10.6 * turbScale,
            seedBase + 97,
            0.16 * noiseWarp,
            3,
            2.14,
            0.5,
          );
          patch[i] = sampleWarpedNoise3(
            dx,
            dy,
            dz,
            7.3 * patchScale,
            seedBase + 123,
            0.22 * noiseWarp,
            3,
            2.1,
            0.52,
          );
          const lat = latAbs[i];
          if (latProfile === "subtle") latWeight[i] = 0.55 + (1 - lat) * 0.32;
          else if (latProfile === "stormy") latWeight[i] = 0.7 + (1 - lat) * 0.5;
          else if (latProfile === "extreme") latWeight[i] = 0.8 + (1 - lat) * 0.64;
          else latWeight[i] = 0.68 + (1 - lat) * 0.46;
        }
        field = { wiggle, shear, turb, patch, latWeight };
        fieldCache.fields.set(fieldKey, field);
      }

      const sampleBands = (yNorm) => {
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        for (const band of workingBands) {
          const d = Math.abs(yNorm - band.y) / Math.max(0.004, band.h * 1.15);
          if (d > 3.5) continue;
          const w = Math.exp(-(d * d) * 0.95);
          const wa = clamp(band.color.a * w, 0, 1);
          r += band.color.r * wa;
          g += band.color.g * wa;
          b += band.color.b * wa;
          a += wa;
        }
        if (!(a > 1e-5)) return null;
        return {
          r: r / a,
          g: g / a,
          b: b / a,
          a: clamp(a, 0, 1),
        };
      };

      const image = ctx.getImageData(0, 0, size, size);
      const data = image.data;
      const count = size * size;
      const familyAlphaScale =
        family === "solid" ? 0.58 : family === "hazy" ? 0.72 : family === "patchy" ? 1.12 : 1;
      for (let i = 0; i < count; i += 1) {
        const x = i % size;
        const y = Math.floor(i / size);
        const xNorm = (x + 0.5) / size;
        const yNorm = (y + 0.5) / size;
        const wig = (field.wiggle[i] - 0.5) * 2;
        const she = (field.shear[i] - 0.5) * 2;
        const tur = (field.turb[i] - 0.5) * 2;

        let displacement =
          wig * bandWiggle * field.latWeight[i] +
          she * shearStrength * (0.02 + field.latWeight[i] * 0.038) +
          tur * turbulence * 0.018;

        if (stormCoupling > 0 && parsedSpots.length) {
          let stormDisp = 0;
          for (const spot of parsedSpots) {
            const dx = wrapUnitDelta(xNorm, spot.x) / Math.max(0.02, spot.rx * 1.9);
            const dy = (yNorm - spot.y) / Math.max(0.02, spot.ry * 2.1);
            const dist = Math.hypot(dx, dy);
            if (dist > 2.6) continue;
            const influence = Math.exp(-(dist * dist) * 0.9);
            const ang = Math.atan2(dy, dx);
            stormDisp += Math.sin(ang * 3 + tur * 5.5 + wig * 2.2) * influence;
          }
          displacement += stormDisp * 0.016 * stormCoupling;
        }

        const ySample = clamp(yNorm + displacement, 0, 1);
        const bandSample = sampleBands(ySample);
        if (!bandSample) continue;

        const patchMask = lerp(1, 0.56 + field.patch[i] * 0.88, patchiness);
        const localTone = 1 + tur * turbulence * (0.06 + bandContrast * 0.24);
        const outA = clamp(
          bandSample.a *
            alphaScale *
            familyAlphaScale *
            patchMask *
            (0.35 + bandContrast * 0.82 + Math.abs(wig) * 0.14 + Math.max(0, tur) * 0.15),
          0,
          1,
        );
        if (!(outA > 0.001)) continue;

        const rr = clamp(bandSample.r * localTone + tur * (2 + bandContrast * 6), 0, 255);
        const gg = clamp(bandSample.g * localTone + tur * (2 + bandContrast * 5), 0, 255);
        const bb = clamp(bandSample.b * localTone + tur * (2 + bandContrast * 4), 0, 255);
        const di = i * 4;
        data[di] = Math.round(lerp(data[di], rr, outA));
        data[di + 1] = Math.round(lerp(data[di + 1], gg, outA));
        data[di + 2] = Math.round(lerp(data[di + 2], bb, outA));
        data[di + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);
    },
  },
  "gas-spots": {
    paint(ctx, size, layer) {
      const p = layer.params || {};
      const spots = Array.isArray(p.spots) ? p.spots : [];
      const alphaScale = clamp(Number(p.alpha) || 1, 0.2, 1.4);
      for (const spot of spots) {
        const x = clamp(Number(spot.x) || 0.5, 0, 1) * size;
        const y = clamp(Number(spot.y) || 0.5, 0, 1) * size;
        const rx = clamp(Number(spot.rx) || 0.08, 0.02, 0.25) * size;
        const ry = clamp(Number(spot.ry) || 0.04, 0.015, 0.2) * size;
        const parsed = parseCssColor(
          String(spot.colour || "rgba(200,120,70,0.45)"),
          "#c87846",
          0.45,
        );
        const sa = clamp(parsed.a * alphaScale, 0, 1);
        const sr = Math.round(parsed.r);
        const sg = Math.round(parsed.g);
        const sb = Math.round(parsed.b);
        const mr = Math.min(255, sr + 20);
        const mg = Math.min(255, sg + 15);
        const mb = Math.min(255, sb + 10);
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(x, y, rx * 1.15, ry * 1.15, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1, ry / rx);
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
        grad.addColorStop(0, `rgba(${sr},${sg},${sb},${sa * 0.9})`);
        grad.addColorStop(0.35, `rgba(${mr},${mg},${mb},${sa * 0.7})`);
        grad.addColorStop(0.7, `rgba(${sr},${sg},${sb},${sa * 0.35})`);
        grad.addColorStop(1, `rgba(${sr},${sg},${sb},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, rx, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.restore();
      }
    },
  },
  "gas-turbulence": {
    paint(ctx, size, layer, _rng, phase = 0, descriptor = null, fieldCache = null) {
      void _rng;
      void phase;
      if (!descriptor || descriptor.bodyType !== "gasGiant" || !fieldCache) return;
      const p = layer.params || {};
      const intensity = clamp(Number(p.intensity) || 0.2, 0.02, 0.55);
      if (!(intensity > 0.01)) return;
      const patchiness = clamp(Number(p.patchiness) || 0.2, 0, 1);
      const family = normalizeGasFamily(p.family || descriptor?.gasVisual?.family || "banded");
      const turbScaleMul = clamp(Number(descriptor?.gasVisual?.turbScale) || 1, 0.2, 3);
      const noiseWarpMul = clamp(Number(descriptor?.gasVisual?.noiseWarp) || 1, 0.3, 2.5);
      const fieldKey = JSON.stringify({
        type: "gas-turbulence-field",
        size,
        seed: descriptor.seed,
        lod: descriptor.lod,
        family,
        intensity,
        patchiness,
        turbScaleMul,
        noiseWarpMul,
      });
      let field = fieldCache.fields.get(fieldKey);
      if (!field) {
        const { dirX, dirY, dirZ, latAbs } = getDirectionField(fieldCache);
        const count = size * size;
        const noise = new Float32Array(count);
        const patch = new Float32Array(count);
        const seedBase = Math.floor(hashUnit(`${descriptor.seed}:gas-turbulence`) * 100000);
        for (let i = 0; i < count; i += 1) {
          const dx = dirX[i];
          const dy = dirY[i];
          const dz = dirZ[i];
          const macro = sampleWarpedNoise3(
            dx,
            dy,
            dz,
            4.4 * turbScaleMul,
            seedBase + 33,
            0.22 * noiseWarpMul,
            4,
            2.08,
            0.54,
          );
          const micro = sampleWarpedNoise3(
            dx,
            dy,
            dz,
            12.8 * turbScaleMul,
            seedBase + 89,
            0.16 * noiseWarpMul,
            3,
            2.14,
            0.52,
          );
          const pt = sampleWarpedNoise3(
            dx,
            dy,
            dz,
            7.4,
            seedBase + 147,
            0.2 * noiseWarpMul,
            3,
            2.1,
            0.52,
          );
          const latFade =
            family === "solid" ? 0.55 + (1 - latAbs[i]) * 0.28 : 0.72 + (1 - latAbs[i]) * 0.34;
          noise[i] = clamp((macro * 0.66 + micro * 0.34) * latFade, 0, 1);
          patch[i] = pt;
        }
        field = { noise, patch };
        fieldCache.fields.set(fieldKey, field);
      }

      const image = ctx.getImageData(0, 0, size, size);
      const data = image.data;
      const count = size * size;
      const warmBias = family === "hazy" ? 0.46 : family === "solid" ? 0.34 : 0.4;
      for (let i = 0; i < count; i += 1) {
        const n = (field.noise[i] - 0.5) * 2;
        const patchMask = lerp(1, 0.58 + field.patch[i] * 0.84, patchiness);
        const local = intensity * patchMask * (0.28 + Math.abs(n) * 0.46);
        if (!(local > 0.001)) continue;
        const di = i * 4;
        const baseR = data[di];
        const baseG = data[di + 1];
        const baseB = data[di + 2];
        const shift = n * local;
        if (shift >= 0) {
          data[di] = Math.round(clamp(lerp(baseR, baseR + 30 * (warmBias + 0.25), shift), 0, 255));
          data[di + 1] = Math.round(
            clamp(lerp(baseG, baseG + 24 * (warmBias + 0.2), shift), 0, 255),
          );
          data[di + 2] = Math.round(
            clamp(lerp(baseB, baseB + 16 * (warmBias + 0.1), shift), 0, 255),
          );
        } else {
          const depth = Math.abs(shift);
          data[di] = Math.round(clamp(lerp(baseR, baseR - 28, depth), 0, 255));
          data[di + 1] = Math.round(clamp(lerp(baseG, baseG - 26, depth), 0, 255));
          data[di + 2] = Math.round(clamp(lerp(baseB, baseB - 30, depth), 0, 255));
        }
      }
      ctx.putImageData(image, 0, 0);
    },
  },
  storms: {
    paint(ctx, size, layer, rng, phase = 0) {
      const p = layer.params || {};
      const count = Math.max(1, Math.round(Number(p.count) || 8));
      const alpha = clamp(Number(p.alpha) || 0.2, 0.04, 0.55);
      const drift = Math.sin(phase * Math.PI * 2) * size * 0.08;
      const sc = parseCssColor(String(p.colour || "rgba(255,255,255,1)"), "#ffffff", 1);
      const sr = Math.round(sc.r);
      const sg = Math.round(sc.g);
      const sb = Math.round(sc.b);
      for (let i = 0; i < count; i += 1) {
        const x = (rng() * size + drift + size) % size;
        const y = rng() * size;
        const r = size * (0.03 + rng() * 0.1);
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, `rgba(${sr},${sg},${sb},${alpha * (0.4 + rng() * 0.3)})`);
        grad.addColorStop(1, `rgba(${sr},${sg},${sb},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  "ice-coverage": {
    paint(ctx, size, layer) {
      const p = layer.params || {};
      const coverage = clamp(Number(p.coverage) || 0, 0, 1);
      if (!(coverage > 0.01)) return;
      const colour = p.colour || "#e8f0ff";
      const grad = ctx.createRadialGradient(
        size * 0.35,
        size * 0.3,
        size * 0.02,
        size * 0.5,
        size * 0.5,
        size * 0.6,
      );
      grad.addColorStop(0, rgba(colour, clamp(coverage * 0.42, 0.1, 0.5)));
      grad.addColorStop(1, rgba(colour, clamp(coverage * 0.14, 0.04, 0.24)));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    },
  },
  fractures: {
    paint(ctx, size, layer, rng) {
      const p = layer.params || {};
      const count = Math.max(1, Math.round(Number(p.count) || 6));
      const colour = p.colour || "#8fd5ff";
      const alpha = clamp(Number(p.alpha) || 0.28, 0.08, 0.7);
      ctx.strokeStyle = rgba(colour, alpha);
      ctx.lineWidth = Math.max(1, size * 0.0032);
      for (let i = 0; i < count; i += 1) {
        const x0 = rng() * size;
        const y0 = rng() * size;
        const len = size * (0.16 + rng() * 0.35);
        const ang = rng() * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(
          x0 + Math.cos(ang + 0.9) * len * 0.55,
          y0 + Math.sin(ang + 0.9) * len * 0.55,
          x0 + Math.cos(ang) * len,
          y0 + Math.sin(ang) * len,
        );
        ctx.stroke();
      }
    },
  },
  "molten-fissures": {
    paint(ctx, size, layer, rng) {
      const p = layer.params || {};
      const count = Math.max(1, Math.round(Number(p.count) || 4));
      const alpha = clamp(Number(p.alpha) || 0.28, 0.08, 0.6);
      const lineWidth = Math.max(1, size * 0.0034);
      for (let i = 0; i < count; i += 1) {
        const x0 = rng() * size;
        const y0 = rng() * size;
        const len = size * (0.13 + rng() * 0.32);
        const ang = rng() * Math.PI * 2;
        ctx.strokeStyle = `rgba(255,200,110,${alpha * 0.9})`;
        ctx.lineWidth = lineWidth * 1.9;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(
          x0 + Math.cos(ang + 0.6) * len * 0.4,
          y0 + Math.sin(ang + 0.6) * len * 0.4,
          x0 + Math.cos(ang) * len,
          y0 + Math.sin(ang) * len,
        );
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,112,36,${alpha})`;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }
    },
  },
  "volcanic-system": {
    paint(ctx, size, layer, _rng, phase = 0, descriptor = null) {
      void _rng;
      const p = layer.params || {};
      const hotspotCount = Math.max(1, Math.round(Number(p.hotspots) || 6));
      const glowAlpha = clamp(Number(p.glowAlpha) || 0.3, 0.08, 0.62);
      const flowAlpha = clamp(Number(p.flowAlpha) || 0.22, 0.05, 0.5);
      const depositAlpha = clamp(Number(p.depositAlpha) || 0.14, 0.04, 0.36);
      const seed = `${descriptor?.seed || "moon"}:${descriptor?.profileId || "volcanic"}:${hotspotCount}`;
      const vrng = createSeededRng(seed);
      const hotspots = [];
      const phaseDrift = Math.sin(phase * Math.PI * 2) * 0.08;
      const depositA = p.depositA || "#f4d38b";
      const depositB = p.depositB || "#bf7d46";
      const ventGlow = p.ventGlow || "#ffb26b";
      const ventCore = p.ventCore || "#ffe4bb";
      const flowColour = p.flowColour || "#2f221a";

      for (let i = 0; i < hotspotCount; i += 1) {
        hotspots.push({
          x: size * (0.14 + vrng() * 0.72),
          y: size * (0.14 + vrng() * 0.72),
          radius: 0.008 + vrng() * 0.03,
          angle: vrng() * Math.PI * 2,
        });
      }

      for (const vent of hotspots) {
        const plumeCount = 2 + Math.floor(vrng() * 3);
        for (let i = 0; i < plumeCount; i += 1) {
          const angle = vent.angle + (vrng() - 0.5) * 1.6;
          const offset = size * (vent.radius * (1.2 + vrng() * 2.8));
          const x = vent.x + Math.cos(angle) * offset;
          const y = vent.y + Math.sin(angle) * offset;
          const r = size * (vent.radius * (2.2 + vrng() * 3.1));
          const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
          const colour = vrng() > 0.45 ? depositA : depositB;
          grad.addColorStop(0, rgba(colour, depositAlpha * (0.42 + vrng() * 0.42)));
          grad.addColorStop(0.6, rgba(colour, depositAlpha * (0.18 + vrng() * 0.26)));
          grad.addColorStop(1, rgba(colour, 0));
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.ellipse(x, y, r, r * (0.58 + vrng() * 0.62), angle, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      for (const vent of hotspots) {
        const branchCount = 1 + Math.floor(vrng() * 3);
        for (let b = 0; b < branchCount; b += 1) {
          let x = vent.x;
          let y = vent.y;
          let a = vent.angle + (vrng() - 0.5) * 1.8 + phaseDrift;
          const length = size * (0.045 + vrng() * 0.13);
          const steps = 4 + Math.floor(vrng() * 5);
          const stepLen = length / steps;
          const points = [{ x, y }];
          for (let i = 0; i < steps; i += 1) {
            a += (vrng() - 0.5) * 0.65;
            x += Math.cos(a) * stepLen * (0.74 + vrng() * 0.54);
            y += Math.sin(a) * stepLen * (0.74 + vrng() * 0.54);
            points.push({ x, y });
          }

          ctx.strokeStyle = rgba(flowColour, flowAlpha * (0.4 + vrng() * 0.4));
          ctx.lineWidth = Math.max(0.75, size * (0.002 + vent.radius * 0.06));
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
          ctx.stroke();

          const tip = points[points.length - 1];
          const heat = ctx.createLinearGradient(vent.x, vent.y, tip.x, tip.y);
          heat.addColorStop(0, rgba(ventGlow, glowAlpha * (0.74 + vrng() * 0.16)));
          heat.addColorStop(0.42, rgba("#ff8a3c", glowAlpha * 0.45));
          heat.addColorStop(1, rgba("#ff8a3c", 0));
          ctx.strokeStyle = heat;
          ctx.lineWidth = Math.max(0.45, size * (0.0012 + vent.radius * 0.03));
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
          ctx.stroke();
        }
      }

      for (const vent of hotspots) {
        const coreR = size * (vent.radius * 0.58 + 0.004);
        const haloR = coreR * (2.4 + vrng() * 1.6);
        ctx.fillStyle = rgba("#20140f", clamp(flowAlpha * 0.48, 0.08, 0.32));
        ctx.beginPath();
        ctx.arc(vent.x, vent.y, coreR * 1.28, 0, Math.PI * 2);
        ctx.fill();
        const glow = ctx.createRadialGradient(vent.x, vent.y, 0, vent.x, vent.y, haloR);
        glow.addColorStop(0, rgba(ventCore, glowAlpha * (0.84 + vrng() * 0.12)));
        glow.addColorStop(0.46, rgba(ventGlow, glowAlpha * (0.44 + vrng() * 0.2)));
        glow.addColorStop(1, rgba(ventGlow, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(vent.x, vent.y, haloR, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  "dune-streaks": {
    paint(ctx, size, layer, rng) {
      const p = layer.params || {};
      const count = Math.max(1, Math.round(Number(p.count) || 48));
      const alpha = clamp(Number(p.alpha) || 0.16, 0.04, 0.4);
      const colour = p.colour || "#c9945f";
      for (let i = 0; i < count; i += 1) {
        const x = rng() * size;
        const y = rng() * size;
        const rx = size * (0.016 + rng() * 0.056);
        const ry = rx * (0.08 + rng() * 0.22);
        const rot = rng() * Math.PI;
        ctx.fillStyle = rgba(colour, alpha * (0.45 + rng() * 0.45));
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  "caustic-bloom": {
    paint(ctx, size, layer, rng) {
      const p = layer.params || {};
      const colour = p.colour || "#5ec6ff";
      const strength = clamp(Number(p.strength) || 0.2, 0.04, 0.45);
      const count = Math.max(2, Math.round(18 + strength * 45));
      for (let i = 0; i < count; i += 1) {
        const x = rng() * size;
        const y = rng() * size;
        const r = size * (0.01 + rng() * 0.045);
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, rgba("#ffffff", strength * (0.22 + rng() * 0.2)));
        grad.addColorStop(0.6, rgba(colour, strength * (0.12 + rng() * 0.2)));
        grad.addColorStop(1, rgba(colour, 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  "terminator-band": {
    paint(ctx, size, layer) {
      const p = layer.params || {};
      const width = clamp(Number(p.width) || 0.45, 0.12, 0.75);
      const alpha = clamp(Number(p.alpha) || 0.24, 0.05, 0.6);
      const angle = ((Number(p.angleDeg) || 0) * Math.PI) / 180;
      const cx = size * 0.5;
      const cy = size * 0.5;
      const len = size * 0.78;
      const dx = Math.cos(angle) * len;
      const dy = Math.sin(angle) * len;
      const grad = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
      grad.addColorStop(0, `rgba(0,0,0,${alpha})`);
      grad.addColorStop(Math.max(0.05, 0.5 - width * 0.5), `rgba(0,0,0,${alpha * 0.65})`);
      grad.addColorStop(0.5, "rgba(0,0,0,0)");
      grad.addColorStop(Math.min(0.95, 0.5 + width * 0.5), `rgba(0,0,0,${alpha * 0.65})`);
      grad.addColorStop(1, `rgba(0,0,0,${alpha})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    },
  },
  "impact-rays": {
    paint(ctx, size, layer, rng) {
      const p = layer.params || {};
      const count = Math.max(1, Math.round(Number(p.count) || 8));
      const alpha = clamp(Number(p.alpha) || 0.14, 0.04, 0.45);
      const colour = p.colour || "#efe2cf";
      for (let i = 0; i < count; i += 1) {
        const cx = rng() * size;
        const cy = rng() * size;
        const rays = Math.max(4, Math.round(7 + rng() * 9));
        const baseR = size * (0.018 + rng() * 0.055);
        for (let r = 0; r < rays; r += 1) {
          const angle = (r / rays) * Math.PI * 2 + rng() * 0.42;
          const len = baseR * (2.2 + rng() * 3.8);
          const x1 = cx + Math.cos(angle) * baseR * 0.35;
          const y1 = cy + Math.sin(angle) * baseR * 0.35;
          const x2 = cx + Math.cos(angle) * len;
          const y2 = cy + Math.sin(angle) * len;
          const grad = ctx.createLinearGradient(x1, y1, x2, y2);
          grad.addColorStop(0, rgba(colour, alpha * (0.45 + rng() * 0.35)));
          grad.addColorStop(1, rgba(colour, 0));
          ctx.strokeStyle = grad;
          ctx.lineWidth = Math.max(0.6, size * 0.0018);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }
    },
  },
  "rift-lines": {
    paint(ctx, size, layer, rng) {
      const p = layer.params || {};
      const count = Math.max(1, Math.round(Number(p.count) || 10));
      const alpha = clamp(Number(p.alpha) || 0.18, 0.06, 0.45);
      const colour = p.colour || "#9ed7ff";
      for (let i = 0; i < count; i += 1) {
        const x0 = rng() * size;
        const y0 = rng() * size;
        const len = size * (0.14 + rng() * 0.28);
        const bend = (rng() - 0.5) * len * 0.7;
        const angle = rng() * Math.PI * 2;
        const x1 = x0 + Math.cos(angle) * len;
        const y1 = y0 + Math.sin(angle) * len;
        const cx = x0 + Math.cos(angle + Math.PI / 2) * bend;
        const cy = y0 + Math.sin(angle + Math.PI / 2) * bend;
        ctx.strokeStyle = rgba(colour, alpha * 0.75);
        ctx.lineWidth = Math.max(0.8, size * 0.0026);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(cx, cy, x1, y1);
        ctx.stroke();
      }
    },
  },
  "plume-haze": {
    paint(ctx, size, layer, rng) {
      const p = layer.params || {};
      const count = Math.max(1, Math.round(Number(p.count) || 6));
      const alpha = clamp(Number(p.alpha) || 0.14, 0.05, 0.4);
      const colour = p.colour || "#c8f3ff";
      for (let i = 0; i < count; i += 1) {
        const x = size * (0.15 + rng() * 0.7);
        const y = size * (0.15 + rng() * 0.7);
        const r = size * (0.035 + rng() * 0.09);
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, rgba(colour, alpha * (0.4 + rng() * 0.4)));
        grad.addColorStop(1, rgba(colour, 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(x, y, r * 0.45, r, rng() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  "band-shear": {
    paint(ctx, size, layer, rng, phase = 0) {
      const p = layer.params || {};
      const count = Math.max(1, Math.round(Number(p.count) || 14));
      const alpha = clamp(Number(p.alpha) || 0.1, 0.03, 0.3);
      const colour = p.colour || "#d7e6ff";
      const drift = Math.sin(phase * Math.PI * 2) * size * 0.03;
      for (let i = 0; i < count; i += 1) {
        const y = ((i + 0.5) / count) * size + (rng() - 0.5) * size * 0.05;
        const amp = size * (0.01 + rng() * 0.03);
        const wave = 0.6 + rng() * 1.8;
        ctx.strokeStyle = rgba(colour, alpha * (0.5 + rng() * 0.5));
        ctx.lineWidth = Math.max(0.6, size * 0.0018);
        ctx.beginPath();
        for (let x = 0; x <= size; x += size / 40) {
          const yy = y + Math.sin((x / size) * Math.PI * 2 * wave + drift + rng() * 0.4) * amp;
          if (x === 0) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
    },
  },
  "storm-fronts": {
    paint(ctx, size, layer, rng) {
      const p = layer.params || {};
      const count = Math.max(1, Math.round(Number(p.count) || 6));
      const alpha = clamp(Number(p.alpha) || 0.16, 0.04, 0.45);
      const colour = p.colour || "#f0f6ff";
      for (let i = 0; i < count; i += 1) {
        const x = rng() * size;
        const y = rng() * size;
        const r = size * (0.08 + rng() * 0.2);
        const a0 = rng() * Math.PI * 2;
        const arc = Math.PI * (0.4 + rng() * 0.8);
        const grad = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
        grad.addColorStop(0, rgba(colour, alpha * 0.45));
        grad.addColorStop(1, rgba(colour, 0));
        ctx.strokeStyle = grad;
        ctx.lineWidth = Math.max(1, size * 0.0032);
        ctx.beginPath();
        ctx.arc(x, y, r, a0, a0 + arc);
        ctx.stroke();
      }
    },
  },
  "polar-haze": {
    paint(ctx, size, layer) {
      const p = layer.params || {};
      const alpha = clamp(Number(p.alpha) || 0.14, 0.04, 0.35);
      const colour = p.colour || "#d9ecff";
      const north = ctx.createRadialGradient(
        size * 0.5,
        size * 0.06,
        0,
        size * 0.5,
        size * 0.06,
        size * 0.36,
      );
      north.addColorStop(0, rgba(colour, alpha));
      north.addColorStop(1, rgba(colour, 0));
      ctx.fillStyle = north;
      ctx.fillRect(0, 0, size, size * 0.46);
      const south = ctx.createRadialGradient(
        size * 0.5,
        size * 0.94,
        0,
        size * 0.5,
        size * 0.94,
        size * 0.36,
      );
      south.addColorStop(0, rgba(colour, alpha));
      south.addColorStop(1, rgba(colour, 0));
      ctx.fillStyle = south;
      ctx.fillRect(0, size * 0.54, size, size * 0.46);
    },
  },
};

export function paintCelestialTexture(ctx, size, descriptor, phase = 0) {
  if (!ctx || !(size > 0) || !descriptor) return;
  ctx.clearRect(0, 0, size, size);
  const rng = createSeededRng(`${descriptor.seed}:${descriptor.lod}:${Math.round(phase * 1000)}`);
  const fieldCache = getRenderFieldCache(descriptor, size, phase);

  for (const layer of descriptor.layers || []) {
    // Clouds are rendered by the dedicated volumetric-ish cloud map pipeline.
    if (layer?.id === "clouds") continue;
    const mod = LAYER_MODULES[layer.id];
    if (!mod?.paint) continue;
    mod.paint(ctx, size, layer, rng, phase, descriptor, fieldCache);
  }
}
