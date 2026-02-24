/**
 * Unified Body Renderer Dispatch Tests
 *
 * Tests the dispatch layer in bodyRenderer.js which routes
 * computeBodyProfile / drawBodyPreview / drawBodyViz to
 * body-type-specific modules. Canvas drawing is not tested
 * (requires browser context); focus is on profile computation
 * dispatch and the registerBodyRenderer extensibility hook.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { computeBodyProfile, registerBodyRenderer } from "../ui/bodyRenderer.js";

// ── Helper factories ─────────────────────────────────────────────

function makeRockyData(overrides = {}) {
  return {
    derived: {
      compositionClass: "Earth-like",
      waterRegime: "Shallow oceans",
      surfaceTempK: 288,
      tectonicRegime: "mobile",
      skyColourDayHex: "#93B6FF",
      vegetationPaleHex: "#4a7c32",
      vegetationDeepHex: "#1a3d0c",
      tidallyLockedToStar: false,
      radiusEarth: 1.0,
      radiusKm: 6371,
      ...overrides.derived,
    },
    inputs: {
      pressureAtm: 1,
      h2oPct: 0.4,
      axialTiltDeg: 23.5,
      co2Pct: 0.04,
      albedoBond: 0.3,
      name: "TestRocky",
      ...overrides.inputs,
    },
  };
}

function makeMoonCalc(overrides = {}) {
  return {
    moonCalc: {
      inputs: { densityGcm3: 3.34, albedo: 0.11, name: "TestMoon" },
      physical: { radiusMoon: 1 },
      tides: {
        compositionClass: "Rocky",
        tidalHeatingEarth: 0,
        moonLockedToPlanet: "Yes",
      },
      ...overrides,
    },
  };
}

function makeGasGiantData(overrides = {}) {
  const base = {
    ggCalc: {
      classification: { sudarsky: "I" },
      inputs: { massMjup: 1.0 },
      thermal: { equilibriumTempK: 130 },
      atmosphere: { metallicitySolar: 1, hePct: 10 },
      ringProperties: { opticalDepthClass: "Tenuous" },
      physical: { radiusRj: 1.0, suggestedRadiusRj: 1.0 },
    },
  };
  return { ...base, ...overrides };
}

// ── Rocky dispatch ──────────────────────────────────────────────

test("computeBodyProfile('rocky') returns profile with palette", () => {
  const profile = computeBodyProfile("rocky", makeRockyData({ inputs: { albedoBond: undefined } }));
  assert.ok(profile.palette, "has palette");
  assert.equal(profile.palette.c1, "#c4a882");
  assert.equal(profile.terrain.type, "continental");
});

test("computeBodyProfile('rocky') propagates seed from name", () => {
  const profile = computeBodyProfile("rocky", makeRockyData({ inputs: { name: "Arrakis" } }));
  assert.equal(profile.seed, "Arrakis");
});

// ── Moon dispatch ───────────────────────────────────────────────

test("computeBodyProfile('moon') returns profile with bodyType", () => {
  const profile = computeBodyProfile("moon", makeMoonCalc());
  assert.equal(profile.bodyType, "moon");
  assert.ok(profile.palette, "has palette");
  assert.equal(profile.terrain.type, "cratered");
});

test("computeBodyProfile('moon') passes moonCalc through", () => {
  const profile = computeBodyProfile(
    "moon",
    makeMoonCalc({
      tides: { compositionClass: "Very icy", tidalHeatingEarth: 0, moonLockedToPlanet: "No" },
    }),
  );
  assert.equal(profile.iceCoverage, 1);
  assert.equal(profile.tidallyLocked, false);
});

// ── Gas giant dispatch ──────────────────────────────────────────

test("computeBodyProfile('gasGiant') returns profile with bodyType and styleId", () => {
  const profile = computeBodyProfile("gasGiant", makeGasGiantData());
  assert.equal(profile.bodyType, "gasGiant");
  assert.equal(profile.styleId, "jupiter");
});

test("computeBodyProfile('gasGiant') derives style from ggCalc", () => {
  const profile = computeBodyProfile(
    "gasGiant",
    makeGasGiantData({
      ggCalc: {
        classification: { sudarsky: "I" },
        inputs: { massMjup: 0.3 },
        thermal: { equilibriumTempK: 90 },
        atmosphere: { metallicitySolar: 1, hePct: 10 },
        ringProperties: { opticalDepthClass: "Tenuous" },
        physical: { radiusRj: 0.9, suggestedRadiusRj: 0.9 },
      },
    }),
  );
  assert.equal(profile.styleId, "saturn");
});

// ── Unknown type ────────────────────────────────────────────────

test("computeBodyProfile throws for unknown body type", () => {
  assert.throws(() => computeBodyProfile("comet", {}), { message: /Unknown body type: comet/ });
});

// ── registerBodyRenderer ────────────────────────────────────────

test("registerBodyRenderer adds a new type that computes profiles", () => {
  registerBodyRenderer("asteroid", {
    computeProfile: (data) => ({ bodyType: "asteroid", shape: data.shape }),
    drawPreview: () => {},
    drawViz: () => {},
  });
  const profile = computeBodyProfile("asteroid", { shape: "irregular" });
  assert.equal(profile.bodyType, "asteroid");
  assert.equal(profile.shape, "irregular");
});

// ── All built-in types return objects ───────────────────────────

test("all built-in types return non-null objects from computeBodyProfile", () => {
  const cases = [
    ["rocky", makeRockyData()],
    ["moon", makeMoonCalc()],
    ["gasGiant", makeGasGiantData()],
  ];
  for (const [type, data] of cases) {
    const profile = computeBodyProfile(type, data);
    assert.equal(typeof profile, "object", `${type} returns object`);
    assert.ok(profile !== null, `${type} is non-null`);
  }
});

// ── Determinism ─────────────────────────────────────────────────

test("same inputs produce identical profiles for all types", () => {
  const cases = [
    ["rocky", makeRockyData()],
    ["moon", makeMoonCalc()],
    ["gasGiant", makeGasGiantData()],
  ];
  for (const [type, data] of cases) {
    const p1 = computeBodyProfile(type, data);
    const p2 = computeBodyProfile(type, data);
    assert.deepStrictEqual(p1, p2, `${type} is deterministic`);
  }
});
