import test from "node:test";
import assert from "node:assert/strict";

import { calcPlanetExact, tectonicProbabilities } from "../engine/planet.js";

function approxEqual(actual, expected, tolerance, label) {
  const msg = label
    ? `${label}: expected ${expected} +/- ${tolerance}, got ${actual}`
    : `${actual} not within ${tolerance} of ${expected}`;
  assert.ok(Math.abs(actual - expected) <= tolerance, msg);
}

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

test("Earth-like planet has plausible surface temperature", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  assert.ok(p.derived.surfaceTempK >= 280, "surface temp should be >= 280 K");
  assert.ok(p.derived.surfaceTempK <= 300, "surface temp should be <= 300 K");
});

test("Earth-like planet density is around 5.5 g/cm³", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  approxEqual(p.derived.densityGcm3, 5.51, 0.1, "Earth density");
});

test("Earth-like planet radius is close to 1 Earth radius", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  approxEqual(p.derived.radiusEarth, 1.0, 0.05, "Earth radius");
});

test("Earth-like planet gravity is close to 1g", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  approxEqual(p.derived.gravityG, 1.0, 0.1, "Earth gravity");
});

test("prograde orbit gives Prograde direction", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  assert.equal(p.derived.orbitalDirection, "Prograde");
});

test("retrograde orbit (inclination > 90) gives Retrograde direction", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, inclinationDeg: 120 },
  });
  assert.equal(p.derived.orbitalDirection, "Retrograde");
});

test("exactly 90° inclination gives Undefined direction", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, inclinationDeg: 90 },
  });
  assert.equal(p.derived.orbitalDirection, "Undefined");
});

test("orbital period scales with semi-major axis (Kepler's third law)", () => {
  const p1 = calcPlanetExact(EARTH_LIKE);
  const p4 = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, semiMajorAxisAu: 4 },
  });
  // T ∝ a^1.5  =>  T(4AU) / T(1AU) ≈ 4^1.5 = 8
  const ratio = p4.derived.orbitalPeriodEarthDays / p1.derived.orbitalPeriodEarthDays;
  approxEqual(ratio, 8, 0.01, "Kepler T ratio");
});

test("N2 percentage is zero when gas totals exceed 100%", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, o2Pct: 60, co2Pct: 30, arPct: 20 },
  });
  assert.equal(p.derived.n2Pct, 0);
  assert.equal(p.derived.gasMixClamped, true);
});

test("atmosphere cell count varies with rotation period", () => {
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

test("sky colour is a valid hex string", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  assert.match(p.derived.skyColourDayHex, /^#[0-9a-f]{6}$/);
  assert.match(p.derived.skyColourHorizonHex, /^#[0-9a-f]{6}$/);
});

test("5-cell circulation regime for very fast rotation (< 3 hours)", () => {
  const veryFast = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, rotationPeriodHours: 2 },
  });
  assert.equal(veryFast.derived.circulationCellCount, "5");
  assert.equal(veryFast.derived.circulationCellRanges.length, 5);
});

test("3-cell circulation regime for moderate rotation (6-48 hours)", () => {
  const moderate = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, rotationPeriodHours: 24 },
  });
  assert.equal(moderate.derived.circulationCellCount, "3");
});

// --- New derived properties ---

test("Earth-like planet is in the habitable zone", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  assert.equal(p.derived.inHabitableZone, true);
});

test("planet far from star is not in habitable zone", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, semiMajorAxisAu: 50 },
  });
  assert.equal(p.derived.inHabitableZone, false);
});

test("Earth-like insolation is close to 1.0", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  approxEqual(p.derived.insolationEarth, 1.0, 0.15, "insolation");
});

test("insolation scales inversely with distance squared", () => {
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

test("Earth-like planet is not tidally locked", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  assert.equal(p.derived.tidallyLockedToStar, false);
  // Lock time should exceed the system age (4.6 Gyr)
  assert.ok(
    p.derived.tidalLockStarGyr > 4.6,
    `tidal lock time ${p.derived.tidalLockStarGyr} should exceed star age 4.6 Gyr`,
  );
});

test("close-in M-dwarf planet is tidally locked with 1:1 resonance", () => {
  const p = calcPlanetExact({
    starMassMsol: 0.15,
    starAgeGyr: 8,
    planet: { ...EARTH_LIKE.planet, semiMajorAxisAu: 0.05, rotationPeriodHours: 24 },
  });
  assert.equal(p.derived.tidallyLockedToStar, true);
  assert.equal(p.derived.tidallyEvolved, true);
  assert.equal(p.derived.spinOrbitResonance, "1:1");
});

test("high-eccentricity tidally-evolved planet predicts 3:2 resonance", () => {
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

test("thick atmosphere prevents tidal locking (Venus-like)", () => {
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

test("thin atmosphere does not prevent tidal locking", () => {
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

test("Earth + Moon solid-body tidal heating is small but nonzero", () => {
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

test("no moons produces zero tidal heating", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  assert.equal(p.derived.planetTidalHeatingW, 0);
  assert.equal(p.derived.planetTidalFraction, 0);
  assert.ok(p.derived.dynamoActive);
});

test("massive close moon keeps otherwise-dead core alive", () => {
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

test("circular orbit moon contributes zero tidal heating", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    moons: [{ massMoon: 1.0, semiMajorAxisKm: 384748, eccentricity: 0 }],
  });
  assert.equal(p.derived.planetTidalHeatingW, 0);
  assert.equal(p.derived.planetTidalFraction, 0);
});

test("multiple moons sum tidal heating contributions", () => {
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

test("Earth-like planet has liquid water possible", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  assert.equal(p.derived.liquidWaterPossible, true);
});

test("very hot planet does not have liquid water", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, semiMajorAxisAu: 0.05, greenhouseEffect: 5 },
  });
  // Surface temp should be extremely high → above boiling
  assert.equal(p.derived.liquidWaterPossible, false);
});

test("airless planet does not have liquid water", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, pressureAtm: 0.001 },
  });
  // Below water triple point pressure (0.006 atm)
  assert.equal(p.derived.liquidWaterPossible, false);
});

// --- Vegetation colours (2D PanoptesV-calibrated model) ---

test("vegetation colour returns valid hex strings", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  assert.match(p.derived.vegetationPaleHex, /^#[0-9a-f]{6}$/);
  assert.match(p.derived.vegetationDeepHex, /^#[0-9a-f]{6}$/);
});

test("Earth-like vegetation at 1 atm is greenish (G-type, PanoptesV)", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  // PanoptesV G2/G5 at 1 atm: pale is yellow-green (green channel high)
  const pale = p.derived.vegetationPaleHex;
  const g = parseInt(pale.slice(3, 5), 16);
  const r = parseInt(pale.slice(1, 3), 16);
  assert.ok(g > r, `green > red for Earth-like vegetation: g=${g} r=${r}`);
});

test("G-type at 10 atm has red/purple tint (PanoptesV)", () => {
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

test("G-type at 3 atm is olive/gold (PanoptesV)", () => {
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

test("M-dwarf vegetation has blue component (PanoptesV)", () => {
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

test("tidally locked M-dwarf planet has twilight vegetation colours", () => {
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

test("non-locked planet has no twilight vegetation colours", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  assert.equal(p.derived.vegetationTwilightPaleHex, null);
  assert.equal(p.derived.vegetationTwilightDeepHex, null);
  assert.equal(p.derived.vegetationTwilightStops, null);
});

test("vegetation stops is a 6-element array of valid hex colours", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  assert.ok(Array.isArray(p.derived.vegetationStops), "stops should be an array");
  assert.equal(p.derived.vegetationStops.length, 6, "should have 6 stops");
  for (const hex of p.derived.vegetationStops) {
    assert.match(hex, /^#[0-9a-f]{6}$/, `stop ${hex} should be valid hex`);
  }
});

test("vegetation stops span from pale to deep", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  assert.equal(p.derived.vegetationStops[0], p.derived.vegetationPaleHex);
  assert.equal(
    p.derived.vegetationStops[p.derived.vegetationStops.length - 1],
    p.derived.vegetationDeepHex,
  );
});

test("tidally locked planet has 6-element twilight stops", () => {
  const p = calcPlanetExact({
    starMassMsol: 0.15,
    starAgeGyr: 8,
    planet: { ...EARTH_LIKE.planet, semiMajorAxisAu: 0.05, rotationPeriodHours: 24 },
  });
  assert.ok(Array.isArray(p.derived.vegetationTwilightStops), "twilight stops should be an array");
  assert.equal(p.derived.vegetationTwilightStops.length, 6, "should have 6 twilight stops");
  assert.equal(p.derived.vegetationTwilightStops[0], p.derived.vegetationTwilightPaleHex);
});

test("vegetation note describes the spectral regime", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  assert.ok(p.derived.vegetationNote.length > 0, "note should not be empty");
  assert.ok(p.derived.vegetationNote.includes("Green"), "Earth-like note should mention green");
});

/* ── Phase A: Composition model ─────────────────────────────────── */

test("Earth with WMF=0 gives unchanged density and radius", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, wmfPct: 0 },
  });
  approxEqual(p.derived.densityGcm3, 5.51, 0.1, "Earth density (WMF=0)");
  approxEqual(p.derived.radiusEarth, 1.0, 0.05, "Earth radius (WMF=0)");
});

test("Earth with WMF=0.02% has barely changed radius (<0.5%)", () => {
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

test("Ocean world (WMF=10%) has larger radius and lower density than dry", () => {
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

test("Ice world (WMF=40%) has significantly inflated radius", () => {
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

test("composition class labels", () => {
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

test("water regime labels", () => {
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

test("core radius fraction for Earth is ~0.57", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  approxEqual(p.derived.coreRadiusFraction, 0.57, 0.03, "Earth CRF");
  assert.ok(
    p.derived.coreRadiusKm > 3000 && p.derived.coreRadiusKm < 4000,
    "core radius should be 3000-4000 km",
  );
});

test("coreless planet (CMF=0) has CRF=0", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, cmfPct: 0 },
  });
  assert.equal(p.derived.coreRadiusFraction, 0);
  assert.equal(p.derived.coreRadiusKm, 0);
});

test("suggested CMF from [Fe/H]=0 is ~32-34%", () => {
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

test("Earth analog has active dipolar dynamo ~1× Earth", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  assert.ok(p.derived.dynamoActive, "Earth should have active dynamo");
  assert.equal(p.derived.fieldMorphology, "dipolar");
  approxEqual(p.derived.surfaceFieldEarths, 1.0, 0.05, "Earth surface field");
  assert.ok(
    ["Strong", "Very strong"].includes(p.derived.fieldLabel),
    `field should be strong, got ${p.derived.fieldLabel}`,
  );
});

test("no-core planet (CMF=0.5%) has no dynamo", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, cmfPct: 0.5 },
  });
  assert.ok(!p.derived.dynamoActive, "no-core planet should lack dynamo");
  assert.equal(p.derived.fieldMorphology, "none");
  assert.equal(p.derived.surfaceFieldEarths, 0);
});

test("very old planet with small core has solidified core", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    starAgeGyr: 15,
    planet: { ...EARTH_LIKE.planet, cmfPct: 10, massEarth: 0.5 },
  });
  assert.ok(!p.derived.dynamoActive, "old small-core planet should have no dynamo");
  assert.equal(p.derived.coreState, "solidified");
});

test("slow rotator (P=200h) has multipolar field", () => {
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

test("very slow rotator (P=5000h) has no measurable dynamo", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, rotationPeriodHours: 5000, cmfPct: 33 },
  });
  // rotEff = sqrt(24/5000) ≈ 0.069, multipolar ×0.05 → below 0.005 threshold
  assert.ok(!p.derived.dynamoActive, "very slow rotator should have no measurable dynamo");
  assert.equal(p.derived.surfaceFieldEarths, 0, "field should be zero");
  assert.equal(p.derived.fieldLabel, "None");
});

test("Mercury-like rotation keeps field active and multipolar", () => {
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

test("Venus-like extremely slow rotator has no dynamo", () => {
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

test("more CMF gives stronger field (all else equal)", () => {
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

test("large super-Earth has stronger field than Earth", () => {
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

test("field label categories", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  const validLabels = ["Very strong", "Strong", "Moderate", "Weak", "Very weak", "None"];
  assert.ok(
    validLabels.includes(p.derived.fieldLabel),
    `unexpected label: ${p.derived.fieldLabel}`,
  );
});

/* ── Phase C: Mantle outgassing & tectonic regime ───────────────── */

test("Earth-like oxidation gives CO₂ + H₂O outgassing", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, mantleOxidation: "earth" },
  });
  assert.ok(p.derived.primaryOutgassedSpecies.includes("CO"), "should contain CO₂");
  assert.ok(p.derived.primaryOutgassedSpecies.includes("H"), "should contain H₂O");
});

test("highly reduced oxidation gives H₂ + CO outgassing", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, mantleOxidation: "highly-reduced" },
  });
  assert.ok(p.derived.primaryOutgassedSpecies.includes("H"), "should contain H₂");
  assert.ok(p.derived.primaryOutgassedSpecies.includes("CO"), "should contain CO");
  assert.equal(p.derived.mantleOxidation, "Highly reduced");
});

test("tectonic advisory is generated", () => {
  const p = calcPlanetExact(EARTH_LIKE);
  assert.ok(typeof p.derived.tectonicAdvisory === "string", "advisory should be a string");
  assert.ok(p.derived.tectonicAdvisory.length > 0, "advisory should not be empty");
});

test("outgassing hint is generated for all oxidation states", () => {
  for (const ox of ["highly-reduced", "reduced", "earth", "oxidized"]) {
    const p = calcPlanetExact({
      ...EARTH_LIKE,
      planet: { ...EARTH_LIKE.planet, mantleOxidation: ox },
    });
    assert.ok(p.derived.outgassingHint.length > 0, `hint for ${ox} should not be empty`);
  }
});

test("display strings include new composition fields", () => {
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

test("tectonicProbabilities: probabilities sum to 1.0", () => {
  const p = tectonicProbabilities(1.0, 4.6, 0.0002, 0.33, 0);
  const sum = p.stagnant + p.mobile + p.episodic + p.plutonicSquishy;
  approxEqual(sum, 1.0, 0.01, "sum of probabilities");
});

test("tectonicProbabilities: young planet → episodic more likely", () => {
  const young = tectonicProbabilities(2.0, 0.5, 0.001, 0.33, 0);
  const old = tectonicProbabilities(2.0, 8.0, 0.001, 0.33, 0);
  assert.ok(young.episodic > old.episodic, "young planet has higher episodic probability");
});

test("tectonicProbabilities: tidal heating shifts away from stagnant", () => {
  const noTidal = tectonicProbabilities(0.2, 5.0, 0.0, 0.33, 0);
  const withTidal = tectonicProbabilities(0.2, 5.0, 0.0, 0.33, 2.0);
  assert.ok(withTidal.stagnant < noTidal.stagnant, "tidal heating reduces stagnant probability");
});

test("calcPlanetExact: auto mode returns suggested regime", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, tectonicRegime: "auto" },
  });
  assert.equal(p.derived.tectonicRegime, p.derived.tectonicSuggested);
  assert.ok(p.derived.tectonicProbabilities.mobile > 0, "should have mobile probability");
});

test("calcPlanetExact: manual override preserves chosen regime", () => {
  const p = calcPlanetExact({
    ...EARTH_LIKE,
    planet: { ...EARTH_LIKE.planet, tectonicRegime: "stagnant" },
  });
  assert.equal(p.derived.tectonicRegime, "stagnant");
});
