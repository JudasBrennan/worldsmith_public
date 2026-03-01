import test from "node:test";
import assert from "node:assert/strict";

import { calcPlanetExact, tectonicProbabilities } from "../engine/planet.js";
import { approxEqual } from "./testHelpers.js";

const EARTH_LIKE = {
  starMassMsol: 1,
  starAgeGyr: 4.6,
  planet: {
    massEarth: 1,
    cmfPct: 33,
    axialTiltDeg: 23.4,
    albedoBond: 0.3,
    greenhouseEffect: 1, // spreadsheet unit: 1 ≈ Earth's greenhouse (gives ~287 K)
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
};

test("surfaceTempK → Earth-like → 280–300 K", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  assert.ok(p.derived.surfaceTempK >= 280, "surface temp should be >= 280 K");
  assert.ok(p.derived.surfaceTempK <= 300, "surface temp should be <= 300 K");
});

test("densityGcm3 → Earth-like → ~5.5 g/cm³", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  approxEqual(p.derived.densityGcm3, 5.51, 0.1, "Earth density");
});

test("radiusEarth → Earth-like → ~1.0 R⊕", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  approxEqual(p.derived.radiusEarth, 1.0, 0.05, "Earth radius");
});

test("gravityG → Earth-like → ~1.0 g", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  approxEqual(p.derived.gravityG, 1.0, 0.1, "Earth gravity");
});

test("orbitalDirection → inclination < 90° → Prograde", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  assert.equal(p.derived.orbitalDirection, "Prograde");
});

test("orbitalDirection → inclination > 90° → Retrograde", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, inclinationDeg: 120 },
  });
  assert.equal(p.derived.orbitalDirection, "Retrograde");
});

test("orbitalDirection → inclination = 90° → Undefined", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, inclinationDeg: 90 },
  });
  assert.equal(p.derived.orbitalDirection, "Undefined");
});

test("orbitalPeriod → 4 AU vs 1 AU → ratio ~8 (Kepler third law)", () => {
  const p1 = calcPlanetExact(EARTH_LIKE);
  const p4 = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, semiMajorAxisAu: 4 },
  });
  // T ∝ a^1.5  =>  T(4AU) / T(1AU) ≈ 4^1.5 = 8
  const ratio = p4.derived.orbitalPeriodEarthDays / p1.derived.orbitalPeriodEarthDays;
  approxEqual(ratio, 8, 0.01, "Kepler T ratio");
});

test("n2Pct → gas totals exceed 100% → clamped to zero", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, o2Pct: 60, co2Pct: 30, arPct: 20 },
  });
  assert.equal(p.derived.n2Pct, 0);
  assert.equal(p.derived.gasMixClamped, true);
});

test("circulationCellCount → slow vs fast rotation → 1 vs 7", () => {
  const slow = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, rotationPeriodHours: 100 },
  });
  const fast = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, rotationPeriodHours: 4 },
  });
  assert.equal(slow.derived.circulationCellCount, "1");
  assert.equal(fast.derived.circulationCellCount, "7");
});

test("skyColourHex → Earth-like → valid hex strings", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  assert.match(p.derived.skyColourDayHex, /^#[0-9a-f]{6}$/);
  assert.match(p.derived.skyColourHorizonHex, /^#[0-9a-f]{6}$/);
});

test("circulationCellCount → P < 3 h → 5 cells", () => {
  const veryFast = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, rotationPeriodHours: 2 },
  });
  assert.equal(veryFast.derived.circulationCellCount, "5");
  assert.equal(veryFast.derived.circulationCellRanges.length, 5);
});

test("circulationCellCount → P = 24 h → 3 cells", () => {
  const moderate = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, rotationPeriodHours: 24 },
  });
  assert.equal(moderate.derived.circulationCellCount, "3");
});

// --- New derived properties ---

test("inHabitableZone → Earth-like → true", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  assert.equal(p.derived.inHabitableZone, true);
});

test("inHabitableZone → 50 AU → false", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, semiMajorAxisAu: 50 },
  });
  assert.equal(p.derived.inHabitableZone, false);
});

test("insolationEarth → Earth-like → ~1.0", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  approxEqual(p.derived.insolationEarth, 1.0, 0.15, "insolation");
});

test("insolationEarth → 2 AU vs 1 AU → ratio ~4 (inverse-square)", () => {
  const p1 = calcPlanetExact(EARTH_LIKE);
  const p2 = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, semiMajorAxisAu: 2 },
  });
  approxEqual(
    p1.derived.insolationEarth / p2.derived.insolationEarth,
    4,
    0.01,
    "insolation inverse-square",
  );
});

test("tidallyLockedToStar → Earth-like → false", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  assert.equal(p.derived.tidallyLockedToStar, false);
  // Lock time should exceed the system age (4.6 Gyr)
  assert.ok(
    p.derived.tidalLockStarGyr > 4.6,
    `tidal lock time ${p.derived.tidalLockStarGyr} should exceed star age 4.6 Gyr`,
  );
});

test("tidalLock → close-in M-dwarf → 1:1 resonance", () => {
  const p = calcPlanetExact({
    starMassMsol: 0.15,
    starAgeGyr: 8,
    planet: { ...EARTH_LIKE.planet, semiMajorAxisAu: 0.05, rotationPeriodHours: 24 },
  });
  assert.equal(p.derived.tidallyLockedToStar, true);
  assert.equal(p.derived.tidallyEvolved, true);
  assert.equal(p.derived.spinOrbitResonance, "1:1");
});

test("spinOrbitResonance → high eccentricity + evolved → 3:2", () => {
  const p = calcPlanetExact({
    starMassMsol: 1,
    starAgeGyr: 10,
    planet: {
      ...EARTH_LIKE.planet,
      semiMajorAxisAu: 0.1,
      eccentricity: 0.2,
      rotationPeriodHours: 24,
      pressureAtm: 0,
    },
  });
  assert.equal(p.derived.tidallyEvolved, true);
  assert.equal(p.derived.spinOrbitResonance, "3:2");
  assert.equal(p.derived.tidallyLockedToStar, false, "3:2 is not synchronous");
  assert.ok(p.derived.resonanceRotationHours > 0);
  // Verify rotation period matches orbital / p
  const orbitalPeriodHours = Math.sqrt(0.1 ** 3 / 1) * 365.256 * 24;
  const expected = orbitalPeriodHours / 1.5;
  assert.ok(
    Math.abs(p.derived.resonanceRotationHours - expected) < 0.1,
    `resonance rotation should be ~${expected.toFixed(1)} h, got ${p.derived.resonanceRotationHours.toFixed(1)}`,
  );
});

test("atmospherePreventsLocking → thick atm (Venus-like) → true", () => {
  const p = calcPlanetExact({
    starMassMsol: 1,
    starAgeGyr: 4.6,
    planet: {
      ...EARTH_LIKE.planet,
      massEarth: 0.815,
      semiMajorAxisAu: 0.723,
      eccentricity: 0.007,
      pressureAtm: 92,
      co2Pct: 96.5,
      albedoBond: 0.77,
      rotationPeriodHours: 5832,
      axialTiltDeg: 177,
    },
  });
  assert.equal(p.derived.atmospherePreventsLocking, true);
  assert.equal(p.derived.tidallyLockedToStar, false);
  assert.equal(p.derived.tidallyEvolved, false);
  assert.equal(p.derived.spinOrbitResonance, null);
});

test("atmospherePreventsLocking → thin atm + M-dwarf → false", () => {
  const p = calcPlanetExact({
    starMassMsol: 0.15,
    starAgeGyr: 8,
    planet: {
      ...EARTH_LIKE.planet,
      semiMajorAxisAu: 0.05,
      rotationPeriodHours: 24,
      pressureAtm: 0.01,
    },
  });
  assert.equal(p.derived.atmospherePreventsLocking, false);
  assert.equal(p.derived.tidallyLockedToStar, true, "thin atm should not prevent locking");
});

// --- Moon tidal heating on planet ---

test("planetTidalHeating → Earth + Moon → small but nonzero (~4 GW)", () => {
  const earthMoon = [{ massMoon: 1.0, semiMajorAxisKm: 384748, eccentricity: 0.055 }];
  const withMoon = calcPlanetExact({ ...EARTH_LIKE, moons: earthMoon });
  const without = calcPlanetExact(EARTH_LIKE);
  const heatingGW = withMoon.derived.planetTidalHeatingW / 1e9;
  // Peale formula gives solid-body heating only (~4 GW for Earth-Moon).
  // Observed 3.7 TW includes oceanic dissipation which doesn't heat the core.
  assert.ok(
    heatingGW > 1 && heatingGW < 20,
    `Earth-Moon solid-body tidal heating should be ~4 GW, got ${heatingGW.toFixed(1)} GW`,
  );
  assert.ok(
    withMoon.derived.planetTidalFraction < 0.001,
    "Earth-Moon tidal fraction should be negligible for core heating",
  );
  assert.ok(withMoon.derived.dynamoActive, "Earth with Moon should have active dynamo");
  assert.ok(without.derived.dynamoActive, "Earth without Moon should have active dynamo");
});

test("planetTidalHeating → no moons → zero", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  assert.equal(p.derived.planetTidalHeatingW, 0);
  assert.equal(p.derived.planetTidalFraction, 0);
  assert.ok(p.derived.dynamoActive);
});

test("dynamoActive → massive close moon on dead core → revived", () => {
  const deadPlanet = {
    ...EARTH_LIKE,
    starAgeGyr: 15,
    planet: { ...EARTH_LIKE.planet, cmfPct: 10, massEarth: 0.5 },
  };
  const dead = calcPlanetExact(deadPlanet);
  assert.ok(!dead.derived.dynamoActive, "should have no dynamo without moons");
  const revived = calcPlanetExact({
    ...deadPlanet,
    moons: [{ massMoon: 5.0, semiMajorAxisKm: 50000, eccentricity: 0.2 }],
  });
  assert.ok(
    revived.derived.planetTidalFraction > 0.5,
    `tidal fraction should be high, got ${revived.derived.planetTidalFraction.toFixed(2)}`,
  );
  assert.ok(revived.derived.dynamoActive, "massive tidal heating should keep dynamo alive");
});

test("planetTidalHeating → circular orbit moon (e=0) → zero", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    moons: [{ massMoon: 1.0, semiMajorAxisKm: 384748, eccentricity: 0 }],
  });
  assert.equal(p.derived.planetTidalHeatingW, 0);
  assert.equal(p.derived.planetTidalFraction, 0);
});

test("planetTidalHeating → two moons → greater than one moon", () => {
  const oneMoon = calcPlanetExact({
    ...EARTH_LIKE,
    moons: [{ massMoon: 1.0, semiMajorAxisKm: 384748, eccentricity: 0.055 }],
  });
  const twoMoons = calcPlanetExact({
    ...EARTH_LIKE,
    moons: [
      { massMoon: 1.0, semiMajorAxisKm: 384748, eccentricity: 0.055 },
      { massMoon: 0.5, semiMajorAxisKm: 200000, eccentricity: 0.1 },
    ],
  });
  assert.ok(
    twoMoons.derived.planetTidalHeatingW > oneMoon.derived.planetTidalHeatingW,
    "two moons should produce more heating than one",
  );
});

test("liquidWaterPossible → Earth-like → true", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  assert.equal(p.derived.liquidWaterPossible, true);
});

test("liquidWaterPossible → very hot planet → false", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, semiMajorAxisAu: 0.05, greenhouseEffect: 5 },
  });
  // Surface temp should be extremely high → above boiling
  assert.equal(p.derived.liquidWaterPossible, false);
});

test("liquidWaterPossible → airless planet → false", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, pressureAtm: 0.001 },
  });
  // Below water triple point pressure (0.006 atm)
  assert.equal(p.derived.liquidWaterPossible, false);
});

// --- Vegetation colours (2D PanoptesV-calibrated model) ---

test("vegetationHex → Earth-like → valid hex strings", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  assert.match(p.derived.vegetationPaleHex, /^#[0-9a-f]{6}$/);
  assert.match(p.derived.vegetationDeepHex, /^#[0-9a-f]{6}$/);
});

test("vegetationPaleHex → G-type 1 atm → green > red", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  // PanoptesV G2/G5 at 1 atm: pale is yellow-green (green channel high)
  const pale = p.derived.vegetationPaleHex;
  const g = parseInt(pale.slice(3, 5), 16);
  const r = parseInt(pale.slice(1, 3), 16);
  assert.ok(g > r, `green > red for Earth-like vegetation: g=${g} r=${r}`);
});

test("vegetationPaleHex → G-type 10 atm → red > green", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, pressureAtm: 10 },
  });
  // PanoptesV G5 at 10 atm: pale ~ #834a60 (red > green, blue component)
  const pale = p.derived.vegetationPaleHex;
  const r = parseInt(pale.slice(1, 3), 16);
  const g = parseInt(pale.slice(3, 5), 16);
  assert.ok(r > g, `G-type 10 atm: red > green: r=${r} g=${g}`);
});

test("vegetationPaleHex → G-type 3 atm → warm (red > blue)", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, pressureAtm: 3 },
  });
  // PanoptesV G5 at 3 atm: pale ~ #a37524 (red high, green moderate, blue low)
  const pale = p.derived.vegetationPaleHex;
  const r = parseInt(pale.slice(1, 3), 16);
  const b = parseInt(pale.slice(5, 7), 16);
  assert.ok(r > b, `G-type 3 atm: should be warm (r > b): r=${r} b=${b}`);
});

test("vegetationDeepHex → M-dwarf → blue > red", () => {
  const p = calcPlanetExact({
    starMassMsol: 0.18,
    starAgeGyr: 8,
    planet: { ...EARTH_LIKE.planet, semiMajorAxisAu: 0.05 },
  });
  // PanoptesV M5 at 1 atm deep: ~#03396b (blue dominant)
  const deep = p.derived.vegetationDeepHex;
  const b = parseInt(deep.slice(5, 7), 16);
  const r = parseInt(deep.slice(1, 3), 16);
  assert.ok(b > r, `M-dwarf deep should have blue > red: b=${b} r=${r}`);
});

test("vegetationTwilightHex → tidally locked M-dwarf → non-null hex", () => {
  const p = calcPlanetExact({
    starMassMsol: 0.15,
    starAgeGyr: 8,
    planet: { ...EARTH_LIKE.planet, semiMajorAxisAu: 0.05, rotationPeriodHours: 24 },
  });
  assert.equal(p.derived.tidallyLockedToStar, true);
  assert.ok(p.derived.vegetationTwilightPaleHex !== null, "should have twilight pale colour");
  assert.ok(p.derived.vegetationTwilightDeepHex !== null, "should have twilight deep colour");
  assert.match(p.derived.vegetationTwilightPaleHex, /^#[0-9a-f]{6}$/);
});

test("vegetationTwilightHex → non-locked planet → null", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  assert.equal(p.derived.vegetationTwilightPaleHex, null);
  assert.equal(p.derived.vegetationTwilightDeepHex, null);
  assert.equal(p.derived.vegetationTwilightStops, null);
});

test("vegetationStops → Earth-like → 6 valid hex colours", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  assert.ok(Array.isArray(p.derived.vegetationStops), "stops should be an array");
  assert.equal(p.derived.vegetationStops.length, 6, "should have 6 stops");
  for (const hex of p.derived.vegetationStops) {
    assert.match(hex, /^#[0-9a-f]{6}$/, `stop ${hex} should be valid hex`);
  }
});

test("vegetationStops → Earth-like → first=pale, last=deep", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  assert.equal(p.derived.vegetationStops[0], p.derived.vegetationPaleHex);
  assert.equal(
    p.derived.vegetationStops[p.derived.vegetationStops.length - 1],
    p.derived.vegetationDeepHex,
  );
});

test("vegetationTwilightStops → tidally locked → 6-element array", () => {
  const p = calcPlanetExact({
    starMassMsol: 0.15,
    starAgeGyr: 8,
    planet: { ...EARTH_LIKE.planet, semiMajorAxisAu: 0.05, rotationPeriodHours: 24 },
  });
  assert.ok(Array.isArray(p.derived.vegetationTwilightStops), "twilight stops should be an array");
  assert.equal(p.derived.vegetationTwilightStops.length, 6, "should have 6 twilight stops");
  assert.equal(p.derived.vegetationTwilightStops[0], p.derived.vegetationTwilightPaleHex);
});

test("vegetationNote → Earth-like → mentions Green", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  assert.ok(p.derived.vegetationNote.length > 0, "note should not be empty");
  assert.ok(p.derived.vegetationNote.includes("Green"), "Earth-like note should mention green");
});

/* ── Phase A: Composition model ─────────────────────────────────── */

test("composition → WMF=0 → unchanged density and radius", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, wmfPct: 0 },
  });
  approxEqual(p.derived.densityGcm3, 5.51, 0.1, "Earth density (WMF=0)");
  approxEqual(p.derived.radiusEarth, 1.0, 0.05, "Earth radius (WMF=0)");
});

test("composition → WMF=0.02% → radius change < 0.5%", () => {
  const dry = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, wmfPct: 0 },
  });
  const wet = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, wmfPct: 0.02 },
  });
  const change =
    Math.abs(wet.derived.radiusEarth - dry.derived.radiusEarth) / dry.derived.radiusEarth;
  assert.ok(change < 0.005, `radius change should be < 0.5%, got ${(change * 100).toFixed(3)}%`);
});

test("composition → WMF=10% → larger radius, lower density", () => {
  const dry = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, wmfPct: 0 },
  });
  const ocean = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, wmfPct: 10 },
  });
  assert.ok(ocean.derived.radiusEarth > dry.derived.radiusEarth, "ocean world should be larger");
  assert.ok(
    ocean.derived.densityGcm3 < dry.derived.densityGcm3,
    "ocean world should be less dense",
  );
});

test("composition → WMF=40% → radius >10% inflated", () => {
  const dry = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, wmfPct: 0 },
  });
  const ice = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, wmfPct: 40, massEarth: 2 },
  });
  assert.ok(
    ice.derived.radiusEarth > dry.derived.radiusEarth * 1.1,
    "ice world radius should be >10% larger",
  );
});

test("compositionClass → various CMF/WMF → correct labels", () => {
  const iron = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, cmfPct: 70 },
  });
  assert.equal(iron.derived.compositionClass, "Iron world");

  const mars = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, cmfPct: 15 },
  });
  assert.equal(mars.derived.compositionClass, "Mars-like");

  const earth = calcPlanetExact(EARTH_LIKE);
  assert.equal(earth.derived.compositionClass, "Earth-like");

  const ocean = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, wmfPct: 5 },
  });
  assert.equal(ocean.derived.compositionClass, "Ocean world");

  const iceWorld = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, wmfPct: 20 },
  });
  assert.equal(iceWorld.derived.compositionClass, "Ice world");
});

test("waterRegime → various WMF → correct labels", () => {
  const dry = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, wmfPct: 0 },
  });
  assert.equal(dry.derived.waterRegime, "Dry");

  const earthLike = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, wmfPct: 0.5 },
  });
  assert.equal(earthLike.derived.waterRegime, "Extensive oceans");

  const global = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, wmfPct: 5 },
  });
  assert.equal(global.derived.waterRegime, "Global ocean");

  const deep = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, wmfPct: 20 },
  });
  assert.equal(deep.derived.waterRegime, "Deep ocean");

  const ice = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, wmfPct: 40 },
  });
  assert.equal(ice.derived.waterRegime, "Ice world");
});

test("coreRadiusFraction → Earth-like → ~0.57", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  approxEqual(p.derived.coreRadiusFraction, 0.57, 0.03, "Earth CRF");
  assert.ok(
    p.derived.coreRadiusKm > 3000 && p.derived.coreRadiusKm < 4000,
    "core radius should be 3000-4000 km",
  );
});

test("coreRadiusFraction → CMF=0 → zero", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, cmfPct: 0 },
  });
  assert.equal(p.derived.coreRadiusFraction, 0);
  assert.equal(p.derived.coreRadiusKm, 0);
});

test("suggestedCmfPct → [Fe/H]=0 → ~32–34%", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  assert.ok(
    p.derived.suggestedCmfPct >= 30,
    `suggested CMF should be >= 30%, got ${p.derived.suggestedCmfPct}`,
  );
  assert.ok(
    p.derived.suggestedCmfPct <= 36,
    `suggested CMF should be <= 36%, got ${p.derived.suggestedCmfPct}`,
  );
});

/* ── Phase B: Magnetic field model ──────────────────────────────── */

test("dynamo → Earth analog → active dipolar ~1× Earth", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  assert.ok(p.derived.dynamoActive, "Earth should have active dynamo");
  assert.equal(p.derived.fieldMorphology, "dipolar");
  approxEqual(p.derived.surfaceFieldEarths, 1.0, 0.05, "Earth surface field");
  assert.ok(
    ["Strong", "Very strong"].includes(p.derived.fieldLabel),
    `field should be strong, got ${p.derived.fieldLabel}`,
  );
});

test("dynamo → CMF=0.5% → inactive, no field", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, cmfPct: 0.5 },
  });
  assert.ok(!p.derived.dynamoActive, "no-core planet should lack dynamo");
  assert.equal(p.derived.fieldMorphology, "none");
  assert.equal(p.derived.surfaceFieldEarths, 0);
});

test("coreState → old planet + small core → solidified", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    starAgeGyr: 15,
    planet: { ...EARTH_LIKE.planet, cmfPct: 10, massEarth: 0.5 },
  });
  assert.ok(!p.derived.dynamoActive, "old small-core planet should have no dynamo");
  assert.equal(p.derived.coreState, "solidified");
});

test("fieldMorphology → P=200 h → multipolar, weaker", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, rotationPeriodHours: 200 },
  });
  if (p.derived.dynamoActive) {
    assert.equal(p.derived.fieldMorphology, "multipolar");
    // Multipolar field is weaker at surface
    const fast = calcPlanetExact(EARTH_LIKE);
    assert.ok(
      p.derived.surfaceFieldEarths < fast.derived.surfaceFieldEarths,
      "slow rotator should have weaker surface field",
    );
  }
});

test("dynamo → P=5000 h → inactive, zero field", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, rotationPeriodHours: 5000, cmfPct: 33 },
  });
  // rotEff = sqrt(24/5000) ≈ 0.069, multipolar ×0.05 → below 0.005 threshold
  assert.ok(!p.derived.dynamoActive, "very slow rotator should have no measurable dynamo");
  assert.equal(p.derived.surfaceFieldEarths, 0, "field should be zero");
  assert.equal(p.derived.fieldLabel, "None");
});

test("dynamo → Mercury-like rotation → active multipolar < 3%", () => {
  // Real Mercury: ~0.01× Earth.  Model: multipolar + thin-shell gives ~0.8%.
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    planet: {
      ...EARTH_LIKE.planet,
      massEarth: 0.0553,
      rotationPeriodHours: 1408,
      cmfPct: 70,
    },
  });
  assert.ok(p.derived.dynamoActive, "Mercury-like should still have active dynamo");
  assert.equal(p.derived.fieldMorphology, "multipolar");
  assert.ok(
    p.derived.surfaceFieldEarths < 0.03,
    `Mercury-like field should be < 3%, got ${p.derived.surfaceFieldEarths.toFixed(4)}`,
  );
});

test("dynamo → Venus-like P=5832 h → inactive", () => {
  // Venus (P=5832h) exceeds the Rm cutoff — rotation too slow for dynamo.
  // Core is still partially solidified (preserved in output).
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    starAgeGyr: 4.6,
    planet: {
      ...EARTH_LIKE.planet,
      rotationPeriodHours: 5832,
      cmfPct: 32,
      massEarth: 0.815,
    },
  });
  assert.ok(!p.derived.dynamoActive, "Venus-like should have no measurable dynamo");
  assert.ok(
    p.derived.dynamoReason.includes("Rotation too slow") ||
      p.derived.dynamoReason.includes("too weak"),
    `reason should explain no dynamo, got: ${p.derived.dynamoReason}`,
  );
});

test("surfaceFieldEarths → higher CMF → stronger field", () => {
  const lowCmf = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, cmfPct: 15 },
  });
  const highCmf = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, cmfPct: 50 },
  });
  if (lowCmf.derived.dynamoActive && highCmf.derived.dynamoActive) {
    assert.ok(
      highCmf.derived.surfaceFieldEarths > lowCmf.derived.surfaceFieldEarths,
      "higher CMF should give stronger field",
    );
  }
});

test("surfaceFieldEarths → 5 M⊕ super-Earth → >= Earth", () => {
  const superEarth = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, massEarth: 5, cmfPct: 33 },
  });
  const earth = calcPlanetExact(EARTH_LIKE);
  if (superEarth.derived.dynamoActive) {
    assert.ok(
      superEarth.derived.surfaceFieldEarths >= earth.derived.surfaceFieldEarths,
      "super-Earth should have field >= Earth",
    );
  }
});

test("fieldLabel → Earth-like → valid category string", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  const validLabels = ["Very strong", "Strong", "Moderate", "Weak", "Very weak", "None"];
  assert.ok(
    validLabels.includes(p.derived.fieldLabel),
    `unexpected label: ${p.derived.fieldLabel}`,
  );
});

/* ── Phase C: Mantle outgassing & tectonic regime ───────────────── */

test("primaryOutgassedSpecies → earth oxidation → CO₂ + H₂O", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, mantleOxidation: "earth" },
  });
  assert.ok(p.derived.primaryOutgassedSpecies.includes("CO"), "should contain CO₂");
  assert.ok(p.derived.primaryOutgassedSpecies.includes("H"), "should contain H₂O");
});

test("primaryOutgassedSpecies → highly-reduced → H₂ + CO", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, mantleOxidation: "highly-reduced" },
  });
  assert.ok(p.derived.primaryOutgassedSpecies.includes("H"), "should contain H₂");
  assert.ok(p.derived.primaryOutgassedSpecies.includes("CO"), "should contain CO");
  assert.equal(p.derived.mantleOxidation, "Highly reduced");
});

test("tectonicAdvisory → Earth-like → non-empty string", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  assert.ok(typeof p.derived.tectonicAdvisory === "string", "advisory should be a string");
  assert.ok(p.derived.tectonicAdvisory.length > 0, "advisory should not be empty");
});

test("outgassingHint → all oxidation states → non-empty", () => {
  for (const ox of ["highly-reduced", "reduced", "earth", "oxidized"]) {
    const p = calcPlanetExact({
      ...EARTH_LIKE,
      planet: { ...EARTH_LIKE.planet, mantleOxidation: ox },
    });
    assert.ok(p.derived.outgassingHint.length > 0, `hint for ${ox} should not be empty`);
  }
});

test("display → Earth-like → composition fields populated", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  assert.ok(p.display.compositionClass.length > 0, "compositionClass display");
  assert.ok(p.display.waterRegime.length > 0, "waterRegime display");
  assert.ok(p.display.coreRadius.includes("km"), "coreRadius display should include km");
  assert.ok(p.display.suggestedCmf.includes("%"), "suggestedCmf display should include %");
  assert.ok(p.display.magneticField.length > 0, "magneticField display");
  assert.ok(p.display.outgassing.length > 0, "outgassing display");
});

// ── Tectonic probability distribution ──

test("tectonicProbabilities: Earth-like → mobile lid highest", () => {
  const p = tectonicProbabilities(1.0, 4.6, 0.0002, 0.33, 0);
  assert.ok(p.mobile > p.stagnant, "mobile > stagnant");
  assert.ok(p.mobile > p.episodic, "mobile > episodic");
  assert.ok(p.mobile > p.plutonicSquishy, "mobile > plutonic-squishy");
  assert.equal(p.suggested, "mobile");
});

test("tectonicProbabilities: Mars-like (0.1 M⊕) → stagnant dominant", () => {
  const p = tectonicProbabilities(0.1, 4.6, 0.0, 0.22, 0);
  assert.ok(p.stagnant > p.mobile, "stagnant > mobile");
  assert.equal(p.suggested, "stagnant");
});

test("tectonicProbabilities: super-Earth (5 M⊕, old) → stagnant > mobile", () => {
  const p = tectonicProbabilities(5.0, 9.0, 0.0, 0.33, 0);
  assert.ok(p.stagnant > p.mobile, "stagnant > mobile for old super-Earth");
});

test("tectonicProbabilities: water world → spread distribution", () => {
  const p = tectonicProbabilities(1.0, 4.0, 0.15, 0.33, 0);
  assert.ok(p.mobile < 0.7, "mobile should not dominate on water world");
});

test("tectonicProbabilities → any input → probabilities sum to 1.0", () => {
  const p = tectonicProbabilities(1.0, 4.6, 0.0002, 0.33, 0);
  const sum = p.stagnant + p.mobile + p.episodic + p.plutonicSquishy;
  approxEqual(sum, 1.0, 0.01, "sum of probabilities");
});

test("tectonicProbabilities: young planet → episodic more likely", () => {
  const young = tectonicProbabilities(2.0, 0.5, 0.001, 0.33, 0);
  const old = tectonicProbabilities(2.0, 8.0, 0.001, 0.33, 0);
  assert.ok(young.episodic > old.episodic, "young planet has higher episodic probability");
});

test("tectonicProbabilities → tidal heating → shifts away from stagnant", () => {
  const noTidal = tectonicProbabilities(0.2, 5.0, 0.0, 0.33, 0);
  const withTidal = tectonicProbabilities(0.2, 5.0, 0.0, 0.33, 2.0);
  assert.ok(withTidal.stagnant < noTidal.stagnant, "tidal heating reduces stagnant probability");
});

test("calcPlanetExact → auto mode → returns suggested regime", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, tectonicRegime: "auto" },
  });
  assert.equal(p.derived.tectonicRegime, p.derived.tectonicSuggested);
  assert.ok(p.derived.tectonicProbabilities.mobile > 0, "should have mobile probability");
});

test("calcPlanetExact → manual override → preserves chosen regime", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, tectonicRegime: "stagnant" },
  });
  assert.equal(p.derived.tectonicRegime, "stagnant");
});

test("calcPlanetExact → luminosity override 4× → hotter planet, 4× insolation", () => {
  const base = calcPlanetExact(EARTH_LIKE);
  // Override luminosity to 4× solar — planet should receive 4× the insolation
  const bright = calcPlanetExact({
    ...EARTH_LIKE,
    starLuminosityLsolOverride: 4,
  });
  assert.ok(
    bright.derived.surfaceTempK > base.derived.surfaceTempK,
    `brighter star (${bright.derived.surfaceTempK} K) should heat planet more than default (${base.derived.surfaceTempK} K)`,
  );
  // Insolation scales linearly with L
  approxEqual(
    bright.derived.insolationEarth / base.derived.insolationEarth,
    4,
    0.01,
    "insolation ratio for 4× luminosity",
  );
});

test("calcPlanetExact → R+L override → T derived via Stefan-Boltzmann", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    starRadiusRsolOverride: 1.5,
    starLuminosityLsolOverride: 3.6,
  });
  // The star model embedded in the result should reflect overrides
  approxEqual(p.star.radiusRsol, 1.5, 0.001, "star radius override");
  approxEqual(p.star.luminosityLsol, 3.6, 0.001, "star luminosity override");
  assert.equal(p.star.resolutionMode, "R+L→T");
  // Temperature derived from Stefan-Boltzmann: T = (L/R²)^0.25 × 5776
  const expectedT = Math.pow(3.6 / 1.5 ** 2, 0.25) * 5776;
  approxEqual(p.star.tempK, expectedT, 1, "derived temperature from R+L");
});

test("calcPlanetExact → R+T override → luminosity derived via SB", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    starRadiusRsolOverride: 1.5,
    starTempKOverride: 6000,
  });
  approxEqual(p.star.radiusRsol, 1.5, 0.001, "star radius override");
  // L = R² × (T/5776)⁴
  const expectedL = 1.5 ** 2 * (6000 / 5776) ** 4;
  approxEqual(p.star.luminosityLsol, expectedL, 0.01, "derived luminosity from R+T");
  assert.equal(p.star.resolutionMode, "R+T→L");
  // Planet insolation should use this derived L, not the mass-derived L
  const base = calcPlanetExact(EARTH_LIKE);
  const ratio = p.derived.insolationEarth / base.derived.insolationEarth;
  approxEqual(ratio, expectedL, 0.01, "insolation uses SB-derived luminosity");
});

test("calcPlanetExact → L+T override → radius derived via SB", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    starLuminosityLsolOverride: 2,
    starTempKOverride: 5000,
  });
  approxEqual(p.star.luminosityLsol, 2, 0.001, "star luminosity override");
  // R = sqrt(L) × (5776/T)²
  const expectedR = Math.sqrt(2) * (5776 / 5000) ** 2;
  approxEqual(p.star.radiusRsol, expectedR, 0.01, "derived radius from L+T");
  assert.equal(p.star.resolutionMode, "L+T→R");
});

test("calcPlanetExact → no overrides → mass-derived star", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  assert.equal(p.star.resolutionMode, "mass-derived");
});

test("calcPlanetExact → null/undefined overrides → mass-derived", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    starRadiusRsolOverride: null,
    starLuminosityLsolOverride: undefined,
    starTempKOverride: null,
  });
  assert.equal(p.star.resolutionMode, "mass-derived");
});

test("calcPlanetExact → luminosity override 4× → HZ shifts outward", () => {
  const base = calcPlanetExact(EARTH_LIKE);
  const bright = calcPlanetExact({
    ...EARTH_LIKE,
    starLuminosityLsolOverride: 4,
  });
  // HZ distance scales as sqrt(L/Seff), so 4× L → ~2× HZ distance
  assert.ok(
    bright.star.habitableZoneAu.inner > base.star.habitableZoneAu.inner,
    "HZ inner edge moves outward with higher luminosity",
  );
  assert.ok(
    bright.star.habitableZoneAu.outer > base.star.habitableZoneAu.outer,
    "HZ outer edge moves outward with higher luminosity",
  );
});
