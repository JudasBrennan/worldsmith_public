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

// ── Override tests ──────────────────────────────

test("luminosity override changes frost line and HZ", () => {
  const base = calcSystem({ ...SOLAR_SYSTEM });
  const bright = calcSystem({ ...SOLAR_SYSTEM, luminosityLsolOverride: 4 });
  // frost line = 4.85 * sqrt(L); L=4 → frost ~2× base
  assert.ok(bright.frostLineAu > base.frostLineAu, "brighter override → farther frost line");
  approxEqual(bright.frostLineAu, 4.85 * Math.sqrt(4), 1e-6, "frost line with L=4");
  assert.ok(bright.star.luminosityLsol === 4, "star.luminosityLsol reflects override");
  assert.ok(bright.habitableZoneAu.outer > base.habitableZoneAu.outer, "HZ widens with higher L");
});

test("radius override changes inner limit and density", () => {
  const base = calcSystem({ ...SOLAR_SYSTEM });
  const big = calcSystem({ ...SOLAR_SYSTEM, radiusRsolOverride: 3 });
  assert.ok(big.systemInnerLimitAu > base.systemInnerLimitAu, "larger star → farther inner limit");
  assert.ok(big.star.radiusRsol === 3, "star.radiusRsol reflects override");
  assert.ok(big.star.densityDsol < base.star.densityDsol, "larger radius → lower density");
});

test("both overrides applied together", () => {
  const model = calcSystem({
    ...SOLAR_SYSTEM,
    luminosityLsolOverride: 10,
    radiusRsolOverride: 5,
  });
  assert.equal(model.star.luminosityLsol, 10);
  assert.equal(model.star.radiusRsol, 5);
  approxEqual(model.frostLineAu, 4.85 * Math.sqrt(10), 1e-6, "frost line with L=10");
});

test("invalid overrides are ignored", () => {
  const base = calcSystem({ ...SOLAR_SYSTEM });
  const neg = calcSystem({ ...SOLAR_SYSTEM, luminosityLsolOverride: -1, radiusRsolOverride: 0 });
  assert.equal(neg.star.luminosityLsol, base.star.luminosityLsol);
  assert.equal(neg.star.radiusRsol, base.star.radiusRsol);
  const nan = calcSystem({ ...SOLAR_SYSTEM, luminosityLsolOverride: NaN, radiusRsolOverride: NaN });
  assert.equal(nan.star.luminosityLsol, base.star.luminosityLsol);
});
