import test from "node:test";
import assert from "node:assert/strict";

import {
  calcGasGiant,
  massToRadiusRj,
  radiusToMassMjup,
  estimateMetallicity,
} from "../engine/gasGiant.js";

function approxEqual(actual, expected, tolerance, label) {
  const msg = label
    ? `${label}: expected ${expected} +/- ${tolerance}, got ${actual}`
    : `${actual} not within ${tolerance} of ${expected}`;
  assert.ok(Math.abs(actual - expected) <= tolerance, msg);
}

const SOLAR = {
  starMassMsol: 1,
  starLuminosityLsol: 1,
  starAgeGyr: 4.6,
  starRadiusRsol: 1,
};

/* ── Physical properties ─────────────────────────────────────────── */

test("Jupiter baseline: density ~1.33, gravity ~2.6g, escape ~59.5 km/s", () => {
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

test("Saturn baseline: density ~0.69 (less than water)", () => {
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

test("missing mass derives from radius", () => {
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

test("missing radius derives from mass", () => {
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

test("effective temp > equilibrium for massive giants (internal heat)", () => {
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

test("Sudarsky class I for Jupiter (T_eq ~110 K)", () => {
  const m = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 9.925,
    ...SOLAR,
  });
  assert.equal(m.classification.sudarsky, "I");
});

test("Sudarsky class V for hot Jupiter at 0.03 AU", () => {
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

test("Jupiter-like has NH3 + NH4SH + H2O clouds", () => {
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

test("hot Jupiter has silicate clouds but no ammonia", () => {
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

test("gas giant atmosphere ~86% H2, ~14% He", () => {
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

test("ice giant atmosphere ~80% H2, ~18% He, ~2% CH4", () => {
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

test("magnetic field scales with mass", () => {
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

test("band count increases with faster rotation", () => {
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

test("wind direction: eastward for gas giant, westward for ice giant", () => {
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

test("colour hex is valid 7-char string", () => {
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

test("estimateMetallicity: Jupiter ~4–5× solar", () => {
  const z = estimateMetallicity(1.0);
  assert.ok(z >= 3 && z <= 6, `Jupiter metallicity ${z} should be ~4-5× solar`);
});

test("estimateMetallicity: Saturn ~10× solar", () => {
  const z = estimateMetallicity(0.299);
  assert.ok(z >= 7 && z <= 14, `Saturn metallicity ${z} should be ~10× solar`);
});

test("estimateMetallicity: Neptune ~30–40× solar", () => {
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

test("default metallicity is derived from mass when not specified", () => {
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

test("user-specified metallicity is used when provided", () => {
  const m = calcGasGiant({
    massMjup: 1,
    radiusRj: 1,
    orbitAu: 5.2,
    rotationPeriodHours: 9.925,
    metallicity: 20,
    ...SOLAR,
  });
  assert.equal(m.inputs.metallicitySource, "user");
  assert.equal(m.atmosphere.metallicitySolar, 20);
});

test("higher metallicity increases trace gas abundances", () => {
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

test("hot Jupiter atmosphere has CO instead of CH4", () => {
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

test("metallicity display string is formatted", () => {
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
