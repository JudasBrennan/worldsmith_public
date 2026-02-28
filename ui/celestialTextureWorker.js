import { createSeededRng } from "../engine/stellarActivity.js";
import { clamp } from "../engine/utils.js";
import { paintCelestialTexture } from "./celestialComposer.js";

function hashUnit(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function hexToRgb(hex, fallback = "#ffffff") {
  const raw = String(hex || fallback)
    .trim()
    .replace(/^#/, "");
  const full = raw.length === 3 ? raw.replace(/(.)/g, "$1$1") : raw;
  const safe = /^[0-9a-fA-F]{6}$/.test(full) ? full : fallback.replace(/^#/, "");
  return {
    r: parseInt(safe.slice(0, 2), 16),
    g: parseInt(safe.slice(2, 4), 16),
    b: parseInt(safe.slice(4, 6), 16),
  };
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

function createCanvas(width, height) {
  if (typeof OffscreenCanvas === "undefined") {
    throw new Error("OffscreenCanvas unavailable");
  }
  return new OffscreenCanvas(Math.max(1, width), Math.max(1, height));
}

function getCanvas2dContext(canvas, { readback = false } = {}) {
  if (!canvas?.getContext) return null;
  if (readback) {
    return canvas.getContext("2d", { willReadFrequently: true }) || canvas.getContext("2d") || null;
  }
  return canvas.getContext("2d") || null;
}

function makeFlatMapCanvas(width, height, [r, g, b, a = 255]) {
  const canvas = createCanvas(width, height);
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

function hasLayer(descriptor, id, predicate = null) {
  if (!descriptor || !Array.isArray(descriptor.layers)) return false;
  for (const layer of descriptor.layers) {
    if (layer?.id !== id) continue;
    if (!predicate || predicate(layer)) return true;
  }
  return false;
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

  const normalCanvas = createCanvas(width, height);
  const normalCtx = getCanvas2dContext(normalCanvas, { readback: true });

  const roughnessCanvas = createCanvas(width, height);
  const roughnessCtx = getCanvas2dContext(roughnessCanvas, { readback: true });

  const emissiveCanvas = createCanvas(width, height);
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

function imageDataFromCanvas(canvas) {
  const ctx = getCanvas2dContext(canvas, { readback: true });
  if (!ctx) return null;
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function buildTextureMapPayloads(descriptor, textureSize) {
  const flattenStyleMaps = shouldFlattenStyleMaps(descriptor);
  const flattenAuxMaps = flattenStyleMaps && descriptor?.bodyType === "gasGiant";
  const textureCanvas = createCanvas(textureSize, textureSize);
  const tctx = getCanvas2dContext(textureCanvas, { readback: true });
  if (!tctx) throw new Error("Unable to acquire surface context");
  paintCelestialTexture(tctx, textureSize, descriptor, 0);

  const proceduralFields = buildProceduralSurfaceFields(descriptor, textureSize, textureSize);
  applyProceduralSurfaceDetail(textureCanvas, descriptor, proceduralFields);

  const cloudCanvas = createCanvas(textureSize, textureSize);
  const cctx = getCanvas2dContext(cloudCanvas, { readback: true });
  if (!cctx) throw new Error("Unable to acquire cloud context");
  paintCloudTexture(cctx, textureSize, descriptor);
  blendHorizontalSeam(cloudCanvas, 10);
  if (flattenStyleMaps) {
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

  const surface = imageDataFromCanvas(textureCanvas);
  const cloud = imageDataFromCanvas(cloudCanvas);
  const normal = imageDataFromCanvas(normalCanvas);
  const roughness = imageDataFromCanvas(roughnessCanvas);
  const emissive = imageDataFromCanvas(emissiveCanvas);
  if (!surface || !cloud || !normal || !roughness || !emissive) {
    throw new Error("Failed to read generated texture maps");
  }

  return {
    surface: { width: surface.width, height: surface.height, buffer: surface.data.buffer },
    cloud: { width: cloud.width, height: cloud.height, buffer: cloud.data.buffer },
    normal: { width: normal.width, height: normal.height, buffer: normal.data.buffer },
    roughness: { width: roughness.width, height: roughness.height, buffer: roughness.data.buffer },
    emissive: { width: emissive.width, height: emissive.height, buffer: emissive.data.buffer },
  };
}

self.onmessage = (event) => {
  const msg = event?.data || {};
  const id = Number(msg.id);
  const textureSize = clamp(Math.max(64, Number(msg.textureSize) || 0), 64, 4096);
  const descriptor = msg.descriptor || null;
  if (!Number.isFinite(id) || !descriptor || !(textureSize > 0)) {
    self.postMessage({
      id,
      ok: false,
      signature: msg.signature || "",
      error: "Invalid celestial texture worker payload",
    });
    return;
  }

  try {
    const maps = buildTextureMapPayloads(descriptor, textureSize);
    const transfers = [
      maps.surface.buffer,
      maps.cloud.buffer,
      maps.normal.buffer,
      maps.roughness.buffer,
      maps.emissive.buffer,
    ];
    self.postMessage(
      {
        id,
        ok: true,
        signature: msg.signature || "",
        maps,
      },
      transfers,
    );
  } catch (err) {
    self.postMessage({
      id,
      ok: false,
      signature: msg.signature || "",
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
