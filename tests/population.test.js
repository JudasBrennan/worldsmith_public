import test from "node:test";
import assert from "node:assert/strict";

import {
  oceanLandSplit,
  habitabilityFraction,
  productivityFraction,
  carryingCapacity,
  logisticPopulation,
  populationTimeSeries,
  rankSizeDistribution,
  calcPopulation,
  TECH_ERAS,
} from "../engine/population.js";
import { approxEqual, pctWithin } from "./testHelpers.js";

// ── oceanLandSplit ──────────────────────────────────────────

test("oceanLandSplit → Extensive oceans → 71% ocean", () => {
  const { oceanFraction, landFraction } = oceanLandSplit("Extensive oceans");
  approxEqual(oceanFraction, 0.71, 0.001, "ocean");
  approxEqual(landFraction, 0.29, 0.001, "land");
});

test("oceanLandSplit → Dry → 0% ocean", () => {
  const { oceanFraction, landFraction } = oceanLandSplit("Dry");
  assert.strictEqual(oceanFraction, 0);
  assert.strictEqual(landFraction, 1);
});

test("oceanLandSplit → unknown regime → fallback 50%", () => {
  const { oceanFraction } = oceanLandSplit("Nonsense");
  assert.strictEqual(oceanFraction, 0.5);
});

// ── habitabilityFraction ────────────────────────────────────

test("habitabilityFraction → Earth-like zones → 60–90% habitable", () => {
  // Simulate Earth-like zones: A(0-15), B(15-30), C(30-50), D(50-65), E(65-90)
  const zones = [
    { latMin: 0, latMax: 15, master: "A", cellRole: "hadley", variant: "general" },
    { latMin: 15, latMax: 30, master: "B", cellRole: "hadley", variant: "general" },
    { latMin: 30, latMax: 50, master: "C", cellRole: "ferrel", variant: "warm-coast" },
    { latMin: 30, latMax: 50, master: "C", cellRole: "ferrel", variant: "cold-coast" },
    { latMin: 50, latMax: 65, master: "D", cellRole: "ferrel", variant: "general" },
    { latMin: 65, latMax: 90, master: "E", cellRole: "polar", variant: "general" },
  ];
  const frac = habitabilityFraction(zones);
  assert.ok(frac >= 0.6, `habitable ${frac} >= 0.6`);
  assert.ok(frac <= 0.95, `habitable ${frac} <= 0.95`);
});

test("habitabilityFraction → all-polar zones → 0", () => {
  const zones = [
    { latMin: 0, latMax: 90, master: "E", cellRole: "polar", variant: "general" },
  ];
  assert.strictEqual(habitabilityFraction(zones), 0);
});

test("habitabilityFraction → empty → 0", () => {
  assert.strictEqual(habitabilityFraction([]), 0);
  assert.strictEqual(habitabilityFraction(null), 0);
});

// ── productivityFraction ────────────────────────────────────

test("productivityFraction → tropical + temperate → high productivity", () => {
  const zones = [
    { latMin: 0, latMax: 30, master: "A", aridity: 0.85, variant: "general" },
    { latMin: 30, latMax: 60, master: "C", aridity: 0.7, variant: "general" },
  ];
  const frac = productivityFraction(zones);
  assert.ok(frac >= 0.7, `productive ${frac} >= 0.7`);
});

test("productivityFraction → all desert → low productivity", () => {
  const zones = [
    { latMin: 0, latMax: 30, master: "B", aridity: 0.1, variant: "general" },
    { latMin: 30, latMax: 60, master: "B", aridity: 0.2, variant: "general" },
  ];
  const frac = productivityFraction(zones);
  assert.ok(frac <= 0.1, `productive ${frac} <= 0.1`);
});

// ── carryingCapacity ────────────────────────────────────────

test("carryingCapacity → Earth-like Medieval → reasonable K", () => {
  // ~49M km² productive, 30/km², 77% crops → ~1.47B
  const K = carryingCapacity(49e6, 30, 77);
  assert.ok(K > 1e9, `K ${K} > 1 billion`);
  assert.ok(K < 3e9, `K ${K} < 3 billion`);
});

test("carryingCapacity → 100% crops > 0% crops", () => {
  const kAllCrops = carryingCapacity(1e6, 30, 100);
  const kNoLivestock = carryingCapacity(1e6, 30, 0);
  assert.ok(kAllCrops > kNoLivestock, "all crops supports more people");
});

test("carryingCapacity → zero area → 0", () => {
  assert.strictEqual(carryingCapacity(0, 30, 77), 0);
});

// ── logisticPopulation ──────────────────────────────────────

test("logisticPopulation → t=0 → returns P0", () => {
  assert.strictEqual(logisticPopulation(1e6, 1000, 0.01, 0), 1000);
});

test("logisticPopulation → large t → approaches K", () => {
  const K = 1e6;
  const pop = logisticPopulation(K, 1000, 0.01, 5000);
  pctWithin(pop, K, 1, "approaches K");
});

test("logisticPopulation → mid-growth → between P0 and K", () => {
  const K = 1e6;
  const P0 = 1000;
  const pop = logisticPopulation(K, P0, 0.01, 500);
  assert.ok(pop > P0, `pop ${pop} > P0 ${P0}`);
  assert.ok(pop < K, `pop ${pop} < K ${K}`);
});

// ── populationTimeSeries ────────────────────────────────────

test("populationTimeSeries → monotonically increasing", () => {
  const series = populationTimeSeries(1e6, 100, 0.01, 2000, 50);
  assert.ok(series.length > 10, "has entries");
  for (let i = 1; i < series.length; i++) {
    assert.ok(
      series[i].population >= series[i - 1].population,
      `entry ${i}: ${series[i].population} >= ${series[i - 1].population}`,
    );
  }
});

// ── rankSizeDistribution ────────────────────────────────────

test("rankSizeDistribution → Zipf q=1 → 2nd is ~half of 1st", () => {
  const dist = rankSizeDistribution(1e6, 10, 1.0);
  assert.strictEqual(dist.length, 10);
  // 2nd should be approximately half of 1st (within rounding)
  const ratio = dist[1].population / dist[0].population;
  approxEqual(ratio, 0.5, 0.05, "2nd/1st ratio");
});

test("rankSizeDistribution → sum ≈ totalPop", () => {
  const total = 1e6;
  const dist = rankSizeDistribution(total, 6, 1.0);
  const sum = dist.reduce((s, d) => s + d.population, 0);
  pctWithin(sum, total, 2, "sum matches total");
});

// ── calcPopulation (integration) ────────────────────────────

test("calcPopulation → defaults produce valid output shape", () => {
  const result = calcPopulation();
  assert.ok(result.inputs, "has inputs");
  assert.ok(result.population, "has population");
  assert.ok(result.display, "has display");
  assert.ok(result.population.surfaceAreaKm2 > 0, "surface area > 0");
  assert.ok(result.population.K >= 0, "K >= 0");
  assert.ok(result.population.timeSeries.length > 0, "has time series");
  assert.ok(result.population.continents.length > 0, "has continents");
  assert.ok(typeof result.display.currentPopulation === "string", "display pop is string");
});

test("calcPopulation → Earth-like with Medieval era → population in millions", () => {
  const earthZones = [
    { latMin: 0, latMax: 15, master: "A", aridity: 0.85, cellRole: "hadley", variant: "general" },
    { latMin: 15, latMax: 30, master: "B", aridity: 0.15, cellRole: "hadley", variant: "general" },
    { latMin: 30, latMax: 50, master: "C", aridity: 0.7, cellRole: "ferrel", variant: "general" },
    { latMin: 50, latMax: 65, master: "D", aridity: 0.55, cellRole: "ferrel", variant: "general" },
    { latMin: 65, latMax: 90, master: "E", aridity: 0.2, cellRole: "polar", variant: "general" },
  ];
  const result = calcPopulation({
    radiusKm: 6371,
    waterRegime: "Extensive oceans",
    climateZones: earthZones,
    techEra: "Medieval",
    initialPopulation: 1000,
    timeElapsedYears: 2000,
  });
  // Should have grown significantly in 2000 years at r=1%
  assert.ok(
    result.population.currentPopulation > 1e6,
    `pop ${result.population.currentPopulation} > 1M`,
  );
});

test("TECH_ERAS → has expected entries", () => {
  assert.ok(TECH_ERAS.includes("Hunter-Gatherer"));
  assert.ok(TECH_ERAS.includes("Medieval"));
  assert.ok(TECH_ERAS.includes("Industrial"));
  assert.ok(TECH_ERAS.includes("Sci-Fi High"));
  assert.ok(TECH_ERAS.length >= 9);
});
