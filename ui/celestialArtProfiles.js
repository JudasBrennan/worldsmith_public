// SPDX-License-Identifier: MPL-2.0
import { clamp } from "../engine/utils.js";

function normalizeId(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function countByDetail(detail, base, span) {
  return Math.max(1, Math.round(base + span * clamp(Number(detail) || 0.68, 0.2, 1.4)));
}

function continentsShapeParams(overrides = {}) {
  return {
    mode: "heightfield",
    landFraction: 0.42,
    macroScale: 1.04,
    warp: 0.24,
    coastErode: 0.24,
    ridgeStrength: 0.36,
    edgeSoftness: 0.028,
    ...overrides,
  };
}

function cloudFieldParams(overrides = {}) {
  return {
    coverage: 0.44,
    macroScale: 4.3,
    detailScale: 28,
    warp: 0.2,
    edgeSoftness: 0.036,
    latitudeBands: 3.1,
    aniso: 0.24,
    selfShadow: 0.66,
    ...overrides,
  };
}

function gasBandFlowParams(overrides = {}) {
  return {
    mode: "dynamic",
    family: "banded",
    hasVisibleBands: true,
    bandCount: 8,
    bandContrast: 0.58,
    turbulence: 0.3,
    shearStrength: 0.26,
    bandWiggle: 0.032,
    latProfile: "jovian",
    stormCoupling: 0.56,
    patchiness: 0.24,
    wiggleScale: 1,
    shearScale: 1,
    turbScale: 1,
    patchScale: 1,
    noiseWarp: 1,
    ...overrides,
  };
}

function gasVisualParams(overrides = {}) {
  return {
    family: "banded",
    hasVisibleBands: true,
    bandCount: 8,
    bandContrast: 0.58,
    turbulence: 0.34,
    shearStrength: 0.24,
    bandWiggle: 0.032,
    latProfile: "jovian",
    stormCoupling: 0.56,
    patchiness: 0.24,
    hazeStrength: 0.1,
    polarHaze: 0.16,
    wiggleScale: 1,
    shearScale: 1,
    turbScale: 1,
    patchScale: 1,
    noiseWarp: 1,
    ...overrides,
  };
}

function rockyFallbackId(model = {}) {
  const profile = model.visualProfile || {};
  const oceanCoverage = clamp(Number(profile?.ocean?.coverage) || 0, 0, 1);
  const cloudCoverage = clamp(Number(profile?.clouds?.coverage) || 0, 0, 1);
  const craterDensity = clamp(Number(profile?.terrain?.craterDensity) || 0, 0, 1);
  if (profile?.special === "lava") return "lava-world";
  if (profile?.tidallyLocked) return "tidally-locked";
  if (oceanCoverage >= 0.92) return "water-world";
  if (oceanCoverage >= 0.7) return "archipelago";
  if (craterDensity > 0.62) return "cratered-husk";
  if (cloudCoverage > 0.8) return "venus-shroud";
  return "blue-marble";
}

function moonFallbackId(model = {}) {
  const profile = model.moonProfile || {};
  const displayClass = String(profile.displayClass || "").toLowerCase();
  const special = String(profile.special || "").toLowerCase();
  const tidalIntensity = Number(profile?.tidalHeating?.intensity) || 0;
  if (special === "volcanic" || special === "molten" || tidalIntensity > 0.6) return "io";
  if (special === "subsurface-ocean") return "europa";
  if (displayClass.includes("icy")) return "ganymede";
  if (displayClass.includes("dark")) return "callisto";
  return "luna";
}

function gasFallbackId(model = {}) {
  const style = normalizeId(model.styleId);
  if (style) return style;
  const recipe = normalizeId(model.recipeId);
  if (recipe === "silicate-cloud") return "silicate";
  if (recipe === "hazy-giant") return "hazy";
  return "jupiter";
}

function rockyProfileById(profileId, model, detail) {
  const p = model.visualProfile || {};
  const oceanColour = p?.ocean?.colour || "#2b6ea5";
  const atmosphereColour = p?.atmosphere?.colour || "#7ea2d8";
  const cloudColour = p?.clouds?.colour || "#ffffff";
  switch (profileId) {
    case "blue-marble":
      return {
        profileId,
        layerEdits: [
          {
            id: "continents",
            params: continentsShapeParams({
              landFraction: 0.39,
              macroScale: 1.06,
              warp: 0.24,
              coastErode: 0.22,
              ridgeStrength: 0.34,
              alpha: 0.45,
            }),
          },
          {
            id: "clouds",
            params: {
              count: countByDetail(detail, 16, 34),
              alpha: 0.24,
              ...cloudFieldParams({
                coverage: 0.44,
                macroScale: 4.4,
                detailScale: 30,
                latitudeBands: 3.2,
                aniso: 0.24,
                selfShadow: 0.68,
              }),
            },
          },
          { id: "vegetation", params: { count: countByDetail(detail, 18, 26), alpha: 0.28 } },
        ],
        appendLayers: [{ id: "caustic-bloom", params: { colour: oceanColour, strength: 0.22 } }],
        atmosphere: { colour: atmosphereColour, opacity: 0.18, scale: 1.08 },
        clouds: {
          colour: cloudColour,
          opacity: 0.23,
          driftFactor: 1.38,
          params: cloudFieldParams({
            coverage: 0.44,
            macroScale: 4.4,
            detailScale: 30,
            latitudeBands: 3.2,
            aniso: 0.24,
            selfShadow: 0.68,
          }),
        },
      };
    case "tropical-jungle":
      return {
        profileId,
        layerEdits: [
          { id: "vegetation", params: { count: countByDetail(detail, 26, 40), alpha: 0.4 } },
          {
            id: "clouds",
            params: {
              count: countByDetail(detail, 22, 42),
              alpha: 0.32,
              ...cloudFieldParams({
                coverage: 0.58,
                macroScale: 4.9,
                detailScale: 32,
                latitudeBands: 3.8,
                aniso: 0.28,
                selfShadow: 0.74,
              }),
            },
          },
        ],
        appendLayers: [
          {
            id: "storm-fronts",
            params: { count: countByDetail(detail, 3, 5), colour: "#dff2ff", alpha: 0.18 },
          },
        ],
        atmosphere: { colour: "#8db6e8", opacity: 0.2, scale: 1.09 },
        clouds: {
          colour: "#f8ffff",
          opacity: 0.28,
          driftFactor: 1.46,
          params: cloudFieldParams({
            coverage: 0.58,
            macroScale: 4.9,
            detailScale: 32,
            latitudeBands: 3.8,
            aniso: 0.28,
            selfShadow: 0.74,
          }),
        },
      };
    case "arid-steppe":
      return {
        profileId,
        layerEdits: [
          {
            id: "continents",
            params: continentsShapeParams({
              landFraction: 0.62,
              macroScale: 0.98,
              warp: 0.2,
              coastErode: 0.18,
              ridgeStrength: 0.5,
              alpha: 0.57,
            }),
          },
        ],
        appendLayers: [
          { id: "dune-streaks", params: { count: countByDetail(detail, 36, 60), alpha: 0.18 } },
        ],
        atmosphere: { colour: "#b8a97c", opacity: 0.09, scale: 1.03 },
      };
    case "tidally-locked":
      return {
        profileId,
        appendLayers: [
          { id: "terminator-band", params: { angleDeg: 8, width: 0.46, alpha: 0.28 } },
        ],
        layerEdits: [
          {
            id: "clouds",
            params: {
              count: countByDetail(detail, 12, 24),
              alpha: 0.2,
              ...cloudFieldParams({
                coverage: 0.36,
                macroScale: 3.8,
                detailScale: 24,
                latitudeBands: 2.4,
                aniso: 0.2,
                selfShadow: 0.62,
              }),
            },
          },
        ],
        atmosphere: { colour: atmosphereColour, opacity: 0.16, scale: 1.07 },
      };
    case "red-desert":
      return {
        profileId,
        layerEdits: [
          {
            id: "continents",
            params: continentsShapeParams({
              landFraction: 0.74,
              macroScale: 0.94,
              warp: 0.18,
              coastErode: 0.14,
              ridgeStrength: 0.62,
              alpha: 0.6,
            }),
          },
          { id: "craters", params: { count: countByDetail(detail, 14, 26), alpha: 0.3 } },
        ],
        appendLayers: [
          {
            id: "dune-streaks",
            params: { count: countByDetail(detail, 44, 64), alpha: 0.22, colour: "#c88a58" },
          },
          { id: "impact-rays", params: { count: countByDetail(detail, 6, 10), alpha: 0.11 } },
        ],
        atmosphere: { colour: "#b97d5c", opacity: 0.08, scale: 1.03 },
      };
    case "cratered-husk":
      return {
        profileId,
        layerEdits: [
          { id: "craters", params: { count: countByDetail(detail, 28, 56), alpha: 0.42 } },
        ],
        appendLayers: [
          { id: "impact-rays", params: { count: countByDetail(detail, 10, 16), alpha: 0.17 } },
        ],
        atmosphere: { enabled: false, opacity: 0, scale: 1 },
        clouds: { enabled: false, opacity: 0, scale: 1.02 },
      };
    case "iron-fortress":
      return {
        profileId,
        layerEdits: [
          { id: "continents", params: { count: countByDetail(detail, 6, 8), alpha: 0.62 } },
        ],
        appendLayers: [
          {
            id: "rift-lines",
            params: { count: countByDetail(detail, 8, 14), alpha: 0.2, colour: "#9ca6b8" },
          },
        ],
        atmosphere: { colour: "#8c9ab3", opacity: 0.07, scale: 1.025 },
      };
    case "pale-mantle":
      return {
        profileId,
        layerEdits: [
          { id: "continents", params: { count: countByDetail(detail, 12, 18), alpha: 0.43 } },
        ],
        appendLayers: [
          {
            id: "rift-lines",
            params: { count: countByDetail(detail, 10, 18), alpha: 0.14, colour: "#d7bf9c" },
          },
        ],
        atmosphere: { colour: "#a3b6d2", opacity: 0.12, scale: 1.05 },
      };
    case "lava-world":
      return {
        profileId,
        layerEdits: [
          {
            id: "volcanic-system",
            params: {
              hotspots: countByDetail(detail, 8, 14),
              glowAlpha: 0.46,
              flowAlpha: 0.32,
              depositAlpha: 0.22,
            },
          },
          {
            id: "clouds",
            params: {
              count: countByDetail(detail, 10, 20),
              alpha: 0.18,
              colour: "#ffbf8f",
              ...cloudFieldParams({
                coverage: 0.24,
                macroScale: 3.4,
                detailScale: 22,
                warp: 0.18,
                latitudeBands: 2,
                aniso: 0.16,
                selfShadow: 0.52,
              }),
            },
          },
        ],
        appendLayers: [
          {
            id: "rift-lines",
            params: { count: countByDetail(detail, 12, 18), alpha: 0.28, colour: "#ff8d42" },
          },
        ],
        atmosphere: { colour: "#ff9d66", opacity: 0.18, scale: 1.09 },
      };
    case "venus-shroud":
      return {
        profileId,
        layerEdits: [
          {
            id: "clouds",
            params: {
              count: countByDetail(detail, 30, 52),
              alpha: 0.52,
              colour: "#e8d3ab",
              ...cloudFieldParams({
                coverage: 0.86,
                macroScale: 5.2,
                detailScale: 30,
                warp: 0.24,
                latitudeBands: 1.8,
                aniso: 0.12,
                selfShadow: 0.7,
              }),
            },
          },
        ],
        appendLayers: [
          {
            id: "storm-fronts",
            params: { count: countByDetail(detail, 5, 10), colour: "#f1e0be", alpha: 0.2 },
          },
        ],
        atmosphere: { colour: "#d9b58f", opacity: 0.28, scale: 1.13 },
        clouds: {
          colour: "#ecd6b4",
          opacity: 0.48,
          driftFactor: 1.24,
          params: cloudFieldParams({
            coverage: 0.86,
            macroScale: 5.2,
            detailScale: 30,
            warp: 0.24,
            latitudeBands: 1.8,
            aniso: 0.12,
            selfShadow: 0.7,
          }),
        },
      };
    case "frozen-wasteland":
      return {
        profileId,
        layerEdits: [
          { id: "craters", params: { count: countByDetail(detail, 16, 30), alpha: 0.24 } },
        ],
        appendLayers: [
          {
            id: "impact-rays",
            params: { count: countByDetail(detail, 8, 12), alpha: 0.14, colour: "#edf7ff" },
          },
          {
            id: "rift-lines",
            params: { count: countByDetail(detail, 5, 9), alpha: 0.12, colour: "#8bc6ff" },
          },
        ],
        atmosphere: { colour: "#a8c7ea", opacity: 0.1, scale: 1.04 },
      };
    case "snowball":
      return {
        profileId,
        layerEdits: [
          { id: "ocean-fill", params: { coverage: 0.97, frozen: true, colour: "#b7d6ef" } },
          {
            id: "clouds",
            params: {
              count: countByDetail(detail, 9, 16),
              alpha: 0.16,
              colour: "#eaf4ff",
              ...cloudFieldParams({
                coverage: 0.26,
                macroScale: 3.8,
                detailScale: 22,
                latitudeBands: 2.6,
                aniso: 0.18,
                selfShadow: 0.56,
              }),
            },
          },
        ],
        appendLayers: [{ id: "ice-coverage", params: { coverage: 0.95, colour: "#edf5ff" } }],
        atmosphere: { colour: "#a9c6e8", opacity: 0.08, scale: 1.03 },
      };
    case "water-world":
      return {
        profileId,
        layerEdits: [
          { id: "ocean-fill", params: { coverage: 0.97, colour: oceanColour, frozen: false } },
          {
            id: "continents",
            params: continentsShapeParams({
              landFraction: 0.08,
              macroScale: 1.22,
              warp: 0.34,
              coastErode: 0.46,
              ridgeStrength: 0.24,
              alpha: 0.22,
            }),
          },
          {
            id: "clouds",
            params: {
              count: countByDetail(detail, 18, 28),
              alpha: 0.3,
              ...cloudFieldParams({
                coverage: 0.62,
                macroScale: 4.9,
                detailScale: 34,
                warp: 0.24,
                latitudeBands: 3.8,
                aniso: 0.3,
                selfShadow: 0.74,
              }),
            },
          },
        ],
        appendLayers: [{ id: "caustic-bloom", params: { colour: oceanColour, strength: 0.3 } }],
        atmosphere: { colour: "#7fb6f0", opacity: 0.2, scale: 1.1 },
        clouds: {
          params: cloudFieldParams({
            coverage: 0.62,
            macroScale: 4.9,
            detailScale: 34,
            warp: 0.24,
            latitudeBands: 3.8,
            aniso: 0.3,
            selfShadow: 0.74,
          }),
        },
      };
    case "archipelago":
      return {
        profileId,
        layerEdits: [
          { id: "ocean-fill", params: { coverage: 0.86, colour: oceanColour, frozen: false } },
          {
            id: "continents",
            params: continentsShapeParams({
              landFraction: 0.22,
              macroScale: 1.18,
              warp: 0.32,
              coastErode: 0.42,
              ridgeStrength: 0.3,
              alpha: 0.38,
            }),
          },
          {
            id: "clouds",
            params: {
              count: countByDetail(detail, 16, 24),
              alpha: 0.25,
              ...cloudFieldParams({
                coverage: 0.5,
                macroScale: 4.6,
                detailScale: 30,
                warp: 0.22,
                latitudeBands: 3.4,
                aniso: 0.26,
                selfShadow: 0.7,
              }),
            },
          },
        ],
        appendLayers: [{ id: "caustic-bloom", params: { colour: oceanColour, strength: 0.24 } }],
        atmosphere: { colour: "#7ab0e0", opacity: 0.18, scale: 1.08 },
        clouds: {
          params: cloudFieldParams({
            coverage: 0.5,
            macroScale: 4.6,
            detailScale: 30,
            warp: 0.22,
            latitudeBands: 3.4,
            aniso: 0.26,
            selfShadow: 0.7,
          }),
        },
      };
    default:
      return {
        profileId: "blue-marble",
        layerEdits: [],
        appendLayers: [],
      };
  }
}

export function buildRockyArtProfile(model = {}, detail = 0.68) {
  const explicitId = normalizeId(model.recipeId || model?.inputs?.appearanceRecipeId);
  const profileId = explicitId || rockyFallbackId(model);
  return rockyProfileById(profileId, model, detail);
}

function moonProfileById(profileId, model, detail) {
  const moonProfile = model.moonProfile || {};
  switch (profileId) {
    case "luna":
      return {
        profileId,
        layerEdits: [
          { id: "craters", params: { count: countByDetail(detail, 24, 46), alpha: 0.36 } },
        ],
        appendLayers: [
          { id: "impact-rays", params: { count: countByDetail(detail, 10, 14), alpha: 0.16 } },
        ],
      };
    case "callisto":
      return {
        profileId,
        layerEdits: [
          { id: "craters", params: { count: countByDetail(detail, 28, 54), alpha: 0.4 } },
        ],
        appendLayers: [
          { id: "impact-rays", params: { count: countByDetail(detail, 12, 18), alpha: 0.14 } },
        ],
      };
    case "ganymede":
      return {
        profileId,
        layerEdits: [
          { id: "craters", params: { count: countByDetail(detail, 18, 32), alpha: 0.25 } },
        ],
        appendLayers: [
          {
            id: "rift-lines",
            params: { count: countByDetail(detail, 10, 18), alpha: 0.17, colour: "#b7d0df" },
          },
        ],
      };
    case "europa":
      return {
        profileId,
        layerEdits: [
          { id: "ice-coverage", params: { coverage: 0.96, colour: "#edf6ff" } },
          { id: "craters", params: { count: countByDetail(detail, 8, 12), alpha: 0.14 } },
          {
            id: "fractures",
            params: { count: countByDetail(detail, 12, 16), alpha: 0.36, colour: "#8ed6ff" },
          },
        ],
      };
    case "enceladus":
      return {
        profileId,
        layerEdits: [
          { id: "ice-coverage", params: { coverage: 0.99, colour: "#f3f9ff" } },
          {
            id: "fractures",
            params: { count: countByDetail(detail, 14, 20), alpha: 0.42, colour: "#8bd8ff" },
          },
        ],
        appendLayers: [
          {
            id: "plume-haze",
            params: { count: countByDetail(detail, 5, 9), alpha: 0.16, colour: "#c4efff" },
          },
        ],
      };
    case "titan":
      return {
        profileId,
        layerEdits: [
          { id: "craters", params: { count: countByDetail(detail, 8, 16), alpha: 0.2 } },
        ],
        appendLayers: [
          {
            id: "dune-streaks",
            params: { count: countByDetail(detail, 24, 42), alpha: 0.16, colour: "#c58d54" },
          },
          { id: "polar-haze", params: { alpha: 0.16, colour: "#d9b37e" } },
        ],
        atmosphere: { colour: "#d2a36b", opacity: 0.22, scale: 1.1 },
      };
    case "triton":
      return {
        profileId,
        layerEdits: [{ id: "ice-coverage", params: { coverage: 0.92, colour: "#e8f3ff" } }],
        appendLayers: [
          {
            id: "rift-lines",
            params: { count: countByDetail(detail, 8, 14), alpha: 0.15, colour: "#99c9ef" },
          },
          {
            id: "plume-haze",
            params: { count: countByDetail(detail, 4, 7), alpha: 0.13, colour: "#cdefff" },
          },
        ],
      };
    case "io":
      return {
        profileId,
        layerEdits: [
          { id: "craters", params: { count: countByDetail(detail, 6, 12), alpha: 0.12 } },
          {
            id: "volcanic-system",
            params: {
              hotspots: countByDetail(detail, 6, 10),
              glowAlpha: 0.42,
              flowAlpha: 0.3,
              depositAlpha: 0.22,
            },
          },
        ],
        appendLayers: [
          {
            id: "rift-lines",
            params: { count: countByDetail(detail, 4, 7), alpha: 0.1, colour: "#ff9e4e" },
          },
        ],
      };
    case "molten-companion":
      return {
        profileId,
        layerEdits: [
          {
            id: "volcanic-system",
            params: {
              hotspots: countByDetail(detail, 8, 14),
              glowAlpha: 0.5,
              flowAlpha: 0.36,
              depositAlpha: 0.26,
            },
          },
        ],
        appendLayers: [
          {
            id: "rift-lines",
            params: { count: countByDetail(detail, 6, 10), alpha: 0.13, colour: "#ff8a3d" },
          },
        ],
      };
    case "phobos":
    case "deimos":
    case "irregular-capture":
      return {
        profileId,
        layerEdits: [
          { id: "craters", params: { count: countByDetail(detail, 20, 38), alpha: 0.4 } },
        ],
        appendLayers: [
          {
            id: "impact-rays",
            params: { count: countByDetail(detail, 8, 12), alpha: 0.12, colour: "#cab7a0" },
          },
        ],
        atmosphere: { enabled: false, opacity: 0, scale: 1 },
      };
    default:
      return {
        profileId: moonProfile.special === "subsurface-ocean" ? "europa" : "luna",
        layerEdits: [],
        appendLayers: [],
      };
  }
}

export function buildMoonArtProfile(model = {}, detail = 0.68) {
  const explicitId = normalizeId(model.recipeId || model?.moonCalc?.inputs?.appearanceRecipeId);
  const profileId = explicitId || moonFallbackId(model);
  return moonProfileById(profileId, model, detail);
}

function gasProfileById(profileId, model, detail) {
  switch (profileId) {
    case "jupiter":
      return {
        profileId,
        layerEdits: [
          {
            id: "gas-bands",
            params: gasBandFlowParams({
              family: "banded",
              hasVisibleBands: true,
              bandCount: 10,
              bandContrast: 0.72,
              turbulence: 0.4,
              shearStrength: 0.3,
              bandWiggle: 0.038,
              latProfile: "jovian",
              stormCoupling: 0.7,
              patchiness: 0.26,
            }),
          },
          {
            id: "storms",
            params: { count: countByDetail(detail, 8, 14), alpha: 0.2, colour: "#f0dcc0" },
          },
          { id: "gas-spots", params: { alpha: 0.95 } },
        ],
        appendLayers: [
          { id: "band-shear", params: { count: countByDetail(detail, 14, 22), alpha: 0.12 } },
        ],
        gasVisual: gasVisualParams({
          family: "banded",
          hasVisibleBands: true,
          bandCount: 10,
          bandContrast: 0.72,
          turbulence: 0.4,
          shearStrength: 0.3,
          bandWiggle: 0.038,
          latProfile: "jovian",
          stormCoupling: 0.7,
          patchiness: 0.26,
          hazeStrength: 0.08,
          polarHaze: 0.12,
        }),
      };
    case "saturn":
      return {
        profileId,
        layerEdits: [
          {
            id: "gas-bands",
            params: gasBandFlowParams({
              family: "banded",
              hasVisibleBands: true,
              bandCount: 9,
              bandContrast: 0.52,
              turbulence: 0.26,
              shearStrength: 0.18,
              bandWiggle: 0.022,
              latProfile: "subtle",
              stormCoupling: 0.38,
              patchiness: 0.18,
              wiggleScale: 0.75,
              shearScale: 0.7,
              turbScale: 0.72,
              patchScale: 0.8,
              noiseWarp: 0.8,
            }),
          },
          {
            id: "storms",
            params: { count: countByDetail(detail, 4, 8), alpha: 0.12, colour: "#f0d898" },
          },
        ],
        appendLayers: [
          { id: "band-shear", params: { count: countByDetail(detail, 12, 18), alpha: 0.1 } },
        ],
        ring: { inner: 1.22, outer: 2.08, opacity: 0.5, yawDeg: 20, tiltDeg: 100 },
        gasVisual: gasVisualParams({
          family: "banded",
          hasVisibleBands: true,
          bandCount: 9,
          bandContrast: 0.52,
          turbulence: 0.26,
          shearStrength: 0.18,
          bandWiggle: 0.022,
          latProfile: "subtle",
          stormCoupling: 0.38,
          patchiness: 0.18,
          hazeStrength: 0.12,
          polarHaze: 0.22,
          wiggleScale: 0.75,
          shearScale: 0.7,
          turbScale: 0.72,
          patchScale: 0.8,
          noiseWarp: 0.8,
        }),
      };
    case "neptune":
      return {
        profileId,
        layerEdits: [
          {
            id: "gas-bands",
            params: gasBandFlowParams({
              family: "patchy",
              hasVisibleBands: true,
              bandCount: 5,
              bandContrast: 0.5,
              turbulence: 0.56,
              shearStrength: 0.32,
              bandWiggle: 0.046,
              latProfile: "stormy",
              stormCoupling: 0.82,
              patchiness: 0.72,
              wiggleScale: 1.3,
              shearScale: 1.1,
              turbScale: 1.2,
              patchScale: 1.4,
              noiseWarp: 1.15,
            }),
          },
          {
            id: "storms",
            params: { count: countByDetail(detail, 9, 16), alpha: 0.18, colour: "#e0f0ff" },
          },
        ],
        appendLayers: [
          {
            id: "band-shear",
            params: { count: countByDetail(detail, 16, 24), alpha: 0.12, colour: "#93d4ff" },
          },
        ],
        atmosphere: { colour: "#7dbbe8", opacity: 0.16, scale: 1.05 },
        gasVisual: gasVisualParams({
          family: "patchy",
          hasVisibleBands: true,
          bandCount: 5,
          bandContrast: 0.5,
          turbulence: 0.56,
          shearStrength: 0.32,
          bandWiggle: 0.046,
          latProfile: "stormy",
          stormCoupling: 0.82,
          patchiness: 0.72,
          hazeStrength: 0.16,
          polarHaze: 0.3,
          wiggleScale: 1.3,
          shearScale: 1.1,
          turbScale: 1.2,
          patchScale: 1.4,
          noiseWarp: 1.15,
        }),
      };
    case "neptune-classic":
      return {
        profileId,
        layerEdits: [
          {
            id: "gas-bands",
            params: gasBandFlowParams({
              family: "patchy",
              hasVisibleBands: true,
              bandCount: 5,
              bandContrast: 0.58,
              turbulence: 0.66,
              shearStrength: 0.38,
              bandWiggle: 0.054,
              latProfile: "stormy",
              stormCoupling: 0.9,
              patchiness: 0.78,
              wiggleScale: 1.45,
              shearScale: 1.3,
              turbScale: 1.4,
              patchScale: 1.5,
              noiseWarp: 1.3,
            }),
          },
          {
            id: "storms",
            params: { count: countByDetail(detail, 10, 18), alpha: 0.2, colour: "#d8e8ff" },
          },
        ],
        appendLayers: [
          {
            id: "band-shear",
            params: { count: countByDetail(detail, 18, 28), alpha: 0.14, colour: "#6aabff" },
          },
        ],
        atmosphere: { colour: "#5a9fe8", opacity: 0.2, scale: 1.06 },
        gasVisual: gasVisualParams({
          family: "patchy",
          hasVisibleBands: true,
          bandCount: 5,
          bandContrast: 0.58,
          turbulence: 0.66,
          shearStrength: 0.38,
          bandWiggle: 0.054,
          latProfile: "stormy",
          stormCoupling: 0.9,
          patchiness: 0.78,
          hazeStrength: 0.14,
          polarHaze: 0.26,
          wiggleScale: 1.45,
          shearScale: 1.3,
          turbScale: 1.4,
          patchScale: 1.5,
          noiseWarp: 1.3,
        }),
      };
    case "uranus":
      return {
        profileId,
        layerEdits: [
          {
            id: "gas-bands",
            params: gasBandFlowParams({
              family: "solid",
              hasVisibleBands: false,
              bandCount: 3,
              bandContrast: 0.2,
              turbulence: 0.18,
              shearStrength: 0.1,
              bandWiggle: 0.012,
              latProfile: "subtle",
              stormCoupling: 0.2,
              patchiness: 0.14,
              wiggleScale: 0.42,
              shearScale: 0.38,
              turbScale: 0.45,
              patchScale: 0.55,
              noiseWarp: 0.6,
            }),
          },
          {
            id: "storms",
            params: { count: countByDetail(detail, 2, 5), alpha: 0.08, colour: "#c8f0f2" },
          },
        ],
        appendLayers: [{ id: "polar-haze", params: { alpha: 0.2, colour: "#c8eefd" } }],
        atmosphere: { colour: "#a0dce8", opacity: 0.18, scale: 1.05 },
        gasVisual: gasVisualParams({
          family: "solid",
          hasVisibleBands: false,
          bandCount: 3,
          bandContrast: 0.2,
          turbulence: 0.18,
          shearStrength: 0.1,
          bandWiggle: 0.012,
          latProfile: "subtle",
          stormCoupling: 0.2,
          patchiness: 0.14,
          hazeStrength: 0.28,
          polarHaze: 0.42,
          wiggleScale: 0.42,
          shearScale: 0.38,
          turbScale: 0.45,
          patchScale: 0.55,
          noiseWarp: 0.6,
        }),
      };
    case "hot-jupiter":
      return {
        profileId,
        layerEdits: [
          {
            id: "gas-bands",
            params: gasBandFlowParams({
              family: "banded",
              hasVisibleBands: true,
              bandCount: 9,
              bandContrast: 0.78,
              turbulence: 0.64,
              shearStrength: 0.38,
              bandWiggle: 0.056,
              latProfile: "extreme",
              stormCoupling: 0.86,
              patchiness: 0.4,
              wiggleScale: 1.45,
              shearScale: 1.5,
              turbScale: 1.55,
              patchScale: 1.3,
              noiseWarp: 1.6,
            }),
          },
          {
            id: "storms",
            params: { count: countByDetail(detail, 10, 20), alpha: 0.26, colour: "#ffd0a0" },
          },
        ],
        appendLayers: [
          {
            id: "band-shear",
            params: { count: countByDetail(detail, 18, 28), alpha: 0.16, colour: "#ffbe8d" },
          },
          {
            id: "storm-fronts",
            params: { count: countByDetail(detail, 6, 10), alpha: 0.2, colour: "#ffd5ad" },
          },
        ],
        atmosphere: { colour: "#ffb27f", opacity: 0.22, scale: 1.09 },
        gasVisual: gasVisualParams({
          family: "banded",
          hasVisibleBands: true,
          bandCount: 9,
          bandContrast: 0.78,
          turbulence: 0.64,
          shearStrength: 0.38,
          bandWiggle: 0.056,
          latProfile: "extreme",
          stormCoupling: 0.86,
          patchiness: 0.4,
          hazeStrength: 0.18,
          polarHaze: 0.14,
          wiggleScale: 1.45,
          shearScale: 1.5,
          turbScale: 1.55,
          patchScale: 1.3,
          noiseWarp: 1.6,
        }),
      };
    case "warm-giant":
      return {
        profileId,
        layerEdits: [
          {
            id: "gas-bands",
            params: gasBandFlowParams({
              family: "banded",
              hasVisibleBands: true,
              bandCount: 8,
              bandContrast: 0.48,
              turbulence: 0.34,
              shearStrength: 0.22,
              bandWiggle: 0.03,
              latProfile: "jovian",
              stormCoupling: 0.5,
              patchiness: 0.24,
              wiggleScale: 0.88,
              shearScale: 0.85,
              turbScale: 0.9,
              patchScale: 0.9,
              noiseWarp: 0.9,
            }),
          },
          {
            id: "storms",
            params: { count: countByDetail(detail, 5, 10), alpha: 0.12, colour: "#e8d4b0" },
          },
        ],
        appendLayers: [
          { id: "band-shear", params: { count: countByDetail(detail, 12, 20), alpha: 0.11 } },
        ],
        gasVisual: gasVisualParams({
          family: "banded",
          hasVisibleBands: true,
          bandCount: 8,
          bandContrast: 0.48,
          turbulence: 0.34,
          shearStrength: 0.22,
          bandWiggle: 0.03,
          latProfile: "jovian",
          stormCoupling: 0.5,
          patchiness: 0.24,
          hazeStrength: 0.1,
          polarHaze: 0.16,
          wiggleScale: 0.88,
          shearScale: 0.85,
          turbScale: 0.9,
          patchScale: 0.9,
          noiseWarp: 0.9,
        }),
      };
    case "cloudless":
      return {
        profileId,
        layerEdits: [
          {
            id: "gas-bands",
            params: gasBandFlowParams({
              family: "solid",
              hasVisibleBands: false,
              bandCount: 3,
              bandContrast: 0.16,
              turbulence: 0.2,
              shearStrength: 0.1,
              bandWiggle: 0.012,
              latProfile: "subtle",
              stormCoupling: 0.18,
              patchiness: 0.1,
              wiggleScale: 0.5,
              shearScale: 0.46,
              turbScale: 0.55,
              patchScale: 0.6,
              noiseWarp: 0.55,
            }),
          },
          {
            id: "storms",
            params: { count: countByDetail(detail, 2, 5), alpha: 0.08, colour: "#7888b0" },
          },
        ],
        appendLayers: [
          { id: "band-shear", params: { count: countByDetail(detail, 10, 16), alpha: 0.09 } },
        ],
        gasVisual: gasVisualParams({
          family: "solid",
          hasVisibleBands: false,
          bandCount: 3,
          bandContrast: 0.16,
          turbulence: 0.2,
          shearStrength: 0.1,
          bandWiggle: 0.012,
          latProfile: "subtle",
          stormCoupling: 0.18,
          patchiness: 0.1,
          hazeStrength: 0.18,
          polarHaze: 0.24,
          wiggleScale: 0.5,
          shearScale: 0.46,
          turbScale: 0.55,
          patchScale: 0.6,
          noiseWarp: 0.55,
        }),
      };
    case "alkali":
      return {
        profileId,
        layerEdits: [
          {
            id: "gas-bands",
            params: gasBandFlowParams({
              family: "hazy",
              hasVisibleBands: true,
              bandCount: 6,
              bandContrast: 0.44,
              turbulence: 0.5,
              shearStrength: 0.28,
              bandWiggle: 0.036,
              latProfile: "extreme",
              stormCoupling: 0.62,
              patchiness: 0.44,
              wiggleScale: 1.25,
              shearScale: 1.3,
              turbScale: 1.35,
              patchScale: 1.15,
              noiseWarp: 1.4,
            }),
          },
          {
            id: "storms",
            params: { count: countByDetail(detail, 6, 10), alpha: 0.16, colour: "#c89870" },
          },
        ],
        appendLayers: [
          {
            id: "storm-fronts",
            params: { count: countByDetail(detail, 5, 9), alpha: 0.16, colour: "#ffc27a" },
          },
        ],
        atmosphere: { colour: "#ebb078", opacity: 0.2, scale: 1.08 },
        gasVisual: gasVisualParams({
          family: "hazy",
          hasVisibleBands: true,
          bandCount: 6,
          bandContrast: 0.44,
          turbulence: 0.5,
          shearStrength: 0.28,
          bandWiggle: 0.036,
          latProfile: "extreme",
          stormCoupling: 0.62,
          patchiness: 0.44,
          hazeStrength: 0.3,
          polarHaze: 0.22,
          wiggleScale: 1.25,
          shearScale: 1.3,
          turbScale: 1.35,
          patchScale: 1.15,
          noiseWarp: 1.4,
        }),
      };
    case "silicate":
      return {
        profileId,
        layerEdits: [
          {
            id: "gas-bands",
            params: gasBandFlowParams({
              family: "hazy",
              hasVisibleBands: true,
              bandCount: 7,
              bandContrast: 0.42,
              turbulence: 0.54,
              shearStrength: 0.3,
              bandWiggle: 0.04,
              latProfile: "extreme",
              stormCoupling: 0.64,
              patchiness: 0.5,
              wiggleScale: 1.35,
              shearScale: 1.4,
              turbScale: 1.5,
              patchScale: 1.2,
              noiseWarp: 1.55,
            }),
          },
          {
            id: "storms",
            params: { count: countByDetail(detail, 8, 14), alpha: 0.2, colour: "#ffd0b0" },
          },
        ],
        appendLayers: [
          {
            id: "storm-fronts",
            params: { count: countByDetail(detail, 7, 12), alpha: 0.18, colour: "#ffd2aa" },
          },
        ],
        atmosphere: { colour: "#deb089", opacity: 0.19, scale: 1.08 },
        gasVisual: gasVisualParams({
          family: "hazy",
          hasVisibleBands: true,
          bandCount: 7,
          bandContrast: 0.42,
          turbulence: 0.54,
          shearStrength: 0.3,
          bandWiggle: 0.04,
          latProfile: "extreme",
          stormCoupling: 0.64,
          patchiness: 0.5,
          hazeStrength: 0.24,
          polarHaze: 0.16,
          wiggleScale: 1.35,
          shearScale: 1.4,
          turbScale: 1.5,
          patchScale: 1.2,
          noiseWarp: 1.55,
        }),
      };
    case "super-jupiter":
      return {
        profileId,
        layerEdits: [
          {
            id: "gas-bands",
            params: gasBandFlowParams({
              family: "banded",
              hasVisibleBands: true,
              bandCount: 12,
              bandContrast: 0.74,
              turbulence: 0.48,
              shearStrength: 0.34,
              bandWiggle: 0.04,
              latProfile: "jovian",
              stormCoupling: 0.74,
              patchiness: 0.34,
              wiggleScale: 1.15,
              shearScale: 1.2,
              turbScale: 1.25,
              patchScale: 1.1,
              noiseWarp: 1.15,
            }),
          },
          {
            id: "storms",
            params: { count: countByDetail(detail, 12, 24), alpha: 0.22, colour: "#d8b898" },
          },
        ],
        appendLayers: [
          { id: "band-shear", params: { count: countByDetail(detail, 18, 30), alpha: 0.14 } },
        ],
        gasVisual: gasVisualParams({
          family: "banded",
          hasVisibleBands: true,
          bandCount: 12,
          bandContrast: 0.74,
          turbulence: 0.48,
          shearStrength: 0.34,
          bandWiggle: 0.04,
          latProfile: "jovian",
          stormCoupling: 0.74,
          patchiness: 0.34,
          hazeStrength: 0.1,
          polarHaze: 0.14,
          wiggleScale: 1.15,
          shearScale: 1.2,
          turbScale: 1.25,
          patchScale: 1.1,
          noiseWarp: 1.15,
        }),
      };
    case "sub-neptune":
      return {
        profileId,
        layerEdits: [
          {
            id: "gas-bands",
            params: gasBandFlowParams({
              family: "hazy",
              hasVisibleBands: true,
              bandCount: 4,
              bandContrast: 0.28,
              turbulence: 0.28,
              shearStrength: 0.12,
              bandWiggle: 0.018,
              latProfile: "subtle",
              stormCoupling: 0.3,
              patchiness: 0.34,
              wiggleScale: 0.72,
              shearScale: 0.68,
              turbScale: 0.74,
              patchScale: 0.95,
              noiseWarp: 0.76,
            }),
          },
          {
            id: "storms",
            params: { count: countByDetail(detail, 3, 7), alpha: 0.11, colour: "#a8d8ce" },
          },
        ],
        appendLayers: [
          { id: "polar-haze", params: { alpha: 0.14, colour: "#a8e2ed" } },
          { id: "band-shear", params: { count: countByDetail(detail, 10, 18), alpha: 0.1 } },
        ],
        atmosphere: { colour: "#a8e2eb", opacity: 0.22, scale: 1.09 },
        gasVisual: gasVisualParams({
          family: "hazy",
          hasVisibleBands: true,
          bandCount: 4,
          bandContrast: 0.28,
          turbulence: 0.28,
          shearStrength: 0.12,
          bandWiggle: 0.018,
          latProfile: "subtle",
          stormCoupling: 0.3,
          patchiness: 0.34,
          hazeStrength: 0.32,
          polarHaze: 0.36,
          wiggleScale: 0.72,
          shearScale: 0.68,
          turbScale: 0.74,
          patchScale: 0.95,
          noiseWarp: 0.76,
        }),
      };
    case "ringed-ice":
      return {
        profileId,
        layerEdits: [
          {
            id: "gas-bands",
            params: gasBandFlowParams({
              family: "patchy",
              hasVisibleBands: true,
              bandCount: 5,
              bandContrast: 0.44,
              turbulence: 0.46,
              shearStrength: 0.24,
              bandWiggle: 0.038,
              latProfile: "stormy",
              stormCoupling: 0.68,
              patchiness: 0.58,
              wiggleScale: 1.2,
              shearScale: 1.05,
              turbScale: 1.15,
              patchScale: 1.3,
              noiseWarp: 1.1,
            }),
          },
          {
            id: "storms",
            params: { count: countByDetail(detail, 6, 12), alpha: 0.15, colour: "#d0e8f0" },
          },
        ],
        appendLayers: [
          { id: "polar-haze", params: { alpha: 0.14, colour: "#d7f2ff" } },
          {
            id: "band-shear",
            params: { count: countByDetail(detail, 14, 22), alpha: 0.11, colour: "#8dd8f2" },
          },
        ],
        ring: { inner: 1.2, outer: 2.15, opacity: 0.58, yawDeg: 24, tiltDeg: 100 },
        atmosphere: { colour: "#a5dce8", opacity: 0.15, scale: 1.05 },
        gasVisual: gasVisualParams({
          family: "patchy",
          hasVisibleBands: true,
          bandCount: 5,
          bandContrast: 0.44,
          turbulence: 0.46,
          shearStrength: 0.24,
          bandWiggle: 0.038,
          latProfile: "stormy",
          stormCoupling: 0.68,
          patchiness: 0.58,
          hazeStrength: 0.16,
          polarHaze: 0.28,
          wiggleScale: 1.2,
          shearScale: 1.05,
          turbScale: 1.15,
          patchScale: 1.3,
          noiseWarp: 1.1,
        }),
      };
    case "puffy":
      return {
        profileId,
        layerEdits: [
          {
            id: "gas-bands",
            params: gasBandFlowParams({
              family: "hazy",
              hasVisibleBands: true,
              bandCount: 5,
              bandContrast: 0.32,
              turbulence: 0.34,
              shearStrength: 0.16,
              bandWiggle: 0.02,
              latProfile: "subtle",
              stormCoupling: 0.32,
              patchiness: 0.28,
              wiggleScale: 0.74,
              shearScale: 0.68,
              turbScale: 0.72,
              patchScale: 0.84,
              noiseWarp: 0.74,
            }),
          },
          {
            id: "storms",
            params: { count: countByDetail(detail, 3, 7), alpha: 0.12, colour: "#d8c4e8" },
          },
        ],
        atmosphere: { colour: "#d0b8e8", opacity: 0.28, scale: 1.12 },
        appendLayers: [
          { id: "storm-fronts", params: { count: countByDetail(detail, 4, 8), alpha: 0.16 } },
        ],
        gasVisual: gasVisualParams({
          family: "hazy",
          hasVisibleBands: true,
          bandCount: 5,
          bandContrast: 0.32,
          turbulence: 0.34,
          shearStrength: 0.16,
          bandWiggle: 0.02,
          latProfile: "subtle",
          stormCoupling: 0.32,
          patchiness: 0.28,
          hazeStrength: 0.36,
          polarHaze: 0.34,
          wiggleScale: 0.74,
          shearScale: 0.68,
          turbScale: 0.72,
          patchScale: 0.84,
          noiseWarp: 0.74,
        }),
      };
    case "hazy":
      return {
        profileId,
        layerEdits: [
          {
            id: "gas-bands",
            params: gasBandFlowParams({
              family: "hazy",
              hasVisibleBands: true,
              bandCount: 4,
              bandContrast: 0.26,
              turbulence: 0.26,
              shearStrength: 0.12,
              bandWiggle: 0.016,
              latProfile: "subtle",
              stormCoupling: 0.28,
              patchiness: 0.38,
              wiggleScale: 0.65,
              shearScale: 0.58,
              turbScale: 0.66,
              patchScale: 0.8,
              noiseWarp: 0.7,
            }),
          },
          {
            id: "storms",
            params: { count: countByDetail(detail, 3, 6), alpha: 0.1, colour: "#d0be88" },
          },
        ],
        appendLayers: [{ id: "polar-haze", params: { alpha: 0.22, colour: "#dcc888" } }],
        atmosphere: { colour: "#d4b478", opacity: 0.26, scale: 1.1 },
        gasVisual: gasVisualParams({
          family: "hazy",
          hasVisibleBands: true,
          bandCount: 4,
          bandContrast: 0.26,
          turbulence: 0.26,
          shearStrength: 0.12,
          bandWiggle: 0.016,
          latProfile: "subtle",
          stormCoupling: 0.28,
          patchiness: 0.38,
          hazeStrength: 0.38,
          polarHaze: 0.42,
          wiggleScale: 0.65,
          shearScale: 0.58,
          turbScale: 0.66,
          patchScale: 0.8,
          noiseWarp: 0.7,
        }),
      };
    case "water-cloud":
      return {
        profileId,
        layerEdits: [
          {
            id: "gas-bands",
            params: gasBandFlowParams({
              family: "banded",
              hasVisibleBands: true,
              bandCount: 9,
              bandContrast: 0.46,
              turbulence: 0.32,
              shearStrength: 0.2,
              bandWiggle: 0.026,
              latProfile: "jovian",
              stormCoupling: 0.46,
              patchiness: 0.2,
              wiggleScale: 0.82,
              shearScale: 0.78,
              turbScale: 0.75,
              patchScale: 0.85,
              noiseWarp: 0.85,
            }),
          },
          {
            id: "storms",
            params: { count: countByDetail(detail, 6, 12), alpha: 0.14, colour: "#e8eef8" },
          },
        ],
        appendLayers: [
          {
            id: "storm-fronts",
            params: { count: countByDetail(detail, 6, 12), alpha: 0.17, colour: "#e5f2ff" },
          },
        ],
        gasVisual: gasVisualParams({
          family: "banded",
          hasVisibleBands: true,
          bandCount: 9,
          bandContrast: 0.46,
          turbulence: 0.32,
          shearStrength: 0.2,
          bandWiggle: 0.026,
          latProfile: "jovian",
          stormCoupling: 0.46,
          patchiness: 0.2,
          hazeStrength: 0.12,
          polarHaze: 0.18,
          wiggleScale: 0.82,
          shearScale: 0.78,
          turbScale: 0.75,
          patchScale: 0.85,
          noiseWarp: 0.85,
        }),
      };
    case "helium":
      return {
        profileId,
        layerEdits: [
          {
            id: "gas-bands",
            params: gasBandFlowParams({
              family: "solid",
              hasVisibleBands: false,
              bandCount: 3,
              bandContrast: 0.2,
              turbulence: 0.18,
              shearStrength: 0.1,
              bandWiggle: 0.012,
              latProfile: "subtle",
              stormCoupling: 0.18,
              patchiness: 0.14,
              wiggleScale: 0.46,
              shearScale: 0.44,
              turbScale: 0.5,
              patchScale: 0.55,
              noiseWarp: 0.52,
            }),
          },
          {
            id: "storms",
            params: { count: countByDetail(detail, 2, 5), alpha: 0.09, colour: "#c0c0cc" },
          },
        ],
        appendLayers: [
          {
            id: "band-shear",
            params: { count: countByDetail(detail, 13, 20), alpha: 0.11, colour: "#f0e4c0" },
          },
        ],
        atmosphere: { colour: "#f0e0b8", opacity: 0.18, scale: 1.06 },
        gasVisual: gasVisualParams({
          family: "solid",
          hasVisibleBands: false,
          bandCount: 3,
          bandContrast: 0.2,
          turbulence: 0.18,
          shearStrength: 0.1,
          bandWiggle: 0.012,
          latProfile: "subtle",
          stormCoupling: 0.18,
          patchiness: 0.14,
          hazeStrength: 0.24,
          polarHaze: 0.36,
          wiggleScale: 0.46,
          shearScale: 0.44,
          turbScale: 0.5,
          patchScale: 0.55,
          noiseWarp: 0.52,
        }),
      };
    default:
      return {
        profileId: "jupiter",
        layerEdits: [],
        appendLayers: [],
        gasVisual: gasVisualParams(),
      };
  }
}

export function buildGasArtProfile(model = {}, detail = 0.68) {
  const styleId = gasFallbackId(model);
  return gasProfileById(styleId, model, detail);
}
