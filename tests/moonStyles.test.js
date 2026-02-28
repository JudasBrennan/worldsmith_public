/**
 * Moon Visual Profile Tests
 *
 * Tests the computeMoonVisualProfile() function which translates
 * engine-derived tidal/physical properties into a visual rendering profile.
 * Canvas rendering itself is not tested (requires browser context).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { computeMoonVisualProfile, MOON_PALETTES, MOON_RECIPES } from "../ui/moonStyles.js";

// ── Helper factory ──────────────────────────────────────────────

function makeMoonCalc(overrides = {}) {
  const base = {
    id: "test-moon",
    tides: {
      compositionClass: "Rocky",
      compositionOverride: null,
      tidalHeatingEarth: 0,
      moonLockedToPlanet: "Yes",
      ...overrides.tides,
    },
    inputs: {
      name: "TestMoon",
      densityGcm3: 3.34,
      albedo: 0.11,
      ...overrides.inputs,
    },
    physical: {
      radiusMoon: 1,
      ...overrides.physical,
    },
  };
  // Allow top-level id override
  if (overrides.id !== undefined) base.id = overrides.id;
  return base;
}

// ── bodyType is always "moon" ───────────────────────────────────

test("bodyType is always 'moon'", () => {
  const p = computeMoonVisualProfile(makeMoonCalc());
  assert.equal(p.bodyType, "moon");
});

test("bodyType is 'moon' for null input (fallback)", () => {
  const p = computeMoonVisualProfile(null);
  assert.equal(p.bodyType, "moon");
});

// ── Palette from composition class ──────────────────────────────

test("Very icy composition -> Very icy displayClass", () => {
  const p = computeMoonVisualProfile(makeMoonCalc({ tides: { compositionClass: "Very icy" } }));
  assert.equal(p.displayClass, "Very icy");
  assert.ok(p.palette.c1 && p.palette.c2 && p.palette.c3);
});

test("Icy composition -> Icy displayClass", () => {
  const p = computeMoonVisualProfile(makeMoonCalc({ tides: { compositionClass: "Icy" } }));
  assert.equal(p.displayClass, "Icy");
});

test("Subsurface ocean composition -> Subsurface ocean displayClass", () => {
  const p = computeMoonVisualProfile(
    makeMoonCalc({ tides: { compositionClass: "Subsurface ocean" } }),
  );
  assert.equal(p.displayClass, "Subsurface ocean");
});

test("Mixed rock/ice composition -> Mixed rock/ice displayClass", () => {
  const p = computeMoonVisualProfile(
    makeMoonCalc({ tides: { compositionClass: "Mixed rock/ice" } }),
  );
  assert.equal(p.displayClass, "Mixed rock/ice");
});

test("Rocky composition -> Rocky displayClass", () => {
  const p = computeMoonVisualProfile(makeMoonCalc({ tides: { compositionClass: "Rocky" } }));
  assert.equal(p.displayClass, "Rocky");
});

test("Partially molten composition -> Partially molten displayClass", () => {
  const p = computeMoonVisualProfile(
    makeMoonCalc({ tides: { compositionClass: "Partially molten" } }),
  );
  assert.equal(p.displayClass, "Partially molten");
});

test("Iron-rich composition -> Iron-rich displayClass", () => {
  const p = computeMoonVisualProfile(makeMoonCalc({ tides: { compositionClass: "Iron-rich" } }));
  assert.equal(p.displayClass, "Iron-rich");
});

test("unknown composition falls back to Rocky displayClass", () => {
  const p = computeMoonVisualProfile(makeMoonCalc({ tides: { compositionClass: "Unknown" } }));
  assert.equal(p.displayClass, "Rocky");
});

test("compositionOverride takes precedence over compositionClass", () => {
  const p = computeMoonVisualProfile(
    makeMoonCalc({ tides: { compositionClass: "Rocky", compositionOverride: "Very icy" } }),
  );
  assert.equal(p.displayClass, "Very icy");
});

// ── Terrain type from tidal heating and density ─────────────────

test("high tidal heating (>10) -> volcanic terrain", () => {
  const p = computeMoonVisualProfile(makeMoonCalc({ tides: { tidalHeatingEarth: 15 } }));
  assert.equal(p.terrain.type, "volcanic");
  assert.ok(p.terrain.craterDensity < 0.05, `craterDensity ${p.terrain.craterDensity}`);
});

test("moderate tidal heating (1-10) -> active terrain", () => {
  const p = computeMoonVisualProfile(makeMoonCalc({ tides: { tidalHeatingEarth: 5 } }));
  assert.equal(p.terrain.type, "active");
  assert.ok(p.terrain.craterDensity <= 0.1, `craterDensity ${p.terrain.craterDensity}`);
});

test("low heating + low density + bright albedo -> icy-smooth terrain", () => {
  const p = computeMoonVisualProfile(
    makeMoonCalc({
      tides: { tidalHeatingEarth: 0, compositionClass: "Icy" },
      inputs: { densityGcm3: 1.5, albedo: 0.5 },
    }),
  );
  assert.equal(p.terrain.type, "icy-smooth");
});

test("captured asteroid (tiny + dark) -> Rocky worn terrain", () => {
  const p = computeMoonVisualProfile(
    makeMoonCalc({
      tides: { tidalHeatingEarth: 0, compositionClass: "Icy" },
      inputs: { densityGcm3: 1.5, albedo: 0.07 },
      physical: { radiusMoon: 0.005 },
    }),
  );
  assert.equal(p.terrain.type, "worn");
  assert.equal(p.displayClass, "Rocky");
  assert.equal(p.iceCoverage, 0);
});

test("dark icy body (large + dark + low density) -> Dark icy", () => {
  const p = computeMoonVisualProfile(
    makeMoonCalc({
      tides: { tidalHeatingEarth: 0, compositionClass: "Icy" },
      inputs: { densityGcm3: 1.8, albedo: 0.15 },
      physical: { radiusMoon: 1.0 },
    }),
  );
  assert.equal(p.displayClass, "Dark icy");
  assert.equal(p.terrain.type, "worn");
  assert.equal(p.iceCoverage, 0.2);
});

test("bright surface override keeps compClass (Europa-like)", () => {
  const p = computeMoonVisualProfile(
    makeMoonCalc({
      tides: { tidalHeatingEarth: 1.5, compositionClass: "Mixed rock/ice" },
      inputs: { densityGcm3: 3.0, albedo: 0.67 },
      physical: { radiusMoon: 0.9 },
    }),
  );
  assert.equal(p.displayClass, "Mixed rock/ice");
});

test("high tidal heating override keeps compClass (Io-like)", () => {
  const p = computeMoonVisualProfile(
    makeMoonCalc({
      tides: { tidalHeatingEarth: 20, compositionClass: "Rocky" },
      inputs: { densityGcm3: 3.5, albedo: 0.63 },
      physical: { radiusMoon: 1.05 },
    }),
  );
  assert.equal(p.displayClass, "Rocky");
});

test("albedo tinting darkens low-albedo palette", () => {
  const lo = computeMoonVisualProfile(makeMoonCalc({ inputs: { albedo: 0.1 } }));
  const hi = computeMoonVisualProfile(makeMoonCalc({ inputs: { albedo: 0.8 } }));
  // Low albedo c1 should be darker (lower hex value) than high albedo c1
  const loVal = parseInt(lo.palette.c1.slice(1, 3), 16);
  const hiVal = parseInt(hi.palette.c1.slice(1, 3), 16);
  assert.ok(loVal < hiVal, `low albedo c1 ${lo.palette.c1} should be darker than ${hi.palette.c1}`);
});

test("low heating + medium density (2.0-3.2) -> worn terrain", () => {
  const p = computeMoonVisualProfile(
    makeMoonCalc({ tides: { tidalHeatingEarth: 0 }, inputs: { densityGcm3: 2.5 } }),
  );
  assert.equal(p.terrain.type, "worn");
  assert.equal(p.terrain.craterDensity, 0.4);
});

test("low heating + high density (>=3.2) -> cratered terrain", () => {
  const p = computeMoonVisualProfile(
    makeMoonCalc({ tides: { tidalHeatingEarth: 0 }, inputs: { densityGcm3: 3.5 } }),
  );
  assert.equal(p.terrain.type, "cratered");
  assert.equal(p.terrain.craterDensity, 0.7);
});

// ── Ice coverage from composition ───────────────────────────────

test("Very icy -> ice coverage 1.0", () => {
  const p = computeMoonVisualProfile(makeMoonCalc({ tides: { compositionClass: "Very icy" } }));
  assert.equal(p.iceCoverage, 1.0);
});

test("Icy -> ice coverage 0.9", () => {
  const p = computeMoonVisualProfile(makeMoonCalc({ tides: { compositionClass: "Icy" } }));
  assert.equal(p.iceCoverage, 0.9);
});

test("Subsurface ocean -> ice coverage 0.95", () => {
  const p = computeMoonVisualProfile(
    makeMoonCalc({ tides: { compositionClass: "Subsurface ocean" } }),
  );
  assert.equal(p.iceCoverage, 0.95);
});

test("Mixed rock/ice -> ice coverage 0.4", () => {
  const p = computeMoonVisualProfile(
    makeMoonCalc({ tides: { compositionClass: "Mixed rock/ice" } }),
  );
  assert.equal(p.iceCoverage, 0.4);
});

test("Rocky -> ice coverage 0", () => {
  const p = computeMoonVisualProfile(makeMoonCalc({ tides: { compositionClass: "Rocky" } }));
  assert.equal(p.iceCoverage, 0);
});

test("Partially molten -> ice coverage 0", () => {
  const p = computeMoonVisualProfile(
    makeMoonCalc({ tides: { compositionClass: "Partially molten" } }),
  );
  assert.equal(p.iceCoverage, 0);
});

test("Iron-rich -> ice coverage 0", () => {
  const p = computeMoonVisualProfile(makeMoonCalc({ tides: { compositionClass: "Iron-rich" } }));
  assert.equal(p.iceCoverage, 0);
});

// ── Tidal heating intensity ─────────────────────────────────────

test("no tidal heating -> inactive", () => {
  const p = computeMoonVisualProfile(makeMoonCalc({ tides: { tidalHeatingEarth: 0 } }));
  assert.equal(p.tidalHeating.active, false);
  assert.equal(p.tidalHeating.intensity, 0);
});

test("low tidal heating (0.3) -> inactive (below 0.5 threshold)", () => {
  const p = computeMoonVisualProfile(makeMoonCalc({ tides: { tidalHeatingEarth: 0.3 } }));
  assert.equal(p.tidalHeating.active, false);
});

test("moderate tidal heating (1.0) -> active", () => {
  const p = computeMoonVisualProfile(makeMoonCalc({ tides: { tidalHeatingEarth: 1.0 } }));
  assert.equal(p.tidalHeating.active, true);
  assert.ok(p.tidalHeating.intensity > 0, "intensity > 0");
  assert.ok(p.tidalHeating.intensity < 1, "intensity < 1");
});

test("extreme tidal heating (40) -> intensity clamped to 1", () => {
  const p = computeMoonVisualProfile(makeMoonCalc({ tides: { tidalHeatingEarth: 40 } }));
  assert.equal(p.tidalHeating.active, true);
  assert.equal(p.tidalHeating.intensity, 1);
});

test("very high tidal heating (80) -> intensity still clamped to 1", () => {
  const p = computeMoonVisualProfile(makeMoonCalc({ tides: { tidalHeatingEarth: 80 } }));
  assert.equal(p.tidalHeating.intensity, 1);
});

// ── Special effects ─────────────────────────────────────────────

test("tidalHeatingEarth > 10 -> volcanic special", () => {
  const p = computeMoonVisualProfile(
    makeMoonCalc({ tides: { compositionClass: "Rocky", tidalHeatingEarth: 15 } }),
  );
  assert.equal(p.special, "volcanic");
});

test("Subsurface ocean -> subsurface-ocean special", () => {
  const p = computeMoonVisualProfile(
    makeMoonCalc({ tides: { compositionClass: "Subsurface ocean", tidalHeatingEarth: 0 } }),
  );
  assert.equal(p.special, "subsurface-ocean");
});

test("Partially molten -> molten special", () => {
  const p = computeMoonVisualProfile(
    makeMoonCalc({ tides: { compositionClass: "Partially molten", tidalHeatingEarth: 0 } }),
  );
  assert.equal(p.special, "molten");
});

test("low density + high albedo -> frozen special", () => {
  const p = computeMoonVisualProfile(
    makeMoonCalc({
      tides: { compositionClass: "Rocky", tidalHeatingEarth: 0 },
      inputs: { densityGcm3: 0.8, albedo: 0.7 },
    }),
  );
  assert.equal(p.special, "frozen");
});

test("volcanic special takes precedence over subsurface-ocean", () => {
  const p = computeMoonVisualProfile(
    makeMoonCalc({ tides: { compositionClass: "Subsurface ocean", tidalHeatingEarth: 15 } }),
  );
  assert.equal(p.special, "volcanic");
});

test("Rocky with low heating -> no special", () => {
  const p = computeMoonVisualProfile(
    makeMoonCalc({ tides: { compositionClass: "Rocky", tidalHeatingEarth: 0 } }),
  );
  assert.equal(p.special, null);
});

// ── Tidally locked ──────────────────────────────────────────────

test("moonLockedToPlanet 'Yes' -> tidallyLocked true", () => {
  const p = computeMoonVisualProfile(makeMoonCalc({ tides: { moonLockedToPlanet: "Yes" } }));
  assert.equal(p.tidallyLocked, true);
});

test("moonLockedToPlanet 'No' -> tidallyLocked false", () => {
  const p = computeMoonVisualProfile(makeMoonCalc({ tides: { moonLockedToPlanet: "No" } }));
  assert.equal(p.tidallyLocked, false);
});

// ── Atmosphere ──────────────────────────────────────────────────

test("small rocky moon -> no atmosphere", () => {
  const p = computeMoonVisualProfile(
    makeMoonCalc({
      tides: { compositionClass: "Rocky" },
      inputs: { densityGcm3: 3.34 },
      physical: { radiusMoon: 1 },
    }),
  );
  assert.equal(p.atmosphere.thickness, 0);
});

test("large subsurface ocean moon -> thin atmosphere", () => {
  const p = computeMoonVisualProfile(
    makeMoonCalc({
      tides: { compositionClass: "Subsurface ocean" },
      inputs: { densityGcm3: 1.88 },
      physical: { radiusMoon: 1.6 },
    }),
  );
  assert.equal(p.atmosphere.thickness, 0.06);
});

test("large mixed rock/ice moon with right density -> thin atmosphere", () => {
  const p = computeMoonVisualProfile(
    makeMoonCalc({
      tides: { compositionClass: "Mixed rock/ice" },
      inputs: { densityGcm3: 2.0 },
      physical: { radiusMoon: 2.0 },
    }),
  );
  assert.equal(p.atmosphere.thickness, 0.06);
});

test("Titan-like large icy moon -> thin atmosphere", () => {
  const p = computeMoonVisualProfile(
    makeMoonCalc({
      tides: { compositionClass: "Icy" },
      inputs: { densityGcm3: 1.88 },
      physical: { radiusMoon: 1.48 },
    }),
  );
  assert.equal(p.atmosphere.thickness, 0.06);
});

test("large moon but wrong density -> no atmosphere", () => {
  const p = computeMoonVisualProfile(
    makeMoonCalc({
      tides: { compositionClass: "Subsurface ocean" },
      inputs: { densityGcm3: 3.0 },
      physical: { radiusMoon: 2.0 },
    }),
  );
  assert.equal(p.atmosphere.thickness, 0);
});

// ── Seed ────────────────────────────────────────────────────────

test("seed comes from inputs.name", () => {
  const p = computeMoonVisualProfile(makeMoonCalc({ inputs: { name: "Europa" } }));
  assert.equal(p.seed, "Europa");
});

test("seed falls back to id when name is missing", () => {
  const p = computeMoonVisualProfile(makeMoonCalc({ id: "moon-7", inputs: { name: undefined } }));
  assert.equal(p.seed, "moon-7");
});

// ── Determinism ─────────────────────────────────────────────────

test("same inputs produce identical profiles", () => {
  const mc = makeMoonCalc();
  const p1 = computeMoonVisualProfile(mc);
  const p2 = computeMoonVisualProfile(mc);
  assert.deepStrictEqual(p1, p2);
});

// ── Fallback for null/missing input ─────────────────────────────

test("null moonCalc -> fallback profile with safe defaults", () => {
  const p = computeMoonVisualProfile(null);
  assert.equal(p.bodyType, "moon");
  assert.deepStrictEqual(p.palette, MOON_PALETTES.Rocky);
  assert.equal(p.terrain.type, "cratered");
  assert.equal(p.iceCoverage, 0);
  assert.equal(p.tidalHeating.active, false);
  assert.equal(p.atmosphere.thickness, 0);
  assert.equal(p.special, null);
  assert.equal(p.tidallyLocked, true);
});

test("empty object moonCalc -> uses defaults without crashing", () => {
  const p = computeMoonVisualProfile({});
  assert.equal(p.bodyType, "moon");
  assert.ok(p.palette, "has palette");
  assert.ok(p.seed, "has seed");
});

/* ── MOON_RECIPES ──────────────────────────────────────────────────── */

test("all recipe IDs are unique", () => {
  const ids = MOON_RECIPES.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("every recipe has required fields", () => {
  for (const r of MOON_RECIPES) {
    assert.ok(r.id, `${r.label || "?"} missing id`);
    assert.ok(r.label, `${r.id} missing label`);
    assert.ok(r.category, `${r.id} missing category`);
    assert.ok(r.preview, `${r.id} missing preview`);
    assert.ok(r.apply, `${r.id} missing apply`);
  }
});

test("every recipe apply has moon input fields", () => {
  const required = [
    "massMoon",
    "densityGcm3",
    "albedo",
    "semiMajorAxisKm",
    "eccentricity",
    "inclinationDeg",
  ];
  for (const r of MOON_RECIPES) {
    for (const key of required) {
      assert.ok(key in r.apply, `${r.id} apply missing ${key}`);
    }
  }
});

test("every recipe preview has tides/inputs/physical", () => {
  for (const r of MOON_RECIPES) {
    assert.ok(r.preview.tides, `${r.id} preview missing tides`);
    assert.ok(r.preview.inputs, `${r.id} preview missing inputs`);
    assert.ok(r.preview.physical, `${r.id} preview missing physical`);
  }
});

test("every recipe preview produces a valid visual profile", () => {
  for (const r of MOON_RECIPES) {
    const profile = computeMoonVisualProfile(r.preview);
    assert.equal(profile.bodyType, "moon", `${r.id} profile bodyType`);
    assert.ok(profile.palette, `${r.id} profile palette`);
    assert.ok(profile.terrain, `${r.id} profile terrain`);
  }
});
