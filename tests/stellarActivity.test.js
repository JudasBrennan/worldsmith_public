import test from "node:test";
import assert from "node:assert/strict";

import {
  computeCmeRateModel,
  computeFlareParams,
  computeStellarActivityModel,
  createSeededRng,
  cmeTargetPerDayFromCycle,
  flareCycleMultiplierFromCycle,
  flareClassFromEnergy,
  expectedRateAboveEnergyPerDay,
  maybeSpawnCME,
  sampleFlareEnergyErg,
  scheduleNextCme,
  scheduleNextFlare,
} from "../engine/stellarActivity.js";
import { approxEqual } from "./testHelpers.js";

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

test("computeStellarActivityModel returns style-guide tiers and numeric activity values", () => {
  const model = computeStellarActivityModel({
    teffK: 5770,
    ageGyr: 4.6,
    massMsol: 1,
    luminosityLsol: 1,
  });
  assert.ok(model && typeof model === "object");
  assert.ok(model.inputs && typeof model.inputs === "object");
  assert.ok(model.activity && typeof model.activity === "object");
  assert.ok(model.display && typeof model.display === "object");
  assert.equal(model.activity.teffBin, "FGK");
  assert.equal(model.activity.ageBand, "old");
  assert.equal(model.activity.N32, 0.05);
  approxEqual(model.activity.energeticFlareRatePerDay, 0.05, 1e-12, "energetic flare rate");
  approxEqual(model.activity.totalFlareRatePerDay, 199.05358527674866, 1e-12, "total flare rate");
  assert.ok(model.activity.cmeTotalRatePerDay > 0);
  assert.ok(model.activity.cmeBackgroundRatePerDay >= 0);
  assert.equal(model.inputs.massMsun, 1);
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

test("CME spawn probability soft-suppresses as recent daily count rises", () => {
  const params = computeFlareParams({ teffK: 5770, ageGyr: 4.6 });
  let lowRecentHits = 0;
  let highRecentHits = 0;
  for (let i = 0; i < 200; i++) {
    const u = (i + 0.5) / 200;
    if (maybeSpawnCME(1e34, params, 0, { teffK: 5770 }, { activityCycle: 0.6, rng: () => u }))
      lowRecentHits += 1;
    if (maybeSpawnCME(1e34, params, 50, { teffK: 5770 }, { activityCycle: 0.6, rng: () => u }))
      highRecentHits += 1;
  }
  assert.ok(highRecentHits < lowRecentHits, "high-recent CME spawn count should be lower");
});

test("flareClassFromEnergy returns correct class for each energy range and edge cases", () => {
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
  // Edge cases
  assert.equal(flareClassFromEnergy(0), "micro");
  assert.equal(flareClassFromEnergy(NaN), "micro");
  assert.equal(flareClassFromEnergy(null), "micro");
});

test("sampleFlareEnergyErg returns energy within bounds (derived and custom)", () => {
  const params = computeFlareParams({ teffK: 5770, ageGyr: 4.6 });
  const rng = createSeededRng("energy-test");
  for (let i = 0; i < 20; i++) {
    const e = sampleFlareEnergyErg(params, rng);
    assert.ok(e >= params.EminErg, `energy ${e} should be >= Emin ${params.EminErg}`);
    assert.ok(e <= params.EmaxErg, `energy ${e} should be <= Emax ${params.EmaxErg}`);
  }
  // Custom bounds
  const custom = { alpha: 2.0, EminErg: 1e31, EmaxErg: 1e33 };
  const rng2 = createSeededRng("custom-bounds");
  for (let i = 0; i < 20; i++) {
    const e = sampleFlareEnergyErg(custom, rng2);
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

test("activity helpers accept nested activity params contract", () => {
  const model = computeStellarActivityModel({ teffK: 5770, ageGyr: 4.6 });
  const next = scheduleNextFlare(0, model, createSeededRng("nested"));
  assert.ok(next.timeSec > 0);
  const rateAtE0 = expectedRateAboveEnergyPerDay(model, 1e32);
  approxEqual(rateAtE0, model.activity.N32, 1e-12, "nested rate at E0");
  const cmeSpawn = maybeSpawnCME(
    1e34,
    model,
    0,
    { teffK: 5770 },
    { activityCycle: 0.5, rng: () => 0 },
  );
  assert.equal(typeof cmeSpawn, "boolean");
});

test("flareCycleMultiplierFromCycle keeps midpoint at unity", () => {
  approxEqual(flareCycleMultiplierFromCycle("FGK", 0.5), 1, 1e-12, "FGK midpoint");
  approxEqual(flareCycleMultiplierFromCycle("earlyM", 0.5), 1, 1e-12, "earlyM midpoint");
  approxEqual(flareCycleMultiplierFromCycle("lateM", 0.5), 1, 1e-12, "lateM midpoint");
});

test("computeCmeRateModel matches FGK target envelope by splitting associated/background channels", () => {
  const model = computeStellarActivityModel({ teffK: 5770, ageGyr: 4.6 }, { activityCycle: 0.2 });
  const cme = computeCmeRateModel(model, { activityCycle: 0.2 });
  const target = cmeTargetPerDayFromCycle(0.2);
  approxEqual(cme.totalRatePerDay, target, 1e-12, "FGK total CME target");
  assert.ok(cme.associatedRatePerDay >= 0);
  assert.ok(cme.backgroundRatePerDay >= 0);
});

test("scheduleNextCme is deterministic with seeded RNG", () => {
  const rngA = createSeededRng("cme-seed");
  const rngB = createSeededRng("cme-seed");
  const tA = scheduleNextCme(123.4, 2.5, rngA);
  const tB = scheduleNextCme(123.4, 2.5, rngB);
  approxEqual(tA, tB, 1e-12, "deterministic CME schedule");
  assert.ok(tA > 123.4);
});
