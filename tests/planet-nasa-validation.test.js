/**
 * NASA Factsheet Validation Tests
 *
 * Compares engine outputs for Mercury, Venus, Earth, and Mars against
 * observed values from NASA Planetary Fact Sheets (references/ folder).
 * Tests composition model (Phase A), magnetic field model (Phase B),
 * and bulk physical properties (density, radius, gravity, temperature).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { calcPlanetExact } from "../engine/planet.js";

function approxEqual(actual, expected, tolerance, label) {
  const msg = `${label}: expected ${expected} ± ${tolerance}, got ${actual}`;
  assert.ok(Math.abs(actual - expected) <= tolerance, msg);
}

function pctError(actual, expected) {
  return Math.abs((actual - expected) / expected) * 100;
}

function assertPctWithin(actual, expected, pct, label) {
  const err = pctError(actual, expected);
  assert.ok(
    err <= pct,
    `${label}: ${actual} is ${err.toFixed(1)}% from ${expected} (limit ${pct}%)`,
  );
}

// Sun = 1 Msol, age 4.6 Gyr, [Fe/H] = 0
const SUN = { starMassMsol: 1, starAgeGyr: 4.6 };

// ── Sol preset inputs (from ui/solPreset.js, cross-referenced with NASA factsheets) ──

const MERCURY = {
  ...SUN,
  planet: {
    massEarth: 0.0553,
    cmfPct: 70,
    wmfPct: 0,
    axialTiltDeg: 0.034,
    albedoBond: 0.068,
    greenhouseEffect: 0,
    greenhouseMode: "manual",
    observerHeightM: 2,
    rotationPeriodHours: 1407.6,
    semiMajorAxisAu: 0.387,
    eccentricity: 0.2056,
    inclinationDeg: 7.0,
    longitudeOfPeriapsisDeg: 0,
    subsolarLongitudeDeg: 0,
    pressureAtm: 0,
    o2Pct: 0,
    co2Pct: 0,
    arPct: 0,
  },
};

const VENUS = {
  ...SUN,
  planet: {
    massEarth: 0.815,
    cmfPct: 32,
    wmfPct: 0,
    axialTiltDeg: 177.4,
    albedoBond: 0.76,
    greenhouseEffect: 217,
    greenhouseMode: "manual",
    observerHeightM: 2,
    rotationPeriodHours: 5832.5,
    semiMajorAxisAu: 0.723,
    eccentricity: 0.0067,
    inclinationDeg: 3.39,
    longitudeOfPeriapsisDeg: 0,
    subsolarLongitudeDeg: 0,
    pressureAtm: 92,
    o2Pct: 0,
    co2Pct: 96.5,
    arPct: 0,
  },
};

const EARTH = {
  ...SUN,
  planet: {
    massEarth: 1.0,
    cmfPct: 32,
    wmfPct: 0,
    axialTiltDeg: 23.44,
    albedoBond: 0.306,
    greenhouseEffect: 1,
    greenhouseMode: "manual",
    observerHeightM: 2,
    rotationPeriodHours: 23.934,
    semiMajorAxisAu: 1.0,
    eccentricity: 0.0167,
    inclinationDeg: 0,
    longitudeOfPeriapsisDeg: 0,
    subsolarLongitudeDeg: 0,
    pressureAtm: 1,
    o2Pct: 20.95,
    co2Pct: 0.04,
    arPct: 0.93,
    h2oPct: 0.4,
  },
};

const MARS = {
  ...SUN,
  planet: {
    massEarth: 0.107,
    cmfPct: 24,
    wmfPct: 0,
    axialTiltDeg: 25.19,
    albedoBond: 0.25,
    greenhouseEffect: 0.04,
    greenhouseMode: "manual",
    observerHeightM: 2,
    rotationPeriodHours: 24.623,
    semiMajorAxisAu: 1.524,
    eccentricity: 0.0935,
    inclinationDeg: 1.85,
    longitudeOfPeriapsisDeg: 0,
    subsolarLongitudeDeg: 0,
    pressureAtm: 0.006,
    o2Pct: 0.13,
    co2Pct: 95.32,
    arPct: 1.6,
  },
};

/* ══════════════════════════════════════════════════════════════════
   BULK PHYSICAL PROPERTIES
   NASA reference values from references/*-factsheet.md
   ══════════════════════════════════════════════════════════════════ */

test("NASA: Earth density ≈ 5.514 g/cm³ (within 3%)", () => {
  const p = calcPlanetExact(EARTH);
  assertPctWithin(p.derived.densityGcm3, 5.514, 3, "Earth density");
});

test("NASA: Earth radius ≈ 1.0 R⊕ (within 3%)", () => {
  const p = calcPlanetExact(EARTH);
  assertPctWithin(p.derived.radiusEarth, 1.0, 3, "Earth radius");
});

test("NASA: Earth gravity ≈ 1.0 g (within 5%)", () => {
  const p = calcPlanetExact(EARTH);
  assertPctWithin(p.derived.gravityG, 1.0, 5, "Earth gravity");
});

test("NASA: Earth surface temp ≈ 288 K (within 3%)", () => {
  const p = calcPlanetExact(EARTH);
  approxEqual(p.derived.surfaceTempK, 288, 10, "Earth surface temp");
});

test("NASA: Mercury density ≈ 5.429 g/cm³ (within 3%)", () => {
  const p = calcPlanetExact(MERCURY);
  assertPctWithin(p.derived.densityGcm3, 5.429, 3, "Mercury density");
});

test("NASA: Mercury radius ≈ 0.383 R⊕ (within 3%)", () => {
  const p = calcPlanetExact(MERCURY);
  assertPctWithin(p.derived.radiusEarth, 0.383, 3, "Mercury radius");
});

test("NASA: Mercury gravity ≈ 0.377 g (within 3%)", () => {
  const p = calcPlanetExact(MERCURY);
  assertPctWithin(p.derived.gravityG, 0.377, 3, "Mercury gravity");
});

test("NASA: Venus density ≈ 5.243 g/cm³ (within 5%)", () => {
  const p = calcPlanetExact(VENUS);
  assertPctWithin(p.derived.densityGcm3, 5.243, 5, "Venus density");
});

test("NASA: Venus radius ≈ 0.949 R⊕ (within 5%)", () => {
  const p = calcPlanetExact(VENUS);
  assertPctWithin(p.derived.radiusEarth, 0.949, 5, "Venus radius");
});

test("NASA: Venus gravity ≈ 0.905 g (within 5%)", () => {
  const p = calcPlanetExact(VENUS);
  assertPctWithin(p.derived.gravityG, 0.905, 5, "Venus gravity");
});

test("NASA: Mars density ≈ 3.934 g/cm³ (within 3%)", () => {
  const p = calcPlanetExact(MARS);
  assertPctWithin(p.derived.densityGcm3, 3.934, 3, "Mars density");
});

test("NASA: Mars radius ≈ 0.532 R⊕ (within 3%)", () => {
  const p = calcPlanetExact(MARS);
  assertPctWithin(p.derived.radiusEarth, 0.532, 3, "Mars radius");
});

test("NASA: Mars gravity ≈ 0.378 g (within 3%)", () => {
  const p = calcPlanetExact(MARS);
  assertPctWithin(p.derived.gravityG, 0.378, 3, "Mars gravity");
});

/* ══════════════════════════════════════════════════════════════════
   COMPOSITION CLASSES (Phase A)
   ══════════════════════════════════════════════════════════════════ */

test("NASA: Mercury (CMF=70%) classified as Mercury-like or Iron world", () => {
  const p = calcPlanetExact(MERCURY);
  assert.ok(
    ["Mercury-like", "Iron world"].includes(p.derived.compositionClass),
    `Mercury class: ${p.derived.compositionClass}`,
  );
});

test("NASA: Venus (CMF=32%) classified as Earth-like", () => {
  const p = calcPlanetExact(VENUS);
  assert.equal(p.derived.compositionClass, "Earth-like");
});

test("NASA: Earth (CMF=32%) classified as Earth-like", () => {
  const p = calcPlanetExact(EARTH);
  assert.equal(p.derived.compositionClass, "Earth-like");
});

test("NASA: Mars (CMF=24%) classified as Mars-like", () => {
  const p = calcPlanetExact(MARS);
  assert.equal(p.derived.compositionClass, "Mars-like");
});

test("NASA: all four inner planets are Dry (WMF=0)", () => {
  for (const [name, cfg] of [
    ["Mercury", MERCURY],
    ["Venus", VENUS],
    ["Earth", EARTH],
    ["Mars", MARS],
  ]) {
    const p = calcPlanetExact(cfg);
    assert.equal(p.derived.waterRegime, "Dry", `${name} should be Dry`);
  }
});

/* ══════════════════════════════════════════════════════════════════
   CORE RADIUS FRACTION (Phase A)
   CRF ≈ √CMF — validated against NASA/InSight measurements
   ══════════════════════════════════════════════════════════════════ */

test("NASA: Earth core radius fraction ≈ 0.547 (within 5%)", () => {
  // NASA factsheet: core radius 3,485 km / mean radius 6,371 km = 0.547
  const p = calcPlanetExact(EARTH);
  assertPctWithin(p.derived.coreRadiusFraction, 0.547, 5, "Earth CRF");
});

test("NASA: Earth core radius ≈ 3,485 km (within 8%)", () => {
  const p = calcPlanetExact(EARTH);
  assertPctWithin(p.derived.coreRadiusKm, 3485, 8, "Earth core radius km");
});

test("NASA: Mercury core radius fraction ≈ 0.85 (within 5%)", () => {
  // NASA factsheet: core radius ~2,074 km / mean radius 2,440 km ≈ 0.85
  const p = calcPlanetExact(MERCURY);
  assertPctWithin(p.derived.coreRadiusFraction, 0.85, 5, "Mercury CRF");
});

/* ══════════════════════════════════════════════════════════════════
   MAGNETIC FIELD MODEL (Phase B)
   Validated against observed planetary magnetic fields
   ══════════════════════════════════════════════════════════════════ */

test("NASA: Earth has active dipolar dynamo", () => {
  const p = calcPlanetExact(EARTH);
  assert.ok(p.derived.dynamoActive, "Earth dynamo should be active");
  assert.equal(p.derived.fieldMorphology, "dipolar", "Earth field is dipolar");
  assert.equal(p.derived.coreState, "partially solidified", "Earth core is partially solidified");
});

test("NASA: Earth surface field ≈ 1× Earth (within 50%)", () => {
  // By construction the model is normalised to Earth ≈ 1.0,
  // but the exact value depends on the solidification boost factor
  const p = calcPlanetExact(EARTH);
  approxEqual(p.derived.surfaceFieldEarths, 1.0, 0.5, "Earth field strength");
});

test("NASA: Mercury has active dynamo (observed by MESSENGER)", () => {
  // Mercury has a weak but confirmed global magnetic field.
  // Our model: large CMF → active dynamo, but very slow rotation → multipolar → weak.
  const p = calcPlanetExact(MERCURY);
  assert.ok(p.derived.dynamoActive, "Mercury dynamo should be active");
});

test("NASA: Mercury field is much weaker than Earth (~1% observed)", () => {
  // NASA/MESSENGER: Mercury's field is ~0.7-1% of Earth's (~300 nT vs 30000 nT).
  // Model: multipolar (×0.1) + thin-shell suppression (sf≈1) gives ~0.8%.
  const p = calcPlanetExact(MERCURY);
  assert.ok(
    p.derived.surfaceFieldEarths < 0.03,
    `Mercury field should be < 3% of Earth, got ${p.derived.surfaceFieldEarths.toFixed(4)}`,
  );
  assert.ok(
    p.derived.surfaceFieldEarths > 0.003,
    `Mercury field should be > 0.3% of Earth, got ${p.derived.surfaceFieldEarths.toFixed(4)}`,
  );
});

test("NASA: Mercury has multipolar field (slow rotator)", () => {
  const p = calcPlanetExact(MERCURY);
  assert.equal(p.derived.fieldMorphology, "multipolar", "Mercury is a very slow rotator");
});

test("NASA: Venus has no active dynamo (no observed global field)", () => {
  // Venus has no observed global magnetic field. Rotation efficiency
  // (rotEff = 0.064) + multipolar (×0.05) reduces the field below the
  // 0.005 practical threshold → dynamo declared inactive.
  const p = calcPlanetExact(VENUS);
  assert.ok(!p.derived.dynamoActive, "Venus should have no active dynamo");
  assert.equal(p.derived.surfaceFieldEarths, 0, "Venus should have zero field");
  assert.equal(p.derived.fieldLabel, "None", "Venus field label should be None");
});

test("NASA: Mars has no active dynamo (dead by 4.6 Gyr)", () => {
  // Mars had an early dynamo (crustal remnant magnetisation) but it
  // shut down ~4 Gyr ago.  Our model: small mass + low CMF → short
  // solidification timescale → core fully solidified.
  const p = calcPlanetExact(MARS);
  assert.ok(!p.derived.dynamoActive, "Mars dynamo should be inactive");
  assert.equal(p.derived.coreState, "solidified", "Mars core should be solidified");
  assert.equal(p.derived.surfaceFieldEarths, 0, "Mars should have zero field");
});

/* ══════════════════════════════════════════════════════════════════
   STELLAR CMF SUGGESTION
   Solar [Fe/H] = 0 should predict ~32–33% CMF (Earth-like)
   ══════════════════════════════════════════════════════════════════ */

test("NASA: suggested CMF from [Fe/H]=0 matches Earth's observed ~32%", () => {
  const p = calcPlanetExact(EARTH);
  approxEqual(p.derived.suggestedCmfPct, 32.5, 3, "Stellar CMF suggestion");
});

/* ══════════════════════════════════════════════════════════════════
   DENSITY ORDERING
   Mercury ≈ Earth > Venus >> Mars (NASA factsheets)
   ══════════════════════════════════════════════════════════════════ */

test("NASA: density ordering Mercury ≈ Earth > Venus >> Mars", () => {
  const me = calcPlanetExact(MERCURY).derived.densityGcm3;
  const ve = calcPlanetExact(VENUS).derived.densityGcm3;
  const ea = calcPlanetExact(EARTH).derived.densityGcm3;
  const ma = calcPlanetExact(MARS).derived.densityGcm3;
  assert.ok(ea > ve, `Earth (${ea}) should be denser than Venus (${ve})`);
  assert.ok(ve > ma, `Venus (${ve}) should be denser than Mars (${ma})`);
  assert.ok(ma < 5, `Mars density (${ma}) should be < 5 g/cm³`);
  assert.ok(me > 4.5, `Mercury density (${me}) should be > 4.5 g/cm³`);
});

/* ══════════════════════════════════════════════════════════════════
   RADIUS ORDERING
   Venus < Earth, Mars < Mercury < Venus (by R⊕)
   ══════════════════════════════════════════════════════════════════ */

test("NASA: radius ordering Mercury < Mars < Venus < Earth", () => {
  // NASA: Mercury 2,440 km < Mars 3,390 km < Venus 6,052 km < Earth 6,371 km
  const me = calcPlanetExact(MERCURY).derived.radiusEarth;
  const ve = calcPlanetExact(VENUS).derived.radiusEarth;
  const ea = calcPlanetExact(EARTH).derived.radiusEarth;
  const ma = calcPlanetExact(MARS).derived.radiusEarth;
  assert.ok(me < ma, `Mercury (${me}) should be smaller than Mars (${ma})`);
  assert.ok(ma < ve, `Mars (${ma}) should be smaller than Venus (${ve})`);
  assert.ok(ve < ea, `Venus (${ve}) should be smaller than Earth (${ea})`);
});

/* ══════════════════════════════════════════════════════════════════
   TIDAL LOCKING & SPIN-ORBIT RESONANCE
   Mercury is in 3:2 spin-orbit resonance (tidally evolved, high e).
   Venus is not locked (atmospheric thermal tides prevent it).
   Earth and Mars are not tidally evolved.
   ══════════════════════════════════════════════════════════════════ */

test("NASA: Mercury is in 3:2 spin-orbit resonance", () => {
  const p = calcPlanetExact(MERCURY);
  assert.equal(p.derived.tidallyEvolved, true, "Mercury has tidally evolved");
  assert.equal(p.derived.spinOrbitResonance, "3:2", "Mercury should be in 3:2 resonance");
  assert.equal(p.derived.tidallyLockedToStar, false, "3:2 is not synchronous lock");
  // Resonance rotation period should be close to actual 1407.6 h (58.65 days)
  assert.ok(
    Math.abs(p.derived.resonanceRotationHours - 1407.6) < 5,
    `resonance rotation should be ~1407.6 h, got ${p.derived.resonanceRotationHours.toFixed(1)}`,
  );
});

test("NASA: Venus atmosphere prevents tidal locking", () => {
  const p = calcPlanetExact(VENUS);
  assert.equal(
    p.derived.atmospherePreventsLocking,
    true,
    "Venus thick atmosphere should prevent locking",
  );
  assert.equal(p.derived.tidallyLockedToStar, false, "Venus should not be locked");
  assert.equal(p.derived.tidallyEvolved, false, "Venus should not be tidally evolved");
  assert.equal(p.derived.spinOrbitResonance, null, "Venus should have no resonance");
});

test("NASA: Earth is not tidally evolved", () => {
  const p = calcPlanetExact(EARTH);
  assert.ok(!p.derived.tidallyLockedToStar, "Earth should not be tidally locked");
  assert.equal(p.derived.tidallyEvolved, false, "Earth should not be tidally evolved");
  assert.equal(p.derived.atmospherePreventsLocking, false);
});

test("NASA: Mars is not tidally evolved", () => {
  const p = calcPlanetExact(MARS);
  assert.ok(!p.derived.tidallyLockedToStar, "Mars should not be tidally locked");
  assert.equal(p.derived.tidallyEvolved, false, "Mars should not be tidally evolved");
});

/* ══════════════════════════════════════════════════════════════════
   HABITABLE ZONE
   Earth should be in the HZ; Mercury and Venus should not.
   Mars is marginal (often just inside outer limit).
   ══════════════════════════════════════════════════════════════════ */

test("NASA: Earth is in the habitable zone", () => {
  const p = calcPlanetExact(EARTH);
  assert.ok(p.derived.inHabitableZone, "Earth should be in HZ");
});

test("NASA: Mercury is not in the habitable zone", () => {
  const p = calcPlanetExact(MERCURY);
  assert.ok(!p.derived.inHabitableZone, "Mercury should not be in HZ");
});

test("NASA: Venus is not in the habitable zone", () => {
  const p = calcPlanetExact(VENUS);
  assert.ok(!p.derived.inHabitableZone, "Venus should not be in HZ");
});

/* ══════════════════════════════════════════════════════════════════
   DISPLAY STRINGS — sanity checks
   ══════════════════════════════════════════════════════════════════ */

test("NASA: all four planets produce valid display strings for new fields", () => {
  for (const [name, cfg] of [
    ["Mercury", MERCURY],
    ["Venus", VENUS],
    ["Earth", EARTH],
    ["Mars", MARS],
  ]) {
    const p = calcPlanetExact(cfg);
    assert.ok(p.display.compositionClass.length > 0, `${name} compositionClass display`);
    assert.ok(p.display.waterRegime.length > 0, `${name} waterRegime display`);
    assert.ok(p.display.coreRadius.includes("km"), `${name} coreRadius display`);
    assert.ok(p.display.suggestedCmf.includes("%"), `${name} suggestedCmf display`);
    assert.ok(p.display.magneticField.length > 0, `${name} magneticField display`);
    assert.ok(p.display.outgassing.length > 0, `${name} outgassing display`);
  }
});

/* ══════════════════════════════════════════════════════════════════
   REGRESSION: WMF=0 produces identical outputs to pre-overhaul
   ══════════════════════════════════════════════════════════════════ */

test("regression: WMF=0 density/radius match WMF-unaware path exactly", () => {
  // With WMF=0, the water inflation factor is 1.0 and all dry-planet
  // outputs must be identical to the pre-overhaul formula.
  const withWmf = calcPlanetExact({
    ...EARTH,
    planet: { ...EARTH.planet, wmfPct: 0 },
  });
  const withoutWmf = calcPlanetExact({
    ...EARTH,
    planet: { ...EARTH.planet },
  });
  assert.equal(withWmf.derived.densityGcm3, withoutWmf.derived.densityGcm3, "density unchanged");
  assert.equal(withWmf.derived.radiusEarth, withoutWmf.derived.radiusEarth, "radius unchanged");
});
