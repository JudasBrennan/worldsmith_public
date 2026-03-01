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

test("palette → Earth-like composition → tan/brown untinted", () => {
  const p = computeRockyVisualProfile(makeDerived(), makeInputs({ albedoBond: undefined }));
  assert.equal(p.palette.c1, "#c4a882");
  assert.equal(p.palette.c2, "#8b6e4e");
  assert.equal(p.palette.c3, "#4a3726");
});

test("palette → Mars-like composition → rust untinted", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ compositionClass: "Mars-like" }),
    makeInputs({ albedoBond: undefined }),
  );
  assert.equal(p.palette.c1, "#c77b4a");
});

test("palette → Mercury-like composition → grey untinted", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ compositionClass: "Mercury-like" }),
    makeInputs({ albedoBond: undefined }),
  );
  assert.equal(p.palette.c1, "#b0b0b0");
});

test("palette → Iron world → dark grey-blue untinted", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ compositionClass: "Iron world" }),
    makeInputs({ albedoBond: undefined }),
  );
  assert.equal(p.palette.c1, "#6e7080");
});

test("palette → Coreless → pale tan untinted", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ compositionClass: "Coreless" }),
    makeInputs({ albedoBond: undefined }),
  );
  assert.equal(p.palette.c1, "#d4c4a8");
});

test("palette → Ice world → pale blue untinted", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ compositionClass: "Ice world", waterRegime: "Ice world" }),
    makeInputs({ albedoBond: undefined }),
  );
  assert.equal(p.palette.c1, "#d8e4f0");
});

test("palette → Ocean world → ocean blue untinted", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ compositionClass: "Ocean world", waterRegime: "Global ocean" }),
    makeInputs({ albedoBond: undefined }),
  );
  assert.equal(p.palette.c1, "#4a8cb0");
});

test("palette → unknown composition → falls back to Earth-like", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ compositionClass: "Unknown" }),
    makeInputs({ albedoBond: undefined }),
  );
  assert.equal(p.palette.c1, "#c4a882");
});

// ── Ocean coverage from water regime ─────────────────────────────

test("ocean → Dry regime → zero coverage", () => {
  const p = computeRockyVisualProfile(makeDerived({ waterRegime: "Dry" }), makeInputs());
  assert.equal(p.ocean.coverage, 0);
});

test("ocean → Shallow oceans → 0.3 coverage", () => {
  const p = computeRockyVisualProfile(makeDerived({ waterRegime: "Shallow oceans" }), makeInputs());
  assert.equal(p.ocean.coverage, 0.3);
});

test("ocean → Extensive oceans → 0.65 coverage", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ waterRegime: "Extensive oceans" }),
    makeInputs(),
  );
  assert.equal(p.ocean.coverage, 0.65);
});

test("ocean → Global ocean → 0.95 coverage", () => {
  const p = computeRockyVisualProfile(makeDerived({ waterRegime: "Global ocean" }), makeInputs());
  assert.equal(p.ocean.coverage, 0.95);
});

test("ocean → Deep ocean → 1.0 coverage", () => {
  const p = computeRockyVisualProfile(makeDerived({ waterRegime: "Deep ocean" }), makeInputs());
  assert.equal(p.ocean.coverage, 1.0);
});

test("ocean → Ice world regime → zero ocean + full ice caps", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ waterRegime: "Ice world", compositionClass: "Ice world" }),
    makeInputs(),
  );
  assert.equal(p.ocean.coverage, 0);
  assert.equal(p.iceCaps.north, 1);
  assert.equal(p.iceCaps.south, 1);
});

test("ocean → T < 273 K → frozen", () => {
  const p = computeRockyVisualProfile(makeDerived({ surfaceTempK: 250 }), makeInputs());
  assert.equal(p.ocean.frozen, true);
});

test("ocean → T >= 273 K → not frozen", () => {
  const p = computeRockyVisualProfile(makeDerived({ surfaceTempK: 288 }), makeInputs());
  assert.equal(p.ocean.frozen, false);
});

// ── Ice caps from temperature ────────────────────────────────────

test("iceCaps → very cold planet < 200 K → large caps", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ surfaceTempK: 150 }),
    makeInputs({ axialTiltDeg: 0 }),
  );
  assert.ok(p.iceCaps.north >= 0.7, `north ${p.iceCaps.north} >= 0.7`);
  assert.ok(p.iceCaps.south >= 0.7, `south ${p.iceCaps.south} >= 0.7`);
});

test("iceCaps → temperate 288 K → small caps", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ surfaceTempK: 288 }),
    makeInputs({ axialTiltDeg: 0 }),
  );
  assert.ok(p.iceCaps.north > 0, `north cap exists: ${p.iceCaps.north}`);
  assert.ok(p.iceCaps.north < 0.15, `north cap small: ${p.iceCaps.north}`);
});

test("iceCaps → hot planet > 350 K → no caps", () => {
  const p = computeRockyVisualProfile(makeDerived({ surfaceTempK: 400 }), makeInputs());
  assert.ok(p.iceCaps.north < 0.01, `north ${p.iceCaps.north}`);
  assert.ok(p.iceCaps.south < 0.01, `south ${p.iceCaps.south}`);
});

test("iceCaps → high axial tilt → asymmetric", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ surfaceTempK: 260 }),
    makeInputs({ axialTiltDeg: 80 }),
  );
  assert.ok(
    p.iceCaps.north > p.iceCaps.south,
    `north ${p.iceCaps.north} > south ${p.iceCaps.south}`,
  );
});

test("iceCaps → zero tilt → symmetric", () => {
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

test("clouds → no atmosphere → zero coverage", () => {
  const p = computeRockyVisualProfile(makeDerived(), makeInputs({ pressureAtm: 0, h2oPct: 1 }));
  assert.equal(p.clouds.coverage, 0);
});

test("clouds → Earth-like atmosphere → moderate coverage", () => {
  const p = computeRockyVisualProfile(makeDerived(), makeInputs({ pressureAtm: 1, h2oPct: 1 }));
  assert.ok(p.clouds.coverage > 0, `coverage > 0: ${p.clouds.coverage}`);
  assert.ok(p.clouds.coverage < 0.5, `coverage < 0.5: ${p.clouds.coverage}`);
});

test("clouds → Venus-like → near-total yellowish cover", () => {
  const p = computeRockyVisualProfile(
    makeDerived(),
    makeInputs({ pressureAtm: 90, co2Pct: 96, h2oPct: 0.005 }),
  );
  assert.equal(p.clouds.coverage, 0.95);
  assert.equal(p.clouds.colour, "#e0d0a0");
});

// ── Atmosphere thickness ─────────────────────────────────────────

test("atmosphere → zero pressure → no rim", () => {
  const p = computeRockyVisualProfile(makeDerived(), makeInputs({ pressureAtm: 0 }));
  assert.equal(p.atmosphere.thickness, 0);
});

test("atmosphere → Earth-like pressure → moderate rim", () => {
  const p = computeRockyVisualProfile(makeDerived(), makeInputs({ pressureAtm: 1 }));
  assert.ok(p.atmosphere.thickness > 0.02, `thickness ${p.atmosphere.thickness}`);
  assert.ok(p.atmosphere.thickness < 0.1, `thickness ${p.atmosphere.thickness}`);
});

test("atmosphere → 90 atm → thick rim", () => {
  const p = computeRockyVisualProfile(makeDerived(), makeInputs({ pressureAtm: 90 }));
  assert.ok(p.atmosphere.thickness > 0.1, `thickness ${p.atmosphere.thickness}`);
});

test("atmosphere → sky colour provided → matches rim colour", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ skyColourDayHex: "#FF0000" }),
    makeInputs({ pressureAtm: 1 }),
  );
  assert.equal(p.atmosphere.colour, "#FF0000");
});

// ── Terrain type from tectonic regime ────────────────────────────

test("terrain → stagnant + no atmosphere → cratered", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ tectonicRegime: "stagnant" }),
    makeInputs({ pressureAtm: 0 }),
  );
  assert.equal(p.terrain.type, "cratered");
  assert.ok(p.terrain.craterDensity > 0.5);
});

test("terrain → stagnant + atmosphere → worn", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ tectonicRegime: "stagnant" }),
    makeInputs({ pressureAtm: 1 }),
  );
  assert.equal(p.terrain.type, "worn");
});

test("terrain → mobile tectonics → continental", () => {
  const p = computeRockyVisualProfile(makeDerived({ tectonicRegime: "mobile" }), makeInputs());
  assert.equal(p.terrain.type, "continental");
  assert.ok(p.terrain.craterDensity < 0.1);
});

test("terrain → episodic tectonics → volcanic", () => {
  const p = computeRockyVisualProfile(makeDerived({ tectonicRegime: "episodic" }), makeInputs());
  assert.equal(p.terrain.type, "volcanic");
});

test("terrain → plutonic-squishy → smooth", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ tectonicRegime: "plutonic-squishy" }),
    makeInputs(),
  );
  assert.equal(p.terrain.type, "smooth");
  assert.ok(p.terrain.craterDensity < 0.05);
});

// ── Special effects ──────────────────────────────────────────────

test("special → surface > 1200 K → lava", () => {
  const p = computeRockyVisualProfile(makeDerived({ surfaceTempK: 1500 }), makeInputs());
  assert.equal(p.special, "lava");
});

test("special → very cold + airless → frozen", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ surfaceTempK: 80 }),
    makeInputs({ pressureAtm: 0 }),
  );
  assert.equal(p.special, "frozen");
});

test("special → temperate planet → null", () => {
  const p = computeRockyVisualProfile(makeDerived(), makeInputs());
  assert.equal(p.special, null);
});

// ── Vegetation ───────────────────────────────────────────────────

test("vegetation → habitable world → coverage > 0", () => {
  const p = computeRockyVisualProfile(makeDerived(), makeInputs());
  assert.ok(p.vegetation.coverage > 0, `coverage ${p.vegetation.coverage}`);
  assert.ok(p.vegetation.colour, "has colour");
});

test("vegetation → no hex colours → zero coverage", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ vegetationPaleHex: null, vegetationDeepHex: null }),
    makeInputs(),
  );
  assert.equal(p.vegetation.coverage, 0);
  assert.equal(p.vegetation.colour, null);
});

test("vegetation → global ocean → zero coverage", () => {
  const p = computeRockyVisualProfile(makeDerived({ waterRegime: "Global ocean" }), makeInputs());
  assert.equal(p.vegetation.coverage, 0);
});

// ── Determinism ──────────────────────────────────────────────────

test("determinism → same inputs → identical profiles", () => {
  const d = makeDerived();
  const inp = makeInputs();
  const p1 = computeRockyVisualProfile(d, inp);
  const p2 = computeRockyVisualProfile(d, inp);
  assert.deepStrictEqual(p1, p2);
});

// ── Edge cases ───────────────────────────────────────────────────

test("atmosphere → missing sky colour → fallback colour", () => {
  const p = computeRockyVisualProfile(
    makeDerived({ skyColourDayHex: null }),
    makeInputs({ pressureAtm: 1 }),
  );
  assert.equal(p.atmosphere.colour, "#6688bb");
});

test("profile → missing derived → safe defaults", () => {
  const p = computeRockyVisualProfile({}, {});
  assert.ok(p.palette.c1, "has palette");
  assert.equal(p.ocean.coverage, 0);
  assert.ok(p.seed, "has seed");
});

test("profile → tidally locked → flag propagated", () => {
  const p = computeRockyVisualProfile(makeDerived({ tidallyLockedToStar: true }), makeInputs());
  assert.equal(p.tidallyLocked, true);
});

test("profile → planet name → used as seed", () => {
  const p = computeRockyVisualProfile(makeDerived(), makeInputs({ name: "Arrakis" }));
  assert.equal(p.seed, "Arrakis");
});

// ── Albedo-based palette tinting ────────────────────────────────

test("albedo tint → low albedo → darker palette than high", () => {
  const d = makeDerived({ compositionClass: "Earth-like" });
  const dark = computeRockyVisualProfile(d, makeInputs({ albedoBond: 0.1 }));
  const bright = computeRockyVisualProfile(d, makeInputs({ albedoBond: 0.7 }));
  // c1 red channel: low-albedo should be darker
  const darkR = parseInt(dark.palette.c1.slice(1, 3), 16);
  const brightR = parseInt(bright.palette.c1.slice(1, 3), 16);
  assert.ok(darkR < brightR, `dark ${darkR} should be less than bright ${brightR}`);
});

test("albedo tint → no albedo → untinted base palette", () => {
  const p = computeRockyVisualProfile(makeDerived(), makeInputs({ albedoBond: undefined }));
  assert.equal(p.palette.c1, "#c4a882"); // exact Earth-like base
});

test("albedo tint → ocean world → land palette tinted", () => {
  const d = makeDerived({ compositionClass: "Ocean world", waterRegime: "Global ocean" });
  const dark = computeRockyVisualProfile(d, makeInputs({ albedoBond: 0.1 }));
  const bright = computeRockyVisualProfile(d, makeInputs({ albedoBond: 0.7 }));
  const darkR = parseInt(dark.landPalette.c1.slice(1, 3), 16);
  const brightR = parseInt(bright.landPalette.c1.slice(1, 3), 16);
  assert.ok(darkR < brightR, `dark land ${darkR} < bright land ${brightR}`);
});

test("albedo tint → ice world + low albedo → darker palette", () => {
  const d = makeDerived({ compositionClass: "Ice world", waterRegime: "Ice world" });
  const p = computeRockyVisualProfile(d, makeInputs({ albedoBond: 0.1 }));
  // Base Ice world c1 is #d8e4f0 (216,228,240); at factor 0.76 → ~164
  const r = parseInt(p.palette.c1.slice(1, 3), 16);
  assert.ok(r < 200, `ice world c1 red ${r} should be darkened below 200`);
});

test("albedo tint → ice world + high albedo → brighter palette", () => {
  const d = makeDerived({ compositionClass: "Ice world", waterRegime: "Ice world" });
  const p = computeRockyVisualProfile(d, makeInputs({ albedoBond: 0.7 }));
  // At factor 1.12 → ~242 (capped at 255)
  const r = parseInt(p.palette.c1.slice(1, 3), 16);
  assert.ok(r > 216, `ice world c1 red ${r} should be brightened above 216`);
});
