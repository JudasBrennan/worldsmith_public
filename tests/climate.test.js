import test from "node:test";
import assert from "node:assert/strict";

import {
  latitudeTemperature,
  moistureIndex,
  classifyKoppen,
  calcClimateZones,
  KOPPEN_ZONES,
} from "../engine/climate.js";
import { approxEqual } from "./testHelpers.js";

// ── latitudeTemperature ─────────────────────────────────────

test("latitudeTemperature → Earth equator ~26 °C", () => {
  const t = latitudeTemperature(0, 288, 1, 23.44, 1);
  approxEqual(t.meanC, 26, 3, "equator mean");
});

test("latitudeTemperature → Earth lat 60 near 0 °C", () => {
  const t = latitudeTemperature(60, 288, 1, 23.44, 1);
  approxEqual(t.meanC, 0, 5, "lat 60 mean");
});

test("latitudeTemperature → zero tilt → warmest equals coldest", () => {
  const t = latitudeTemperature(45, 288, 1, 0, 1);
  assert.strictEqual(t.warmestC, t.coldestC, "no seasonal variation");
  assert.strictEqual(t.warmestC, t.meanC, "warmest = mean");
});

test("latitudeTemperature → high tilt → larger seasonal swing", () => {
  const earth = latitudeTemperature(45, 288, 1, 23.44, 1);
  const high = latitudeTemperature(45, 288, 1, 60, 1);
  const earthSwing = earth.warmestC - earth.coldestC;
  const highSwing = high.warmestC - high.coldestC;
  assert.ok(highSwing > earthSwing, "60° tilt → wider swing than 23.44°");
});

test("latitudeTemperature → thick atmosphere → near-isothermal", () => {
  const thin = latitudeTemperature(60, 288, 0.01, 23.44, 1);
  const thick = latitudeTemperature(60, 288, 50, 23.44, 1);
  const globalMeanC = 288 - 273.15;
  // Thick atmosphere should be much closer to global mean
  assert.ok(
    Math.abs(thick.meanC - globalMeanC) < Math.abs(thin.meanC - globalMeanC),
    "thick atmosphere → smaller departure from global mean",
  );
});

test("latitudeTemperature → thin atmosphere → large gradient", () => {
  const t = latitudeTemperature(90, 288, 0.006, 23.44, 1);
  assert.ok(t.meanC < -10, "Mars-like pressure → very cold poles");
});

// ── moistureIndex ───────────────────────────────────────────

test("moistureIndex → Hadley equatorial edge → high moisture", () => {
  const m = moistureIndex("hadley", 0, "Extensive oceans", 0, "general");
  assert.ok(m > 0.5, `equatorial moisture ${m} should be > 0.5`);
});

test("moistureIndex → Hadley poleward edge → low moisture", () => {
  const m = moistureIndex("hadley", 0.9, "Extensive oceans", 0, "general");
  assert.ok(m < 0.25, `subsidence moisture ${m} should be < 0.25`);
});

test("moistureIndex → Dry planet → near zero", () => {
  const m = moistureIndex("hadley", 0, "Dry", 0, "general");
  assert.ok(m < 0.1, `dry planet moisture ${m} should be < 0.1`);
});

test("moistureIndex → Ocean world → high everywhere", () => {
  const hadley = moistureIndex("hadley", 0, "Global ocean", 1, "general");
  const ferrel = moistureIndex("ferrel", 0.5, "Global ocean", 1, "warm-coast");
  assert.ok(hadley > 0.7, "ocean world Hadley");
  assert.ok(ferrel > 0.6, "ocean world Ferrel");
});

// ── classifyKoppen ──────────────────────────────────────────

test("classifyKoppen → hot + wet → Af", () => {
  assert.strictEqual(classifyKoppen(27, 30, 22, 0.9, "hadley", "general"), "Af");
});

test("classifyKoppen → hot + dry → BWh", () => {
  assert.strictEqual(classifyKoppen(30, 40, 20, 0.1, "hadley", "general"), "BWh");
});

test("classifyKoppen → cold + wet → Dfc or similar", () => {
  const code = classifyKoppen(-5, 12, -25, 0.7, "ferrel", "warm-coast");
  assert.strictEqual(code[0], "D", `expected D-class, got ${code}`);
});

test("classifyKoppen → very cold → EF", () => {
  assert.strictEqual(classifyKoppen(-30, -5, -55, 0.2, "polar", "general"), "EF");
});

test("classifyKoppen → tundra (warmest 0–10) → ET", () => {
  assert.strictEqual(classifyKoppen(-10, 5, -25, 0.2, "polar", "general"), "ET");
});

test("classifyKoppen → temperate + cold-coast Ferrel → Cs variant", () => {
  const code = classifyKoppen(15, 25, 5, 0.5, "ferrel", "cold-coast");
  assert.ok(code.startsWith("Cs"), `expected Cs*, got ${code}`);
});

test("classifyKoppen → temperate + warm-coast Ferrel → Cf variant", () => {
  const code = classifyKoppen(12, 20, 2, 0.7, "ferrel", "warm-coast");
  assert.ok(code.startsWith("Cf"), `expected Cf*, got ${code}`);
});

// ── calcClimateZones (integration) ──────────────────────────

test("calcClimateZones → Earth-like produces A, B, C, D, E masters", () => {
  const r = calcClimateZones({
    surfaceTempK: 288,
    axialTiltDeg: 23.44,
    circulationCellCount: "3",
    circulationCellRanges: [
      { name: "Cell 1", rangeDegNS: "0-30" },
      { name: "Cell 2", rangeDegNS: "30-60" },
      { name: "Cell 3", rangeDegNS: "60-90" },
    ],
    h2oPct: 0.4,
    waterRegime: "Extensive oceans",
    pressureAtm: 1,
    tidallyLockedToStar: false,
    compositionClass: "Earth-like",
    liquidWaterPossible: true,
    gravityG: 1,
  });
  const masters = new Set(r.zones.map((z) => z.master));
  assert.ok(masters.has("A"), "should have tropical (A)");
  assert.ok(masters.has("E"), "should have polar (E)");
  assert.ok(r.zones.length >= 4, `should have >= 4 zones, got ${r.zones.length}`);
  assert.strictEqual(r.advisory, null, "no advisory for Earth-like");
});

test("calcClimateZones → Earth equatorial zone is tropical (A)", () => {
  const r = calcClimateZones({
    surfaceTempK: 288,
    circulationCellCount: "3",
    circulationCellRanges: [
      { name: "Cell 1", rangeDegNS: "0-30" },
      { name: "Cell 2", rangeDegNS: "30-60" },
      { name: "Cell 3", rangeDegNS: "60-90" },
    ],
    waterRegime: "Extensive oceans",
    pressureAtm: 1,
    liquidWaterPossible: true,
  });
  assert.strictEqual(r.zones[0].master, "A", "first zone should be tropical");
});

test("calcClimateZones → Ferrel band has warm-coast and cold-coast variants", () => {
  const r = calcClimateZones({
    surfaceTempK: 288,
    circulationCellCount: "3",
    circulationCellRanges: [
      { name: "Cell 1", rangeDegNS: "0-30" },
      { name: "Cell 2", rangeDegNS: "30-60" },
      { name: "Cell 3", rangeDegNS: "60-90" },
    ],
    waterRegime: "Extensive oceans",
    pressureAtm: 1,
    liquidWaterPossible: true,
  });
  const variants = r.zones.filter((z) => z.cellRole === "ferrel").map((z) => z.variant);
  assert.ok(variants.includes("warm-coast"), "should have warm-coast variant");
  assert.ok(variants.includes("cold-coast"), "should have cold-coast variant");
});

test("calcClimateZones → dry planet → all B (arid) variants", () => {
  const r = calcClimateZones({
    surfaceTempK: 288,
    circulationCellCount: "3",
    circulationCellRanges: [
      { name: "Cell 1", rangeDegNS: "0-30" },
      { name: "Cell 2", rangeDegNS: "30-60" },
      { name: "Cell 3", rangeDegNS: "60-90" },
    ],
    waterRegime: "Dry",
    pressureAtm: 1,
    liquidWaterPossible: false,
  });
  const nonPolar = r.zones.filter((z) => z.master !== "E");
  for (const z of nonPolar) {
    assert.strictEqual(z.master, "B", `zone ${z.code} at ${z.rangeLabel} should be B, not ${z.master}`);
  }
});

test("calcClimateZones → tidally locked → 3 zones", () => {
  const r = calcClimateZones({
    surfaceTempK: 288,
    tidallyLockedToStar: true,
    pressureAtm: 1,
    liquidWaterPossible: true,
    waterRegime: "Extensive oceans",
  });
  assert.strictEqual(r.zones.length, 3, "should have 3 tidal zones");
  assert.ok(r.advisory.includes("Tidally locked"), "should have tidal advisory");
  const roles = r.zones.map((z) => z.cellRole);
  assert.ok(roles.includes("substellar"), "should have substellar");
  assert.ok(roles.includes("terminator"), "should have terminator");
  assert.ok(roles.includes("antistellar"), "should have antistellar");
});

test("calcClimateZones → no atmosphere → Xna", () => {
  const r = calcClimateZones({ pressureAtm: 0.0001 });
  assert.strictEqual(r.zones.length, 1);
  assert.strictEqual(r.zones[0].code, "Xna");
});

test("calcClimateZones → above boiling → Xbv", () => {
  const r = calcClimateZones({ surfaceTempK: 500, pressureAtm: 1 });
  assert.strictEqual(r.zones.length, 1);
  assert.strictEqual(r.zones[0].code, "Xbv");
});

test("calcClimateZones → ice world + cold → all E", () => {
  const r = calcClimateZones({
    surfaceTempK: 200,
    compositionClass: "Ice world",
    circulationCellCount: "3",
    circulationCellRanges: [
      { name: "Cell 1", rangeDegNS: "0-30" },
      { name: "Cell 2", rangeDegNS: "30-60" },
      { name: "Cell 3", rangeDegNS: "60-90" },
    ],
    pressureAtm: 0.5,
  });
  for (const z of r.zones) {
    assert.strictEqual(z.master, "E", `ice world zone ${z.code} should be E`);
  }
  assert.ok(r.advisory.includes("Ice world"), "should have ice world advisory");
});

test("calcClimateZones → ocean world → fewer B zones than Earth-like", () => {
  const earthLike = calcClimateZones({
    surfaceTempK: 288,
    circulationCellCount: "3",
    circulationCellRanges: [
      { name: "Cell 1", rangeDegNS: "0-30" },
      { name: "Cell 2", rangeDegNS: "30-60" },
      { name: "Cell 3", rangeDegNS: "60-90" },
    ],
    h2oPct: 0.4,
    waterRegime: "Shallow oceans",
    pressureAtm: 1,
    liquidWaterPossible: true,
  });
  const ocean = calcClimateZones({
    surfaceTempK: 288,
    circulationCellCount: "3",
    circulationCellRanges: [
      { name: "Cell 1", rangeDegNS: "0-30" },
      { name: "Cell 2", rangeDegNS: "30-60" },
      { name: "Cell 3", rangeDegNS: "60-90" },
    ],
    h2oPct: 2,
    waterRegime: "Global ocean",
    pressureAtm: 1,
    liquidWaterPossible: true,
  });
  const earthB = earthLike.zones.filter((z) => z.master === "B").length;
  const oceanB = ocean.zones.filter((z) => z.master === "B").length;
  assert.ok(oceanB <= earthB, `ocean B zones (${oceanB}) should be <= Earth-like (${earthB})`);
});

test("KOPPEN_ZONES → all entries have required fields", () => {
  for (const [code, entry] of Object.entries(KOPPEN_ZONES)) {
    assert.ok(entry.code, `${code} missing code`);
    assert.ok(entry.name, `${code} missing name`);
    assert.ok(entry.master, `${code} missing master`);
    assert.ok(entry.description, `${code} missing description`);
  }
});

test("calcClimateZones → defaults produce valid output", () => {
  const r = calcClimateZones();
  assert.ok(r.zones.length > 0, "should produce at least one zone");
  assert.ok(r.display.zoneCount, "should have display.zoneCount");
  assert.ok(r.inputs.surfaceTempK > 0, "inputs should echo back");
});

// ── Altitude lapse rate ─────────────────────────────────────

test("calcClimateZones → altitudeM=0 matches default", () => {
  const base = calcClimateZones({ altitudeM: 0 });
  const noAlt = calcClimateZones();
  assert.deepStrictEqual(base.zones, noAlt.zones);
});

test("calcClimateZones → altitude shifts tropical → non-tropical", () => {
  const opts = {
    surfaceTempK: 288,
    circulationCellCount: "3",
    circulationCellRanges: [
      { name: "Cell 1", rangeDegNS: "0-30" },
      { name: "Cell 2", rangeDegNS: "30-60" },
      { name: "Cell 3", rangeDegNS: "60-90" },
    ],
    waterRegime: "Extensive oceans",
    pressureAtm: 1,
    liquidWaterPossible: true,
  };
  const sea = calcClimateZones({ ...opts, altitudeM: 0 });
  assert.strictEqual(sea.zones[0].master, "A", "sea level equator should be tropical");

  // 3 km × 6.5 = 19.5 °C offset — pushes equatorial zone out of tropical
  const high = calcClimateZones({ ...opts, altitudeM: 3000 });
  assert.notStrictEqual(high.zones[0].master, "A", "3000 m should shift out of tropical");
});

test("calcClimateZones → high altitude → all polar or arid", () => {
  const r = calcClimateZones({ surfaceTempK: 288, altitudeM: 8000, gravityG: 1 });
  for (const z of r.zones) {
    assert.ok(
      z.master === "E" || z.master === "B",
      `at 8 km, zone ${z.code} should be polar (E) or arid (B), got ${z.master}`,
    );
  }
});

test("calcClimateZones → lapse rate scales with gravity", () => {
  const earthG = calcClimateZones({ surfaceTempK: 288, altitudeM: 2000, gravityG: 1 });
  const highG = calcClimateZones({ surfaceTempK: 288, altitudeM: 2000, gravityG: 2 });
  assert.ok(
    highG.zones[0].meanTempC < earthG.zones[0].meanTempC,
    `2g (${highG.zones[0].meanTempC}°C) should be colder than 1g (${earthG.zones[0].meanTempC}°C)`,
  );
});

test("calcClimateZones → altitude echoed in inputs", () => {
  const r = calcClimateZones({ altitudeM: 5000 });
  assert.strictEqual(r.inputs.altitudeM, 5000);
});

test("calcClimateZones → tidally locked + altitude reduces temps", () => {
  const opts = {
    surfaceTempK: 288,
    tidallyLockedToStar: true,
    pressureAtm: 1,
    liquidWaterPossible: true,
    waterRegime: "Extensive oceans",
  };
  const sea = calcClimateZones({ ...opts, altitudeM: 0 });
  const high = calcClimateZones({ ...opts, altitudeM: 5000 });
  assert.strictEqual(high.zones.length, 3, "still 3 tidal zones");
  assert.ok(
    high.zones[0].meanTempC < sea.zones[0].meanTempC,
    "altitude should reduce substellar temp",
  );
});
