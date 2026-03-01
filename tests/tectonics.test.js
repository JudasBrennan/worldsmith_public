import test from "node:test";
import assert from "node:assert/strict";

import {
  maxPeakHeight,
  mountainProfile,
  erodedHeight,
  oceanDepth,
  oceanDepthCurve,
  calcTectonics,
  MOUNTAIN_TYPE_KEYS,
  listMountainTypes,
  spreadingRate,
  volcanicArcDistance,
  airyRootDepth,
  prattDensity,
  continentalMarginProfile,
  maxShieldHeight,
  shieldVolcanoProfile,
  riftProfile,
  elasticLithosphereThicknessKm,
  flexuralShieldLimit,
  basalSpreadingLimit,
  climateErosionRate,
  compositionMaxPeakM,
  convergenceFactor,
  volcanicActivity,
} from "../engine/tectonics.js";
import { approxEqual } from "./testHelpers.js";

// ── maxPeakHeight ────────────────────────────────────────

test("maxPeakHeight → Earth gravity yields ~9267 m", () => {
  approxEqual(maxPeakHeight(1.0), 9267, 1, "Earth max peak");
});

test("maxPeakHeight → scales inversely with gravity", () => {
  assert.ok(maxPeakHeight(0.5) > maxPeakHeight(1.0), "lower g → taller peaks");
  assert.ok(maxPeakHeight(2.0) < maxPeakHeight(1.0), "higher g → shorter peaks");
});

test("maxPeakHeight → Mars gravity (~0.38 g) yields ~24,387 m", () => {
  approxEqual(maxPeakHeight(0.38), 9267 / 0.38, 10, "Mars max peak");
});

test("maxPeakHeight → near-zero gravity clamps to safe value", () => {
  assert.ok(Number.isFinite(maxPeakHeight(0)), "zero-g produces finite result");
  assert.ok(maxPeakHeight(0) > 0, "zero-g produces positive result");
});

// ── mountainProfile ──────────────────────────────────────

test("mountainProfile → Andean type has 6 zones", () => {
  const p = mountainProfile("andean", 1.0);
  assert.equal(p.zones.length, 6);
  assert.equal(p.type, "andean");
  assert.equal(p.label, "Andean");
});

test("mountainProfile → Himalayan type has 4 zones", () => {
  const p = mountainProfile("himalayan", 1.0);
  assert.equal(p.zones.length, 4);
});

test("mountainProfile → Ural type has 4 zones", () => {
  const p = mountainProfile("ural", 1.0);
  assert.equal(p.zones.length, 4);
});

test("mountainProfile → Laramide type has 6 zones", () => {
  const p = mountainProfile("laramide", 1.0);
  assert.equal(p.zones.length, 6);
});

test("mountainProfile → heights respect gravity cap", () => {
  const g = 2.0;
  const cap = maxPeakHeight(g);
  for (const type of MOUNTAIN_TYPE_KEYS) {
    const p = mountainProfile(type, g);
    for (const z of p.zones) {
      assert.ok(z.height <= cap + 0.001, `${type}/${z.name} exceeds gravity cap`);
    }
  }
});

test("mountainProfile → totalWidthKm is sum of zone widths", () => {
  const p = mountainProfile("andean", 1.0);
  const sum = p.zones.reduce((s, z) => s + z.width, 0);
  approxEqual(p.totalWidthKm, sum, 0.01, "total width");
});

test("mountainProfile → zone x positions are cumulative", () => {
  const p = mountainProfile("himalayan", 1.0);
  let x = 0;
  for (const z of p.zones) {
    approxEqual(z.x, x, 0.01, `${z.name} x position`);
    x += z.width;
  }
});

test("mountainProfile → default fractions (0.5) produce mid-range values", () => {
  const p = mountainProfile("andean", 1.0);
  // Plateau zone (index 3): hMin=1000, hMax=6000 → mid ≈ 3500
  const plateau = p.zones[3];
  assert.ok(plateau.height >= 900, "plateau height above minimum");
  assert.ok(plateau.height <= 6100, "plateau height below maximum");
});

test("mountainProfile → unknown type falls back to andean", () => {
  const p = mountainProfile("nonexistent", 1.0);
  assert.equal(p.zones.length, 6, "fallback to andean");
});

// ── erodedHeight ─────────────────────────────────────────

test("erodedHeight → no erosion at age 0", () => {
  assert.equal(erodedHeight(5000, 0), 5000);
});

test("erodedHeight → reduces linearly with age", () => {
  // 5000 m, 500 Myr, 5 m/Myr → 5000 - 2500 = 2500
  assert.equal(erodedHeight(5000, 500), 2500);
});

test("erodedHeight → floors at 0", () => {
  assert.equal(erodedHeight(100, 1000), 0);
  assert.equal(erodedHeight(5000, 1001, 5), 0);
});

test("erodedHeight → custom erosion rate", () => {
  // 5000 m, 100 Myr, 10 m/Myr → 5000 - 1000 = 4000
  assert.equal(erodedHeight(5000, 100, 10), 4000);
});

// ── oceanDepth ───────────────────────────────────────────

test("oceanDepth → age 0 equals ridge height", () => {
  approxEqual(oceanDepth(0, 2600), 2600, 1, "ridge height at age 0");
});

test("oceanDepth → monotonically increases with age", () => {
  let prev = oceanDepth(0);
  for (let a = 10; a <= 600; a += 10) {
    const d = oceanDepth(a);
    assert.ok(d >= prev, `depth at ${a} Myr should be >= depth at ${a - 10} Myr`);
    prev = d;
  }
});

test("oceanDepth → caps at ~6400 m", () => {
  approxEqual(oceanDepth(600), 6400, 100, "max depth at 600 Myr");
  approxEqual(oceanDepth(1000), 6400, 1, "max depth at 1000 Myr");
});

test("oceanDepth → spreadsheet validation at age 10 Myr", () => {
  // WS8: age 10 → depth 3707 m
  approxEqual(oceanDepth(10), 3707, 10, "depth at 10 Myr");
});

test("oceanDepth → spreadsheet validation at age 50 Myr", () => {
  // WS8: age 50 → depth 5014 m
  approxEqual(oceanDepth(50), 5014, 50, "depth at 50 Myr");
});

test("oceanDepth → custom ridge height shifts curve", () => {
  assert.ok(oceanDepth(0, 3000) > oceanDepth(0, 2600), "higher ridge → deeper at age 0");
});

// ── oceanDepthCurve ──────────────────────────────────────

test("oceanDepthCurve → returns expected number of points", () => {
  const curve = oceanDepthCurve(2600, 1000, 50);
  assert.equal(curve.length, 51); // 0..50 inclusive
});

test("oceanDepthCurve → first point is age 0", () => {
  const curve = oceanDepthCurve();
  assert.equal(curve[0].ageMyr, 0);
  approxEqual(curve[0].depthM, 2600, 1, "first point depth");
});

test("oceanDepthCurve → last point is max age", () => {
  const curve = oceanDepthCurve(2600, 500, 100);
  assert.equal(curve[100].ageMyr, 500);
});

// ── listMountainTypes ────────────────────────────────────

test("listMountainTypes → returns 4 types with labels", () => {
  const types = listMountainTypes();
  assert.equal(types.length, 4);
  assert.ok(types.every((t) => t.key && t.label && t.description));
});

// ── calcTectonics ────────────────────────────────────────

test("calcTectonics → returns expected shape", () => {
  const r = calcTectonics({ gravityG: 1.0, tectonicRegime: "mobile" });
  assert.ok(r.inputs, "has inputs");
  assert.ok(r.tectonics, "has tectonics");
  assert.ok(r.display, "has display");
  assert.ok(r.tectonics.maxPeakHeightM > 0, "positive max peak");
  assert.ok(Array.isArray(r.tectonics.ocean.subsidence), "subsidence is array");
  assert.equal(typeof r.display.maxPeakHeight, "string", "formatted max peak");
});

test("calcTectonics → processes mountain ranges", () => {
  const r = calcTectonics({
    gravityG: 1.0,
    mountainRanges: [
      { type: "andean", widths: {}, heights: {} },
      { type: "himalayan", widths: {}, heights: {} },
    ],
  });
  assert.equal(r.tectonics.mountainProfiles.length, 2);
  assert.equal(r.tectonics.mountainProfiles[0].type, "andean");
  assert.equal(r.tectonics.mountainProfiles[1].type, "himalayan");
});

test("calcTectonics → processes inactive ranges with erosion", () => {
  const r = calcTectonics({
    gravityG: 1.0,
    inactiveRanges: [{ type: "ural", originalHeightM: 5000, ageMyr: 200, erosionRate: 5 }],
  });
  assert.equal(r.tectonics.inactiveProfiles.length, 1);
  assert.equal(r.tectonics.inactiveProfiles[0].erodedHeightM, 4000);
});

test("calcTectonics → default params produce valid output", () => {
  const r = calcTectonics();
  assert.ok(r.tectonics.maxPeakHeightM > 0);
  assert.ok(r.tectonics.ocean.subsidence.length > 0);
});

// ── spreadingRate ──────────────────────────────────────────

test("spreadingRate → mobile regime mid-range", () => {
  const sr = spreadingRate("mobile", 0.5);
  assert.equal(sr.rateMmYr, 110); // 20 + (200-20)*0.5 = 110
  assert.equal(sr.min, 20);
  assert.equal(sr.max, 200);
});

test("spreadingRate → stagnant regime always 0", () => {
  const sr = spreadingRate("stagnant", 0.5);
  assert.equal(sr.rateMmYr, 0);
  assert.equal(sr.min, 0);
  assert.equal(sr.max, 0);
});

test("spreadingRate → fraction 0 returns min, fraction 1 returns max", () => {
  assert.equal(spreadingRate("mobile", 0).rateMmYr, 20);
  assert.equal(spreadingRate("mobile", 1).rateMmYr, 200);
});

test("spreadingRate → unknown regime falls back to mobile", () => {
  const sr = spreadingRate("nonexistent", 0.5);
  assert.equal(sr.rateMmYr, 110);
});

// ── volcanicArcDistance ────────────────────────────────────

test("volcanicArcDistance → 45° yields ~110 km", () => {
  approxEqual(volcanicArcDistance(45), 110, 1, "arc at 45°");
});

test("volcanicArcDistance → 30° yields ~190 km", () => {
  approxEqual(volcanicArcDistance(30), 110 / Math.tan(Math.PI / 6), 1, "arc at 30°");
});

test("volcanicArcDistance → steeper slab → shorter distance", () => {
  assert.ok(volcanicArcDistance(60) < volcanicArcDistance(30));
});

test("volcanicArcDistance → clamps extreme angles", () => {
  assert.ok(Number.isFinite(volcanicArcDistance(0)), "zero angle finite");
  assert.ok(Number.isFinite(volcanicArcDistance(90)), "90° angle finite");
});

// ── airyRootDepth ─────────────────────────────────────────

test("airyRootDepth → Everest ~50 km root", () => {
  const root = airyRootDepth(8849);
  // ratio = 2800 / (3300 - 2800) = 5.6
  approxEqual(root, 8849 * 5.6, 10, "Everest root");
});

test("airyRootDepth → zero elevation yields zero root", () => {
  assert.equal(airyRootDepth(0), 0);
});

test("airyRootDepth → custom densities", () => {
  // 2670 / (3270 - 2670) = 4.45
  const root = airyRootDepth(5000, 2670, 3270);
  approxEqual(root, 5000 * (2670 / 600), 1, "custom density");
});

test("airyRootDepth → equal densities returns 0", () => {
  assert.equal(airyRootDepth(5000, 3000, 3000), 0);
});

// ── prattDensity ──────────────────────────────────────────

test("prattDensity → zero elevation yields base density", () => {
  approxEqual(prattDensity(0), 2800, 0.01, "base density");
});

test("prattDensity → higher elevation yields lower density", () => {
  assert.ok(prattDensity(5000) < prattDensity(0));
  assert.ok(prattDensity(8000) < prattDensity(5000));
});

test("prattDensity → formula correctness at 5000 m", () => {
  // ρ = 2800 × 100000 / (100000 + 5000) = 2800 × 0.9524 ≈ 2666.7
  approxEqual(prattDensity(5000), 2800 * 100000 / 105000, 0.1, "pratt 5000m");
});

// ── continentalMarginProfile ──────────────────────────────

test("continentalMarginProfile → monotonically increasing depth", () => {
  const m = continentalMarginProfile();
  for (let i = 1; i < m.points.length; i++) {
    assert.ok(
      m.points[i].depthM >= m.points[i - 1].depthM,
      `depth at point ${i} should be >= previous`,
    );
  }
});

test("continentalMarginProfile → first point at depth 0", () => {
  const m = continentalMarginProfile();
  assert.equal(m.points[0].depthM, 0);
  assert.equal(m.points[0].distKm, 0);
});

test("continentalMarginProfile → has 4 segments", () => {
  const m = continentalMarginProfile();
  assert.equal(m.segments.length, 4);
  assert.equal(m.segments[0].name, "Shelf");
  assert.equal(m.segments[1].name, "Slope");
  assert.equal(m.segments[2].name, "Rise");
  assert.equal(m.segments[3].name, "Abyssal Plain");
});

test("continentalMarginProfile → shelf break at specified depth", () => {
  const m = continentalMarginProfile({ shelfDepthM: 200 });
  assert.equal(m.points[1].depthM, 200);
});

// ── maxShieldHeight ───────────────────────────────────────

test("maxShieldHeight → Earth gravity yields ~10 km", () => {
  approxEqual(maxShieldHeight(1.0), 10000, 1, "Earth shield");
});

test("maxShieldHeight → scales inversely with gravity", () => {
  assert.ok(maxShieldHeight(0.5) > maxShieldHeight(1.0));
  assert.ok(maxShieldHeight(2.0) < maxShieldHeight(1.0));
});

test("maxShieldHeight → stagnant lid 1.5x enhancement", () => {
  approxEqual(maxShieldHeight(1.0, true), 15000, 1, "stagnant shield");
});

test("maxShieldHeight → Mars gravity stagnant lid ~39.5 km", () => {
  // 10000 / 0.38 × 1.5 ≈ 39474
  approxEqual(maxShieldHeight(0.38, true), 10000 / 0.38 * 1.5, 10, "Mars stagnant");
});

// ── shieldVolcanoProfile ──────────────────────────────────

test("shieldVolcanoProfile → starts at base, ends at peak", () => {
  const p = shieldVolcanoProfile(10000);
  assert.equal(p.points[0].hM, 0); // base
  approxEqual(p.points[p.points.length - 1].hM, 10000, 1, "peak");
});

test("shieldVolcanoProfile → radius decreases toward peak", () => {
  const p = shieldVolcanoProfile(5000);
  for (let i = 1; i < p.points.length; i++) {
    assert.ok(p.points[i].rKm <= p.points[i - 1].rKm, `radius at ${i} decreasing`);
  }
});

test("shieldVolcanoProfile → baseRadiusKm is positive", () => {
  const p = shieldVolcanoProfile(5000, 5);
  assert.ok(p.baseRadiusKm > 0);
});

// ── riftProfile ───────────────────────────────────────────

test("riftProfile → has 5 zones", () => {
  const r = riftProfile({ grabenWidthKm: 50, grabenDepthM: 1000 });
  assert.equal(r.zones.length, 5);
});

test("riftProfile → graben floor is below baseline", () => {
  const r = riftProfile({ grabenWidthKm: 50, grabenDepthM: 2000 });
  const floor = r.zones[2]; // Graben Floor
  assert.ok(floor.height < 0, "graben floor should be negative");
});

test("riftProfile → volcanic fill raises graben floor", () => {
  const noFill = riftProfile({ grabenWidthKm: 50, grabenDepthM: 2000, volcanicFillM: 0 });
  const filled = riftProfile({ grabenWidthKm: 50, grabenDepthM: 2000, volcanicFillM: 500 });
  assert.ok(filled.zones[2].height > noFill.zones[2].height, "fill raises floor");
});

test("riftProfile → totalWidthKm is sum of zone widths", () => {
  const r = riftProfile({ grabenWidthKm: 80 });
  const sum = r.zones.reduce((s, z) => s + z.width, 0);
  approxEqual(r.totalWidthKm, sum, 0.01, "total rift width");
});

test("riftProfile → shoulders have positive height when specified", () => {
  const r = riftProfile({ grabenWidthKm: 50, grabenDepthM: 1000, shoulderHeightM: 500 });
  assert.equal(r.zones[0].height, 500);
  assert.equal(r.zones[4].height, 500);
});

// ── calcTectonics with Phase 2 features ───────────────────

test("calcTectonics → includes spreading rate", () => {
  const r = calcTectonics({ gravityG: 1.0, tectonicRegime: "mobile" });
  assert.ok(r.tectonics.ocean.spreadingRate, "has spreading rate");
  assert.ok(r.tectonics.ocean.spreadingRate.rateMmYr > 0, "rate is positive");
  assert.equal(typeof r.display.spreadingRate, "string");
});

test("calcTectonics → includes margin profile", () => {
  const r = calcTectonics({ gravityG: 1.0 });
  assert.ok(r.tectonics.margin, "has margin");
  assert.ok(r.tectonics.margin.points.length > 0, "margin has points");
});

test("calcTectonics → includes shield height", () => {
  const r = calcTectonics({ gravityG: 1.0 });
  approxEqual(r.tectonics.maxShieldHeightM, 10000, 1, "shield height at 1g");
  assert.equal(typeof r.display.maxShieldHeight, "string");
});

test("calcTectonics → stagnant regime boosts shield height", () => {
  const mobile = calcTectonics({ gravityG: 1.0, tectonicRegime: "mobile" });
  const stagnant = calcTectonics({ gravityG: 1.0, tectonicRegime: "stagnant" });
  assert.ok(stagnant.tectonics.maxShieldHeightM > mobile.tectonics.maxShieldHeightM);
});

test("calcTectonics → arc distance on andean ranges", () => {
  const r = calcTectonics({
    gravityG: 1.0,
    mountainRanges: [{ type: "andean", widths: {}, heights: {}, slabAngleDeg: 45 }],
  });
  approxEqual(r.tectonics.mountainProfiles[0].arcDistanceKm, 110, 1, "arc at 45°");
});

test("calcTectonics → processes rift valleys", () => {
  const r = calcTectonics({
    gravityG: 1.0,
    riftValleys: [{ grabenWidthKm: 50, grabenDepthM: 1000 }],
  });
  assert.equal(r.tectonics.riftProfiles.length, 1);
  assert.equal(r.tectonics.riftProfiles[0].zones.length, 5);
});

// ── elasticLithosphereThicknessKm ────────────────────────

test("elasticLithosphereThicknessKm → Earth ≈ 43 km", () => {
  const te = elasticLithosphereThicknessKm(4.6, 1, 0);
  assert.ok(te > 30 && te < 70, `Earth Te = ${te} km`);
});

test("elasticLithosphereThicknessKm → young planet has thinner lithosphere", () => {
  const young = elasticLithosphereThicknessKm(0.5, 1, 0);
  const old = elasticLithosphereThicknessKm(4.6, 1, 0);
  assert.ok(young < old, "younger → thinner");
});

test("elasticLithosphereThicknessKm → tidal heating thins lithosphere", () => {
  const noTidal = elasticLithosphereThicknessKm(4.6, 1, 0);
  const tidal = elasticLithosphereThicknessKm(4.6, 1, 5);
  assert.ok(tidal < noTidal, "tidal heating → thinner");
});

test("elasticLithosphereThicknessKm → clamped to [5, 300]", () => {
  const lo = elasticLithosphereThicknessKm(0.01, 0.01, 100);
  const hi = elasticLithosphereThicknessKm(12, 10, 0);
  assert.ok(lo >= 5, `min clamp: ${lo}`);
  assert.ok(hi <= 300, `max clamp: ${hi}`);
});

// ── flexuralShieldLimit ──────────────────────────────────

test("flexuralShieldLimit → positive and increases with Te", () => {
  const thin = flexuralShieldLimit(20, 1);
  const thick = flexuralShieldLimit(80, 1);
  assert.ok(thin > 0, "positive");
  assert.ok(thick > thin, "thicker Te → higher limit");
});

test("flexuralShieldLimit → decreases with gravity", () => {
  const loG = flexuralShieldLimit(50, 0.5);
  const hiG = flexuralShieldLimit(50, 2.0);
  assert.ok(loG > hiG, "lower gravity → higher limit");
});

// ── basalSpreadingLimit ──────────────────────────────────

test("basalSpreadingLimit → positive at Earth gravity", () => {
  const h = basalSpreadingLimit(1.0, "Earth-like");
  assert.ok(h > 10_000, `Earth basal limit = ${h}`);
});

test("basalSpreadingLimit → ice world much lower", () => {
  const ice = basalSpreadingLimit(1.0, "Ice world");
  const rock = basalSpreadingLimit(1.0, "Earth-like");
  assert.ok(ice < rock, "ice yield stress is lower");
});

// ── climateErosionRate ───────────────────────────────────

test("climateErosionRate → Earth baseline ≈ 5 m/Myr", () => {
  const rate = climateErosionRate(288, 0);
  approxEqual(rate, 5, 0.5, "Earth erosion rate");
});

test("climateErosionRate → cold dry planet erodes slower", () => {
  const cold = climateErosionRate(210, 0);
  const earth = climateErosionRate(288, 0);
  assert.ok(cold < earth, "colder → slower");
});

test("climateErosionRate → hot wet planet erodes faster", () => {
  const hot = climateErosionRate(400, 5);
  const earth = climateErosionRate(288, 0);
  assert.ok(hot > earth, "hotter + wetter → faster");
});

test("climateErosionRate → clamped to [0.5, 50]", () => {
  const lo = climateErosionRate(50, 0);
  const hi = climateErosionRate(1000, 50);
  assert.ok(lo >= 0.5, `min clamp: ${lo}`);
  assert.ok(hi <= 50, `max clamp: ${hi}`);
});

// ── compositionMaxPeakM ──────────────────────────────────

test("compositionMaxPeakM → Earth-like = 9267", () => {
  assert.equal(compositionMaxPeakM("Earth-like"), 9267);
});

test("compositionMaxPeakM → Ice world = 3000", () => {
  assert.equal(compositionMaxPeakM("Ice world"), 3000);
});

test("compositionMaxPeakM → unknown falls back to 9267", () => {
  assert.equal(compositionMaxPeakM("Unknown"), 9267);
});

// ── convergenceFactor ────────────────────────────────────

test("convergenceFactor → 50 mm/yr yields 1.0", () => {
  approxEqual(convergenceFactor(50), 1.0, 0.001, "baseline");
});

test("convergenceFactor → 100 mm/yr yields ~1.23", () => {
  const f = convergenceFactor(100);
  assert.ok(f > 1.1 && f < 1.4, `100 mm/yr factor = ${f}`);
});

test("convergenceFactor → clamped to [0.5, 2.0]", () => {
  assert.ok(convergenceFactor(1) >= 0.5, "min clamp");
  assert.ok(convergenceFactor(10000) <= 2.0, "max clamp");
});

// ── volcanicActivity ─────────────────────────────────────

test("volcanicActivity → young planet ≈ 1.0", () => {
  const a = volcanicActivity(0.1, 0);
  assert.ok(a > 0.9 && a <= 1.0, `young activity = ${a}`);
});

test("volcanicActivity → Earth (4.6 Gyr, no tidal) ≈ 0.5", () => {
  const a = volcanicActivity(4.6, 0);
  assert.ok(a > 0.3 && a < 0.7, `Earth activity = ${a}`);
});

test("volcanicActivity → old planet has low activity", () => {
  const a = volcanicActivity(10, 0);
  assert.ok(a < 0.3, `old activity = ${a}`);
});

test("volcanicActivity → tidal heating boosts activity", () => {
  const noTidal = volcanicActivity(4.6, 0);
  const tidal = volcanicActivity(4.6, 5);
  assert.ok(tidal > noTidal, "tidal boost");
});

test("volcanicActivity → Io-like (heavy tidal) exceeds 1.0", () => {
  const a = volcanicActivity(4.6, 4);
  assert.ok(a > 1.0, `Io-like activity = ${a}`);
});

// ── maxPeakHeight with composition ───────────────────────

test("maxPeakHeight → ice world gives lower peak", () => {
  const ice = maxPeakHeight(1.0, "Ice world");
  const earth = maxPeakHeight(1.0, "Earth-like");
  assert.ok(ice < earth, "ice < earth-like");
  approxEqual(ice, 3000, 1, "ice at 1g");
});

test("maxPeakHeight → iron world gives higher peak", () => {
  const iron = maxPeakHeight(1.0, "Iron world");
  const earth = maxPeakHeight(1.0, "Earth-like");
  assert.ok(iron > earth, "iron > earth-like");
});

test("maxPeakHeight → omitted composition defaults to Earth-like", () => {
  approxEqual(maxPeakHeight(1.0), 9267, 1, "default composition");
});

// ── mountainProfile with options ─────────────────────────

test("mountainProfile → convergence rate scales heights", () => {
  const slow = mountainProfile("andean", 1.0, {}, {}, { convergenceMmYr: 20 });
  const fast = mountainProfile("andean", 1.0, {}, {}, { convergenceMmYr: 100 });
  assert.ok(
    fast.peakM > slow.peakM,
    `fast peak ${fast.peakM} > slow peak ${slow.peakM}`,
  );
});

// ── maxShieldHeight with options ─────────────────────────

test("maxShieldHeight → options affect result", () => {
  const basic = maxShieldHeight(1.0, false);
  const withOpts = maxShieldHeight(1.0, false, {
    ageGyr: 4.6,
    massEarth: 1,
    tidalHeatingWm2: 0,
    compositionClass: "Earth-like",
  });
  assert.ok(Number.isFinite(withOpts) && withOpts > 0, "finite positive");
  // Both should be similar for Earth-like params
  assert.ok(Math.abs(basic - withOpts) / basic < 0.5, "similar to basic");
});

test("maxShieldHeight → ice world is lower", () => {
  const earth = maxShieldHeight(1.0, false, { compositionClass: "Earth-like" });
  const ice = maxShieldHeight(1.0, false, { compositionClass: "Ice world" });
  assert.ok(ice < earth, "ice world shield lower");
});

// ── calcTectonics with planet context ────────────────────

test("calcTectonics → accepts planet context params", () => {
  const r = calcTectonics({
    gravityG: 0.38,
    compositionClass: "Mars-like",
    ageGyr: 4.6,
    massEarth: 0.107,
    surfaceTempK: 210,
    h2oPct: 0,
    tidalHeatingWm2: 0,
  });
  assert.ok(r.tectonics.elasticLithosphereKm > 0, "Te present");
  assert.ok(r.tectonics.volcanicActivityFraction > 0, "activity present");
  assert.ok(r.tectonics.climateErosionRateMyr > 0, "erosion rate present");
  assert.ok(r.display.elasticLithosphere, "Te display");
  assert.ok(r.display.volcanicActivity, "activity display");
  assert.ok(r.display.climateErosionRate, "erosion display");
});

test("calcTectonics → Mars-like has higher max peak than Earth at same gravity", () => {
  // Mars-like has slightly lower constant, but lower gravity compensates
  const mars = calcTectonics({ gravityG: 0.38, compositionClass: "Mars-like" });
  const earth = calcTectonics({ gravityG: 1.0, compositionClass: "Earth-like" });
  assert.ok(mars.tectonics.maxPeakHeightM > earth.tectonics.maxPeakHeightM, "lower g wins");
});

test("calcTectonics → convergenceMmYr wired through mountain ranges", () => {
  const slow = calcTectonics({
    gravityG: 1.0,
    mountainRanges: [{ type: "andean", widths: {}, heights: {}, convergenceMmYr: 20 }],
  });
  const fast = calcTectonics({
    gravityG: 1.0,
    mountainRanges: [{ type: "andean", widths: {}, heights: {}, convergenceMmYr: 100 }],
  });
  assert.ok(
    fast.tectonics.mountainProfiles[0].peakM > slow.tectonics.mountainProfiles[0].peakM,
    "faster convergence → taller mountains",
  );
});
