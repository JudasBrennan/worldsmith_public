import test from "node:test";
import assert from "node:assert/strict";

import { composeCelestialDescriptor } from "../ui/celestialComposer.js";

test("composeCelestialDescriptor → rocky Earth-like → base layers and rotation", () => {
  const descriptor = composeCelestialDescriptor(
    {
      bodyType: "rocky",
      name: "Gaia",
      inputs: {
        name: "Gaia",
        rotationPeriodHours: 24,
        axialTiltDeg: 23.5,
        pressureAtm: 1,
        h2oPct: 10,
      },
      derived: {
        compositionClass: "Earth-like",
        waterRegime: "Shallow oceans",
        surfaceTempK: 288,
        tectonicRegime: "mobile",
        skyColourDayHex: "#93b6ff",
      },
    },
    { lod: "medium" },
  );

  assert.equal(descriptor.bodyType, "rocky");
  assert.equal(descriptor.textureSize, 256);
  assert.ok(descriptor.layers.some((layer) => layer.id === "base-gradient"));
  assert.ok(descriptor.layers.some((layer) => layer.id === "continents"));
  assert.ok(descriptor.layers.some((layer) => layer.id === "clouds"));
  assert.ok(descriptor.rotationPeriodDays > 0.9 && descriptor.rotationPeriodDays < 1.1);
});

test("composeCelestialDescriptor → gas giant + showRings → ring enabled", () => {
  const descriptor = composeCelestialDescriptor(
    {
      bodyType: "gasGiant",
      name: "Aurelius",
      styleId: "saturn",
      showRings: true,
      rotationPeriodHours: 10.7,
    },
    { lod: "high" },
  );

  assert.equal(descriptor.bodyType, "gasGiant");
  assert.equal(descriptor.textureSize, 384);
  assert.equal(descriptor.ring.enabled, true);
  assert.equal(descriptor.atmosphere?.enabled, false);
  assert.ok(descriptor.layers.some((layer) => layer.id === "gas-bands"));
});

test("composeCelestialDescriptor → moon subsurface-ocean → fracture layers present", () => {
  const descriptor = composeCelestialDescriptor({
    bodyType: "moon",
    name: "Neris",
    moonProfile: {
      bodyType: "moon",
      displayClass: "Subsurface ocean",
      palette: { c1: "#c8d8e8", c2: "#90b0c8", c3: "#4a7090" },
      terrain: { type: "icy-smooth", craterDensity: 0.18 },
      iceCoverage: 0.95,
      iceColour: "#e8f0ff",
      tidalHeating: { active: true, intensity: 0.2 },
      atmosphere: { thickness: 0.02, colour: "#8db3d9" },
      special: "subsurface-ocean",
      tidallyLocked: true,
      seed: "neris",
    },
  });

  assert.equal(descriptor.bodyType, "moon");
  assert.ok(descriptor.layers.some((layer) => layer.id === "fractures"));
});

test("composeCelestialDescriptor → unknown LOD → falls back to medium", () => {
  const descriptor = composeCelestialDescriptor(
    {
      bodyType: "rocky",
      name: "Fallback",
      inputs: { rotationPeriodHours: 30 },
      derived: { compositionClass: "Earth-like", waterRegime: "Dry", tectonicRegime: "stagnant" },
    },
    { lod: "nonsense" },
  );

  assert.equal(descriptor.lod, "medium");
  assert.equal(descriptor.textureSize, 256);
});

/* ───── paintCelestialSpherePreview ───── */
test("composeCelestialDescriptor → blue-marble recipe → valid rocky descriptor", () => {
  const descriptor = composeCelestialDescriptor(
    {
      bodyType: "rocky",
      name: "Blue Marble",
      recipeId: "blue-marble",
      inputs: { pressureAtm: 1, h2oPct: 1, axialTiltDeg: 23.5, name: "Blue Marble" },
      derived: {
        compositionClass: "Ocean world",
        waterRegime: "Extensive oceans",
        surfaceTempK: 288,
        tectonicRegime: "mobile",
        skyColourDayHex: "#93B6FF",
      },
    },
    { lod: "low" },
  );

  assert.equal(descriptor.bodyType, "rocky");
  assert.equal(descriptor.lod, "low");
  assert.equal(descriptor.textureSize, 128);
  assert.ok(descriptor.layers.length > 0);
  assert.ok(descriptor.seed.includes("Blue Marble"));
});

test("composeCelestialDescriptor → jupiter style → valid gas giant descriptor", () => {
  const descriptor = composeCelestialDescriptor(
    {
      bodyType: "gasGiant",
      name: "Jupiter",
      styleId: "jupiter",
      showRings: false,
      rotationPeriodHours: 9.93,
    },
    { lod: "low" },
  );

  assert.equal(descriptor.bodyType, "gasGiant");
  assert.equal(descriptor.lod, "low");
  assert.ok(descriptor.layers.some((l) => l.id === "gas-bands"));
  assert.ok(descriptor.gasVisual !== null);
});

test("composeCelestialDescriptor → luna recipe → valid moon descriptor", () => {
  const descriptor = composeCelestialDescriptor(
    {
      bodyType: "moon",
      name: "Luna",
      recipeId: "luna",
    },
    { lod: "low" },
  );

  assert.equal(descriptor.bodyType, "moon");
  assert.equal(descriptor.lod, "low");
  assert.ok(descriptor.layers.length > 0);
});
