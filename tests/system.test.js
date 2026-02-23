import test from "node:test";
import assert from "node:assert/strict";

import { calcSystem } from "../engine/system.js";

function approxEqual(actual, expected, tolerance, label) {
  const msg = label
    ? `${label}: expected ${expected} +/- ${tolerance}, got ${actual}`
    : `${actual} not within ${tolerance} of ${expected}`;
  assert.ok(Math.abs(actual - expected) <= tolerance, msg);
}

const SOLAR_SYSTEM = {
  starMassMsol: 1,
  spacingFactor: 0.3,
  orbit1Au: 0.39,
};

test("calcSystem returns correct orbit count", () => {
  const model = calcSystem(SOLAR_SYSTEM);
  assert.equal(model.orbitsAu.length, 20);
  assert.equal(model.orbitsMillionKm.length, 20);
});

test("first orbit matches orbit1Au input", () => {
  const model = calcSystem(SOLAR_SYSTEM);
  approxEqual(model.orbitsAu[0], 0.39, 1e-12, "orbit1");
});

test("orbit spacing grows exponentially", () => {
  const model = calcSystem({
    starMassMsol: 1,
    spacingFactor: 1,
    orbit1Au: 1,
  });
  // orbit2 = orbit1 + s*2^0 = 1 + 1 = 2
  // orbit3 = orbit1 + s*2^1 = 1 + 2 = 3
  approxEqual(model.orbitsAu[1], 2, 1e-12, "orbit2");
  approxEqual(model.orbitsAu[2], 3, 1e-12, "orbit3");
});

test("zero spacing factor produces identical orbits", () => {
  const model = calcSystem({
    starMassMsol: 1,
    spacingFactor: 0,
    orbit1Au: 0.5,
  });
  for (const au of model.orbitsAu) {
    approxEqual(au, 0.5, 1e-12, "orbit-zero-spacing");
  }
});

test("habitable zone is physically plausible for solar-mass star", () => {
  const model = calcSystem(SOLAR_SYSTEM);
  assert.ok(model.habitableZoneAu.inner > 0.5, "HZ inner should be > 0.5 AU for G star");
  assert.ok(model.habitableZoneAu.outer > model.habitableZoneAu.inner, "HZ outer > inner");
  assert.ok(model.habitableZoneAu.outer < 2.5, "HZ outer should be < 2.5 AU for G star");
});

test("frost line scales with luminosity", () => {
  const low = calcSystem({
    starMassMsol: 0.5,
    spacingFactor: 0,
    orbit1Au: 0.1,
  });
  const high = calcSystem({
    starMassMsol: 2,
    spacingFactor: 0,
    orbit1Au: 0.1,
  });
  assert.ok(high.frostLineAu > low.frostLineAu, "brighter stars have farther frost lines");
});

test("million-km values match AU * 149.6", () => {
  const model = calcSystem(SOLAR_SYSTEM);
  approxEqual(
    model.habitableZoneMillionKm.inner,
    model.habitableZoneAu.inner * 149.6,
    1e-6,
    "HZ inner Mkm",
  );
  approxEqual(model.frostLineMillionKm, model.frostLineAu * 149.6, 1e-6, "frost Mkm");
});

test("input star mass is clamped to valid range", () => {
  const zero = calcSystem({
    starMassMsol: 0,
    spacingFactor: 0,
    orbit1Au: 0.1,
  });
  assert.equal(zero.inputs.starMassMsol, 0.075);

  const huge = calcSystem({
    starMassMsol: 9999,
    spacingFactor: 0,
    orbit1Au: 0.1,
  });
  assert.equal(huge.inputs.starMassMsol, 100);
});
