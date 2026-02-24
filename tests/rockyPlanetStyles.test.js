/**
 * Rocky Planet Visual Profile Tests
 *
 * Tests the computeRockyVisualProfile() function which translates
 * engine-derived physical properties into a visual rendering profile.
 * Canvas rendering itself is not tested (requires browser context).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { computeRockyVisualProfile } from "../ui/rockyPlanetStyles.js";

// ── Helper factories ─────────────────────────────────────────────

function makeDerived(overrides = {}) {
  return {
    compositionClass: "Earth-like",
    waterRegime: "Shallow oceans",
    surfaceTempK: 288,
    tectonicRegime: "mobile",
    skyColourDayHex: "#93B6FF",
    skyColourDayEdgeHex: "#CFE8FF",
    skyColourHorizonHex: "#D6B06B",
    vegetationPaleHex: "#4a7c32",
    vegetationDeepHex: "#1a3d0c",
    tidallyLockedToStar: false,
    radiusEarth: 1.0,
    radiusKm: 6371,
    ...overrides,
  };
}

function makeInputs(overrides = {}) {
  return {
    pressureAtm: 1,
    h2oPct: 0.4,
    axialTiltDeg: 23.5,
    co2Pct: 0.04,
    albedoBond: 0.3,
    name: "TestPlanet",
    ...overrides,
  };
}

// ── Palette from composition class ───────────────────────────────

test("Earth-like composition -> tan/brown palette (untinted)", () => {
  const p = computeRockyVisualProfile(makeDerived(), makeInputs({ albedoBond: undefined }));
  assert.equal(p.palette.c1, "#c4a882");
  assert.equal(p.palette.c2, "#8b6e4e");
  assert.equal(p.palette.c3, "#4a3726");
});

test("Mars-like composition -> rust palette (untinted)", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ compositionClass: "Mars-like" }),
    makeInputs({ albedoBond: undefined }),
  );
  assert.equal(p.palette.c1, "#c77b4a");
});

test("Mercury-like composition -> grey palette (untinted)", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ compositionClass: "Mercury-like" }),
    makeInputs({ albedoBond: undefined }),
  );
  assert.equal(p.palette.c1, "#b0b0b0");
});

test("Iron world -> dark grey-blue palette (untinted)", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ compositionClass: "Iron world" }),
    makeInputs({ albedoBond: undefined }),
  );
  assert.equal(p.palette.c1, "#6e7080");
});

test("Coreless -> pale tan palette (untinted)", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ compositionClass: "Coreless" }),
    makeInputs({ albedoBond: undefined }),
  );
  assert.equal(p.palette.c1, "#d4c4a8");
});

test("Ice world -> pale blue palette (untinted)", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ compositionClass: "Ice world", waterRegime: "Ice world" }),
    makeInputs({ albedoBond: undefined }),
  );
  assert.equal(p.palette.c1, "#d8e4f0");
});

test("Ocean world -> ocean blue palette (untinted)", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ compositionClass: "Ocean world", waterRegime: "Global ocean" }),
    makeInputs({ albedoBond: undefined }),
  );
  assert.equal(p.palette.c1, "#4a8cb0");
});

test("unknown composition falls back to Earth-like (untinted)", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ compositionClass: "Unknown" }),
    makeInputs({ albedoBond: undefined }),
  );
  assert.equal(p.palette.c1, "#c4a882");
});

// ── Ocean coverage from water regime ─────────────────────────────

test("Dry water regime -> zero ocean coverage", () => {
  const p = computeRockyVisualProfile(makeDerived({ waterRegime: "Dry" }), makeInputs());
  assert.equal(p.ocean.coverage, 0);
});

test("Shallow oceans -> 0.3 coverage", () => {
  const p = computeRockyVisualProfile(makeDerived({ waterRegime: "Shallow oceans" }), makeInputs());
  assert.equal(p.ocean.coverage, 0.3);
});

test("Extensive oceans -> 0.65 coverage", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ waterRegime: "Extensive oceans" }),
    makeInputs(),
  );
  assert.equal(p.ocean.coverage, 0.65);
});

test("Global ocean -> 0.95 coverage", () => {
  const p = computeRockyVisualProfile(makeDerived({ waterRegime: "Global ocean" }), makeInputs());
  assert.equal(p.ocean.coverage, 0.95);
});

test("Deep ocean -> 1.0 coverage", () => {
  const p = computeRockyVisualProfile(makeDerived({ waterRegime: "Deep ocean" }), makeInputs());
  assert.equal(p.ocean.coverage, 1.0);
});

test("Ice world regime -> zero ocean, full ice caps", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ waterRegime: "Ice world", compositionClass: "Ice world" }),
    makeInputs(),
  );
  assert.equal(p.ocean.coverage, 0);
  assert.equal(p.iceCaps.north, 1);
  assert.equal(p.iceCaps.south, 1);
});

test("ocean frozen when T < 273K", () => {
  const p = computeRockyVisualProfile(makeDerived({ surfaceTempK: 250 }), makeInputs());
  assert.equal(p.ocean.frozen, true);
});

test("ocean not frozen when T >= 273K", () => {
  const p = computeRockyVisualProfile(makeDerived({ surfaceTempK: 288 }), makeInputs());
  assert.equal(p.ocean.frozen, false);
});

// ── Ice caps from temperature ────────────────────────────────────

test("very cold planet (<200K) -> large ice caps", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ surfaceTempK: 150 }),
    makeInputs({ axialTiltDeg: 0 }),
  );
  assert.ok(p.iceCaps.north >= 0.7, `north ${p.iceCaps.north} >= 0.7`);
  assert.ok(p.iceCaps.south >= 0.7, `south ${p.iceCaps.south} >= 0.7`);
});

test("temperate planet (288K) -> small ice caps", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ surfaceTempK: 288 }),
    makeInputs({ axialTiltDeg: 0 }),
  );
  assert.ok(p.iceCaps.north > 0, `north cap exists: ${p.iceCaps.north}`);
  assert.ok(p.iceCaps.north < 0.15, `north cap small: ${p.iceCaps.north}`);
});

test("hot planet (>350K) -> no ice caps", () => {
  const p = computeRockyVisualProfile(makeDerived({ surfaceTempK: 400 }), makeInputs());
  assert.ok(p.iceCaps.north < 0.01, `north ${p.iceCaps.north}`);
  assert.ok(p.iceCaps.south < 0.01, `south ${p.iceCaps.south}`);
});

test("high axial tilt -> asymmetric ice caps", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ surfaceTempK: 260 }),
    makeInputs({ axialTiltDeg: 80 }),
  );
  assert.ok(
    p.iceCaps.north > p.iceCaps.south,
    `north ${p.iceCaps.north} > south ${p.iceCaps.south}`,
  );
});

test("zero tilt -> symmetric ice caps", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ surfaceTempK: 260 }),
    makeInputs({ axialTiltDeg: 0 }),
  );
  assert.ok(
    Math.abs(p.iceCaps.north - p.iceCaps.south) < 0.001,
    `symmetric: ${p.iceCaps.north} vs ${p.iceCaps.south}`,
  );
});

// ── Cloud coverage ───────────────────────────────────────────────

test("no atmosphere -> no clouds", () => {
  const p = computeRockyVisualProfile(makeDerived(), makeInputs({ pressureAtm: 0, h2oPct: 1 }));
  assert.equal(p.clouds.coverage, 0);
});

test("Earth-like atmosphere -> moderate clouds", () => {
  const p = computeRockyVisualProfile(makeDerived(), makeInputs({ pressureAtm: 1, h2oPct: 1 }));
  assert.ok(p.clouds.coverage > 0, `coverage > 0: ${p.clouds.coverage}`);
  assert.ok(p.clouds.coverage < 0.5, `coverage < 0.5: ${p.clouds.coverage}`);
});

test("Venus-like -> near-total cloud cover, yellowish", () => {
  const p = computeRockyVisualProfile(
    makeDerived(),
    makeInputs({ pressureAtm: 90, co2Pct: 96, h2oPct: 0.005 }),
  );
  assert.equal(p.clouds.coverage, 0.95);
  assert.equal(p.clouds.colour, "#e0d0a0");
});

// ── Atmosphere thickness ─────────────────────────────────────────

test("zero pressure -> no atmosphere rim", () => {
  const p = computeRockyVisualProfile(makeDerived(), makeInputs({ pressureAtm: 0 }));
  assert.equal(p.atmosphere.thickness, 0);
});

test("Earth-like pressure -> moderate atmosphere rim", () => {
  const p = computeRockyVisualProfile(makeDerived(), makeInputs({ pressureAtm: 1 }));
  assert.ok(p.atmosphere.thickness > 0.02, `thickness ${p.atmosphere.thickness}`);
  assert.ok(p.atmosphere.thickness < 0.1, `thickness ${p.atmosphere.thickness}`);
});

test("high pressure (90 atm) -> thick atmosphere rim", () => {
  const p = computeRockyVisualProfile(makeDerived(), makeInputs({ pressureAtm: 90 }));
  assert.ok(p.atmosphere.thickness > 0.1, `thickness ${p.atmosphere.thickness}`);
});

test("atmosphere colour from sky colour", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ skyColourDayHex: "#FF0000" }),
    makeInputs({ pressureAtm: 1 }),
  );
  assert.equal(p.atmosphere.colour, "#FF0000");
});

// ── Terrain type from tectonic regime ────────────────────────────

test("stagnant + no atmosphere -> cratered terrain", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ tectonicRegime: "stagnant" }),
    makeInputs({ pressureAtm: 0 }),
  );
  assert.equal(p.terrain.type, "cratered");
  assert.ok(p.terrain.craterDensity > 0.5);
});

test("stagnant + atmosphere -> worn terrain", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ tectonicRegime: "stagnant" }),
    makeInputs({ pressureAtm: 1 }),
  );
  assert.equal(p.terrain.type, "worn");
});

test("mobile -> continental terrain", () => {
  const p = computeRockyVisualProfile(makeDerived({ tectonicRegime: "mobile" }), makeInputs());
  assert.equal(p.terrain.type, "continental");
  assert.ok(p.terrain.craterDensity < 0.1);
});

test("episodic -> volcanic terrain", () => {
  const p = computeRockyVisualProfile(makeDerived({ tectonicRegime: "episodic" }), makeInputs());
  assert.equal(p.terrain.type, "volcanic");
});

test("plutonic-squishy -> smooth terrain", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ tectonicRegime: "plutonic-squishy" }),
    makeInputs(),
  );
  assert.equal(p.terrain.type, "smooth");
  assert.ok(p.terrain.craterDensity < 0.05);
});

// ── Special effects ──────────────────────────────────────────────

test("very hot surface (>1200K) -> lava special", () => {
  const p = computeRockyVisualProfile(makeDerived({ surfaceTempK: 1500 }), makeInputs());
  assert.equal(p.special, "lava");
});

test("very cold + airless -> frozen special", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ surfaceTempK: 80 }),
    makeInputs({ pressureAtm: 0 }),
  );
  assert.equal(p.special, "frozen");
});

test("temperate planet -> no special effect", () => {
  const p = computeRockyVisualProfile(makeDerived(), makeInputs());
  assert.equal(p.special, null);
});

// ── Vegetation ───────────────────────────────────────────────────

test("habitable world -> vegetation coverage > 0", () => {
  const p = computeRockyVisualProfile(makeDerived(), makeInputs());
  assert.ok(p.vegetation.coverage > 0, `coverage ${p.vegetation.coverage}`);
  assert.ok(p.vegetation.colour, "has colour");
});

test("no vegetation hex -> zero coverage", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ vegetationPaleHex: null, vegetationDeepHex: null }),
    makeInputs(),
  );
  assert.equal(p.vegetation.coverage, 0);
  assert.equal(p.vegetation.colour, null);
});

test("global ocean -> zero vegetation", () => {
  const p = computeRockyVisualProfile(makeDerived({ waterRegime: "Global ocean" }), makeInputs());
  assert.equal(p.vegetation.coverage, 0);
});

// ── Determinism ──────────────────────────────────────────────────

test("same inputs produce identical profiles", () => {
  const d = makeDerived();
  const inp = makeInputs();
  const p1 = computeRockyVisualProfile(d, inp);
  const p2 = computeRockyVisualProfile(d, inp);
  assert.deepStrictEqual(p1, p2);
});

// ── Edge cases ───────────────────────────────────────────────────

test("missing sky colour -> fallback atmosphere colour", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ skyColourDayHex: null }),
    makeInputs({ pressureAtm: 1 }),
  );
  assert.equal(p.atmosphere.colour, "#6688bb");
});

test("missing derived -> safe defaults", () => {
  const p = computeRockyVisualProfile({}, {});
  assert.ok(p.palette.c1, "has palette");
  assert.equal(p.ocean.coverage, 0);
  assert.ok(p.seed, "has seed");
});

test("tidally locked flag propagated", () => {
  const p = computeRockyVisualProfile(makeDerived({ tidallyLockedToStar: true }), makeInputs());
  assert.equal(p.tidallyLocked, true);
});

test("seed comes from planet name", () => {
  const p = computeRockyVisualProfile(makeDerived(), makeInputs({ name: "Arrakis" }));
  assert.equal(p.seed, "Arrakis");
});

// ── Albedo-based palette tinting ────────────────────────────────

test("low albedo darkens palette vs high albedo", () => {
  const d = makeDerived({ compositionClass: "Earth-like" });
  const dark = computeRockyVisualProfile(d, makeInputs({ albedoBond: 0.1 }));
  const bright = computeRockyVisualProfile(d, makeInputs({ albedoBond: 0.7 }));
  // c1 red channel: low-albedo should be darker
  const darkR = parseInt(dark.palette.c1.slice(1, 3), 16);
  const brightR = parseInt(bright.palette.c1.slice(1, 3), 16);
  assert.ok(darkR < brightR, `dark ${darkR} should be less than bright ${brightR}`);
});

test("no albedo -> untinted base palette", () => {
  const p = computeRockyVisualProfile(makeDerived(), makeInputs({ albedoBond: undefined }));
  assert.equal(p.palette.c1, "#c4a882"); // exact Earth-like base
});

test("ocean world land palette is tinted by albedo", () => {
  const d = makeDerived({ compositionClass: "Ocean world", waterRegime: "Global ocean" });
  const dark = computeRockyVisualProfile(d, makeInputs({ albedoBond: 0.1 }));
  const bright = computeRockyVisualProfile(d, makeInputs({ albedoBond: 0.7 }));
  const darkR = parseInt(dark.landPalette.c1.slice(1, 3), 16);
  const brightR = parseInt(bright.landPalette.c1.slice(1, 3), 16);
  assert.ok(darkR < brightR, `dark land ${darkR} < bright land ${brightR}`);
});

test("ice world + low albedo produces darker palette", () => {
  const d = makeDerived({ compositionClass: "Ice world", waterRegime: "Ice world" });
  const p = computeRockyVisualProfile(d, makeInputs({ albedoBond: 0.1 }));
  // Base Ice world c1 is #d8e4f0 (216,228,240); at factor 0.76 → ~164
  const r = parseInt(p.palette.c1.slice(1, 3), 16);
  assert.ok(r < 200, `ice world c1 red ${r} should be darkened below 200`);
});

test("ice world + high albedo produces brighter palette", () => {
  const d = makeDerived({ compositionClass: "Ice world", waterRegime: "Ice world" });
  const p = computeRockyVisualProfile(d, makeInputs({ albedoBond: 0.7 }));
  // At factor 1.12 → ~242 (capped at 255)
  const r = parseInt(p.palette.c1.slice(1, 3), 16);
  assert.ok(r > 216, `ice world c1 red ${r} should be brightened above 216`);
});
