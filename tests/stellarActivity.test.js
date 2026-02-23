import test from "node:test";
import assert from "node:assert/strict";

import {
  computeFlareParams,
  createSeededRng,
  scheduleNextFlare,
  maybeSpawnCME,
  cmeTargetPerDayFromCycle,
  flareClassFromEnergy,
  sampleFlareEnergyErg,
  expectedRateAboveEnergyPerDay,
} from "../engine/stellarActivity.js";

function approxEqual(actual, expected, tolerance, label) {
  const msg = label
    ? `${label}: expected ${expected} +/- ${tolerance}, got ${actual}`
    : `${actual} not within ${tolerance} of ${expected}`;
  assert.ok(Math.abs(actual - expected) <= tolerance, msg);
}

test("flare params follow teff/age bins", () => {
  const sunLike = computeFlareParams({ teffK: 5770, ageGyr: 4.6, massMsol: 1, luminosityLsol: 1 });
  assert.equal(sunLike.teffBin, "FGK");
  assert.equal(sunLike.ageBand, "old");
  assert.equal(sunLike.N32, 0.05);
  assert.equal(sunLike.alpha, 1.8);
  approxEqual(sunLike.lambdaFlarePerDay, 199.05358527674866, 1e-12, "lambda");

  const earlyM = computeFlareParams({ teffK: 3500, ageGyr: 0.8 });
  assert.equal(earlyM.teffBin, "earlyM");
  assert.equal(earlyM.ageBand, "young");
  assert.equal(earlyM.N32, 8.0);
});

test("flare scheduling is deterministic with seeded RNG", () => {
  const params = computeFlareParams({ teffK: 5770, ageGyr: 4.6 });
  const rngA = createSeededRng("ws-seed");
  const rngB = createSeededRng("ws-seed");

  const nextA = scheduleNextFlare(0, params, rngA);
  const nextB = scheduleNextFlare(0, params, rngB);

  assert.deepEqual(nextA, nextB);
  assert.ok(nextA.timeSec > 0);
  assert.ok(nextA.energyErg >= params.EminErg);
  assert.ok(nextA.energyErg <= params.EmaxErg);
});

test("CME throttles by activity limits", () => {
  const params = computeFlareParams({ teffK: 5770, ageGyr: 4.6 });
  const target = cmeTargetPerDayFromCycle(0.6);

  assert.equal(
    maybeSpawnCME(1e34, params, target, { teffK: 5770 }, { activityCycle: 0.6, rng: () => 0 }),
    false,
  );

  const mParams = computeFlareParams({ teffK: 3000, ageGyr: 0.5 });
  assert.equal(maybeSpawnCME(1e35, mParams, 20, { teffK: 3000 }, { rng: () => 0 }), false);
});

test("flareClassFromEnergy returns correct class for each energy range", () => {
  assert.equal(flareClassFromEnergy(1e29), "micro");
  assert.equal(flareClassFromEnergy(1e30), "micro");
  assert.equal(flareClassFromEnergy(5e30), "micro");
  assert.equal(flareClassFromEnergy(1e31), "small");
  assert.equal(flareClassFromEnergy(5e31), "small");
  assert.equal(flareClassFromEnergy(1e32), "medium");
  assert.equal(flareClassFromEnergy(5e32), "medium");
  assert.equal(flareClassFromEnergy(1e33), "large");
  assert.equal(flareClassFromEnergy(5e33), "large");
  assert.equal(flareClassFromEnergy(1e34), "super");
  assert.equal(flareClassFromEnergy(1e35), "super");
});

test("flareClassFromEnergy handles edge cases", () => {
  assert.equal(flareClassFromEnergy(0), "micro");
  assert.equal(flareClassFromEnergy(NaN), "micro");
  assert.equal(flareClassFromEnergy(null), "micro");
});

test("sampleFlareEnergyErg returns energy within bounds", () => {
  const params = computeFlareParams({ teffK: 5770, ageGyr: 4.6 });
  const rng = createSeededRng("energy-test");
  for (let i = 0; i < 20; i++) {
    const e = sampleFlareEnergyErg(params, rng);
    assert.ok(e >= params.EminErg, `energy ${e} should be >= Emin ${params.EminErg}`);
    assert.ok(e <= params.EmaxErg, `energy ${e} should be <= Emax ${params.EmaxErg}`);
  }
});

test("sampleFlareEnergyErg respects custom bounds", () => {
  const custom = { alpha: 2.0, EminErg: 1e31, EmaxErg: 1e33 };
  const rng = createSeededRng("custom-bounds");
  for (let i = 0; i < 20; i++) {
    const e = sampleFlareEnergyErg(custom, rng);
    assert.ok(e >= 1e31, `energy ${e} should be >= 1e31`);
    assert.ok(e <= 1e33, `energy ${e} should be <= 1e33`);
  }
});

test("expectedRateAboveEnergyPerDay returns correct power-law rate", () => {
  const params = computeFlareParams({ teffK: 5770, ageGyr: 4.6 });
  // At E0 (1e32), rate should equal N32
  const rateAtE0 = expectedRateAboveEnergyPerDay(params, 1e32);
  approxEqual(rateAtE0, params.N32, 1e-12, "rate at E0");

  // At Emin (1e30), rate should be lambdaFlarePerDay
  const rateAtEmin = expectedRateAboveEnergyPerDay(params, 1e30);
  approxEqual(rateAtEmin, params.lambdaFlarePerDay, 1e-6, "rate at Emin");

  // Higher threshold → lower rate
  const rateHigh = expectedRateAboveEnergyPerDay(params, 1e34);
  assert.ok(rateHigh < rateAtE0, "rate above 1e34 should be less than rate above 1e32");
  assert.ok(rateHigh > 0, "rate should be positive");
});
