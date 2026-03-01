import test from "node:test";
import assert from "node:assert/strict";

import {
  calcGasGiant,
  massToRadiusRj,
  radiusToMassMjup,
  estimateMetallicity,
} from "../engine/gasGiant.js";
import { approxEqual } from "./testHelpers.js";

const SOLAR = {
  starMassMsol: 1,
  starLuminosityLsol: 1,
  starAgeGyr: 4.6,
  starRadiusRsol: 1,
};

/* ── Physical properties ─────────────────────────────────────────── */

test("calcGasGiant → Jupiter baseline → density ~1.33, gravity ~2.6g, escape ~59.5 km/s", () => {
  const m = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 9.925,
    ...SOLAR,
  });
  approxEqual(m.physical.densityGcm3, 1.33, 0.05);
  approxEqual(m.physical.gravityG, 2.64, 0.15); // volumetric-mean radius → slightly higher than equatorial-based 2.53
  approxEqual(m.physical.escapeVelocityKms, 59.5, 1.5);
});

test("calcGasGiant → Saturn baseline → density ~0.69 (less than water)", () => {
  const m = calcGasGiant({
    massMjup: 0.299,
    radiusRj: 0.84,
    orbitAu: 9.58,
    rotationPeriodHours: 10.656,
    ...SOLAR,
  });
  approxEqual(m.physical.densityGcm3, 0.69, 0.05);
  assert.ok(m.physical.densityGcm3 < 1, "Saturn should be less dense than water");
});

/* ── Mass ↔ Radius derivation ────────────────────────────────────── */

test("mass-to-radius Neptunian regime: 0.054 Mjup → ~0.35 Rj", () => {
  const r = massToRadiusRj(0.054);
  approxEqual(r, 0.35, 0.05);
});

test("mass-to-radius Jovian regime: 5 Mjup → ~1.0 Rj (flat)", () => {
  const r = massToRadiusRj(5);
  approxEqual(r, 1.0, 0.15); // Jovian regime is essentially flat
});

test("radius-to-mass Neptunian inversion: 0.36 Rj → ~0.05 Mjup", () => {
  const m = radiusToMassMjup(0.36);
  approxEqual(m, 0.05, 0.03);
});

test("calcGasGiant → missing mass → derives from radius", () => {
  const m = calcGasGiant({
    massMjup: null,
    radiusRj: 1.0,
    orbitAu: 5.2,
    rotationPeriodHours: 10,
    ...SOLAR,
  });
  assert.equal(m.inputs.massSource, "derived");
  assert.equal(m.inputs.radiusSource, "user");
  assert.ok(m.physical.massMjup > 0);
});

test("calcGasGiant → missing radius → derives from mass", () => {
  const m = calcGasGiant({
    massMjup: 1.0,
    radiusRj: null,
    orbitAu: 5.2,
    rotationPeriodHours: 10,
    ...SOLAR,
  });
  assert.equal(m.inputs.massSource, "user");
  assert.equal(m.inputs.radiusSource, "derived");
  assert.ok(m.physical.radiusRj > 0);
});

/* ── Temperature ─────────────────────────────────────────────────── */

test("equilibrium temp: Jupiter at 5.2 AU → ~110 K", () => {
  const m = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 9.925,
    ...SOLAR,
  });
  approxEqual(m.thermal.equilibriumTempK, 110, 20);
});

test("calcGasGiant → massive giant → T_eff exceeds T_eq (internal heat)", () => {
  const m = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 9.925,
    ...SOLAR,
  });
  assert.ok(
    m.thermal.effectiveTempK > m.thermal.equilibriumTempK,
    `T_eff (${m.thermal.effectiveTempK}) should exceed T_eq (${m.thermal.equilibriumTempK})`,
  );
});

/* ── Sudarsky classification ─────────────────────────────────────── */

test("Sudarsky → Jupiter T_eq ~110 K → class I", () => {
  const m = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 9.925,
    ...SOLAR,
  });
  assert.equal(m.classification.sudarsky, "I");
});

test("Sudarsky → hot Jupiter at 0.03 AU → class V", () => {
  const m = calcGasGiant({
    massMjup: 1,
    radiusRj: 1.3,
    orbitAu: 0.03,
    rotationPeriodHours: 10,
    ...SOLAR,
  });
  assert.equal(m.classification.sudarsky, "V");
  assert.ok(m.thermal.equilibriumTempK > 1200);
});

/* ── Cloud layers ────────────────────────────────────────────────── */

test("clouds → Jupiter-like → NH3 + NH4SH + H2O layers", () => {
  const m = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 9.925,
    ...SOLAR,
  });
  const names = m.clouds.map((c) => c.name);
  assert.ok(names.includes("NH₃"), "Should have ammonia clouds");
  assert.ok(names.includes("NH₄SH"), "Should have ammonium hydrosulfide");
  assert.ok(names.includes("H₂O"), "Should have water clouds");
});

test("clouds → hot Jupiter → silicate present, no ammonia", () => {
  const m = calcGasGiant({
    massMjup: 1,
    radiusRj: 1.3,
    orbitAu: 0.03,
    rotationPeriodHours: 10,
    ...SOLAR,
  });
  const names = m.clouds.map((c) => c.name);
  assert.ok(names.includes("Silicate"), "Should have silicate clouds");
  assert.ok(!names.includes("NH₃"), "Should NOT have ammonia clouds");
});

/* ── Atmospheric composition ─────────────────────────────────────── */

test("atmosphere → gas giant → ~86% H2, ~14% He", () => {
  const m = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 9.925,
    ...SOLAR,
  });
  approxEqual(m.atmosphere.h2Pct, 86, 2);
  approxEqual(m.atmosphere.hePct, 14, 2);
});

test("atmosphere → ice giant → ~80% H2, ~18% He, ~2% CH4", () => {
  const m = calcGasGiant({
    massMjup: 0.054,
    radiusRj: 0.35,
    orbitAu: 30,
    rotationPeriodHours: 16,
    ...SOLAR,
  });
  approxEqual(m.atmosphere.h2Pct, 80, 2);
  approxEqual(m.atmosphere.hePct, 18, 2);
  approxEqual(m.atmosphere.ch4Pct, 2, 0.5);
});

/* ── Gravitational zones ─────────────────────────────────────────── */

test("Hill sphere: Jupiter → ~0.35 AU", () => {
  const m = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 9.925,
    ...SOLAR,
  });
  approxEqual(m.gravity.hillSphereAu, 0.35, 0.05);
});

test("Roche limit: Jupiter → ~194,000 km (ice, fluid body)", () => {
  const m = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 9.925,
    ...SOLAR,
  });
  approxEqual(m.gravity.rocheLimit_iceKm, 194000, 20000);
});

test("chaotic zone: Jupiter → ~0.93 AU half-width (Wisdom 1980)", () => {
  const m = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 9.925,
    ...SOLAR,
  });
  // Δa = 1.3 × a × μ^(2/7) where μ = Mj/M☉ ≈ 9.55e-4
  approxEqual(m.gravity.chaoticZoneAu, 0.93, 0.15);
});

/* ── Magnetic field ──────────────────────────────────────────────── */

test("magnetic field → heavier giant → stronger field", () => {
  const light = calcGasGiant({
    massMjup: 0.3,
    radiusRj: 0.9,
    orbitAu: 5,
    rotationPeriodHours: 10,
    ...SOLAR,
  });
  const heavy = calcGasGiant({
    massMjup: 5,
    radiusRj: 1.1,
    orbitAu: 5,
    rotationPeriodHours: 10,
    ...SOLAR,
  });
  assert.ok(
    heavy.magnetic.surfaceFieldGauss > light.magnetic.surfaceFieldGauss,
    "Heavier giant should have stronger field",
  );
});

/* ── Atmospheric dynamics ────────────────────────────────────────── */

test("dynamics → faster rotation → more bands", () => {
  const slow = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5,
    rotationPeriodHours: 50,
    ...SOLAR,
  });
  const fast = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5,
    rotationPeriodHours: 5,
    ...SOLAR,
  });
  assert.ok(
    fast.dynamics.bandCount > slow.dynamics.bandCount,
    `Fast (${fast.dynamics.bandCount}) should have more bands than slow (${slow.dynamics.bandCount})`,
  );
});

test("dynamics → gas giant eastward, ice giant → westward", () => {
  const giant = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5,
    rotationPeriodHours: 10,
    ...SOLAR,
  });
  const ice = calcGasGiant({
    massMjup: 0.05,
    radiusRj: 0.35,
    orbitAu: 30,
    rotationPeriodHours: 16,
    ...SOLAR,
  });
  assert.equal(giant.dynamics.windDirection, "Eastward");
  assert.equal(ice.dynamics.windDirection, "Westward");
});

/* ── Orbital ─────────────────────────────────────────────────────── */

test("orbital period: Jupiter at 5.2 AU → ~11.86 years", () => {
  const m = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 9.925,
    ...SOLAR,
  });
  approxEqual(m.orbital.orbitalPeriodYears, 11.86, 0.1);
});

/* ── Appearance ──────────────────────────────────────────────────── */

test("appearance → colourHex → valid 7-char hex string", () => {
  const m = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 9.925,
    ...SOLAR,
  });
  assert.match(m.appearance.colourHex, /^#[0-9A-Fa-f]{6}$/);
});

/* ── Metallicity ────────────────────────────────────────────────── */

test("estimateMetallicity → Jupiter → ~4–5× solar", () => {
  const z = estimateMetallicity(1.0);
  assert.ok(z >= 3 && z <= 6, `Jupiter metallicity ${z} should be ~4-5× solar`);
});

test("estimateMetallicity → Saturn → ~10× solar", () => {
  const z = estimateMetallicity(0.299);
  assert.ok(z >= 7 && z <= 14, `Saturn metallicity ${z} should be ~10× solar`);
});

test("estimateMetallicity → Neptune → ~30–40× solar", () => {
  const z = estimateMetallicity(0.054);
  assert.ok(z >= 25 && z <= 50, `Neptune metallicity ${z} should be ~30-40× solar`);
});

test("estimateMetallicity: inverse mass trend (lighter → higher Z)", () => {
  const zHeavy = estimateMetallicity(5.0);
  const zLight = estimateMetallicity(0.1);
  assert.ok(
    zLight > zHeavy,
    `Light (${zLight}) should have higher metallicity than heavy (${zHeavy})`,
  );
});

test("metallicity → not specified → derived from mass", () => {
  const m = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 9.925,
    ...SOLAR,
  });
  assert.equal(m.inputs.metallicitySource, "derived");
  assert.ok(m.inputs.metallicitySolar > 0, "metallicity should be positive");
  assert.ok(m.atmosphere.metallicitySolar > 0, "atmosphere metallicity should be set");
});

test("metallicity → host-star [Fe/H] varies → derived metallicity scales", () => {
  const poor = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 9.925,
    stellarMetallicityFeH: -0.5,
    ...SOLAR,
  });
  const solar = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 9.925,
    stellarMetallicityFeH: 0,
    ...SOLAR,
  });
  const rich = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 9.925,
    stellarMetallicityFeH: 0.3,
    ...SOLAR,
  });
  assert.ok(
    poor.atmosphere.metallicitySolar < solar.atmosphere.metallicitySolar,
    "metal-poor host should reduce default atmospheric metallicity",
  );
  assert.ok(
    rich.atmosphere.metallicitySolar > solar.atmosphere.metallicitySolar,
    "metal-rich host should increase default atmospheric metallicity",
  );
});

test("metallicity → user-specified → overrides derived value", () => {
  const m = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 9.925,
    metallicity: 20,
    stellarMetallicityFeH: -1,
    ...SOLAR,
  });
  assert.equal(m.inputs.metallicitySource, "user");
  assert.equal(m.atmosphere.metallicitySolar, 20);
});

test("metallicity → higher value → increases trace gases, decreases H2", () => {
  const low = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 10,
    metallicity: 1,
    ...SOLAR,
  });
  const high = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 10,
    metallicity: 50,
    ...SOLAR,
  });
  assert.ok(high.atmosphere.ch4Pct > low.atmosphere.ch4Pct, "CH4 should increase with metallicity");
  assert.ok(high.atmosphere.h2Pct < low.atmosphere.h2Pct, "H2 should decrease with metallicity");
});

test("atmosphere → hot Jupiter → CO dominant, no CH4", () => {
  const m = calcGasGiant({
    massMjup: 1,
    radiusRj: 1.3,
    orbitAu: 0.03,
    rotationPeriodHours: 10,
    metallicity: 5,
    ...SOLAR,
  });
  assert.ok(m.atmosphere.coPct > 0, "Hot Jupiter should have CO");
  assert.equal(m.atmosphere.ch4Pct, 0, "Hot Jupiter should have no CH4");
  assert.equal(m.atmosphere.dominantTrace, "CO");
});

test("display → metallicity → formatted string with 'solar'", () => {
  const m = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 10,
    metallicity: 4.5,
    ...SOLAR,
  });
  assert.match(m.display.metallicity, /solar/);
});

/* ── Oblateness ─────────────────────────────────────────────────── */

test("oblateness → Jupiter → f ≈ 0.065", () => {
  const m = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 9.925,
    ...SOLAR,
  });
  approxEqual(m.oblateness.flattening, 0.065, 0.005, "Jupiter flattening");
});

test("oblateness → Saturn vs Jupiter → Saturn higher (lower density)", () => {
  const jup = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 9.925,
    ...SOLAR,
  });
  const sat = calcGasGiant({
    massMjup: 0.299,
    radiusRj: 0.84,
    orbitAu: 9.58,
    rotationPeriodHours: 10.656,
    ...SOLAR,
  });
  assert.ok(
    sat.oblateness.flattening > jup.oblateness.flattening,
    `Saturn f (${sat.oblateness.flattening}) should exceed Jupiter f (${jup.oblateness.flattening})`,
  );
});

test("oblateness → any giant → equatorial radius > polar radius", () => {
  const m = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 9.925,
    ...SOLAR,
  });
  assert.ok(m.oblateness.equatorialRadiusKm > m.oblateness.polarRadiusKm);
});

test("slow rotation → near-zero oblateness", () => {
  const m = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 100,
    ...SOLAR,
  });
  assert.ok(m.oblateness.flattening < 0.01, `f = ${m.oblateness.flattening} should be near zero`);
});

test("gravity → oblate giant → equatorial < mean (larger radius)", () => {
  const m = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 9.925,
    ...SOLAR,
  });
  assert.ok(
    m.physical.equatorialGravityMs2 < m.physical.gravityMs2,
    `eq gravity (${m.physical.equatorialGravityMs2}) should be less than mean (${m.physical.gravityMs2})`,
  );
});

/* ── Mass loss ──────────────────────────────────────────────────── */

test("massLoss → hot Jupiter at 0.03 AU → significant (>10⁶ kg/s)", () => {
  const m = calcGasGiant({
    massMjup: 1,
    radiusRj: 1.3,
    orbitAu: 0.03,
    rotationPeriodHours: 10,
    ...SOLAR,
  });
  assert.ok(m.massLoss.massLossRateKgS > 1e6, "Hot Jupiter should lose >10⁶ kg/s");
  assert.ok(m.massLoss.evaporationTimescaleGyr > 100, "Should not fully evaporate");
});

test("massLoss → Jupiter at 5.2 AU → negligible", () => {
  const m = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 9.925,
    ...SOLAR,
  });
  assert.ok(m.massLoss.massLossRateKgS < 1e3, "Jupiter should have negligible mass loss");
});

test("massLoss → rocheLobeOverflow → boolean, false for Jupiter", () => {
  const m = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 10,
    ...SOLAR,
  });
  assert.equal(typeof m.massLoss.rocheLobeOverflow, "boolean");
  assert.equal(m.massLoss.rocheLobeOverflow, false, "Jupiter should not overflow Roche lobe");
});

test("younger star → more XUV → more mass loss", () => {
  const young = calcGasGiant({
    massMjup: 1,
    radiusRj: 1.3,
    orbitAu: 0.05,
    rotationPeriodHours: 10,
    starMassMsol: 1,
    starLuminosityLsol: 1,
    starAgeGyr: 0.5,
    starRadiusRsol: 1,
  });
  const old = calcGasGiant({
    massMjup: 1,
    radiusRj: 1.3,
    orbitAu: 0.05,
    rotationPeriodHours: 10,
    starMassMsol: 1,
    starLuminosityLsol: 1,
    starAgeGyr: 8,
    starRadiusRsol: 1,
  });
  assert.ok(
    young.massLoss.massLossRateKgS > old.massLoss.massLossRateKgS,
    "Younger star should drive more mass loss",
  );
});

/* ── Interior / core ────────────────────────────────────────────── */

test("interior → Jupiter → ~30–60 M⊕ heavy elements (Thorngren 2016)", () => {
  const m = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 9.925,
    ...SOLAR,
  });
  assert.ok(
    m.interior.totalHeavyElementsMearth >= 30 && m.interior.totalHeavyElementsMearth <= 60,
    `Heavy elements ${m.interior.totalHeavyElementsMearth} should be 30–60 M⊕`,
  );
});

test("interior → massive planet → core capped at 25 M⊕", () => {
  const m = calcGasGiant({
    massMjup: 10,
    radiusRj: 1.1,
    orbitAu: 5.2,
    rotationPeriodHours: 10,
    ...SOLAR,
  });
  assert.ok(m.interior.estimatedCoreMassMearth <= 25, "Core should be capped at 25 M⊕");
});

test("interior → heavier planet → more heavy elements", () => {
  const light = calcGasGiant({
    massMjup: 0.3,
    radiusRj: 0.9,
    orbitAu: 5,
    rotationPeriodHours: 10,
    ...SOLAR,
  });
  const heavy = calcGasGiant({
    massMjup: 5,
    radiusRj: 1.1,
    orbitAu: 5,
    rotationPeriodHours: 10,
    ...SOLAR,
  });
  assert.ok(
    heavy.interior.totalHeavyElementsMearth > light.interior.totalHeavyElementsMearth,
    "Heavier planet should have more heavy elements",
  );
});

/* ── Age-dependent radius ───────────────────────────────────────── */

test("young system → inflated suggested radius", () => {
  const young = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 10,
    starMassMsol: 1,
    starLuminosityLsol: 1,
    starAgeGyr: 0.5,
    starRadiusRsol: 1,
  });
  const old = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 10,
    starMassMsol: 1,
    starLuminosityLsol: 1,
    starAgeGyr: 8,
    starRadiusRsol: 1,
  });
  assert.ok(
    young.physical.suggestedRadiusRj > old.physical.suggestedRadiusRj,
    "Young system should suggest larger radius",
  );
});

test("old system → baseline radius", () => {
  const m = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 10,
    starMassMsol: 1,
    starLuminosityLsol: 1,
    starAgeGyr: 5,
    starRadiusRsol: 1,
  });
  approxEqual(m.physical.radiusInflationFactor, 1.1, 0.05, "5 Gyr inflation factor");
});

test("radius → hot Jupiter proximity → inflation added to suggested", () => {
  const cold = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 10,
    ...SOLAR,
  });
  const hot = calcGasGiant({
    massMjup: 1,
    radiusRj: 1.3,
    orbitAu: 0.03,
    rotationPeriodHours: 10,
    ...SOLAR,
  });
  assert.ok(hot.physical.proximityInflationRj > 0, "Hot Jupiter should have proximity inflation");
  assert.equal(
    cold.physical.proximityInflationRj,
    0,
    "Cold giant should have no proximity inflation",
  );
});

/* ── Ring properties ────────────────────────────────────────────── */

test("cold giant → icy rings", () => {
  const m = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 9.925,
    ...SOLAR,
  });
  assert.equal(m.ringProperties.ringType, "Icy");
});

test("hot giant → rocky rings", () => {
  const m = calcGasGiant({
    massMjup: 1,
    radiusRj: 1.3,
    orbitAu: 0.03,
    rotationPeriodHours: 10,
    ...SOLAR,
  });
  assert.equal(m.ringProperties.ringType, "Rocky");
});

test("rings → Saturn mass (0.3 Mjup) → peak ring mass, Dense depth", () => {
  const saturn = calcGasGiant({
    massMjup: 0.3,
    radiusRj: 0.9,
    orbitAu: 9,
    rotationPeriodHours: 10,
    ...SOLAR,
  });
  const jupiter = calcGasGiant({
    massMjup: 1.0,
    radiusRj: 1.0,
    orbitAu: 5,
    rotationPeriodHours: 10,
    ...SOLAR,
  });
  assert.ok(
    saturn.ringProperties.estimatedMassKg > jupiter.ringProperties.estimatedMassKg,
    "Saturn-mass planet should have more ring mass than Jupiter-mass",
  );
  assert.equal(saturn.ringProperties.opticalDepthClass, "Dense");
  assert.equal(jupiter.ringProperties.opticalDepthClass, "Tenuous");
});

/* ── Tidal effects ──────────────────────────────────────────────── */

test("tidal → hot Jupiter at 0.03 AU → tidally locked", () => {
  const m = calcGasGiant({
    massMjup: 1,
    radiusRj: 1.3,
    orbitAu: 0.03,
    rotationPeriodHours: 10,
    ...SOLAR,
  });
  assert.equal(m.tidal.isTidallyLocked, true, "Hot Jupiter should be tidally locked");
});

test("tidal → Jupiter at 5.2 AU → not tidally locked", () => {
  const m = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 9.925,
    ...SOLAR,
  });
  assert.equal(m.tidal.isTidallyLocked, false, "Jupiter should not be tidally locked");
});

test("tidal → closer orbit → shorter locking timescale", () => {
  const close = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 0.1,
    rotationPeriodHours: 10,
    ...SOLAR,
  });
  const far = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 1,
    rotationPeriodHours: 10,
    ...SOLAR,
  });
  assert.ok(
    close.tidal.lockingTimescaleGyr < far.tidal.lockingTimescaleGyr,
    "Closer orbit should lock faster",
  );
});

test("tidal → circularisation timescale → positive value", () => {
  const m = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 9.925,
    ...SOLAR,
  });
  assert.ok(
    m.tidal.circularisationTimescaleGyr > 0,
    "Circularisation timescale should be positive",
  );
});
