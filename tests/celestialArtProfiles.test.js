import test from "node:test";
import assert from "node:assert/strict";

import { GAS_GIANT_STYLES, GAS_GIANT_RECIPES } from "../ui/gasGiantStyles.js";
import { MOON_RECIPES } from "../ui/moonStyles.js";
import { ROCKY_RECIPES } from "../ui/rockyPlanetStyles.js";
import {
  buildGasArtProfile,
  buildMoonArtProfile,
  buildRockyArtProfile,
} from "../ui/celestialArtProfiles.js";
import { composeCelestialDescriptor } from "../ui/celestialComposer.js";

test("buildRockyArtProfile → every rocky recipe → resolves with profileId", () => {
  for (const recipe of ROCKY_RECIPES) {
    const profile = buildRockyArtProfile({ recipeId: recipe.id }, 0.68);
    assert.ok(profile);
    assert.equal(typeof profile.profileId, "string");
    assert.ok(profile.profileId.length > 0);
  }
});

test("buildMoonArtProfile → every moon recipe → resolves with profileId", () => {
  for (const recipe of MOON_RECIPES) {
    const profile = buildMoonArtProfile({ recipeId: recipe.id }, 0.68);
    assert.ok(profile);
    assert.equal(typeof profile.profileId, "string");
    assert.ok(profile.profileId.length > 0);
  }
});

test("buildGasArtProfile → every gas style → resolves with profileId", () => {
  for (const style of GAS_GIANT_STYLES) {
    const profile = buildGasArtProfile({ styleId: style.id }, 0.68);
    assert.ok(profile);
    assert.equal(typeof profile.profileId, "string");
    assert.ok(profile.profileId.length > 0);
  }
});

test("buildGasArtProfile → gas recipe alias → resolves to style-backed profileId", () => {
  for (const recipe of GAS_GIANT_RECIPES) {
    const styleId = recipe.preview?.styleId || "jupiter";
    const profile = buildGasArtProfile({ styleId, recipeId: recipe.id }, 0.68);
    assert.ok(profile.profileId.length > 0);
  }
});

test("composeCelestialDescriptor → lava-world recipe → includes volcanic-system and rift-lines", () => {
  const descriptor = composeCelestialDescriptor(
    {
      bodyType: "rocky",
      name: "Vulcanis",
      recipeId: "lava-world",
      inputs: { name: "Vulcanis", rotationPeriodHours: 22, pressureAtm: 0.4 },
      derived: {
        compositionClass: "Earth-like",
        waterRegime: "Dry",
        surfaceTempK: 1500,
        tectonicRegime: "episodic",
      },
    },
    { lod: "high" },
  );

  assert.equal(descriptor.profileId, "lava-world");
  assert.ok(descriptor.layers.some((layer) => layer.id === "volcanic-system"));
  assert.ok(descriptor.layers.some((layer) => layer.id === "rift-lines"));
});

test("composeCelestialDescriptor → europa moon → includes fractures and ice-coverage", () => {
  const descriptor = composeCelestialDescriptor(
    {
      bodyType: "moon",
      name: "Europa",
      recipeId: "europa",
      moonProfile: {
        bodyType: "moon",
        displayClass: "Subsurface ocean",
        palette: { c1: "#d7e6f5", c2: "#a6c2db", c3: "#6989ab" },
        terrain: { type: "icy-smooth", craterDensity: 0.12 },
        iceCoverage: 0.98,
        iceColour: "#eef7ff",
        tidalHeating: { active: true, intensity: 0.22 },
        atmosphere: { thickness: 0.01, colour: "#a6bfd8" },
        special: "subsurface-ocean",
      },
    },
    { lod: "high" },
  );

  assert.equal(descriptor.profileId, "europa");
  assert.ok(descriptor.layers.some((layer) => layer.id === "fractures"));
  assert.ok(descriptor.layers.some((layer) => layer.id === "ice-coverage"));
});

/* ───── gas giant noise-field & storm parameterisation ───── */

const NOISE_KEYS = ["wiggleScale", "shearScale", "turbScale", "patchScale", "noiseWarp"];

test("buildGasArtProfile → all styles → gas-bands include noise-field params", () => {
  for (const style of GAS_GIANT_STYLES) {
    const profile = buildGasArtProfile({ styleId: style.id }, 0.68);
    const bands = profile.layerEdits?.find((l) => l.id === "gas-bands");
    if (!bands) continue; // solid family may omit bands
    for (const key of NOISE_KEYS) {
      assert.equal(typeof bands.params[key], "number", `${style.id} gas-bands missing ${key}`);
      assert.ok(bands.params[key] > 0, `${style.id} gas-bands ${key} must be > 0`);
    }
  }
});

test("buildGasArtProfile → all styles → gasVisual includes noise-field params", () => {
  for (const style of GAS_GIANT_STYLES) {
    const profile = buildGasArtProfile({ styleId: style.id }, 0.68);
    if (!profile.gasVisual) continue;
    for (const key of NOISE_KEYS) {
      assert.equal(typeof profile.gasVisual[key], "number", `${style.id} gasVisual missing ${key}`);
      assert.ok(profile.gasVisual[key] > 0, `${style.id} gasVisual ${key} must be > 0`);
    }
  }
});

test("buildGasArtProfile → all styles → storms have hex colour", () => {
  for (const style of GAS_GIANT_STYLES) {
    const profile = buildGasArtProfile({ styleId: style.id }, 0.68);
    const storms = profile.layerEdits?.find((l) => l.id === "storms");
    if (!storms) continue;
    assert.equal(typeof storms.params.colour, "string", `${style.id} storms missing colour`);
    assert.ok(storms.params.colour.startsWith("#"), `${style.id} storm colour should be hex`);
  }
});

test("buildGasArtProfile → neptune-classic vs neptune → higher turbulence and warp", () => {
  const neptune = buildGasArtProfile({ styleId: "neptune" }, 0.68);
  const classic = buildGasArtProfile({ styleId: "neptune-classic" }, 0.68);
  assert.equal(neptune.profileId, "neptune");
  assert.equal(classic.profileId, "neptune-classic");
  const nBands = neptune.layerEdits.find((l) => l.id === "gas-bands").params;
  const cBands = classic.layerEdits.find((l) => l.id === "gas-bands").params;
  // neptune-classic should have higher turbulence and warp
  assert.ok(cBands.turbulence > nBands.turbulence, "neptune-classic should have higher turbulence");
  assert.ok(cBands.noiseWarp > nBands.noiseWarp, "neptune-classic should have higher noiseWarp");
  assert.ok(
    cBands.wiggleScale > nBands.wiggleScale,
    "neptune-classic should have higher wiggleScale",
  );
});

test("buildGasArtProfile → ringed-ice → fully specified with ring and atmosphere", () => {
  const profile = buildGasArtProfile({ styleId: "ringed-ice" }, 0.68);
  assert.equal(profile.profileId, "ringed-ice");
  assert.ok(profile.layerEdits?.length > 0, "ringed-ice should have layerEdits");
  assert.ok(profile.gasVisual, "ringed-ice should have gasVisual");
  assert.ok(profile.ring, "ringed-ice should have ring");
  assert.ok(profile.atmosphere, "ringed-ice should have atmosphere");
  const bands = profile.layerEdits.find((l) => l.id === "gas-bands");
  assert.ok(bands, "ringed-ice should have gas-bands");
  assert.equal(bands.params.family, "patchy");
});

test("composeCelestialDescriptor → saturn with rings → extended ring treatment", () => {
  const descriptor = composeCelestialDescriptor(
    {
      bodyType: "gasGiant",
      name: "Saturn",
      styleId: "saturn",
      showRings: true,
      rotationPeriodHours: 10.7,
    },
    { lod: "medium" },
  );

  assert.equal(descriptor.profileId, "saturn");
  assert.equal(descriptor.ring.enabled, true);
  assert.ok(Number(descriptor.ring.outer) > 2);
});
