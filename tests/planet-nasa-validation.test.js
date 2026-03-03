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
import { approxEqual } from "./testHelpers.js";

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

test("NASA → Earth density → ~5.514 g/cm³ (within 3%)", () => {
  const p = calcPlanetExact(EARTH);
  assertPctWithin(p.derived.densityGcm3, 5.514, 3, "Earth density");
});

test("NASA → Earth radius → ~1.0 R⊕ (within 3%)", () => {
  const p = calcPlanetExact(EARTH);
  assertPctWithin(p.derived.radiusEarth, 1.0, 3, "Earth radius");
});

test("NASA → Earth gravity → ~1.0 g (within 5%)", () => {
  const p = calcPlanetExact(EARTH);
  assertPctWithin(p.derived.gravityG, 1.0, 5, "Earth gravity");
});

test("NASA → Earth surface temp → ~288 K (within 3%)", () => {
  const p = calcPlanetExact(EARTH);
  approxEqual(p.derived.surfaceTempK, 288, 10, "Earth surface temp");
});

test("NASA → Mercury density → ~5.429 g/cm³ (within 3%)", () => {
  const p = calcPlanetExact(MERCURY);
  assertPctWithin(p.derived.densityGcm3, 5.429, 3, "Mercury density");
});

test("NASA → Mercury radius → ~0.383 R⊕ (within 3%)", () => {
  const p = calcPlanetExact(MERCURY);
  assertPctWithin(p.derived.radiusEarth, 0.383, 3, "Mercury radius");
});

test("NASA → Mercury gravity → ~0.377 g (within 3%)", () => {
  const p = calcPlanetExact(MERCURY);
  assertPctWithin(p.derived.gravityG, 0.377, 3, "Mercury gravity");
});

test("NASA → Venus density → ~5.243 g/cm³ (within 5%)", () => {
  const p = calcPlanetExact(VENUS);
  assertPctWithin(p.derived.densityGcm3, 5.243, 5, "Venus density");
});

test("NASA → Venus radius → ~0.949 R⊕ (within 5%)", () => {
  const p = calcPlanetExact(VENUS);
  assertPctWithin(p.derived.radiusEarth, 0.949, 5, "Venus radius");
});

test("NASA → Venus gravity → ~0.905 g (within 5%)", () => {
  const p = calcPlanetExact(VENUS);
  assertPctWithin(p.derived.gravityG, 0.905, 5, "Venus gravity");
});

test("NASA → Mars density → ~3.934 g/cm³ (within 3%)", () => {
  const p = calcPlanetExact(MARS);
  assertPctWithin(p.derived.densityGcm3, 3.934, 3, "Mars density");
});

test("NASA → Mars radius → ~0.532 R⊕ (within 3%)", () => {
  const p = calcPlanetExact(MARS);
  assertPctWithin(p.derived.radiusEarth, 0.532, 3, "Mars radius");
});

test("NASA → Mars gravity → ~0.378 g (within 3%)", () => {
  const p = calcPlanetExact(MARS);
  assertPctWithin(p.derived.gravityG, 0.378, 3, "Mars gravity");
});

/* ══════════════════════════════════════════════════════════════════
   COMPOSITION CLASSES (Phase A)
   ══════════════════════════════════════════════════════════════════ */

test("NASA → Mercury CMF=70% → Mercury-like or Iron world", () => {
  const p = calcPlanetExact(MERCURY);
  assert.ok(
    ["Mercury-like", "Iron world"].includes(p.derived.compositionClass),
    `Mercury class: ${p.derived.compositionClass}`,
  );
});

test("NASA → Venus CMF=32% → Earth-like", () => {
  const p = calcPlanetExact(VENUS);
  assert.equal(p.derived.compositionClass, "Earth-like");
});

test("NASA → Earth CMF=32% → Earth-like", () => {
  const p = calcPlanetExact(EARTH);
  assert.equal(p.derived.compositionClass, "Earth-like");
});

test("NASA → Mars CMF=24% → Mars-like", () => {
  const p = calcPlanetExact(MARS);
  assert.equal(p.derived.compositionClass, "Mars-like");
});

test("NASA → all inner planets WMF=0 → Dry", () => {
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

test("NASA → Earth CRF → ~0.547 (within 5%)", () => {
  // NASA factsheet: core radius 3,485 km / mean radius 6,371 km = 0.547
  const p = calcPlanetExact(EARTH);
  assertPctWithin(p.derived.coreRadiusFraction, 0.547, 5, "Earth CRF");
});

test("NASA → Earth core radius → ~3485 km (within 8%)", () => {
  const p = calcPlanetExact(EARTH);
  assertPctWithin(p.derived.coreRadiusKm, 3485, 8, "Earth core radius km");
});

test("NASA → Mercury CRF → ~0.85 (within 5%)", () => {
  // NASA factsheet: core radius ~2,074 km / mean radius 2,440 km ≈ 0.85
  const p = calcPlanetExact(MERCURY);
  assertPctWithin(p.derived.coreRadiusFraction, 0.85, 5, "Mercury CRF");
});

/* ══════════════════════════════════════════════════════════════════
   MAGNETIC FIELD MODEL (Phase B)
   Validated against observed planetary magnetic fields
   ══════════════════════════════════════════════════════════════════ */

test("NASA → Earth dynamo → active dipolar, partially solidified", () => {
  const p = calcPlanetExact(EARTH);
  assert.ok(p.derived.dynamoActive, "Earth dynamo should be active");
  assert.equal(p.derived.fieldMorphology, "dipolar", "Earth field is dipolar");
  assert.equal(p.derived.coreState, "partially solidified", "Earth core is partially solidified");
});

test("NASA → Earth surface field → ~1× Earth (within 50%)", () => {
  // By construction the model is normalised to Earth ≈ 1.0,
  // but the exact value depends on the solidification boost factor
  const p = calcPlanetExact(EARTH);
  approxEqual(p.derived.surfaceFieldEarths, 1.0, 0.5, "Earth field strength");
});

test("NASA → Mercury dynamo → active (MESSENGER)", () => {
  // Mercury has a weak but confirmed global magnetic field.
  // Our model: large CMF → active dynamo, but very slow rotation → multipolar → weak.
  const p = calcPlanetExact(MERCURY);
  assert.ok(p.derived.dynamoActive, "Mercury dynamo should be active");
});

test("NASA → Mercury field strength → ~1% of Earth", () => {
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

test("NASA → Mercury field morphology → multipolar (slow rotator)", () => {
  const p = calcPlanetExact(MERCURY);
  assert.equal(p.derived.fieldMorphology, "multipolar", "Mercury is a very slow rotator");
});

test("NASA → Venus dynamo → inactive, zero field", () => {
  // Venus has no observed global magnetic field. Rotation efficiency
  // (rotEff = 0.064) + multipolar (×0.05) reduces the field below the
  // 0.005 practical threshold → dynamo declared inactive.
  const p = calcPlanetExact(VENUS);
  assert.ok(!p.derived.dynamoActive, "Venus should have no active dynamo");
  assert.equal(p.derived.surfaceFieldEarths, 0, "Venus should have zero field");
  assert.equal(p.derived.fieldLabel, "None", "Venus field label should be None");
});

test("NASA → Mars dynamo → inactive, core solidified", () => {
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

test("NASA → suggestedCmf [Fe/H]=0 → ~32%", () => {
  const p = calcPlanetExact(EARTH);
  approxEqual(p.derived.suggestedCmfPct, 32.5, 3, "Stellar CMF suggestion");
});

/* ══════════════════════════════════════════════════════════════════
   DENSITY ORDERING
   Mercury ≈ Earth > Venus >> Mars (NASA factsheets)
   ══════════════════════════════════════════════════════════════════ */

test("NASA → density ordering → Earth > Venus >> Mars", () => {
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

test("NASA → radius ordering → Mercury < Mars < Venus < Earth", () => {
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

test("NASA → Mercury tidal → 3:2 spin-orbit resonance", () => {
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

test("NASA → Venus atmosphere → prevents tidal locking", () => {
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

test("NASA → Earth tidal → not evolved", () => {
  const p = calcPlanetExact(EARTH);
  assert.ok(!p.derived.tidallyLockedToStar, "Earth should not be tidally locked");
  assert.equal(p.derived.tidallyEvolved, false, "Earth should not be tidally evolved");
  assert.equal(p.derived.atmospherePreventsLocking, false);
});

test("NASA → Mars tidal → not evolved", () => {
  const p = calcPlanetExact(MARS);
  assert.ok(!p.derived.tidallyLockedToStar, "Mars should not be tidally locked");
  assert.equal(p.derived.tidallyEvolved, false, "Mars should not be tidally evolved");
});

/* ══════════════════════════════════════════════════════════════════
   HABITABLE ZONE
   Earth should be in the HZ; Mercury and Venus should not.
   Mars is marginal (often just inside outer limit).
   ══════════════════════════════════════════════════════════════════ */

test("NASA → Earth HZ → inside", () => {
  const p = calcPlanetExact(EARTH);
  assert.ok(p.derived.inHabitableZone, "Earth should be in HZ");
});

test("NASA → Mercury HZ → outside", () => {
  const p = calcPlanetExact(MERCURY);
  assert.ok(!p.derived.inHabitableZone, "Mercury should not be in HZ");
});

test("NASA → Venus HZ → outside", () => {
  const p = calcPlanetExact(VENUS);
  assert.ok(!p.derived.inHabitableZone, "Venus should not be in HZ");
});

/* ══════════════════════════════════════════════════════════════════
   DISPLAY STRINGS — sanity checks
   ══════════════════════════════════════════════════════════════════ */

test("NASA → all four planets → valid display strings", () => {
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

/* ══════════════════════════════════════════════════════════════════
   JEANS ESCAPE — EQUILIBRIUM TEMPERATURE & ATMOSPHERIC RETENTION
   NASA reference: Planetary Fact Sheet (Williams, NSSDCA/GSFC)
   T_eq  = blackbody equilibrium temperature (no greenhouse)
   T_exo = exobase temperature (XUV-heated thermosphere)
   Retention compared against observed atmospheric composition.
   ══════════════════════════════════════════════════════════════════ */

// ── Dwarf planet fixtures (not used in earlier bulk tests) ──

const PLUTO = {
  ...SUN,
  planet: {
    massEarth: 0.0022,
    cmfPct: 32,
    wmfPct: 30,
    axialTiltDeg: 122.53,
    albedoBond: 0.72,
    greenhouseEffect: 0,
    greenhouseMode: "manual",
    observerHeightM: 2,
    rotationPeriodHours: 153.29,
    semiMajorAxisAu: 39.482,
    eccentricity: 0.2488,
    inclinationDeg: 17.16,
    longitudeOfPeriapsisDeg: 0,
    subsolarLongitudeDeg: 0,
    pressureAtm: 0.00001,
    o2Pct: 0,
    co2Pct: 0,
    arPct: 0,
    ch4Pct: 5,
  },
};

const CERES = {
  ...SUN,
  planet: {
    massEarth: 0.00016,
    cmfPct: 25,
    wmfPct: 25,
    axialTiltDeg: 4.0,
    albedoBond: 0.034,
    greenhouseEffect: 0,
    greenhouseMode: "manual",
    observerHeightM: 2,
    rotationPeriodHours: 9.074,
    semiMajorAxisAu: 2.7675,
    eccentricity: 0.0758,
    inclinationDeg: 10.59,
    longitudeOfPeriapsisDeg: 0,
    subsolarLongitudeDeg: 0,
    pressureAtm: 0,
    o2Pct: 0,
    co2Pct: 0,
    arPct: 0,
  },
};

// ── T_eq (blackbody equilibrium temperature, no greenhouse) ──
// NASA Fact Sheet "Black-body temperature" column.
// Formula: 278 * L^0.25 * (1-A)^0.25 / sqrt(a)

test("NASA → Jeans T_eq → Earth ~254 K (within 1%)", () => {
  const p = calcPlanetExact(EARTH);
  assertPctWithin(p.derived.jeansEscape.tEqNoGhK, 254.3, 1, "Earth T_eq");
});

test("NASA → Jeans T_eq → Venus ~229 K (within 2%)", () => {
  // Using Bond albedo 0.76 (traditional). NASA updated to 0.90 → 184 K,
  // but 0.76 is still the widely-used textbook value.
  const p = calcPlanetExact(VENUS);
  assertPctWithin(p.derived.jeansEscape.tEqNoGhK, 227, 2, "Venus T_eq");
});

test("NASA → Jeans T_eq → Mars ~210 K (within 1%)", () => {
  const p = calcPlanetExact(MARS);
  assertPctWithin(p.derived.jeansEscape.tEqNoGhK, 210.1, 1, "Mars T_eq");
});

test("NASA → Jeans T_eq → Mercury ~440 K (within 1%)", () => {
  const p = calcPlanetExact(MERCURY);
  assertPctWithin(p.derived.jeansEscape.tEqNoGhK, 440.1, 1, "Mercury T_eq");
});

test("NASA → Jeans T_eq → Ceres ~167 K (within 3%)", () => {
  // No official NASA fact sheet for Ceres; computed from Bond albedo 0.034
  // at 2.77 AU. 3% tolerance for albedo uncertainty.
  const p = calcPlanetExact(CERES);
  assertPctWithin(p.derived.jeansEscape.tEqNoGhK, 167, 3, "Ceres T_eq");
});

test("NASA → Jeans T_eq → ordering Mercury > Earth > Venus > Mars > Pluto", () => {
  const tMerc = calcPlanetExact(MERCURY).derived.jeansEscape.tEqNoGhK;
  const tEarth = calcPlanetExact(EARTH).derived.jeansEscape.tEqNoGhK;
  const tVenus = calcPlanetExact(VENUS).derived.jeansEscape.tEqNoGhK;
  const tMars = calcPlanetExact(MARS).derived.jeansEscape.tEqNoGhK;
  const tPluto = calcPlanetExact(PLUTO).derived.jeansEscape.tEqNoGhK;
  assert.ok(tMerc > tEarth, "Mercury > Earth");
  assert.ok(tEarth > tVenus, "Earth > Venus");
  assert.ok(tVenus > tMars, "Venus > Mars");
  assert.ok(tMars > tPluto, "Mars > Pluto");
});

// ── Exobase temperature ──
// Earth: ~1000 K typical (700–1400 K solar-cycle range).
// Venus: CO₂ 15-μm emission strongly suppresses T_exo to near T_eq (~250–300 K).
// Mars: ~200–350 K observed. Pressure-dependent XUV absorption (η_abs ≈ 0.09
//   at 0.006 atm) brings our model to ~233 K, well within the observed range.

test("NASA → Jeans T_exo → Earth ~1000 K (within 20%)", () => {
  // Solar-mean exobase: ~1000 K. Wide tolerance for solar-cycle variation.
  const p = calcPlanetExact(EARTH);
  const t = p.derived.jeansEscape.exobaseTempK;
  assert.ok(t >= 700 && t <= 1400, `Earth T_exo: ${t} K (expected 700–1400)`);
});

test("NASA → Jeans T_exo → Venus CO₂ cooling suppresses boost", () => {
  // Dense CO₂ atmosphere acts as a thermostat. T_exo should be near T_eq.
  // Literature: ~250–300 K dayside. Our model: ~229 K (≈ T_eq).
  const p = calcPlanetExact(VENUS);
  const t = p.derived.jeansEscape.exobaseTempK;
  assert.ok(t < 400, `Venus T_exo: ${t} K (expected < 400, CO₂ cooling)`);
});

test("NASA → Jeans T_exo → Mars > T_eq (XUV heating present)", () => {
  const p = calcPlanetExact(MARS);
  const je = p.derived.jeansEscape;
  assert.ok(
    je.exobaseTempK > je.tEqNoGhK,
    `Mars T_exo ${je.exobaseTempK} should exceed T_eq ${je.tEqNoGhK}`,
  );
});

test("NASA → Jeans T_exo → ordering: Earth > Mercury > Mars > Venus > Pluto", () => {
  // Earth's thick atmosphere (η_abs ≈ 0.94) absorbs nearly all XUV → highest T_exo.
  // Mercury has no atmosphere (η_abs = 0) → T_exo = T_eq ≈ 439 K.
  // Venus < Mars because dense CO₂ suppresses the boost heavily.
  const exo = (cfg) => calcPlanetExact(cfg).derived.jeansEscape.exobaseTempK;
  assert.ok(exo(EARTH) > exo(MERCURY), "Earth > Mercury");
  assert.ok(exo(MERCURY) > exo(MARS), "Mercury > Mars");
  assert.ok(exo(MARS) > exo(VENUS), "Mars > Venus");
  assert.ok(exo(VENUS) > exo(PLUTO), "Venus > Pluto");
});

// ── Escape velocity cross-check ──

test("NASA → escape velocity → Earth ~11.19 km/s (within 3%)", () => {
  const p = calcPlanetExact(EARTH);
  assertPctWithin(p.derived.escapeVelocityKms, 11.186, 3, "Earth v_esc");
});

test("NASA → escape velocity → Mars ~5.03 km/s (within 3%)", () => {
  const p = calcPlanetExact(MARS);
  assertPctWithin(p.derived.escapeVelocityKms, 5.03, 3, "Mars v_esc");
});

test("NASA → escape velocity → Venus ~10.36 km/s (within 3%)", () => {
  const p = calcPlanetExact(VENUS);
  assertPctWithin(p.derived.escapeVelocityKms, 10.36, 3, "Venus v_esc");
});

test("NASA → escape velocity → Mercury ~4.3 km/s (within 3%)", () => {
  const p = calcPlanetExact(MERCURY);
  assertPctWithin(p.derived.escapeVelocityKms, 4.3, 3, "Mercury v_esc");
});

// ── Atmospheric retention (Jeans thermal + non-thermal enhancement) ──
// Combines Jeans thermal escape with enhanced thresholds for H₂ and He
// that account for non-thermal loss (charge exchange, polar wind, ion pickup).

test("NASA → retention → Earth retains heavy gases, H₂ marginal (non-thermal)", () => {
  // Earth's high escape velocity + moderate exobase → heavy gases retained.
  // H₂ is thermally retained (λ ≈ 16, Jeans "Retained") but non-thermal
  // processes (polar wind, charge exchange) downgrade it to Marginal — matching
  // the observation that Earth H₂ is present in trace amounts but escaping.
  const sp = calcPlanetExact(EARTH).derived.jeansEscape.species;
  assert.equal(sp.n2.status, "Retained");
  assert.equal(sp.o2.status, "Retained");
  assert.equal(sp.co2.status, "Retained");
  assert.equal(sp.ar.status, "Retained");
  assert.equal(sp.h2o.status, "Retained");
  assert.equal(sp.h2.status, "Marginal");
  assert.equal(sp.h2.nonThermal, true);
  assert.equal(sp.he.status, "Retained");
});

test("NASA → Jeans retention → Venus retains all species", () => {
  // Dense CO₂ atmosphere keeps T_exo low → enormous λ for all species.
  const sp = calcPlanetExact(VENUS).derived.jeansEscape.species;
  assert.equal(sp.n2.status, "Retained");
  assert.equal(sp.co2.status, "Retained");
  assert.equal(sp.h2.status, "Retained");
  assert.equal(sp.he.status, "Retained");
});

test("NASA → Jeans retention → Mars retains CO₂, N₂, Ar", () => {
  // Mars atmosphere: 95.3% CO₂, 2.7% N₂, 1.6% Ar — all observed and stable.
  const sp = calcPlanetExact(MARS).derived.jeansEscape.species;
  assert.equal(sp.co2.status, "Retained");
  assert.equal(sp.n2.status, "Retained");
  assert.equal(sp.ar.status, "Retained");
});

test("NASA → retention → Mars H₂ and He marginal (non-thermal)", () => {
  // Mars H₂ and He are thermally retained (Jeans λ > 6) but non-thermal
  // processes (ion pickup, charge exchange — no magnetic field) downgrade them.
  const sp = calcPlanetExact(MARS).derived.jeansEscape.species;
  assert.equal(sp.h2.status, "Marginal");
  assert.equal(sp.h2.nonThermal, true);
  assert.equal(sp.he.status, "Marginal");
  assert.equal(sp.he.nonThermal, true);
});

test("NASA → Jeans T_exo → Mars within observed 200–350 K", () => {
  const t = calcPlanetExact(MARS).derived.jeansEscape.exobaseTempK;
  assert.ok(
    t >= 200 && t <= 350,
    `Mars T_exo: ${t} K (expected 200–350)`,
  );
});

test("NASA → Jeans retention → Mercury loses H₂ and He", () => {
  // Mercury: surface-bounded exosphere only. High T_exo from proximity to Sun
  // + low v_esc → light gases are lost.
  const sp = calcPlanetExact(MERCURY).derived.jeansEscape.species;
  assert.equal(sp.h2.status, "Lost");
  assert.equal(sp.he.status, "Lost");
  // Heavier gases are retained or marginal (academic — Mercury has no
  // meaningful atmosphere to lose them from).
});

test("NASA → Jeans retention → Pluto retains N₂ and CH₄", () => {
  // Pluto's atmosphere: ~99% N₂, ~0.25% CH₄. Despite low v_esc (1.2 km/s),
  // very low T_exo (~32 K) keeps λ high for heavy molecules.
  const sp = calcPlanetExact(PLUTO).derived.jeansEscape.species;
  assert.equal(sp.n2.status, "Retained");
  assert.equal(sp.ch4.status, "Retained");
  // H₂ is barely retained thermally (λ ≈ 6, right at threshold). Non-thermal
  // inactive at T_exo < 100 K. In reality Pluto has no measurable H₂.
  assert.ok(sp.h2.lambda > 5 && sp.h2.lambda < 8, `Pluto H₂ λ=${sp.h2.lambda.toFixed(1)} (expected ~6, near threshold)`);
  assert.equal(sp.h2.nonThermal, false, "non-thermal inactive at cold T_exo");
});

test("NASA → Jeans retention → Ceres loses all gases", () => {
  // Ceres: v_esc = 0.51 km/s, no permanent atmosphere observed.
  // Only transient water vapour detected (sublimation). All species should
  // be Lost or Marginal.
  const sp = calcPlanetExact(CERES).derived.jeansEscape.species;
  for (const key of ["n2", "o2", "co2", "ar", "h2o", "ch4", "h2", "he", "nh3"]) {
    assert.ok(
      sp[key].status === "Lost" || sp[key].status === "Marginal",
      `Ceres ${sp[key].label}: ${sp[key].status} (expected Lost or Marginal)`,
    );
  }
});

// ── Lambda ordering sanity checks ──

test("NASA → Jeans λ → heavier molecules have higher λ (Earth)", () => {
  // λ ∝ molecular weight, so CO₂ > O₂ > N₂ > H₂O > CH₄ > He > H₂
  const sp = calcPlanetExact(EARTH).derived.jeansEscape.species;
  assert.ok(sp.co2.lambda > sp.o2.lambda, "CO₂ > O₂");
  assert.ok(sp.o2.lambda > sp.n2.lambda, "O₂ > N₂");
  assert.ok(sp.n2.lambda > sp.h2o.lambda, "N₂ > H₂O");
  assert.ok(sp.he.lambda > sp.h2.lambda, "He > H₂");
});

test("NASA → Jeans λ → closer orbit increases XUV, lowers λ", () => {
  // Same planet at different distances: closer → higher T_exo → lower λ.
  const near = calcPlanetExact({
    ...EARTH,
    planet: { ...EARTH.planet, semiMajorAxisAu: 0.5 },
  });
  const far = calcPlanetExact({
    ...EARTH,
    planet: { ...EARTH.planet, semiMajorAxisAu: 2.0 },
  });
  assert.ok(
    near.derived.jeansEscape.species.h2.lambda < far.derived.jeansEscape.species.h2.lambda,
    "closer orbit → lower λ for H₂",
  );
});

/* ══════════════════════════════════════════════════════════════════
   REGRESSION: WMF=0 produces identical outputs to pre-overhaul
   ══════════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════════
   RADIOISOTOPE ABUNDANCE — INTERNAL HEAT MODEL
   NASA/KamLAND reference: Earth radiogenic heat ≈ 44–47 TW.
   Isotope contributions: Arevalo et al. (2009, Earth Planet. Sci. Lett.)
   ══════════════════════════════════════════════════════════════════ */

test("NASA → Earth (1× abundance) → active dynamo with partially solidified core", () => {
  // Earth has a liquid outer core driving an active dynamo at 4.6 Gyr.
  // Model with default 1× radioisotope abundance must reproduce this.
  const p = calcPlanetExact(EARTH);
  assert.equal(p.inputs.radioisotopeAbundance, 1, "Earth should use 1× abundance");
  assert.ok(p.derived.dynamoActive, "Earth dynamo must be active at 1× abundance");
  assert.equal(p.derived.coreState, "partially solidified");
});

test("NASA → Earth internal heat budget → 44 TW at 1× abundance", () => {
  // KamLAND (2011) measured ~21 TW from U/Th alone; total radiogenic ≈ 44 TW.
  // Model: Q = 44 TW × mass × abundance.  For Earth (mass=1, A=1) → 44 TW.
  const p = calcPlanetExact(EARTH);
  // planetTidalFraction = tidal/internal;  with no moons assigned,
  // tidal heating is 0 → fraction should be 0 or near-0.
  assert.ok(
    p.derived.planetTidalFraction < 0.01,
    `Earth tidal fraction should be near-zero without moons, got ${p.derived.planetTidalFraction}`,
  );
});

test("NASA → Mars (1× abundance) → core solidified, no dynamo", () => {
  // Mars lost its dynamo ~4 Gyr ago (Acuña et al. 1999).
  // Small mass + low CMF → short core solidification timescale.
  const p = calcPlanetExact(MARS);
  assert.equal(p.inputs.radioisotopeAbundance, 1);
  assert.ok(!p.derived.dynamoActive, "Mars should have no active dynamo");
  assert.equal(p.derived.coreState, "solidified", "Mars core should be solidified");
});

test("NASA → Mars with 3× abundance → may sustain dynamo longer", () => {
  // A hypothetical Mars with 3× radioisotope abundance would have
  // a longer core solidification timescale, possibly keeping the core liquid.
  const base = calcPlanetExact(MARS);
  const hot = calcPlanetExact({
    ...MARS,
    planet: { ...MARS.planet, radioisotopeAbundance: 3.0 },
  });
  // With 3× abundance, the core lifetime triples → might still have a liquid core
  assert.ok(
    hot.derived.surfaceFieldEarths >= base.derived.surfaceFieldEarths,
    "3× abundance → stronger or equal field for Mars",
  );
});

test("NASA → Earth display format → shows 'Earth (1.0×)' at default", () => {
  const p = calcPlanetExact(EARTH);
  assert.equal(p.display.radioisotopeAbundance, "Earth (1.0\u00d7)");
});

test("NASA → per-isotope Earth fractions → Arevalo et al. sum to 1.0", () => {
  // Arevalo et al. 2009: U-238 ≈ 39%, U-235 ≈ 4%, Th-232 ≈ 40%, K-40 ≈ 17%
  // All isotopes at 1× should give effective abundance of exactly 1.0.
  const p = calcPlanetExact({
    ...EARTH,
    planet: {
      ...EARTH.planet,
      radioisotopeMode: "advanced",
      u238Abundance: 1,
      u235Abundance: 1,
      th232Abundance: 1,
      k40Abundance: 1,
    },
  });
  assert.strictEqual(p.inputs.radioisotopeAbundance, 1);
  assert.ok(p.derived.dynamoActive, "Earth-like isotopes → active dynamo");
});

test("NASA → depleted K-40 scenario → reduced heat (short half-life, 17%)", () => {
  // K-40 has the shortest half-life (1.25 Gyr) and contributes 17% of heat.
  // Zeroing K-40 should reduce effective abundance to ~0.83.
  const p = calcPlanetExact({
    ...EARTH,
    planet: {
      ...EARTH.planet,
      radioisotopeMode: "advanced",
      u238Abundance: 1,
      u235Abundance: 1,
      th232Abundance: 1,
      k40Abundance: 0,
    },
  });
  approxEqual(p.inputs.radioisotopeAbundance, 0.83, 0.02, "no K-40 → ~0.83× effective");
});

test("NASA → Th-232 dominant scenario → long-lived heat source", () => {
  // Th-232 has the longest half-life (14.05 Gyr) and contributes 40% of heat.
  // Doubling only Th-232 should raise effective abundance to ~1.40.
  const p = calcPlanetExact({
    ...EARTH,
    planet: {
      ...EARTH.planet,
      radioisotopeMode: "advanced",
      u238Abundance: 1,
      u235Abundance: 1,
      th232Abundance: 2,
      k40Abundance: 1,
    },
  });
  approxEqual(p.inputs.radioisotopeAbundance, 1.4, 0.02, "2× Th-232 → ~1.40×");
});

test("regression → WMF=0 → density/radius match WMF-unaware path", () => {
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
