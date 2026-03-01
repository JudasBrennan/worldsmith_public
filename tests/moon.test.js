import test from "node:test";
import assert from "node:assert/strict";

import { calcMoonExact, compositionFromDensity } from "../engine/moon.js";
import { approxEqual } from "./testHelpers.js";

const EARTH_PLANET = {
  massEarth: 1,
  cmfPct: 33,
  axialTiltDeg: 23.4,
  albedoBond: 0.3,
  greenhouseEffect: 1,
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
};

const EARTH_MOON = {
  massMoon: 1.0,
  densityGcm3: 3.34,
  albedo: 0.11,
  semiMajorAxisKm: 384748,
  eccentricity: 0.055,
  inclinationDeg: 5.15,
};

const BASE = {
  starMassMsol: 1,
  starAgeGyr: 4.6,
  planet: EARTH_PLANET,
  moon: EARTH_MOON,
};

test("calcMoonExact → Earth-Moon → sidereal period ~27.3 days", () => {
  const m = calcMoonExact(BASE);
  approxEqual(m.orbit.orbitalPeriodSiderealDays, 27.32, 0.5, "sidereal period");
});

test("calcMoonExact → Earth-Moon → synodic period ~29.5 days", () => {
  const m = calcMoonExact(BASE);
  approxEqual(m.orbit.orbitalPeriodSynodicDays, 29.5, 1, "synodic period");
});

test("calcMoonExact → Earth-Moon → Moon tidally locked", () => {
  const m = calcMoonExact(BASE);
  assert.equal(m.tides.moonLockedToPlanet, "Yes");
});

test("calcMoonExact → Earth-Moon → Earth not locked to Moon", () => {
  const m = calcMoonExact(BASE);
  assert.match(m.tides.planetLockedToMoon, /Maybe/);
});

test("calcMoonExact → prograde inclination → Prograde direction", () => {
  const m = calcMoonExact(BASE);
  assert.equal(m.orbit.orbitalDirection, "Prograde");
});

test("calcMoonExact → retrograde inclination >90° → Retrograde direction", () => {
  const m = calcMoonExact({ ...BASE, moon: { ...EARTH_MOON, inclinationDeg: 120 } });
  assert.equal(m.orbit.orbitalDirection, "Retrograde");
});

test("calcMoonExact → inclination 90° → Undefined direction", () => {
  const m = calcMoonExact({ ...BASE, moon: { ...EARTH_MOON, inclinationDeg: 90 } });
  assert.equal(m.orbit.orbitalDirection, "Undefined");
});

test("calcMoonExact → Earth-Moon → tidal contribution >50%", () => {
  const m = calcMoonExact(BASE);
  assert.ok(m.tides.moonContributionPct > 50, "Moon should dominate tides");
});

test("calcMoonExact → Earth-Moon → zone inner < SMA < outer", () => {
  const m = calcMoonExact(BASE);
  assert.ok(m.orbit.moonZoneInnerKm < m.inputs.semiMajorAxisKm);
  assert.ok(m.inputs.semiMajorAxisKm < m.orbit.moonZoneOuterKm);
});

test("calcMoonExact → Earth-Moon → physical properties positive finite", () => {
  const m = calcMoonExact(BASE);
  assert.ok(Number.isFinite(m.physical.radiusMoon) && m.physical.radiusMoon > 0);
  assert.ok(Number.isFinite(m.physical.gravityG) && m.physical.gravityG > 0);
  assert.ok(Number.isFinite(m.physical.escapeVelocityKmS) && m.physical.escapeVelocityKmS > 0);
});

test("calcMoonExact → SMA below inner zone → guard fires", () => {
  // Use a tiny orbit that would be inside the Roche limit
  const m = calcMoonExact({ ...BASE, moon: { ...EARTH_MOON, semiMajorAxisKm: 1000 } });
  assert.equal(m.orbit.semiMajorAxisGuard, "raised_to_avoid_collision");
});

// ── parentOverride (gas giant parent) ──

const JUPITER_OVERRIDE = {
  inputs: {
    massEarth: 317.83,
    semiMajorAxisAu: 5.2,
    eccentricity: 0,
    rotationPeriodHours: 9.9,
    cmfPct: 0,
  },
  derived: {
    densityGcm3: 1.33,
    radiusEarth: 11.21,
    gravityG: 2.53,
  },
};

const IO_MOON = {
  massMoon: 1.21,
  densityGcm3: 3.53,
  albedo: 0.63,
  semiMajorAxisKm: 421700,
  eccentricity: 0.0041,
  inclinationDeg: 0.05,
};

test("parentOverride → Io around Jupiter → sidereal period ~1.77 days", () => {
  const m = calcMoonExact({
    starMassMsol: 1,
    starAgeGyr: 4.6,
    moon: IO_MOON,
    parentOverride: JUPITER_OVERRIDE,
  });
  // Io's sidereal period is ~1.77 days
  approxEqual(m.orbit.orbitalPeriodSiderealDays, 1.77, 0.3, "Io sidereal period");
});

test("parentOverride → Jupiter → moon zones much larger than Earth", () => {
  const m = calcMoonExact({
    starMassMsol: 1,
    starAgeGyr: 4.6,
    moon: IO_MOON,
    parentOverride: JUPITER_OVERRIDE,
  });
  // Jupiter's moon zone outer should be millions of km (Hill sphere)
  assert.ok(m.orbit.moonZoneOuterKm > 1e6, "Jupiter moon zone outer should be >1M km");
  assert.ok(m.orbit.moonZoneInnerKm > 0, "Jupiter moon zone inner should be positive");
});

test("parentOverride → Io around Jupiter → all outputs finite", () => {
  const m = calcMoonExact({
    starMassMsol: 1,
    starAgeGyr: 4.6,
    moon: IO_MOON,
    parentOverride: JUPITER_OVERRIDE,
  });
  assert.ok(Number.isFinite(m.physical.radiusMoon) && m.physical.radiusMoon > 0);
  assert.ok(Number.isFinite(m.physical.gravityG) && m.physical.gravityG > 0);
  assert.ok(Number.isFinite(m.orbit.orbitalPeriodSiderealDays));
  assert.ok(Number.isFinite(m.tides.totalEarthTides));
  assert.ok(Number.isFinite(m.tides.moonContributionPct));
});

// ── Composition from density ──

test("compositionFromDensity → each density bracket → correct class", () => {
  assert.equal(compositionFromDensity(5.5).compositionClass, "Iron-rich");
  assert.equal(compositionFromDensity(3.53).compositionClass, "Rocky");
  assert.equal(compositionFromDensity(3.01).compositionClass, "Mixed rock/ice");
  assert.equal(compositionFromDensity(1.61).compositionClass, "Icy");
  assert.equal(compositionFromDensity(0.7).compositionClass, "Very icy");
});

test("compositionFromDensity → density sweep → rigidity non-decreasing", () => {
  let prev = compositionFromDensity(0.5).mu;
  for (let rho = 0.6; rho <= 8.0; rho += 0.1) {
    const { mu } = compositionFromDensity(rho);
    assert.ok(
      mu >= prev - 1,
      `mu should be non-decreasing: ${mu} < ${prev} at rho=${rho.toFixed(1)}`,
    );
    prev = mu;
  }
});

// ── Tidal heating ──

const EUROPA_MOON = {
  massMoon: 0.654,
  densityGcm3: 3.013,
  albedo: 0.67,
  semiMajorAxisKm: 671100,
  eccentricity: 0.0094,
  inclinationDeg: 0.466,
};

test("tidalHeating → Io → ~10^14 W order of magnitude", () => {
  const m = calcMoonExact({
    starMassMsol: 1,
    starAgeGyr: 4.6,
    moon: IO_MOON,
    parentOverride: JUPITER_OVERRIDE,
  });
  assert.ok(m.tides.tidalHeatingW > 1e13, `Io heating ${m.tides.tidalHeatingW} should be >1e13 W`);
  assert.ok(m.tides.tidalHeatingW < 1e15, `Io heating ${m.tides.tidalHeatingW} should be <1e15 W`);
});

test("tidalHeating → Io surface flux → correct order of magnitude", () => {
  // Equilibrium formula gives ~0.3 W/m²; observed ~2 W/m² is enhanced
  // by the Laplace resonance (partially molten interior lowers Q).
  const m = calcMoonExact({
    starMassMsol: 1,
    starAgeGyr: 4.6,
    moon: IO_MOON,
    parentOverride: JUPITER_OVERRIDE,
  });
  assert.ok(m.tides.tidalHeatingWm2 > 0.1, `Io flux ${m.tides.tidalHeatingWm2} should be >0.1`);
  assert.ok(m.tides.tidalHeatingWm2 < 5, `Io flux ${m.tides.tidalHeatingWm2} should be <5`);
});

test("tidalHeating → Europa vs Io → Europa lower", () => {
  const io = calcMoonExact({
    starMassMsol: 1,
    starAgeGyr: 4.6,
    moon: IO_MOON,
    parentOverride: JUPITER_OVERRIDE,
  });
  const europa = calcMoonExact({
    starMassMsol: 1,
    starAgeGyr: 4.6,
    moon: EUROPA_MOON,
    parentOverride: JUPITER_OVERRIDE,
  });
  assert.ok(europa.tides.tidalHeatingW < io.tides.tidalHeatingW, "Europa < Io");
  assert.ok(europa.tides.tidalHeatingW > 0, "Europa heating should be positive");
});

test("tidalHeating → Earth-Moon → negligible", () => {
  const m = calcMoonExact(BASE);
  assert.ok(
    m.tides.tidalHeatingWm2 < 0.001,
    `Moon heating ${m.tides.tidalHeatingWm2} W/m² should be negligible`,
  );
});

test("zero eccentricity → zero tidal heating", () => {
  const m = calcMoonExact({ ...BASE, moon: { ...EARTH_MOON, eccentricity: 0 } });
  assert.equal(m.tides.tidalHeatingW, 0);
});

// ── Higher-order eccentricity ──

test("tidalHeating → high eccentricity e=0.3 → enhanced beyond e² truncation", () => {
  const m = calcMoonExact({
    ...BASE,
    moon: { ...EARTH_MOON, eccentricity: 0.3, inclinationDeg: 0 },
  });
  // e² truncation would give heating ∝ 0.09; N_a(0.3)·0.09/(1-0.09)^7.5 ≈ 0.55
  // Ratio should be >5×
  const lowE = calcMoonExact({
    ...BASE,
    moon: { ...EARTH_MOON, eccentricity: 0.01, inclinationDeg: 0 },
  });
  const ratio = m.tides.tidalHeatingW / lowE.tides.tidalHeatingW;
  // If pure e² scaling: ratio = (0.3/0.01)² = 900.  With N_a: much higher.
  assert.ok(ratio > 4000, `ratio ${ratio} should be >4000 (higher-order e enhancement)`);
});

// ── Tidal recession ──

test("recession → Earth-Moon → ~3.8 cm/yr outward", () => {
  const m = calcMoonExact(BASE);
  assert.ok(m.tides.recessionCmYr > 1, `recession ${m.tides.recessionCmYr} should be >1 cm/yr`);
  assert.ok(m.tides.recessionCmYr < 10, `recession ${m.tides.recessionCmYr} should be <10 cm/yr`);
});

test("slow-spinning planet → inward recession (Phobos-like)", () => {
  // Planet rotation slower than moon orbital period → inward migration
  const m = calcMoonExact({
    ...BASE,
    planet: { ...EARTH_PLANET, rotationPeriodHours: 10000 },
  });
  assert.ok(m.tides.recessionCmYr < 0, "should migrate inward");
});

test("recession → Earth-Moon display → includes direction", () => {
  const m = calcMoonExact(BASE);
  assert.ok(m.display.recession.includes("outward"), `got: ${m.display.recession}`);
});

// ── Composition override ──

test("compositionOverride → Icy on rocky-density moon → uses icy Q", () => {
  const auto = calcMoonExact(BASE);
  const icy = calcMoonExact({
    ...BASE,
    moon: { ...EARTH_MOON, compositionOverride: "Icy" },
  });
  assert.equal(icy.tides.compositionClass, "Icy");
  assert.equal(icy.tides.qMoon, 10);
  assert.notEqual(auto.tides.qMoon, icy.tides.qMoon);
});

test("compositionOverride null → falls back to density-derived", () => {
  const m = calcMoonExact({
    ...BASE,
    moon: { ...EARTH_MOON, compositionOverride: null },
  });
  assert.equal(m.tides.compositionClass, "Rocky");
});

// ── Calibrated composition classes ──

test("compositionOverride → Partially molten → μ=10 GPa, Q=10", () => {
  const m = calcMoonExact({
    ...BASE,
    moon: { ...EARTH_MOON, compositionOverride: "Partially molten" },
  });
  assert.equal(m.tides.compositionClass, "Partially molten");
  assert.equal(m.tides.qMoon, 10);
  approxEqual(m.tides.rigidityMoonGPa, 10, 0.01, "rigidity");
});

test("compositionOverride → Subsurface ocean → μ=0.3 GPa, Q=2", () => {
  const m = calcMoonExact({
    ...BASE,
    moon: { ...EARTH_MOON, compositionOverride: "Subsurface ocean" },
  });
  assert.equal(m.tides.compositionClass, "Subsurface ocean");
  assert.equal(m.tides.qMoon, 2);
  approxEqual(m.tides.rigidityMoonGPa, 0.3, 0.01, "rigidity");
});

test("compositionOverride → Io Partially molten → matches ~10^14 W", () => {
  const m = calcMoonExact({
    starMassMsol: 1,
    starAgeGyr: 4.6,
    moon: { ...IO_MOON, compositionOverride: "Partially molten" },
    parentOverride: JUPITER_OVERRIDE,
  });
  assert.ok(m.tides.tidalHeatingW > 5e13, `Io heating ${m.tides.tidalHeatingW} should be >5e13`);
  assert.ok(m.tides.tidalHeatingW < 2e14, `Io heating ${m.tides.tidalHeatingW} should be <2e14`);
});

test("compositionOverride → Enceladus Subsurface ocean → matches ~1.6e10 W", () => {
  const ENCELADUS_MOON = {
    massMoon: 0.001472,
    densityGcm3: 1.61,
    albedo: 0.81,
    semiMajorAxisKm: 238400,
    eccentricity: 0.0047,
    inclinationDeg: 0.019,
    compositionOverride: "Subsurface ocean",
  };
  const SATURN_OVERRIDE = {
    inputs: {
      massEarth: 95.16,
      semiMajorAxisAu: 9.5367,
      eccentricity: 0.0539,
      rotationPeriodHours: 10.656,
      cmfPct: 0,
    },
    derived: { densityGcm3: 0.6871, radiusEarth: 9.449, gravityG: 1.065 },
  };
  const m = calcMoonExact({
    starMassMsol: 1,
    starAgeGyr: 4.6,
    moon: ENCELADUS_MOON,
    parentOverride: SATURN_OVERRIDE,
  });
  assert.ok(
    m.tides.tidalHeatingW > 5e9,
    `Enceladus heating ${m.tides.tidalHeatingW} should be >5e9`,
  );
  assert.ok(
    m.tides.tidalHeatingW < 5e10,
    `Enceladus heating ${m.tides.tidalHeatingW} should be <5e10`,
  );
});
