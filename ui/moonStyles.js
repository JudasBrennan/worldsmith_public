// ─── Moon visual rendering ──────────────────────────────────────────
//
// Physics-driven visual system for moons. Engine-computed properties
// (composition class, tidal heating, density, albedo, tidal lock)
// determine the moon's appearance from space.
//
// Architecture mirrors rockyPlanetStyles.js:
//   computeMoonVisualProfile()  → visual profile from engine data
//   drawMoonPreview()           → 180×180 px detailed preview (Three.js)

import { tintPalette } from "./renderUtils.js";
import { renderMoonPreviewNative } from "./threeNativePreview.js";

// ── Constants ─────────────────────────────────────────────────────

const MOON_PALETTES = {
  "Very icy": { c1: "#e8eef5", c2: "#c0d0e0", c3: "#7090a8" },
  Icy: { c1: "#d0dce8", c2: "#a0b8cc", c3: "#5a7a90" },
  "Subsurface ocean": { c1: "#c8d8e8", c2: "#90b0c8", c3: "#4a7090" },
  "Mixed rock/ice": { c1: "#c8c0b4", c2: "#989088", c3: "#5a5450" },
  "Dark icy": { c1: "#8a9098", c2: "#606870", c3: "#383e48" },
  Rocky: { c1: "#b8b0a8", c2: "#888078", c3: "#4a4540" },
  "Partially molten": { c1: "#b0a898", c2: "#807060", c3: "#504030" },
  "Iron-rich": { c1: "#8a8890", c2: "#585660", c3: "#2a2830" },
};

// ── Helpers ───────────────────────────────────────────────────────

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// ── Profile computation ──────────────────────────────────────────

/**
 * Compute a visual profile for a moon from engine-computed data.
 *
 * @param {object} moonCalc - Result of calcMoonExact()
 * @returns {object} MoonVisualProfile
 */
export function computeMoonVisualProfile(moonCalc) {
  if (!moonCalc) return fallbackProfile("unknown");

  const tides = moonCalc.tides || {};
  const inputs = moonCalc.inputs || {};
  const physical = moonCalc.physical || {};

  const compClass = tides.compositionOverride || tides.compositionClass || "Rocky";
  const density = Number(inputs.densityGcm3) || 3.34;
  const albedo = Number(inputs.albedo) || 0.11;
  const radiusMoon = Number(physical.radiusMoon) || 1;
  const heatingEarth = Number(tides.tidalHeatingEarth) || 0;
  const locked = tides.moonLockedToPlanet === "Yes";
  const name = moonCalc.inputs?.name || moonCalc.id || "moon";

  // 1. Visual class — multi-signal decision tree.
  //    Uses albedo, density, radius, and tidal heating to disambiguate
  //    captured asteroids, dark icy bodies, and bright icy moons.
  let visualClass;
  if (tides.compositionOverride) {
    // User-set override — honour directly
    visualClass = compClass;
  } else if (albedo >= 0.5 && density < 3.5) {
    // Step 1: Bright surface — reflective ice confirmed
    visualClass = compClass;
  } else if (heatingEarth > 5) {
    // Step 2: High tidal heating — volcanic dominates
    visualClass = compClass;
  } else if (radiusMoon < 0.01 && albedo < 0.15) {
    // Step 3: Captured asteroid (tiny + dark)
    visualClass = "Rocky";
  } else if (density < 2.5 && albedo < 0.25 && radiusMoon >= 0.01) {
    // Step 4: Dark icy body (large + dark + low density)
    visualClass = "Dark icy";
  } else {
    // Step 5: Default — engine composition class
    visualClass = compClass;
  }

  // Fall back to Rocky if visual class has no palette
  if (!MOON_PALETTES[visualClass]) visualClass = "Rocky";
  const palette = tintPalette(MOON_PALETTES[visualClass], albedo);

  // 2. Terrain type and crater density
  const isCaptured = visualClass === "Rocky" && radiusMoon < 0.01;
  const isDarkIcy = visualClass === "Dark icy";

  let terrainType, craterDensity;
  if (heatingEarth > 10) {
    terrainType = "volcanic";
    craterDensity = 0.02;
  } else if (heatingEarth > 1) {
    terrainType = "active";
    craterDensity = 0.1;
  } else if (isCaptured) {
    terrainType = "worn";
    craterDensity = 0.5;
  } else if (isDarkIcy) {
    terrainType = "worn";
    craterDensity = 0.35;
  } else if (density < 2.0) {
    terrainType = "icy-smooth";
    craterDensity = 0.15;
  } else if (density < 3.2) {
    terrainType = "worn";
    craterDensity = 0.4;
  } else {
    terrainType = "cratered";
    craterDensity = 0.7;
  }

  // 3. Ice coverage
  let iceCoverage = 0;
  if (isCaptured) {
    iceCoverage = 0;
  } else if (isDarkIcy) {
    iceCoverage = 0.2;
  } else if (compClass === "Very icy" || compClass === "Icy") {
    iceCoverage = 0.9 + (compClass === "Very icy" ? 0.1 : 0);
  } else if (compClass === "Subsurface ocean") {
    iceCoverage = 0.95;
  } else if (compClass === "Mixed rock/ice") {
    iceCoverage = 0.4;
  }

  // 4. Tidal heating visual
  const tidalActive = heatingEarth > 0.5;
  const tidalIntensity = clamp(heatingEarth / 40, 0, 1);

  // 5. Atmosphere (most moons have none; only very large icy/mixed bodies)
  let atmThickness = 0;
  let atmColour = "#e0a840";
  if (
    radiusMoon > 1.0 &&
    density >= 1.5 &&
    density <= 2.5 &&
    (compClass === "Icy" || compClass === "Subsurface ocean" || compClass === "Mixed rock/ice")
  ) {
    atmThickness = 0.06;
  }

  // 6. Special effects
  let special = null;
  if (heatingEarth > 10) {
    special = "volcanic";
  } else if (compClass === "Subsurface ocean") {
    special = "subsurface-ocean";
  } else if (compClass === "Partially molten") {
    special = "molten";
  } else if (density < 1.0 && albedo > 0.6) {
    special = "frozen";
  }

  return {
    bodyType: "moon",
    displayClass: visualClass,
    palette,
    terrain: { type: terrainType, craterDensity },
    iceCoverage,
    iceColour: "#e8f0ff",
    tidalHeating: { active: tidalActive, intensity: tidalIntensity },
    atmosphere: { thickness: atmThickness, colour: atmColour },
    special,
    tidallyLocked: locked,
    seed: String(name),
  };
}

/** Minimal safe profile when no engine data is available. */
function fallbackProfile(seed) {
  return {
    bodyType: "moon",
    displayClass: "Rocky",
    palette: MOON_PALETTES.Rocky,
    terrain: { type: "cratered", craterDensity: 0.5 },
    iceCoverage: 0,
    iceColour: "#e8f0ff",
    tidalHeating: { active: false, intensity: 0 },
    atmosphere: { thickness: 0, colour: "#e0a840" },
    special: null,
    tidallyLocked: true,
    seed: String(seed),
  };
}

// ── 180×180 px detailed preview ──────────────────────────────────

/**
 * Draw a detailed moon preview onto a <canvas> element.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} profile - MoonVisualProfile from computeMoonVisualProfile()
 * @param {object} [opts]
 */
export function drawMoonPreview(canvas, profile, opts = {}) {
  if (!canvas || !profile) return;
  renderMoonPreviewNative(canvas, profile, opts);
}
/* ── Moon Recipes ─────────────────────────────────────────────────── */

export const MOON_RECIPES = [
  // ── Major Rocky ───────────────────────────────────────────────────
  {
    id: "luna",
    label: "Luna",
    category: "Major Rocky",
    preview: {
      tides: { compositionClass: "Rocky", tidalHeatingEarth: 0, moonLockedToPlanet: "Yes" },
      inputs: { densityGcm3: 3.34, albedo: 0.11, name: "Luna" },
      physical: { radiusMoon: 1.0 },
    },
    apply: {
      massMoon: 1.0,
      densityGcm3: 3.34,
      albedo: 0.11,
      semiMajorAxisKm: 384400,
      eccentricity: 0.0549,
      inclinationDeg: 5.145,
      compositionOverride: null,
    },
  },
  {
    id: "callisto",
    label: "Callisto",
    category: "Major Rocky",
    preview: {
      tides: {
        compositionClass: "Mixed rock/ice",
        tidalHeatingEarth: 0,
        moonLockedToPlanet: "Yes",
      },
      inputs: { densityGcm3: 1.834, albedo: 0.17, name: "Callisto" },
      physical: { radiusMoon: 1.39 },
    },
    apply: {
      massMoon: 1.466,
      densityGcm3: 1.834,
      albedo: 0.17,
      semiMajorAxisKm: 1882700,
      eccentricity: 0.0074,
      inclinationDeg: 0.192,
      compositionOverride: null,
    },
  },
  {
    id: "ganymede",
    label: "Ganymede",
    category: "Major Rocky",
    preview: {
      tides: {
        compositionClass: "Mixed rock/ice",
        tidalHeatingEarth: 0.1,
        moonLockedToPlanet: "Yes",
      },
      inputs: { densityGcm3: 1.942, albedo: 0.43, name: "Ganymede" },
      physical: { radiusMoon: 1.52 },
    },
    apply: {
      massMoon: 2.017,
      densityGcm3: 1.942,
      albedo: 0.43,
      semiMajorAxisKm: 1070400,
      eccentricity: 0.0011,
      inclinationDeg: 0.177,
      compositionOverride: null,
    },
  },

  // ── Icy & Ocean ───────────────────────────────────────────────────
  {
    id: "europa",
    label: "Europa",
    category: "Icy & Ocean",
    preview: {
      tides: {
        compositionClass: "Subsurface ocean",
        tidalHeatingEarth: 1.5,
        moonLockedToPlanet: "Yes",
      },
      inputs: { densityGcm3: 3.013, albedo: 0.67, name: "Europa" },
      physical: { radiusMoon: 0.9 },
    },
    apply: {
      massMoon: 0.654,
      densityGcm3: 3.013,
      albedo: 0.67,
      semiMajorAxisKm: 671100,
      eccentricity: 0.0094,
      inclinationDeg: 0.466,
      compositionOverride: "Subsurface ocean",
    },
  },
  {
    id: "enceladus",
    label: "Enceladus",
    category: "Icy & Ocean",
    preview: {
      tides: {
        compositionClass: "Subsurface ocean",
        tidalHeatingEarth: 3.0,
        moonLockedToPlanet: "Yes",
      },
      inputs: { densityGcm3: 1.61, albedo: 0.81, name: "Enceladus" },
      physical: { radiusMoon: 0.145 },
    },
    apply: {
      massMoon: 0.001471,
      densityGcm3: 1.61,
      albedo: 0.81,
      semiMajorAxisKm: 238400,
      eccentricity: 0.0047,
      inclinationDeg: 0.009,
      compositionOverride: "Subsurface ocean",
    },
  },
  {
    id: "titan",
    label: "Titan",
    category: "Icy & Ocean",
    preview: {
      tides: {
        compositionClass: "Mixed rock/ice",
        tidalHeatingEarth: 0.02,
        moonLockedToPlanet: "Yes",
      },
      inputs: { densityGcm3: 1.882, albedo: 0.21, name: "Titan" },
      physical: { radiusMoon: 1.48 },
    },
    apply: {
      massMoon: 1.8324,
      densityGcm3: 1.882,
      albedo: 0.21,
      semiMajorAxisKm: 1221870,
      eccentricity: 0.0288,
      inclinationDeg: 0.306,
      compositionOverride: null,
    },
  },
  {
    id: "triton",
    label: "Triton",
    category: "Icy & Ocean",
    preview: {
      tides: { compositionClass: "Icy", tidalHeatingEarth: 0.3, moonLockedToPlanet: "Yes" },
      inputs: { densityGcm3: 2.065, albedo: 0.7, name: "Triton" },
      physical: { radiusMoon: 0.78 },
    },
    apply: {
      massMoon: 0.2913,
      densityGcm3: 2.065,
      albedo: 0.7,
      semiMajorAxisKm: 354800,
      eccentricity: 0.000016,
      inclinationDeg: 157.345,
      compositionOverride: null,
    },
  },

  // ── Volcanic ──────────────────────────────────────────────────────
  {
    id: "io",
    label: "Io",
    category: "Volcanic",
    preview: {
      tides: {
        compositionClass: "Partially molten",
        tidalHeatingEarth: 20.0,
        moonLockedToPlanet: "Yes",
      },
      inputs: { densityGcm3: 3.528, albedo: 0.63, name: "Io" },
      physical: { radiusMoon: 1.05 },
    },
    apply: {
      massMoon: 1.215,
      densityGcm3: 3.528,
      albedo: 0.63,
      semiMajorAxisKm: 421800,
      eccentricity: 0.0041,
      inclinationDeg: 0.036,
      compositionOverride: "Partially molten",
    },
  },
  {
    id: "molten-companion",
    label: "Molten Companion",
    category: "Volcanic",
    preview: {
      tides: {
        compositionClass: "Partially molten",
        tidalHeatingEarth: 35.0,
        moonLockedToPlanet: "Yes",
      },
      inputs: { densityGcm3: 4.0, albedo: 0.15, name: "Molten" },
      physical: { radiusMoon: 0.6 },
    },
    apply: {
      massMoon: 0.5,
      densityGcm3: 4.0,
      albedo: 0.15,
      semiMajorAxisKm: 200000,
      eccentricity: 0.08,
      inclinationDeg: 1.0,
      compositionOverride: "Partially molten",
    },
  },

  // ── Small & Captured ──────────────────────────────────────────────
  {
    id: "phobos",
    label: "Phobos",
    category: "Small & Captured",
    preview: {
      tides: { compositionClass: "Rocky", tidalHeatingEarth: 0, moonLockedToPlanet: "Yes" },
      inputs: { densityGcm3: 1.876, albedo: 0.071, name: "Phobos" },
      physical: { radiusMoon: 0.0064 },
    },
    apply: {
      massMoon: 0.000000145,
      densityGcm3: 1.876,
      albedo: 0.071,
      semiMajorAxisKm: 9375,
      eccentricity: 0.015,
      inclinationDeg: 1.09,
      compositionOverride: null,
    },
  },
  {
    id: "deimos",
    label: "Deimos",
    category: "Small & Captured",
    preview: {
      tides: { compositionClass: "Rocky", tidalHeatingEarth: 0, moonLockedToPlanet: "Yes" },
      inputs: { densityGcm3: 1.47, albedo: 0.068, name: "Deimos" },
      physical: { radiusMoon: 0.0036 },
    },
    apply: {
      massMoon: 0.00000002,
      densityGcm3: 1.47,
      albedo: 0.068,
      semiMajorAxisKm: 23457,
      eccentricity: 0.0002,
      inclinationDeg: 0.93,
      compositionOverride: null,
    },
  },
  {
    id: "irregular-capture",
    label: "Irregular Capture",
    category: "Small & Captured",
    preview: {
      tides: { compositionClass: "Rocky", tidalHeatingEarth: 0, moonLockedToPlanet: "No" },
      inputs: { densityGcm3: 1.5, albedo: 0.05, name: "Captured" },
      physical: { radiusMoon: 0.04 },
    },
    apply: {
      massMoon: 0.0001,
      densityGcm3: 1.5,
      albedo: 0.05,
      semiMajorAxisKm: 12000000,
      eccentricity: 0.4,
      inclinationDeg: 145.0,
      compositionOverride: null,
    },
  },
];

export { MOON_PALETTES };
