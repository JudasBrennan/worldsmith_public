import test from "node:test";
import assert from "node:assert/strict";

import { computeGreenhouseTau, calcPlanetExact } from "../engine/planet.js";
import { approxEqual } from "./testHelpers.js";

/* ── computeGreenhouseTau calibration ──────────────────────────── */

test("computeGreenhouseTau → Earth conditions → tau ≈ 0.70", () => {
  const tau = computeGreenhouseTau({
    pressureAtm: 1.0,
    co2Pct: 0.04,
    h2oPct: 0.4,
    ch4Pct: 0,
  });
  approxEqual(tau, 0.7, 0.02, "Earth tau");
});

test("computeGreenhouseTau → Venus conditions → tau ≈ 126", () => {
  const tau = computeGreenhouseTau({
    pressureAtm: 92,
    co2Pct: 96.5,
    h2oPct: 0,
    ch4Pct: 0,
  });
  approxEqual(tau, 126, 2, "Venus tau");
});

test("computeGreenhouseTau → Mars conditions → tau ≈ 0.029", () => {
  const tau = computeGreenhouseTau({
    pressureAtm: 0.006,
    co2Pct: 95.3,
    h2oPct: 0,
    ch4Pct: 0,
  });
  approxEqual(tau, 0.029, 0.005, "Mars tau");
});

test("No atmosphere (P=0) → tau = 0", () => {
  const tau = computeGreenhouseTau({
    pressureAtm: 0,
    co2Pct: 96.5,
    h2oPct: 50,
    ch4Pct: 5,
  });
  assert.equal(tau, 0);
});

test("CH₄-rich Titan-like → tau ≈ 0.97", () => {
  const tau = computeGreenhouseTau({
    pressureAtm: 1.5,
    co2Pct: 0,
    h2oPct: 0,
    ch4Pct: 5.0,
  });
  approxEqual(tau, 0.97, 0.05, "Titan tau");
});

test("H₂-N₂ CIA: 10% H₂, 90% N₂, 1 bar → tau ≈ 0.27", () => {
  const tau = computeGreenhouseTau({
    pressureAtm: 1.0,
    co2Pct: 0,
    h2oPct: 0,
    ch4Pct: 0,
    h2Pct: 10,
    n2Pct: 90,
    full: true,
  });
  approxEqual(tau, 0.27, 0.05, "H2-N2 CIA tau");
});

test("computeGreenhouseTau → expert gases at zero → matches core-only result", () => {
  const core = computeGreenhouseTau({
    pressureAtm: 1.0,
    co2Pct: 0.04,
    h2oPct: 0.4,
    ch4Pct: 0,
  });
  const full = computeGreenhouseTau({
    pressureAtm: 1.0,
    co2Pct: 0.04,
    h2oPct: 0.4,
    ch4Pct: 0,
    h2Pct: 0,
    n2Pct: 78,
    so2Pct: 0,
    nh3Pct: 0,
    full: true,
  });
  assert.equal(core, full);
});

/* ── Core mode integration via calcPlanetExact ─────────────────── */

test("Core mode: Earth gases → T ≈ 288 K", () => {
  const p = calcPlanetExact({
    starMassMsol: 1,
    starAgeGyr: 4.6,
    planet: {
      massEarth: 1,
      cmfPct: 33,
      axialTiltDeg: 23.4,
      albedoBond: 0.306,
      greenhouseMode: "core",
      observerHeightM: 2,
      rotationPeriodHours: 24,
      semiMajorAxisAu: 1,
      eccentricity: 0.017,
      inclinationDeg: 0,
      longitudeOfPeriapsisDeg: 0,
      subsolarLongitudeDeg: 0,
      pressureAtm: 1,
      o2Pct: 21,
      co2Pct: 0.04,
      arPct: 1,
      h2oPct: 0.4,
      ch4Pct: 0,
    },
  });
  approxEqual(p.derived.surfaceTempK, 288, 2, "Earth core-mode temp");
  assert.equal(p.derived.greenhouseMode, "core");
  assert.ok(p.derived.computedGreenhouseEffect > 0, "computed GHE > 0");
});

/* ── Manual mode backward compatibility ────────────────────────── */

test("calcPlanetExact → manual mode → preserves manual GHE", () => {
  const manualGHE = 1.19;
  const p = calcPlanetExact({
    starMassMsol: 1,
    starAgeGyr: 4.6,
    planet: {
      massEarth: 1,
      cmfPct: 33,
      axialTiltDeg: 23.4,
      albedoBond: 0.306,
      greenhouseEffect: manualGHE,
      greenhouseMode: "manual",
      observerHeightM: 2,
      rotationPeriodHours: 24,
      semiMajorAxisAu: 1,
      eccentricity: 0.017,
      inclinationDeg: 0,
      longitudeOfPeriapsisDeg: 0,
      subsolarLongitudeDeg: 0,
      pressureAtm: 1,
      o2Pct: 21,
      co2Pct: 0.04,
      arPct: 1,
    },
  });
  approxEqual(p.derived.greenhouseEffect, manualGHE, 0.001, "manual GHE preserved");
  assert.equal(p.derived.greenhouseMode, "manual");
});

/* ── Gas balance ───────────────────────────────────────────────── */

test("calcPlanetExact → full mode 9 gases → N₂ = remainder sums to 100%", () => {
  const p = calcPlanetExact({
    starMassMsol: 1,
    starAgeGyr: 4.6,
    planet: {
      massEarth: 1,
      cmfPct: 33,
      axialTiltDeg: 23.4,
      albedoBond: 0.3,
      greenhouseMode: "full",
      observerHeightM: 2,
      rotationPeriodHours: 24,
      semiMajorAxisAu: 1,
      eccentricity: 0.017,
      inclinationDeg: 0,
      longitudeOfPeriapsisDeg: 0,
      subsolarLongitudeDeg: 0,
      pressureAtm: 1,
      o2Pct: 20,
      co2Pct: 0.04,
      arPct: 1,
      h2oPct: 0.4,
      ch4Pct: 0.001,
      h2Pct: 2,
      hePct: 1,
      so2Pct: 0.01,
      nh3Pct: 0.005,
    },
  });
  const d = p.derived;
  const total = 20 + 0.04 + 1 + 0.4 + 0.001 + 2 + 1 + 0.01 + 0.005;
  const expectedN2 = 100 - total;
  approxEqual(d.n2Pct, expectedN2, 0.01, "N2 remainder");
});

/* ── CO₂-H₂O band overlap suppression ──────────────────────────── */

test("computeGreenhouseTau → Venus + trace H₂O → tau stays near calibrated value", () => {
  const tau = computeGreenhouseTau({
    pressureAtm: 92,
    co2Pct: 96.5,
    h2oPct: 0.003,
    ch4Pct: 0,
  });
  // Without overlap suppression this would be ~135; with suppression ~126.8
  approxEqual(tau, 127, 2, "Venus tau with H2O");
});

test("computeGreenhouseTau → CO₂-dominated atmosphere → H₂O heavily suppressed", () => {
  // Pure CO₂ atmosphere — H₂O should be almost entirely suppressed
  const co2Only = computeGreenhouseTau({
    pressureAtm: 92,
    co2Pct: 96.5,
    h2oPct: 0,
    ch4Pct: 0,
  });
  const withH2O = computeGreenhouseTau({
    pressureAtm: 92,
    co2Pct: 96.5,
    h2oPct: 0.003,
    ch4Pct: 0,
  });
  // H₂O adds < 1 tau when CO₂ dominates (vs ~9.5 unsuppressed)
  assert.ok(withH2O - co2Only < 1, "H₂O contribution should be heavily suppressed");
});

test("computeGreenhouseTau → low CO₂ → H₂O retains most contribution", () => {
  // Earth-like low CO₂ — H₂O should retain most of its contribution
  const co2Only = computeGreenhouseTau({
    pressureAtm: 1,
    co2Pct: 0.04,
    h2oPct: 0,
    ch4Pct: 0,
  });
  const withH2O = computeGreenhouseTau({
    pressureAtm: 1,
    co2Pct: 0.04,
    h2oPct: 0.4,
    ch4Pct: 0,
  });
  // H₂O adds ~0.5 tau at Earth conditions (overlap factor ~0.97)
  assert.ok(withH2O - co2Only > 0.4, "H₂O should retain most contribution at low CO₂");
});

/* ── Full mode adds expert gas terms ───────────────────────────── */

test("computeGreenhouseTau → full mode + SO₂ → tau increases", () => {
  const base = computeGreenhouseTau({
    pressureAtm: 1.0,
    co2Pct: 0.04,
    h2oPct: 0.4,
    ch4Pct: 0,
    so2Pct: 0,
    full: true,
  });
  const withSO2 = computeGreenhouseTau({
    pressureAtm: 1.0,
    co2Pct: 0.04,
    h2oPct: 0.4,
    ch4Pct: 0,
    so2Pct: 0.5,
    full: true,
  });
  assert.ok(withSO2 > base, "SO₂ should increase tau");
});

test("computeGreenhouseTau → full mode + NH₃ → tau increases", () => {
  const base = computeGreenhouseTau({
    pressureAtm: 1.0,
    co2Pct: 0.04,
    h2oPct: 0.4,
    ch4Pct: 0,
    nh3Pct: 0,
    full: true,
  });
  const withNH3 = computeGreenhouseTau({
    pressureAtm: 1.0,
    co2Pct: 0.04,
    h2oPct: 0.4,
    ch4Pct: 0,
    nh3Pct: 0.5,
    full: true,
  });
  assert.ok(withNH3 > base, "NH₃ should increase tau");
});

test("computeGreenhouseTau → Venus-level CO₂ → SO₂ heavily suppressed", () => {
  // At Venus conditions (τ_core ≈ 127), SO₂ should be heavily suppressed
  const tauCore = computeGreenhouseTau({
    pressureAtm: 92,
    co2Pct: 96.5,
    h2oPct: 0.003,
    ch4Pct: 0,
  });
  const tauFull = computeGreenhouseTau({
    pressureAtm: 92,
    co2Pct: 96.5,
    h2oPct: 0.003,
    ch4Pct: 0,
    so2Pct: 0.015,
    n2Pct: 3.47,
    full: true,
  });
  // Without overlap SO₂ adds ~8.9 tau; with overlap it should add < 1
  assert.ok(tauFull - tauCore < 1, "SO₂ should be heavily suppressed at Venus τ");
  assert.ok(tauFull > tauCore, "SO₂ should still add some tau");
});

test("computeGreenhouseTau → low CO₂ → SO₂ retains most effect", () => {
  // At Earth-like conditions (τ_core ≈ 0.7), SO₂ should be barely suppressed
  const base = computeGreenhouseTau({
    pressureAtm: 1.0,
    co2Pct: 0.04,
    h2oPct: 0.4,
    ch4Pct: 0,
    full: true,
  });
  const withSO2 = computeGreenhouseTau({
    pressureAtm: 1.0,
    co2Pct: 0.04,
    h2oPct: 0.4,
    ch4Pct: 0,
    so2Pct: 0.5,
    full: true,
  });
  // SO₂ raw contribution at 1 atm / 0.5% is ~0.27 tau
  // At τ_core ≈ 0.7, overlap factor ≈ 0.92 → retains >90%
  assert.ok(withSO2 - base > 0.2, "SO₂ should retain most contribution at low CO₂");
});

test("calcPlanetExact → He added → tau unchanged", () => {
  // He doesn't affect computeGreenhouseTau (only affects molecular weight)
  const without = computeGreenhouseTau({
    pressureAtm: 1.0,
    co2Pct: 0.04,
    h2oPct: 0.4,
    ch4Pct: 0,
    full: true,
  });
  // He is not a parameter of computeGreenhouseTau, so this tests that
  // adding He in calcPlanetExact doesn't change the computed tau
  const p = calcPlanetExact({
    starMassMsol: 1,
    starAgeGyr: 4.6,
    planet: {
      massEarth: 1,
      cmfPct: 33,
      axialTiltDeg: 23.4,
      albedoBond: 0.3,
      greenhouseMode: "core",
      observerHeightM: 2,
      rotationPeriodHours: 24,
      semiMajorAxisAu: 1,
      eccentricity: 0.017,
      inclinationDeg: 0,
      longitudeOfPeriapsisDeg: 0,
      subsolarLongitudeDeg: 0,
      pressureAtm: 1,
      o2Pct: 21,
      co2Pct: 0.04,
      arPct: 1,
      h2oPct: 0.4,
      ch4Pct: 0,
      hePct: 10,
    },
  });
  approxEqual(p.derived.computedGreenhouseTau, without, 0.001, "He should not affect tau");
});
