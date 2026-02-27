// ─── Rocky planet visual rendering ─────────────────────────────────
//
// Physics-driven visual system for rocky planets. No user-selectable
// style presets — the engine-computed physical properties (composition
// class, water regime, temperature, tectonics, atmosphere) determine
// the planet's appearance from space.
//
// Architecture mirrors gasGiantStyles.js:
//   computeRockyVisualProfile()  → visual profile from engine data
//   drawRockyPlanetPreview()     → 180×180 px detailed preview
//   drawRockyPlanetViz()         → 8–20 px system poster scale

import { tintPalette } from "./renderUtils.js";
import { renderRockyPreviewNative } from "./threeNativePreview.js";

// ── Constants ─────────────────────────────────────────────────────

const SURFACE_PALETTES = {
  "Earth-like": { c1: "#c4a882", c2: "#8b6e4e", c3: "#4a3726" },
  "Mars-like": { c1: "#c77b4a", c2: "#9b4e2e", c3: "#5c2a18" },
  "Mercury-like": { c1: "#b0b0b0", c2: "#808080", c3: "#4a4a4a" },
  "Iron world": { c1: "#6e7080", c2: "#45475a", c3: "#1e1f2e" },
  Coreless: { c1: "#d4c4a8", c2: "#b09878", c3: "#6e5a40" },
  "Ice world": { c1: "#d8e4f0", c2: "#a0b8cc", c3: "#4a6478" },
  "Ocean world": { c1: "#4a8cb0", c2: "#2a5c80", c3: "#1a3450" },
};

const OCEAN_COVERAGE = {
  Dry: 0,
  "Shallow oceans": 0.3,
  "Extensive oceans": 0.65,
  "Global ocean": 0.95,
  "Deep ocean": 1.0,
  "Ice world": 0,
};

const OCEAN_COLOURS = {
  "Earth-like": "#1a4a7a",
  "Mars-like": "#2a4a5a",
  Coreless: "#2a5a6a",
  "Ocean world": "#1a3a6a",
  "Ice world": "#3a6a8a",
};
const DEFAULT_OCEAN_COLOUR = "#1a4a7a";

// ── Helpers ───────────────────────────────────────────────────────

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// ── Profile computation ──────────────────────────────────────────

function iceCapsFromTemp(tempK, axialTiltDeg) {
  let base;
  if (tempK < 200) base = 0.8;
  else if (tempK < 250) base = 0.3 + (0.5 * (250 - tempK)) / 50;
  else if (tempK < 280) base = 0.1 + (0.2 * (280 - tempK)) / 30;
  else if (tempK < 310) base = 0.02 + (0.08 * (310 - tempK)) / 30;
  else if (tempK < 350) base = Math.max(0, (0.02 * (350 - tempK)) / 40);
  else base = 0;

  const tiltFactor = clamp(axialTiltDeg || 0, 0, 90) / 90;
  const asymmetry = base * 0.4 * tiltFactor;
  return {
    north: clamp(base + asymmetry * 0.5, 0, 1),
    south: clamp(base - asymmetry * 0.5, 0, 1),
    colour: "#e8f0ff",
  };
}

export function computeRockyVisualProfile(derived, inputs) {
  const d = derived || {};
  const inp = inputs || {};

  // Palette — tinted by albedo when available
  const basePalette = SURFACE_PALETTES[d.compositionClass] || SURFACE_PALETTES["Earth-like"];
  const albedo = Number(inp.albedoBond);
  const palette = Number.isFinite(albedo) ? tintPalette(basePalette, albedo) : basePalette;

  // Ocean
  const oceanCoverage = OCEAN_COVERAGE[d.waterRegime] ?? 0;
  const oceanColour = OCEAN_COLOURS[d.compositionClass] || DEFAULT_OCEAN_COLOUR;
  const tempK = d.surfaceTempK || 288;
  const frozen = tempK < 273 && oceanCoverage > 0;

  // Ice caps
  let iceCaps;
  if (d.waterRegime === "Ice world") {
    iceCaps = { north: 1, south: 1, colour: "#e8f0ff" };
  } else {
    iceCaps = iceCapsFromTemp(tempK, Number(inp.axialTiltDeg) || 0);
  }

  // Clouds
  const pressure = Number(inp.pressureAtm) || 0;
  const h2o = Number(inp.h2oPct) || 0;
  const co2 = Number(inp.co2Pct) || 0;
  let cloudCoverage = pressure > 0 ? clamp(((pressure * h2o) / 100) * 2, 0, 0.95) : 0;
  let cloudColour = "#ffffff";
  if (pressure > 10 && co2 > 80) {
    cloudCoverage = 0.95;
    cloudColour = "#e0d0a0";
  }

  // Atmosphere rim
  let atmThickness = 0;
  let atmColour = d.skyColourDayHex || "#6688bb";
  if (pressure > 0) {
    atmThickness = clamp(Math.log10(pressure + 0.01) * 0.05 + 0.04, 0, 0.15);
  }

  // Terrain
  const tec = d.tectonicRegime || "stagnant";
  let terrainType, craterDensity;
  if (tec === "stagnant" && pressure <= 0.01) {
    terrainType = "cratered";
    craterDensity = 0.8;
  } else if (tec === "stagnant") {
    terrainType = "worn";
    craterDensity = 0.3;
  } else if (tec === "mobile") {
    terrainType = "continental";
    craterDensity = 0.05;
  } else if (tec === "episodic") {
    terrainType = "volcanic";
    craterDensity = 0.1;
  } else {
    terrainType = "smooth";
    craterDensity = 0.02;
  }

  // Vegetation
  let vegCoverage = 0;
  let vegColour = null;
  if (d.vegetationPaleHex && tempK >= 200 && tempK <= 400 && oceanCoverage < 0.95) {
    vegCoverage = clamp(0.35 * (1 - oceanCoverage), 0, 0.4);
    vegColour = d.vegetationDeepHex || d.vegetationPaleHex;
  }

  // Special effects
  let special = null;
  if (tempK > 1200) special = "lava";
  else if (tempK < 100 && pressure <= 0.01) special = "frozen";

  // Land palette — for Ocean worlds, exposed land is rocky/earthy, not ocean-blue
  const baseLand =
    d.compositionClass === "Ocean world" ? SURFACE_PALETTES["Earth-like"] : basePalette;
  const landPalette = Number.isFinite(albedo) ? tintPalette(baseLand, albedo) : baseLand;

  return {
    palette,
    landPalette,
    ocean: { coverage: oceanCoverage, colour: oceanColour, frozen },
    iceCaps,
    clouds: { coverage: cloudCoverage, colour: cloudColour },
    atmosphere: { thickness: atmThickness, colour: atmColour },
    terrain: { type: terrainType, craterDensity },
    vegetation: { coverage: vegCoverage, colour: vegColour },
    special,
    tidallyLocked: !!d.tidallyLockedToStar,
    seed: inp.name || "planet",
  };
}

// ── 180×180 px preview renderer ──────────────────────────────────

export function drawRockyPlanetPreview(canvas, profile, opts = {}) {
  if (!canvas || !profile) return;
  renderRockyPreviewNative(canvas, profile, opts);
}

// ── Rocky planet recipe presets ──────────────────────────────────
//
// Each recipe defines: preview data (hardcoded derived + inputs for the
// picker thumbnail) and apply data (planet input overrides). Clicking a
// recipe sets the planet's surface/atmosphere inputs. Extreme-temperature
// recipes also set semiMajorAxisAu so the engine produces the correct
// visual effects (lava cracks, frozen surfaces, etc.).

const ROCKY_RECIPES = [
  // ── Terrestrial ───────────────────────────────────────────────
  {
    id: "blue-marble",
    label: "Blue Marble",
    category: "Terrestrial",
    preview: {
      derived: {
        compositionClass: "Ocean world",
        waterRegime: "Extensive oceans",
        surfaceTempK: 288,
        tectonicRegime: "mobile",
        skyColourDayHex: "#93B6FF",
        vegetationPaleHex: "#4a7c32",
        vegetationDeepHex: "#1a3d0c",
        tidallyLockedToStar: false,
        radiusEarth: 1.0,
        radiusKm: 6371,
      },
      inputs: {
        pressureAtm: 1,
        h2oPct: 1,
        axialTiltDeg: 23.5,
        co2Pct: 0.04,
        albedoBond: 0.3,
        name: "Blue Marble",
      },
    },
    apply: {
      massEarth: 1,
      cmfPct: 33,
      wmfPct: 0.5,
      pressureAtm: 1,
      o2Pct: 21,
      co2Pct: 0.04,
      h2oPct: 1,
      ch4Pct: 0,
      h2Pct: 0,
      hePct: 0,
      so2Pct: 0,
      nh3Pct: 0,
      axialTiltDeg: 23.5,
      albedoBond: 0.3,
      tectonicRegime: "mobile",
      greenhouseEffect: 1,
      vegOverride: false,
      vegPaleHexOverride: "",
      vegDeepHexOverride: "",
    },
  },
  {
    id: "tropical-jungle",
    label: "Tropical Jungle",
    category: "Terrestrial",
    preview: {
      derived: {
        compositionClass: "Ocean world",
        waterRegime: "Extensive oceans",
        surfaceTempK: 310,
        tectonicRegime: "episodic",
        skyColourDayHex: "#7DA8E8",
        vegetationPaleHex: "#4a8a3a",
        vegetationDeepHex: "#2a5a1a",
        tidallyLockedToStar: false,
        radiusEarth: 1.2,
        radiusKm: 7645,
      },
      inputs: {
        pressureAtm: 1.8,
        h2oPct: 3,
        axialTiltDeg: 10,
        co2Pct: 0.08,
        albedoBond: 0.25,
        name: "Tropical Jungle",
      },
    },
    apply: {
      massEarth: 1.5,
      cmfPct: 30,
      wmfPct: 0.5,
      pressureAtm: 1.8,
      o2Pct: 22,
      co2Pct: 0.08,
      h2oPct: 3,
      ch4Pct: 0,
      h2Pct: 0,
      hePct: 0,
      so2Pct: 0,
      nh3Pct: 0,
      axialTiltDeg: 10,
      albedoBond: 0.25,
      tectonicRegime: "episodic",
      greenhouseEffect: 1.2,
      vegOverride: true,
      vegPaleHexOverride: "#4a8a3a",
      vegDeepHexOverride: "#2a5a1a",
    },
  },
  {
    id: "arid-steppe",
    label: "Arid Steppe",
    category: "Terrestrial",
    preview: {
      derived: {
        compositionClass: "Mars-like",
        waterRegime: "Shallow oceans",
        surfaceTempK: 305,
        tectonicRegime: "mobile",
        skyColourDayHex: "#B8A87A",
        vegetationPaleHex: "#7a8a4a",
        vegetationDeepHex: "#4a5a2a",
        tidallyLockedToStar: false,
        radiusEarth: 0.85,
        radiusKm: 5415,
      },
      inputs: {
        pressureAtm: 0.6,
        h2oPct: 0.3,
        axialTiltDeg: 30,
        co2Pct: 2,
        albedoBond: 0.22,
        name: "Arid Steppe",
      },
    },
    apply: {
      massEarth: 0.7,
      cmfPct: 18,
      wmfPct: 0.0005,
      pressureAtm: 0.6,
      o2Pct: 15,
      co2Pct: 2,
      h2oPct: 0.3,
      ch4Pct: 0,
      h2Pct: 0,
      hePct: 0,
      so2Pct: 0,
      nh3Pct: 0,
      axialTiltDeg: 30,
      albedoBond: 0.22,
      tectonicRegime: "mobile",
      greenhouseEffect: 0.8,
      vegOverride: true,
      vegPaleHexOverride: "#7a8a4a",
      vegDeepHexOverride: "#4a5a2a",
    },
  },
  {
    id: "tidally-locked",
    label: "Tidally Locked",
    category: "Terrestrial",
    preview: {
      derived: {
        compositionClass: "Ocean world",
        waterRegime: "Extensive oceans",
        surfaceTempK: 300,
        tectonicRegime: "mobile",
        skyColourDayHex: "#8ABAFF",
        vegetationPaleHex: "#3a7a3a",
        vegetationDeepHex: "#1a4a1a",
        tidallyLockedToStar: true,
        radiusEarth: 0.9,
        radiusKm: 5734,
      },
      inputs: {
        pressureAtm: 1.2,
        h2oPct: 1.5,
        axialTiltDeg: 0,
        co2Pct: 0.1,
        albedoBond: 0.32,
        name: "Tidally Locked",
      },
    },
    apply: {
      massEarth: 0.8,
      cmfPct: 32,
      wmfPct: 0.5,
      pressureAtm: 1.2,
      o2Pct: 20,
      co2Pct: 0.1,
      h2oPct: 1.5,
      ch4Pct: 0,
      h2Pct: 0,
      hePct: 0,
      so2Pct: 0,
      nh3Pct: 0,
      axialTiltDeg: 0,
      albedoBond: 0.32,
      tectonicRegime: "mobile",
      greenhouseEffect: 1,
      vegOverride: true,
      vegPaleHexOverride: "#3a7a3a",
      vegDeepHexOverride: "#1a4a1a",
    },
  },

  // ── Barren ────────────────────────────────────────────────────
  {
    id: "red-desert",
    label: "Red Desert",
    category: "Barren",
    preview: {
      derived: {
        compositionClass: "Mars-like",
        waterRegime: "Dry",
        surfaceTempK: 220,
        tectonicRegime: "stagnant",
        skyColourDayHex: "#C4A87A",
        vegetationPaleHex: null,
        vegetationDeepHex: null,
        tidallyLockedToStar: false,
        radiusEarth: 0.53,
        radiusKm: 3390,
      },
      inputs: {
        pressureAtm: 0.006,
        h2oPct: 0,
        axialTiltDeg: 25,
        co2Pct: 95,
        albedoBond: 0.25,
        name: "Red Desert",
      },
    },
    apply: {
      massEarth: 0.1,
      cmfPct: 18,
      wmfPct: 0,
      pressureAtm: 0.006,
      o2Pct: 0,
      co2Pct: 95,
      h2oPct: 0,
      ch4Pct: 0,
      h2Pct: 0,
      hePct: 0,
      so2Pct: 0,
      nh3Pct: 0,
      axialTiltDeg: 25,
      albedoBond: 0.25,
      tectonicRegime: "stagnant",
      greenhouseEffect: 0.05,
      vegOverride: false,
      vegPaleHexOverride: "",
      vegDeepHexOverride: "",
    },
  },
  {
    id: "cratered-husk",
    label: "Cratered Husk",
    category: "Barren",
    preview: {
      derived: {
        compositionClass: "Mercury-like",
        waterRegime: "Dry",
        surfaceTempK: 440,
        tectonicRegime: "stagnant",
        skyColourDayHex: null,
        vegetationPaleHex: null,
        vegetationDeepHex: null,
        tidallyLockedToStar: false,
        radiusEarth: 0.38,
        radiusKm: 2440,
      },
      inputs: {
        pressureAtm: 0,
        h2oPct: 0,
        axialTiltDeg: 0,
        co2Pct: 0,
        albedoBond: 0.12,
        name: "Cratered Husk",
      },
    },
    apply: {
      massEarth: 0.055,
      cmfPct: 55,
      wmfPct: 0,
      pressureAtm: 0,
      o2Pct: 0,
      co2Pct: 0,
      h2oPct: 0,
      ch4Pct: 0,
      h2Pct: 0,
      hePct: 0,
      so2Pct: 0,
      nh3Pct: 0,
      axialTiltDeg: 0,
      albedoBond: 0.12,
      tectonicRegime: "stagnant",
      greenhouseEffect: 0,
      vegOverride: false,
      vegPaleHexOverride: "",
      vegDeepHexOverride: "",
    },
  },
  {
    id: "iron-fortress",
    label: "Iron Fortress",
    category: "Barren",
    preview: {
      derived: {
        compositionClass: "Iron world",
        waterRegime: "Dry",
        surfaceTempK: 350,
        tectonicRegime: "mobile",
        skyColourDayHex: "#6070A0",
        vegetationPaleHex: null,
        vegetationDeepHex: null,
        tidallyLockedToStar: false,
        radiusEarth: 0.8,
        radiusKm: 5097,
      },
      inputs: {
        pressureAtm: 0.3,
        h2oPct: 0,
        axialTiltDeg: 5,
        co2Pct: 5,
        albedoBond: 0.1,
        name: "Iron Fortress",
      },
    },
    apply: {
      massEarth: 1.5,
      cmfPct: 70,
      wmfPct: 0,
      pressureAtm: 0.3,
      o2Pct: 2,
      co2Pct: 5,
      h2oPct: 0,
      ch4Pct: 0,
      h2Pct: 0,
      hePct: 0,
      so2Pct: 0,
      nh3Pct: 0,
      axialTiltDeg: 5,
      albedoBond: 0.1,
      tectonicRegime: "mobile",
      greenhouseEffect: 0.3,
      vegOverride: false,
      vegPaleHexOverride: "",
      vegDeepHexOverride: "",
    },
  },
  {
    id: "pale-mantle",
    label: "Pale Mantle",
    category: "Barren",
    preview: {
      derived: {
        compositionClass: "Coreless",
        waterRegime: "Shallow oceans",
        surfaceTempK: 310,
        tectonicRegime: "episodic",
        skyColourDayHex: "#A0B8C8",
        vegetationPaleHex: null,
        vegetationDeepHex: null,
        tidallyLockedToStar: false,
        radiusEarth: 1.1,
        radiusKm: 7008,
      },
      inputs: {
        pressureAtm: 0.7,
        h2oPct: 0.5,
        axialTiltDeg: 15,
        co2Pct: 1,
        albedoBond: 0.35,
        name: "Pale Mantle",
      },
    },
    apply: {
      massEarth: 0.9,
      cmfPct: 5,
      wmfPct: 0.0005,
      pressureAtm: 0.7,
      o2Pct: 8,
      co2Pct: 1,
      h2oPct: 0.5,
      ch4Pct: 0,
      h2Pct: 0,
      hePct: 0,
      so2Pct: 0.1,
      nh3Pct: 0,
      axialTiltDeg: 15,
      albedoBond: 0.35,
      tectonicRegime: "episodic",
      greenhouseEffect: 0.5,
      vegOverride: false,
      vegPaleHexOverride: "",
      vegDeepHexOverride: "",
    },
  },

  // ── Extreme ───────────────────────────────────────────────────
  {
    id: "lava-world",
    label: "Lava World",
    category: "Extreme",
    preview: {
      derived: {
        compositionClass: "Earth-like",
        waterRegime: "Dry",
        surfaceTempK: 1500,
        tectonicRegime: "episodic",
        skyColourDayHex: "#FF6820",
        vegetationPaleHex: null,
        vegetationDeepHex: null,
        tidallyLockedToStar: false,
        radiusEarth: 1.1,
        radiusKm: 7008,
      },
      inputs: {
        pressureAtm: 0.1,
        h2oPct: 0,
        axialTiltDeg: 0,
        co2Pct: 20,
        albedoBond: 0.08,
        name: "Lava World",
      },
    },
    apply: {
      semiMajorAxisAu: 0.04,
      massEarth: 1.2,
      cmfPct: 33,
      wmfPct: 0,
      pressureAtm: 0.1,
      o2Pct: 0,
      co2Pct: 20,
      h2oPct: 0,
      ch4Pct: 0,
      h2Pct: 0,
      hePct: 0,
      so2Pct: 5,
      nh3Pct: 0,
      axialTiltDeg: 0,
      albedoBond: 0.08,
      tectonicRegime: "episodic",
      greenhouseEffect: 8,
      vegOverride: false,
      vegPaleHexOverride: "",
      vegDeepHexOverride: "",
    },
  },
  {
    id: "venus-shroud",
    label: "Venus Shroud",
    category: "Extreme",
    preview: {
      derived: {
        compositionClass: "Earth-like",
        waterRegime: "Dry",
        surfaceTempK: 735,
        tectonicRegime: "episodic",
        skyColourDayHex: "#E0B050",
        vegetationPaleHex: null,
        vegetationDeepHex: null,
        tidallyLockedToStar: false,
        radiusEarth: 0.95,
        radiusKm: 6052,
      },
      inputs: {
        pressureAtm: 92,
        h2oPct: 0.002,
        axialTiltDeg: 3,
        co2Pct: 96,
        albedoBond: 0.76,
        name: "Venus Shroud",
      },
    },
    apply: {
      semiMajorAxisAu: 0.72,
      massEarth: 0.82,
      cmfPct: 32,
      wmfPct: 0,
      pressureAtm: 92,
      o2Pct: 0,
      co2Pct: 96,
      h2oPct: 0.002,
      ch4Pct: 0,
      h2Pct: 0,
      hePct: 0,
      so2Pct: 0.015,
      nh3Pct: 0,
      axialTiltDeg: 3,
      albedoBond: 0.76,
      tectonicRegime: "episodic",
      greenhouseEffect: 200,
      vegOverride: false,
      vegPaleHexOverride: "",
      vegDeepHexOverride: "",
    },
  },
  {
    id: "frozen-wasteland",
    label: "Frozen Wasteland",
    category: "Extreme",
    preview: {
      derived: {
        compositionClass: "Ice world",
        waterRegime: "Ice world",
        surfaceTempK: 60,
        tectonicRegime: "stagnant",
        skyColourDayHex: null,
        vegetationPaleHex: null,
        vegetationDeepHex: null,
        tidallyLockedToStar: false,
        radiusEarth: 0.7,
        radiusKm: 4460,
      },
      inputs: {
        pressureAtm: 0,
        h2oPct: 0,
        axialTiltDeg: 5,
        co2Pct: 0,
        albedoBond: 0.7,
        name: "Frozen Wasteland",
      },
    },
    apply: {
      semiMajorAxisAu: 15,
      massEarth: 0.3,
      cmfPct: 15,
      wmfPct: 40,
      pressureAtm: 0,
      o2Pct: 0,
      co2Pct: 0,
      h2oPct: 0,
      ch4Pct: 0,
      h2Pct: 0,
      hePct: 0,
      so2Pct: 0,
      nh3Pct: 0,
      axialTiltDeg: 5,
      albedoBond: 0.7,
      tectonicRegime: "stagnant",
      greenhouseEffect: 0,
      vegOverride: false,
      vegPaleHexOverride: "",
      vegDeepHexOverride: "",
    },
  },
  {
    id: "snowball",
    label: "Snowball",
    category: "Extreme",
    preview: {
      derived: {
        compositionClass: "Ocean world",
        waterRegime: "Global ocean",
        surfaceTempK: 230,
        tectonicRegime: "stagnant",
        skyColourDayHex: "#A0C0E0",
        vegetationPaleHex: null,
        vegetationDeepHex: null,
        tidallyLockedToStar: false,
        radiusEarth: 1.0,
        radiusKm: 6371,
      },
      inputs: {
        pressureAtm: 0.5,
        h2oPct: 0.8,
        axialTiltDeg: 40,
        co2Pct: 2,
        albedoBond: 0.65,
        name: "Snowball",
      },
    },
    apply: {
      semiMajorAxisAu: 1.5,
      massEarth: 1.0,
      cmfPct: 33,
      wmfPct: 5,
      pressureAtm: 0.5,
      o2Pct: 10,
      co2Pct: 2,
      h2oPct: 0.8,
      ch4Pct: 0,
      h2Pct: 0,
      hePct: 0,
      so2Pct: 0,
      nh3Pct: 0,
      axialTiltDeg: 40,
      albedoBond: 0.65,
      tectonicRegime: "stagnant",
      greenhouseEffect: 0.2,
      vegOverride: false,
      vegPaleHexOverride: "",
      vegDeepHexOverride: "",
    },
  },

  // ── Ocean ─────────────────────────────────────────────────────
  {
    id: "water-world",
    label: "Water World",
    category: "Ocean",
    preview: {
      derived: {
        compositionClass: "Ocean world",
        waterRegime: "Global ocean",
        surfaceTempK: 280,
        tectonicRegime: "mobile",
        skyColourDayHex: "#88BBEE",
        vegetationPaleHex: null,
        vegetationDeepHex: null,
        tidallyLockedToStar: false,
        radiusEarth: 1.3,
        radiusKm: 8282,
      },
      inputs: {
        pressureAtm: 1.5,
        h2oPct: 2.5,
        axialTiltDeg: 5,
        co2Pct: 0.5,
        albedoBond: 0.35,
        name: "Water World",
      },
    },
    apply: {
      massEarth: 2.0,
      cmfPct: 25,
      wmfPct: 5,
      pressureAtm: 1.5,
      o2Pct: 18,
      co2Pct: 0.5,
      h2oPct: 2.5,
      ch4Pct: 0,
      h2Pct: 0,
      hePct: 0,
      so2Pct: 0,
      nh3Pct: 0,
      axialTiltDeg: 5,
      albedoBond: 0.35,
      tectonicRegime: "mobile",
      greenhouseEffect: 1,
      vegOverride: false,
      vegPaleHexOverride: "",
      vegDeepHexOverride: "",
    },
  },
  {
    id: "archipelago",
    label: "Archipelago",
    category: "Ocean",
    preview: {
      derived: {
        compositionClass: "Ocean world",
        waterRegime: "Extensive oceans",
        surfaceTempK: 295,
        tectonicRegime: "episodic",
        skyColourDayHex: "#80B0E0",
        vegetationPaleHex: "#2a7a4a",
        vegetationDeepHex: "#0a4a2a",
        tidallyLockedToStar: false,
        radiusEarth: 1.1,
        radiusKm: 7008,
      },
      inputs: {
        pressureAtm: 1.3,
        h2oPct: 2,
        axialTiltDeg: 20,
        co2Pct: 0.3,
        albedoBond: 0.3,
        name: "Archipelago",
      },
    },
    apply: {
      massEarth: 1.5,
      cmfPct: 25,
      wmfPct: 0.8,
      pressureAtm: 1.3,
      o2Pct: 20,
      co2Pct: 0.3,
      h2oPct: 2,
      ch4Pct: 0,
      h2Pct: 0,
      hePct: 0,
      so2Pct: 0,
      nh3Pct: 0,
      axialTiltDeg: 20,
      albedoBond: 0.3,
      tectonicRegime: "episodic",
      greenhouseEffect: 1,
      vegOverride: true,
      vegPaleHexOverride: "#2a7a4a",
      vegDeepHexOverride: "#0a4a2a",
    },
  },
];

export { ROCKY_RECIPES };
